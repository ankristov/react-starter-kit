import { useCallback } from 'react';
import { useForceFieldStore } from '../lib/forceFieldStore';
import { fileToImageData } from '../lib/imageUtils';

export function useImageUpload() {
  const { loadImage } = useForceFieldStore();

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const imageData = await fileToImageData(file);
      loadImage(imageData);
    } catch (error) {
      console.error('Error loading image:', error);
      // You could add toast notification here
    }
  }, [loadImage]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    }
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return {
    handleFileUpload,
    handleDrop,
    handleDragOver
  };
} 