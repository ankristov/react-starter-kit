import { create } from 'zustand';
import type { Particle, ForceFieldSettings, MousePosition, ControlPanelSettings, ColorInfo, ColorGroup, ForcePulse, ForcePulseType, ExportSettings, BackgroundImageSettings } from '../types/particle';
import type { AnimationRecording } from '../lib/deterministicRender';

interface ForceFieldState {
  particles: Particle[];
  settings: ForceFieldSettings;
  mousePosition: MousePosition;
  isAnimating: boolean;
  particleCount: number;
  desiredCanvasSize: { width: number; height: number } | null;
  currentImageData: ImageData | null; // Store the current uploaded image data for refresh
  // Export/recording
  exportSettings: ExportSettings;
  isRecording: boolean;
  recordingUrl: string | null;
  recordingMimeType: string | null; // Store the actual MIME type used for recording
  lastAnimationRecording: AnimationRecording | null; // Store the last recorded animation for rendering
  setExportSettings: (s: Partial<ExportSettings>) => void;
  setIsRecording: (b: boolean) => void;
  setRecordingUrl: (url: string | null) => void;
  setRecordingMimeType: (mime: string | null) => void;
  setLastAnimationRecording: (recording: AnimationRecording | null) => void;
  // Recorder control wiring (canvas registers callbacks)
  setRecorderControl: (ctrl: { start: () => void; stop: () => void; getRecordedStates?: () => any } | null) => void;
  startRecording: () => void;
  stopRecording: () => void;
  colorAnalysis: ColorInfo[]; // Add color analysis data
  colorGroups: ColorGroup[]; // Add color groups data
  currentFileHash: string | null; // Add current file hash for file-specific settings
  // Pulse configuration (shared between sidebar and canvas button)
  currentPulseConfig: any; // Stores current force pulse configuration
  updatePulseConfig: (config: Partial<any>) => void; // Update pulse configuration
  // Continuous force state
  continuousForcePulseId: string | null; // ID of active continuous force (null if no continuous force)
  setContinuousForcePulse: (pulseId: string | null) => void; // Start/stop continuous force
  // Presets
  presetNames: string[];
  selectedPreset: string | null;
  setParticles: (particles: Particle[]) => void;
  updateSettings: (newSettings: Partial<ForceFieldSettings>) => void;
  setMousePosition: (position: MousePosition) => void;
  setIsAnimating: (isAnimating: boolean) => void;
  setParticleCount: (count: number) => void;
  setDesiredCanvasSize: (size: { width: number; height: number } | null) => void;
  setCurrentImageData: (imageData: ImageData | null) => void; // Store current uploaded image
  resetParticles: () => void;
  updateColorAnalysis: (colors: ColorInfo[]) => void; // Add method to update color analysis
  updateColorGroups: (groups: ColorGroup[]) => void; // Add method to update color groups
  toggleColorFilter: (color: string) => void; // Add method to toggle color selection
  resetColorFilter: () => void; // Add method to reset color filter
  setFilterMode: (mode: 'show' | 'hide') => void; // Add method to set filter mode
  selectAllColors: (colors: string[]) => void; // Add method to select all colors
  setCurrentFileHash: (hash: string | null) => void; // Add method to set current file hash
  // Preset actions
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;
  setSelectedPreset: (name: string | null) => void;
  // Default state actions
  saveDefaultState: (imageDataUrl?: string | null) => void;
  loadDefaultState: () => Promise<{ success: boolean; imageDataUrl: string | null }>;
  // Quick actions
  resetToDefaults: () => void;
  // Force pulses
  enqueuePulse: (pulse: Omit<ForcePulse, 'id'>) => void;
  // Background image
  setBackgroundImage: (settings: BackgroundImageSettings | null) => void;
  updateBackgroundImage: (updates: Partial<BackgroundImageSettings>) => void;
  setParticleOpacity: (opacity: number) => void;
}

