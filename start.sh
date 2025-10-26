#!/bin/bash

echo "🚀 Starting Canvas Helper Server..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env with your Snowflake credentials."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌟 Server starting on http://localhost:3000"
node server.js
