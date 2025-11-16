/**
 * Video Interpolation Service
 * Communicates with Node.js FFmpeg backend to smooth videos
 */

const INTERPOLATION_SERVER = 'http://localhost:3002';

export interface InterpolationOptions {
  targetFps?: number;
  onProgress?: (progress: number, message: string) => void;
}

/**
 * Check if interpolation server is available
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${INTERPOLATION_SERVER}/health`, {
      method: 'GET',
      mode: 'cors',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('[InterpolationService] Server not available:', error);
    return false;
  }
}

/**
 * Interpolate a video file to smooth it
 * @param videoBlob - The WebM video blob to interpolate
 * @param options - Interpolation options (targetFps, onProgress callback)
 * @returns Promise<Blob> - The interpolated video blob
 */
export async function interpolateVideo(
  videoBlob: Blob,
  options: InterpolationOptions = {}
): Promise<Blob> {
  const { targetFps = 60, onProgress } = options;

  try {
    console.log('[InterpolationService] Starting video interpolation', {
      videoSize: videoBlob.size,
      videoType: videoBlob.type,
      targetFps
    });
    
    onProgress?.(10, 'Preparing video...');

    // Create FormData with the video file
    const formData = new FormData();
    formData.append('video', videoBlob, 'video.webm');

    console.log('[InterpolationService] Sending video to server:', INTERPOLATION_SERVER);
    onProgress?.(20, 'Sending video to server...');

    // Send to interpolation server with a 5-minute timeout for the entire operation
    // (upload + FFmpeg processing + download)
    const controller = new AbortController();
    const timeout = 5 * 60 * 1000; // 5 minutes
    const timeoutId = setTimeout(() => {
      console.error('[InterpolationService] Request timeout after', timeout, 'ms');
      controller.abort();
    }, timeout);
    
    const startTime = Date.now();
    let response;
    
    try {
      response = await fetch(
        `${INTERPOLATION_SERVER}/api/interpolate?targetFps=${targetFps}`,
        {
          method: 'POST',
          body: formData,
          mode: 'cors',
          signal: controller.signal,
        }
      );
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if ((fetchError as Error).name === 'AbortError') {
        throw new Error(`Request timeout: Video processing took longer than ${timeout / 1000} seconds`);
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);
    console.log('[InterpolationService] Server response status:', response.status);

    if (!response.ok) {
      let errorMessage = `Server error: ${response.statusText}`;
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
      } catch (parseError) {
        console.warn('[InterpolationService] Could not parse error response:', parseError);
      }
      
      throw new Error(errorMessage);
    }

    console.log('[InterpolationService] Processing response blob...');
    onProgress?.(80, 'Processing complete, preparing download...');

    // Get the interpolated video blob
    const interpolatedBlob = await response.blob();
    const processingTime = Date.now() - startTime;

    console.log('[InterpolationService] Interpolation complete', {
      processingTime: `${processingTime}ms`,
      outputSize: interpolatedBlob.size,
      outputType: interpolatedBlob.type
    });
    
    onProgress?.(100, 'Interpolation complete!');

    return interpolatedBlob;
  } catch (error) {
    console.error('[InterpolationService] Interpolation failed:', error);
    throw error;
  }
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
