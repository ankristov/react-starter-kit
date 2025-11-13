import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let isLoaded = false;

async function loadFFmpeg(onProgress?: (progress: number, message: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();
  ffmpegInstance = ffmpeg;

  try {
    onProgress?.(10, 'Downloading FFmpeg core files...');
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    onProgress?.(20, 'Loading FFmpeg JavaScript...');
    const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
    
    onProgress?.(50, 'Loading FFmpeg WASM...');
    const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
    
    onProgress?.(80, 'Initializing FFmpeg...');
    await ffmpeg.load({
      coreURL,
      wasmURL,
    });
    
    isLoaded = true;
    onProgress?.(100, 'FFmpeg ready!');
    return ffmpeg;
  } catch (error) {
    console.error('Failed to load FFmpeg:', error);
    throw error;
  }
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  try {
    onProgress?.(0, 'Loading FFmpeg...');
    const ffmpeg = await loadFFmpeg(onProgress);
    
    // Write WebM file to FFmpeg's virtual file system
    onProgress?.(30, 'Preparing video file...');
    const inputFileName = 'input.webm';
    const outputFileName = 'output.mp4';
    
    await ffmpeg.writeFile(inputFileName, await fetchFile(webmBlob));
    
    // Set up progress tracking
    let lastProgress = 30;
    let conversionStartTime: number | null = null;
    
    // Listen to FFmpeg logs for progress
    ffmpeg.on('log', ({ message, type }) => {
      // Parse FFmpeg progress messages
      if (message.includes('time=')) {
        if (!conversionStartTime) {
          conversionStartTime = Date.now();
        }
        // Extract time from message like "time=00:00:01.23"
        const timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const hours = parseFloat(timeMatch[1]);
          const minutes = parseFloat(timeMatch[2]);
          const seconds = parseFloat(timeMatch[3]);
          const totalSeconds = hours * 3600 + minutes * 60 + seconds;
          
          // Try to get duration from the blob if possible, otherwise estimate
          // For now, we'll use a simple progress indicator
          const estimatedProgress = Math.min(90, 30 + (totalSeconds * 5)); // Rough estimate
          if (estimatedProgress > lastProgress + 5) { // Update every 5%
            lastProgress = estimatedProgress;
            onProgress?.(estimatedProgress, `Converting... ${Math.round(estimatedProgress)}%`);
          }
        }
      }
    });
    
    // Convert WebM to MP4 with progress reporting
    onProgress?.(40, 'Starting conversion...');
    await ffmpeg.exec([
      '-i', inputFileName,
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Changed from 'fast' to 'ultrafast' for speed
      '-crf', '23',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-progress', 'pipe:1', // Enable progress output
      outputFileName
    ]);
    
    // Read the output file
    onProgress?.(95, 'Finalizing...');
    const data = await ffmpeg.readFile(outputFileName);
    
    // Clean up
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);
    
    onProgress?.(100, 'Conversion complete!');
    return new Blob([data], { type: 'video/mp4' });
  } catch (error) {
    console.error('Failed to convert WebM to MP4:', error);
    throw error;
  }
}

