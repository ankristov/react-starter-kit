# 🚀 Dev Restart Script - Updated

## What Changed

Your `scripts/dev_restart.sh` has been completely updated with comprehensive startup management.

## Key Features

### ✅ Dual Server Support
- **Dev Server** (Vite) - Frontend on port 5174
- **Interpolation Server** (Express) - Video smoothing on port 3001

### ✅ Smart Command-Line Options
```bash
./scripts/dev_restart.sh                    # Dev server only
./scripts/dev_restart.sh --with-interpolate # Dev + Interpolation server
```

### ✅ Automatic Management
- Kills all old processes cleanly
- Installs server dependencies automatically
- Checks if FFmpeg is installed
- Verifies both servers started successfully
- Runs interpolation server in background
- Writes server logs to `/tmp/interpolate-server.log`

### ✅ Better Output
- Color-coded messages (green for success, red for errors, yellow for warnings)
- Clear status indicators
- Helpful tips and next steps
- Server URLs and log locations

## New Capabilities

### Feature 1: Optional Interpolation Server
Start with video smoothing support:
```bash
./scripts/dev_restart.sh --with-interpolate
```

The script will:
1. Check if FFmpeg is installed
2. Install server dependencies (if needed)
3. Start interpolation server in background
4. Verify it's working via health check
5. Show you the server URL

### Feature 2: Automatic Cleanup
- Kills existing Vite processes
- Kills existing interpolation server
- Frees up ports 5174 and 3001
- Ensures clean startup every time

### Feature 3: FFmpeg Detection
If FFmpeg is not installed and you use `--with-interpolate`:
```
❌ FFmpeg not found!
Install FFmpeg to use video smoothing:
   macOS: brew install ffmpeg
   Ubuntu: sudo apt-get install ffmpeg
   Windows: Download from https://ffmpeg.org/download.html

Skipping interpolation server...
```

### Feature 4: Health Verification
The script verifies the interpolation server is actually running:
```
✅ Interpolation server started (PID: 12345)
   📍 http://localhost:3001
   📝 Logs: /tmp/interpolate-server.log
```

## Usage Scenarios

### Scenario 1: Quick Frontend Development
```bash
./scripts/dev_restart.sh
# Just the dev server, nothing else
```

### Scenario 2: Full Development (with Video Smoothing)
```bash
./scripts/dev_restart.sh --with-interpolate
# Both servers start, ready for full feature testing
```

### Scenario 3: After Changing Backend Code
```bash
./scripts/dev_restart.sh --with-interpolate
# Kills old server, restarts fresh with new code
```

## What It Outputs

### Dev Server Only
```
🎬 Forcefield Development Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Stopping any running dev servers...
✅ All dev processes stopped

📦 Preparing FFmpeg files...
✅ FFmpeg files ready

🚀 Starting development server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Frontend available at:
   http://localhost:5174
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### With Interpolation Server
```
🎬 Forcefield Development Environment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 Stopping any running dev servers...
✅ All dev processes stopped

🎬 Starting interpolation server...
📦 Installing server dependencies...
✅ Server dependencies installed
✅ Interpolation server started (PID: 12345)
   📍 http://localhost:3001
   📝 Logs: /tmp/interpolate-server.log

📦 Preparing FFmpeg files...
✅ FFmpeg files ready

🚀 Starting development server...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Frontend available at:
   http://localhost:5174

📍 Interpolation server available at:
   http://localhost:3001

💡 Tip: Video smoothing requires FFmpeg to be installed
   Install: brew install ffmpeg (macOS) or apt-get install ffmpeg (Ubuntu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Technical Details

### Process Management
- Interpolation server runs in background
- Dev server runs in foreground (visible in terminal)
- Both can be stopped together with Ctrl+C

### Port Allocation
- **5174**: Vite dev server (frontend)
- **3001**: Express interpolation server (backend)

### Logging
- Dev server: Output in terminal
- Interpolation server: `/tmp/interpolate-server.log`

### Dependencies
- Automatically installs server dependencies on first run
- Uses `npm install` in `server/` directory

## Troubleshooting

### Port Already in Use
The script automatically kills old processes, but if it fails:
```bash
lsof -i :5174    # Check port 5174
lsof -i :3001    # Check port 3001
kill -9 <PID>    # Kill the process
```

### FFmpeg Not Found
If you see this error:
```bash
brew install ffmpeg      # macOS
sudo apt-get install ffmpeg  # Ubuntu
```

### Server Failed to Start
Check the logs:
```bash
cat /tmp/interpolate-server.log
```

## Next Steps

1. **Try it out**:
   ```bash
   cd scripts
   ./dev_restart.sh --with-interpolate
   ```

2. **Watch the output** - You'll see both servers starting

3. **Test the feature**:
   - Record an animation
   - Click "Smooth Video"
   - Watch it process!

## File Updated

- ✅ `scripts/dev_restart.sh` - Complete rewrite with new features
- ✅ `scripts/DEV_RESTART_GUIDE.md` - Comprehensive usage guide (this file)

Both files are ready to use!

---

**Status**: ✅ Complete and ready to use

**Usage**: `./scripts/dev_restart.sh --with-interpolate`

🚀 Ship it!
