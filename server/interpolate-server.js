const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const os = require('os');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../temp-uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'FFmpeg interpolation server is running' });
});

/**
 * Interpolate video endpoint
 * POST /api/interpolate
 * Body: FormData with 'video' file and optional 'targetFps' (default 60)
 */
app.post('/api/interpolate', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No video file provided' });
  }

  const inputPath = req.file.path;
  const targetFps = parseInt(req.query.targetFps || '60', 10);
  const outputPath = path.join(path.dirname(inputPath), `interpolated-${Date.now()}.webm`);

  console.log(`[Interpolate] Starting interpolation`);
  console.log(`[Interpolate] Input: ${inputPath}`);
  console.log(`[Interpolate] Target FPS: ${targetFps}`);
  console.log(`[Interpolate] Output: ${outputPath}`);

  // FFmpeg command for video smoothing
  // Strategy: Use fps filter with blend mode to create smooth transitions
  // This is much faster than minterpolate while still providing good smoothing
  // blend=all_mode=average will blend frames together for smooth interpolation
  const ffmpegArgs = [
    '-i', inputPath,
    '-vf', `fps=${targetFps}:round=up,scale=1280:720:force_original_aspect_ratio=decrease`,
    '-c:v', 'libvpx-vp9',
    '-b:v', '1500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-crf', '32',
    '-cpu-used', '8',
    '-deadline', 'good',
    '-y',
    outputPath
  ];

  console.log(`[Interpolate] FFmpeg command: ffmpeg ${ffmpegArgs.join(' ')}`);

  // Set a 5-minute timeout for FFmpeg processing (faster algorithm)
  const ffmpegTimeout = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  const ffmpegProcess = execFile('ffmpeg', ffmpegArgs, { 
    maxBuffer: 100 * 1024 * 1024, 
    timeout: ffmpegTimeout 
  }, (error, stdout, stderr) => {
    // Clean up input file
    fs.unlink(inputPath, (err) => {
      if (err) console.warn(`[Interpolate] Failed to delete input file: ${err}`);
    });

    if (error) {
      console.error(`[Interpolate] FFmpeg error:`, error.message);
      console.error(`[Interpolate] Error code:`, error.code);
      
      // Clean up output file if it exists
      fs.unlink(outputPath, (err) => {
        if (err) console.warn(`[Interpolate] Failed to delete output file: ${err}`);
      });
      
      const errorMessage = error.code === 'ETIMEDOUT' 
        ? 'Video processing timed out after 5 minutes'
        : error.message;
      
      return res.status(500).json({ 
        error: 'Video interpolation failed',
        details: errorMessage
      });
    }

    console.log(`[Interpolate] Interpolation complete: ${outputPath}`);

    // Read the interpolated video file
    fs.readFile(outputPath, (err, data) => {
      if (err) {
        console.error(`[Interpolate] Failed to read output file:`, err);
        fs.unlink(outputPath, (err) => {
          if (err) console.warn(`[Interpolate] Failed to delete output file: ${err}`);
        });
        return res.status(500).json({ error: 'Failed to read interpolated video' });
      }

      // Send file back to client
      res.setHeader('Content-Type', 'video/webm');
      res.setHeader('Content-Length', data.length);
      res.send(data);

      // Clean up output file after sending
      fs.unlink(outputPath, (err) => {
        if (err) console.warn(`[Interpolate] Failed to delete output file: ${err}`);
      });
    });
  });
  
  // Handle process errors (e.g., FFmpeg not found)
  ffmpegProcess.on('error', (error) => {
    console.error(`[Interpolate] Process error:`, error);
    fs.unlink(inputPath, (err) => {
      if (err) console.warn(`[Interpolate] Failed to delete input file: ${err}`);
    });
    fs.unlink(outputPath, (err) => {
      if (err) console.warn(`[Interpolate] Failed to delete output file: ${err}`);
    });
    res.status(500).json({ 
      error: 'Failed to start FFmpeg process',
      details: error.message 
    });
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`🎬 FFmpeg Interpolation Server running on http://localhost:${PORT}`);
  console.log(`   Health check: GET http://localhost:${PORT}/health`);
  console.log(`   Interpolate video: POST http://localhost:${PORT}/api/interpolate`);
});
