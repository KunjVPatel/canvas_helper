// Comprehensive Canvas Content Extractor
// Extracts ALL text content, files, discussions, assignments, etc. into structured data
(function () {
  console.log("Canvas Content Extractor loaded");

  class CanvasContentExtractor {
    constructor() {
      this.extractedContent = {
        metadata: {},
        course: {},
        assignments: [],
        discussions: [],
        modules: [],
        files: [],
        pages: [],
        announcements: [],
        syllabus: "",
        grades: [],
        calendar: [],
        people: [],
        quizzes: [],
        conferences: [],
        collaborations: [],
        settings: {},
        rawHTML: {},
        extractedAt: new Date().toISOString(),
      };
      this.courseId = null;
      this.courseName = "";
      this.baseUrl = window.location.origin;
      this.visitedUrls = new Set();
    }

    // Main extraction method
    async extractAllContent() {
      console.log("Starting comprehensive Canvas content extraction...");

      try {
        // 1. Get course metadata
        await this.extractCourseMetadata();

        // 2. Extract current page content
        await this.extractCurrentPageContent();

        // 3. Use Canvas API to get structured data
        if (this.courseId) {
          console.log(
            "Starting Canvas API extraction for course:",
            this.courseId,
          );
          await this.extractViaCanvasAPI();
        } else {
          console.warn("No course ID found - skipping Canvas API extraction");
        }

        // 4. Scrape additional content from navigation
        await this.extractFromNavigation();

        // 5. Extract embedded content and media references
        await this.extractEmbeddedContent();

        console.log("Content extraction complete:", this.extractedContent);
        return this.extractedContent;
      } catch (err) {
        console.error("Error during content extraction:", err);
        this.extractedContent.errors = this.extractedContent.errors || [];
        this.extractedContent.errors.push(err.message);
        return this.extractedContent;
      }
    }

    // Extract course basic information
    async extractCourseMetadata() {
      // Get course ID from URL
      const courseMatch = window.location.pathname.match(/\/courses\/(\d+)/);
      this.courseId = courseMatch ? courseMatch[1] : null;

      // Extract course name
      const titleElement = document.querySelector(
        "h1, .course-title, .ic-app-course-menu .ic-app-course-menu__header",
      );
      this.courseName = titleElement
        ? titleElement.textContent.trim()
        : "Unknown Course";

      // Course code
      const codeElement = document.querySelector(
        ".course-info .course-code, .ellipsible",
      );
      const courseCode = codeElement ? codeElement.textContent.trim() : "";

      // Term/semester info
      const termElement = document.querySelector(
        ".course-info .term, .ic-app-course-menu__header-term",
      );
      const term = termElement ? termElement.textContent.trim() : "";

      // Instructor info
      const instructors = Array.from(
        document.querySelectorAll(".instructor, .teacher"),
      ).map((el) => el.textContent.trim());

      this.extractedContent.metadata = {
        courseId: this.courseId,
        courseName: this.courseName,
        courseCode: courseCode,
        term: term,
        instructors: instructors,
        url: window.location.href,
        extractedAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      };

      this.extractedContent.course = {
        id: this.courseId,
        name: this.courseName,
        code: courseCode,
        term: term,
        instructors: instructors,
      };
    }

    // Extract content from current page
    async extractCurrentPageContent() {
      const currentPage = {
        url: window.location.href,
        title: document.title,
        type: this.determinePageType(),
        content: "",
        rawHTML: document.documentElement.outerHTML,
        extractedAt: new Date().toISOString(),
      };

      // Extract main content area
      const contentSelectors = [
        "#content",
        ".ic-app-main-content",
        "main",
        ".course-content",
        ".content-wrapper",
        ".user_content",
        ".show-content",
      ];

      for (const selector of contentSelectors) {
        const contentEl = document.querySelector(selector);
        if (contentEl) {
          currentPage.content += this.extractTextContent(contentEl) + "\n\n";
        }
      }

      // Store page type specific content
      switch (currentPage.type) {
        case "assignments":
          await this.extractAssignmentsPage();
          break;
        case "discussions":
          await this.extractDiscussionsPage();
          break;
        case "modules":
          await this.extractModulesPage();
          break;
        case "files":
          await this.extractFilesPage();
          break;
        case "syllabus":
          await this.extractSyllabusPage();
          break;
        case "announcements":
          await this.extractAnnouncementsPage();
          break;
        case "grades":
          await this.extractGradesPage();
          break;
      }

      this.extractedContent.rawHTML[currentPage.type || "current"] =
        currentPage.rawHTML;
    }

    // Determine what type of page we're on
    determinePageType() {
      const path = window.location.pathname;
      const hash = window.location.hash;

      if (path.includes("/assignments") || hash.includes("assignments"))
        return "assignments";
      if (path.includes("/discussion_topics") || hash.includes("discussions"))
        return "discussions";
      if (path.includes("/modules") || hash.includes("modules"))
        return "modules";
      if (path.includes("/files") || hash.includes("files")) return "files";
      if (path.includes("/assignments/syllabus") || hash.includes("syllabus"))
        return "syllabus";
      if (path.includes("/announcements") || hash.includes("announcements"))
        return "announcements";
      if (path.includes("/grades") || hash.includes("grades")) return "grades";
      if (path.includes("/pages") || hash.includes("pages")) return "pages";
      if (path.includes("/quizzes") || hash.includes("quizzes"))
        return "quizzes";
      if (path.includes("/conferences") || hash.includes("conferences"))
        return "conferences";
      if (path.includes("/collaborations") || hash.includes("collaborations"))
        return "collaborations";
      if (path.includes("/settings") || hash.includes("settings"))
        return "settings";
      if (path.includes("/users") || hash.includes("people")) return "people";

      return "home";
    }

    // Extract comprehensive data via Canvas API
    async extractViaCanvasAPI() {
      if (!this.courseId) return;

      const apiEndpoints = [
        { name: "course", url: `/api/v1/courses/${this.courseId}` },
        {
          name: "assignments",
          url: `/api/v1/courses/${this.courseId}/assignments`,
        },
        {
          name: "discussions",
          url: `/api/v1/courses/${this.courseId}/discussion_topics`,
        },
        {
          name: "modules",
          url: `/api/v1/courses/${this.courseId}/modules?include[]=items`,
        },
        { name: "files", url: `/api/v1/courses/${this.courseId}/files` },
        { name: "pages", url: `/api/v1/courses/${this.courseId}/pages` },
        {
          name: "announcements",
          url: `/api/v1/courses/${this.courseId}/discussion_topics?only_announcements=true`,
        },
        { name: "quizzes", url: `/api/v1/courses/${this.courseId}/quizzes` },
        { name: "users", url: `/api/v1/courses/${this.courseId}/users` },
        {
          name: "enrollments",
          url: `/api/v1/courses/${this.courseId}/enrollments`,
        },
        {
          name: "calendar_events",
          url: `/api/v1/calendar_events?context_codes[]=course_${this.courseId}`,
        },
      ];

      for (const endpoint of apiEndpoints) {
        try {
          console.log(`Fetching ${endpoint.name} from API: ${endpoint.url}`);
          const data = await this.fetchCanvasAPI(endpoint.url);
          if (data) {
            if (Array.isArray(data)) {
              if (data.length > 0) {
                console.log(
                  `Successfully fetched ${data.length} ${endpoint.name} items`,
                );
                await this.processAPIData(endpoint.name, data);
              } else {
                console.log(`No ${endpoint.name} found (empty array)`);
              }
            } else if (typeof data === "object") {
              console.log(`Successfully fetched ${endpoint.name} object`);
              await this.processAPIData(endpoint.name, data);
            }
          } else {
            console.warn(
              `No data returned for ${endpoint.name} - may be restricted or empty`,
            );
          }
        } catch (err) {
          console.warn(`Failed to fetch ${endpoint.name}: ${err.message}`);
          if (err.message.includes("403")) {
            console.warn(
              `Access denied to ${endpoint.name} - user may not have permission`,
            );
          } else if (err.message.includes("404")) {
            console.warn(
              `${endpoint.name} not found - may not exist for this course`,
            );
          }
        }

        // Small delay to avoid rate limiting
        await this.delay(200);
      }
    }

    // Process API data into structured content
    async processAPIData(type, data) {
      switch (type) {
        case "course":
          this.extractedContent.course = {
            ...this.extractedContent.course,
            ...data,
          };
          if (data.syllabus_body) {
            this.extractedContent.syllabus = this.cleanHTML(data.syllabus_body);
          }
          break;

        case "assignments":
          if (Array.isArray(data)) {
            for (const assignment of data) {
              const processedAssignment = {
                id: assignment.id,
                name: assignment.name,
                description: this.cleanHTML(assignment.description || ""),
                instructions: this.cleanHTML(assignment.description || ""),
                points: assignment.points_possible,
                dueDate: assignment.due_at,
                lockDate: assignment.lock_at,
                unlockDate: assignment.unlock_at,
                submissionTypes: assignment.submission_types,
                allowedExtensions: assignment.allowed_extensions,
                rubric: assignment.rubric,
                attachments: [],
                url: `${this.baseUrl}/courses/${this.courseId}/assignments/${assignment.id}`,
              };

              // Get assignment details including attachments
              try {
                const detailData = await this.fetchCanvasAPI(
                  `/api/v1/courses/${this.courseId}/assignments/${assignment.id}`,
                );
                if (detailData && detailData.attachments) {
                  processedAssignment.attachments = detailData.attachments;
                }
              } catch (err) {
                console.warn(
                  `Assignment ${assignment.id} details not accessible - may be restricted`,
                );
                // Continue without attachment details
              }

              this.extractedContent.assignments.push(processedAssignment);
            }
          }
          break;

        case "discussions":
          if (Array.isArray(data)) {
            for (const discussion of data) {
              const processedDiscussion = {
                id: discussion.id,
                title: discussion.title,
                message: this.cleanHTML(discussion.message || ""),
                author: discussion.author?.display_name || "Unknown",
                postedAt: discussion.posted_at,
                lastReply: discussion.last_reply_at,
                replyCount: discussion.reply_count,
                isAnnouncement: discussion.is_announcement || false,
                entries: [],
                attachments: discussion.attachments || [],
                url: `${this.baseUrl}/courses/${this.courseId}/discussion_topics/${discussion.id}`,
              };

              // Get discussion entries (replies)
              try {
                const entries = await this.fetchCanvasAPI(
                  `/api/v1/courses/${this.courseId}/discussion_topics/${discussion.id}/entries`,
                );
                if (entries && Array.isArray(entries)) {
                  processedDiscussion.entries = entries.map((entry) => ({
                    id: entry.id,
                    message: this.cleanHTML(entry.message || ""),
                    author: entry.user?.display_name || "Unknown",
                    createdAt: entry.created_at,
                    replies: entry.replies || [],
                  }));
                }
              } catch (err) {
                console.warn(
                  `Failed to get discussion ${discussion.id} entries:`,
                  err,
                );
              }

              if (discussion.is_announcement) {
                this.extractedContent.announcements.push(processedDiscussion);
              } else {
                this.extractedContent.discussions.push(processedDiscussion);
              }
            }
          }
          break;

        case "modules":
          if (Array.isArray(data)) {
            for (const module of data) {
              const processedModule = {
                id: module.id,
                name: module.name,
                position: module.position,
                state: module.state,
                unlockDate: module.unlock_at,
                prerequisiteIds: module.prerequisite_module_ids,
                items: [],
                url: `${this.baseUrl}/courses/${this.courseId}/modules/${module.id}`,
              };

              if (module.items && Array.isArray(module.items)) {
                for (const item of module.items) {
                  const processedItem = {
                    id: item.id,
                    title: item.title,
                    type: item.type,
                    content: "",
                    url: item.html_url || item.url,
                    externalUrl: item.external_url,
                  };

                  // Get detailed content for different item types
                  if (item.type === "Page" && item.page_url) {
                    try {
                      const pageData = await this.fetchCanvasAPI(
                        `/api/v1/courses/${this.courseId}/pages/${item.page_url}`,
                      );
                      if (pageData) {
                        processedItem.content = this.cleanHTML(
                          pageData.body || "",
                        );
                      }
                    } catch (err) {
                      console.warn(
                        `Failed to get page content for ${item.page_url}:`,
                        err,
                      );
                    }
                  }

                  processedModule.items.push(processedItem);
                }
              }

              this.extractedContent.modules.push(processedModule);
            }
          }
          break;

        case "files":
          if (Array.isArray(data)) {
            this.extractedContent.files = data.map((file) => ({
              id: file.id,
              name: file.filename || file.display_name,
              size: file.size,
              contentType: file["content-type"],
              url: file.url,
              thumbnailUrl: file.thumbnail_url,
              previewUrl: file.preview_url,
              folderId: file.folder_id,
              createdAt: file.created_at,
              modifiedAt: file.modified_at,
              lockInfo: file.lock_info,
            }));
          }
          break;

        case "pages":
          if (Array.isArray(data)) {
            for (const page of data) {
              try {
                const pageDetail = await this.fetchCanvasAPI(
                  `/api/v1/courses/${this.courseId}/pages/${page.url}`,
                );
                if (pageDetail) {
                  this.extractedContent.pages.push({
                    id: pageDetail.page_id,
                    title: pageDetail.title,
                    body: this.cleanHTML(pageDetail.body || ""),
                    url: pageDetail.html_url,
                    createdAt: pageDetail.created_at,
                    updatedAt: pageDetail.updated_at,
                    published: pageDetail.published,
                    frontPage: pageDetail.front_page,
                  });
                }
              } catch (err) {
                console.warn(
                  `Failed to get page details for ${page.url}:`,
                  err,
                );
              }
            }
          }
          break;

        case "quizzes":
          if (Array.isArray(data)) {
            this.extractedContent.quizzes = data.map((quiz) => ({
              id: quiz.id,
              title: quiz.title,
              description: this.cleanHTML(quiz.description || ""),
              instructions: this.cleanHTML(quiz.instructions || ""),
              timeLimit: quiz.time_limit,
              allowedAttempts: quiz.allowed_attempts,
              dueDate: quiz.due_at,
              lockDate: quiz.lock_at,
              unlockDate: quiz.unlock_at,
              published: quiz.published,
              pointsPossible: quiz.points_possible,
              questionCount: quiz.question_count,
              url: `${this.baseUrl}/courses/${this.courseId}/quizzes/${quiz.id}`,
            }));
          }
          break;

        case "users":
          if (Array.isArray(data)) {
            this.extractedContent.people = data.map((user) => ({
              id: user.id,
              name: user.name,
              displayName: user.display_name,
              sortableName: user.sortable_name,
              shortName: user.short_name,
              email: user.email,
              loginId: user.login_id,
              enrollments: user.enrollments || [],
            }));
          }
          break;

        case "calendar_events":
          if (Array.isArray(data)) {
            this.extractedContent.calendar = data.map((event) => ({
              id: event.id,
              title: event.title,
              description: this.cleanHTML(event.description || ""),
              startAt: event.start_at,
              endAt: event.end_at,
              location: event.location_name,
              url: event.html_url,
              type: event.type,
              contextCode: event.context_code,
            }));
          }
          break;
      }
    }

    // Extract content from navigation and links
    async extractFromNavigation() {
      const navLinks = Array.from(
        document.querySelectorAll(
          'a[href*="/courses/"], .ic-app-course-nav a, #section-tabs a, .course-navigation a',
        ),
      );

      const importantPages = [
        "syllabus",
        "assignments",
        "discussions",
        "modules",
        "files",
        "pages",
        "announcements",
        "grades",
        "people",
      ];

      for (const link of navLinks) {
        const href = link.getAttribute("href");
        const text = link.textContent.trim();

        if (href && !this.visitedUrls.has(href)) {
          const isImportant = importantPages.some(
            (page) => href.includes(page) || text.toLowerCase().includes(page),
          );

          if (isImportant) {
            console.log(`Found important page: ${text} - ${href}`);
            // Store the link for potential future scraping
            this.extractedContent.navigationLinks =
              this.extractedContent.navigationLinks || [];
            this.extractedContent.navigationLinks.push({
              text: text,
              href: href,
              type: this.determinePageTypeFromUrl(href),
            });
          }
        }
      }
    }

    // Extract embedded content like images, videos, iframes, and PDFs
    async extractEmbeddedContent() {
      const embeddedContent = {
        images: [],
        videos: [],
        iframes: [],
        links: [],
        documents: [],
        pdfs: [],
      };

      // Images
      const images = Array.from(document.querySelectorAll("img"));
      embeddedContent.images = images
        .map((img) => ({
          src: img.src,
          alt: img.alt,
          title: img.title,
          width: img.width,
          height: img.height,
        }))
        .filter((img) => img.src);

      // Videos
      const videos = Array.from(
        document.querySelectorAll(
          'video, iframe[src*="youtube"], iframe[src*="vimeo"]',
        ),
      );
      embeddedContent.videos = videos
        .map((video) => ({
          src: video.src || video.getAttribute("data-src"),
          type: video.tagName.toLowerCase(),
          title: video.title,
          width: video.width,
          height: video.height,
        }))
        .filter((video) => video.src);

      // All iframes
      const iframes = Array.from(document.querySelectorAll("iframe"));
      embeddedContent.iframes = iframes
        .map((iframe) => ({
          src: iframe.src,
          title: iframe.title,
          width: iframe.width,
          height: iframe.height,
        }))
        .filter((iframe) => iframe.src);

      // External links
      const externalLinks = Array.from(
        document.querySelectorAll('a[href^="http"]'),
      );
      embeddedContent.links = externalLinks
        .map((link) => ({
          href: link.href,
          text: link.textContent.trim(),
          title: link.title,
        }))
        .filter((link) => !link.href.includes(window.location.hostname));

      // Extract PDFs from all sources
      const pdfs = this.extractPDFsFromPage();
      embeddedContent.pdfs = pdfs;

      this.extractedContent.embeddedContent = embeddedContent;
    }

    // Extract PDFs from current page
    extractPDFsFromPage() {
      const pdfs = [];

      // Look for PDF links
      const pdfSelectors = [
        'a[href*=".pdf"]',
        'iframe[src*=".pdf"]',
        'embed[src*=".pdf"]',
        'object[data*=".pdf"]',
        'a[href*="/files/"][href*="pdf"]',
        'a[title*="PDF"]',
        'a[title*="pdf"]',
      ];

      pdfSelectors.forEach((selector) => {
        const elements = Array.from(document.querySelectorAll(selector));
        elements.forEach((element) => {
          const url =
            element.href || element.src || element.getAttribute("data");
          const title =
            element.textContent.trim() ||
            element.title ||
            element.alt ||
            "PDF Document";

          if (url) {
            pdfs.push({
              url: url,
              title: title,
              type: element.tagName.toLowerCase(),
              source: "page_content",
            });
          }
        });
      });

      // Extract PDF URLs from page HTML using regex
      const htmlContent = document.documentElement.outerHTML;
      const pdfUrlRegex = /https?:\/\/[^\s<>"'()]+\.pdf[^\s<>"']*/gi;
      const matches = htmlContent.match(pdfUrlRegex);

      if (matches) {
        const uniqueUrls = [...new Set(matches)];
        uniqueUrls.forEach((url) => {
          const filename = url.split("/").pop().split("?")[0] || "document.pdf";
          pdfs.push({
            url: url,
            title: filename,
            type: "embedded_url",
            source: "html_regex",
          });
        });
      }

      return pdfs;
    }

    // Page-specific extraction methods
    async extractAssignmentsPage() {
      const assignments = Array.from(
        document.querySelectorAll(".assignment, .assignment-list-item"),
      );

      assignments.forEach((assignment) => {
        const title =
          assignment
            .querySelector(".assignment-title, .ig-title")
            ?.textContent?.trim() || "";
        const description =
          assignment
            .querySelector(".assignment-description, .ig-details")
            ?.textContent?.trim() || "";
        const dueDate =
          assignment
            .querySelector(".assignment-due-date, .due")
            ?.textContent?.trim() || "";
        const points =
          assignment
            .querySelector(".points, .points-possible")
            ?.textContent?.trim() || "";

        if (title) {
          this.extractedContent.assignments.push({
            title: title,
            description: description,
            dueDate: dueDate,
            points: points,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    async extractDiscussionsPage() {
      const discussions = Array.from(
        document.querySelectorAll(".discussion-topic, .discussion"),
      );

      discussions.forEach((discussion) => {
        const title =
          discussion
            .querySelector(".discussion-title, h3, h2")
            ?.textContent?.trim() || "";
        const message = this.extractTextContent(discussion);
        const author =
          discussion.querySelector(".author")?.textContent?.trim() || "";
        const date =
          discussion.querySelector(".date, .created-at")?.textContent?.trim() ||
          "";

        if (title) {
          this.extractedContent.discussions.push({
            title: title,
            message: message,
            author: author,
            date: date,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    async extractModulesPage() {
      const modules = Array.from(
        document.querySelectorAll(".context_module, .module"),
      );

      modules.forEach((module) => {
        const name =
          module
            .querySelector(".module-title, h2, .ig-header-title")
            ?.textContent?.trim() || "";
        const items = Array.from(
          module.querySelectorAll(".module-item, .ig-list li"),
        ).map((item) => {
          return {
            title:
              item
                .querySelector(".ig-title, .module-item-title")
                ?.textContent?.trim() || "",
            type:
              item.querySelector(".type, .ig-type")?.textContent?.trim() || "",
            content: this.extractTextContent(item),
          };
        });

        if (name) {
          this.extractedContent.modules.push({
            name: name,
            items: items,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    async extractSyllabusPage() {
      const syllabusContent = document.querySelector(
        "#course_syllabus, .syllabus, .user_content",
      );
      if (syllabusContent) {
        this.extractedContent.syllabus =
          this.extractTextContent(syllabusContent);
      }
    }

    async extractAnnouncementsPage() {
      const announcements = Array.from(
        document.querySelectorAll(".discussion-topic, .announcement"),
      );

      announcements.forEach((announcement) => {
        const title =
          announcement
            .querySelector("h3, h2, .discussion-title")
            ?.textContent?.trim() || "";
        const message = this.extractTextContent(announcement);
        const date =
          announcement
            .querySelector(".date, .created-at")
            ?.textContent?.trim() || "";

        if (title) {
          this.extractedContent.announcements.push({
            title: title,
            message: message,
            date: date,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    async extractFilesPage() {
      const files = Array.from(
        document.querySelectorAll(".ef-item-row, .file"),
      );

      files.forEach((file) => {
        const name =
          file.querySelector(".ef-name-col, .file-name")?.textContent?.trim() ||
          "";
        const size =
          file.querySelector(".ef-size-col, .file-size")?.textContent?.trim() ||
          "";
        const modified =
          file
            .querySelector(".ef-date-created-col, .date-modified")
            ?.textContent?.trim() || "";
        const link = file.querySelector("a")?.href || "";

        if (name) {
          this.extractedContent.files.push({
            name: name,
            size: size,
            modified: modified,
            link: link,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    async extractGradesPage() {
      const gradeItems = Array.from(
        document.querySelectorAll(".assignment_grade, .gradebook-row"),
      );

      gradeItems.forEach((item) => {
        const assignment =
          item
            .querySelector(".assignment-name, .gradebook-cell-assignment")
            ?.textContent?.trim() || "";
        const grade =
          item
            .querySelector(".grade, .gradebook-cell-grade")
            ?.textContent?.trim() || "";
        const points =
          item
            .querySelector(".points, .points-possible")
            ?.textContent?.trim() || "";

        if (assignment) {
          this.extractedContent.grades.push({
            assignment: assignment,
            grade: grade,
            points: points,
            source: "DOM",
            extractedAt: new Date().toISOString(),
          });
        }
      });
    }

    // Utility methods
    async fetchCanvasAPI(endpoint) {
      try {
        const url = endpoint.startsWith("/")
          ? `${this.baseUrl}${endpoint}`
          : endpoint;
        const response = await fetch(url, {
          credentials: "include",
          headers: {
            Accept: "application/json+canvas-string-ids",
            "X-Requested-With": "XMLHttpRequest",
          },
        });

        if (!response.ok) {
          if (response.status === 403) {
            console.warn(`Canvas API: Access denied to ${endpoint} (403)`);
            return null;
          }
          if (response.status === 404) {
            console.warn(`Canvas API: Resource not found ${endpoint} (404)`);
            return null;
          }
          throw new Error(
            `API request failed: ${response.status} ${response.statusText}`,
          );
        }

        return await response.json();
      } catch (err) {
        console.warn("Canvas API fetch failed:", err);
        return null;
      }
    }

    extractTextContent(element) {
      if (!element) return "";

      // Clone the element to avoid modifying the original
      const clone = element.cloneNode(true);

      // Remove script and style elements
      const scriptsAndStyles = clone.querySelectorAll("script, style");
      scriptsAndStyles.forEach((el) => el.remove());

      // Get text content and clean it up
      let text = clone.textContent || clone.innerText || "";

      // Clean up whitespace
      text = text.replace(/\s+/g, " ").trim();

      return text;
    }

    cleanHTML(html) {
      if (!html) return "";

      // Create a temporary div to parse HTML
      const temp = document.createElement("div");
      temp.innerHTML = html;

      // Remove script and style elements
      const scriptsAndStyles = temp.querySelectorAll("script, style");
      scriptsAndStyles.forEach((el) => el.remove());

      // Extract text content
      let text = this.extractTextContent(temp);

      // Convert some HTML elements to readable text
      text = text.replace(/<br\s*\/?>/gi, "\n");
      text = text.replace(/<\/p>/gi, "\n\n");
      text = text.replace(/<\/div>/gi, "\n");
      text = text.replace(/<\/h[1-6]>/gi, "\n\n");

      return text;
    }

    determinePageTypeFromUrl(url) {
      if (url.includes("assignments")) return "assignments";
      if (url.includes("discussion_topics")) return "discussions";
      if (url.includes("modules")) return "modules";
      if (url.includes("files")) return "files";
      if (url.includes("syllabus")) return "syllabus";
      if (url.includes("announcements")) return "announcements";
      if (url.includes("grades")) return "grades";
      if (url.includes("pages")) return "pages";
      if (url.includes("quizzes")) return "quizzes";
      return "unknown";
    }

    delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Generate comprehensive text export
    generateTextExport() {
      let text = "";

      // Header
      text += "=".repeat(80) + "\n";
      text += `CANVAS COURSE CONTENT EXPORT\n`;
      text += `Course: ${this.extractedContent.course.name || "Unknown"}\n`;
      text += `Course Code: ${this.extractedContent.course.code || "Unknown"}\n`;
      text += `Term: ${this.extractedContent.course.term || "Unknown"}\n`;
      text += `Extracted: ${this.extractedContent.extractedAt}\n`;
      text += "=".repeat(80) + "\n\n";

      // Table of Contents
      text += "TABLE OF CONTENTS\n";
      text += "-".repeat(40) + "\n";
      text += "1. Course Information\n";
      text += "2. Syllabus\n";
      text += "3. Announcements\n";
      text += "4. Assignments\n";
      text += "5. Discussions\n";
      text += "6. Modules\n";
      text += "7. Pages\n";
      text += "8. Files\n";
      text += "9. Quizzes\n";
      text += "10. People\n";
      text += "11. Calendar Events\n";
      text += "12. Grades\n";
      text += "13. Embedded Content\n\n";

      // 1. Course Information
      text += "1. COURSE INFORMATION\n";
      text += "=".repeat(40) + "\n";
      text += `Name: ${this.extractedContent.course.name || "N/A"}\n`;
      text += `Code: ${this.extractedContent.course.code || "N/A"}\n`;
      text += `Term: ${this.extractedContent.course.term || "N/A"}\n`;
      text += `Instructors: ${this.extractedContent.course.instructors?.join(", ") || "N/A"}\n`;
      text += `Course ID: ${this.extractedContent.course.id || "N/A"}\n\n`;

      // 2. Syllabus
      if (this.extractedContent.syllabus) {
        text += "2. SYLLABUS\n";
        text += "=".repeat(40) + "\n";
        text += this.extractedContent.syllabus + "\n\n";
      }

      // 3. Announcements
      if (this.extractedContent.announcements.length > 0) {
        text += "3. ANNOUNCEMENTS\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.announcements.forEach((announcement, index) => {
          text += `${index + 1}. ${announcement.title}\n`;
          text += `Posted: ${announcement.postedAt || announcement.date || "Unknown"}\n`;
          text += `Author: ${announcement.author || "Unknown"}\n`;
          text += "-".repeat(30) + "\n";
          text += announcement.message + "\n\n";
        });
      }

      // 4. Assignments
      if (this.extractedContent.assignments.length > 0) {
        text += "4. ASSIGNMENTS\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.assignments.forEach((assignment, index) => {
          text += `${index + 1}. ${assignment.name || assignment.title}\n`;
          text += `Due: ${assignment.dueDate || "No due date"}\n`;
          text += `Points: ${assignment.points || "N/A"}\n`;
          text += "-".repeat(30) + "\n";
          text +=
            assignment.description ||
            assignment.instructions ||
            "No description available";
          text += "\n\n";
        });
      }

      // 5. Discussions
      if (this.extractedContent.discussions.length > 0) {
        text += "5. DISCUSSIONS\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.discussions.forEach((discussion, index) => {
          text += `${index + 1}. ${discussion.title}\n`;
          text += `Author: ${discussion.author || "Unknown"}\n`;
          text += `Posted: ${discussion.postedAt || discussion.date || "Unknown"}\n`;
          text += `Replies: ${discussion.replyCount || discussion.entries?.length || 0}\n`;
          text += "-".repeat(30) + "\n";
          text += discussion.message + "\n";

          // Include replies/entries
          if (discussion.entries && discussion.entries.length > 0) {
            text += "\nReplies:\n";
            discussion.entries.forEach((entry, entryIndex) => {
              text += `  ${entryIndex + 1}. ${entry.author || "Unknown"} (${entry.createdAt || "Unknown date"})\n`;
              text += `     ${entry.message}\n`;
            });
          }
          text += "\n";
        });
      }

      // 6. Modules
      if (this.extractedContent.modules.length > 0) {
        text += "6. MODULES\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.modules.forEach((module, index) => {
          text += `${index + 1}. ${module.name}\n`;
          text += `State: ${module.state || "N/A"}\n`;
          text += "-".repeat(30) + "\n";

          if (module.items && module.items.length > 0) {
            module.items.forEach((item, itemIndex) => {
              text += `  ${itemIndex + 1}. ${item.title} (${item.type || "Unknown type"})\n`;
              if (item.content) {
                text += `     ${item.content}\n`;
              }
              if (item.externalUrl) {
                text += `     URL: ${item.externalUrl}\n`;
              }
            });
          }
          text += "\n";
        });
      }

      // 7. Pages
      if (this.extractedContent.pages.length > 0) {
        text += "7. PAGES\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.pages.forEach((page, index) => {
          text += `${index + 1}. ${page.title}\n`;
          text += `Published: ${page.published ? "Yes" : "No"}\n`;
          text += `Updated: ${page.updatedAt || "Unknown"}\n`;
          text += "-".repeat(30) + "\n";
          text += page.body + "\n\n";
        });
      }

      // 8. Files
      if (this.extractedContent.files.length > 0) {
        text += "8. FILES\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.files.forEach((file, index) => {
          text += `${index + 1}. ${file.name}\n`;
          text += `Size: ${file.size ? this.formatFileSize(file.size) : "Unknown"}\n`;
          text += `Type: ${file.contentType || "Unknown"}\n`;
          text += `URL: ${file.url || "N/A"}\n`;
          text += `Modified: ${file.modifiedAt || file.modified || "Unknown"}\n\n`;
        });
      }

      // 9. Quizzes
      if (this.extractedContent.quizzes.length > 0) {
        text += "9. QUIZZES\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.quizzes.forEach((quiz, index) => {
          text += `${index + 1}. ${quiz.title}\n`;
          text += `Points: ${quiz.pointsPossible || "N/A"}\n`;
          text += `Questions: ${quiz.questionCount || "N/A"}\n`;
          text += `Time Limit: ${quiz.timeLimit ? quiz.timeLimit + " minutes" : "No limit"}\n`;
          text += `Due: ${quiz.dueDate || "No due date"}\n`;
          text += "-".repeat(30) + "\n";
          text += quiz.description + "\n";
          if (quiz.instructions) {
            text += "Instructions:\n" + quiz.instructions + "\n";
          }
          text += "\n";
        });
      }

      // 10. People
      if (this.extractedContent.people.length > 0) {
        text += "10. PEOPLE\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.people.forEach((person, index) => {
          text += `${index + 1}. ${person.name || person.displayName}\n`;
          text += `Email: ${person.email || "N/A"}\n`;
          text += `Role: ${person.enrollments?.map((e) => e.role).join(", ") || "N/A"}\n\n`;
        });
      }

      // 11. Calendar Events
      if (this.extractedContent.calendar.length > 0) {
        text += "11. CALENDAR EVENTS\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.calendar.forEach((event, index) => {
          text += `${index + 1}. ${event.title}\n`;
          text += `Start: ${event.startAt || "N/A"}\n`;
          text += `End: ${event.endAt || "N/A"}\n`;
          text += `Location: ${event.location || "N/A"}\n`;
          text += "-".repeat(30) + "\n";
          text += event.description + "\n\n";
        });
      }

      // 12. Grades
      if (this.extractedContent.grades.length > 0) {
        text += "12. GRADES\n";
        text += "=".repeat(40) + "\n";
        this.extractedContent.grades.forEach((grade, index) => {
          text += `${index + 1}. ${grade.assignment}\n`;
          text += `Grade: ${grade.grade}\n`;
          text += `Points: ${grade.points}\n\n`;
        });
      }

      // 13. Embedded Content
      if (this.extractedContent.embeddedContent) {
        text += "13. EMBEDDED CONTENT\n";
        text += "=".repeat(40) + "\n";

        const embedded = this.extractedContent.embeddedContent;

        if (embedded.images && embedded.images.length > 0) {
          text += "Images:\n";
          embedded.images.forEach((img, index) => {
            text += `  ${index + 1}. ${img.alt || "Untitled"} - ${img.src}\n`;
          });
          text += "\n";
        }

        if (embedded.videos && embedded.videos.length > 0) {
          text += "Videos:\n";
          embedded.videos.forEach((video, index) => {
            text += `  ${index + 1}. ${video.title || "Untitled"} - ${video.src}\n`;
          });
          text += "\n";
        }

        if (embedded.links && embedded.links.length > 0) {
          text += "External Links:\n";
          embedded.links.forEach((link, index) => {
            text += `  ${index + 1}. ${link.text || "Untitled"} - ${link.href}\n`;
          });
          text += "\n";
        }

        if (embedded.pdfs && embedded.pdfs.length > 0) {
          text += "PDF Documents:\n";
          embedded.pdfs.forEach((pdf, index) => {
            text += `  ${index + 1}. ${pdf.title || "Untitled"} - ${pdf.url}\n`;
          });
          text += "\n";
        }
      }

      // Footer
      text += "\n" + "=".repeat(80) + "\n";
      text += "END OF EXPORT\n";
      text += `Total Assignments: ${this.extractedContent.assignments.length}\n`;
      text += `Total Discussions: ${this.extractedContent.discussions.length}\n`;
      text += `Total Modules: ${this.extractedContent.modules.length}\n`;
      text += `Total Files: ${this.extractedContent.files.length}\n`;
      text += `Total Pages: ${this.extractedContent.pages.length}\n`;
      text += `Total People: ${this.extractedContent.people.length}\n`;
      text += "=".repeat(80) + "\n";

      return text;
    }

    formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
  }

  // Export the class for use in other scripts
  window.CanvasContentExtractor = CanvasContentExtractor;

  // Alternative download function using content script
  function downloadTextContent(textContent, filename) {
    try {
      // Create download link element
      const link = document.createElement("a");
      const blob = new Blob([textContent], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = filename;
      link.style.display = "none";

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      return true;
    } catch (err) {
      console.error("Content script download failed:", err);
      return false;
    }
  }

  // Message handler for content extraction requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "extract-all-content") return;

    (async () => {
      try {
        console.log("Starting comprehensive content extraction...");
        const extractor = new CanvasContentExtractor();
        const content = await extractor.extractAllContent();
        console.log("Content extraction completed, generating text export...");
        const textExport = extractor.generateTextExport();
        console.log(
          `Text export generated: ${Math.round(textExport.length / 1024)}KB`,
        );

        // Try to download directly from content script
        const courseName = content.course.name || "Canvas_Course";
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const sanitizedCourseName = courseName
          .replace(/[<>:"/\\|?*]/g, "_")
          .substring(0, 50);
        const filename = `${sanitizedCourseName}_Complete_Export_${timestamp}.txt`;

        console.log("Attempting direct download from content script...");
        const downloadSuccess = downloadTextContent(textExport, filename);

        if (downloadSuccess) {
          console.log("Direct download successful");
          sendResponse({
            success: true,
            data: content,
            textExport: textExport,
            downloadedDirectly: true,
            summary: {
              assignments: content.assignments.length,
              discussions: content.discussions.length,
              modules: content.modules.length,
              files: content.files.length,
              pages: content.pages.length,
              people: content.people.length,
            },
          });
        } else {
          console.log(
            "Direct download failed, will try background script method",
          );
          // Fallback to background script method
          sendResponse({
            success: true,
            data: content,
            textExport: textExport,
            downloadedDirectly: false,
            summary: {
              assignments: content.assignments.length,
              discussions: content.discussions.length,
              modules: content.modules.length,
              files: content.files.length,
              pages: content.pages.length,
              people: content.people.length,
            },
          });
        }
      } catch (err) {
        console.error("Content extraction failed:", err);
        console.error("Error stack:", err.stack);
        sendResponse({
          success: false,
          error:
            err.message || "Unknown error occurred during content extraction",
        });
      }
    })();

    return true; // Keep message channel open for async response
  });

  console.log("Canvas Content Extractor initialized");
})();
