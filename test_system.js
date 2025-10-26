import dotenv from "dotenv";
import http from "http";

dotenv.config();

const SERVER_URL = "http://localhost:3000";

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async run() {
    console.log("🧪 Running Canvas Helper System Tests");
    console.log("====================================");

    for (const { name, testFn } of this.tests) {
      try {
        console.log(`\n🔄 ${name}...`);
        await testFn();
        console.log(`✅ ${name} - PASSED`);
        this.passed++;
      } catch (error) {
        console.log(`❌ ${name} - FAILED: ${error.message}`);
        this.failed++;
      }
    }

    console.log("\n" + "=".repeat(40));
    console.log(`📊 Test Results:`);
    console.log(`   ✅ Passed: ${this.passed}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Total:  ${this.passed + this.failed}`);

    if (this.failed === 0) {
      console.log("\n🎉 All tests passed! System is working correctly.");
    } else {
      console.log(
        `\n⚠️  ${this.failed} test(s) failed. Please check the issues above.`,
      );
    }

    return this.failed === 0;
  }
}

// Helper function to make HTTP requests
async function request(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;

    const options = {
      hostname: "localhost",
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (postData) {
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let responseData = "";

      res.on("data", (chunk) => {
        responseData += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(responseData);
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Test cases
const runner = new TestRunner();

runner.test("Server Health Check", async () => {
  const result = await request("GET", "/");
  if (!result.ok) throw new Error("Server health check failed");
});

runner.test("Snowflake Connection", async () => {
  const result = await request("GET", "/ping-snowflake");
  if (!result.ok) throw new Error("Snowflake connection failed");
});

runner.test("Debug Course Data", async () => {
  const result = await request("GET", "/debug/course/2420098");
  if (!result.ok) throw new Error("Debug endpoint failed");
  if (result.total_files === 0) throw new Error("No course files found");
  console.log(`   📁 Found ${result.total_files} files in course 2420098`);
});

runner.test("Content Retrieval", async () => {
  const result = await request(
    "GET",
    "/content/student_course_2420098/2420098",
  );
  if (!result.ok) throw new Error("Content retrieval failed");
  if (!result.files || result.files.length === 0) {
    throw new Error("No files found for student");
  }
  console.log(`   📚 Retrieved ${result.files.length} files for student`);
});

runner.test("AI Tutoring", async () => {
  const result = await request("POST", "/ask", {
    course_id: "2420098",
    question: "What topics should I focus on for studying?",
  });

  if (!result.ok) throw new Error("AI tutoring request failed");
  if (!result.answer) throw new Error("No AI answer received");
  if (result.source_count === 0)
    throw new Error("No sources used for AI response");

  console.log(`   🤖 AI used ${result.source_count} sources for response`);
  console.log(`   💬 Response length: ${result.answer.length} characters`);
});

runner.test("File Ingestion", async () => {
  const testFile = {
    course_id: "TEST_COURSE",
    file_name: "test_file.txt",
    file_type: "test",
    raw_text: "This is a test file for system validation.",
    file_size_bytes: 42,
  };

  const result = await request("POST", "/ingest", testFile);
  if (!result.ok) throw new Error("File ingestion failed");
  if (!result.id) throw new Error("No file ID returned");

  console.log(
    `   📤 Successfully ingested test file with ID: ${result.id.substring(0, 8)}...`,
  );
});

runner.test("Consistent Student ID Generation", async () => {
  const courseId = "2420098";
  const expectedStudentId = `student_course_${courseId}`;

  // Check debug endpoint shows expected student ID
  const debugResult = await request("GET", `/debug/course/${courseId}`);
  if (debugResult.expected_student_id !== expectedStudentId) {
    throw new Error(
      `Expected student ID ${expectedStudentId}, got ${debugResult.expected_student_id}`,
    );
  }

  console.log(`   🆔 Student ID format is consistent: ${expectedStudentId}`);
});

// Environment validation
runner.test("Environment Configuration", async () => {
  const requiredEnvVars = [
    "SNOWFLAKE_ACCOUNT",
    "SNOWFLAKE_USER",
    "SNOWFLAKE_PASSWORD",
    "SNOWFLAKE_WAREHOUSE",
    "SNOWFLAKE_DATABASE",
    "SNOWFLAKE_SCHEMA",
  ];

  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  console.log(`   🔧 All required environment variables are set`);
});

// Run the tests
runner
  .run()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("❌ Test runner failed:", error.message);
    process.exit(1);
  });
