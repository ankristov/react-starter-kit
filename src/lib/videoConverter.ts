// ============================================
// WebM-Only Output Mode
// FFmpeg is completely disabled - all functions
// return WebM blobs directly
// ============================================

export function preloadFFmpeg(onProgress?: (progress: number, message: string) => void): void {
  console.log('🎬 [WebM Mode] Preload called - skipping FFmpeg');
  if (onProgress) {
    onProgress(100, 'WebM Direct Mode Active');
  }
}

export function getFFmpegStatus(): { status: 'idle' | 'loading' | 'loaded' | 'error'; error: Error | null } {
  console.log('🎬 [WebM Mode] Status check');
  return { status: 'idle', error: null };
}

export async function convertWebmToMp4(
  webmBlob: Blob,
  onProgress?: (progress: number, message: string) => void
): Promise<Blob> {
  console.log('🎬 [WebM Mode] Converting (direct pass-through)');
  if (onProgress) {
    onProgress(50, 'Processing video...');
    setTimeout(() => {
      if (onProgress) onProgress(100, 'Video ready');
    }, 100);
  }
  return webmBlob;
}

