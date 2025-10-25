// Enhanced background service worker with organized downloads by course
// Track download progress per course
let downloadStats = new Map();

// Cross-platform path detection
function detectPlatform() {
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes("win")) return "windows";
  if (userAgent.includes("mac")) return "mac";
  if (userAgent.includes("linux")) return "linux";
  return "unknown";
}

// Platform-specific default download paths
function getDefaultDownloadPath() {
  const platform = detectPlatform();
  switch (platform) {
    case "windows":
      return "Downloads/canvas_downloads";
    case "linux":
      return "Downloads/canvas_downloads"; // Linux Chrome uses ~/Downloads
    case "mac":
      return "Downloads/canvas_downloads"; // Mac Chrome uses ~/Downloads
    default:
      return "canvas_downloads";
  }
}

// Default settings for service worker - simplified for canvas_downloads
const DEFAULT_SETTINGS = {
  downloadPath: "canvas_downloads",
  organizeByCourse: true,
  organizeByType: true,
  maxConcurrentDownloads: 3,
  downloadDelay: 1000,
  includeAssignments: true,
  includeModules: true,
  includeDiscussions: true,
  includeFiles: true,
};

let settings = DEFAULT_SETTINGS;

// Initialize settings from storage
async function initializeSettings() {
  try {
    const stored = await chrome.storage.sync.get("canvasHelperSettings");
    if (stored.canvasHelperSettings) {
      settings = { ...DEFAULT_SETTINGS, ...stored.canvasHelperSettings };
    }
    console.log("Settings loaded:", settings);
    console.log("Detected platform:", detectPlatform());
    console.log("Default download path:", getDefaultDownloadPath());
  } catch (err) {
    console.warn("Failed to load settings, using defaults:", err);
    settings = DEFAULT_SETTINGS;
  }
  return settings;
}

// Settings helper functions
function shouldDownload(contentType, source) {
  switch (source) {
    case "assignment":
    case "assignment_embedded":
      return settings.includeAssignments;
    case "module":
      return settings.includeModules;
    case "discussion":
    case "discussion_reply":
      return settings.includeDiscussions;
    case "api":
    case "files":
      return settings.includeFiles;
    default:
      return true;
  }
}

function getBatchConfig() {
  return {
    batchSize: settings.maxConcurrentDownloads,
    delay: settings.downloadDelay,
  };
}

function getDownloadPath(courseName, folderPath = "") {
  // Simple path structure: canvas_downloads/Course/folder/
  const sanitizedCourseName = sanitizePathComponent(
    courseName || "Unknown_Course",
  );
  const sanitizedFolderPath = sanitizePathComponent(folderPath || "files");

  const basePath = `canvas_downloads/${sanitizedCourseName}/${sanitizedFolderPath}`;
  console.log(`Download path: ${basePath}`);
  return basePath;
}

