# Canvas Helper - Linux Setup Guide

## 🐧 Installation on Linux

### Prerequisites
- **Google Chrome or Chromium** browser
- Active Canvas account with course access

### Step 1: Install the Extension
1. **Open Chrome/Chromium** and go to:
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle "Developer mode" in the top-right corner

3. **Load the Extension**
   - Click **"Load unpacked"**
   - Navigate to and select your `canvas_helper` folder
   - The extension should appear in your extensions list

### Step 2: Verify Installation
- Look for the Canvas Helper icon in your browser toolbar
- If not visible, click the puzzle piece icon and pin Canvas Helper

## 📁 Linux Download Locations

### Default Path Structure
```
~/Downloads/canvas_downloads/
├── Course_Name_1/
│   ├── assignments/
│   ├── modules/
│   ├── discussions/
│   └── files/
└── Course_Name_2/
    └── ...
```

### Common Linux Download Issues
- **Permission Issues**: Ensure Chrome has write access to Downloads folder
- **Path Length**: Linux supports long paths, so full organization is enabled
- **File Names**: Special characters are converted to underscores for compatibility

## 🚀 Usage on Linux

### Download All Course Files
1. Navigate to any Canvas course page
2. Click the Canvas Helper extension icon
3. Click **"📥 Download All Course Files"**
4. Files download to: `~/Downloads/canvas_downloads/[Course_Name]/`

### Extract Complete Course Content
1. On a Canvas course page, click Canvas Helper
2. Click **"📋 Extract All Course Content"**
3. Creates comprehensive text file in: `~/Downloads/`

## 🛠️ Linux-Specific Features

### File Types Detected
The extension finds ALL these file types in Canvas:
- **Documents**: `.pdf`, `.doc`, `.docx`, `.txt`, `.rtf`, `.odt`
- **Presentations**: `.ppt`, `.pptx`, `.odp`
- **Spreadsheets**: `.xls`, `.xlsx`, `.csv`, `.ods`
- **Code Files**: `.py`, `.java`, `.cpp`, `.c`, `.h`, `.js`, `.html`, `.css`
- **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, `.7z`
- **Media**: `.jpg`, `.png`, `.gif`, `.mp4`, `.mp3`, `.wav`

### Terminal Commands for Organization
```bash
# Navigate to downloads
cd ~/Downloads/canvas_downloads

# List all downloaded courses
ls -la

# Find all PDFs across courses
find . -name "*.pdf" -type f

# Count files by type
find . -name "*.pdf" | wc -l
find . -name "*.py" | wc -l
```

## 🔍 Troubleshooting on Linux

### Extension Not Loading
```bash
# Check Chrome/Chromium version
google-chrome --version
# or
chromium --version

# Ensure permissions
chmod -R 755 canvas_helper/
```

### Downloads Not Working
1. **Check permissions**:
   ```bash
   ls -la ~/Downloads/
   ```

2. **Verify Chrome permissions**:
   - Go to `chrome://settings/content/downloads`
   - Ensure downloads are allowed

3. **Check disk space**:
   ```bash
   df -h ~/Downloads/
   ```

### File Path Issues
- Linux handles long paths well
- Special characters in filenames are automatically sanitized
- Files maintain original extensions

## 📊 Linux Performance Tips

### Large Course Downloads
- Extension processes files in batches of 3
- 1-second delay between batches to avoid rate limiting
- Monitor with: `watch -n 1 'ls -la ~/Downloads/canvas_downloads'`

### Storage Management
```bash
# Check total downloaded size
du -sh ~/Downloads/canvas_downloads

# Clean up old downloads (optional)
find ~/Downloads/canvas_downloads -type f -mtime +30 -ls
```

## 🔐 Security on Linux

### File Permissions
Downloaded files inherit standard permissions:
- **Regular files**: `644` (rw-r--r--)
- **Directories**: `755` (rwxr-xr-x)`

### Browser Isolation
- Extension runs in Chrome's sandbox
- No system-level permissions required
- Only accesses Downloads folder

## 🆘 Common Linux Issues & Solutions

| Problem | Solution |
|---------|----------|
| Extension icon missing | Pin from Chrome extensions menu (puzzle piece) |
| Downloads to wrong folder | Check Chrome download settings |
| Permission denied | `chmod 755 ~/Downloads/` |
| Files not found | Check `~/Downloads/canvas_downloads/` |
| Text export too large | Files over 1GB may be split |

## 📝 Command Line Integration

### Batch Operations
```bash
#!/bin/bash
# Script to organize downloads by semester

cd ~/Downloads/canvas_downloads

# Move spring courses
mkdir -p 2024_Spring
mv *Spring* 2024_Spring/ 2>/dev/null

# Move fall courses  
mkdir -p 2024_Fall
mv *Fall* 2024_Fall/ 2>/dev/null
```

### Search Downloaded Content
```bash
# Find all assignments
find ~/Downloads/canvas_downloads -path "*/assignments/*" -type f

# Search in comprehensive text exports
grep -r "assignment\|homework\|project" ~/Downloads/*.txt
```

## 🔄 Updates & Maintenance

### Updating the Extension
1. Pull latest changes to your `canvas_helper` folder
2. Go to `chrome://extensions/`
3. Click refresh (↻) on Canvas Helper
4. Verify new features in popup

### Backup Your Downloads
```bash
# Create backup
tar -czf canvas_backup_$(date +%Y%m%d).tar.gz ~/Downloads/canvas_downloads/

# Restore from backup
tar -xzf canvas_backup_YYYYMMDD.tar.gz -C ~/
```

## ✅ Verification Checklist

- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Test download creates file in `~/Downloads/`
- [ ] Canvas file download works and organizes by course
- [ ] Comprehensive text export generates large `.txt` file
- [ ] All file types (.pdf, .doc, .py, etc.) are detected
- [ ] Downloads organized in proper folder structure

## 🎯 Pro Tips for Linux Users

1. **Use symbolic links** to organize downloads:
   ```bash
   ln -s ~/Downloads/canvas_downloads ~/Desktop/Courses
   ```

2. **Monitor downloads in real-time**:
   ```bash
   watch -n 2 'find ~/Downloads/canvas_downloads -type f | wc -l'
   ```

3. **Quick course navigation**:
   ```bash
   alias courses='cd ~/Downloads/canvas_downloads && ls'
   ```

Happy downloading! 🚀