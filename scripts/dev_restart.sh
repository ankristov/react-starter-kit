#!/bin/bash

# Complete development environment startup script
# This script manages:
# 1. Dev server (Vite on port 5174)
# 2. Interpolation server (Express on port 3001) - Optional
# 
# USAGE:
#   ./dev_restart.sh              # Start only dev server
#   ./dev_restart.sh --with-interpolate  # Start both servers

# Get the project root directory (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Ports
DEV_PORT=5174
INTERPOLATE_PORT=3001

# Check for --with-interpolate flag
START_INTERPOLATE=false
if [[ "$1" == "--with-interpolate" ]]; then
    START_INTERPOLATE=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🎬 Forcefield Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to cleanup processes
cleanup_dev_servers() {
    echo -e "${RED}🛑 Stopping any running dev servers...${NC}"
    
    # Kill Vite processes
    pkill -f "vite" 2>/dev/null || true
    pkill -f "node.*vite" 2>/dev/null || true
    
    # Kill interpolation server processes
    pkill -f "interpolate-server" 2>/dev/null || true
    lsof -ti:$INTERPOLATE_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    
    sleep 1
    
    # Kill any remaining process on dev port
    if lsof -ti:$DEV_PORT > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $DEV_PORT still in use, force killing...${NC}"
        lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
    
    echo -e "${GREEN}✅ All dev processes stopped${NC}"
    echo ""
}

# Function to start dev server
start_dev_server() {
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT" || exit 1
    
    echo -e "${BLUE}📦 Preparing FFmpeg files...${NC}"
    npm run predev > /dev/null 2>&1
    echo -e "${GREEN}✅ FFmpeg files ready${NC}"
    echo ""
    
    echo -e "${BLUE}🚀 Starting development server...${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}📍 Frontend available at:${NC}"
    echo -e "   ${GREEN}http://localhost:$DEV_PORT${NC}"
    
    if [ "$START_INTERPOLATE" = true ]; then
        echo ""
        echo -e "${GREEN}📍 Interpolation server available at:${NC}"
        echo -e "   ${GREEN}http://localhost:$INTERPOLATE_PORT${NC}"
        echo ""
        echo -e "${YELLOW}💡 Tip: Video smoothing requires FFmpeg to be installed${NC}"
        echo -e "   ${YELLOW}Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Ubuntu)${NC}"
    fi
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    npm run dev
}

# Function to start interpolation server (background)
start_interpolation_server() {
    echo -e "${BLUE}🎬 Starting interpolation server...${NC}"
    
    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT" || exit 1
    
    # Check if FFmpeg is installed
    if ! command -v ffmpeg &> /dev/null; then
        echo -e "${RED}❌ FFmpeg not found!${NC}"
        echo -e "${YELLOW}Install FFmpeg to use video smoothing:${NC}"
        echo "   macOS: brew install ffmpeg"
        echo "   Ubuntu: sudo apt-get install ffmpeg"
        echo "   Windows: Download from https://ffmpeg.org/download.html"
        echo ""
        echo -e "${YELLOW}Skipping interpolation server...${NC}"
        echo ""
        return 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "server/node_modules" ]; then
        echo -e "${YELLOW}📦 Installing server dependencies...${NC}"
        cd "$PROJECT_ROOT/server" && npm install > /dev/null 2>&1
        cd "$PROJECT_ROOT" || exit 1
        echo -e "${GREEN}✅ Server dependencies installed${NC}"
    fi
    
    # Start server in background
    cd "$PROJECT_ROOT/server" && npm start > /tmp/interpolate-server.log 2>&1 &
    INTERPOLATE_PID=$!
    cd "$PROJECT_ROOT" || exit 1
    
    # Wait a moment for server to start
    sleep 2
    
    # Check if server started successfully
    if curl -s http://localhost:$INTERPOLATE_PORT/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Interpolation server started (PID: $INTERPOLATE_PID)${NC}"
        echo -e "${GREEN}   📍 http://localhost:$INTERPOLATE_PORT${NC}"
        echo -e "${GREEN}   📝 Logs: /tmp/interpolate-server.log${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to start interpolation server${NC}"
        echo -e "${YELLOW}Check logs: cat /tmp/interpolate-server.log${NC}"
        return 1
    fi
}

# Main execution
cleanup_dev_servers

if [ "$START_INTERPOLATE" = true ]; then
    echo ""
    start_interpolation_server
    echo ""
fi

start_dev_server