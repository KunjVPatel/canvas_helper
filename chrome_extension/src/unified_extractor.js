// Unified Canvas Content Extractor
// Combines file downloading and content extraction, then uploads to Snowflake

class UnifiedCanvasExtractor {
  constructor() {
    this.serverUrl = "http://localhost:3000";
    this.studentId = null;
    this.courseId = null;
    this.courseName = null;
    this.extractedContent = [];
    this.statusCallback = null;
  }

  // Set status callback for UI updates
  setStatusCallback(callback) {
    this.statusCallback = callback;
  }

  updateStatus(message, type = "info") {
    if (this.statusCallback) {
      this.statusCallback(message, type);
    }
    console.log(`[UnifiedExtractor] ${message}`);
  }

  // Generate student ID from current user/session
  generateStudentId() {
    // Create a consistent ID based on course ID to avoid mismatches
    const urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
    const courseId = urlMatch ? urlMatch[1] : "unknown";

    // Use a fixed ID format: student_course_{courseId}
    const consistentId = `student_course_${courseId}`;

    // Store for future use
    localStorage.setItem("canvas_helper_student_id", consistentId);
    return consistentId;
  }

  // Extract course information
  extractCourseInfo() {
    try {
      // Get course name from various possible locations
      const courseNameSelectors = [
        "#breadcrumbs .ellipsible",
        ".course-title",
        "h1.course-title",
        ".course_name",
        '[data-testid="course-name"]',
        'span[title*="Course"]',
      ];

      let courseName = null;
      for (const selector of courseNameSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          courseName = element.textContent.trim();
          break;
        }
      }

      // Get course ID from URL
      const urlMatch = window.location.pathname.match(/\/courses\/(\d+)/);
      const courseId = urlMatch ? urlMatch[1] : "unknown";

      // Clean up course name
      if (courseName) {
        courseName = courseName.replace(/^Course:\s*/, "").trim();
      }

      this.courseId = courseId;
      this.courseName = courseName || `Course_${courseId}`;
      this.studentId = this.generateStudentId();

      return {
        courseId: this.courseId,
        courseName: this.courseName,
        studentId: this.studentId,
      };
    } catch (error) {
      console.error("Error extracting course info:", error);
      return {
        courseId: "unknown",
        courseName: "Unknown_Course",
        studentId: this.generateStudentId(),
      };
    }
  }

  // Extract syllabus content
  async extractSyllabus() {
    try {
      this.updateStatus("📋 Extracting syllabus...", "working");

      // Try to navigate to syllabus page or find syllabus content
      const syllabusContent = document.querySelector(
        ".show-content, .syllabus_course_summary, .course-syllabus",
      );

      if (syllabusContent) {
        return {
          type: "syllabus",
          fileName: "syllabus.txt",
          content: syllabusContent.innerText || syllabusContent.textContent,
        };
      }

      return null;
    } catch (error) {
      console.error("Error extracting syllabus:", error);
      return null;
    }
  }

  // Extract assignments
  async extractAssignments() {
    try {
      this.updateStatus("📝 Extracting assignments...", "working");

      const assignments = [];

      // Look for assignment links and content
      const assignmentElements = document.querySelectorAll(
        '.assignment, .assignment_group, [data-testid="assignment"]',
      );

      for (const assignment of assignmentElements) {
        const titleEl = assignment.querySelector(
          ".assignment_title, .title, h3, h2",
        );
        const descEl = assignment.querySelector(
          ".description, .details, .assignment-description",
        );

        if (titleEl) {
          assignments.push({
            type: "assignment",
            fileName: `assignment_${titleEl.textContent.trim().replace(/\W+/g, "_").toLowerCase()}.txt`,
            content: `Assignment: ${titleEl.textContent.trim()}\n\n${descEl ? descEl.textContent : "No description available"}`,
          });
        }
      }

      return assignments;
    } catch (error) {
      console.error("Error extracting assignments:", error);
      return [];
    }
  }

  // Extract discussions
  async extractDiscussions() {
    try {
      this.updateStatus("💬 Extracting discussions...", "working");

      const discussions = [];
      const discussionElements = document.querySelectorAll(
        '.discussion_topic, .discussion, [data-testid="discussion"]',
      );

      for (const discussion of discussionElements) {
        const titleEl = discussion.querySelector(
          ".discussion-title, .title, h3, h2",
        );
        const contentEl = discussion.querySelector(
          ".discussion-content, .message, .content",
        );

        if (titleEl) {
          discussions.push({
            type: "discussion",
            fileName: `discussion_${titleEl.textContent.trim().replace(/\W+/g, "_").toLowerCase()}.txt`,
            content: `Discussion: ${titleEl.textContent.trim()}\n\n${contentEl ? contentEl.textContent : "No content available"}`,
          });
        }
      }

      return discussions;
    } catch (error) {
      console.error("Error extracting discussions:", error);
      return [];
    }
  }

  // Extract modules and pages
  async extractModulesAndPages() {
    try {
      this.updateStatus("📚 Extracting modules and pages...", "working");

      const content = [];

      // Extract module content
      const moduleElements = document.querySelectorAll(
        '.context_module, .module, [data-testid="module"]',
      );
      for (const module of moduleElements) {
        const titleEl = module.querySelector(
          ".module_name, .name, .title, h2, h3",
        );
        if (titleEl) {
          const moduleItems = module.querySelectorAll(
            ".context_module_item, .module-item, .item",
          );
          let moduleContent = `Module: ${titleEl.textContent.trim()}\n\n`;

          moduleItems.forEach((item) => {
            const itemTitle = item.querySelector(".title, .item_name, a");
            if (itemTitle) {
              moduleContent += `- ${itemTitle.textContent.trim()}\n`;
            }
          });

          content.push({
            type: "module",
            fileName: `module_${titleEl.textContent.trim().replace(/\W+/g, "_").toLowerCase()}.txt`,
            content: moduleContent,
          });
        }
      }

      // Extract page content if we're on a page
      const pageContent = document.querySelector(
        ".show-content, .user_content, .page-content",
      );
      if (pageContent) {
        content.push({
          type: "page",
          fileName: `page_${document.title.replace(/\W+/g, "_").toLowerCase()}.txt`,
          content: `Page: ${document.title}\n\n${pageContent.textContent}`,
        });
      }

      return content;
    } catch (error) {
      console.error("Error extracting modules and pages:", error);
      return [];
    }
  }

  // Extract files and media
  async extractFiles() {
    try {
      this.updateStatus("📎 Finding files and media...", "working");

      const files = [];
      const fileLinks = document.querySelectorAll(
        'a[href*="/files/"], a[href*=".pdf"], a[href*=".doc"], a[href*=".ppt"]',
      );

      for (const link of fileLinks) {
        const fileName = link.textContent.trim() || link.href.split("/").pop();
        const fileUrl = link.href;

        files.push({
          type: "file_reference",
          fileName: `file_ref_${fileName.replace(/\W+/g, "_").toLowerCase()}.txt`,
          content: `File Reference: ${fileName}\nURL: ${fileUrl}\nFound on: ${document.title}`,
        });
      }

      return files;
    } catch (error) {
      console.error("Error extracting files:", error);
      return [];
    }
  }

  // Upload content to Snowflake server
  async uploadToSnowflake(contentItem) {
    try {
      const payload = {
        student_id: this.studentId,
        course_id: this.courseId,
        file_name: contentItem.fileName,
        file_type: contentItem.type,
        raw_text: contentItem.content,
        file_size_bytes: new Blob([contentItem.content]).size,
      };

      const response = await fetch(`${this.serverUrl}/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error uploading to Snowflake:", error);
      throw error;
    }
  }

  // Upload all content in batch
  async uploadBatchToSnowflake(contentItems) {
    try {
      const files = contentItems.map((item) => ({
        student_id: this.studentId,
        course_id: this.courseId,
        file_name: item.fileName,
        file_type: item.type,
        raw_text: item.content,
        file_size_bytes: new Blob([item.content]).size,
      }));

      const response = await fetch(`${this.serverUrl}/ingest-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error batch uploading to Snowflake:", error);
      throw error;
    }
  }

  // Main extraction and upload process
  async extractAndUploadAll() {
    try {
      this.updateStatus("🚀 Starting unified content extraction...", "working");

      // Extract course info
      const courseInfo = this.extractCourseInfo();
      this.updateStatus(`📚 Processing ${courseInfo.courseName}...`, "working");

      // Extract all content types
      const allContent = [];

      // Get syllabus
      const syllabus = await this.extractSyllabus();
      if (syllabus) allContent.push(syllabus);

      // Get assignments
      const assignments = await this.extractAssignments();
      allContent.push(...assignments);

      // Get discussions
      const discussions = await this.extractDiscussions();
      allContent.push(...discussions);

      // Get modules and pages
      const modulesAndPages = await this.extractModulesAndPages();
      allContent.push(...modulesAndPages);

      // Get file references
      const files = await this.extractFiles();
      allContent.push(...files);

      if (allContent.length === 0) {
        this.updateStatus("⚠️ No content found to extract", "warning");
        return { success: false, message: "No content found" };
      }

      this.updateStatus(
        `📦 Found ${allContent.length} items. Uploading to Snowflake...`,
        "working",
      );

      // Upload to Snowflake
      let uploadResult;
      if (allContent.length > 1) {
        uploadResult = await this.uploadBatchToSnowflake(allContent);
      } else {
        uploadResult = await this.uploadToSnowflake(allContent[0]);
      }

      this.updateStatus(
        `✅ Successfully uploaded ${allContent.length} items to Snowflake!`,
        "success",
      );

      return {
        success: true,
        courseInfo,
        contentCount: allContent.length,
        uploadResult,
        content: allContent,
      };
    } catch (error) {
      this.updateStatus(
        `❌ Error during extraction: ${error.message}`,
        "error",
      );
      console.error("Extraction error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Test server connection
  async testServerConnection() {
    try {
      const response = await fetch(`${this.serverUrl}/ping-snowflake`);
      const result = await response.json();
      return result.ok;
    } catch (error) {
      console.error("Server connection test failed:", error);
      return false;
    }
  }
}

// Content script message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "extract-and-upload-unified") {
    const extractor = new UnifiedCanvasExtractor();

    // Set up status callback to send updates back to popup
    extractor.setStatusCallback((statusMsg, statusType) => {
      chrome.runtime.sendMessage({
        type: "extraction-status",
        message: statusMsg,
        statusType: statusType,
      });
    });

    // Start the extraction process
    extractor
      .extractAndUploadAll()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
        });
      });

    // Return true to indicate async response
    return true;
  }

  if (message.type === "test-server-connection") {
    const extractor = new UnifiedCanvasExtractor();
    extractor.testServerConnection().then((connected) => {
      sendResponse({ connected });
    });
    return true;
  }
});

// Make the class available globally for testing
window.UnifiedCanvasExtractor = UnifiedCanvasExtractor;
