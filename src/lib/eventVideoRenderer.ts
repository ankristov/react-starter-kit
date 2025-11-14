import type { AnimationRecording } from '../types/animationEvents';
import { AnimationReplay } from './eventReplay';

export interface RenderOptionsFromEvents {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  onProgress?: (progress: number, message: string) => void;
  abortSignal?: AbortSignal;
}

/**
 * Renders smooth video from recorded animation events using visible canvas
 * Re-runs physics simulation with recorded events for perfect visual match
 */
export async function renderVideoFromEventsVisible(
  recording: AnimationRecording,
  options: RenderOptionsFromEvents
): Promise<Blob> {
  const { width, height, fps, backgroundColor, onProgress, abortSignal } = options;

  onProgress?.(0, 'Initializing replay...');

  const replay = new AnimationReplay(recording);
  const duration = Math.max(recording.duration, 1000); // Use actual recording duration, minimum 1 second
  const frameDuration = 1000 / fps; // milliseconds per frame
  const totalFrames = Math.ceil(duration / frameDuration);

  console.log(`[VideoRenderer] Recording duration: ${duration.toFixed(0)}ms, Total frames: ${totalFrames} at ${fps} FPS`);
  onProgress?.(5, `Rendering ${totalFrames} frames at ${fps} FPS...`);

  // Create visible canvas for captureStream
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    document.body.removeChild(canvas);
    throw new Error('Failed to get canvas context');
  }

  try {
    // Determine best mime type
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

    // Calculate bitrate based on dimensions
    const pixels = width * height;
    const bitrate = Math.min(50_000_000, Math.max(2_000_000, Math.floor(pixels * fps * 0.1)));

    // Use captureStream with specific fps
    const stream = canvas.captureStream(fps);
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
        mediaRecorder.stop();
        reject(new Error('Render aborted'));
        document.body.removeChild(canvas);
        return;
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: mimeType });
        onProgress?.(100, 'Render complete!');
        document.body.removeChild(canvas);
        resolve(blob);
      };

      mediaRecorder.onerror = (e) => {
        document.body.removeChild(canvas);
        reject(new Error('MediaRecorder error: ' + e.error));
      };

      mediaRecorder.start(100); // Request data every 100ms
      let frameIndex = 0;

      // Use synchronous frame rendering loop for consistent timing
      const renderAllFrames = async () => {
        try {
          for (frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            if (abortSignal?.aborted) {
              mediaRecorder.stop();
              return;
            }

            // Calculate exact time for this frame
            const currentTime = frameIndex * frameDuration;
            
            // Advance replay to exact frame time with sub-frame physics updates
            replay.advanceTo(currentTime);

            // Clear canvas and render background
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);
            
            // Draw replay state
            replay.drawTo(ctx, backgroundColor);

            // Update progress with actual frame count
            const progress = 5 + (frameIndex / totalFrames) * 90;
            onProgress?.(Math.min(95, progress), `Frame ${frameIndex + 1}/${totalFrames}`);

            // Allow browser to process every 30 frames
            if (frameIndex % 30 === 0) {
              await new Promise(resolve => setTimeout(resolve, 0));
            }

            // Allow browser to process
            await new Promise(resolve => setTimeout(resolve, 0));
          }

          mediaRecorder.stop();
        } catch (error) {
          mediaRecorder.stop();
          reject(error);
        }
      };

      renderAllFrames();
    });
  } catch (error) {
    document.body.removeChild(canvas);
    throw error;
  }
}

