// Enhanced Canvas scraper with API integration and subpage exploration
// Enhanced Canvas scraper with comprehensive PDF and file extraction
(function () {
  let courseId = null;
  let courseName = "";
  let scrapedFiles = new Map();
  let exploredPages = new Set();
  let extractedPDFs = new Set();
  let processedUrls = new Set();

  function absUrl(href) {
    try {
      return new URL(href, location.href).toString();
    } catch {
      return href;
    }
  }

  function getCourseIdFromPath() {
    const m = location.pathname.match(/\/courses\/(\d+)(?:\/|$)/);
    return m ? m[1] : null;
  }

  function getCourseName() {
    // Try to get course name from page title or breadcrumbs
    const titleElement = document.querySelector(
      "h1.course-title, .course-name, h1",
    );
    if (titleElement) {
      return titleElement.textContent.trim().replace(/[<>:"/\\|?*]/g, "_");
    }

    // Fallback to course ID
    return courseId ? `Course_${courseId}` : "Canvas_Course";
  }

  async function fetchCanvasAPI(endpoint) {
    try {
      const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: "application/json+canvas-string-ids",
        },
      });

      if (!response.ok) {
        console.warn(
          `API request failed: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      return await response.json();
    } catch (err) {
      console.warn("Canvas API fetch failed:", err);
      return null;
    }
  }

  async function getAllCourseFiles(courseId) {
    console.log(`Fetching all files for course ${courseId}...`);
    const allFiles = [];
    let page = 1;
    const perPage = 100;

    try {
      while (true) {
        const apiUrl = `/api/v1/courses/${courseId}/files?per_page=${perPage}&page=${page}&sort=name`;
        const files = await fetchCanvasAPI(apiUrl);

        if (!files || !Array.isArray(files) || files.length === 0) {
          break;
        }

        files.forEach((file) => {
          if (file.url && file.filename && file.size > 0) {
            allFiles.push({
              url: file.url,
              name: sanitizeFilename(file.filename),
              size: file.size,
              contentType: file["content-type"] || "application/octet-stream",
              folder: file.folder_id || "root",
              createdAt: file.created_at,
              modifiedAt: file.modified_at,
              source: "api",
            });
          }
        });

        if (files.length < perPage) break;
        page++;
      }
    } catch (err) {
      console.error("Error fetching course files:", err);
    }

    console.log(`Found ${allFiles.length} files via Canvas API`);
    return allFiles;
  }

  // Extract all PDFs and files from page content with enhanced PDF detection
  async function extractAllPageFiles(courseId) {
    console.log("Extracting all PDFs and files from page content...");
    const pageFiles = [];

    // Get all pages in the course
    try {
      const pages = await fetchCanvasAPI(`/api/v1/courses/${courseId}/pages`);
      if (pages && Array.isArray(pages)) {
        for (const page of pages) {
          const pageDetail = await fetchCanvasAPI(
            `/api/v1/courses/${courseId}/pages/${page.url}`,
          );
          if (pageDetail && pageDetail.body) {
            const filesInPage = extractFilesFromHTML(
              pageDetail.body,
              pageDetail.title,
            );
            pageFiles.push(...filesInPage);
          }
          await delay(100); // Small delay to avoid rate limiting
        }
      }
    } catch (err) {
      console.warn("Error extracting files from pages:", err);
    }

    // Also scan current page for embedded files and PDFs
    const currentPageFiles = scanCurrentPageForFiles();
    pageFiles.push(...currentPageFiles);

    // Enhanced PDF detection in all page content
    const embeddedPDFs = await extractEmbeddedPDFs(courseId);
    pageFiles.push(...embeddedPDFs);

    console.log(`Found ${pageFiles.length} files in page content`);
    return pageFiles;
  }

  // New function to specifically extract embedded PDFs from all content
  async function extractEmbeddedPDFs(courseId) {
    console.log("Scanning for embedded PDFs in course content...");
    const pdfs = [];
    const processedUrls = new Set();

    try {
      // Scan assignments for embedded PDFs
      const assignments = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/assignments`,
      );
      if (assignments && Array.isArray(assignments)) {
        assignments.forEach((assignment) => {
          if (assignment.description) {
            const pdfFiles = extractPDFsFromHTML(
              assignment.description,
              `assignment_${assignment.name}`,
            );
            pdfFiles.forEach((pdf) => {
              if (!processedUrls.has(pdf.url)) {
                processedUrls.add(pdf.url);
                pdfs.push(pdf);
              }
            });
          }
        });
      }

      // Scan discussion topics for embedded PDFs
      const discussions = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/discussion_topics`,
      );
      if (discussions && Array.isArray(discussions)) {
        discussions.forEach((discussion) => {
          if (discussion.message) {
            const pdfFiles = extractPDFsFromHTML(
              discussion.message,
              `discussion_${discussion.title}`,
            );
            pdfFiles.forEach((pdf) => {
              if (!processedUrls.has(pdf.url)) {
                processedUrls.add(pdf.url);
                pdfs.push(pdf);
              }
            });
          }
        });
      }

      // Scan pages for embedded PDFs
      const pages = await fetchCanvasAPI(`/api/v1/courses/${courseId}/pages`);
      if (pages && Array.isArray(pages)) {
        for (const page of pages) {
          const pageDetail = await fetchCanvasAPI(
            `/api/v1/courses/${courseId}/pages/${page.url}`,
          );
          if (pageDetail && pageDetail.body) {
            const pdfFiles = extractPDFsFromHTML(
              pageDetail.body,
              `page_${pageDetail.title}`,
            );
            pdfFiles.forEach((pdf) => {
              if (!processedUrls.has(pdf.url)) {
                processedUrls.add(pdf.url);
                pdfs.push(pdf);
              }
            });
          }
        }
      }
    } catch (err) {
      console.warn("Error scanning for embedded PDFs:", err);
    }

    console.log(`Found ${pdfs.length} embedded PDFs`);
    return pdfs;
  }

  // Specialized function to extract PDFs from HTML content
  function extractPDFsFromHTML(html, sourceContext = "") {
    if (!html) return [];

    const pdfs = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Enhanced PDF selectors
    const pdfSelectors = [
      'a[href*=".pdf"]',
      'iframe[src*=".pdf"]',
      'embed[src*=".pdf"]',
      'object[data*=".pdf"]',
      'a[href*="/files/"][href*="pdf"]',
      'a[href*="preview=pdf"]',
      'a[href*="content-type=application%2Fpdf"]',
      'a[title*="PDF"]',
      'a[title*="pdf"]',
    ];

    pdfSelectors.forEach((selector) => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element) => {
        const url =
          element.getAttribute("href") ||
          element.getAttribute("src") ||
          element.getAttribute("data");

        if (url && url.toLowerCase().includes("pdf")) {
          let filename = "";

          if (element.download) {
            filename = element.download;
          } else if (element.textContent && element.textContent.trim()) {
            filename = element.textContent.trim();
          } else if (element.getAttribute("title")) {
            filename = element.getAttribute("title");
          } else {
            filename = extractFilenameFromUrl(url) || "document.pdf";
          }

          // Ensure PDF extension
          if (!filename.toLowerCase().endsWith(".pdf")) {
            filename = filename + ".pdf";
          }

          pdfs.push({
            url: absUrl(url),
            name: sanitizeFilename(filename),
            size: 0,
            contentType: "application/pdf",
            source: "pdf_embedded",
            sourceContext: sourceContext,
            elementType: element.tagName.toLowerCase(),
          });
        }
      });
    });

    // Also look for PDF patterns in text content and URLs
    const urlRegex = /https?:\/\/[^\s<>"'()]+\.pdf[^\s<>"']*/gi;
    const matches = html.match(urlRegex);
    if (matches) {
      matches.forEach((url) => {
        pdfs.push({
          url: url,
          name: sanitizeFilename(extractFilenameFromUrl(url) || "document.pdf"),
          size: 0,
          contentType: "application/pdf",
          source: "pdf_text_pattern",
          sourceContext: sourceContext,
        });
      });
    }

    return pdfs;
  }

  // Scan current page for all embedded files with enhanced PDF detection
  function scanCurrentPageForFiles() {
    const foundFiles = [];
    const fileSelectors = [
      'a[href*=".pdf"]',
      'a[href*=".doc"]',
      'a[href*=".docx"]',
      'a[href*=".ppt"]',
      'a[href*=".pptx"]',
      'a[href*=".xls"]',
      'a[href*=".xlsx"]',
      'a[href*=".txt"]',
      'a[href*=".zip"]',
      'a[href*=".rar"]',
      'a[href*=".py"]',
      'a[href*=".java"]',
      'a[href*=".cpp"]',
      'a[href*=".c"]',
      'a[href*=".html"]',
      'a[href*=".css"]',
      'a[href*=".js"]',
      'iframe[src*=".pdf"]',
      'embed[src*=".pdf"]',
      'object[data*=".pdf"]',
      'a[href*="/files/"]',
      'a[href*="/api/v1/files/"]',
      'a[title*="PDF"]',
      'a[title*="pdf"]',
      'a[href*="preview=pdf"]',
      'a[href*="content-type=application%2Fpdf"]',
      "a[download]",
    ];

    fileSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        const url = element.href || element.src || element.data || "";
        if (url && !processedUrls.has(url)) {
          processedUrls.add(url);

          let filename = "";
          if (element.download) {
            filename = element.download;
          } else if (element.textContent && element.textContent.trim()) {
            filename = element.textContent.trim();
          } else {
            filename = extractFilenameFromUrl(url);
          }

          if (filename && isValidFileType(url)) {
            foundFiles.push({
              url: absUrl(url),
              name: sanitizeFilename(filename),
              size: 0,
              contentType: getContentTypeFromUrl(url),
              source: url.toLowerCase().includes(".pdf")
                ? "pdf_embedded"
                : "page_scan",
              location: window.location.href,
              elementType: element.tagName.toLowerCase(),
            });
          }
        }
      });
    });

    // Additional PDF scanning from page HTML content
    const pageHTML = document.documentElement.outerHTML;
    const additionalPDFs = extractPDFsFromPageHTML(pageHTML);
    foundFiles.push(...additionalPDFs);

    return foundFiles;
  }

  // Extract PDFs from the current page's HTML content
  function extractPDFsFromPageHTML(htmlContent) {
    const pdfs = [];

    // Look for PDF URLs in the HTML source
    const pdfUrlRegex = /https?:\/\/[^\s<>"'()]+\.pdf[^\s<>"']*/gi;
    const matches = htmlContent.match(pdfUrlRegex);

    if (matches) {
      const uniqueUrls = [...new Set(matches)]; // Remove duplicates
      uniqueUrls.forEach((url) => {
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          pdfs.push({
            url: url,
            name: sanitizeFilename(
              extractFilenameFromUrl(url) || "document.pdf",
            ),
            size: 0,
            contentType: "application/pdf",
            source: "pdf_embedded",
            location: window.location.href,
          });
        }
      });
    }

    // Look for Canvas file URLs that might be PDFs
    const canvasFileRegex =
      /https?:\/\/[^\/]+\/(?:courses\/\d+\/)?files\/\d+[^\s<>"']*/gi;
    const fileMatches = htmlContent.match(canvasFileRegex);

    if (fileMatches) {
      const uniqueFileUrls = [...new Set(fileMatches)];
      uniqueFileUrls.forEach((url) => {
        if (!processedUrls.has(url)) {
          processedUrls.add(url);
          // We'll let the content type detection determine if it's actually a PDF
          pdfs.push({
            url: url,
            name: sanitizeFilename(
              extractFilenameFromUrl(url) || "canvas_file",
            ),
            size: 0,
            contentType: "application/octet-stream", // Will be determined later
            source: "canvas_file_embedded",
            location: window.location.href,
          });
        }
      });
    }

    return pdfs;
  }

  // Check if URL is a valid file type we want to download
  function isValidFileType(url) {
    const fileExtensions = [
      ".pdf",
      ".doc",
      ".docx",
      ".ppt",
      ".pptx",
      ".xls",
      ".xlsx",
      ".txt",
      ".rtf",
      ".odt",
      ".ods",
      ".odp",
      ".zip",
      ".rar",
      ".tar",
      ".gz",
      ".7z",
      ".py",
      ".java",
      ".cpp",
      ".c",
      ".h",
      ".html",
      ".css",
      ".js",
      ".json",
      ".xml",
      ".csv",
      ".sql",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".svg",
      ".tiff",
      ".mp4",
      ".mp3",
      ".wav",
      ".avi",
      ".mov",
      ".wmv",
    ];

    const urlLower = url.toLowerCase();
    return (
      fileExtensions.some((ext) => urlLower.includes(ext)) ||
      url.includes("/files/") ||
      url.includes("/api/v1/files/")
    );
  }

  // Get content type from URL
  function getContentTypeFromUrl(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes(".pdf")) return "application/pdf";
    if (urlLower.includes(".doc")) return "application/msword";
    if (urlLower.includes(".docx"))
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (urlLower.includes(".ppt")) return "application/vnd.ms-powerpoint";
    if (urlLower.includes(".pptx"))
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (urlLower.includes(".xls")) return "application/vnd.ms-excel";
    if (urlLower.includes(".xlsx"))
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (urlLower.includes(".zip")) return "application/zip";
    if (urlLower.includes(".txt")) return "text/plain";
    if (urlLower.includes(".jpg") || urlLower.includes(".jpeg"))
      return "image/jpeg";
    if (urlLower.includes(".png")) return "image/png";
    return "application/octet-stream";
  }

  async function getCourseFolders(courseId) {
    console.log(`Fetching folder structure for course ${courseId}...`);
    try {
      const folders = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/folders`,
      );
      if (!folders || !Array.isArray(folders)) return [];

      return folders.map((folder) => ({
        id: folder.id,
        name: sanitizeFilename(folder.name),
        path: folder.full_name,
        parent: folder.parent_folder_id,
      }));
    } catch (err) {
      console.error("Error fetching folders:", err);
      return [];
    }
  }

  async function getAssignmentFiles(courseId) {
    console.log(`Fetching assignment files for course ${courseId}...`);
    const files = [];

    try {
      const assignments = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/assignments`,
      );
      if (!assignments || !Array.isArray(assignments)) return files;

      for (const assignment of assignments) {
        // Check for assignment attachments
        if (assignment.attachments && Array.isArray(assignment.attachments)) {
          assignment.attachments.forEach((att) => {
            if (att.url && att.filename) {
              files.push({
                url: att.url,
                name: sanitizeFilename(att.filename),
                size: att.size || 0,
                folder: `assignments/${sanitizeFilename(assignment.name)}`,
                source: "assignment",
                assignmentName: assignment.name,
              });
            }
          });
        }

        // Check assignment description for embedded files
        if (assignment.description) {
          const embeddedFiles = extractFilesFromHTML(assignment.description);
          embeddedFiles.forEach((file) => {
            files.push({
              ...file,
              folder: `assignments/${sanitizeFilename(assignment.name)}`,
              source: "assignment_embedded",
            });
          });
        }
      }
    } catch (err) {
      console.error("Error fetching assignment files:", err);
    }

    return files;
  }

  async function getModuleFiles(courseId) {
    console.log(`Fetching module files for course ${courseId}...`);
    const files = [];

    try {
      const modules = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/modules`,
      );
      if (!modules || !Array.isArray(modules)) return files;

      for (const module of modules) {
        const items = await fetchCanvasAPI(
          `/api/v1/courses/${courseId}/modules/${module.id}/items`,
        );
        if (!items || !Array.isArray(items)) continue;

        for (const item of items) {
          if (item.type === "File" && item.url) {
            // Fetch file details
            const fileData = await fetchCanvasAPI(item.url);
            if (fileData && fileData.url && fileData.filename) {
              files.push({
                url: fileData.url,
                name: sanitizeFilename(fileData.filename),
                size: fileData.size || 0,
                folder: `modules/${sanitizeFilename(module.name)}`,
                source: "module",
                moduleName: module.name,
              });
            }
          } else if (item.type === "ExternalUrl" && item.external_url) {
            // Check if external URL is a file
            if (isFileUrl(item.external_url)) {
              files.push({
                url: item.external_url,
                name: sanitizeFilename(
                  item.title || extractFilenameFromUrl(item.external_url),
                ),
                size: 0,
                folder: `modules/${sanitizeFilename(module.name)}`,
                source: "module_external",
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching module files:", err);
    }

    return files;
  }

  async function getDiscussionFiles(courseId) {
    console.log(`Fetching discussion files for course ${courseId}...`);
    const files = [];

    try {
      const discussions = await fetchCanvasAPI(
        `/api/v1/courses/${courseId}/discussion_topics`,
      );
      if (!discussions || !Array.isArray(discussions)) return files;

      for (const discussion of discussions) {
        // Check discussion message for embedded files
        if (discussion.message) {
          const embeddedFiles = extractFilesFromHTML(discussion.message);
          embeddedFiles.forEach((file) => {
            files.push({
              ...file,
              folder: `discussions/${sanitizeFilename(discussion.title)}`,
              source: "discussion",
            });
          });
        }

        // Get discussion entries (replies) - limited to avoid too many requests
        try {
          const entries = await fetchCanvasAPI(
            `/api/v1/courses/${courseId}/discussion_topics/${discussion.id}/entries?per_page=50`,
          );
          if (entries && Array.isArray(entries)) {
            entries.forEach((entry) => {
              if (entry.message) {
                const embeddedFiles = extractFilesFromHTML(entry.message);
                embeddedFiles.forEach((file) => {
                  files.push({
                    ...file,
                    folder: `discussions/${sanitizeFilename(discussion.title)}`,
                    source: "discussion_reply",
                  });
                });
              }
            });
          }
        } catch (err) {
          console.warn(
            `Error fetching discussion entries for ${discussion.title}:`,
            err,
          );
        }
      }
    } catch (err) {
      console.error("Error fetching discussion files:", err);
    }

    return files;
  }

  function extractFilesFromHTML(html, pageTitle = "") {
    const files = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Comprehensive file selectors with enhanced PDF detection
    const fileSelectors = [
      'a[href*="/files/"]',
      'a[href*="/api/v1/files/"]',
      'a[href*="verifier="]',
      'a[href*=".pdf"]',
      'a[href*=".doc"]',
      'a[href*=".docx"]',
      'a[href*=".ppt"]',
      'a[href*=".pptx"]',
      'a[href*=".xls"]',
      'a[href*=".xlsx"]',
      'a[href*=".txt"]',
      'a[href*=".zip"]',
      'a[href*=".rar"]',
      'a[href*=".py"]',
      'a[href*=".java"]',
      'a[href*=".cpp"]',
      'a[title*="PDF"]',
      'a[title*="pdf"]',
      'a[href*="preview=pdf"]',
      'a[href*="content-type=application%2Fpdf"]',
      "a[download]",
      'iframe[src*=".pdf"]',
      'embed[src*=".pdf"]',
      'object[data*=".pdf"]',
    ];

    fileSelectors.forEach((selector) => {
      const elements = doc.querySelectorAll(selector);
      elements.forEach((element) => {
        const href =
          element.getAttribute("href") ||
          element.getAttribute("src") ||
          element.getAttribute("data");
        if (href && isValidFileType(href)) {
          let filename = "";
          if (element.download) {
            filename = element.download;
          } else if (element.textContent && element.textContent.trim()) {
            filename = element.textContent.trim();
          } else if (element.getAttribute("title")) {
            filename = element.getAttribute("title");
          } else {
            filename = extractFilenameFromUrl(href);
          }

          files.push({
            url: absUrl(href),
            name: sanitizeFilename(filename),
            size: 0,
            contentType: getContentTypeFromUrl(href),
            source: href.toLowerCase().includes(".pdf")
              ? "pdf_embedded"
              : "html_content",
            pageTitle: pageTitle,
          });
        }
      });
    });

    // Find embedded images
    const images = doc.querySelectorAll("img[src]");
    images.forEach((img) => {
      const src = img.getAttribute("src");
      if (
        src &&
        (src.includes("/files/") ||
          src.includes("/api/v1/files/") ||
          isValidFileType(src))
      ) {
        files.push({
          url: absUrl(src),
          name: sanitizeFilename(
            img.getAttribute("alt") ||
              img.getAttribute("title") ||
              extractFilenameFromUrl(src),
          ),
          size: 0,
          contentType: getContentTypeFromUrl(src),
          source: "html_image",
          pageTitle: pageTitle,
        });
      }
    });

    // Extract PDFs from HTML text content using regex
    const pdfUrlRegex = /https?:\/\/[^\s<>"'()]+\.pdf[^\s<>"']*/gi;
    const pdfMatches = html.match(pdfUrlRegex);
    if (pdfMatches) {
      pdfMatches.forEach((url) => {
        files.push({
          url: url,
          name: sanitizeFilename(extractFilenameFromUrl(url) || "document.pdf"),
          size: 0,
          contentType: "application/pdf",
          source: "pdf_embedded",
          pageTitle: pageTitle,
        });
      });
    }

    return files;
  }

  function isFileUrl(url) {
    if (!url) return false;

    // Check for Canvas file patterns
    if (
      url.includes("/files/") ||
      url.includes("/api/v1/files/") ||
      url.includes("verifier=")
    ) {
      return true;
    }

    // Check for common file extensions
    const fileExtensions =
      /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|rtf|odt|ods|odp|zip|rar|tar|gz|7z|jpg|jpeg|png|gif|bmp|svg|mp4|mp3|wav|avi|mov|wmv)(\?|$)/i;
    return fileExtensions.test(url);
  }

  function extractFilenameFromUrl(url) {
    if (!url) return "download";
    try {
      const urlObj = new URL(url, window.location.href);
      let pathname = decodeURIComponent(urlObj.pathname);

      // Handle Canvas file URLs with IDs
      if (pathname.includes("/files/")) {
        const parts = pathname.split("/");
        const fileIndex = parts.indexOf("files");
        if (fileIndex >= 0 && fileIndex < parts.length - 1) {
          return parts[parts.length - 1] || "download";
        }
      }

      // Extract filename from path
      const filename = pathname.split("/").pop() || "download";
      return filename.split("?")[0] || "download"; // Remove query params
    } catch {
      return "download";
    }
  }

  function sanitizeFilename(filename) {
    if (!filename) return "untitled";
    // Remove file extensions from text content if it's not actually a filename
    let cleanName = filename;
    if (cleanName.includes(" ") && cleanName.length > 50) {
      // If it's long text with spaces, truncate and clean
      cleanName = cleanName.split(" ").slice(0, 5).join("_");
    }

    return cleanName
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_{2,}/g, "_")
      .replace(/^_+|_+$/g, "")
      .trim()
      .substring(0, 100); // Shorter limit for better file handling
  }

  async function exploreSubpages(courseId) {
    console.log("Exploring course subpages...");
    const subpageUrls = [
      `/courses/${courseId}/files`,
      `/courses/${courseId}/assignments`,
      `/courses/${courseId}/modules`,
      `/courses/${courseId}/discussion_topics`,
      `/courses/${courseId}/pages`,
      `/courses/${courseId}/announcements`,
    ];

    const files = [];

    for (const subUrl of subpageUrls) {
      if (exploredPages.has(subUrl)) continue;
      exploredPages.add(subUrl);

      try {
        // We'll use API calls instead of actually navigating to subpages
        // This is more efficient and reliable
        console.log(`Processing ${subUrl} via API...`);
      } catch (err) {
        console.warn(`Error exploring ${subUrl}:`, err);
      }
    }

    return files;
  }

  async function comprehensiveCourseScrape(courseId, courseName) {
    console.log(
      `Starting comprehensive scrape for course: ${courseName} (${courseId})`,
    );

    const allFiles = new Map();

    try {
      // 1. Get all files from Files section
      const courseFiles = await getAllCourseFiles(courseId);
      courseFiles.forEach((file) => {
        const key = `${file.url}_${file.name}`;
        if (!allFiles.has(key)) {
          allFiles.set(key, file);
        }
      });

      // 2. Get files from assignments
      const assignmentFiles = await getAssignmentFiles(courseId);
      assignmentFiles.forEach((file) => {
        const key = `${file.url}_${file.name}`;
        if (!allFiles.has(key)) {
          allFiles.set(key, file);
        }
      });

      // 3. Get files from modules
      const moduleFiles = await getModuleFiles(courseId);
      moduleFiles.forEach((file) => {
        const key = `${file.url}_${file.name}`;
        if (!allFiles.has(key)) {
          allFiles.set(key, file);
        }
      });

      // 4. Get files from discussions
      const discussionFiles = await getDiscussionFiles(courseId);
      discussionFiles.forEach((file) => {
        const key = `${file.url}_${file.name}`;
        if (!allFiles.has(key)) {
          allFiles.set(key, file);
        }
      });

      // 5. Extract ALL files from page content (PDFs, docs, etc.)
      const pageFiles = await extractAllPageFiles(courseId);
      pageFiles.forEach((file) => {
        const key = `${file.url}_${file.name}`;
        if (!allFiles.has(key)) {
          allFiles.set(key, file);
        }
      });

      // 6. Add course and folder info to all files
      const folders = await getCourseFolders(courseId);
      const folderMap = new Map(folders.map((f) => [f.id, f.name]));

      const finalFiles = Array.from(allFiles.values()).map((file) => ({
        ...file,
        courseName,
        courseId,
        folderPath:
          file.folder && folderMap.has(file.folder)
            ? folderMap.get(file.folder)
            : file.folder || file.source || "misc",
      }));

      console.log(
        `Comprehensive scrape complete: ${finalFiles.length} files found`,
      );
      return finalFiles;
    } catch (err) {
      console.error("Error in comprehensive course scrape:", err);
      return [];
    }
  }

  // Legacy DOM scraping (fallback)
  function scrapeFromDOM() {
    console.log("Performing comprehensive DOM scraping...");
    const selectors = [
      'a[href*="/files/"]',
      'a[href*="/api/v1/files/"]',
      'a[href*="/download?"]',
      'a[href*=".pdf"]',
      'a[href*=".doc"]',
      'a[href*=".docx"]',
      'a[href*=".ppt"]',
      'a[href*=".pptx"]',
      'a[href*=".xls"]',
      'a[href*=".xlsx"]',
      'a[href*=".txt"]',
      'a[href*=".zip"]',
      'a[href*=".rar"]',
      'a[href*=".py"]',
      'a[href*=".java"]',
      'a[href*=".cpp"]',
      "a[download]",
      "a.download-file",
      "a.file_link",
      "a.file-link",
      "a.instructure_file_link",
      'a[data-api-endpoint*="files"]',
      ".attachment a",
      ".file-link a",
      'iframe[src*=".pdf"]',
      'embed[src*=".pdf"]',
      'object[data*=".pdf"]',
    ];

    const elements = Array.from(document.querySelectorAll(selectors.join(",")));
    const files = [];

    elements.forEach((element) => {
      const href =
        element.getAttribute("href") ||
        element.getAttribute("src") ||
        element.getAttribute("data") ||
        element.dataset.apiEndpoint ||
        "";

      if (!href || href.startsWith("#")) return;

      const url = absUrl(href);

      // Only process if it's a valid file type
      if (!isValidFileType(url)) return;

      let name = "";
      if (element.download) {
        name = element.download;
      } else if (element.dataset.filename) {
        name = element.dataset.filename;
      } else if (element.getAttribute("title")) {
        name = element.getAttribute("title");
      } else if (element.textContent && element.textContent.trim()) {
        name = element.textContent.trim();
      } else {
        name = extractFilenameFromUrl(url);
      }

      files.push({
        url,
        name: sanitizeFilename(name),
        size: 0,
        contentType: getContentTypeFromUrl(url),
        source: "dom_comprehensive",
        courseName,
        courseId,
        elementType: element.tagName.toLowerCase(),
      });
    });

    console.log(`DOM scraping found ${files.length} files`);
    return files;
  }

  // Main message handler
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "get-course-files") return;

    (async () => {
      try {
        courseId = getCourseIdFromPath();
        courseName = getCourseName();

        console.log(`Processing course: ${courseName} (ID: ${courseId})`);

        let files = [];

        if (courseId && msg.comprehensive !== false) {
          // Use comprehensive API-based scraping
          files = await comprehensiveCourseScrape(courseId, courseName);
        }

        // Fallback to DOM scraping if API fails or returns no files
        if (files.length === 0) {
          console.log(
            "API scraping failed or returned no files, falling back to DOM scraping...",
          );
          files = scrapeFromDOM();
        }

        // Remove duplicates
        const uniqueFiles = [];
        const seen = new Set();

        files.forEach((file) => {
          const key = `${file.url}_${file.name}`;
          if (!seen.has(key)) {
            seen.add(key);
            uniqueFiles.push(file);
          }
        });

        console.log(`Final file count: ${uniqueFiles.length}`);

        // Send files to background script
        chrome.runtime.sendMessage(
          {
            type: "files-list",
            files: uniqueFiles,
            courseUrl: location.href,
            courseName,
            courseId,
          },
          () => {
            // no-op
          },
        );

        sendResponse({
          success: true,
          count: uniqueFiles.length,
          courseName,
          courseId,
        });
      } catch (err) {
        console.error("Course scraping failed:", err);
        sendResponse({
          success: false,
          error: String(err),
          courseName,
          courseId,
        });
      }
    })();

    return true; // async response
  });

  console.log("Enhanced Canvas scraper loaded");
})();
