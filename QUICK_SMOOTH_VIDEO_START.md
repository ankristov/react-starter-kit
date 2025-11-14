# 🎬 Smooth Video Feature - Complete Setup Guide

## What's New

Your Forcefield app now has a **one-click video smoothing feature** that converts your recorded animations to smooth 60 FPS videos using FFmpeg interpolation.

## Quick Setup (5 minutes)

### 1. Install FFmpeg (One-Time)

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
```bash
choco install ffmpeg
```

Or download from: https://ffmpeg.org/download.html

Verify:
```bash
ffmpeg -version
```

### 2. Start the Smooth Video Server

In a **separate terminal** from your dev server, run:
```bash
npm run start-interpolate-server
```

You should see:
```
🎬 FFmpeg Interpolation Server running on http://localhost:3001
   Health check: GET http://localhost:3001/health
   Interpolate video: POST http://localhost:3001/api/interpolate
```

**Keep this terminal open** while using the app. The server processes all video smoothing requests.

### 3. Use the Feature

In your Forcefield app:

1. **Record Animation**
   - Click "Start Recording"
   - Let your animation play
   - Click "Stop Recording"

2. **Download Options**
   - **"Download WebM"**: Save your raw recording (uninterpolated)
   - **"Smooth Video"**: Interpolate to 60 FPS (requires server running)

3. **Wait for Processing**
   - Progress bar shows 0-100%
   - Smoothed video downloads automatically
   - Takes 10-60 seconds depending on video length

## File Structure

```
project/
├── server/                          ← Interpolation server
│   ├── interpolate-server.js       ← FFmpeg backend
│   ├── package.json                ← Dependencies
│   └── start-server.sh             ← Startup script
│
├── src/
│   ├── components/
│   │   └── ControlPanel.tsx        ← Updated with smooth button
│   └── lib/
│       └── interpolationService.ts ← Client-side service
│
├── SMOOTH_VIDEO_GUIDE.md           ← Full documentation
├── SMOOTH_VIDEO_IMPLEMENTATION.md  ← Technical details
└── package.json                    ← Updated with npm scripts
```

## Commands

```bash
# Start the app (dev server)
npm run dev

# Build for production
npm run build

# Start interpolation server (in separate terminal)
npm run start-interpolate-server

# Dev mode with auto-restart (development only)
npm run dev-interpolate-server
```

## How It Works

```
Your Browser
    ↓
[Record Animation]
    ↓
[Save as WebM]
    ↓
[Click "Smooth Video"]
    ↓
    └─→ Send to Server on localhost:3001
        ↓
        [FFmpeg Interpolates]
        ├─ Analyzes motion between frames
        ├─ Generates new intermediate frames
        └─ Output: 60 FPS smoothed video
        ↓
        [Return smoothed WebM]
    ↓
[Auto-download smoothed video]
```

## Key Features

✅ **One-Click Smoothing** - Just click the button  
✅ **Progress Tracking** - See real-time percentage  
✅ **Auto-Download** - Result downloads automatically  
✅ **Error Handling** - Clear error messages if something fails  
✅ **Server Health Check** - Automatically detects if server is available  
✅ **Fast Processing** - 10-60 seconds typical  

## Troubleshooting

### "Interpolation server is not available"
```bash
# Make sure server is running
npm run start-interpolate-server

# In the app, click "Smooth Video" again
```

### "FFmpeg not found"
```bash
# Install it
brew install ffmpeg    # macOS
sudo apt-get install ffmpeg  # Ubuntu

# Verify
ffmpeg -version

# Restart the server
npm run start-interpolate-server
```

### Video takes forever / hangs
- This is normal for long/large videos
- Check your system's CPU usage
- Close other applications
- Try a shorter recording
- Check server terminal for errors

### Can't see "Smooth Video" button
- Make sure you're using the ControlPanel component
- Refresh the browser
- Check browser console for errors

## Advanced

### Change Target FPS
Edit `server/interpolate-server.js`:
```javascript
const targetFps = parseInt(req.query.targetFps || '60', 10);  // Change 60 to desired FPS
```

### Change Video Quality
Edit `server/interpolate-server.js`:
```javascript
'-crf', '32',  // Lower = better (0-51), higher = smaller file
```

### Manual FFmpeg Command
If you don't want to use the server:
```bash
ffmpeg -i recording.webm -vf "minterpolate=fps=60" smooth-recording.webm
```

## Requirements

- **FFmpeg** - Must be installed and in system PATH
- **Node.js** - v14+ (for running server)
- **Modern Browser** - Chrome, Firefox, Safari, Edge
- **Disk Space** - For temp files during processing (~2x video size)

## Performance Tips

1. **Keep videos short** - Shorter = faster (< 2 minutes recommended)
2. **Close other apps** - FFmpeg is CPU-intensive
3. **Use SSD** - Faster file I/O
4. **Monitor resources** - Check if CPU is maxed out

## Ports

- **Frontend (Vite)**: 5174-5175
- **Interpolation Server**: 3001

If these ports are in use, you'll get an error. You can:
1. Close the application using the port
2. Change the port in the configuration files
3. Use a different machine

## Security Notes

- Server only listens on `localhost:3001` (not accessible from network by default)
- No authentication required (local use only)
- Video files are deleted after processing
- For production/network use, add authentication and HTTPS

## Support

If something doesn't work:

1. **Check server is running**
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"ok","message":"..."}
   ```

2. **Check FFmpeg is installed**
   ```bash
   ffmpeg -version
   ```

3. **Look at server terminal** for error messages

4. **Check browser console** (F12 → Console tab) for errors

5. **Restart both servers**
   - Stop dev server (Ctrl+C)
   - Stop interpolation server (Ctrl+C)
   - Start both again

## Next Steps

1. ✅ Install FFmpeg
2. ✅ Run `npm run start-interpolate-server`
3. ✅ Start recording animations
4. ✅ Click "Smooth Video"
5. 🎉 Enjoy smooth 60 FPS videos!

---

For detailed technical documentation, see:
- **User Guide**: `SMOOTH_VIDEO_GUIDE.md`
- **Implementation Details**: `SMOOTH_VIDEO_IMPLEMENTATION.md`
- **Main README**: `README.md`

Happy recording! 🎬
