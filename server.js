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
