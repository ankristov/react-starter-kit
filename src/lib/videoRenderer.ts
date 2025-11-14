import type { RecordedFrame } from '../types/particle';

export interface RenderOptions {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  backgroundColor: string;
  onProgress?: (progress: number, message: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * Renders a smooth video from recorded particle states
 */
export async function renderVideoFromStates(
  frames: RecordedFrame[],
  options: RenderOptions
): Promise<Blob> {
  const { width, height, fps, durationSec, backgroundColor, onProgress, abortSignal } = options;
  
  if (!frames || frames.length === 0) {
    throw new Error('No recorded frames available');
  }

  onProgress?.(0, 'Initializing render...');

  // Create offscreen canvas for rendering
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate total frames needed
  const totalFrames = Math.floor(fps * durationSec);
  const frameInterval = 1000 / fps; // ms per frame
  const totalDurationMs = durationSec * 1000;

  onProgress?.(5, `Rendering ${totalFrames} frames at ${fps} FPS...`);

  // Set up MediaRecorder
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
    ? 'video/webm;codecs=vp8'
    : 'video/webm';
  
  const pixels = width * height;
  const bitrate = Math.min(50_000_000, Math.max(2_000_000, Math.floor(pixels * fps * 0.1)));
  
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });

  const recordedChunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) {
      reject(new Error('Render aborted'));
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      onProgress?.(100, 'Render complete!');
      resolve(blob);
    };

    mediaRecorder.onerror = (e) => {
      reject(new Error('MediaRecorder error'));
    };

    mediaRecorder.start(100); // Request data every 100ms

    // Pre-process: adjust frame timestamps to start from 0
    // The recorded frames have timestamps relative to when recording started
    // We need to map them to output timeline starting at 0
    const recordingStartTime = frames[0]?.timestamp || 0;
    const adjustedFrames = frames.map(frame => ({
      ...frame,
      timestamp: frame.timestamp - recordingStartTime
    }));

    // Build a simple lookup index for faster frame finding
    const frameCount = adjustedFrames.length;

    // Render frames
    let frameIndex = 0;

    const renderFrame = () => {
      if (abortSignal?.aborted) {
        mediaRecorder.stop();
        reject(new Error('Render aborted'));
        return;
      }

      if (frameIndex >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const targetTime = frameIndex * frameInterval; // ms from output start
      
      // Find the appropriate frame(s) to render using binary search for efficiency
      let frame1: RecordedFrame | null = null;
      let frame2: RecordedFrame | null = null;
      let t = 0; // interpolation factor (0-1)

      // Binary search to find the frame index
      let left = 0, right = frameCount - 1;
      while (left < right) {
        const mid = Math.floor((left + right + 1) / 2);
        if (adjustedFrames[mid].timestamp <= targetTime) {
          left = mid;
        } else {
          right = mid - 1;
        }
      }

      // Get frame1 and frame2 for interpolation
      frame1 = adjustedFrames[left];
      if (left < frameCount - 1 && adjustedFrames[left].timestamp < targetTime) {
        frame2 = adjustedFrames[left + 1];
        const timeDiff = frame2.timestamp - frame1.timestamp;
        if (timeDiff > 0) {
          t = (targetTime - frame1.timestamp) / timeDiff;
        }
      }

      // Clear canvas
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      // Render particles
      if (frame1) {
        const particles = frame1.particles;
        const particleCount = particles.length;
        
        for (let i = 0; i < particleCount; i++) {
          const particle = particles[i];
          if (!particle.visible) continue;

          // Interpolate position if we have two frames
          let x = particle.x;
          let y = particle.y;
          
          if (frame2 && t > 0 && t < 1 && i < frame2.particles.length) {
            const p2 = frame2.particles[i];
            x = particle.x + (p2.x - particle.x) * t;
            y = particle.y + (p2.y - particle.y) * t;
          }

          ctx.fillStyle = particle.color;

          const size = particle.size;
          switch (particle.shape) {
            case 'circle':
              ctx.beginPath();
              ctx.arc(x, y, size / 2, 0, Math.PI * 2);
              ctx.fill();
              break;
            case 'square':
              ctx.fillRect(x - size / 2, y - size / 2, size, size);
              break;
            case 'triangle':
              ctx.beginPath();
              ctx.moveTo(x, y - size / 2);
              ctx.lineTo(x - size / 2, y + size / 2);
              ctx.lineTo(x + size / 2, y + size / 2);
              ctx.closePath();
              ctx.fill();
              break;
          }
        }
      }

      frameIndex++;
      const progress = Math.min(95, 5 + (frameIndex / totalFrames) * 90);
      onProgress?.(progress, `Rendering frame ${frameIndex} of ${totalFrames}...`);

      // Use synchronous loop with requestAnimationFrame for better timing
      requestAnimationFrame(renderFrame);
    };

    // Start rendering
    renderFrame();
  });
}

