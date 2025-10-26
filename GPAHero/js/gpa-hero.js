// GPA Hero - Canvas Helper AI Tutor Interface
// Dedicated chat interface for Canvas Helper Snowflake integration

class GPAHero {
  constructor() {
    this.serverUrl = "http://localhost:3000";
    this.currentStudent = null;
    this.currentCourse = null;
    this.courseName = null;
    this.isConnected = false;
    this.messages = [];
    this.isTyping = false;

    // DOM elements
    this.chatMessages = document.getElementById("chat-messages");
    this.messageInput = document.getElementById("message-input");
    this.sendButton = document.getElementById("send-button");
    this.welcomeScreen = document.getElementById("welcome-screen");
    this.typingIndicator = document.getElementById("typing-indicator");
    this.statusDot = document.getElementById("status-dot");
    this.statusText = document.getElementById("status-text");
    this.courseBanner = document.getElementById("course-banner");
    this.courseName = document.getElementById("course-name");
    this.courseDetails = document.getElementById("course-details");
    this.quickQuestions = document.getElementById("quick-questions");
    this.setupNeeded = document.getElementById("setup-needed");

    this.init();
  }

  async init() {
    await this.loadCourseInfo();
    await this.checkServerConnection();
    this.setupEventListeners();
    this.updateUI();
  }

  // Load course information from URL parameters or storage
  async loadCourseInfo() {
    try {
      // Try URL parameters first
      const urlParams = new URLSearchParams(window.location.search);
      this.currentCourse = urlParams.get("course_id");
      this.courseName = urlParams.get("course_name");

      // Generate consistent student ID based on course
      if (this.currentCourse) {
        this.currentStudent = `student_course_${this.currentCourse}`;
      } else {
        // Try localStorage as fallback
        this.currentStudent = localStorage.getItem("gpa_hero_student_id");
        this.currentCourse = localStorage.getItem("gpa_hero_course_id");
        this.courseName = localStorage.getItem("gpa_hero_course_name");

        // Generate consistent ID if we have course from storage
        if (this.currentCourse && !this.currentStudent) {
          this.currentStudent = `student_course_${this.currentCourse}`;
        }
      }

      // Save to localStorage if we got them from URL
      if (this.currentStudent && this.currentCourse) {
        localStorage.setItem("gpa_hero_student_id", this.currentStudent);
        localStorage.setItem("gpa_hero_course_id", this.currentCourse);
        if (this.courseName) {
          localStorage.setItem("gpa_hero_course_name", this.courseName);
        }
      }

      console.log("Course info loaded:", {
        student: this.currentStudent,
        course: this.currentCourse,
        name: this.courseName,
      });
    } catch (error) {
      console.error("Error loading course info:", error);
    }
  }

  // Check Canvas Helper server connection
  async checkServerConnection() {
    try {
      const response = await fetch(`${this.serverUrl}/ping-snowflake`);
      const result = await response.json();
      this.isConnected = result.ok;

      this.statusDot.className = this.isConnected
        ? "status-dot connected"
        : "status-dot";
      this.statusText.textContent = this.isConnected
        ? "Connected"
        : "Server Offline";

      console.log("Server connection:", this.isConnected ? "OK" : "Failed");
    } catch (error) {
      this.isConnected = false;
      this.statusDot.className = "status-dot";
      this.statusText.textContent = "Server Offline";
      console.error("Server connection failed:", error);
    }
  }

  // Setup all event listeners
  setupEventListeners() {
    // Send button click
    this.sendButton.addEventListener("click", () => this.sendMessage());

    // Enter key to send (Shift+Enter for new line)
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.messageInput.addEventListener("input", () => {
      this.messageInput.style.height = "auto";
      this.messageInput.style.height =
        Math.min(this.messageInput.scrollHeight, 120) + "px";

      // Enable/disable send button
      this.sendButton.disabled =
        !this.messageInput.value.trim() || this.isTyping;
    });

    // Quick question clicks
    document.querySelectorAll(".quick-question").forEach((question) => {
      question.addEventListener("click", () => {
        const questionText = question.dataset.question;
        this.messageInput.value = questionText;
        this.sendMessage();
      });
    });

    // Focus input on load
    this.messageInput.focus();
  }

  // Update UI based on current state
  updateUI() {
    // Update course banner
    if (this.currentStudent && this.currentCourse) {
      this.courseBanner.classList.add("show");
      document.getElementById("course-name").textContent =
        this.courseName || "Canvas Course";
      document.getElementById("course-details").textContent =
        `Student: ${this.currentStudent} | Course: ${this.currentCourse}`;

      // Show quick questions, hide setup
      this.quickQuestions.style.display = "grid";
      this.setupNeeded.style.display = "none";
    } else {
      this.courseBanner.classList.remove("show");
      this.quickQuestions.style.display = "none";
      this.setupNeeded.style.display = "block";
    }

    // Check if we can chat
    const canChat =
      this.isConnected && this.currentStudent && this.currentCourse;
    this.sendButton.disabled =
      !canChat || !this.messageInput.value.trim() || this.isTyping;

    if (!canChat) {
      this.messageInput.placeholder = this.isConnected
        ? "Please set up your course information first..."
        : "Canvas Helper server is offline...";
    }
  }

