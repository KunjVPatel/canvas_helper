#!/bin/bash

echo "🎓 Starting GPA Hero Interface..."

# Check if GPAHero directory exists
if [ ! -d "GPAHero" ]; then
    echo "❌ Error: GPAHero directory not found!"
    exit 1
fi

# Navigate to GPAHero directory
cd GPAHero

# Check if Python is available
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Error: Python not found!"
    echo "Please install Python to run GPA Hero"
    exit 1
fi

# Start simple HTTP server
echo "🌟 GPA Hero starting on http://localhost:8080"
echo "📱 Access GPA Hero at: http://localhost:8080/index.html"
echo "🔗 Direct link: http://localhost:8080/index.html?student_id=student_course_COURSE_ID&course_id=COURSE_ID&course_name=COURSE_NAME"
echo ""
echo "Press Ctrl+C to stop the server"

$PYTHON_CMD -m http.server 8080
