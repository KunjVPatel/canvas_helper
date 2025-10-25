#!/bin/bash

# Canvas Helper Release Creator
# Creates a distributable package of the Canvas Helper Chrome Extension

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_NAME="canvas-helper"
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
RELEASE_DIR="releases"
TEMP_DIR="temp_release"

echo -e "${BLUE}🚀 Canvas Helper Release Creator${NC}"
echo -e "${BLUE}===================================${NC}"
echo -e "Version: ${GREEN}${VERSION}${NC}"
echo -e "Extension: ${GREEN}${EXTENSION_NAME}${NC}"
echo ""

# Create release directory
if [ ! -d "$RELEASE_DIR" ]; then
    mkdir -p "$RELEASE_DIR"
    echo -e "${GREEN}✓${NC} Created releases directory"
fi

# Clean up any existing temp directory
if [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
fi

echo -e "${YELLOW}📦 Creating release package...${NC}"

# Create temporary directory for packaging
mkdir -p "$TEMP_DIR/$EXTENSION_NAME"

# Copy essential files for extension
echo -e "${BLUE}📋 Copying extension files...${NC}"
cp manifest.json "$TEMP_DIR/$EXTENSION_NAME/"
cp -r src/ "$TEMP_DIR/$EXTENSION_NAME/"
cp -r public/ "$TEMP_DIR/$EXTENSION_NAME/"
cp readme.md "$TEMP_DIR/$EXTENSION_NAME/"
cp LINUX_SETUP.md "$TEMP_DIR/$EXTENSION_NAME/"

# Copy package.json if it exists
if [ -f "package.json" ]; then
    cp package.json "$TEMP_DIR/$EXTENSION_NAME/"
fi

echo -e "${GREEN}✓${NC} Extension files copied"

# Create installation instructions
echo -e "${BLUE}📄 Creating installation instructions...${NC}"
cat > "$TEMP_DIR/$EXTENSION_NAME/INSTALL.md" << 'EOF'
# Canvas Helper Installation Guide

## Quick Install (Chrome/Chromium)

1. **Download**: Extract this zip file to a folder
2. **Chrome Extensions**: Go to `chrome://extensions/`
3. **Developer Mode**: Toggle "Developer mode" ON (top-right)
4. **Load Extension**: Click "Load unpacked" and select the `canvas-helper` folder
5. **Pin Extension**: Click the puzzle piece icon and pin Canvas Helper
6. **Ready**: Navigate to any Canvas course and click the extension icon!

## Features

- 📥 **Download All Course Files**: Gets PDFs, docs, code files, media
- 📋 **Export Complete Course Text**: Creates comprehensive text backup
- 🌙 **Dark Minimal UI**: Clean interface with real-time progress
- 📁 **Smart Organization**: Files saved to `Downloads/canvas_downloads/Course_Name/`

## Supported Platforms

- ✅ **Linux**: `~/Downloads/canvas_downloads/`
- ✅ **Windows**: `%USERPROFILE%/Downloads/canvas_downloads/`
- ✅ **Mac**: `~/Downloads/canvas_downloads/`

## Troubleshooting

- **No files found**: Make sure you're on a Canvas course page with content
- **Downloads failing**: Check Chrome permissions in `chrome://settings/content/downloads`
- **Extension not loading**: Ensure Developer mode is enabled

## What Gets Downloaded

### File Types (50+)
- Documents: PDF, Word, PowerPoint, Excel
- Code: Python, Java, C++, HTML, CSS, JS
- Media: Images, videos, audio files
- Archives: ZIP, TAR, RAR files

### Content Sources
- Course Files section
- Assignment attachments
- Module resources
- Discussion embedded files
- Course pages content

---
Made with ❤️ for HackPSU | Open Source Canvas Archival Tool
EOF

echo -e "${GREEN}✓${NC} Installation guide created"

# Create version info file
cat > "$TEMP_DIR/$EXTENSION_NAME/VERSION_INFO.txt" << EOF
Canvas Helper Chrome Extension
Version: ${VERSION}
Build Date: $(date '+%Y-%m-%d %H:%M:%S')
Platform: Cross-platform (Windows/Linux/Mac)

Features:
- Comprehensive file download from Canvas courses
- Complete course content text export
- Enhanced PDF detection and extraction
- Smart file organization by course and type
- Minimal dark UI with real-time progress
- Cross-platform compatibility

Release Notes:
- Initial public release
- Full Canvas API integration
- Enhanced file detection (PDFs, docs, media)
- Organized download structure
- Comprehensive text export functionality

GitHub: https://github.com/YOUR_USERNAME/canvas-helper
EOF

# Create the release package
RELEASE_FILE="${RELEASE_DIR}/${EXTENSION_NAME}-v${VERSION}.zip"

echo -e "${YELLOW}🗜️  Creating ZIP package...${NC}"
cd "$TEMP_DIR"
zip -r "../${RELEASE_FILE}" . -q

cd ..
echo -e "${GREEN}✓${NC} Release package created: ${RELEASE_FILE}"

# Get file size
FILE_SIZE=$(ls -lh "$RELEASE_FILE" | awk '{print $5}')
echo -e "   File size: ${GREEN}${FILE_SIZE}${NC}"

# Create checksums
echo -e "${YELLOW}🔐 Creating checksums...${NC}"
if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$RELEASE_FILE" > "${RELEASE_FILE}.sha256"
    echo -e "${GREEN}✓${NC} SHA256 checksum created"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$RELEASE_FILE" > "${RELEASE_FILE}.sha256"
    echo -e "${GREEN}✓${NC} SHA256 checksum created"
fi

# Cleanup temp directory
rm -rf "$TEMP_DIR"
echo -e "${GREEN}✓${NC} Temporary files cleaned up"

echo ""
echo -e "${GREEN}🎉 Release package created successfully!${NC}"
echo -e "${BLUE}📦 Package:${NC} ${RELEASE_FILE}"
echo -e "${BLUE}📊 Size:${NC} ${FILE_SIZE}"
echo -e "${BLUE}🔢 Version:${NC} ${VERSION}"

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Test the extension package"
echo -e "2. Upload to GitHub releases"
echo -e "3. Update documentation links"
echo -e "4. Share with the community!"

echo ""
echo -e "${BLUE}GitHub Release Command:${NC}"
echo -e "gh release create v${VERSION} ${RELEASE_FILE} --title 'Canvas Helper v${VERSION}' --notes 'See CHANGELOG.md for details'"
