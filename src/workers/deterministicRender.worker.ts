/**
 * Deterministic Render Worker
 * Runs particle engine offline without delays to produce smooth video
 * 
 * This worker receives a recording (inputs + settings) and replays it
 * Produces canvas frames at full speed without UI blocking
 */

import { ParticleEngine } from '../lib/particleEngine';
import type { AnimationRecording } from '../lib/deterministicRender';

console.log('[Worker] Initializing deterministic render worker');

interface WorkerMessage {
  type: 'render';
  recording: AnimationRecording;
}

interface ProgressMessage {
  type: 'progress';
  frame: number;
  totalFrames: number;
  percentage: number;
}

interface FrameMessage {
  type: 'frame';
  frameNumber: number;
  imageData: ImageData;
}

interface CompleteMessage {
  type: 'complete';
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

/**
 * Worker-safe version to decode data URL to ImageData
 * This avoids using Image which isn't available in workers
 */
async function dataUrlToImageDataWorker(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    try {
      // Extract base64 data from data URL
      const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Create a blob and use canvas to decode
      const blob = new Blob([bytes], { type: `image/${mimeType}` });
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          // We can't use Image in worker, so we use OffscreenCanvas
          // Create a bitmap from the blob
          const imageBitmap = await createImageBitmap(blob);
          
          // Draw to offscreen canvas to get ImageData
          const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
          const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
          if (!ctx) throw new Error('Failed to get canvas context');
          
          ctx.drawImage(imageBitmap, 0, 0);
          const imageData = ctx.getImageData(0, 0, imageBitmap.width, imageBitmap.height);
          resolve(imageData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read blob'));
      reader.readAsArrayBuffer(blob);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Main rendering function
 */
async function renderRecording(recording: AnimationRecording): Promise<void> {
  console.log('[Worker:render] Starting render with recording:', {
    duration: recording.duration,
    fps: recording.fps,
    inputCount: recording.inputs.length,
    width: recording.width,
    height: recording.height,
  });
  
  try {
    // Decode image data using worker-safe method
    console.log('[Worker:render] Decoding image data...');
    const imageData = await dataUrlToImageDataWorker(recording.imageData);
    console.log('[Worker:render] Image decoded:', { width: imageData.width, height: imageData.height });
    
    // Initialize particle engine with exact initial settings
    console.log('[Worker:render] Creating particle engine...');
    const engine = new ParticleEngine(recording.initialSettings);
    engine.setCanvasSize(recording.width, recording.height);
    
    // Generate particles from image using correct mode based on animation settings
    console.log('[Worker:render] Generating particles with animationMode:', recording.initialSettings.animationMode);
    
    if (recording.initialSettings.animationMode === 'imageCrops') {
      const gridSize = recording.initialSettings.imageCropGridSize || 16;
      console.log('[Worker:render] Using imageCrops mode with gridSize:', gridSize);
      engine.generateParticlesFromImageTiles(imageData, gridSize);
    } else {
      console.log('[Worker:render] Using standard image mode');
      engine.generateParticlesFromImage(imageData);
    }
    console.log('[Worker:render] Particles generated');
    
    // Calculate frame timing
    const frameInterval = 1000 / recording.fps;
    const totalFrames = Math.ceil(recording.duration / frameInterval);
    
    console.log('[Worker:render] Frame timing:', { frameInterval, totalFrames, duration: recording.duration });
    
    // Create offscreen canvas for rendering
    console.log('[Worker:render] Creating offscreen canvas...');
    const canvas = new OffscreenCanvas(recording.width, recording.height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    console.log('[Worker:render] Canvas context created, starting frame loop...');
    
    // Apply recorded inputs and render each frame
    let inputIndex = 0;
    const inputs = recording.inputs;
    let lastProgressReport = 0;
    
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame * frameInterval;
      
      // Apply any inputs scheduled for this frame
      while (inputIndex < inputs.length && inputs[inputIndex].timestamp <= time) {
        const input = inputs[inputIndex];
        console.log(`[Worker:render] Applying input at frame ${frame}, time ${time}ms`, input);
        
        if (input.pulse) {
          engine.enqueuePulse(input.pulse);
        }
        
        if (input.settingsChange) {
          engine.updateSettings(input.settingsChange);
        }
        
        inputIndex++;
      }
      
      // Update particle physics
      engine.updateParticles();
      
      // Clear canvas
      ctx.fillStyle = recording.initialSettings.canvasBackgroundColor || '#0f0f23';
      ctx.fillRect(0, 0, recording.width, recording.height);
      
      // Render particles
      engine.drawParticles(ctx as any);
      
      // Send frame to main thread
      const frameImageData = ctx.getImageData(0, 0, recording.width, recording.height);
      const message: FrameMessage = {
        type: 'frame',
        frameNumber: frame,
        imageData: frameImageData,
      };
      postMessage(message, { transfer: [frameImageData.data.buffer] });
      
      // Send progress at reasonable intervals (every 10%)
      const progressPercent = Math.round((frame / totalFrames) * 100);
      if (progressPercent >= lastProgressReport + 10 || frame === 0 || frame === totalFrames - 1) {
        const progress: ProgressMessage = {
          type: 'progress',
          frame,
          totalFrames,
          percentage: progressPercent,
        };
        console.log(`[Worker:render] Progress: ${progressPercent}% (${frame}/${totalFrames})`);
        postMessage(progress);
        lastProgressReport = progressPercent;
      }
    }
    
    // Signal completion
    console.log('[Worker:render] Rendering complete, sending complete message');
    const complete: CompleteMessage = { type: 'complete' };
    postMessage(complete);
    
  } catch (error) {
    console.error('[Worker:render] Error during rendering:', error);
    const errorMsg: ErrorMessage = {
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
    postMessage(errorMsg);
  }
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  console.log('[Worker:onmessage] Received message:', event.data.type);
  if (event.data.type === 'render') {
    console.log('[Worker:onmessage] Starting renderRecording');
    renderRecording(event.data.recording).catch(err => {
      console.error('[Worker:onmessage] Unhandled error in renderRecording:', err);
      postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    });
  } else {
    console.warn('[Worker:onmessage] Unknown message type:', event.data.type);
  }
};
