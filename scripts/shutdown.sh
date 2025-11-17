#!/bin/bash

# Forcefield Development Environment Shutdown Script
# This script gracefully stops all running services:
# - Vite dev server
# - Interpolation server (Express)
# - FFmpeg processes
# - Node processes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛑 Forcefield Development Environment Shutdown${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Counter for stopped services
STOPPED=0

# Function to stop a service
stop_service() {
    local service_name=$1
    local grep_pattern=$2
    local port=$3
    
    echo -e "${YELLOW}Stopping $service_name...${NC}"
    
    # Try to kill by process name first
    if pgrep -f "$grep_pattern" > /dev/null 2>&1; then
        pkill -f "$grep_pattern" 2>/dev/null || true
        sleep 1
        STOPPED=$((STOPPED + 1))
        echo -e "${GREEN}✅ $service_name stopped${NC}"
    fi
    
    # If port is specified, also try to kill process on that port
    if [ -n "$port" ]; then
        if lsof -ti:$port > /dev/null 2>&1; then
            echo -e "${YELLOW}   Force killing process on port $port...${NC}"
            lsof -ti:$port | xargs kill -9 2>/dev/null || true
            sleep 1
            echo -e "${GREEN}   ✅ Port $port released${NC}"
        fi
    fi
}

echo -e "${BLUE}Stopping services...${NC}"
echo ""

# Stop Vite dev server
stop_service "Vite dev server" "vite" "5174"
echo ""

# Stop interpolation server
stop_service "Interpolation server" "interpolate-server" "3002"
echo ""

# Stop any remaining Node processes
stop_service "Node processes" "node" ""
echo ""

# Kill FFmpeg processes
echo -e "${YELLOW}Stopping FFmpeg processes...${NC}"
if pgrep -f "ffmpeg" > /dev/null 2>&1; then
    pkill -f "ffmpeg" 2>/dev/null || true
    sleep 1
    STOPPED=$((STOPPED + 1))
    echo -e "${GREEN}✅ FFmpeg processes stopped${NC}"
else
    echo -e "${YELLOW}   (no FFmpeg processes running)${NC}"
fi
echo ""

# Clean up lingering processes on common dev ports
echo -e "${YELLOW}Checking for lingering processes on development ports...${NC}"
for port in 5174 3002 3000 3001 8000 8080; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo -e "${YELLOW}   Killing process on port $port...${NC}"
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
done
echo -e "${GREEN}✅ Port check complete${NC}"
echo ""

# Final status
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $STOPPED -gt 0 ]; then
    echo -e "${GREEN}✅ Shutdown complete - $STOPPED service(s) stopped${NC}"
else
    echo -e "${YELLOW}⚠️  No services were running${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Optional: Show remaining processes (for debugging)
if [ "$1" == "-v" ] || [ "$1" == "--verbose" ]; then
    echo -e "${BLUE}Active development processes:${NC}"
    ps aux | grep -E "(node|vite|ffmpeg|npm)" | grep -v grep || echo "   (none)"
    echo ""
fi

exit 0
