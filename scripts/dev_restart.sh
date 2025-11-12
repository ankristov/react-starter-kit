#!/bin/bash

# Script to restart the development server
# This kills any running Vite dev processes and starts fresh

# Port configured in vite.config.ts
DEV_PORT=5174

echo "🛑 Stopping any running dev servers..."

# Kill any processes using the dev port or node processes related to vite
pkill -f "vite" || true
pkill -f "node.*vite" || true

# Wait a moment for processes to fully terminate
sleep 1

# Check if the dev port is still in use and kill if needed
if lsof -ti:$DEV_PORT > /dev/null 2>&1; then
    echo "⚠️  Port $DEV_PORT still in use, killing processes..."
    lsof -ti:$DEV_PORT | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo "✅ All dev processes stopped"
echo ""
echo "🚀 Starting development server..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📍 Server will be available at:"
echo "   http://localhost:$DEV_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the dev server (it will show the actual port in its output)
npm run dev