// Debug function to log download attempts
function logDownloadAttempt(filename, downloadPath, url) {
  console.log("=== DOWNLOAD ATTEMPT ===");
  console.log("Filename:", filename);
  console.log("Download Path:", downloadPath);
  console.log("URL:", url);
  console.log("========================");
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  if (message.type === "files-list") {
    const files = Array.isArray(message.files) ? message.files : [];
    const courseUrl = message.courseUrl || "";
    const courseName = message.courseName || "Unknown_Course";
    const courseId = message.courseId || "unknown";

    console.log(
      `background: received files-list for ${courseName} (${courseId})`,
      files.length,
      "files",
    );

    // Initialize settings if needed
    initializeSettings().then(() => {
      // Filter files based on settings
      const filteredFiles = files.filter((file) =>
        shouldDownload(file.contentType, file.source),
      );

      // Initialize download stats for this course
      const courseKey = `${courseId}_${courseName}`;
      downloadStats.set(courseKey, {
        total: filteredFiles.length,
        successful: 0,
        failed: 0,
        courseName,
        courseId,
      });

      if (filteredFiles.length === 0) {
        console.warn("background: no files to download after filtering");
        chrome.runtime.sendMessage({
          type: "download-complete",
          count: 0,
          successful: 0,
          failed: 0,
          courseUrl,
          courseName,
          courseId,
        });
        sendResponse({ accepted: true, message: "No files found" });
        return;
      }

      handleCourseFilesList(
        filteredFiles,
        courseUrl,
        courseName,
        courseId,
      ).catch((err) => {
        console.error("background: error handling files-list", err);
        chrome.runtime.sendMessage({
          type: "download-error",
          error: String(err),
          courseName,
          courseId,
        });
      });

      sendResponse({ accepted: true });
    });
  } else if (message.type === "canvas-data") {
    // Canvas capture functionality
    const dataUrl = message.dataUrl;
    const filename = message.filename || `canvas-${Date.now()}.png`;

    initializeSettings().then(() => {
      const downloadPath = filename; // Download to default Downloads folder

      logDownloadAttempt(filename, downloadPath, "data:image/png");

      chrome.downloads.download(
        {
          url: dataUrl,
          filename: downloadPath,
          conflictAction: "uniquify",
        },
        (id) => {
          if (chrome.runtime.lastError) {
            console.error("canvas download failed", chrome.runtime.lastError);
          } else {
            console.log(
              "canvas download started",
              id,
              "to path:",
              downloadPath,
            );
          }
        },
      );
    });
    sendResponse({ ok: true });
    return true;
  } else if (message.type === "download-text-content") {
    // Download comprehensive text content
    const textContent = message.textContent || "";
    const courseName = message.courseName || "Canvas_Course";
    const courseId = message.courseId || "unknown";

    if (!textContent) {
      sendResponse({ success: false, error: "No content to download" });
      return true;
    }

    // Create filename with timestamp - goes into canvas_downloads
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sanitizedCourseName = sanitizePathComponent(courseName);
    const filename = `${sanitizedCourseName}_Complete_Export_${timestamp}.txt`;
    const fullPath = `canvas_downloads/${sanitizedCourseName}/${filename}`;

    // Convert text to data URL (works in service workers)
    const dataUrl =
      "data:text/plain;charset=utf-8," + encodeURIComponent(textContent);

    console.log(
      `Downloading comprehensive text export: ${filename} (${Math.round(textContent.length / 1024)}KB)`,
    );

    // Try download to organized folder first
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: fullPath,
        conflictAction: "uniquify",
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error("Text download failed:", chrome.runtime.lastError);
          console.log("Attempting fallback to Downloads root...");

          // Fallback: save to Downloads root if folder creation fails
          chrome.downloads.download(
            {
              url: dataUrl,
              filename: filename,
              conflictAction: "uniquify",
              saveAs: false,
            },
            (fallbackId) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "Fallback text download failed:",
                  chrome.runtime.lastError,
                );
                sendResponse({
                  success: false,
                  error: chrome.runtime.lastError.message,
                });
              } else {
                console.log("Fallback text download started:", fallbackId);
                sendResponse({ success: true, downloadId: fallbackId });
              }
            },
          );
        } else {
          console.log("Text download started:", downloadId);
          sendResponse({ success: true, downloadId: downloadId });
        }
      },
    );
    return true;
  }
  return true;
});

// Initialize settings when service worker starts
initializeSettings();

async function handleCourseFilesList(files, courseUrl, courseName, courseId) {
  console.log(
    `background: starting download of ${files.length} files for ${courseName}`,
  );

  const courseKey = `${courseId}_${courseName}`;
  const stats = downloadStats.get(courseKey);

  // Ensure settings are loaded
  await initializeSettings();
  const batchConfig = getBatchConfig();

  // Group files by their folder/type for better organization
  const organizedFiles = organizeFilesByFolder(files, courseName);

  for (let i = 0; i < organizedFiles.length; i += batchConfig.batchSize) {
    const batch = organizedFiles.slice(i, i + batchConfig.batchSize);
    console.log(
      `background: processing batch ${Math.floor(i / batchConfig.batchSize) + 1}/${Math.ceil(organizedFiles.length / batchConfig.batchSize)} for ${courseName}`,
    );

    await Promise.all(
      batch.map((file, idx) =>
        downloadFileWithFallback(file, i + idx, courseKey),
      ),
    );

    // Brief delay between batches to avoid overwhelming the server
    if (i + batchConfig.batchSize < organizedFiles.length) {
      await delay(batchConfig.delay);
    }
  }

  const finalStats = downloadStats.get(courseKey);
  console.log(
    `background: download complete for ${courseName}. Successful: ${finalStats.successful}, Failed: ${finalStats.failed}`,
  );

  chrome.runtime.sendMessage({
    type: "download-complete",
    count: organizedFiles.length,
    successful: finalStats.successful,
    failed: finalStats.failed,
    courseUrl,
    courseName,
    courseId,
  });
}

function organizeFilesByFolder(files, courseName) {
  return files.map((file) => {
    let folderPath = "";

    // Determine the folder structure
    if (file.folder && file.folder !== "root") {
      folderPath = file.folder;
    } else if (file.source) {
      // Organize by source type if no specific folder
      switch (file.source) {
        case "api":
          folderPath = "files";
          break;
        case "assignment":
        case "assignment_embedded":
          folderPath = file.assignmentName
            ? `assignments/${file.assignmentName}`
            : "assignments";
          break;
        case "module":
          folderPath = file.moduleName
            ? `modules/${file.moduleName}`
            : "modules";
          break;
        case "discussion":
        case "discussion_reply":
          folderPath = "discussions";
          break;
        case "page_scan":
        case "html_content":
        case "html_image":
          folderPath = "pages";
          break;
        case "pdf_embedded":
          folderPath = "pdfs";
          break;
        case "dom":
        case "dom_comprehensive":
        default:
          folderPath = "misc";
          break;
      }
    } else {
      folderPath = "misc";
    }

    // Build organized download path for canvas_downloads
    const sanitizedCourseName = sanitizePathComponent(courseName);
    const sanitizedFolderPath = sanitizePathComponent(folderPath);
    const sanitizedFileName = sanitizeFilename(file.name);
    const fullPath = `canvas_downloads/${sanitizedCourseName}/${sanitizedFolderPath}/${sanitizedFileName}`;

    return {
      ...file,
      downloadPath: fullPath,
    };
  });
}

