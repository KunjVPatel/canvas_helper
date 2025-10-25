document.addEventListener("DOMContentLoaded", () => {
  const getBtn = document.getElementById("get-files-btn");
  const extractAllBtn = document.getElementById("extract-all-btn");
  const statusEl = document.getElementById("status");
  const courseInfoEl = document.getElementById("course-info");

  let currentCourse = null;

  // Platform detection function
  function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes("win")) return "Windows";
    if (userAgent.includes("mac")) return "macOS";
    if (userAgent.includes("linux")) return "Linux";
    return "Unknown";
  }

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
        `✅ Downloaded ${successful}/${total} files${fileTypesMsg} to canvas_downloads/${courseName}/`,
        statusType,
      );
      setCourseInfo(courseName, message.courseId, total, detectPlatform());
    } else if (message.type === "download-error") {
      setStatus("❌ Download error: " + message.error, "error");
    } else if (message.type === "download-failed") {
      console.warn("File download failed:", message.file?.name, message.error);
      setStatus(
        "⚠️ Some downloads failed - check console for details",
        "warning",
      );
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
      "🔍 Scanning course for PDFs, documents, and embedded files...",
      "working",
    );
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0)
        return setStatus("❌ No active tab", "error");
      const tab = tabs[0];

      // Show platform info immediately
      const platform = detectPlatform();
      setStatus(`🔍 Scanning on ${platform}...`, "working");

      // Try send message first (maybe content script is already injected)
      let res = await sendMessageToActiveTab(
        { type: "get-course-files" },
        true,
      );
      if (res.error === "no-content-script" || (res && res.error)) {
        setStatus("📝 Injecting enhanced scraper...", "working");
        res = await injectScriptAndRun(tab.id, "src/scraper.js", {
          type: "get-course-files",
        });
      }

      if (res && res.error) {
        setStatus("❌ Error: " + res.error, "error");
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
          `📚 ${courseName}: Found ${count} files (including embedded PDFs). Starting downloads...`,
          "working",
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
                  "❌ Error: Downloads permission not granted",
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
      "📋 Extracting all course content (text, discussions, assignments)...",
      "working",
    );

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || tabs.length === 0)
        return setStatus("❌ No active tab", "error");
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
            setStatus("❌ Error: Could not extract content", "error");
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
              `📊 Extracted: ${summary.assignments} assignments, ${summary.discussions} discussions, ${summary.files} files`,
              "working",
            );

            // Check if content was downloaded directly by content script
            if (response.downloadedDirectly) {
              setStatus(
                `✅ Complete! Text export downloaded (${sizeKB}KB) to Downloads folder`,
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
                      `✅ Complete! Text export saved (${sizeKB}KB) via background download`,
                      "success",
                    );
                  } else {
                    setStatus(
                      `⚠️ Content extracted (${sizeKB}KB) but save failed. Check Downloads folder anyway.`,
                      "warning",
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
            setStatus("❌ Error: " + errorMsg, "error");
            console.error("Content extraction error:", errorMsg);
          }
        },
      );
    });
  });
});
