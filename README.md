# Canvas Helper - AI Study Tutor

A Chrome extension that extracts Canvas course content and powers an AI tutor using Snowflake and Cortex.

## Quick Start

1. **Setup Snowflake**: Create a `.env` file with your Snowflake credentials:
```env
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=CANVAS_HELPER
SNOWFLAKE_SCHEMA=PUBLIC
```

2. **Create Database Tables**:
```sql
CREATE OR REPLACE TABLE COURSE_FILES (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(100),
    course_id VARCHAR(50),
    file_name VARCHAR(500),
    file_type VARCHAR(50),
    raw_text TEXT,
    file_size_bytes INTEGER,
    upload_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE QUERY_LOGS (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(100),
    course_id VARCHAR(50),
    question TEXT,
    answer TEXT,
    context_used TEXT,
    model_used VARCHAR(50),
    response_time_ms INTEGER,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

3. **Start the Server**:
```bash
npm install
npm start
```

4. **Load Chrome Extension**:
   - Open Chrome → Extensions → Developer Mode
   - Load unpacked → Select `chrome_extension` folder
   - Navigate to any Canvas course page
   - Click the extension → "Extract All Content"
   - Click "Open GPA Hero Chat"

## How It Works

1. **Extract**: Chrome extension scrapes Canvas course materials (assignments, discussions, modules, etc.)
2. **Store**: Content is uploaded to Snowflake with consistent student IDs (`student_course_{courseId}`)
3. **Chat**: GPA Hero interface queries Snowflake for relevant content and uses Cortex AI for responses

## API Endpoints

- `GET /` - Health check
- `GET /ping-snowflake` - Test Snowflake connection
- `POST /ingest` - Upload single file
- `POST /ingest-batch` - Upload multiple files
- `POST /ask` - Chat with AI tutor
- `GET /content/:student_id/:course_id` - Get uploaded content
- `GET /debug/course/:course_id` - Debug course data
- `POST /migrate/student-ids/:course_id` - Fix student ID consistency

## Troubleshooting

**"No course materials uploaded"**: Run the migration endpoint to fix student ID mismatches:
```bash
curl -X POST http://localhost:3000/migrate/student-ids/YOUR_COURSE_ID
```

**Debug what's in database**:
```bash
curl http://localhost:3000/debug/course/YOUR_COURSE_ID
```