async function downloadFileWithFallback(file, index, courseKey) {
  const stats = downloadStats.get(courseKey);
  const filename = file.name;
  const url = file.url;
  const downloadPath = file.downloadPath;

  logDownloadAttempt(filename, downloadPath, url);
  console.log(
    `background: attempting download ${index + 1}/${stats.total}: ${filename}`,
  );

  // Validate URL
  if (!url || typeof url !== "string") {
    console.error(`background: invalid URL for file: ${filename}`);
    stats.failed++;
    downloadStats.set(courseKey, stats);
    chrome.runtime.sendMessage({
      type: "download-failed",
      file,
      error: "Invalid URL",
    });
    return;
  }

  // Try direct download first
  try {
    const directResult = await new Promise((resolve) => {
      chrome.downloads.download(
        {
          url: url,
          filename: downloadPath,
          conflictAction: "uniquify",
          saveAs: false,
        },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          if (err) resolve({ ok: false, error: err.message });
          else resolve({ ok: true, downloadId });
        },
      );
    });

    if (directResult.ok) {
      console.log(
        `background: direct download started for ${filename} (ID: ${directResult.downloadId})`,
      );
      console.log(`Download path: ${downloadPath}`);
      stats.successful++;
      downloadStats.set(courseKey, stats);
      return;
    }

    console.warn(
      `background: direct download failed for ${filename}:`,
      directResult.error,
    );
  } catch (err) {
    console.warn(`background: direct download threw for ${filename}:`, err);
  }

  // Fallback: fetch with credentials and download blob
  try {
    console.log(`background: attempting fetch fallback for ${filename}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const resp = await fetch(url, {
      credentials: "include",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      throw new Error(`fetch failed: ${resp.status} ${resp.statusText}`);
    }

    // Check content type
    const contentType = resp.headers.get("content-type") || "";
    if (
      contentType.includes("text/html") &&
      !filename.toLowerCase().endsWith(".html")
    ) {
      throw new Error(
        "Received HTML instead of file content (possible auth redirect)",
      );
    }

    const blob = await resp.blob();
    if (blob.size === 0) {
      throw new Error("received empty file");
    }

    const objectUrl = URL.createObjectURL(blob);
    const blobResult = await new Promise((resolve) => {
      chrome.downloads.download(
        {
          url: objectUrl,
          filename: downloadPath,
          conflictAction: "uniquify",
          saveAs: false,
        },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          if (err) {
            console.error(
              `background: download of blob failed for ${filename}:`,
              err,
            );
            resolve({ ok: false, error: err.message });
          } else {
            resolve({ ok: true, downloadId });
          }
        },
      );
    });

    // Clean up object URL after a delay
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);

    if (blobResult.ok) {
      console.log(
        `background: fallback download succeeded for ${filename} (ID: ${blobResult.downloadId})`,
      );
      console.log(`Download path: ${downloadPath}`);
      stats.successful++;
      downloadStats.set(courseKey, stats);
    } else {
      stats.failed++;
      downloadStats.set(courseKey, stats);
      chrome.runtime.sendMessage({
        type: "download-failed",
        file,
        error: blobResult.error,
      });
    }
    return;
  } catch (err) {
    console.error(`background: failed to fetch and download ${filename}:`, err);
    stats.failed++;
    downloadStats.set(courseKey, stats);
    chrome.runtime.sendMessage({
      type: "download-failed",
      file,
      error: String(err),
    });
  }
}

function sanitizePathComponent(component) {
  if (!component) return "unknown";
  const platform = detectPlatform();

  // Platform-specific character restrictions
  let invalidChars = /[<>:"|?*]/g; // Base invalid characters
  if (platform === "windows") {
    invalidChars = /[<>:"/\\|?*]/g; // Windows is more restrictive
  }

  return component
    .replace(invalidChars, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .substring(0, 50); // Shorter limit for path components
}

function sanitizeFilename(filename) {
  if (!filename) return "untitled";
  const platform = detectPlatform();

  // Platform-specific character restrictions
  let invalidChars = /[<>:"|?*]/g; // Base invalid characters
  if (platform === "windows") {
    invalidChars = /[<>:"/\\|?*]/g; // Windows is more restrictive with backslashes
  }

  return filename
    .replace(invalidChars, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .trim()
    .substring(0, 200); // Limit filename length
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Handle download completion events for better tracking
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === "complete") {
    console.log(`Download completed: ${downloadDelta.id}`);
  } else if (
    downloadDelta.state &&
    downloadDelta.state.current === "interrupted"
  ) {
    console.warn(`Download interrupted: ${downloadDelta.id}`);
  }
});

console.log("Enhanced background service worker loaded");
