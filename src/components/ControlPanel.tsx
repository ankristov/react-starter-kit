import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useForceFieldStore } from '../store/forceFieldStore';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { fileToImageData, createDefaultImage, imageDataToDataUrl, dataUrlToImageData } from '../lib/imageUtils';
import { ParticleEngine } from '../lib/particleEngine';
import { ForceTypeControls } from './ForceTypeControls';
import type { ForcePulseType } from '../types/particle';
import { ColorFilter } from './ColorFilter';
import { ChevronDown, ChevronRight, Info, X, Loader2, HelpCircle } from 'lucide-react';
import { detectFormatMismatch } from '../lib/imageUtils';
import { AnimationRecorder, type AnimationRecording } from '../lib/deterministicRender';

// Generate a hash for a file
const generateFileHash = async (file: File): Promise<string> => {
  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.warn('Failed to generate file hash, using fallback:', error);
    // Fallback: use file name, size, and last modified date
    const fallbackHash = `${file.name}-${file.size}-${file.lastModified}`;
    return btoa(fallbackHash).replace(/[^a-zA-Z0-9]/g, '');
  }
};

export function ControlPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const backgroundImageInputRef = useRef<HTMLInputElement>(null);
  
  const engineRef = useRef<ParticleEngine | null>(null);
  const currentImageDataRef = useRef<ImageData | null>(null);
  const animationRecorderRef = useRef<InstanceType<typeof AnimationRecorder> | null>(null);
  
  const {
    settings,
    updateSettings,
    
    particleCount,
    setParticles,
    setParticleCount,
    setCurrentImageData,
    setCurrentFileHash,
    desiredCanvasSize,
    setDesiredCanvasSize,
    exportSettings,
    setExportSettings,
    isRecording,
    recordingUrl,
    recordingMimeType,
    lastAnimationRecording,
    startRecording,
    stopRecording,
    setLastAnimationRecording,
    // Presets
    presetNames,
    savePreset,
    loadPreset,
    deletePreset,
    selectedPreset,
    enqueuePulse,
    setBackgroundImage,
    updateBackgroundImage,
    setParticleOpacity,
    saveDefaultState,
    loadDefaultState,
    updatePulseConfig,
    continuousForcePulseId,
    setContinuousForcePulse,
  } = useForceFieldStore();

  // Force Preset states (must be declared early to satisfy Hooks rules)
  // Timing & Easing
  const [pulseSelected, setPulseSelected] = useState<ForcePulseType>('burst');
  const [pulseDuration, setPulseDuration] = useState<number>(1500);
  const [pulseHoldTime, setPulseHoldTime] = useState<number>(0);
  const [pulseInertia, setPulseInertia] = useState<number>(500); // ms of inertia/coast phase
  const [forceMode, setForceMode] = useState<'impulse' | 'continuous'>('impulse');
  const [easeIn, setEaseIn] = useState<number>(0.2);
  const [easeOut, setEaseOut] = useState<number>(0.2);
  const [easeType, setEaseType] = useState<'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad'>('ease-in-out-quad');
  // Force Parameters
  const [pulseStrength, setPulseStrength] = useState<number>(30);
  const [pulseStrengthMultiplier, setPulseStrengthMultiplier] = useState<number>(1);
  const [pulseIntensity, setPulseIntensity] = useState<number>(1.0);
  const [pulseRadius, setPulseRadius] = useState<number>(1500);
  // Direction & Rotation
  const [pulseDirectionDeg, setPulseDirectionDeg] = useState<number>(90);
  const [pulseClockwise, setPulseClockwise] = useState<boolean>(true);
  // Frequency & Chaos
  const [pulseFrequency, setPulseFrequency] = useState<number>(1.5);
  const [pulseChaos, setPulseChaos] = useState<number>(0.6);
  // Origin (for centered forces)
  const [pulseOriginX, setPulseOriginX] = useState<number>(0.5);
  const [pulseOriginY, setPulseOriginY] = useState<number>(0.5);
  // Wave & Spiral specific
  const [pulseWaveCount, setPulseWaveCount] = useState<number>(3);
  const [pulseSpiralTurns, setPulseSpiralTurns] = useState<number>(2);
  // Randomize-specific controls
  const [randomizeScatterSpeed, setRandomizeScatterSpeed] = useState<number>(3.0);
  const [randomizeScatterDurationPercent, setRandomizeScatterDurationPercent] = useState<number>(30);
  const [randomizeHoldTime, setRandomizeHoldTime] = useState<number>(500);
  const [randomizeReturnDurationPercent, setRandomizeReturnDurationPercent] = useState<number>(40);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Canvas size preset controls
  type CanvasPreset = 'original' | 'instagramReel' | 'youtube' | 'square' | 'custom';
  const [canvasPreset, setCanvasPreset] = useState<CanvasPreset>('original');
  const [customWidth, setCustomWidth] = useState<number>(desiredCanvasSize?.width || 800);
  const [customHeight, setCustomHeight] = useState<number>(desiredCanvasSize?.height || 600);
  
  // Background image adjustment section state
  const [showBackgroundAdjustments, setShowBackgroundAdjustments] = useState(false);
  
  // Grid size input - only apply on explicit button click
  const [gridSizeInput, setGridSizeInput] = useState<string>((settings.imageCropGridSize ?? 16).toString());

  // Track continuous pulse ID locally to trigger re-renders
  const [localContinuousPulseId, setLocalContinuousPulseId] = useState<string | null>(continuousForcePulseId || null);

  // Subscribe to continuous pulse ID changes in store
  useEffect(() => {
    const unsubscribe = useForceFieldStore.subscribe(
      (state) => state.continuousForcePulseId,
      (newId) => setLocalContinuousPulseId(newId)
    );
    return unsubscribe;
  }, []);

  // Accordion open/close state for sidebar sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true,
    forcePresets: true,
    forces: false,
    visuals: false,
    performance: false,
    healing: false,
    collisions: false,
    particleInteractions: false,
    colors: true,
    export: true,
  });

  // Ensure complete objects for nested settings when updating (to satisfy types)
  const currentVisual = {
    trailsEnabled: settings.visual?.trailsEnabled ?? false,
    trailFade: settings.visual?.trailFade ?? 0.08,
    glowEnabled: settings.visual?.glowEnabled ?? false,
    glowStrength: settings.visual?.glowStrength ?? 8,
    additiveBlend: settings.visual?.additiveBlend ?? false,
    autoThrottle: settings.visual?.autoThrottle ?? true,
  } as const;

  const currentPerformance = {
    adaptiveEnabled: settings.performance?.adaptiveEnabled ?? true,
    targetFps: settings.performance?.targetFps ?? 60,
    minVisibleFraction: settings.performance?.minVisibleFraction ?? 0.3,
    adjustStep: settings.performance?.adjustStep ?? 0.1,
    visibleFraction: settings.performance?.visibleFraction ?? 1,
  } as const;

  const currentPartialHealing = {
    enabled: settings.partialHealing?.enabled ?? true,
    fastFraction: settings.partialHealing?.fastFraction ?? 0.15,
    speedMultiplier: settings.partialHealing?.speedMultiplier ?? 2,
  } as const;

  const currentCollisions = {
    enabled: settings.collisions?.enabled ?? false,
    strength: settings.collisions?.strength ?? 0.8,
    radiusMultiplier: settings.collisions?.radiusMultiplier ?? 1.2,
  } as const;

  const currentInteraction = {
    elasticity: settings.particleInteraction?.elasticity ?? 0.5,
    collisionStrength: settings.particleInteraction?.collisionStrength ?? 0.8,
    friction: settings.particleInteraction?.friction ?? 0.5,
  } as const;

  // Preset interaction profiles
  const interactionPresets = {
    // Preset name: { restorationForce, motionResistance, damping, collisionsEnabled, collisionStrength, radiusMultiplier }
    liquid: { 
      restorationForce: 50, friction: 0.6, elasticity: 0.1, 
      collisionsEnabled: true, collisionStrength: 0.3, radiusMultiplier: 1.2 
    },
    fluid: { 
      restorationForce: 100, friction: 0.4, elasticity: 0.3, 
      collisionsEnabled: true, collisionStrength: 0.5, radiusMultiplier: 1.3 
    },
    elastic: { 
      restorationForce: 200, friction: 0.3, elasticity: 0.7, 
      collisionsEnabled: true, collisionStrength: 0.8, radiusMultiplier: 1.4 
    },
    bouncy: { 
      restorationForce: 150, friction: 0.2, elasticity: 1.0, 
      collisionsEnabled: true, collisionStrength: 1.0, radiusMultiplier: 1.5 
    },
    sticky: { 
      restorationForce: 300, friction: 0.7, elasticity: 0.05, 
      collisionsEnabled: true, collisionStrength: 0.4, radiusMultiplier: 1.6 
    },
    rigid: { 
      restorationForce: 400, friction: 0.1, elasticity: 0.9, 
      collisionsEnabled: true, collisionStrength: 1.0, radiusMultiplier: 1.3 
    },
    floaty: { 
      restorationForce: 50, friction: 0.1, elasticity: 0.5, 
      collisionsEnabled: false, collisionStrength: 0.5, radiusMultiplier: 1.2 
    },
    solid: { 
      restorationForce: 200, friction: 0.1, elasticity: 0.0, 
      collisionsEnabled: true, collisionStrength: 1.0, radiusMultiplier: 1.4 
    },
  } as const;

  // Initialize with default image if no image is loaded
  useEffect(() => {
    if (!currentImageDataRef.current && particleCount === 0) {
      console.log('Initializing with default image');
      const defaultImageData = createDefaultImage(800, 600);
      currentImageDataRef.current = defaultImageData;
      
      const engine = new ParticleEngine(settings);
      const particles = engine.generateParticlesFromImage(defaultImageData);
      
      setParticles(particles);
      setParticleCount(particles.length);
      setCurrentImageData(defaultImageData); // Store the default image for canvas refresh
    }
  }, []); // Only run once on mount

  // Sync pulse configuration to store whenever it changes
  useEffect(() => {
    const base: any = { 
      type: pulseSelected, 
      durationMs: pulseDuration,
      holdTimeMs: pulseHoldTime,
      strength: pulseStrength * pulseStrengthMultiplier,
      easeIn: easeIn,
      easeOut: easeOut,
      easeType: easeType,
    };
    // Direction-based types
    if (['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) {
      base.directionDeg = pulseDirectionDeg;
    }
    // Rotation-based types
    if (['tornado','ringSpin'].includes(pulseSelected)) {
      base.clockwise = pulseClockwise;
    }
    // Frequency-based types
    if (['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) {
      base.frequency = pulseFrequency;
    }
    // Chaos-based types
    if (['noise','randomJitter'].includes(pulseSelected)) {
      base.chaos = pulseChaos;
    }
    // Origin-based types
    if (['shockwave','ripple','burst','implosion','supernova','ringBurst','edgeBurst','multiBurst'].includes(pulseSelected)) {
      base.origin = { normalized: true, x: pulseOriginX, y: pulseOriginY };
    }
    // Radius-based types
    if (['burst','implosion','shockwave','supernova','ringBurst','edgeBurst'].includes(pulseSelected)) {
      base.radius = pulseRadius;
    }
    // Intensity-based types
    if (['supernova','quake','burst','implosion'].includes(pulseSelected)) {
      base.intensity = pulseIntensity;
    }
    // Wave count for ripple/wave types
    if (['ripple','waveLeft','waveUp'].includes(pulseSelected)) {
      base.waveCount = pulseWaveCount;
    }
    // Spiral turns
    if (['spiralIn','spiralOut'].includes(pulseSelected)) {
      base.spiralTurns = pulseSpiralTurns;
    }
    // Randomize-specific
    if (pulseSelected === 'randomize') {
      base.scatterSpeed = randomizeScatterSpeed;
      base.scatterDurationPercent = randomizeScatterDurationPercent;
      base.returnDurationPercent = randomizeReturnDurationPercent;
    }
    updatePulseConfig(base);
  }, [pulseSelected, pulseDuration, pulseHoldTime, pulseStrength, pulseStrengthMultiplier, easeIn, easeOut, easeType, pulseDirectionDeg, pulseClockwise, pulseFrequency, pulseChaos, pulseOriginX, pulseOriginY, pulseRadius, pulseIntensity, pulseWaveCount, pulseSpiralTurns, randomizeScatterSpeed, randomizeScatterDurationPercent, randomizeReturnDurationPercent, updatePulseConfig]);

  // Update active continuous pulse in real-time if parameters change
  useEffect(() => {
    const { continuousForcePulseId } = useForceFieldStore.getState();
    const engine = (window as any).__ff_engine;
    if (continuousForcePulseId && engine) {
      // Build update object with strength multiplier applied
      const updates: any = {
        strength: pulseStrength * pulseStrengthMultiplier,
      };
      
      // Add type-specific parameters that might have changed
      if (['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) {
        updates.directionDeg = pulseDirectionDeg;
      }
      if (['tornado','ringSpin'].includes(pulseSelected)) {
        updates.clockwise = pulseClockwise;
      }
      if (['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) {
        updates.frequency = pulseFrequency;
      }
      if (['noise','randomJitter'].includes(pulseSelected)) {
        updates.chaos = pulseChaos;
      }
      if (['shockwave','ripple','burst','implosion','supernova','ringBurst','edgeBurst','multiBurst'].includes(pulseSelected)) {
        updates.origin = { normalized: true, x: pulseOriginX, y: pulseOriginY };
      }
      if (['burst','implosion','shockwave','supernova','ringBurst','edgeBurst'].includes(pulseSelected)) {
        updates.radius = pulseRadius;
      }
      if (['supernova','quake','burst','implosion'].includes(pulseSelected)) {
        updates.intensity = pulseIntensity;
      }
      if (['ripple','waveLeft','waveUp'].includes(pulseSelected)) {
        updates.waveCount = pulseWaveCount;
      }
      if (['spiralIn','spiralOut'].includes(pulseSelected)) {
        updates.spiralTurns = pulseSpiralTurns;
      }
      
      engine.updateContinuousPulse(continuousForcePulseId, updates);
    }
  }, [pulseStrength, pulseStrengthMultiplier, pulseDirectionDeg, pulseClockwise, pulseFrequency, pulseChaos, pulseOriginX, pulseOriginY, pulseRadius, pulseIntensity, pulseWaveCount, pulseSpiralTurns, pulseSelected]);

  // Update particle properties and engine settings in real-time when animation is active
  useEffect(() => {
    const engine = (window as any).__ff_engine;
    if (engine && localContinuousPulseId) {
      // Update engine settings for real-time changes to particle properties
      engine.updateSettings(settings);
    }
  }, [settings, localContinuousPulseId]);

  const handleFileUpload = async (file: File) => {
    try {
      console.log('Starting file upload:', file.name, file.size, file.type);
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Selected file is not an image');
      }
      
      // First, convert file to image data
      console.log('Converting file to image data...');
      const imageData = await fileToImageData(file);
      currentImageDataRef.current = imageData;
      console.log('Image data created:', imageData.width, 'x', imageData.height);
      
      // Generate file hash for file-specific settings
      let fileHash: string | null = null;
      try {
        console.log('Generating file hash...');
        fileHash = await generateFileHash(file);
        console.log('Generated file hash:', fileHash);
        
        // Set the file hash to load any existing settings
        setCurrentFileHash(fileHash);
      } catch (hashError) {
        console.warn('Failed to generate file hash, continuing without file-specific settings:', hashError);
        setCurrentFileHash(null);
      }
      
      // Create new particle engine with current settings
      console.log('Creating particle engine...');
      // Set desired canvas to image size and regenerate particles with centering in engine
      setDesiredCanvasSize({ width: imageData.width, height: imageData.height });
      const engine = new ParticleEngine(settings);
      engine.setCanvasSize(imageData.width, imageData.height);
      
      // Generate particles based on animation mode
      // Use current background image settings if available (so particles align with any existing background)
      console.log('[Upload] Current animation mode:', settings.animationMode);
      let particles;
      if (settings.animationMode === 'imageCrops') {
        particles = engine.generateParticlesFromImageTiles(imageData, settings.imageCropGridSize ?? 16, settings.backgroundImage);
        console.log('Generated tile particles with grid size:', settings.imageCropGridSize ?? 16, 'particles:', particles.length);
      } else {
        particles = engine.generateParticlesFromImage(imageData, settings.backgroundImage);
        console.log('Generated particles (regular mode):', particles.length);
      }
      
      // FIXED: Update store with particles ONLY - do NOT set background image when uploading target image
      // The target image is for particles, not background
      // Background image should only be set through the dedicated "Upload Background Image" button
      
      // Update store with new particles
      setParticles(particles);
      setParticleCount(particles.length);
      setCurrentImageData(imageData); // Store the uploaded image for canvas refresh
      
      console.log('Target image uploaded successfully:', particles.length, 'particles. Background image NOT changed.');
    } catch (error) {
      console.error('Error loading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load image: ${errorMessage}`);
    }
  };

  const regenerateParticles = (newDensity?: number, newGridSize?: number, explicitSize?: { width: number; height: number }) => {
    let imageData = currentImageDataRef.current;
    
    // If no image is loaded, create a default image
    if (!imageData) {
      console.log('No image loaded, creating default image');
      imageData = createDefaultImage(800, 600);
      currentImageDataRef.current = imageData;
    }
    
    // Get the latest settings and state from the store to ensure we have the most up-to-date values
    const storeState = useForceFieldStore.getState();
    const currentSettings = storeState.settings;
    const currentDesiredSize = storeState.desiredCanvasSize;
    const densityToUse = newDensity ?? currentSettings.particleDensity;
    const gridSizeToUse = newGridSize ?? currentSettings.imageCropGridSize ?? 16;
    
    // IMPORTANT: Do NOT create a new engine here
    // Instead, use the existing engine that the canvas is animating with
    // Creating a new engine causes the animation loop to reference stale/undefined engine
    // This causes blinking, blank canvas, and periodic reloads
    
    const engine = (window as any).__ff_engine as typeof ParticleEngine | undefined;
    if (!engine) {
      console.warn('Engine not initialized yet, skipping particle regeneration');
      return;
    }
    
    // Update the existing engine's settings
    engine.updateSettings({ ...currentSettings, particleDensity: densityToUse, imageCropGridSize: gridSizeToUse });
    
    // FIXED: For refresh, maintain current canvas dimensions instead of image dimensions
    // Get current canvas size from engine or use current desired size
    const currentCanvasSize = { 
      width: engine.canvasWidth || target.width, 
      height: engine.canvasHeight || target.height 
    };
    
    // Use explicit size if provided, otherwise maintain current canvas size
    const targetSize = explicitSize ?? currentDesiredSize ?? currentCanvasSize;
    
    // Only update canvas size if it's actually changing to prevent unnecessary resizing
    if (engine.canvasWidth !== targetSize.width || engine.canvasHeight !== targetSize.height) {
      setDesiredCanvasSize(targetSize);
      engine.setCanvasSize(targetSize.width, targetSize.height);
      console.log(`[Refresh] Canvas size updated to: ${targetSize.width}x${targetSize.height}`);
    } else {
      console.log(`[Refresh] Maintaining canvas size: ${targetSize.width}x${targetSize.height}`);
    }
    
    // Generate particles based on animation mode
    let particles;
    if (currentSettings.animationMode === 'imageCrops') {
      // Pass background image settings for proper alignment
      particles = engine.generateParticlesFromImageTiles(imageData, gridSizeToUse, currentSettings.backgroundImage);
      console.log('Regenerated tile particles with grid size:', gridSizeToUse, 'particles:', particles.length);
    } else {
      // Pass background image settings for proper alignment
      particles = engine.generateParticlesFromImage(imageData, currentSettings.backgroundImage);
      console.log('Regenerated particles with density:', densityToUse, 'particles:', particles.length);
    }
    
    setParticles(particles);
    setParticleCount(particles.length);
    // Do NOT update engineRef - we're using the shared engine from the canvas
  };

  const handleDensityChange = (value: number[]) => {
    const newDensity = value[0];
    // Update settings first, then regenerate particles with the new density
    updateSettings({ particleDensity: newDensity });
    // Regenerate particles immediately - regenerateParticles will get latest settings from store
    regenerateParticles(newDensity);
  };

  const handleGridSizeRecalculate = () => {
    const newGridSize = Math.max(8, Math.min(64, parseInt(gridSizeInput) || 16));
    // Update input to valid value
    setGridSizeInput(newGridSize.toString());
    // Update settings and regenerate
    updateSettings({ imageCropGridSize: newGridSize });
    regenerateParticles(undefined, newGridSize);
  };

  const handleRefresh = () => {
    // Refresh particles - regenerate with ALL current settings
    // This will properly reconstruct the particle system regardless of animation mode
    regenerateParticles();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type, file.size);
      handleFileUpload(file).catch((error) => {
        console.error('Upload error:', error);
        alert(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      });
    } else {
      console.log('No file selected');
    }
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  

  const toggleWalls = () => {
    updateSettings({ wallsEnabled: !settings.wallsEnabled });
  };

  const applyInteractionPreset = (preset: keyof typeof interactionPresets) => {
    const preset_obj = interactionPresets[preset];
    updateSettings({
      restorationForce: preset_obj.restorationForce,
      particleInteraction: {
        elasticity: preset_obj.elasticity,
        collisionStrength: preset_obj.collisionStrength,
        friction: preset_obj.friction,
      },
      collisions: {
        enabled: preset_obj.collisionsEnabled,
        strength: 1.0, // default value
        radiusMultiplier: preset_obj.radiusMultiplier,
      }
    });
  };

  const handleStartAnimationRecording = () => {
    if (!currentImageDataRef.current) {
      console.warn('[AnimationRecorder] No image data, recording skipped');
      return;
    }
    animationRecorderRef.current = new AnimationRecorder(settings);
    animationRecorderRef.current.start();
    console.log('[AnimationRecorder] Started recording');
  };

  const handleStopAnimationRecording = async () => {
    if (!animationRecorderRef.current || !animationRecorderRef.current.isActive?.()) return;
    
    animationRecorderRef.current.stop();
    
    const engine = (window as any).__ff_engine;
    if (!currentImageDataRef.current || !engine) {
      console.warn('[AnimationRecorder] Missing context, skipping finalization');
      return;
    }
    
    // Get image as data URL
    const canvas = document.createElement('canvas');
    canvas.width = currentImageDataRef.current.width;
    canvas.height = currentImageDataRef.current.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[AnimationRecorder] Failed to create canvas context');
      return;
    }
    ctx.putImageData(currentImageDataRef.current, 0, 0);
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Get recording and store in Zustand for rendering
    const ffEngine = (window as any).__ff_engine;
    const recording = animationRecorderRef.current.getRecording(
      imageDataUrl,
      ffEngine?.canvasWidth || 1024,
      ffEngine?.canvasHeight || 768,
      60
    );
    
    // Store recording in Zustand for next step (rendering)
    setLastAnimationRecording(recording);
    console.log(`[AnimationRecorder] Recording saved: ${recording.inputs.filter(i => i.pulse).length} pulses, ${(recording.duration / 1000).toFixed(2)}s`);
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full h-full bg-[#0B0B10] text-purple-100 border-l border-purple-500/20 overflow-y-auto"
    >
      {/* Top action bar - scrollable */}
      <div className="border-b border-purple-500/20">
        <div className="p-3 flex gap-2 text-xs overflow-x-auto whitespace-nowrap pb-4">
          <Button size="sm" className="bg-indigo-600/30 hover:bg-indigo-600/45 text-indigo-100 border border-indigo-400/20 flex-shrink-0" onClick={async () => {
              const result = await loadDefaultState();
              if (result.success) {
                // Restore image data if available
                if (result.imageDataUrl) {
                  try {
                    const imageData = await dataUrlToImageData(result.imageDataUrl);
                    currentImageDataRef.current = imageData;
                  } catch (error) {
                    console.error('Failed to load default image:', error);
                    // Fallback to default image if loading fails
                    currentImageDataRef.current = createDefaultImage(800, 600);
                  }
                } else {
                  // No saved image, use default
                  currentImageDataRef.current = createDefaultImage(800, 600);
                }
                // Update engine with restored particles (don't regenerate, use saved particles)
                const storeState = useForceFieldStore.getState();
                const engine = (window as any).__ff_engine;
                if (engine && storeState.particles.length > 0) {
                  engine.updateParticlesFromStore(storeState.particles);
                  engine.applyColorFiltering();
                } else if (engine) {
                  // If no particles were saved, regenerate from image
                  regenerateParticles();
                }
              } else {
                // No saved default, create new default
                const defaultImageData = createDefaultImage(800, 600);
                currentImageDataRef.current = defaultImageData;
                setCurrentFileHash(null);
                regenerateParticles();
              }
            }}>Default</Button>
          <Button size="sm" className="bg-green-600/30 hover:bg-green-600/45 text-green-100 border border-green-400/20 flex-shrink-0" onClick={handleRefresh}>Refresh</Button>
          <Button size="sm" className="bg-blue-600/30 hover:bg-blue-600/45 text-blue-100 border border-blue-400/20 flex-shrink-0" onClick={() => {
            const imageDataUrl = currentImageDataRef.current 
              ? imageDataToDataUrl(currentImageDataRef.current)
              : null;
            saveDefaultState(imageDataUrl);
            alert('Default configuration saved!');
          }}>Save Default</Button>
        </div>
        {/* No mode tabs; unified sidebar */}
      </div>

      {/* Scrollable content */}
      <div className="p-4 pt-5 pb-6 space-y-4 text-sm">
          <div className="space-y-3">
            <div
              className="flex items-center justify-between py-1 cursor-pointer"
              onClick={() => toggleSection('main')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Main</h4>
              {openSections.main ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.main && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 space-y-4">
              
              {/* Image Upload Subsection */}
              <div className="bg-slate-800/50 border border-slate-700/40 rounded p-3">
                <h5 className="text-xs uppercase tracking-wider text-cyan-300/80 mb-3 font-semibold">Image Upload</h5>
                <div className="space-y-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 px-3 bg-gradient-to-r from-cyan-600/40 to-purple-600/40 hover:from-cyan-600/60 hover:to-purple-600/60 text-white/90 border border-cyan-400/30 rounded text-sm font-medium transition-all"
                  >
                    {currentImageDataRef.current ? '📷 Change Image' : '📷 Upload Image'}
                  </button>
                  
                  {currentImageDataRef.current && (
                    <div className="bg-slate-700/30 rounded p-2 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-300/70">Dimensions:</span>
                        <span className="text-xs font-mono text-cyan-300">{currentImageDataRef.current.width} × {currentImageDataRef.current.height}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-300/70">Aspect Ratio:</span>
                        <span className="text-xs font-mono text-cyan-300">
                          {(currentImageDataRef.current.width / currentImageDataRef.current.height).toFixed(2)}:1
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-purple-300/70">Total Pixels:</span>
                        <span className="text-xs font-mono text-cyan-300">
                          {(currentImageDataRef.current.width * currentImageDataRef.current.height / 1_000_000).toFixed(2)}M
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Animation Mode Selector - Beautiful Cards */}
              <div className="mb-4">
                <label className="block text-xs text-purple-300/80 mb-2">Animation Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Particles Mode Card */}
                  <button
                    onClick={() => {
                      updateSettings({ animationMode: 'particles' });
                      // Use setTimeout to allow state update to complete before regenerating
                      setTimeout(() => regenerateParticles(), 0);
                    }}
                    className={`relative overflow-hidden rounded-lg border-2 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-2 h-24 ${
                      settings.animationMode === 'particles'
                        ? 'border-cyan-400/60 bg-cyan-500/20 shadow-lg shadow-cyan-500/30'
                        : 'border-slate-600/60 bg-slate-800/40 hover:border-cyan-400/40 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-2xl">●●●</div>
                    <div className="text-xs font-medium text-center">Particles</div>
                  </button>

                  {/* Image Crops Mode Card */}
                  <button
                    onClick={() => {
                      updateSettings({ animationMode: 'imageCrops' });
                      // Use setTimeout to allow state update to complete before regenerating
                      setTimeout(() => regenerateParticles(), 0);
                    }}
                    className={`relative overflow-hidden rounded-lg border-2 p-3 transition-all duration-300 flex flex-col items-center justify-center gap-2 h-24 ${
                      settings.animationMode === 'imageCrops'
                        ? 'border-fuchsia-400/60 bg-fuchsia-500/20 shadow-lg shadow-fuchsia-500/30'
                        : 'border-slate-600/60 bg-slate-800/40 hover:border-fuchsia-400/40 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-2xl">⊞⊞⊞</div>
                    <div className="text-xs font-medium text-center">Image Crops</div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                {/* Particles Mode Controls */}
                {settings.animationMode === 'particles' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-purple-300/80 mb-1">
                      <span className="inline-flex items-center gap-1">Grid Resolution (Density)
                        <span title="Number of particles generated from the image. Higher density = more particles and finer detail but heavier on performance."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                      </span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <Slider
                        value={[settings.particleDensity]}
                        onValueChange={handleDensityChange}
                        max={50000}
                        min={100}
                        step={100}
                        className="flex-1"
                      />
                      <input
                        type="number"
                        value={settings.particleDensity}
                        onChange={(e) => {
                          const newValue = Math.max(100, Math.min(50000, parseInt(e.target.value) || 100));
                          handleDensityChange([newValue]);
                        }}
                        min={100}
                        max={50000}
                        step={100}
                        className="w-20 px-2 py-1 text-sm bg-slate-800 border border-slate-700 rounded text-purple-200 text-center"
                      />
                    </div>
                    <div className="text-xs text-purple-300/70 mt-1">{particleCount} particles</div>
                  </div>
                )}

                {/* Image Crops Mode Controls */}
                {settings.animationMode === 'imageCrops' && (
                  <>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-purple-300/80 mb-2">
                        <span className="inline-flex items-center gap-1">Grid Size
                          <span title="Number of tiles per side (8-64). Total tiles = gridSize × gridSize. Enter value and click ReCalculate."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                        </span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="number"
                          value={gridSizeInput}
                          onChange={(e) => setGridSizeInput(e.target.value)}
                          min={8}
                          max={64}
                          step={1}
                          className="flex-1 px-2 py-2 text-sm bg-slate-800 border border-slate-700 rounded text-purple-200"
                          placeholder="16"
                        />
                        <Button
                          size="sm"
                          onClick={handleGridSizeRecalculate}
                          className="h-9 bg-cyan-600/50 hover:bg-cyan-600/70 text-cyan-100 border border-cyan-400/30 whitespace-nowrap"
                        >
                          ReCalculate
                        </Button>
                      </div>
                      <div className="text-xs text-purple-300/70 mt-2">
                        {(() => {
                          const gridSize = Math.max(8, Math.min(64, parseInt(gridSizeInput) || 16));
                          return `${gridSize}×${gridSize} grid = ${gridSize * gridSize} tiles`;
                        })()}
                      </div>
                    </div>

                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tileRotationOnScatter"
                          checked={settings.tileRotationOnScatter ?? true}
                          onChange={(e) => updateSettings({ tileRotationOnScatter: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="tileRotationOnScatter" className="text-xs text-purple-200">
                          Rotate tiles when scattered
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tileGlowOnScatter"
                          checked={settings.tileGlowOnScatter ?? false}
                          onChange={(e) => updateSettings({ tileGlowOnScatter: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="tileGlowOnScatter" className="text-xs text-purple-200">
                          Glow tiles when scattered
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">Shape</label>
                  <Select value={settings.particleShape} onValueChange={(v: 'circle'|'square'|'triangle')=>updateSettings({ particleShape: v })}>
                    <SelectTrigger className="w-full h-8 bg-slate-800 border-slate-700 text-purple-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="triangle">Triangle</SelectItem>
              </SelectContent>
            </Select>
          </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">Canvas Background</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Pick canvas background color"
                      onClick={() => colorInputRef.current?.click()}
                      className="w-8 h-8 rounded border border-slate-700 shadow-inner"
                      style={{ backgroundColor: settings.canvasBackgroundColor }}
                    />
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={settings.canvasBackgroundColor}
                      onChange={(e)=>updateSettings({ canvasBackgroundColor: e.target.value })}
                      className="sr-only"
                    />
                    <input
                      type="text"
                      value={settings.canvasBackgroundColor}
                      onChange={(e)=>updateSettings({ canvasBackgroundColor: e.target.value })}
                      className="flex-1 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs"
                    />
        </div>
      </div>
                {/* Background Image */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">Background Image</label>
                  {!settings.backgroundImage?.imageDataUrl ? (
                    <Button
                      size="sm"
                      onClick={() => backgroundImageInputRef.current?.click()}
                      className="w-full h-8 bg-slate-800 hover:bg-slate-700 text-purple-200"
                    >
                      Upload Background Image
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={settings.backgroundImage.imageDataUrl}
                          alt="Background"
                          className="w-16 h-16 object-cover rounded border border-slate-700"
                        />
                        <Button
                          size="sm"
                          onClick={() => setBackgroundImage(null)}
                          className="h-8 bg-red-600/70 hover:bg-red-600/80 text-white"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Remove
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setShowBackgroundAdjustments(!showBackgroundAdjustments)}
                          className="h-8 bg-slate-800 hover:bg-slate-700 text-purple-200"
                        >
                          {showBackgroundAdjustments ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          Adjust
                        </Button>
                      </div>
                      {showBackgroundAdjustments && settings.backgroundImage && (
                        <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 space-y-3">
                          {/* Format mismatch warning */}
                          {(() => {
                            const canvasWidth = desiredCanvasSize?.width || 800;
                            const canvasHeight = desiredCanvasSize?.height || 600;
                            const mismatch = detectFormatMismatch(
                              settings.backgroundImage.originalWidth,
                              settings.backgroundImage.originalHeight,
                              canvasWidth,
                              canvasHeight
                            );
                            if (mismatch.aspectRatioMismatch || mismatch.dimensionMismatch) {
                              return (
                                <div className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded p-2">
                                  Format mismatch detected. Adjust image to match canvas.
                                </div>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Scale */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">
                              Scale
                              <Info className="inline-block w-3 h-3 ml-1" />
                            </label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[settings.backgroundImage.scale]}
                                onValueChange={(v) => updateBackgroundImage({ scale: v[0] })}
                                min={0.1}
                                max={5.0}
                                step={0.01}
                                className="flex-1"
                              />
                              <input
                                type="number"
                                value={settings.backgroundImage.scale.toFixed(2)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    updateBackgroundImage({ scale: Math.max(0.1, Math.min(5.0, val)) });
                                  }
                                }}
                                step={0.01}
                                min={0.1}
                                max={5.0}
                                className="w-16 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs text-center"
                              />
                              <span className="text-xs text-purple-300/60 w-5">x</span>
                            </div>
                          </div>
                          
                          {/* Position X */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Position X</label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[settings.backgroundImage.positionX]}
                                onValueChange={(v) => updateBackgroundImage({ positionX: v[0] })}
                                min={-(desiredCanvasSize?.width || 800)}
                                max={desiredCanvasSize?.width || 800}
                                step={0.1}
                                className="flex-1"
                              />
                              <input
                                type="number"
                                value={settings.backgroundImage.positionX.toFixed(2)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    const max = desiredCanvasSize?.width || 800;
                                    updateBackgroundImage({ positionX: Math.max(-max, Math.min(max, val)) });
                                  }
                                }}
                                step={0.1}
                                min={-(desiredCanvasSize?.width || 800)}
                                max={desiredCanvasSize?.width || 800}
                                className="w-16 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs text-center"
                              />
                              <span className="text-xs text-purple-300/60 w-6">px</span>
                            </div>
                          </div>
                          
                          {/* Position Y */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Position Y</label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[settings.backgroundImage.positionY]}
                                onValueChange={(v) => updateBackgroundImage({ positionY: v[0] })}
                                min={-(desiredCanvasSize?.height || 600)}
                                max={desiredCanvasSize?.height || 600}
                                step={0.1}
                                className="flex-1"
                              />
                              <input
                                type="number"
                                value={settings.backgroundImage.positionY.toFixed(2)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    const max = desiredCanvasSize?.height || 600;
                                    updateBackgroundImage({ positionY: Math.max(-max, Math.min(max, val)) });
                                  }
                                }}
                                step={0.1}
                                min={-(desiredCanvasSize?.height || 600)}
                                max={desiredCanvasSize?.height || 600}
                                className="w-16 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs text-center"
                              />
                              <span className="text-xs text-purple-300/60 w-6">px</span>
                            </div>
                          </div>
                          
                          {/* Width */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Width</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={settings.backgroundImage.width ?? settings.backgroundImage.originalWidth}
                                onChange={(e) => {
                                  const newWidth = Number(e.target.value);
                                  if (settings.backgroundImage) {
                                    if (settings.backgroundImage.aspectRatioLock) {
                                      const aspectRatio = settings.backgroundImage.originalWidth / settings.backgroundImage.originalHeight;
                                      const newHeight = newWidth / aspectRatio;
                                      updateBackgroundImage({ width: newWidth, height: newHeight });
                                    } else {
                                      updateBackgroundImage({ width: newWidth });
                                    }
                                  }
                                }}
                                className="flex-1 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs"
                              />
                              <Button
                                size="sm"
                                onClick={() => updateBackgroundImage({ width: null })}
                                className="h-8 px-2 bg-slate-700 hover:bg-slate-600 text-purple-200 text-xs"
                              >
                                Reset
                              </Button>
                            </div>
                          </div>
                          
                          {/* Height */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Height</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={settings.backgroundImage.height ?? settings.backgroundImage.originalHeight}
                                onChange={(e) => {
                                  const newHeight = Number(e.target.value);
                                  if (settings.backgroundImage) {
                                    if (settings.backgroundImage.aspectRatioLock) {
                                      const aspectRatio = settings.backgroundImage.originalWidth / settings.backgroundImage.originalHeight;
                                      const newWidth = newHeight * aspectRatio;
                                      updateBackgroundImage({ width: newWidth, height: newHeight });
                                    } else {
                                      updateBackgroundImage({ height: newHeight });
                                    }
                                  }
                                }}
                                className="flex-1 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs"
                              />
                              <Button
                                size="sm"
                                onClick={() => updateBackgroundImage({ height: null })}
                                className="h-8 px-2 bg-slate-700 hover:bg-slate-600 text-purple-200 text-xs"
                              >
                                Reset
                              </Button>
                            </div>
                          </div>
                          
                          {/* Aspect Ratio Lock */}
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="aspectRatioLock"
                              checked={settings.backgroundImage.aspectRatioLock}
                              onChange={(e) => updateBackgroundImage({ aspectRatioLock: e.target.checked })}
                              className="w-4 h-4"
                            />
                            <label htmlFor="aspectRatioLock" className="text-xs text-purple-300/80">
                              Lock Aspect Ratio
                            </label>
                          </div>
                          
                          {/* Rotation */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Rotation</label>
                            <Slider
                              value={[settings.backgroundImage.rotation]}
                              onValueChange={(v) => updateBackgroundImage({ rotation: v[0] })}
                              min={0}
                              max={360}
                              step={1}
                              className="w-full"
                            />
                            <div className="text-xs text-purple-300/60 mt-1">
                              {Math.round(settings.backgroundImage.rotation)}°
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={backgroundImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        console.log('[BackgroundImage] No file selected');
                        return;
                      }
                      
                      console.log('[BackgroundImage] Starting background image upload:', file.name, file.size, file.type);
                      
                      try {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          console.log('[BackgroundImage] File read successfully, loading as image');
                          const img = new Image();
                          img.onload = () => {
                            console.log('[BackgroundImage] Image loaded:', img.width, 'x', img.height);
                            const backgroundSettings = {
                              imageDataUrl: dataUrl,
                              scale: 1.0,
                              positionX: 0,
                              positionY: 0,
                              width: null,
                              height: null,
                              rotation: 0,
                              aspectRatioLock: true,
                              originalWidth: img.width,
                              originalHeight: img.height,
                            };
                            console.log('[BackgroundImage] Setting background image:', backgroundSettings);
                            setBackgroundImage(backgroundSettings);
                            
                            // Also store in session memory for canvas rendering
                            if (typeof window !== 'undefined') {
                              (window as any).__tempBackgroundImageDataUrl = dataUrl;
                              console.log('[BackgroundImage] Stored dataUrl in session memory');
                            }
                            
                            setShowBackgroundAdjustments(true);
                            console.log('[BackgroundImage] Background image set successfully');
                          };
                          img.onerror = () => {
                            console.error('[BackgroundImage] Failed to load image - invalid image format or corrupted file');
                            alert('Failed to load background image. Please check the file format.');
                            backgroundImageInputRef.current!.value = '';
                          };
                          img.src = dataUrl;
                        };
                        reader.onerror = () => {
                          console.error('[BackgroundImage] Failed to read file');
                          alert('Failed to read background image file.');
                          backgroundImageInputRef.current!.value = '';
                        };
                        reader.readAsDataURL(file);
                      } catch (error) {
                        console.error('[BackgroundImage] Unexpected error:', error);
                        alert('An error occurred while loading the background image.');
                        backgroundImageInputRef.current!.value = '';
                      }
                    }}
                  />
                </div>
                
                {/* Particle Opacity */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">
                    Particle Opacity
                    <Info className="inline-block w-3 h-3 ml-1" />
                  </label>
                  <Slider
                    value={[settings.particleOpacity]}
                    onValueChange={(v) => setParticleOpacity(v[0])}
                    min={0}
                    max={1}
                    step={0.01}
                    className="w-full"
                  />
                  <div className="text-xs text-purple-300/60 mt-1">
                    {Math.round(settings.particleOpacity * 100)}%
                  </div>
                </div>
                {/* Canvas Size Preset */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">Canvas Size</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                    <div className="sm:col-span-1">
                      <Select
                        value={canvasPreset}
                        onValueChange={(v: any) => {
                          const preset = v as CanvasPreset;
                          setCanvasPreset(preset);
                          let w = customWidth;
                          let h = customHeight;
                          if (preset === 'instagramReel') { w = 1080; h = 1920; }
                          if (preset === 'youtube') { w = 1920; h = 1080; }
                          if (preset === 'square') { w = 1080; h = 1080; }
                          if (preset === 'original') {
                            const img = currentImageDataRef.current;
                            if (img) { w = img.width; h = img.height; }
                          }
                          if (preset !== 'custom') {
                            setCustomWidth(w); setCustomHeight(h);
                            setDesiredCanvasSize({ width: w, height: h });
                            regenerateParticles(undefined, undefined, { width: w, height: h });
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-8 bg-slate-800 border-slate-700 text-purple-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">Original (Image Size)</SelectItem>
                          <SelectItem value="instagramReel">Instagram Reel (1080x1920)</SelectItem>
                          <SelectItem value="youtube">YouTube (1920x1080)</SelectItem>
                          <SelectItem value="square">Square (1080x1080)</SelectItem>
                          <SelectItem value="custom">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2">
                      <input
                        type="number"
                        value={customWidth}
                        min={100}
                        onChange={(e)=>setCustomWidth(Number(e.target.value))}
                        className="w-28 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs disabled:opacity-50"
                        disabled={canvasPreset !== 'custom'}
                      />
                      <span className="text-purple-300/70 text-xs">x</span>
                      <input
                        type="number"
                        value={customHeight}
                        min={100}
                        onChange={(e)=>setCustomHeight(Number(e.target.value))}
                        className="w-28 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs disabled:opacity-50"
                        disabled={canvasPreset !== 'custom'}
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={()=>{
                          if (canvasPreset === 'custom') {
                            setDesiredCanvasSize({ width: customWidth, height: customHeight });
                            regenerateParticles(undefined, undefined, { width: customWidth, height: customHeight });
                          }
                        }}
                      >Apply</Button>
                    </div>
                  </div>
                </div>
                {/* Image Scale */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-purple-300/80 inline-flex items-center gap-1">Image Scale
                      <span title="Scale the generated particle positions relative to the source image. >1 zooms in, <1 zooms out. Centered in canvas."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                    </label>
                    <div className="text-[11px] text-purple-400">{(settings.imageScale ?? 1).toFixed(2)} (0.25..3)</div>
                  </div>
                  <Slider
                    value={[settings.imageScale ?? 1]}
                    onValueChange={([v])=>{ 
                      updateSettings({ imageScale: v }); 
                      // Regenerate particles with updated imageScale setting
                      regenerateParticles();
                    }}
                    max={3}
                    min={0.25}
                    step={0.01}
                    className="w-full"
                  />
                </div>
          </div>
        </div>
            )}

            {/* Wall Properties Section */}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('wallProperties')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Wall Properties</h4>
              {openSections.wallProperties ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />
              )}
            </div>
            {openSections.wallProperties && (
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3 space-y-3">
                {/* Wall Enable/Disable Toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-purple-300/80 mb-1">Collisions</label>
                    <Button 
                      variant={settings.wallsEnabled ? 'default' : 'outline'} 
                      onClick={toggleWalls} 
                      className={`w-full h-8 text-xs ${settings.wallsEnabled ? 'bg-green-600/20 hover:bg-green-600/30 text-green-200' : 'border-red-500/40 text-red-300 hover:bg-red-500/10'}`}
                    >
                      {settings.wallsEnabled ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                  
                  {/* Wall Repulsion Toggle */}
                  <div>
                    <label className="block text-xs text-purple-300/80 mb-1">Repulsion</label>
                    <Button 
                      variant={settings.wallRepulsion?.enabled ? 'default' : 'outline'} 
                      onClick={() => updateSettings({ wallRepulsion: { ...settings.wallRepulsion, enabled: !settings.wallRepulsion?.enabled } })}
                      className={`w-full h-8 text-xs ${settings.wallRepulsion?.enabled ? 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-200' : 'border-slate-500/40 text-slate-300 hover:bg-slate-500/10'}`}
                    >
                      {settings.wallRepulsion?.enabled ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                </div>

                {/* Wall Mode Selector: Bounce vs Confine */}
                {settings.wallsEnabled && (
                  <div>
                    <label className="block text-xs text-purple-300/80 mb-2">Wall Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={(settings as any).wallMode === 'bounce' || !(settings as any).wallMode ? 'default' : 'outline'}
                        onClick={() => updateSettings({ wallMode: 'bounce' })}
                        className="w-full h-8 text-xs"
                      >
                        Bounce
                      </Button>
                      <Button
                        variant={(settings as any).wallMode === 'confine' ? 'default' : 'outline'}
                        onClick={() => updateSettings({ wallMode: 'confine' })}
                        className="w-full h-8 text-xs"
                      >
                        Confine
                      </Button>
                    </div>
                    <div className="text-xs text-purple-400/60 italic mt-2">
                      <p><span className="text-cyan-400">Bounce:</span> Elastic collision with bouncing</p>
                      <p><span className="text-cyan-400">Confine:</span> Lock to boundary, no displacement</p>
                    </div>
                  </div>
                )}

                {/* Wall Repulsion Strength Slider */}
                {settings.wallRepulsion?.enabled && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-purple-300/80">Repulsion Strength</label>
                      <span className="text-xs text-purple-400">{(settings.wallRepulsion?.strength ?? 1.0).toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[settings.wallRepulsion?.strength ?? 1.0]}
                      onValueChange={(v) => updateSettings({ wallRepulsion: { ...settings.wallRepulsion, strength: v[0] } })}
                      min={0}
                      max={5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                )}

                {/* Wall Repulsion Description */}
                <div className="text-xs text-purple-400/60 italic">
                  <p>Collisions: Enable/disable wall interaction</p>
                  <p>Repulsion: Push particles away from edges when moving</p>
                </div>
              </div>
            )}

            {/* Force Presets moved below Wall Properties */}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('forcePresets')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Force Animate</h4>
              {openSections.forcePresets ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.forcePresets && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              {(() => {
                const presetLabels: Record<ForcePulseType, string> = {
                  gravity: 'Gravity', wind: 'Wind', tornado: 'Tornado', shockwave: 'Shockwave', noise: 'Noise Gust',
                  ripple: 'Ripple', burst: 'Burst', implosion: 'Implosion', magnetPair: 'Magnet Pair', waterfall: 'Waterfall',
                  gravityFlip: 'Gravity Flip', shear: 'Shear', crosswind: 'Crosswind', swirlField: 'Swirl Field', ringSpin: 'Ring Spin',
                  spiralIn: 'Spiral In', spiralOut: 'Spiral Out', waveLeft: 'Wave Left', waveUp: 'Wave Up', randomJitter: 'Random Jitter',
                  supernova: 'Supernova', ringBurst: 'Ring Burst', edgeBurst: 'Edge Burst', multiBurst: 'Multi Burst', quake: 'Quake',
                  randomize: 'Randomize',
                };

                const onImpact = () => {
                  const base: any = { 
                    type: pulseSelected, 
                    // In continuous mode, use very long duration (will be re-enqueued indefinitely)
                    // In impulse mode, use the configured duration
                    durationMs: forceMode === 'continuous' ? 999999 : pulseDuration,
                    inertiaMs: forceMode === 'continuous' ? 0 : pulseInertia,
                    holdTimeMs: pulseHoldTime,
                    strength: pulseStrength * pulseStrengthMultiplier,
                    easeIn: easeIn,
                    easeOut: easeOut,
                    easeType: easeType,
                    mode: forceMode,
                  };
                  // Direction-based types
                  if (['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) {
                    base.directionDeg = pulseDirectionDeg;
                  }
                  // Rotation-based types
                  if (['tornado','ringSpin'].includes(pulseSelected)) {
                    base.clockwise = pulseClockwise;
                  }
                  // Frequency-based types
                  if (['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) {
                    base.frequency = pulseFrequency;
                  }
                  // Chaos-based types
                  if (['noise','randomJitter'].includes(pulseSelected)) {
                    base.chaos = pulseChaos;
                  }
                  // Origin-based types
                  if (['shockwave','ripple','burst','implosion','supernova','ringBurst','edgeBurst','multiBurst'].includes(pulseSelected)) {
                    base.origin = { normalized: true, x: pulseOriginX, y: pulseOriginY };
                  }
                  // Radius-based types
                  if (['burst','implosion','shockwave','supernova','ringBurst','edgeBurst'].includes(pulseSelected)) {
                    base.radius = pulseRadius;
                  }
                  // Intensity-based types
                  if (['supernova','quake','burst','implosion'].includes(pulseSelected)) {
                    base.intensity = pulseIntensity;
                  }
                  // Wave count for ripple/wave types
                  if (['ripple','waveLeft','waveUp'].includes(pulseSelected)) {
                    base.waveCount = pulseWaveCount;
                  }
                  // Spiral turns
                  if (['spiralIn','spiralOut'].includes(pulseSelected)) {
                    base.spiralTurns = pulseSpiralTurns;
                  }
                  // Randomize-specific
                  if (pulseSelected === 'randomize') {
                    base.scatterSpeed = randomizeScatterSpeed;
                    base.scatterDurationPercent = randomizeScatterDurationPercent;
                    base.returnDurationPercent = randomizeReturnDurationPercent;
                  }
                  // Update store so canvas button has access to current config
                  updatePulseConfig(base);
                  
                  // Handle continuous mode
                  if (forceMode === 'continuous') {
                    const { continuousForcePulseId, setContinuousForcePulse } = useForceFieldStore.getState();
                    const engine = (window as any).__ff_engine;
                    
                    // Toggle continuous force on/off
                    if (continuousForcePulseId) {
                      // Stop continuous force - remove from engine first
                      if (engine) {
                        engine.removeContinuousPulse(continuousForcePulseId);
                      }
                      setContinuousForcePulse(null);
                    } else {
                      // Start continuous force - generate a unique ID for this pulse
                      const pulseId = `continuous-${Date.now()}`;
                      setContinuousForcePulse(pulseId);
                      if (engine) {
                        // Use setContinuousPulse for continuous mode (will re-enqueue indefinitely)
                        engine.setContinuousPulse(pulseId, base);
                      }
                    }
                  } else {
                    // Impulse mode - fire once
                    enqueuePulse(base);
                  }
                  
                  // Record pulse for deterministic replay if recording is active
                  if (animationRecorderRef.current?.isActive?.()) {
                    animationRecorderRef.current.recordPulse(base);
                  }
                };
                return (
                  <>
                    {/* Force Mode Selector */}
                    <div className="mb-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setForceMode('impulse')}
                        variant="outline"
                        className={`flex-1 h-7 text-xs ${forceMode === 'impulse' ? 'bg-purple-600/40 border-purple-400/60 text-purple-100' : 'border-slate-600 text-slate-300 hover:bg-slate-800/50'}`}
                      >
                        💥 Impulse
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setForceMode('continuous')}
                        variant="outline"
                        className={`flex-1 h-7 text-xs ${forceMode === 'continuous' ? 'bg-cyan-600/40 border-cyan-400/60 text-cyan-100' : 'border-slate-600 text-slate-300 hover:bg-slate-800/50'}`}
                      >
                        ⚡ Continuous
                      </Button>
                    </div>

                    {/* Preset selector and button */}
                    <div className="mb-3 space-y-2">
                      <Select value={pulseSelected} onValueChange={(v: any) => setPulseSelected(v)}>
                        <SelectTrigger className="w-full h-8 bg-slate-800 border-slate-700 text-purple-200">
                          <SelectValue placeholder="Choose preset" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(presetLabels).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={onImpact} className={`w-full h-8 font-semibold transition-all ${
                        forceMode === 'continuous' 
                          ? (localContinuousPulseId 
                              ? 'bg-cyan-600/70 hover:bg-cyan-600/80 text-cyan-100 border-cyan-400/40 border animate-pulse' 
                              : 'bg-cyan-600/40 hover:bg-cyan-600/50 text-cyan-100 border-cyan-400/20 border')
                          : 'bg-purple-600/40 hover:bg-purple-600/60 text-purple-100'
                      }`}>
                        ✨ Animate
                      </Button>
                    </div>

                    {/* Timing & Easing Section - Disabled in continuous mode */}
                    {forceMode === 'impulse' && (
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 mb-3 space-y-2">
                      <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Timing & Easing</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Duration (ms)</label>
                          <input type="number" value={pulseDuration} min={100} max={60000} onChange={(e)=>setPulseDuration(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Hold Time (ms)</label>
                          <input type="number" value={pulseHoldTime} min={0} max={10000} step={100} onChange={(e)=>setPulseHoldTime(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Inertia (ms)
                            <span className="ml-1 text-purple-400/60" title="Time for particles to coast to stop after force ends">ℹ️</span>
                          </label>
                          <input type="number" value={pulseInertia} min={0} max={5000} step={100} onChange={(e)=>setPulseInertia(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] text-purple-300/80 mb-1">
                          Ease Type
                          <span className="ml-1 text-purple-400/60" title="Type of easing curve to apply">ℹ️</span>
                        </label>
                        <Select value={easeType} onValueChange={(v: any) => setEaseType(v)}>
                          <SelectTrigger className="w-full h-7 bg-slate-800 border-slate-700 text-purple-200 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="linear">Linear (no easing)</SelectItem>
                            <SelectItem value="ease-in">Ease In</SelectItem>
                            <SelectItem value="ease-out">Ease Out</SelectItem>
                            <SelectItem value="ease-in-out">Ease In-Out</SelectItem>
                            <SelectItem value="ease-in-quad">Ease In Quad</SelectItem>
                            <SelectItem value="ease-out-quad">Ease Out Quad</SelectItem>
                            <SelectItem value="ease-in-out-quad">Ease In-Out Quad</SelectItem>
                            <SelectItem value="ease-in-cubic">Ease In Cubic</SelectItem>
                            <SelectItem value="ease-out-cubic">Ease Out Cubic</SelectItem>
                            <SelectItem value="ease-in-out-cubic">Ease In-Out Cubic</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">
                            Ease In (0-1)
                            <span className="ml-1 text-purple-400/60" title="How much to ease at start">ℹ️</span>
                          </label>
                          <input type="number" step={0.05} min={0} max={1} value={easeIn} onChange={(e)=>setEaseIn(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">
                            Ease Out (0-1)
                            <span className="ml-1 text-purple-400/60" title="How much to ease at end">ℹ️</span>
                          </label>
                          <input type="number" step={0.05} min={0} max={1} value={easeOut} onChange={(e)=>setEaseOut(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Force Parameters Section */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 mb-3 space-y-2">
                      <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Force Parameters</div>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Strength</label>
                          <div className="grid grid-cols-3 gap-2">
                            <input type="number" value={pulseStrength} min={1} max={200} step={1} onChange={(e)=>setPulseStrength(Number(e.target.value))} className="col-span-2 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                            <select value={pulseStrengthMultiplier} onChange={(e)=>setPulseStrengthMultiplier(Number(e.target.value))} className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs">
                              <option value={1}>×1</option>
                              <option value={2}>×2</option>
                              <option value={5}>×5</option>
                              <option value={10}>×10</option>
                              <option value={30}>×30</option>
                              <option value={50}>×50</option>
                              <option value={100}>×100</option>
                            </select>
                          </div>
                        </div>
                        {(['burst','implosion','shockwave','supernova','ringBurst','edgeBurst','quake'].includes(pulseSelected)) && (
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Intensity</label>
                            <input type="number" step={0.1} min={0.1} max={5} value={pulseIntensity} onChange={(e)=>setPulseIntensity(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        )}
                        {(['burst','implosion','shockwave','supernova','ringBurst','edgeBurst'].includes(pulseSelected)) && (
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Radius (px)</label>
                            <input type="number" step={50} min={10} max={3000} value={pulseRadius} onChange={(e)=>setPulseRadius(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Direction & Rotation Section */}
                    <div className="space-y-2">
                      {(['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Direction</div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Direction (deg)</label>
                            <input type="number" value={pulseDirectionDeg} min={-360} max={360} step={1} onChange={(e)=>setPulseDirectionDeg(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        </div>
                      )}
                      {(['tornado','ringSpin'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase mb-2">Rotation</div>
                          <div className="flex items-center gap-2">
                            <input id="pulseClockwise" type="checkbox" checked={pulseClockwise} onChange={(e)=>setPulseClockwise(e.target.checked)} />
                            <label htmlFor="pulseClockwise" className="text-xs text-purple-200">Clockwise</label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Frequency & Chaos Section */}
                    <div className="space-y-2">
                      {(['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Wave Parameters</div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Frequency</label>
                            <input type="number" step={0.1} min={0.1} max={10} value={pulseFrequency} onChange={(e)=>setPulseFrequency(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          {(['ripple','waveLeft','waveUp'].includes(pulseSelected)) && (
                            <div>
                              <label className="block text-[11px] text-purple-300/80 mb-1">Wave Count</label>
                              <input type="number" step={1} min={1} max={20} value={pulseWaveCount} onChange={(e)=>setPulseWaveCount(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                            </div>
                          )}
                        </div>
                      )}
                      {(['noise','randomJitter'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Chaos</div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Chaos</label>
                            <input type="number" step={0.05} min={0} max={2} value={pulseChaos} onChange={(e)=>setPulseChaos(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Origin & Geometry Section */}
                    <div className="space-y-2">
                      {(['shockwave','ripple','burst','implosion','supernova','ringBurst','edgeBurst','multiBurst'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Origin</div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] text-purple-300/80 mb-1">Origin X (0..1)</label>
                              <input type="number" step={0.05} min={0} max={1} value={pulseOriginX} onChange={(e)=>setPulseOriginX(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-purple-300/80 mb-1">Origin Y (0..1)</label>
                              <input type="number" step={0.05} min={0} max={1} value={pulseOriginY} onChange={(e)=>setPulseOriginY(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                            </div>
                          </div>
                        </div>
                      )}
                      {(['spiralIn','spiralOut'].includes(pulseSelected)) && (
                        <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                          <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Spiral</div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Spiral Turns</label>
                            <input type="number" step={0.5} min={0.5} max={10} value={pulseSpiralTurns} onChange={(e)=>setPulseSpiralTurns(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Randomize-specific controls */}
                    {(pulseSelected === 'randomize') && (
                      <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 space-y-2">
                        <div className="text-[10px] font-semibold text-purple-300/70 uppercase mb-2">Randomize Animation</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Scatter Speed</label>
                            <input type="number" step={0.1} min={0.5} max={10} value={randomizeScatterSpeed} onChange={(e)=>setRandomizeScatterSpeed(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Scatter Duration (%)</label>
                            <input type="number" step={5} min={10} max={80} value={randomizeScatterDurationPercent} onChange={(e)=>setRandomizeScatterDurationPercent(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Hold Time (ms)</label>
                            <input type="number" step={50} min={0} max={5000} value={randomizeHoldTime} onChange={(e)=>setRandomizeHoldTime(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Return Duration (%)</label>
                            <input type="number" step={5} min={10} max={80} value={randomizeReturnDurationPercent} onChange={(e)=>setRandomizeReturnDurationPercent(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                        </div>
                        {/* Duration breakdown display */}
                        <div className="bg-slate-800/50 border border-slate-700/50 rounded p-2 text-[10px] text-purple-300/70">
                          <div className="font-semibold mb-1 text-purple-200/80">Animation Timeline:</div>
                          <div className="space-y-0.5">
                            <div>• Scatter: {randomizeScatterDurationPercent}% ({Math.round(pulseDuration * randomizeScatterDurationPercent / 100)}ms)</div>
                            <div>• Hold: {randomizeHoldTime}ms</div>
                            <div>• Return: {randomizeReturnDurationPercent}% ({Math.round(pulseDuration * randomizeReturnDurationPercent / 100)}ms)</div>
                            {(() => {
                              const scatterMs = Math.round(pulseDuration * randomizeScatterDurationPercent / 100);
                              const returnMs = Math.round(pulseDuration * randomizeReturnDurationPercent / 100);
                              const totalUsed = scatterMs + randomizeHoldTime + returnMs;
                              const remaining = pulseDuration - totalUsed;
                              if (remaining > 0) {
                                return <div className="text-purple-400/60 italic">• Transition: {remaining}ms</div>;
                              } else if (remaining < 0) {
                                return <div className="text-orange-400/80 italic">⚠️ Exceeds by {Math.abs(remaining)}ms</div>;
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            )}

            {/* Export */}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('export')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Export</h4>
              {openSections.export ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)}
            </div>
            {openSections.export && (
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-purple-300/80 mb-1">Preset</label>
                    <Select
                      value={exportSettings.preset}
                      onValueChange={(v: any) => {
                        let w = exportSettings.width, h = exportSettings.height;
                        if (v === 'instagramReel') { w = 1080; h = 1920; }
                        if (v === 'youtube') { w = 1920; h = 1080; }
                        if (v === 'square') { w = 1080; h = 1080; }
                        if (v === 'original') {
                          const img = currentImageDataRef.current;
                          if (img) { w = img.width; h = img.height; }
                        }
                        setExportSettings({ preset: v, width: w, height: h });
                      }}
                    >
                    
                      <SelectTrigger className="w-full h-8 bg-slate-800 border-slate-700 text-purple-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">Original (Image)</SelectItem>
                        <SelectItem value="instagramReel">Instagram Reel 1080x1920</SelectItem>
                        <SelectItem value="youtube">YouTube 1920x1080</SelectItem>
                        <SelectItem value="square">Square 1080x1080</SelectItem>
                        <SelectItem value="custom">Custom…</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" value={exportSettings.width} min={100} onChange={(e)=>setExportSettings({ width: Number(e.target.value) })} className="w-28 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs disabled:opacity-50" disabled={exportSettings.preset !== 'custom'} />
                    <span className="text-purple-300/70 text-xs">x</span>
                    <input type="number" value={exportSettings.height} min={100} onChange={(e)=>setExportSettings({ height: Number(e.target.value) })} className="w-28 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs disabled:opacity-50" disabled={exportSettings.preset !== 'custom'} />
                  </div>
                  {exportSettings.preset === 'original' && currentImageDataRef.current && (
                    <div className="text-xs text-cyan-300/80 bg-slate-700/30 rounded px-2 py-1">
                      Real dimensions: {currentImageDataRef.current.width} × {currentImageDataRef.current.height}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-purple-300/80">FPS</label>
                    <input type="number" value={exportSettings.fps} min={1} max={120} onChange={(e)=>setExportSettings({ fps: Number(e.target.value) })} className="w-20 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {/* Record/Stop Button */}
                  <Button
                    size="sm"
                    className={`w-full ${isRecording ? 'bg-red-600/70 hover:bg-red-600/80' : 'bg-green-600/70 hover:bg-green-600/80'} h-8 px-3 flex items-center justify-center gap-2`}
                    onClick={() => {
                      if (!isRecording) {
                        // Start both video and animation recording
                        const { preset, width, height } = exportSettings;
                        let w = width, h = height;
                        if (preset !== 'custom') {
                          if (preset === 'instagramReel') { w = 1080; h = 1920; }
                          if (preset === 'youtube') { w = 1920; h = 1080; }
                          if (preset === 'square') { w = 1080; h = 1080; }
                          if (preset === 'original') { const img = currentImageDataRef.current; if (img) { w = img.width; h = img.height; } }
                        }
                        setDesiredCanvasSize({ width: w, height: h });
                        // Start animation recording first
                        handleStartAnimationRecording();
                        // Then start video recording
                        startRecording();
                      } else {
                        // Stop both video and animation recording
                        stopRecording();
                        // Stop animation recording after video stops
                        setTimeout(() => handleStopAnimationRecording(), 100);
                      }
                    }}
                  >
                    <span className={`inline-block w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-red-300' : 'bg-green-300'}`} />
                    {isRecording ? 'Stop Recording' : 'Start Recording'}
                  </Button>
                  
                  {/* Download/Convert Buttons Grid */}
                  {recordingUrl && (
                    <div className="w-full space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          className="bg-blue-600/30 hover:bg-blue-600/45 text-blue-100 border border-blue-400/20 h-8"
                          onClick={() => {
                            try {
                              // Generate filename with readable timestamp
                              const now = new Date();
                              const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
                              const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-');
                              
                              // Download original format (WebM or MP4)
                              const extension = recordingMimeType?.includes('mp4') ? 'mp4' : 'webm';
                              const filename = `forcefield_${dateStr}_${timeStr}.${extension}`;
                              
                              const link = document.createElement('a');
                              link.href = recordingUrl;
                              link.download = filename;
                              link.style.display = 'none';
                              document.body.appendChild(link);
                              link.click();
                              setTimeout(() => {
                                document.body.removeChild(link);
                              }, 100);
                            } catch (error) {
                              console.error('Failed to download video:', error);
                              alert(`Failed to download video: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }}
                        >
                          Download WebM
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('forces')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Forces</h4>
              {openSections.forces ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.forces && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <ForceTypeControls />
              <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
                  <label className="block text-xs text-purple-300/80 mb-1">Combine Forces</label>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={!!settings.combineForces} onChange={(e)=>updateSettings({ combineForces: e.target.checked })} />
                    <span className="text-xs text-purple-300/80">Enable</span>
                  </div>
                </div>
              </div>
            </div>
            )}

            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('visuals')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Visuals</h4>
              {openSections.visuals ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.visuals && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <input id="trailsEnabled" type="checkbox" checked={currentVisual.trailsEnabled} onChange={(e)=>updateSettings({ visual: { ...currentVisual, trailsEnabled: e.target.checked } })} />
                  <label htmlFor="trailsEnabled" className="text-xs text-purple-200">Trails</label>
                </div>
                <div>
                  <label className="block text-xs text-purple-300/80 mb-1">Trail Fade</label>
                  <input type="number" step={0.01} value={currentVisual.trailFade} min={0} max={1} onChange={(e)=>updateSettings({ visual: { ...currentVisual, trailFade: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <input id="glowEnabled" type="checkbox" checked={currentVisual.glowEnabled} onChange={(e)=>updateSettings({ visual: { ...currentVisual, glowEnabled: e.target.checked } })} />
                  <label htmlFor="glowEnabled" className="text-xs text-purple-200">Glow</label>
                </div>
                <div>
                  <label className="block text-xs text-purple-300/80 mb-1">Glow Strength</label>
                  <input type="number" step={1} value={currentVisual.glowStrength} min={0} max={64} onChange={(e)=>updateSettings({ visual: { ...currentVisual, glowStrength: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <input id="additiveBlend" type="checkbox" checked={currentVisual.additiveBlend} onChange={(e)=>updateSettings({ visual: { ...currentVisual, additiveBlend: e.target.checked } })} />
                  <label htmlFor="additiveBlend" className="text-xs text-purple-200">Additive Blend</label>
                </div>
              </div>
            </div>
            )}

            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('performance')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Performance</h4>
              {openSections.performance ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.performance && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 h-8">
                  <input id="adaptiveEnabled" type="checkbox" checked={currentPerformance.adaptiveEnabled} onChange={(e)=>updateSettings({ performance: { ...currentPerformance, adaptiveEnabled: e.target.checked } })} />
                  <label htmlFor="adaptiveEnabled" className="text-xs text-purple-200">Adaptive Mode</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Target FPS</label>
                    <input type="number" value={currentPerformance.targetFps} min={24} max={120} onChange={(e)=>updateSettings({ performance: { ...currentPerformance, targetFps: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                </div>
          <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Minimum Visible Fraction</label>
                    <input type="number" step={0.05} value={currentPerformance.minVisibleFraction} min={0.1} max={1} onChange={(e)=>updateSettings({ performance: { ...currentPerformance, minVisibleFraction: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('particleInteractions')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Particle Interactions</h4>
              {openSections.particleInteractions ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.particleInteractions && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="space-y-4">
                {/* ─── QUICK PRESETS (At top) ─── */}
                <div className="pb-3 border-b border-slate-700/50">
                  <label className="text-xs text-purple-300/70 font-semibold mb-2 block">⚡ Quick Presets</label>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('liquid')}
                      variant="outline"
                      className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 h-7 text-xs"
                    >
                      💧 Liquid
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('fluid')}
                      variant="outline"
                      className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 h-7 text-xs"
                    >
                      🌊 Fluid
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('elastic')}
                      variant="outline"
                      className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10 h-7 text-xs"
                    >
                      🎈 Elastic
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('bouncy')}
                      variant="outline"
                      className="border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 h-7 text-xs"
                    >
                      ⚪ Bouncy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('sticky')}
                      variant="outline"
                      className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 h-7 text-xs"
                    >
                      🍯 Sticky
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('rigid')}
                      variant="outline"
                      className="border-red-500/40 text-red-300 hover:bg-red-500/10 h-7 text-xs"
                    >
                      🪨 Rigid
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('floaty')}
                      variant="outline"
                      className="border-pink-500/40 text-pink-300 hover:bg-pink-500/10 h-7 text-xs"
                    >
                      🎆 Floaty
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => applyInteractionPreset('solid')}
                      variant="outline"
                      className="border-slate-500/40 text-slate-300 hover:bg-slate-500/10 h-7 text-xs"
                    >
                      ⬜ Solid
                    </Button>
                  </div>
                </div>

                {/* ─── RESTORATION & VISCOSITY (Animation Behavior) ─── */}
                <div className="pb-3 border-b border-slate-700/50">
                  <p className="text-xs text-purple-300/70 font-semibold mb-2">🎯 Animation Behavior</p>
                  
                  {/* Restoration Force */}
                  <div className="mb-3">
                    <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                      <span>Restoration Force <span className="text-purple-400/60 text-[10px]">(Weak ← → Strong)</span></span>
                      <span className="text-purple-400">{settings.restorationForce.toFixed(0)}</span>
                    </label>
                    <Slider
                      value={[settings.restorationForce]}
                      onValueChange={(val) => updateSettings({ restorationForce: val[0] })}
                      min={0}
                      max={500}
                      step={1}
                      className="w-full"
                    />
                    <p className="text-[10px] text-purple-400/60 mt-1">Spring-like force that pulls particles back to original positions</p>
                  </div>

                  {/* Motion Resistance (Friction) - Applied every frame */}
                  <div className="mb-3">
                    <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                      <span>Motion Resistance <span className="text-purple-400/60 text-[10px]">(Floaty ← → Sticky)</span></span>
                      <span className="text-purple-400">{currentInteraction.friction.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[currentInteraction.friction]}
                      onValueChange={(val) => updateSettings({ particleInteraction: { ...currentInteraction, friction: val[0] } })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                    <p className="text-[10px] text-purple-400/60 mt-1">Air resistance - higher = slower movement through medium</p>
                  </div>
                </div>

                {/* ─── COLLISION ENABLE/DISABLE (Always visible) ─── */}
                <div className="pb-3 border-b border-slate-700/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 h-8">
                      <input id="collisionsEnabled" type="checkbox" checked={currentCollisions.enabled} onChange={(e)=>updateSettings({ collisions: { ...currentCollisions, enabled: e.target.checked } })} className="w-4 h-4" />
                      <label htmlFor="collisionsEnabled" className="text-xs text-purple-200 font-semibold">💥 Collision Physics</label>
                    </div>
                    <span className="text-xs text-purple-400/60">{currentCollisions.enabled ? '✓ Active' : '○ Disabled'}</span>
                  </div>
                  <p className="text-[10px] text-purple-400/60">When disabled: particles ignore each other. When enabled: particles push apart and interact.</p>
                </div>

                {/* ─── COLLISION CONTROLS (Only shown when enabled) ─── */}
                {currentCollisions.enabled && (
                  <div className="pb-3 border-b border-slate-700/50">
                    {/* Separation Strength */}
                    <div className="mb-3">
                      <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                        <span>Separation Strength <span className="text-purple-400/60 text-[10px]">(Soft ← → Hard)</span></span>
                        <span className="text-purple-400">{currentCollisions.strength.toFixed(1)}</span>
                      </label>
                      <Slider
                        value={[currentCollisions.strength]}
                        onValueChange={(val) => updateSettings({ collisions: { ...currentCollisions, strength: val[0] } })}
                        min={0.1}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                      <p className="text-[10px] text-purple-400/60 mt-1">Force to prevent particles from overlapping</p>
                    </div>

                    {/* Radius Multiplier */}
                    <div>
                      <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                        <span>Collision Radius <span className="text-purple-400/60 text-[10px]">(Small ← → Large)</span></span>
                        <span className="text-purple-400">{currentCollisions.radiusMultiplier.toFixed(2)}</span>
                      </label>
                      <Slider
                        value={[currentCollisions.radiusMultiplier]}
                        onValueChange={(val) => updateSettings({ collisions: { ...currentCollisions, radiusMultiplier: val[0] } })}
                        min={1}
                        max={2}
                        step={0.05}
                        className="w-full"
                      />
                      <p className="text-[10px] text-purple-400/60 mt-1">Effective collision size relative to particle radius</p>
                    </div>
                  </div>
                )}

                {/* ─── PARTICLE INTERACTION PROPERTIES (Only shown when collisions enabled) ─── */}
                {currentCollisions.enabled && (
                <div className="pb-3 border-b border-slate-700/50">
                  <p className="text-xs text-purple-300/70 font-semibold mb-2">🔗 Interaction Properties</p>
                  
                  {/* Elasticity */}
                  <div className="mb-3">
                    <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                      <span>Elasticity <span className="text-purple-400/60 text-[10px]">(Sand ← → Billiards)</span></span>
                      <span className="text-purple-400">{currentInteraction.elasticity.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[currentInteraction.elasticity]}
                      onValueChange={(val) => updateSettings({ particleInteraction: { ...currentInteraction, elasticity: val[0] } })}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                    />
                    <p className="text-[10px] text-purple-400/60 mt-1">Bounciness - how much energy is retained in collisions</p>
                  </div>

                  {/* Collision Strength */}
                  <div className="mb-3">
                    <label className="flex items-center justify-between text-xs text-purple-300/80 mb-2">
                      <span>Collision Strength <span className="text-purple-400/60 text-[10px]">(Weak ← → Strong)</span></span>
                      <span className="text-purple-400">{currentInteraction.collisionStrength.toFixed(2)}</span>
                    </label>
                    <Slider
                      value={[currentInteraction.collisionStrength]}
                      onValueChange={(val) => updateSettings({ particleInteraction: { ...currentInteraction, collisionStrength: val[0] } })}
                      min={0}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                    <p className="text-[10px] text-purple-400/60 mt-1">Repulsion force strength during particle interaction</p>
                  </div>
                </div>
                )}

                {/* ─── TILE-SPECIFIC BEHAVIOR ─── */}
                {settings.generateMode === 'imageTiles' && (
                  <div className="pb-3 border-b border-slate-700/50">
                    <p className="text-xs text-purple-300/70 font-semibold mb-2">🎨 Tile Behavior</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tileRotationOnScatter"
                          checked={settings.tileRotationOnScatter ?? true}
                          onChange={(e) => updateSettings({ tileRotationOnScatter: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="tileRotationOnScatter" className="text-xs text-purple-200">Rotate tiles when scattered</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="tileGlowOnScatter"
                          checked={settings.tileGlowOnScatter ?? false}
                          onChange={(e) => updateSettings({ tileGlowOnScatter: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <label htmlFor="tileGlowOnScatter" className="text-xs text-purple-200">Glow tiles when scattered</label>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
            )}

            <h4 className="text-xs uppercase tracking-wider text-purple-300/70 mb-1">Presets</h4>
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="flex gap-2 mb-3">
                <input type="text" placeholder="New preset name" className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" onKeyDown={(e)=>{ if(e.key==='Enter'){ const name=(e.target as HTMLInputElement).value.trim(); if(name){ savePreset(name); (e.target as HTMLInputElement).value=''; } } }} />
                <Button variant="outline" onClick={()=>{ const input=(document.activeElement as HTMLInputElement); const name=input?.value?.trim(); if(name){ savePreset(name); input.value=''; } }} className="border-purple-500/40 text-purple-200 hover:bg-purple-500/10 h-8 px-3">Save</Button>
              </div>
              {presetNames.length===0 ? (
                <div className="text-[11px] text-purple-400">No presets yet.</div>
              ) : (
                <div className="space-y-2">
                  {presetNames.map(name => (
                    <div key={name} className={`flex items-center justify-between rounded p-2 border ${selectedPreset===name? 'bg-purple-700/30 border-purple-400/40':'bg-slate-800/50 border-purple-500/20'}`}>
                      <div className={`text-xs ${selectedPreset===name? 'text-purple-100 font-medium':'text-purple-200'}`}>{name}</div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={()=>loadPreset(name)} className="border-purple-500/40 text-purple-200 hover:bg-purple-500/10 h-7 px-2">Load</Button>
                        <Button variant="outline" size="sm" onClick={()=>deletePreset(name)} className="border-red-500/40 text-red-200 hover:bg-red-500/10 h-7 px-2">Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Colors section moved below Presets */}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('colors')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Colors</h4>
              {openSections.colors ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.colors && (
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
                <ColorFilter />
              </div>
            )}
          </div>
        </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
    </motion.div>
  );
} 