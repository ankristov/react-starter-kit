export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function resizeImage(image: HTMLImageElement, maxWidth: number, maxHeight: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  const { width, height } = image;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  
  canvas.width = width * scale;
  canvas.height = height * scale;
  
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function getImageData(image: HTMLImageElement, maxWidth?: number, maxHeight?: number): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  if (maxWidth && maxHeight) {
    const resizedCanvas = resizeImage(image, maxWidth, maxHeight);
    canvas.width = resizedCanvas.width;
    canvas.height = resizedCanvas.height;
    ctx.drawImage(resizedCanvas, 0, 0);
  } else {
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
  }
  
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function createDefaultImage(width: number = 800, height: number = 600): ImageData {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  canvas.width = width;
  canvas.height = height;
  
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
    console.log('Starting fileToImageData for:', file.name);
    
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            console.log('Image loaded, dimensions:', img.width, 'x', img.height);
            // Use larger max dimensions to preserve image quality, but limit to reasonable size for performance
            const maxDimension = 2000; // Increased from 800x600 to allow higher quality images
            const imageData = getImageData(img, maxDimension, maxDimension);
            console.log('ImageData created:', imageData.width, 'x', imageData.height);
            resolve(imageData);
          } catch (error) {
            console.error('Error creating ImageData:', error);
            reject(error);
          }
        };
        img.onerror = (error) => {
          console.error('Error loading image:', error);
          reject(new Error('Failed to load image'));
        };
        img.src = e.target?.result as string;
      } catch (error) {
        console.error('Error in fileToImageData:', error);
        reject(error);
      }
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string = 'image/png'): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, mimeType);
  });
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL();
  link.click();
} 