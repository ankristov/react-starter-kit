import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useForceFieldStore } from '../store/forceFieldStore';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { fileToImageData, createDefaultImage } from '../lib/imageUtils';
import { ParticleEngine } from '../lib/particleEngine';
import { ForceTypeControls } from './ForceTypeControls';
import type { ForcePulseType } from '../types/particle';
import { ColorFilter } from './ColorFilter';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

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
    startRecording,
    stopRecording,
    // Presets
    presetNames,
    savePreset,
    loadPreset,
    deletePreset,
    resetToDefaults,
    selectedPreset,
    enqueuePulse,
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
  const [pulseSelected, setPulseSelected] = useState<ForcePulseType>('tornado');
  const [pulseDuration, setPulseDuration] = useState<number>(1500);
  const [pulseStrength, setPulseStrength] = useState<number>(30);
  const [pulseDirectionDeg, setPulseDirectionDeg] = useState<number>(90);
  const [pulseClockwise, setPulseClockwise] = useState<boolean>(true);
  const [pulseFrequency, setPulseFrequency] = useState<number>(1.5);
  const [pulseChaos, setPulseChaos] = useState<number>(0.6);
  const [pulseOriginX, setPulseOriginX] = useState<number>(0.5);
  const [pulseOriginY, setPulseOriginY] = useState<number>(0.5);

  // Canvas size preset controls
  type CanvasPreset = 'original' | 'instagramReel' | 'youtube' | 'square' | 'custom';
  const [canvasPreset, setCanvasPreset] = useState<CanvasPreset>('original');
  const [customWidth, setCustomWidth] = useState<number>(desiredCanvasSize?.width || 800);
  const [customHeight, setCustomHeight] = useState<number>(desiredCanvasSize?.height || 600);

  

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
          <Button size="sm" className="bg-indigo-600/30 hover:bg-indigo-600/45 text-indigo-100 border border-indigo-400/20 flex-shrink-0" onClick={() => {
            const defaultImageData = createDefaultImage(800, 600);
            currentImageDataRef.current = defaultImageData;
            setCurrentFileHash(null);
            regenerateParticles();
          }}>Default</Button>
          <Button size="sm" className="bg-green-600/30 hover:bg-green-600/45 text-green-100 border border-green-400/20 flex-shrink-0" onClick={handleRefresh}>Refresh</Button>
          <Button size="sm" variant="outline" className="border-blue-500/40 text-blue-300 hover:bg-blue-500/10 flex-shrink-0 ml-auto" onClick={resetToDefaults}>Reset</Button>
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
                  <Slider
                    value={[settings.particleDensity]}
                    onValueChange={handleDensityChange}
                    max={50000}
                    min={1000}
                    step={1000}
                    className="w-full"
                  />
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
                };

                const onImpact = () => {
                  const base: any = { type: pulseSelected, durationMs: pulseDuration, strength: pulseStrength };
                  if (['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) base.directionDeg = pulseDirectionDeg;
                  if (['tornado','ringSpin'].includes(pulseSelected)) base.clockwise = pulseClockwise;
                  if (['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) base.frequency = pulseFrequency;
                  if (['noise','randomJitter'].includes(pulseSelected)) base.chaos = pulseChaos;
                  if (['shockwave','ripple'].includes(pulseSelected)) base.origin = { normalized: true, x: pulseOriginX, y: pulseOriginY };
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
                    </div>
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
                    <label className="ml-3 text-xs text-purple-300/80">Duration (s)</label>
                    <input type="number" value={exportSettings.durationSec} min={1} max={120} onChange={(e)=>setExportSettings({ durationSec: Number(e.target.value) })} className="w-20 h-8 px-2 bg-slate-800 border border-slate-700 rounded text-purple-200 text-xs" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    className={`${isRecording ? 'bg-red-600/70 hover:bg-red-600/80' : 'bg-green-600/70 hover:bg-green-600/80'} h-8 px-3 flex items-center gap-2`}
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
                    {isRecording ? 'Stop' : 'Record'}
                  </Button>
                  {recordingUrl && (
                    <a href={recordingUrl} download={`forcefield_${Date.now()}.webm`} className="ml-auto text-xs text-blue-300 underline">Download video</a>
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
                };

                const onImpact = () => {
                  const base: any = { type: pulseSelected, durationMs: pulseDuration, strength: pulseStrength };
                  if (['gravity','wind','crosswind','gravityFlip','waveLeft','waveUp'].includes(pulseSelected)) base.directionDeg = pulseDirectionDeg;
                  if (['tornado','ringSpin'].includes(pulseSelected)) base.clockwise = pulseClockwise;
                  if (['noise','ripple','waveLeft','waveUp','crosswind'].includes(pulseSelected)) base.frequency = pulseFrequency;
                  if (['noise','randomJitter'].includes(pulseSelected)) base.chaos = pulseChaos;
                  if (['shockwave','ripple'].includes(pulseSelected)) base.origin = { normalized: true, x: pulseOriginX, y: pulseOriginY };
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