# Video Smoothing Guide

This guide explains how to use the "Smooth Video" feature to interpolate and smooth your Forcefield animation recordings.

## Overview

The smooth video feature uses FFmpeg's advanced interpolation algorithms to increase the frame rate of your recordings from the native recording FPS to 60 FPS, making animations appear smoother and more professional.

## Prerequisites

You need to have **FFmpeg** installed on your system.

### Installation

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html or use:
```bash
choco install ffmpeg
```

## Using the Smooth Video Feature

### Step 1: Start the Interpolation Server

In a terminal, navigate to your Forcefield project and run:

```bash
npm run start-interpolate-server
```

This will:
- Install server dependencies (express, cors, multer)
- Start the FFmpeg interpolation server on `localhost:3001`
- Display a confirmation message: "FFmpeg Interpolation Server running on http://localhost:3001"

**Keep this terminal window open while using the smooth video feature.**

### Step 2: Record Your Animation

1. In the Forcefield app, configure your animation settings
2. Click **"Start Recording"** to begin capturing
3. Wait for your animation to complete
4. Click **"Stop Recording"** to finish

### Step 3: Download Raw WebM

1. Click **"Download WebM"** to save your raw recording
2. This is your original, uninterpolated video

### Step 4: Smooth the Video

1. Ensure the interpolation server is running (from Step 1)
2. Click **"Smooth Video"** button
3. You'll see a progress indicator (0-100%)
4. Once complete, your smoothed video will automatically download

The smoothed video will be saved as `forcefield-smooth-TIMESTAMP.webm` with 60 FPS interpolation.

## How It Works

### Recording
- Browser captures animation at variable FPS (depends on system performance)
- Video is saved as WebM format
- Uses VP8/VP9 codec for compatibility

### Interpolation
- Server receives the WebM file
- FFmpeg analyzes frame-to-frame motion
- Minterpolate filter generates intermediate frames
- Output is upsampled to 60 FPS with smooth transitions
- New smoothed video is returned to browser

### Quality Settings
- Target FPS: 60 (adjustable)
- Video codec: libvpx-vp9 (VP9)
- Quality: CRF 32 (balanced quality/size)

## Troubleshooting

### "Interpolation server is not available"
- Ensure FFmpeg is installed: `ffmpeg -version`
- Ensure server is running: `npm run start-interpolate-server`
- Check that port 3001 is not in use
- Look for error messages in server terminal

### "FFmpeg not found"
- Install FFmpeg using the instructions above
- Verify installation: `ffmpeg -version`
- Try restarting the server

### Video takes too long to process
- This is normal for large/long videos
- Interpolation is computationally intensive
- Progress indicator shows the processing status
- Don't close the browser or server during processing

### Server crashes or video fails to interpolate
- Check server terminal for error messages
- Ensure your recording is in valid WebM format
- Try recording again
- Restart the server: Stop current server and run `npm run start-interpolate-server` again

## Advanced Usage

### Running Server with Auto-Restart (Development)
```bash
npm run dev-interpolate-server
```

This uses nodemon to auto-restart the server when code changes.

### Manual FFmpeg Command
If you prefer to interpolate videos manually:

```bash
ffmpeg -i input.webm -vf "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bilinear" output.webm
```

### Adjusting Quality
Edit `server/interpolate-server.js` to change:
- `-crf 32`: Lower values = better quality (0-51), higher = smaller file
- Change `minterpolate=fps=60` to different target FPS

## Performance Tips

1. **Shorter Animations**: Interpolating long videos takes more time and CPU
2. **Keep System Resources**: Close other applications while interpolating
3. **SSD vs HDD**: Faster drives = faster processing
4. **FFmpeg Build**: Consider installing a hardware-accelerated FFmpeg build for faster processing

## File Locations

- **Server Code**: `/server/interpolate-server.js`
- **Client Service**: `/src/lib/interpolationService.ts`
- **Temporary Files**: `/temp-uploads/` (auto-cleaned)
- **Downloaded Videos**: Your Downloads folder

## Limitations

- Maximum file size: 500 MB per video
- Processing time varies based on video length and system performance
- Interpolation quality depends on motion analysis (works best with smooth, continuous motion)
- Server must be running on the same machine or accessible network

## Next Steps

1. Install FFmpeg
2. Start the server
3. Record your animation
4. Click "Smooth Video"
5. Enjoy smooth 60 FPS output!

---

For more information, see the main [README.md](./README.md)