// Default settings
const defaultSettings: ForceFieldSettings = {
  particleDensity: 2000,
  particleShape: 'circle',
  forceType: 'repulsion',
  forceSettings: {
    // Tuned defaults for better combined-force feel
    attraction: { strength: 25, radius: 35 }, // moderate pull, medium radius
    repulsion: { strength: 20, radius: 30 },  // slightly tighter than attraction
    vortex: { strength: 40, radius: 35, clockwise: true }, // strong swirl in medium area
    collider: { impactForce: 3.5, bounceDamping: 0.8, hardness: 0.5, radius: 25 }, // softer shock with bounce
    turbulence: { strength: 12, frequency: 1.5, chaos: 0.4, radius: 45 }, // gentle flow across larger area
  },
  healingFactor: 8,
  restorationForce: 30,
  wallsEnabled: true,
  wallRepulsion: {
    enabled: false,  // Only repel when particles hit with velocity
    strength: 1.0,   // Repulsion force strength (0-5)
  },
  canvasBackgroundColor: '#0f0f23',
  imageScale: 1,
  particleOpacity: 1.0,
  backgroundImage: null,
  visual: {
    trailsEnabled: false,
    trailFade: 0.08,
    glowEnabled: false,
    glowStrength: 8,
    additiveBlend: false,
    autoThrottle: true,
  },
  collisions: {
    enabled: false,
    strength: 0.8,
    radiusMultiplier: 1.2,
  },
  particleInteraction: {
    elasticity: 0.5,      // medium: balanced bounce (billiard=1, sand=0)
    collisionStrength: 0.8, // strong particle separation
    friction: 0.5,         // medium friction: balanced movement
  },
  performance: {
    adaptiveEnabled: false,
    targetFps: 60,
    minVisibleFraction: 0.3,
    adjustStep: 0.1,
    visibleFraction: 1.0,
  },
  partialHealing: {
    enabled: false,
    fastFraction: 0.15,
    speedMultiplier: 2.0,
  },
  colorFilterSettings: {
    enabled: true,
    selectedColors: [],
    filterMode: 'show',
    colorTolerance: 10, // Number of color clusters to create (1-20)
  },
  // Animation mode defaults
  animationMode: 'particles',
  imageCropGridSize: 16,
  tileRotationOnScatter: true,
  tileGlowOnScatter: false,
};

// Default state storage helpers
const DEFAULT_STATE_KEY = 'forcefield-default-state';

interface DefaultState {
  settings: ControlPanelSettings;
  particles: Particle[];
  imageDataUrl: string | null; // Base64 encoded image data
  canvasSize: { width: number; height: number } | null;
  fileHash: string | null;
}

