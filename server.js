import express from "express";
import dotenv from "dotenv";
import snowflake from "snowflake-sdk";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Simple logging
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

// Snowflake connection
function getConnection() {
  const config = {
    account: process.env.SNOWFLAKE_ACCOUNT,
    username: process.env.SNOWFLAKE_USER,
    password: process.env.SNOWFLAKE_PASSWORD,
    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
    database: process.env.SNOWFLAKE_DATABASE,
    schema: process.env.SNOWFLAKE_SCHEMA,
  };

  const conn = snowflake.createConnection(config);
  return new Promise((resolve, reject) => {
    conn.connect((err) => {
      if (err) {
        log("error", "Snowflake connection failed", { error: err.message });
        reject(err);
      } else {
        log("info", "Connected to Snowflake");
        resolve(conn);
      }
    });
  });
}

// Execute query
async function runQuery(sql, binds = []) {
  const conn = await getConnection();
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      binds: binds,
      complete: (err, stmt, rows) => {
        if (err) {
          log("error", "Query failed", {
            error: err.message,
            sql: sql.substring(0, 100),
          });
          reject(err);
        } else {
          log("info", "Query successful", { rowCount: rows.length });
          resolve(rows);
        }
      },
    });
  });
}

// Generate consistent student ID
function getConsistentStudentId(courseId) {
  return `student_course_${courseId}`;
}

// Health check
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Canvas Helper Server is running" });
});