  // Send a message to the AI
  async sendMessage() {
    const messageText = this.messageInput.value.trim();
    if (
      !messageText ||
      this.isTyping ||
      !this.isConnected ||
      !this.currentStudent ||
      !this.currentCourse
    ) {
      return;
    }

    // Hide welcome screen
    this.welcomeScreen.style.display = "none";

    // Add user message
    this.addMessage("user", messageText);

    // Clear input and update UI
    this.messageInput.value = "";
    this.messageInput.style.height = "auto";
    this.isTyping = true;
    this.updateUI();

    // Show typing indicator
    this.showTyping();

    try {
      // Send to Canvas Helper server
      const response = await fetch(`${this.serverUrl}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: this.currentStudent,
          course_id: this.currentCourse,
          question: messageText,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.ok) {
        throw new Error(result.error || "Unknown server error");
      }

      // Add AI response
      this.addMessage("assistant", result.answer, {
        sources: result.source_count,
        responseTime: result.response_time_ms,
        contextChars: result.used_context_chars,
      });
    } catch (error) {
      console.error("Chat error:", error);
      this.addMessage(
        "assistant",
        `I'm having trouble connecting to your course materials. ${error.message}. Please make sure the Canvas Helper server is running and your course content has been uploaded.`,
        { error: true },
      );
    } finally {
      this.hideTyping();
      this.isTyping = false;
      this.updateUI();
      this.messageInput.focus();
    }
  }

  // Add a message to the chat
  addMessage(role, content, meta = {}) {
    const message = { role, content, meta, timestamp: new Date() };
    this.messages.push(message);

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "message-bubble";

    // Format message content (basic markdown support)
    bubbleDiv.innerHTML = this.formatMessage(content);

    messageDiv.appendChild(bubbleDiv);

    // Add metadata for assistant messages
    if (role === "assistant" && !meta.error) {
      const metaDiv = document.createElement("div");
      metaDiv.className = "message-meta";

      const leftMeta = document.createElement("span");
      leftMeta.textContent = `🤖 GPA Hero`;

      const rightMeta = document.createElement("span");
      rightMeta.textContent = meta.sources
        ? `${meta.sources} sources • ${meta.responseTime}ms`
        : message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

      metaDiv.appendChild(leftMeta);
      metaDiv.appendChild(rightMeta);
      messageDiv.appendChild(metaDiv);
    } else if (role === "user") {
      const metaDiv = document.createElement("div");
      metaDiv.className = "message-meta";
      metaDiv.innerHTML = `<span>You • ${message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>`;
      messageDiv.appendChild(metaDiv);
    }

    // Insert before typing indicator
    this.chatMessages.insertBefore(messageDiv, this.typingIndicator);
    this.scrollToBottom();
  }

  // Format message with basic markdown support
  formatMessage(content) {
    return (
      content
        // Headers
        .replace(/^### (.*$)/gm, "<h3>$1</h3>")
        .replace(/^## (.*$)/gm, "<h2>$1</h2>")
        .replace(/^# (.*$)/gm, "<h1>$1</h1>")
        // Bold
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        // Italic
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        // Code blocks
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        // Inline code
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // Lists (simple)
        .replace(/^\* (.+)$/gm, "<li>$1</li>")
        .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
        // Line breaks
        .replace(/\n\n/g, "</p><p>")
        .replace(/\n/g, "<br>")
        // Wrap in paragraphs if needed
        .replace(/^(?!<[h|l|p|c])(.+)/, "<p>$1</p>")
        .replace(/(<\/[h|l|p|c].*?>)$/g, "$1")
    );
  }

  // Show typing indicator
  showTyping() {
    this.typingIndicator.classList.add("show");
    this.scrollToBottom();
  }

  // Hide typing indicator
  hideTyping() {
    this.typingIndicator.classList.remove("show");
  }

  // Scroll chat to bottom
  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // Manual course setup (for debugging/testing)
  setupCourse(studentId, courseId, courseName) {
    // Generate consistent student ID based on course
    this.currentStudent = `student_course_${courseId}`;
    this.currentCourse = courseId;
    this.courseName = courseName;

    // Save to localStorage
    localStorage.setItem("gpa_hero_student_id", this.currentStudent);
    localStorage.setItem("gpa_hero_course_id", courseId);
    localStorage.setItem("gpa_hero_course_name", courseName);

    // Update URL with consistent student ID
    const url = new URL(window.location);
    url.searchParams.set("student_id", this.currentStudent);
    url.searchParams.set("course_id", courseId);
    url.searchParams.set("course_name", courseName);
    window.history.replaceState({}, "", url);

    this.updateUI();
    console.log("Course setup complete:", {
      studentId: this.currentStudent,
      courseId,
      courseName,
    });
  }

  // Check if course content exists
  async checkCourseContent() {
    if (!this.currentStudent || !this.currentCourse) return false;

    try {
      const response = await fetch(
        `${this.serverUrl}/content/${this.currentStudent}/${this.currentCourse}`,
      );
      const result = await response.json();
      return result.ok && result.files && result.files.length > 0;
    } catch (error) {
      console.error("Error checking course content:", error);
      return false;
    }
  }
}

// Initialize GPA Hero when DOM is loaded
let gpaHero;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    gpaHero = new GPAHero();
  });
} else {
  gpaHero = new GPAHero();
}

// Global functions for debugging and external access
window.gpaHero = gpaHero;
window.setupCourse = (studentId, courseId, courseName) => {
  if (gpaHero) {
    gpaHero.setupCourse(studentId, courseId, courseName);
  } else {
    console.error("GPA Hero not initialized yet");
  }
};

console.log("🏆 GPA Hero initialized");