const saveDefaultState = (state: DefaultState) => {
  try {
    localStorage.setItem(DEFAULT_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save default state:', e);
  }
};

const loadDefaultState = (): DefaultState | null => {
  try {
    const saved = localStorage.getItem(DEFAULT_STATE_KEY);
    if (!saved) return null;
    return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to load default state:', e);
    return null;
  }
};

// Preset storage helpers
const PRESET_KEY = (fileHash?: string) => fileHash ? `forcefield-presets-${fileHash}` : 'forcefield-presets';

const loadPresets = (fileHash?: string): Record<string, ControlPanelSettings> => {
  try {
    let saved: string | null = null;
    if (fileHash) {
      saved = localStorage.getItem(PRESET_KEY(fileHash));
    }
    if (!saved) {
      saved = localStorage.getItem(PRESET_KEY());
    }
    const parsed = saved ? JSON.parse(saved) : {};
    // Ensure a Default preset exists that mirrors default settings
    if (!parsed['Default']) {
      parsed['Default'] = {
        particleDensity: defaultSettings.particleDensity,
        particleShape: defaultSettings.particleShape,
        forceType: defaultSettings.forceType,
        forceSettings: defaultSettings.forceSettings,
        healingFactor: defaultSettings.healingFactor,
        restorationForce: defaultSettings.restorationForce,
        wallsEnabled: defaultSettings.wallsEnabled,
        canvasBackgroundColor: defaultSettings.canvasBackgroundColor,
        imageScale: defaultSettings.imageScale,
        colorFilterSettings: defaultSettings.colorFilterSettings,
        performance: defaultSettings.performance,
        partialHealing: defaultSettings.partialHealing,
        visual: defaultSettings.visual,
        collisions: defaultSettings.collisions,
        particleInteraction: defaultSettings.particleInteraction,
      } as ControlPanelSettings;
    }
    return parsed;
  } catch (e) {
    console.warn('Failed to load presets:', e);
    return {};
  }
};

const savePresets = (presets: Record<string, ControlPanelSettings>, fileHash?: string) => {
  try {
    const key = PRESET_KEY(fileHash);
    localStorage.setItem(key, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save presets:', e);
  }
};

// Load settings from localStorage (file-specific or global)
const loadSettings = (fileHash?: string): ForceFieldSettings => {
  try {
    let saved: string | null = null;
    
    if (fileHash) {
      // Try to load file-specific settings first
      saved = localStorage.getItem(`forcefield-controls-${fileHash}`);
    }
    
    if (!saved) {
      // Fall back to global settings
      saved = localStorage.getItem('forcefield-controls');
    }
    
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Restore background image data URL from session memory if available
      if (parsed.backgroundImage && (window as any).__tempBackgroundImageDataUrl) {
        parsed.backgroundImage.imageDataUrl = (window as any).__tempBackgroundImageDataUrl;
        console.log('[Store] Background image dataUrl restored from session memory');
      }
      
      // Merge with defaults to handle any missing properties
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error);
  }
  return defaultSettings;
};

// Load UI state (canvas size, export settings) from localStorage
const loadUIState = () => {
  try {
    const saved = localStorage.getItem('forcefield-ui-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        desiredCanvasSize: parsed.desiredCanvasSize || null,
        exportSettings: parsed.exportSettings || { preset: 'instagramReel', width: 1080, height: 1920, fps: 60, durationSec: 5, mimeType: 'video/mp4' },
      };
    }
  } catch (error) {
    console.warn('Failed to load UI state from localStorage:', error);
  }
  return {
    desiredCanvasSize: null,
    exportSettings: { preset: 'instagramReel', width: 1080, height: 1920, fps: 60, durationSec: 5, mimeType: 'video/mp4' },
  };
};

// Save UI state (canvas size, export settings) to localStorage
const saveUIState = (desiredCanvasSize: { width: number; height: number } | null, exportSettings: ExportSettings) => {
  try {
    const uiState = {
      desiredCanvasSize,
      exportSettings,
    };
    localStorage.setItem('forcefield-ui-state', JSON.stringify(uiState));
  } catch (error) {
    console.warn('Failed to save UI state to localStorage:', error);
  }
};

