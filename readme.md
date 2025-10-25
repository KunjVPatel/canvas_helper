# Canvas Helper Extension

A minimal Chrome extension for hackPSU that extracts and downloads ALL content from Canvas courses. Features a clean dark interface with two essential functions: comprehensive file downloads and complete course text exports.

## Features

### 🌙 **Minimal Dark Interface**
- Clean, focused dark gray UI with only essential functions
- Two primary actions: file downloads and text export
- Real-time progress feedback with visual status indicators
- Cross-platform path detection (Windows/Linux/Mac)

### 📥 **Comprehensive File Download** 
- **All File Types**: PDFs, docs, presentations, code files, images, archives
- **Multi-Source Discovery**: Extracts files from:
  - Course Files section via Canvas API
  - Assignment attachments and descriptions
  - Module resources and content
  - Discussion posts and embedded files  
  - Course pages and announcements
- **Smart Organization**: `canvas_downloads/Course_Name/assignments/`, `/modules/`, `/discussions/`, `/files/`
- **Batch Processing**: Downloads in batches with rate limiting

### 📄 **Complete Course Text Export**
- **Everything in One File**: Massive text file with ALL course content:
  - Syllabus and course information
  - All assignments with full descriptions
  - Complete discussion threads with replies
  - Module structure and content
  - Course pages and announcements
  - Quiz descriptions and instructions  
  - Student roster and instructor info
  - Calendar events and deadlines
- **Structured Format**: Table of contents with clear sections
- **API + DOM Scraping**: Maximum content coverage

## Installation

### Method 1: Load as Unpacked Extension (Recommended for Development)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" button
4. Select the `canvas_helper` folder
5. The extension should now appear in your extensions list

### Method 2: Build and Package (For Distribution)

1. Navigate to the project directory
2. The extension is ready to use as-is (no build step required)
3. To package: Go to `chrome://extensions/`, click "Pack extension", and select the `canvas_helper` folder

## Usage

### 📥 Download All Course Files

1. Navigate to any Canvas course page
2. Click the Canvas Helper extension icon (dark interface opens)
3. Click **"📥 Download All Course Files"**
4. Files automatically download to: 
   - **Linux**: `~/Downloads/canvas_downloads/Course_Name/`
   - **Windows**: `%USERPROFILE%/Downloads/canvas_downloads/Course_Name/`
   - **Mac**: `~/Downloads/canvas_downloads/Course_Name/`

### 📄 Export Complete Course Text

1. Navigate to any Canvas course main page
2. Click the Canvas Helper extension icon
3. Click **"📋 Export Complete Course Text"**
4. Creates comprehensive text file with everything:
   - Course information and syllabus
   - All assignments with full descriptions
   - Discussion topics with all replies
   - Complete module structure and content
   - Course pages and announcements
   - Quiz descriptions and instructions
   - Student roster and enrollment info
   - Calendar events and due dates
   - File inventory with metadata

**File saved to**: `canvas_downloads/Course_Name/Course_Name_Complete_Export_TIMESTAMP.txt`

## Supported Canvas Domains

The extension works with:
- `*.instructure.com` (Canvas cloud instances)
- `canvas.*` (Custom Canvas domains)
- `localhost` (For development/testing)

## Technical Details

### File Structure

```
canvas_helper/
├── manifest.json          # Extension configuration
├── src/
│   ├── background.js      # Service worker for downloads
│   ├── content.js         # Canvas capture functionality
│   ├── scraper.js         # File scraping logic
│   └── popup.js           # Popup interface logic
├── public/
│   └── popup.html         # Extension popup UI
└── readme.md             # This file
```

### How It Works

1. **Canvas API Integration**:
   - Makes systematic API calls to extract ALL course data
   - Processes assignments, discussions, modules, files, pages, quizzes
   - Handles pagination to get complete datasets
   - Includes user data, calendar events, and enrollments

