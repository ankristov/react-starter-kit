export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function resizeImage(image: HTMLImageElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  let { width, height } = image;

  // Calculate new dimensions while maintaining aspect ratio
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  canvas.width = width;
  canvas.height = height;

  // Draw the resized image
  ctx.drawImage(image, 0, 0, width, height);

  return canvas;
}

export function getImageData(image: HTMLImageElement, maxWidth: number = 800, maxHeight: number = 600): ImageData {
  const canvas = resizeImage(image, maxWidth, maxHeight);
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function createDefaultImage(width: number = 800, height: number = 600): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Create a gradient background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f3460');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Add some geometric shapes
  ctx.fillStyle = '#e94560';
  ctx.beginPath();
  ctx.arc(width * 0.3, height * 0.3, 50, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#533483';
  ctx.beginPath();
  ctx.arc(width * 0.7, height * 0.7, 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#00d4ff';
  ctx.fillRect(width * 0.2, height * 0.6, 60, 60);

  return ctx.getImageData(0, 0, width, height);
}

export function fileToImageData(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const imageData = getImageData(img);
          resolve(imageData);
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, mimeType);
  });
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvasToBlob(canvas).then((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });
} 