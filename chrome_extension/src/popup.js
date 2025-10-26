document.addEventListener("DOMContentLoaded", () => {
  const getBtn = document.getElementById("get-files-btn");
  const extractAllBtn = document.getElementById("extract-all-btn");
  const unifiedExtractBtn = document.getElementById("unified-extract-btn");
  const openChatBtn = document.getElementById("open-chat-btn");
  const statusEl = document.getElementById("status");
  const courseInfoEl = document.getElementById("course-info");
  const serverStatusEl = document.getElementById("server-indicator");
  const courseListEl = document.getElementById("course-list");
  const sidebarEl = document.getElementById("sidebar");

  let currentCourse = null;
  let serverConnected = false;
  let trackedCourses = new Map(); // Store tracked courses

  // Load tracked courses from storage
  chrome.storage.sync.get(['trackedCourses'], (result) => {
    if (result.trackedCourses) {
      trackedCourses = new Map(JSON.parse(result.trackedCourses));
      updateCourseList();
    }
  });

  // Add course list to sidebar
  function updateCourseList() {
    if (courseListEl) {
      courseListEl.innerHTML = '';
      trackedCourses.forEach((course, courseId) => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        if (currentCourse && currentCourse.courseId === courseId) {
          courseItem.classList.add('active');
        }

        courseItem.innerHTML = `
          <div class="course-info">
            <span class="course-name">${course.courseName}</span>
            <span class="file-count">${course.fileCount || 0} files</span>
          </div>
          <div class="course-actions">
            <button class="sync-btn" data-course-id="${courseId}">
              <i class="fas fa-sync"></i>
            </button>
            <button class="remove-btn" data-course-id="${courseId}">
              <i class="fas fa-times"></i>
            </button>
          </div>
        `;
        
        courseListEl.appendChild(courseItem);

        // Add click handlers for course actions
        const syncBtn = courseItem.querySelector('.sync-btn');
        const removeBtn = courseItem.querySelector('.remove-btn');

        syncBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          syncCourse(courseId);
        });

        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCourse(courseId);
        });

        // Make whole course item clickable
        courseItem.addEventListener('click', () => {
          switchToCourse(courseId);
        });
      });

      // Save tracked courses to storage
      chrome.storage.sync.set({
        'trackedCourses': JSON.stringify([...trackedCourses])
      });

      // Show/hide sidebar based on whether we have courses
      if (sidebarEl) {
        sidebarEl.style.display = trackedCourses.size > 0 ? 'block' : 'none';
      }
    }
  }

  function addCourse(course) {
    if (!course.courseId) return;
    trackedCourses.set(course.courseId, {
      courseName: course.courseName,
      fileCount: course.fileCount || 0,
      lastUpdated: new Date().toISOString()
    });
    updateCourseList();
  }

  function removeCourse(courseId) {
    trackedCourses.delete(courseId);
    updateCourseList();
  }

  function syncCourse(courseId) {
    const course = trackedCourses.get(courseId);
    if (course) {
      setStatus(`Syncing ${course.courseName}...`, 'working');
      // TODO: Implement course sync logic
      // This should re-scan the course for new content
    }
  }

  function switchToCourse(courseId) {
    const course = trackedCourses.get(courseId);
    if (course) {
      currentCourse = {
        courseId: courseId,
        courseName: course.courseName,
        fileCount: course.fileCount
      };
      updateCourseList(); // This will update the active state
      setCourseInfo(course.courseName, courseId, course.fileCount, detectPlatform());
    }
  }

  // Platform detection function
  function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) return "Windows";
    if (userAgent.includes("mac")) return "macOS";
    if (userAgent.includes("linux")) return "Linux";
    return "Unknown";
  }

  // Check server connection
  async function checkServerConnection() {
    try {
      const response = await fetch("http://localhost:3000/ping-snowflake");
      const result = await response.json();
      serverConnected = result.ok;

      if (serverConnected) {
        serverStatusEl.textContent = "Connected";
        serverStatusEl.className = "server-connected";
      } else {
        serverStatusEl.textContent = "Server Error";
        serverStatusEl.className = "server-disconnected";
      }
    } catch (error) {
      serverConnected = false;
      serverStatusEl.textContent = "Disconnected";
      serverStatusEl.className = "server-disconnected";
    }
  }

  // Check server connection on load
  checkServerConnection();

  function setStatus(msg, type = "info") {
    statusEl.textContent = msg;

    // Remove all status classes
    statusEl.classList.remove(
      "status-success",
      "status-error",
      "status-working",
    );

    // Add appropriate class based on type
    if (type === "success") {
      statusEl.classList.add("status-success");
    } else if (type === "error") {
      statusEl.classList.add("status-error");
    } else if (type === "working") {
      statusEl.classList.add("status-working");
    }

    console.log("popup:", msg);
  }

  function getDownloadPathForPlatform(platform) {
    switch (platform) {
      case "linux":
      case "Linux":
        return "~/Downloads/canvas_downloads/";
      case "windows":
      case "Windows":
        return "%USERPROFILE%/Downloads/canvas_downloads/";
      case "mac":
      case "macOS":
        return "~/Downloads/canvas_downloads/";
      default:
        return "Downloads/canvas_downloads/";
    }
  }

  function setCourseInfo(courseName, courseId, fileCount, platform = null) {
    if (courseInfoEl) {
      if (courseName && courseId) {
        let platformInfo = "";
        if (platform) {
          const downloadPath = getDownloadPathForPlatform(platform);
          platformInfo = `<strong>Platform:</strong> ${platform}<br>
                         <strong>Downloads to:</strong> ${downloadPath}<br>`;
        }

        courseInfoEl.innerHTML = `
          <strong>Course:</strong> ${courseName}<br>
          <strong>ID:</strong> ${courseId}<br>
          <strong>Files found:</strong> ${fileCount || 0}<br>
          ${platformInfo}
        `;
        courseInfoEl.style.display = "block";
      } else {
        courseInfoEl.style.display = "none";
      }
    }
  }

  // Listen for background messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    if (message.type === "download-complete") {
      const successful = message.successful || message.count || 0;
      const failed = message.failed || 0;
      const total = message.count || 0;
      const courseName = message.courseName || "Unknown Course";

      console.log("Download complete:", {
        successful,
        failed,
        total,
        courseName,
        message,
      });

      const statusType =
        failed > 0 ? (successful > 0 ? "warning" : "error") : "success";

      // Enhanced status message based on file types
      let fileTypesMsg = "";
      if (total > 5) {
        fileTypesMsg = " (PDFs, docs, media)";
      }

      setStatus(
        `Downloaded ${successful}/${total} files${fileTypesMsg} to canvas_downloads/${courseName}/`,
        statusType,
      );
      setCourseInfo(courseName, message.courseId, total, detectPlatform());
    } else if (message.type === "download-error") {
      setStatus("Download error: " + message.error, "error");
    } else if (message.type === "download-failed") {
      console.warn("File download failed:", message.file?.name, message.error);
      setStatus(
        "Some downloads failed - check console for details",
        "warning",
      );
    } else if (message.type === "extraction-status") {
      setStatus(message.message, message.statusType);
    }
  });

  async function sendMessageToActiveTab(message, tryInject = true) {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs || tabs.length === 0)
          return resolve({ error: "no-active-tab" });
        const tab = tabs[0];
        chrome.tabs.sendMessage(tab.id, message, (resp) => {
          if (chrome.runtime.lastError) {
            // content script not present
            if (tryInject) return resolve({ error: "no-content-script" });
            return resolve({ error: chrome.runtime.lastError.message });
          }
          resolve(resp || {});
        });
      });
    });
  }

  async function injectScriptAndRun(tabId, file, message) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [file],
      });
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (resp) => {
          if (chrome.runtime.lastError)
            resolve({ error: chrome.runtime.lastError.message });
          else resolve(resp || {});
        });
      });
    } catch (err) {
      return { error: String(err) };
    }
  }

  // Enhanced file downloading functionality
  getBtn?.addEventListener("click", () => {
    setStatus(
      "Scanning course for PDFs, documents, and embedded files...",
      "working"
    );

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        return setStatus("Error: No active tab", "error");
      }
      const tab = tabs[0];

      // Show platform info immediately
      const platform = detectPlatform();
      setStatus(`Scanning on ${platform}...`, "working");

      // Try send message first (maybe content script is already injected)
      let res = await sendMessageToActiveTab(
        { type: "get-course-files" },
        true
      );

      if (res.error === "no-content-script" || (res && res.error)) {
        setStatus("Injecting enhanced scraper...", "working");
        res = await injectScriptAndRun(tab.id, "src/scraper.js", {
          type: "get-course-files",
        });
      }

      if (res && res.error) {
        setStatus("Error: " + res.error, "error");
        setCourseInfo(null, null, 0);
        console.error("Canvas Helper Error:", res.error);
      } else {
        const courseName = res.courseName || "Current Course";
        const courseId = res.courseId || "unknown";
        const count = res.count ?? 0;

        console.log("Canvas Helper Debug:", {
          courseName,
          courseId,
          count,
          response: res,
        });

        setStatus(
          `${courseName}: Found ${count} files (including embedded PDFs). Starting downloads...`,
          "working"
        );
        setCourseInfo(courseName, courseId, count, platform);
        currentCourse = { courseName, courseId, count };

        // Check Chrome downloads permission
        if (chrome.permissions) {
          chrome.permissions.contains(
            { permissions: ["downloads"] },
            (result) => {
              if (!result) {
                setStatus(
                  "Error: Downloads permission not granted",
                  "error",
                );
              }
            },
          );
        }
      }
    });
  });

  // Comprehensive content extraction
  extractAllBtn?.addEventListener("click", () => {
    setStatus(
      "Extracting all course content (text, discussions, assignments)...",
      "working",
    );

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0)
        return setStatus("No active tab", "error");
      const tab = tabs[0];

      // Try to inject content extractor if not already present
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/content_extractor.js"],
        });
      } catch (err) {
        console.log("Content extractor may already be loaded");
      }

      // Request comprehensive extraction
      chrome.tabs.sendMessage(
        tab.id,
        { type: "extract-all-content" },
        (response) => {
          if (chrome.runtime.lastError) {
            setStatus("Error: Could not extract content", "error");
            console.error(
              "Content extraction error:",
              chrome.runtime.lastError,
            );
            return;
          }

          if (response && response.success) {
            const summary = response.summary;
            const sizeKB = Math.round(response.textExport.length / 1024);

            setStatus(
              `Extracted: ${summary.assignments} assignments, ${summary.discussions} discussions, ${summary.files} files`,
              "working",
            );

            // Check if content was downloaded directly by content script
            if (response.downloadedDirectly) {
              setStatus(
                `Complete! Text export downloaded (${sizeKB}KB) to Downloads folder`,
                "success",
              );
            } else {
              // Fallback: Send to background for download
              chrome.runtime.sendMessage(
                {
                  type: "download-text-content",
                  textContent: response.textExport,
                  courseName: response.data.course.name || "Canvas_Course",
                  courseId: response.data.course.id || "unknown",
                },
                (bgResponse) => {
                  if (bgResponse && bgResponse.success) {
                    setStatus(
                      `Complete! Text export saved (${sizeKB}KB) via background download`,
                      "success"
                    );
                  } else {
                    setStatus(
                      `Content extracted (${sizeKB}KB) but save failed. Check Downloads folder anyway.`,
                      "warning"
                    );
                    console.warn(
                      "Background download failed:",
                      bgResponse?.error,
                    );
                  }
                },
              );
            }
          } else {
            const errorMsg = response?.error || "Unknown error occurred";
            setStatus("Error: " + errorMsg, "error");
            console.error("Content extraction error:", errorMsg);
          }
        },
      );
    });
  });

  // Unified extraction button
  unifiedExtractBtn?.addEventListener("click", async () => {
    // Check server connection first
    try {
      const response = await fetch("http://localhost:3000/ping-snowflake", {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (!data.ok) {
        setStatus(
          "Error: Server is running but Snowflake connection failed. Check server logs.",
          "error"
        );
        return;
      }
      serverConnected = true;
    } catch (err) {
      setStatus(
        "Error: Cannot connect to server. Please make sure the server is running on port 3000.",
        "error"
      );
      return;
    }

    setStatus("Starting unified extraction and upload...", "working");

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        return setStatus("Error: No active tab", "error");
      }
      const tab = tabs[0];

      try {
        // Inject the unified extractor
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["src/unified_extractor.js"],
        });

        // Start the extraction process
        chrome.tabs.sendMessage(
          tab.id,
          { type: "extract-and-upload-unified" },
          (response) => {
            if (chrome.runtime.lastError) {
              setStatus("Error: Could not start extraction", "error");
              console.error("Extraction error:", chrome.runtime.lastError);
              return;
            }

            if (response && response.success) {
              setStatus(
                `Successfully uploaded ${response.contentCount} items to Snowflake!`,
                "success",
              );
              setCourseInfo(
                response.courseInfo.courseName,
                response.courseInfo.courseId,
                response.contentCount,
                detectPlatform(),
              );

              // Enable chat button
              if (openChatBtn) {
                openChatBtn.style.opacity = "1";
                openChatBtn.disabled = false;
              }
            } else {
              const errorMsg = response?.error || "Unknown error occurred";
              setStatus("Extraction failed: " + errorMsg, "error");
              console.error("Unified extraction error:", errorMsg);
            }
          },
        );
      } catch (error) {
        setStatus("Error: Failed to inject extractor: " + error.message, "error");
        console.error("Script injection error:", error);
      }
    });
  });

  // Open AI chat button - launches OrionChat
  openChatBtn?.addEventListener("click", () => {
    if (!serverConnected) {
      setStatus(
        "Error: Server not connected. Please start the Canvas Helper server.",
        "error"
      );
      return;
    }

    // Get current course info for OrionChat
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const currentTab = tabs[0];

        // Try to extract course info from current Canvas tab
        let courseId = "unknown";
        let courseName = "Canvas Course";

        // Extract course ID from Canvas URL
        const urlMatch = currentTab.url?.match(/\/courses\/(\d+)/);
        if (urlMatch) {
          courseId = urlMatch[1];
        }

        // Generate consistent student ID based on course ID
        let studentId = `student_course_${courseId}`;

        // Store consistent student ID in localStorage for future use
        localStorage.setItem("canvas_helper_student_id", studentId);

        // Extract course name from tab title
        if (currentTab.title && !currentTab.title.includes("Canvas")) {
          courseName = currentTab.title.split(" - ")[0] || courseName;
        }

        // Try to get stored course info or use extracted values
        if (currentCourse) {
          courseName = currentCourse.courseName || courseName;
          courseId = currentCourse.courseId || courseId;
          // Always use the consistent student ID format
          studentId = currentCourse.studentId || studentId;
        }

        // Build GPA Hero URL with Canvas Helper parameters
        const gpaHeroUrl = `http://localhost:8080/index.html?student_id=${encodeURIComponent(studentId)}&course_id=${encodeURIComponent(courseId)}&course_name=${encodeURIComponent(courseName)}`;

        // Open GPA Hero in new tab
        chrome.tabs.create({ url: gpaHeroUrl }, (newTab) => {
          if (chrome.runtime.lastError) {
            setStatus(
              "Error: Could not open chat. Make sure GPA Hero is accessible.",
              "error",
            );
            console.error("Error opening GPA Hero:", chrome.runtime.lastError);
          } else {
            setStatus("Opening GPA Hero AI Tutor...", "success");
          }
        });
      }
    });
  });
  
  // Initialize the popup when the DOM is ready
  console.log("Canvas Helper popup initialized");
});
