# Dev Restart Script - Usage Guide

## Overview

The updated `dev_restart.sh` script now handles both the frontend dev server and optional interpolation server startup.

## Usage

### Option 1: Start Only Dev Server (Default)
```bash
./scripts/dev_restart.sh
```

Starts:
- ✅ Frontend dev server (Vite on port 5174)

### Option 2: Start Both Servers (With Smooth Video Support)
```bash
./scripts/dev_restart.sh --with-interpolate
```

Starts:
- ✅ Frontend dev server (Vite on port 5174)
- ✅ Interpolation server (Express on port 3001) - if FFmpeg is installed

## What the Script Does

### Cleanup Phase
1. Kills any running Vite processes
2. Kills any running interpolation servers
3. Cleans up ports 5174 and 3001
4. Ensures clean startup

### Dev Server Startup
1. Prepares FFmpeg files for browser
2. Starts Vite dev server
3. Shows server URL in terminal

### Interpolation Server Startup (if --with-interpolate)
1. Checks if FFmpeg is installed
2. Installs server dependencies (if needed)
3. Starts Express server in background
4. Verifies server is running via health check
5. Shows server URL and logs location

## Requirements

### Always Required
- Node.js 14+
- npm

### For Video Smoothing (--with-interpolate flag)
- FFmpeg (free, open-source)
  - macOS: `brew install ffmpeg`
  - Ubuntu: `sudo apt-get install ffmpeg`
  - Windows: Download from https://ffmpeg.org/download.html

## Features

✅ **Color-coded output** - Easy to read status messages  
✅ **Automatic dependency installation** - Server dependencies install automatically  
✅ **FFmpeg detection** - Checks if FFmpeg is available before starting  
✅ **Health checking** - Verifies interpolation server started successfully  
✅ **Background execution** - Interpolation server runs in background  
✅ **Logging** - Server logs written to `/tmp/interpolate-server.log`  
✅ **Process cleanup** - Kills all old processes on startup  
✅ **Port management** - Handles ports 5174 and 3001  

## Output Examples

### Dev Server Only
```
🎬 Forcefield Development Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Stopping any running dev servers...
✅ All dev processes stopped

📦 Preparing FFmpeg files...
✅ FFmpeg files ready

🚀 Starting development server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Frontend available at:
   http://localhost:5174
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### With Interpolation Server
```
🎬 Forcefield Development Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Stopping any running dev servers...
✅ All dev processes stopped

🎬 Starting interpolation server...
✅ Interpolation server started (PID: 12345)
   📍 http://localhost:3001
   📝 Logs: /tmp/interpolate-server.log

📦 Preparing FFmpeg files...
✅ FFmpeg files ready

🚀 Starting development server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Frontend available at:
   http://localhost:5174

📍 Interpolation server available at:
   http://localhost:3001

💡 Tip: Video smoothing requires FFmpeg to be installed
   Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Ubuntu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Troubleshooting

### FFmpeg Not Found
If you see:
```
❌ FFmpeg not found!
Install FFmpeg to use video smoothing...
Skipping interpolation server...
```

**Solution**: Install FFmpeg
```bash
brew install ffmpeg      # macOS
sudo apt-get install ffmpeg  # Ubuntu
```

### Interpolation Server Failed to Start
If you see:
```
❌ Failed to start interpolation server
Check logs: cat /tmp/interpolate-server.log
```

**Solutions**:
1. Check the logs: `cat /tmp/interpolate-server.log`
2. Verify FFmpeg is installed: `ffmpeg -version`
3. Check if port 3001 is in use: `lsof -i :3001`
4. Kill any process on 3001: `lsof -ti:3001 | xargs kill -9`

### Port Already in Use
The script attempts to kill existing processes, but if it still fails:

```bash
# See what's using the port
lsof -i :5174    # Dev server port
lsof -i :3001    # Interpolation port

# Kill the process
kill -9 <PID>
```

## Advanced Usage

### Check Interpolation Server Status
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","message":"FFmpeg interpolation server is running"}
```

### View Server Logs
```bash
tail -f /tmp/interpolate-server.log
```

### Manual Server Shutdown
```bash
# Kill specific process
kill <PID>

# Or kill all node processes
pkill -f "node"
```

## Integration

You can also use this script from your IDE:

**VS Code** - Add to `.vscode/tasks.json`:
```json
{
  "label": "Dev Restart (with interpolate)",
  "type": "shell",
  "command": "./scripts/dev_restart.sh",
  "args": ["--with-interpolate"],
  "presentation": {
    "reveal": "always",
    "panel": "new"
  }
}
```

## Summary

| Command | Effect |
|---------|--------|
| `./scripts/dev_restart.sh` | Start dev server only |
| `./scripts/dev_restart.sh --with-interpolate` | Start dev + interpolation servers |
| `./scripts/dev_restart.sh --help` | Show this help (future feature) |

The script is idempotent - running it multiple times is safe and will restart cleanly each time.