// Snowflake ping
app.get("/ping-snowflake", async (req, res) => {
  try {
    const rows = await runQuery("SELECT CURRENT_TIMESTAMP() as server_time");
    res.json({ ok: true, snowflake_time: rows[0].SERVER_TIME });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Ingest single file
app.post("/ingest", async (req, res) => {
  try {
    const {
      student_id,
      course_id,
      file_name,
      file_type,
      raw_text,
      file_size_bytes,
    } = req.body;

    // Use consistent student ID format
    const consistentStudentId = getConsistentStudentId(course_id);

    const fileId = randomUUID();
    await runQuery(
      `INSERT INTO COURSE_FILES
       (id, student_id, course_id, file_name, file_type, raw_text, file_size_bytes, upload_timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
      [
        fileId,
        consistentStudentId,
        course_id,
        file_name,
        file_type,
        raw_text,
        file_size_bytes,
      ],
    );

    log("info", "File ingested", {
      fileId,
      consistentStudentId,
      course_id,
      file_name,
    });
    res.json({ ok: true, id: fileId });
  } catch (err) {
    log("error", "Ingest failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Ingest batch files
app.post("/ingest-batch", async (req, res) => {
  try {
    const { files } = req.body;
    const results = [];

    for (const file of files) {
      try {
        const { course_id, file_name, file_type, raw_text, file_size_bytes } =
          file;

        // Use consistent student ID format
        const consistentStudentId = getConsistentStudentId(course_id);

        const fileId = randomUUID();
        await runQuery(
          `INSERT INTO COURSE_FILES
           (id, student_id, course_id, file_name, file_type, raw_text, file_size_bytes, upload_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())`,
          [
            fileId,
            consistentStudentId,
            course_id,
            file_name,
            file_type,
            raw_text,
            file_size_bytes,
          ],
        );

        results.push({ id: fileId, file_name, status: "success" });
      } catch (err) {
        log("error", "Batch item failed", {
          file_name: file.file_name,
          error: err.message,
        });
        results.push({
          file_name: file.file_name,
          status: "error",
          error: err.message,
        });
      }
    }

    log("info", "Batch ingest completed", {
      processed: files.length,
      success: results.filter((r) => r.status === "success").length,
    });
    res.json({ ok: true, processed: files.length, results });
  } catch (err) {
    log("error", "Batch ingest failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// AI tutoring endpoint
app.post("/ask", async (req, res) => {
  try {
    const { student_id, course_id, question } = req.body;

    if (!course_id || !question) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing course_id or question" });
    }

    // Use consistent student ID format
    const consistentStudentId = getConsistentStudentId(course_id);

    log("info", "AI tutoring request", {
      consistentStudentId,
      course_id,
      question: question.substring(0, 100),
    });

    // Get course content from Snowflake
    const rows = await runQuery(
      `SELECT file_name, raw_text, file_type, upload_timestamp
       FROM COURSE_FILES
       WHERE student_id = ? AND course_id = ?
       ORDER BY upload_timestamp DESC
       LIMIT 15`,
      [consistentStudentId, course_id],
    );

    if (rows.length === 0) {
      return res.json({
        ok: true,
        question,
        answer:
          "I don't have any course materials uploaded for you yet. Please use the Canvas Helper extension to extract and upload your course content first, then I'll be able to help you study!",
        source_count: 0,
        used_context_chars: 0,
        suggestion:
          "Use the Chrome extension to extract course content from Canvas",
      });
    }

    // Build context from course materials
    const contextChunks = rows.map((r) => {
      const name = r.FILE_NAME || r.file_name || "";
      const text = r.RAW_TEXT || r.raw_text || "";
      const type = r.FILE_TYPE || r.file_type || "";
      const truncatedText =
        text.length > 800 ? text.substring(0, 800) + "..." : text;
      return `[${type.toUpperCase()}] ${name}:\n${truncatedText}`;
    });

    const fullContext = contextChunks.join("\n\n");

    // Load system prompt
    const systemPromptPath = path.join(process.cwd(), "systemprompt.txt");
    let systemPrompt = "You are a helpful AI tutor.";
    if (fs.existsSync(systemPromptPath)) {
      systemPrompt = fs.readFileSync(systemPromptPath, "utf-8");
    }

    // Generate AI response using Snowflake Cortex
    const cortexQuery = `
      SELECT SNOWFLAKE.CORTEX.COMPLETE(
        'mistral-large2',
        CONCAT(?, '\n\nCOURSE MATERIALS:\n', ?, '\n\nSTUDENT QUESTION: ', ?)
      ) as ai_response
    `;

    const aiRows = await runQuery(cortexQuery, [
      systemPrompt,
      fullContext,
      question,
    ]);
    const aiAnswer =
      aiRows[0]?.AI_RESPONSE ||
      "I apologize, but I'm having trouble generating a response right now.";

    log("info", "AI response generated", {
      sources: rows.length,
      answerLength: aiAnswer.length,
    });

    res.json({
      ok: true,
      question,
      answer: aiAnswer,
      source_count: rows.length,
      used_context_chars: fullContext.length,
      model: "mistral-large2",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log("error", "AI tutoring failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get content for student/course
app.get("/content/:student_id/:course_id", async (req, res) => {
  try {
    const { course_id } = req.params;

    // Use consistent student ID format
    const consistentStudentId = getConsistentStudentId(course_id);

    const rows = await runQuery(
      `SELECT file_name, file_type, upload_timestamp, LENGTH(raw_text) as content_length
       FROM COURSE_FILES
       WHERE student_id = ? AND course_id = ?
       ORDER BY upload_timestamp DESC`,
      [consistentStudentId, course_id],
    );

    res.json({
      ok: true,
      student_id: consistentStudentId,
      course_id,
      files: rows,
      total_files: rows.length,
    });
  } catch (err) {
    log("error", "Content retrieval failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Debug endpoint to check course data
app.get("/debug/course/:course_id", async (req, res) => {
  try {
    const { course_id } = req.params;

    const allData = await runQuery(
      `SELECT student_id, course_id, file_name, file_type, upload_timestamp,
              LENGTH(raw_text) as content_length
       FROM COURSE_FILES
       WHERE course_id = ?
       ORDER BY upload_timestamp DESC`,
      [course_id],
    );

    const studentIds = await runQuery(
      `SELECT DISTINCT student_id, COUNT(*) as file_count
       FROM COURSE_FILES
       WHERE course_id = ?
       GROUP BY student_id
       ORDER BY file_count DESC`,
      [course_id],
    );

    res.json({
      ok: true,
      course_id,
      total_files: allData.length,
      unique_student_ids: studentIds,
      recent_files: allData.slice(0, 10),
      expected_student_id: getConsistentStudentId(course_id),
      debug_info: {
        message: "Check if student_id patterns match between upload and query",
        suggestion:
          "All data should use the expected_student_id format for consistency",
      },
    });
  } catch (err) {
    log("error", "Debug endpoint failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Migration endpoint to fix student IDs
app.post("/migrate/student-ids/:course_id", async (req, res) => {
  try {
    const { course_id } = req.params;
    const expectedStudentId = getConsistentStudentId(course_id);

    const inconsistentData = await runQuery(
      `SELECT DISTINCT student_id, COUNT(*) as file_count
       FROM COURSE_FILES
       WHERE course_id = ?
         AND student_id != ?
       GROUP BY student_id`,
      [course_id, expectedStudentId],
    );

    if (inconsistentData.length === 0) {
      return res.json({
        ok: true,
        message: "No migration needed - all student IDs are already consistent",
        course_id,
        migrated_count: 0,
      });
    }

    let totalMigrated = 0;

    for (const row of inconsistentData) {
      const oldStudentId = row.STUDENT_ID || row.student_id;

      await runQuery(
        `UPDATE COURSE_FILES
         SET student_id = ?
         WHERE student_id = ? AND course_id = ?`,
        [expectedStudentId, oldStudentId, course_id],
      );

      const fileCount = row.FILE_COUNT || row.file_count || 0;
      totalMigrated += fileCount;

      log("info", "Migrated student ID", {
        old_id: oldStudentId,
        new_id: expectedStudentId,
        files_updated: fileCount,
      });
    }

    res.json({
      ok: true,
      message: "Student ID migration completed successfully",
      course_id,
      expected_student_id: expectedStudentId,
      total_files_migrated: totalMigrated,
    });
  } catch (err) {
    log("error", "Migration failed", { error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

log("info", "🚀 Canvas Helper AI Tutor Server Starting...");
log("info", "🔎 Environment Check:", {
  account: process.env.SNOWFLAKE_ACCOUNT ? "✅ Set" : "❌ Missing",
  user: process.env.SNOWFLAKE_USER ? "✅ Set" : "❌ Missing",
  warehouse: process.env.SNOWFLAKE_WAREHOUSE ? "✅ Set" : "❌ Missing",
  database: process.env.SNOWFLAKE_DATABASE ? "✅ Set" : "❌ Missing",
  schema: process.env.SNOWFLAKE_SCHEMA ? "✅ Set" : "❌ Missing",
  password: process.env.SNOWFLAKE_PASSWORD ? "✅ Set" : "❌ Missing",
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  log("info", `🚀 Canvas Helper Server running on http://localhost:${PORT}`);
  log("info", "Available endpoints:", {
    health: `GET http://localhost:${PORT}/`,
    snowflakePing: `GET http://localhost:${PORT}/ping-snowflake`,
    ingest: `POST http://localhost:${PORT}/ingest`,
    batchIngest: `POST http://localhost:${PORT}/ingest-batch`,
    askAITutor: `POST http://localhost:${PORT}/ask`,
    getContent: `GET http://localhost:${PORT}/content/:student_id/:course_id`,
    debugCourse: `GET http://localhost:${PORT}/debug/course/:course_id`,
    migrateStudentIds: `POST http://localhost:${PORT}/migrate/student-ids/:course_id`,
  });
});