// Save control panel settings to localStorage (file-specific or global)
const saveControlSettings = (settings: ForceFieldSettings, fileHash?: string) => {
  try {
    // If backgroundImage has imageDataUrl, store it in session storage (not localStorage)
    // because imageDataUrl can be huge (>5MB) and exceed localStorage limits
    if (settings.backgroundImage?.imageDataUrl) {
      (window as any).__tempBackgroundImageDataUrl = settings.backgroundImage.imageDataUrl;
      console.log('[Store] Background image dataUrl stored in session memory');
    }

    // Extract only control panel settings (no particles or other large data)
    // IMPORTANT: Don't store imageDataUrl in localStorage - it's too large
    const backgroundImageForStorage = settings.backgroundImage ? {
      ...settings.backgroundImage,
      imageDataUrl: undefined, // Don't persist the huge dataUrl to localStorage
    } : null;

    const controlSettings: ControlPanelSettings = {
      particleDensity: settings.particleDensity,
      particleShape: settings.particleShape,
      forceType: settings.forceType,
      combineForces: settings.combineForces,
      activeForces: settings.activeForces,
      continuousMode: settings.continuousMode,
      forceSettings: settings.forceSettings,
      healingFactor: settings.healingFactor,
      restorationForce: settings.restorationForce,
      wallsEnabled: settings.wallsEnabled,
      canvasBackgroundColor: settings.canvasBackgroundColor,
      imageScale: settings.imageScale,
      particleOpacity: settings.particleOpacity,
      backgroundImage: backgroundImageForStorage as any,
      colorFilterSettings: settings.colorFilterSettings,
      performance: settings.performance,
      partialHealing: settings.partialHealing,
      visual: settings.visual,
      collisions: settings.collisions,
      particleInteraction: settings.particleInteraction,
    };

    const key = fileHash ? `forcefield-controls-${fileHash}` : 'forcefield-controls';
    localStorage.setItem(key, JSON.stringify(controlSettings));
  } catch (error) {
    console.warn('Failed to save control settings to localStorage:', error);
    // Try to clear old data and save again, but still keep imageDataUrl in session
    try {
      const key = fileHash ? `forcefield-controls-${fileHash}` : 'forcefield-controls';
      localStorage.removeItem(key);

      // If backgroundImage has imageDataUrl, store it in session storage
      if (settings.backgroundImage?.imageDataUrl) {
        (window as any).__tempBackgroundImageDataUrl = settings.backgroundImage.imageDataUrl;
      }

      const backgroundImageForStorage = settings.backgroundImage ? {
        ...settings.backgroundImage,
        imageDataUrl: undefined, // Don't persist the huge dataUrl to localStorage
      } : null;

      const controlSettings: ControlPanelSettings = {
        particleDensity: settings.particleDensity,
        particleShape: settings.particleShape,
        forceType: settings.forceType,
        combineForces: settings.combineForces,
        activeForces: settings.activeForces,
        continuousMode: settings.continuousMode,
        forceSettings: settings.forceSettings,
        healingFactor: settings.healingFactor,
        restorationForce: settings.restorationForce,
        wallsEnabled: settings.wallsEnabled,
        canvasBackgroundColor: settings.canvasBackgroundColor,
        imageScale: settings.imageScale,
        particleOpacity: settings.particleOpacity,
        backgroundImage: backgroundImageForStorage as any,
        colorFilterSettings: settings.colorFilterSettings,
        performance: settings.performance,
        partialHealing: settings.partialHealing,
        visual: settings.visual,
        collisions: settings.collisions,
        particleInteraction: settings.particleInteraction,
      };
      localStorage.setItem(key, JSON.stringify(controlSettings));
    } catch (retryError) {
      console.warn('Failed to save control settings even after clearing:', retryError);
      // Still store the dataUrl in session memory for this session
      if (settings.backgroundImage?.imageDataUrl) {
        (window as any).__tempBackgroundImageDataUrl = settings.backgroundImage.imageDataUrl;
      }
    }
  }
};

// Load UI state on initialization
const initialUIState = loadUIState();

