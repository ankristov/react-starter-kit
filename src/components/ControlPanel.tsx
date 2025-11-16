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
import { checkServerHealth, interpolateVideo, downloadBlob } from '../lib/interpolationService';

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
  
  const {
    settings,
    updateSettings,
    
    particleCount,
    setParticles,
    setParticleCount,
    setCurrentFileHash,
    desiredCanvasSize,
    setDesiredCanvasSize,
    exportSettings,
    setExportSettings,
    isRecording,
    recordingUrl,
    recordingMimeType,
    startRecording,
    stopRecording,
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
  } = useForceFieldStore();

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
      engineRef.current = engine;
    }

    // Check if interpolation server is available
    checkServerHealth().then(available => {
      setServerAvailable(available);
      if (available) {
        console.log('[ControlPanel] Interpolation server is available');
      } else {
        console.warn('[ControlPanel] Interpolation server is not available - start the server with: npm run start-interpolate-server');
      }
    });
  }, []); // Only run once on mount

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
      const particles = engine.generateParticlesFromImage(imageData);
      
      console.log('Generated particles:', particles.length);
      
      // Update store with new particles
      setParticles(particles);
      setParticleCount(particles.length);
      
      // Store engine reference for future use
      engineRef.current = engine;
      
      console.log('Image loaded successfully:', particles.length, 'particles');
    } catch (error) {
      console.error('Error loading image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to load image: ${errorMessage}`);
    }
  };

  const regenerateParticles = (newDensity?: number, explicitSize?: { width: number; height: number }) => {
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
    const engine = new ParticleEngine({ ...currentSettings, particleDensity: densityToUse });
    // keep canvas size synced with desired size if set
    const target = explicitSize ?? currentDesiredSize ?? { width: imageData.width, height: imageData.height };
    setDesiredCanvasSize(target); // update store so canvas effect resizes too
    engine.setCanvasSize(target.width, target.height);
    const particles = engine.generateParticlesFromImage(imageData);
    
    console.log('Regenerated particles with density:', densityToUse, 'particles:', particles.length);
    
    setParticles(particles);
    setParticleCount(particles.length);
    engineRef.current = engine;
  };

  const handleDensityChange = (value: number[]) => {
    const newDensity = value[0];
    // Update settings first, then regenerate particles with the new density
    updateSettings({ particleDensity: newDensity });
    // Regenerate particles immediately - regenerateParticles will get latest settings from store
    regenerateParticles(newDensity);
  };

  const handleRefresh = () => {
    // Refresh particles with all current settings from the store
    const storeState = useForceFieldStore.getState();
    regenerateParticles(storeState.settings.particleDensity);
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

  // Force Preset states (must be declared at top-level to satisfy Hooks rules)
  // Timing & Easing
  const [pulseSelected, setPulseSelected] = useState<ForcePulseType>('burst');
  const [pulseDuration, setPulseDuration] = useState<number>(1500);
  const [pulseHoldTime, setPulseHoldTime] = useState<number>(0);
  const [easeIn, setEaseIn] = useState<number>(0.2);
  const [easeOut, setEaseOut] = useState<number>(0.2);
  const [easeType, setEaseType] = useState<'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad'>('ease-in-out-quad');
  // Force Parameters
  const [pulseStrength, setPulseStrength] = useState<number>(30);
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
  // Video conversion progress
  const [conversionProgress, setConversionProgress] = useState<{ progress: number; message: string } | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  // Server health check
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);

  // Canvas size preset controls
  type CanvasPreset = 'original' | 'instagramReel' | 'youtube' | 'square' | 'custom';
  const [canvasPreset, setCanvasPreset] = useState<CanvasPreset>('original');
  const [customWidth, setCustomWidth] = useState<number>(desiredCanvasSize?.width || 800);
  const [customHeight, setCustomHeight] = useState<number>(desiredCanvasSize?.height || 600);
  
  // Background image adjustment section state
  const [showBackgroundAdjustments, setShowBackgroundAdjustments] = useState(false);

  

  // Accordion open/close state for sidebar sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    main: true,
    forcePresets: true,
    forces: false,
    visuals: false,
    performance: false,
    healing: false,
    collisions: false,
    colors: true,
    export: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      className="w-full h-full bg-[#0B0B10] text-purple-100 border-l border-purple-500/20 overflow-y-auto"
    >
      {/* Top action bar */}
      <div className="sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-black/40 bg-black/60 border-b border-purple-500/20">
        <div className="p-3 flex flex-wrap gap-2 text-xs">
          <Button size="sm" className="bg-gradient-to-r from-fuchsia-600/40 to-cyan-500/40 hover:from-fuchsia-600/60 hover:to-cyan-500/60 text-white/90 border border-white/10 flex-shrink-0" onClick={() => fileInputRef.current?.click()}>Upload</Button>
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
                if (engineRef.current && storeState.particles.length > 0) {
                  engineRef.current.updateParticlesFromStore(storeState.particles);
                  engineRef.current.applyColorFiltering();
                } else if (engineRef.current) {
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
          </div>
          <div className="px-3 pb-3">
            <Button size="sm" className="w-full bg-blue-600/30 hover:bg-blue-600/45 text-blue-100 border border-blue-400/20" onClick={() => {
              const imageDataUrl = currentImageDataRef.current 
                ? imageDataToDataUrl(currentImageDataRef.current)
                : null;
              saveDefaultState(imageDataUrl);
              alert('Default configuration saved!');
            }}>Save Default</Button>
          </div>
        {/* No mode tabs; unified sidebar */}
        </div>

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
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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
          <div className="sm:col-span-2">
                  <label className="block text-xs text-purple-300/80 mb-1">
                    <span className="inline-flex items-center gap-1">Shape
                      <span title="Particle drawing shape. Visual only; does not change physics."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                    </span>
                  </label>
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
                            <Slider
                              value={[settings.backgroundImage.scale]}
                              onValueChange={(v) => updateBackgroundImage({ scale: v[0] })}
                              min={0.1}
                              max={5.0}
                              step={0.1}
                              className="w-full"
                            />
                            <div className="text-xs text-purple-300/60 mt-1">
                              {settings.backgroundImage.scale.toFixed(1)}x
                            </div>
                          </div>
                          
                          {/* Position X */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Position X</label>
                            <Slider
                              value={[settings.backgroundImage.positionX]}
                              onValueChange={(v) => updateBackgroundImage({ positionX: v[0] })}
                              min={-(desiredCanvasSize?.width || 800)}
                              max={desiredCanvasSize?.width || 800}
                              step={1}
                              className="w-full"
                            />
                            <div className="text-xs text-purple-300/60 mt-1">
                              {Math.round(settings.backgroundImage.positionX)}px
                            </div>
                          </div>
                          
                          {/* Position Y */}
                          <div>
                            <label className="block text-xs text-purple-300/80 mb-1">Position Y</label>
                            <Slider
                              value={[settings.backgroundImage.positionY]}
                              onValueChange={(v) => updateBackgroundImage({ positionY: v[0] })}
                              min={-(desiredCanvasSize?.height || 600)}
                              max={desiredCanvasSize?.height || 600}
                              step={1}
                              className="w-full"
                            />
                            <div className="text-xs text-purple-300/60 mt-1">
                              {Math.round(settings.backgroundImage.positionY)}px
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
                      if (!file) return;
                      
                      try {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          const img = new Image();
                          img.onload = () => {
                            setBackgroundImage({
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
                            });
                            setShowBackgroundAdjustments(true);
                          };
                          img.src = dataUrl;
                        };
                        reader.onerror = () => {
                          console.error('Failed to read background image file');
                        };
                        reader.readAsDataURL(file);
                      } catch (error) {
                        console.error('Error loading background image:', error);
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
                            regenerateParticles(undefined, { width: w, height: h });
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
                            regenerateParticles(undefined, { width: customWidth, height: customHeight });
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
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-purple-300/80 inline-flex items-center gap-1">Restoration Force
                      <span title="Strength of spring-like force that pulls particles back to their original positions. Higher = faster return, potentially snappier motion."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                    </label>
                    <div className="text-[11px] text-purple-400">{settings.restorationForce.toFixed(2)} (0..500)</div>
                  </div>
                  <Slider value={[settings.restorationForce]} onValueChange={([v])=>updateSettings({ restorationForce: v })} max={500} min={0} step={0.01} className="w-full" />
                </div>
                {/* Moved Viscosity here from Forces section */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-purple-300/80 inline-flex items-center gap-1">Viscosity
                      <span title="Damping applied to particle velocity. Higher = more resistance (slower, smoother stop). Lower = more lively motion."><Info className="w-3.5 h-3.5 opacity-80" /></span>
                    </label>
                    <div className="text-[11px] text-purple-400">{settings.healingFactor} (0..100)</div>
                  </div>
                  <Slider value={[settings.healingFactor]} onValueChange={([v])=>updateSettings({ healingFactor: v })} max={100} min={0} step={1} className="w-full" />
                </div>
                <div className="col-span-2">
                  <Button variant={settings.wallsEnabled? 'default':'outline'} onClick={toggleWalls} className={`w-full h-8 ${settings.wallsEnabled? 'bg-green-600/20 hover:bg-green-600/30 text-green-200':'border-red-500/40 text-red-300 hover:bg-red-500/10'}`}>{settings.wallsEnabled? 'Walls ON':'Walls OFF'}</Button>
                </div>
          </div>
        </div>
            )}

            {/* Force Presets moved below Overview */}
            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('forcePresets')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Force Impact</h4>
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
                    durationMs: pulseDuration,
                    holdTimeMs: pulseHoldTime,
                    strength: pulseStrength,
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
                  enqueuePulse(base);
                };

                return (
                  <>
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
                      <Button onClick={onImpact} className="w-full h-8 bg-purple-600/40 hover:bg-purple-600/60">Impact!</Button>
                    </div>

                    {/* Timing & Easing Section */}
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

                    {/* Force Parameters Section */}
                    <div className="bg-slate-800/40 border border-slate-700/40 rounded p-2.5 mb-3 space-y-2">
                      <div className="text-[10px] font-semibold text-purple-300/70 uppercase">Force Parameters</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Strength</label>
                          <input type="number" value={pulseStrength} min={1} max={200} step={1} onChange={(e)=>setPulseStrength(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
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
                        const { preset, width, height } = exportSettings;
                        let w = width, h = height;
                        if (preset !== 'custom') {
                          if (preset === 'instagramReel') { w = 1080; h = 1920; }
                          if (preset === 'youtube') { w = 1920; h = 1080; }
                          if (preset === 'square') { w = 1080; h = 1080; }
                          if (preset === 'original') { const img = currentImageDataRef.current; if (img) { w = img.width; h = img.height; } }
                        }
                        setDesiredCanvasSize({ width: w, height: h });
                        startRecording();
                      } else {
                        stopRecording();
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
                        <Button
                          size="sm"
                          className="bg-purple-600/30 hover:bg-purple-600/45 text-purple-100 border border-purple-400/20 disabled:opacity-50 h-8"
                          disabled={conversionProgress !== null}
                          onClick={async () => {
                            // Check server availability when button is clicked
                            const serverReady = await checkServerHealth();
                            setServerAvailable(serverReady);
                            
                            if (!serverReady) {
                              alert('Interpolation server is not available.\n\nTo start the server:\n\n1. Open a terminal\n2. Navigate to the project directory\n3. Run: npm run start-interpolate-server\n\nMake sure FFmpeg is installed on your system.');
                              return;
                            }
                            
                            if (!recordingUrl) {
                              alert('No recording available. Record an animation first.');
                              return;
                            }

                            try {
                              // Convert data URL to blob
                              console.log('[ControlPanel] Starting smooth video process...');
                              const response = await fetch(recordingUrl);
                              const videoBlob = await response.blob();
                              console.log('[ControlPanel] Video blob ready:', { size: videoBlob.size, type: videoBlob.type });

                              // Perform interpolation
                              setConversionProgress(0);
                              console.log('[ControlPanel] Calling interpolateVideo...');
                              const smoothedBlob = await interpolateVideo(videoBlob, {
                                onProgress: (progress, message) => {
                                  console.log('[ControlPanel] Progress update:', { progress, message });
                                  // Progress is already 0-100, don't multiply by 100 again
                                  setConversionProgress(Math.round(progress));
                                }
                              });

                              console.log('[ControlPanel] Interpolation complete, downloading...', { size: smoothedBlob.size });
                              // Download the smoothed video
                              downloadBlob(smoothedBlob, `forcefield-smooth-${Date.now()}.webm`);
                              setConversionProgress(null);
                              
                              console.log('[ControlPanel] Video smoothing complete');
                            } catch (error) {
                              setConversionProgress(null);
                              const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                              console.error('[ControlPanel] Smoothing error:', error);
                              alert(`Failed to smooth video: ${errorMsg}`);
                            }
                          }}
                        >
                          {conversionProgress !== null ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              {conversionProgress}%
                            </>
                          ) : (
                            <>
                              <HelpCircle className="w-3 h-3 mr-1" />
                              Smooth Video
                            </>
                          )}
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
              onClick={() => toggleSection('healing')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Healing</h4>
              {openSections.healing ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.healing && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 h-8">
                  <input id="partialHealingEnabled" type="checkbox" checked={currentPartialHealing.enabled} onChange={(e)=>updateSettings({ partialHealing: { ...currentPartialHealing, enabled: e.target.checked } })} />
                  <label htmlFor="partialHealingEnabled" className="text-xs text-purple-200">Enable</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Fast-Healing Fraction</label>
                    <input type="number" step={0.05} value={currentPartialHealing.fastFraction} min={0} max={1} onChange={(e)=>updateSettings({ partialHealing: { ...currentPartialHealing, fastFraction: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                </div>
          <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Speed Multiplier</label>
                    <input type="number" step={0.1} value={currentPartialHealing.speedMultiplier} min={1} max={10} onChange={(e)=>updateSettings({ partialHealing: { ...currentPartialHealing, speedMultiplier: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div
              className="flex items-center justify-between py-1 cursor-pointer mt-2"
              onClick={() => toggleSection('collisions')}
            >
              <h4 className="text-xs uppercase tracking-wider text-purple-300/70">Collisions</h4>
              {openSections.collisions ? (
                <ChevronDown className="w-4 h-4 text-purple-300" />
              ) : (
                <ChevronRight className="w-4 h-4 text-purple-300" />)
              }
            </div>
            {openSections.collisions && (
            <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg p-3">
              <div className="space-y-3">
                <div className="flex items-center gap-2 h-8">
                  <input id="collisionsEnabled" type="checkbox" checked={currentCollisions.enabled} onChange={(e)=>updateSettings({ collisions: { ...currentCollisions, enabled: e.target.checked } })} />
                  <label htmlFor="collisionsEnabled" className="text-xs text-purple-200">Enable</label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Separation Strength</label>
                    <input type="number" step={0.1} value={currentCollisions.strength} min={0.1} max={2} onChange={(e)=>updateSettings({ collisions: { ...currentCollisions, strength: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                </div>
                <div>
                    <label className="flex items-end h-10 text-xs text-purple-300/80 mb-1">Radius Multiplier</label>
                    <input type="number" step={0.05} value={currentCollisions.radiusMultiplier} min={1} max={2} onChange={(e)=>updateSettings({ collisions: { ...currentCollisions, radiusMultiplier: Number(e.target.value) } })} className="w-full h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                  </div>
                </div>
              </div>
              <div className="text-xs text-purple-400 mt-2">Note: CPU collisions are more expensive; use with lower density or enable Adaptive Mode.</div>
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
            <h4 className="text-xs uppercase tracking-wider text-purple-300/70 mb-1">Force Impact</h4>
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
                    durationMs: pulseDuration, 
                    strength: pulseStrength,
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
                    base.holdTimeMs = randomizeHoldTime;
                    base.returnDurationPercent = randomizeReturnDurationPercent;
                  }
                  enqueuePulse(base);
                };

                return (
                  <>
                    <div className="mb-3">
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
                    </div>
                    <Button onClick={onImpact} className="w-full h-8 bg-purple-600/40 hover:bg-purple-600/60">Impact!</Button>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-purple-300/80 mb-1">Duration (ms)</label>
                        <input type="number" value={pulseDuration} min={100} max={60000} onChange={(e)=>setPulseDuration(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-purple-300/80 mb-1">Strength</label>
                        <input type="number" value={pulseStrength} min={1} max={200} step={1} onChange={(e)=>setPulseStrength(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                      </div>
                      {(['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) && (
                        <div className="col-span-2">
                          <label className="block text-[11px] text-purple-300/80 mb-1">Direction (deg)</label>
                          <input type="number" value={pulseDirectionDeg} min={-360} max={360} step={1} onChange={(e)=>setPulseDirectionDeg(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                      )}
                      {(['tornado','ringSpin'].includes(pulseSelected)) && (
                        <div className="flex items-center gap-2">
                          <input id="pulseClockwise" type="checkbox" checked={pulseClockwise} onChange={(e)=>setPulseClockwise(e.target.checked)} />
                          <label htmlFor="pulseClockwise" className="text-xs text-purple-200">Clockwise</label>
                        </div>
                      )}
                      {(['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) && (
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Frequency</label>
                          <input type="number" step={0.1} min={0.1} max={10} value={pulseFrequency} onChange={(e)=>setPulseFrequency(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                      )}
                      {(['noise','randomJitter'].includes(pulseSelected)) && (
                        <div>
                          <label className="block text-[11px] text-purple-300/80 mb-1">Chaos</label>
                          <input type="number" step={0.05} min={0} max={2} value={pulseChaos} onChange={(e)=>setPulseChaos(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                        </div>
                      )}
                      {(['shockwave','ripple'].includes(pulseSelected)) && (
                        <div className="col-span-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Origin X (0..1)</label>
                            <input type="number" step={0.01} min={0} max={1} value={pulseOriginX} onChange={(e)=>setPulseOriginX(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Origin Y (0..1)</label>
                            <input type="number" step={0.01} min={0} max={1} value={pulseOriginY} onChange={(e)=>setPulseOriginY(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
            </div>
          </div>
        )}
                      {(pulseSelected === 'randomize') && (
                        <div className="col-span-2 space-y-2">
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Scatter Speed</label>
                            <input type="number" step={0.1} min={0.5} max={10} value={randomizeScatterSpeed} onChange={(e)=>setRandomizeScatterSpeed(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div>
                            <label className="block text-[11px] text-purple-300/80 mb-1">Hold Time (ms)</label>
                            <input type="number" step={50} min={0} max={5000} value={randomizeHoldTime} onChange={(e)=>setRandomizeHoldTime(Number(e.target.value))} className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                          </div>
                          <div className="text-[10px] text-purple-300/60 italic">
                            Particles will smoothly return using restoration force
                          </div>
                        </div>
                      )}

        
                    </div>
                  </>
                );
              })()}
          </div>
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