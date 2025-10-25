// Settings management for Canvas Helper extension
(function() {
  const DEFAULT_SETTINGS = {
    downloadPath: 'hackPSU/canvas_helper/downloads',
    organizeByCourse: true,
    organizeByType: true,
    maxConcurrentDownloads: 3,
    downloadDelay: 1000,
    enableNotifications: true,
    skipExistingFiles: false,
    includeAssignments: true,
    includeModules: true,
    includeDiscussions: true,
    includeFiles: true,
    debugMode: false
  };

  class SettingsManager {
    constructor() {
      this.settings = { ...DEFAULT_SETTINGS };
      this.init();
    }

    async init() {
      try {
        const stored = await chrome.storage.sync.get('canvasHelperSettings');
        if (stored.canvasHelperSettings) {
          this.settings = { ...DEFAULT_SETTINGS, ...stored.canvasHelperSettings };
        }
        console.log('Settings loaded:', this.settings);
      } catch (err) {
        console.warn('Failed to load settings, using defaults:', err);
      }
    }

    async get(key = null) {
      if (key) {
        return this.settings[key];
      }
      return { ...this.settings };
    }

    async set(key, value) {
      if (typeof key === 'object') {
        // Bulk update
        this.settings = { ...this.settings, ...key };
      } else {
        // Single key update
        this.settings[key] = value;
      }

      try {
        await chrome.storage.sync.set({ canvasHelperSettings: this.settings });
        console.log('Settings saved:', this.settings);
        return true;
      } catch (err) {
        console.error('Failed to save settings:', err);
        return false;
      }
    }

    async reset() {
      this.settings = { ...DEFAULT_SETTINGS };
      try {
        await chrome.storage.sync.set({ canvasHelperSettings: this.settings });
        return true;
      } catch (err) {
        console.error('Failed to reset settings:', err);
        return false;
      }
    }

    // Get download path with course organization
    getDownloadPath(courseName, folderPath = '') {
      let basePath = this.settings.downloadPath;

      // Ensure path doesn't start with slash
      if (basePath.startsWith('/')) {
        basePath = basePath.substring(1);
      }

      if (this.settings.organizeByCourse && courseName) {
        const sanitizedCourseName = this.sanitizePathComponent(courseName);
        basePath = `${basePath}/${sanitizedCourseName}`;
      }

      if (this.settings.organizeByType && folderPath) {
        const sanitizedFolderPath = this.sanitizePathComponent(folderPath);
        basePath = `${basePath}/${sanitizedFolderPath}`;
      }

      return basePath;
    }

    sanitizePathComponent(component) {
      if (!component) return 'unknown';
      return component
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .substring(0, 100);
    }

    // Check if a specific content type should be downloaded
    shouldDownload(contentType, source) {
      switch (source) {
        case 'assignment':
        case 'assignment_embedded':
          return this.settings.includeAssignments;
        case 'module':
          return this.settings.includeModules;
        case 'discussion':
        case 'discussion_reply':
          return this.settings.includeDiscussions;
        case 'api':
        case 'files':
          return this.settings.includeFiles;
        default:
          return true; // Download unknown types by default
      }
    }

    // Get batch configuration
    getBatchConfig() {
      return {
        batchSize: this.settings.maxConcurrentDownloads,
        delay: this.settings.downloadDelay
      };
    }

    // Validation helpers
    isValidDownloadPath(path) {
      if (!path || typeof path !== 'string') return false;

      // Check for invalid characters
      const invalidChars = /[<>"|?*]/;
      if (invalidChars.test(path)) return false;

      // Check for absolute paths (not allowed in extension downloads)
      if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;

      return true;
    }

    validateSettings(settings) {
      const errors = [];

      if (!this.isValidDownloadPath(settings.downloadPath)) {
        errors.push('Invalid download path');
      }

      if (typeof settings.maxConcurrentDownloads !== 'number' ||
          settings.maxConcurrentDownloads < 1 ||
          settings.maxConcurrentDownloads > 10) {
        errors.push('Max concurrent downloads must be between 1 and 10');
      }

      if (typeof settings.downloadDelay !== 'number' ||
          settings.downloadDelay < 0 ||
          settings.downloadDelay > 10000) {
        errors.push('Download delay must be between 0 and 10000ms');
      }

      return errors;
    }

    // Export settings for backup
    async exportSettings() {
      try {
        const settings = await this.get();
        const exportData = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          settings: settings
        };
        return JSON.stringify(exportData, null, 2);
      } catch (err) {
        console.error('Failed to export settings:', err);
        throw err;
      }
    }

    // Import settings from backup
    async importSettings(jsonString) {
      try {
        const importData = JSON.parse(jsonString);

        if (!importData.settings) {
          throw new Error('Invalid settings format');
        }

        const errors = this.validateSettings(importData.settings);
        if (errors.length > 0) {
          throw new Error('Invalid settings: ' + errors.join(', '));
        }

        await this.set(importData.settings);
        return true;
      } catch (err) {
        console.error('Failed to import settings:', err);
        throw err;
      }
    }

    // Get settings for display in UI
    getDisplaySettings() {
      return {
        'Download Path': this.settings.downloadPath,
        'Organize by Course': this.settings.organizeByCourse ? 'Yes' : 'No',
        'Organize by Type': this.settings.organizeByType ? 'Yes' : 'No',
        'Max Downloads': this.settings.maxConcurrentDownloads,
        'Download Delay': `${this.settings.downloadDelay}ms`,
        'Include Assignments': this.settings.includeAssignments ? 'Yes' : 'No',
        'Include Modules': this.settings.includeModules ? 'Yes' : 'No',
        'Include Discussions': this.settings.includeDiscussions ? 'Yes' : 'No',
        'Include Files': this.settings.includeFiles ? 'Yes' : 'No',
        'Debug Mode': this.settings.debugMode ? 'Yes' : 'No'
      };
    }
  }

  // Create global settings manager instance
  window.CanvasHelperSettings = new SettingsManager();

  // Message handler for settings requests
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.type || !message.type.startsWith('settings-')) return;

      (async () => {
        try {
          switch (message.type) {
            case 'settings-get':
              const settings = await window.CanvasHelperSettings.get(message.key);
              sendResponse({ success: true, data: settings });
              break;

            case 'settings-set':
              const success = await window.CanvasHelperSettings.set(message.key, message.value);
              sendResponse({ success });
              break;

            case 'settings-reset':
              const resetSuccess = await window.CanvasHelperSettings.reset();
              sendResponse({ success: resetSuccess });
              break;

            case 'settings-export':
              const exportData = await window.CanvasHelperSettings.exportSettings();
              sendResponse({ success: true, data: exportData });
              break;

            case 'settings-import':
              await window.CanvasHelperSettings.importSettings(message.data);
              sendResponse({ success: true });
              break;

            case 'settings-validate':
              const errors = window.CanvasHelperSettings.validateSettings(message.settings);
              sendResponse({ success: errors.length === 0, errors });
              break;

            default:
              sendResponse({ success: false, error: 'Unknown settings command' });
          }
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();

      return true; // Keep message channel open for async response
    });
  }

  console.log('Settings manager initialized');
})();
