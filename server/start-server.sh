#!/bin/bash
# FFmpeg Interpolation Server Starter
# This script starts the Node.js FFmpeg server

cd "$(dirname "$0")"

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed or not in PATH"
    echo "Please install FFmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt-get install ffmpeg"
    echo "  Windows: Download from https://ffmpeg.org/download.html"
    exit 1
fi

echo "✅ FFmpeg is installed at: $(which ffmpeg)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🎬 Starting FFmpeg Interpolation Server..."
node interpolate-server.js