2. **Multi-Layer File Discovery**:
   - **Canvas Files API**: Official course files
   - **Assignment attachments**: PDFs and documents in assignments
   - **Module resources**: Files embedded in modules
   - **Discussion content**: Files and images in discussions
   - **DOM scraping**: Catches any missed embedded content

3. **Smart Organization**:
   - **File structure**: `canvas_downloads/Course_Name/assignments/`, `/modules/`, `/discussions/`, `/files/`
   - **Text exports**: `canvas_downloads/Course_Name/Course_Name_Complete_Export.txt`
   - **Cross-platform paths**: Adapts to Windows/Linux/Mac
   - **Duplicate handling**: Prevents duplicate downloads

### Permissions Required

- `downloads`: To save files to the user's computer
- `activeTab`: To access the current tab content
- `scripting`: To inject content scripts
- `storage`: To store extension settings
- Host permissions for Canvas domains

## Troubleshooting

### No Files Found
- Make sure you're on a Canvas course page with files
- Check that you have access to the course content
- Some files may require authentication

### Download Failures
- Files may be protected by Canvas permissions
- Network issues or rate limiting may occur
- Check browser's download settings and permissions

### Canvas Capture Issues
- Ensure the page has HTML5 canvas elements
- Some canvases may be protected by CORS policies
- Try refreshing the page and capturing again

## Development

### Prerequisites
- Google Chrome browser
- Basic understanding of Chrome Extension development

### Testing
1. Load the extension in developer mode
2. Navigate to a Canvas course page
3. Test file downloading functionality
4. Check browser console for any errors

### Debugging
- Check the extension's service worker logs in `chrome://extensions/`
- Use browser developer tools to inspect content script behavior
- Monitor network requests in the Network tab

## Output Examples

### File Organization
```
Downloads/canvas_downloads/
├── Intro_to_Computer_Science/
│   ├── assignments/
│   │   ├── requirements.pdf
│   │   ├── starter_code.zip
│   │   └── rubric.pdf
│   ├── modules/
│   │   ├── lecture_slides.pptx
│   │   ├── reading_material.pdf
│   │   └── algorithm_examples.py
│   ├── discussions/
│   │   └── discussion_files.pdf
│   ├── files/
│   │   ├── syllabus.pdf
│   │   └── course_schedule.xlsx
│   └── Intro_to_Computer_Science_Complete_Export_2024-01-15.txt
└── Data_Structures/
    ├── assignments/
    ├── modules/
    └── Data_Structures_Complete_Export_2024-01-15.txt
```

### Complete Text Export Sample
```
================================================================================
CANVAS COURSE CONTENT EXPORT
Course: Introduction to Computer Science
Course Code: CS 101
Term: Fall 2024
Extracted: 2024-01-15T10:30:00.000Z
================================================================================

TABLE OF CONTENTS
----------------------------------------
1. Course Information
2. Syllabus
3. Announcements
4. Assignments
5. Discussions
...

1. COURSE INFORMATION
========================================
Name: Introduction to Computer Science
Code: CS 101
Term: Fall 2024
Instructors: Dr. Jane Smith, Prof. John Doe
Course ID: 12345

2. SYLLABUS
========================================
Welcome to CS 101! This course covers fundamental concepts...
[Complete syllabus content]

4. ASSIGNMENTS
========================================
1. Homework Assignment 1: Variables and Data Types
Due: 2024-02-01T23:59:00Z
Points: 100
------------------------------
In this assignment, you will learn about variables...
[Complete assignment description and instructions]
...
```

## Known Limitations

- Requires active Canvas session (must be logged in)
- Canvas API access depends on user permissions  
- Very large courses may take several minutes to process completely
- Some institutions may have API rate limiting
- Private or restricted content may not be accessible
- File downloads depend on Canvas file permissions

## License

This project is created for hackPSU and is intended for educational purposes.

## Contributing

This is a hackPSU project. Feel free to contribute improvements and bug fixes.