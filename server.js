import express from 'express';
import dotenv from 'dotenv';
import snowflake from 'snowflake-sdk';
import { randomUUID } from 'crypto';

dotenv.config();

console.log('🔎 ENV CHECK:', {
  account: process.env.SNOWFLAKE_ACCOUNT,
  user: process.env.SNOWFLAKE_USER,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA
});

const app = express();
app.use(express.json());

// instead of one long-lived connection, we define a function
function getConnection() {
  const conn = snowflake.createConnection({
    account: 'mzc28030.us-east-1',
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA
  });

  return new Promise((resolve, reject) => {
    conn.connect((err, c) => {
      if (err) {
        console.error('❌ Failed to connect to Snowflake:', err.message);
        reject(err);
      } else {
        console.log('✅ Connected to Snowflake as id:', c.getId());
        resolve(conn);
      }
    });
  });
}

// runQuery now makes a fresh connection, runs the SQL, then destroys it
async function runQuery(sql, binds = []) {
  const conn = await getConnection();

  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds,
      complete: function (err, stmt, rows) {
        if (err) {
          console.error('❌ Query error:', err.message);
          conn.destroy(() => {}); // fire and forget close
          reject(err);
        } else {
          console.log('✅ Query success');
          conn.destroy(() => {});
          resolve(rows);
        }
      }
    });
  });
}

// health check route
app.get('/', (req, res) => {
  res.send('Canvas Helper backend is running ✅');
});

// debug: ping snowflake
app.get('/ping-snowflake', async (req, res) => {
  try {
    const rows = await runQuery(
      'SELECT CURRENT_ROLE(), CURRENT_USER(), CURRENT_WAREHOUSE();'
    );
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ingest data route
app.post('/ingest', async (req, res) => {
  console.log('🔥 /ingest body:', req.body);

  const {
    student_id,
    course_id,
    file_name,
    file_type,
    raw_text
  } = req.body;

  const id = randomUUID();

  try {
    await runQuery(
      `INSERT INTO COURSE_FILES
        (id, student_id, course_id, file_name, file_type, raw_text)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, student_id, course_id, file_name, file_type, raw_text]
    );

    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});



app.listen(3000, () => {
  console.log('🚀 server running on http://localhost:3000');
});



async function askSnowflakeCortex(question, context, modelName) {
  const prompt = `
You are a personal study tutor for a college student.
ONLY use the provided class context. If the answer is not in the context,
say "I don't see that in your class materials yet."

Return your answer as:
1. Key topics to study
2. Plain-English explanations
3. Practice / exam-style questions

Student question:
${question}

Class context:
${context}
`;

  // create a new Snowflake connection just for this call
  const conn = await getConnection();

  function execOnConn(sqlText, binds = []) {
    return new Promise((resolve, reject) => {
      conn.execute({
        sqlText,
        binds,
        complete: (err, stmt, rows) => {
          if (err) reject(err);
          else resolve(rows);
        },
      });
    });
  }

  try {
    // ❌ no ALTER SESSION here anymore

    // try to run the Cortex COMPLETE call with the given model name
    const rows = await execOnConn(
      `SELECT SNOWFLAKE.CORTEX.COMPLETE(?, ?) AS ANSWER`,
      [modelName, prompt]
    );

    // pull out the answer text
    const answer =
      rows[0].ANSWER ||
      rows[0].answer ||
      JSON.stringify(rows[0]);

    conn.destroy(() => {});
    return answer;
  } catch (err) {
    conn.destroy(() => {});
    throw err;
  }
}


// === STUDY APP /ask ENDPOINT ===
// Retrieves relevant course content from Snowflake for a given student & course
app.post('/ask', async (req, res) => {
  const { student_id, course_id, question } = req.body;

  try {
    console.log('📡 /ask called:', { student_id, course_id, question });

    // 1. pull content from Snowflake for that student's course
    const rows = await runQuery(
      `SELECT file_name, raw_text
       FROM COURSE_FILES
       WHERE student_id = ?
         AND course_id = ?
       ORDER BY uploaded_at DESC
       LIMIT 10`,
      [student_id, course_id]
    );

    // 2. build trimmed RAG context
    const contextChunks = rows.map(r => {
      const name = r.FILE_NAME || r.file_name || '';
      const text = r.RAW_TEXT || r.raw_text || '';
      return `From ${name}:\n${text}`;
    });

    const fullContext = contextChunks.join("\n\n").slice(0, 4000);

    // 3. ask Snowflake Cortex using the known-good model
    const ai_answer = await askSnowflakeCortex(
      question,
      fullContext,
      'mistral-large2'
    );

    // 4. respond to client (this is what frontend will consume)
    res.json({
      ok: true,
      question,
      answer: ai_answer,
      source_count: rows.length,
      used_context_chars: fullContext.length
    });

  } catch (err) {
    console.error('❌ Error in /ask:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});
