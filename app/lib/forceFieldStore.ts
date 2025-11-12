import { create } from 'zustand';
import { ParticleSystem } from './particleEngine';
import type { ForceFieldSettings, MousePosition } from './particleEngine';
import { createDefaultImage } from './imageUtils';

interface ForceFieldState {
  // Core state
  particleSystem: ParticleSystem | null;
  canvasRef: React.RefObject<HTMLCanvasElement> | null;
  isAnimating: boolean;
  isRecording: boolean;
  currentImage: ImageData | null;
  
  // Settings
  settings: ForceFieldSettings;
  
  // Mouse state
  mousePosition: MousePosition;
  
  // UI state
  showControls: boolean;
  showInfo: boolean;
  // Color filter state
  colorFilter: {
    enabled: boolean;
    selectedColors: string[];
    mode: 'show' | 'hide';
  };
  
  // Actions
  initializeParticleSystem: () => void;
  setCanvasRef: (ref: React.RefObject<HTMLCanvasElement>) => void;
  updateSettings: (settings: Partial<ForceFieldSettings>) => void;
  setMousePosition: (x: number, y: number, active: boolean) => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  resetParticles: () => void;
  loadImage: (imageData: ImageData) => void;
  loadDefaultImage: () => void;
  toggleControls: () => void;
  toggleInfo: () => void;
  startRecording: () => void;
  stopRecording: () => void;
  takeScreenshot: () => void;
  // Color filter actions
  setColorFilterEnabled: (enabled: boolean) => void;
  toggleColor: (color: string) => void;
  setFilterMode: (mode: 'show' | 'hide') => void;
  applyFilterNow: () => void;
}

const defaultSettings: ForceFieldSettings = {
  particleDensity: 1000,
  healingFactor: 30,
  particleSize: 2,
  particleShape: 'circle',
  effectRadius: 100,
  forceStrength: 4,
  forceType: 'repulsion',
  pulseMode: false,
  repulsion: {
    strength: 4,
    radius: 100
  },
  attractor: {
    strength: 2,
    radius: 80
  },
  vortex: {
    strength: 3,
    radius: 120,
    direction: 'clockwise'
  },
  collider: {
    strength: 5,
    radius: 90
  }
};

export const useForceFieldStore = create<ForceFieldState>((set, get) => ({
  // Initial state
  particleSystem: null,
  canvasRef: null,
  isAnimating: false,
  isRecording: false,
  currentImage: null,
  settings: defaultSettings,
  mousePosition: { x: 0, y: 0, active: false },
  showControls: true,
  showInfo: false,
  colorFilter: { enabled: false, selectedColors: [], mode: 'show' },

  // Actions
  initializeParticleSystem: () => {
    const { settings } = get();
    const particleSystem = new ParticleSystem(settings);
    set({ particleSystem });
  },

  setCanvasRef: (ref) => {
    set({ canvasRef: ref });
  },

  updateSettings: (newSettings) => {
    const { settings, particleSystem } = get();
    const updatedSettings = { ...settings, ...newSettings };
    
    set({ settings: updatedSettings });
    
    if (particleSystem) {
      particleSystem.updateSettings(newSettings);
    }
  },

  setMousePosition: (x, y, active) => {
    const { particleSystem } = get();
    set({ mousePosition: { x, y, active } });
    
    if (particleSystem) {
      particleSystem.setMousePosition(x, y, active);
    }
  },

  startAnimation: () => {
    set({ isAnimating: true });
  },

  stopAnimation: () => {
    set({ isAnimating: false });
  },

  resetParticles: () => {
    const { particleSystem } = get();
    if (particleSystem) {
      particleSystem.resetParticles();
    }
  },

  loadImage: (imageData) => {
    const { particleSystem } = get();
    if (particleSystem) {
      particleSystem.generateParticlesFromImage(imageData);
      // Apply any active color filter after regeneration
      const { colorFilter } = get();
      particleSystem.applyColorFilter(colorFilter);
      set({ currentImage: imageData });
    }
  },

  loadDefaultImage: () => {
    const defaultImage = createDefaultImage();
    get().loadImage(defaultImage);
  },

  toggleControls: () => {
    const { showControls } = get();
    set({ showControls: !showControls });
  },

  toggleInfo: () => {
    const { showInfo } = get();
    set({ showInfo: !showInfo });
  },

  startRecording: () => {
    set({ isRecording: true });
  },

  stopRecording: () => {
    set({ isRecording: false });
  },

  takeScreenshot: () => {
    const { canvasRef } = get();
    if (canvasRef?.current) {
      const canvas = canvasRef.current;
      const link = document.createElement('a');
      link.download = `forcefield_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  },

  // Color filter actions
  setColorFilterEnabled: (enabled) => {
    set((state) => {
      const next = { ...state.colorFilter, enabled };
      state.particleSystem?.applyColorFilter(next);
      return { colorFilter: next };
    });
  },
  toggleColor: (color) => {
    set((state) => {
      const selected = new Set(state.colorFilter.selectedColors);
      if (selected.has(color)) {
        selected.delete(color);
      } else {
        selected.add(color);
      }
      const next = { ...state.colorFilter, selectedColors: Array.from(selected) };
      state.particleSystem?.applyColorFilter(next);
      return { colorFilter: next };
    });
  },
  setFilterMode: (mode) => {
    set((state) => {
      const next = { ...state.colorFilter, mode };
      state.particleSystem?.applyColorFilter(next);
      return { colorFilter: next };
    });
  },
  applyFilterNow: () => {
    const { particleSystem, colorFilter } = get();
    particleSystem?.applyColorFilter(colorFilter);
  }
})); 