export const useForceFieldStore = create<ForceFieldState>((set, get) => ({
  particles: [],
  settings: loadSettings(), // Load saved settings if available, else defaults
  mousePosition: { x: 0, y: 0, active: false },
  isAnimating: false,
  particleCount: 0,
  desiredCanvasSize: initialUIState.desiredCanvasSize,
  currentImageData: null, // Store current uploaded image data
  exportSettings: initialUIState.exportSettings,
  isRecording: false,
  recordingUrl: null,
  recordingMimeType: null,
  lastAnimationRecording: null,
  setExportSettings: (s) => {
    const newExportSettings = { ...get().exportSettings, ...s };
    set({ exportSettings: newExportSettings });
    saveUIState(get().desiredCanvasSize, newExportSettings);
  },
  setIsRecording: (b) => set({ isRecording: b }),
  setRecordingUrl: (url) => set({ recordingUrl: url }),
  setRecordingMimeType: (mime) => set({ recordingMimeType: mime }),
  setLastAnimationRecording: (recording) => set({ lastAnimationRecording: recording }),
  // recorder control storage (not persisted)
  _recorderControl: undefined as any,
  setRecorderControl: (ctrl) => { (get() as any)._recorderControl = ctrl; },
  startRecording: () => { const c = (get() as any)._recorderControl; if (c && typeof c.start === 'function') c.start(); },
  stopRecording: () => { const c = (get() as any)._recorderControl; if (c && typeof c.stop === 'function') c.stop(); },
  colorAnalysis: [], // Initialize empty color analysis
  colorGroups: [], // Initialize empty color groups
  currentFileHash: null, // Initialize current file hash
  // Pulse configuration (shared with canvas button)
  currentPulseConfig: {
    type: 'burst',
    durationMs: 1500,
    holdTimeMs: 0,
    strength: 30,
    easeIn: 0.2,
    easeOut: 0.2,
    easeType: 'ease-in-out-quad',
    origin: { normalized: true, x: 0.5, y: 0.5 },
    radius: 1500,
  },
  updatePulseConfig: (config) => {
    set({ currentPulseConfig: { ...get().currentPulseConfig, ...config } });
  },
  // Continuous force state
  continuousForcePulseId: null,
  setContinuousForcePulse: (pulseId: string | null) => {
    set({ continuousForcePulseId: pulseId });
  },
  presetNames: Object.keys(loadPresets()),
  selectedPreset: 'Default',

  setParticles: (particles: Particle[]) => set({ particles }),
  updateSettings: (newSettings: Partial<ForceFieldSettings>) => {
    const updatedSettings = { ...get().settings, ...newSettings };
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, get().currentFileHash || undefined); // Save with current file hash
  },
  setMousePosition: (position: MousePosition) => set({ mousePosition: position }),
  setIsAnimating: (isAnimating: boolean) => set({ isAnimating }),
  setParticleCount: (count: number) => set({ particleCount: count }),
  setDesiredCanvasSize: (size) => {
    set({ desiredCanvasSize: size });
    saveUIState(size, get().exportSettings);
  },
  setCurrentImageData: (imageData: ImageData | null) => set({ currentImageData: imageData }),
  resetParticles: () => set((state) => ({
    particles: state.particles.map(particle => ({
      ...particle,
      x: particle.originalX,
      y: particle.originalY,
      vx: 0,
      vy: 0,
    })),
  })),
  updateColorAnalysis: (colors: ColorInfo[]) => set({ colorAnalysis: colors }),
  updateColorGroups: (groups: ColorGroup[]) => set({ colorGroups: groups }),
  toggleColorFilter: (color: string) => {
    const state = get();
    const currentSelected = state.settings.colorFilterSettings.selectedColors;
    const newSelected = currentSelected.includes(color)
      ? currentSelected.filter(c => c !== color)
      : [...currentSelected, color];
    
    const updatedSettings = {
      ...state.settings,
      colorFilterSettings: {
        ...state.settings.colorFilterSettings,
        selectedColors: newSelected,
      }
    };
    
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, state.currentFileHash || undefined);
  },
  resetColorFilter: () => {
    const state = get();
    const updatedSettings = {
      ...state.settings,
      colorFilterSettings: {
        ...state.settings.colorFilterSettings,
        selectedColors: [],
        enabled: false,
      }
    };
    
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, state.currentFileHash || undefined);
  },
  setFilterMode: (mode: 'show' | 'hide') => {
    const state = get();
    const updatedSettings = {
      ...state.settings,
      colorFilterSettings: {
        ...state.settings.colorFilterSettings,
        filterMode: mode,
      }
    };
    
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, state.currentFileHash || undefined);
  },
  selectAllColors: (colors: string[]) => {
    const state = get();
    const updatedSettings = {
      ...state.settings,
      colorFilterSettings: {
        ...state.settings.colorFilterSettings,
        selectedColors: colors,
        enabled: true,
      }
    };
    
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, state.currentFileHash || undefined);
  },
  setCurrentFileHash: (hash: string | null) => {
    try {
      const currentState = get();
      const currentBackgroundImage = currentState.settings.backgroundImage; // Preserve current background image
      
      set({ currentFileHash: hash });
      
      // Load file-specific settings when file hash changes
      if (hash) {
        const fileSpecificSettings = loadSettings(hash);
        // Preserve background image from current state (don't override with file-specific settings)
        const settingsWithPreservedBg = { ...fileSpecificSettings, backgroundImage: currentBackgroundImage };
        set({ settings: settingsWithPreservedBg });
        // Load file-specific presets
        const names = Object.keys(loadPresets(hash));
        set({ presetNames: names, selectedPreset: names.includes('Default') ? 'Default' : (names[0] ?? null) });
        console.log('Loaded file-specific settings for hash:', hash);
      } else {
        // Load global settings when no file hash
        const globalSettings = loadSettings();
        // Preserve background image from current state
        const settingsWithPreservedBg = { ...globalSettings, backgroundImage: currentBackgroundImage };
        const names = Object.keys(loadPresets());
        set({ settings: settingsWithPreservedBg, presetNames: names, selectedPreset: names.includes('Default') ? 'Default' : (names[0] ?? null) });
        console.log('Loaded global settings');
      }
    } catch (error) {
      console.warn('Error in setCurrentFileHash:', error);
      // Continue with current settings if there's an error
    }
  },
  // Preset actions
  savePreset: (name: string) => {
    if (!name) return;
    const state = get();
    const controlSettings: ControlPanelSettings = {
      particleDensity: state.settings.particleDensity,
      particleShape: state.settings.particleShape,
      forceType: state.settings.forceType,
      combineForces: state.settings.combineForces,
      activeForces: state.settings.activeForces,
      continuousMode: state.settings.continuousMode,
      forceSettings: state.settings.forceSettings,
      healingFactor: state.settings.healingFactor,
      restorationForce: state.settings.restorationForce,
      wallsEnabled: state.settings.wallsEnabled,
      canvasBackgroundColor: state.settings.canvasBackgroundColor,
      colorFilterSettings: state.settings.colorFilterSettings,
      performance: state.settings.performance,
      partialHealing: state.settings.partialHealing,
      visual: state.settings.visual,
      collisions: state.settings.collisions,
      particleInteraction: state.settings.particleInteraction,
    };
    const fileHash = state.currentFileHash || undefined;
    const presets = loadPresets(fileHash);
    presets[name] = controlSettings;
    savePresets(presets, fileHash);
    set({ presetNames: Object.keys(presets), selectedPreset: name });
  },
  loadPreset: (name: string) => {
    const state = get();
    const fileHash = state.currentFileHash || undefined;
    const presets = loadPresets(fileHash);
    const preset = presets[name];
    if (!preset) return;
    // Merge with defaults to ensure full settings
    const next: ForceFieldSettings = { ...defaultSettings, ...preset } as ForceFieldSettings;
    set({ settings: next, selectedPreset: name });
    saveControlSettings(next, fileHash);
  },
  deletePreset: (name: string) => {
    const state = get();
    const fileHash = state.currentFileHash || undefined;
    const presets = loadPresets(fileHash);
    if (presets[name]) {
      delete presets[name];
      savePresets(presets, fileHash);
      const names = Object.keys(presets);
      const fallback = names.includes('Default') ? 'Default' : (names[0] ?? null);
      set({ presetNames: names, selectedPreset: fallback });
    }
  },
  saveDefaultState: (imageDataUrl?: string | null) => {
    const state = get();
    const controlSettings: ControlPanelSettings = {
      particleDensity: state.settings.particleDensity,
      particleShape: state.settings.particleShape,
      forceType: state.settings.forceType,
      combineForces: state.settings.combineForces,
      activeForces: state.settings.activeForces,
      continuousMode: state.settings.continuousMode,
      forceSettings: state.settings.forceSettings,
      healingFactor: state.settings.healingFactor,
      restorationForce: state.settings.restorationForce,
      wallsEnabled: state.settings.wallsEnabled,
      wallRepulsion: state.settings.wallRepulsion,
      wallMode: state.settings.wallMode,
      canvasBackgroundColor: state.settings.canvasBackgroundColor,
      imageScale: state.settings.imageScale,
      particleOpacity: state.settings.particleOpacity,
      backgroundImage: state.settings.backgroundImage,
      colorFilterSettings: state.settings.colorFilterSettings,
      performance: state.settings.performance,
      partialHealing: state.settings.partialHealing,
      visual: state.settings.visual,
      collisions: state.settings.collisions,
      particleInteraction: state.settings.particleInteraction,
      animationMode: state.settings.animationMode,
      gridSize: state.settings.gridSize,
      motionResistance: state.settings.motionResistance,
      damping: state.settings.damping,
    };
    
    const defaultState: DefaultState = {
      settings: controlSettings,
      particles: JSON.parse(JSON.stringify(state.particles)), // Deep copy particles
      imageDataUrl: imageDataUrl ?? null,
      canvasSize: state.desiredCanvasSize,
      fileHash: state.currentFileHash,
    };
    
    saveDefaultState(defaultState);
  },
  loadDefaultState: async () => {
    const saved = loadDefaultState();
    if (!saved) return { success: false, imageDataUrl: null };
    
    // Restore settings
    const next: ForceFieldSettings = { ...defaultSettings, ...saved.settings } as ForceFieldSettings;
    set({ 
      settings: next, 
      particles: JSON.parse(JSON.stringify(saved.particles)), // Deep copy particles
      desiredCanvasSize: saved.canvasSize,
      currentFileHash: saved.fileHash,
      particleCount: saved.particles.length,
    });
    saveControlSettings(next, saved.fileHash || undefined);
    
    return { success: true, imageDataUrl: saved.imageDataUrl };
  },
  setSelectedPreset: (name: string | null) => set({ selectedPreset: name }),
  // Reset all settings to defaults (respecting file hash persistence)
  resetToDefaults: () => {
    const fileHash = get().currentFileHash || undefined;
    set({ settings: defaultSettings });
    saveControlSettings(defaultSettings, fileHash);
  },
  enqueuePulse: (pulse) => {
    const engine = (window as any).__ff_engine as any;
    if (!engine) {
      console.warn('Force preset clicked but engine is not ready yet');
    }
    if (engine && typeof engine.enqueuePulse === 'function') {
      console.log('Enqueue pulse', pulse);
      engine.enqueuePulse(pulse);
    } else {
      console.warn('Engine not ready for pulses');
    }
  },
  // Background image actions
  setBackgroundImage: (settings) => {
    const updatedSettings = { ...get().settings, backgroundImage: settings };
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, get().currentFileHash || undefined);
  },
  updateBackgroundImage: (updates) => {
    const state = get();
    if (!state.settings.backgroundImage) return;
    const updatedBackgroundImage = { ...state.settings.backgroundImage, ...updates };
    const updatedSettings = { ...state.settings, backgroundImage: updatedBackgroundImage };
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, state.currentFileHash || undefined);
  },
  setParticleOpacity: (opacity) => {
    const updatedSettings = { ...get().settings, particleOpacity: opacity };
    set({ settings: updatedSettings });
    saveControlSettings(updatedSettings, get().currentFileHash || undefined);
  },
})); 