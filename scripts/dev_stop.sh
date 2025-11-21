#!/bin/bash

# Development environment shutdown script
# This script stops:
# 1. Vite dev server (port 5174)
# 2. Interpolation server (port 3002)
# 3. All related Node.js processes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ports
DEV_PORT=5174
INTERPOLATE_PORT=3002

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛑 Stopping Forcefield Development Environment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Track if anything was stopped
stopped_anything=false

# Kill Vite processes
if pgrep -f "vite" > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping Vite dev server (port $DEV_PORT)...${NC}"
    pkill -f "vite" 2>/dev/null || true
    pkill -f "node.*vite" 2>/dev/null || true
    stopped_anything=true
fi

# Kill interpolation server processes
if pgrep -f "interpolate-server" > /dev/null 2>&1; then
    echo -e "${YELLOW}Stopping interpolation server (port $INTERPOLATE_PORT)...${NC}"
    pkill -f "interpolate-server" 2>/dev/null || true
    stopped_anything=true
fi

# Kill any remaining process on dev port
if lsof -ti:$DEV_PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}Force killing process on port $DEV_PORT...${NC}"
    lsof -ti:$DEV_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    stopped_anything=true
fi

# Kill any remaining process on interpolate port
if lsof -ti:$INTERPOLATE_PORT > /dev/null 2>&1; then
    echo -e "${YELLOW}Force killing process on port $INTERPOLATE_PORT...${NC}"
    lsof -ti:$INTERPOLATE_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    stopped_anything=true
fi

sleep 1

# Final verification
if stopped_anything; then
    echo ""
    echo -e "${GREEN}✅ All services stopped${NC}"
    echo ""
    echo -e "${BLUE}Port Status:${NC}"
    
    if lsof -ti:$DEV_PORT > /dev/null 2>&1; then
        echo -e "${RED}   Port $DEV_PORT: Still in use${NC}"
    else
        echo -e "${GREEN}   Port $DEV_PORT: Free${NC}"
    fi
    
    if lsof -ti:$INTERPOLATE_PORT > /dev/null 2>&1; then
        echo -e "${RED}   Port $INTERPOLATE_PORT: Still in use${NC}"
    else
        echo -e "${GREEN}   Port $INTERPOLATE_PORT: Free${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No running services found${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
