import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useForceFieldStore } from '../store/forceFieldStore';
import { ParticleEngine } from '../lib/particleEngine';
import { createDefaultImage } from '../lib/imageUtils';
import { useFps } from '../hooks/useFps';
import { eventRecorder } from '../lib/eventRecorder';
import { Button } from './ui/button';
import { Play, Pause, Circle, Camera, RotateCcw } from 'lucide-react';

export function ForceFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const restoreSizeRef = useRef<{ width: number; height: number } | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const recordedParticleStatesRef = useRef<Array<{ timestamp: number; particles: Array<{ x: number; y: number; originalX: number; originalY: number; vx: number; vy: number; color: string; size: number; shape: 'circle' | 'square' | 'triangle'; visible: boolean }> }>> | null>(null);
  // Use a ref for the closure variable to persist across effect re-runs
  const recordedStatesClosureRef = useRef<any>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isForceDisabled, setIsForceDisabled] = useState(false);
  const fps = useFps(500);
  // Frame rate limiting for recording
  const recordingFrameTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  
  const {
    settings,
    particles,
    mousePosition,
    setParticles,
    setParticleCount,
    setMousePosition,
    setIsAnimating,
    desiredCanvasSize,
    exportSettings,
    isRecording,
    setIsRecording,
    setRecordingUrl,
    setRecordingMimeType,
    setDesiredCanvasSize,
    setRecorderControl,
    currentPulseConfig,
    enqueuePulse,
    continuousForcePulseId,
    currentImageData,
  } = useForceFieldStore();

  // Initialize particle engine (run once)
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ensure we load persisted global settings on first mount
    if (!useForceFieldStore.getState().currentFileHash) {
      useForceFieldStore.getState().setCurrentFileHash(null);
    }

    // Create default image and set initial canvas size responsively
    const computeSize = () => {
      const parent = canvas.parentElement as HTMLElement | null;
      const target = desiredCanvasSize ?? { width: Math.floor(parent?.clientWidth || 800), height: Math.floor(parent?.clientHeight || 600) };
      const w = Math.max(320, target.width);
      const h = Math.max(240, target.height);
      setCanvasSize({ width: w, height: h });
      if (engineRef.current) engineRef.current.setCanvasSize(w, h);
    };
    computeSize();
    const ro = new ResizeObserver(() => computeSize());
    canvas.parentElement && ro.observe(canvas.parentElement);

    // Initialize particle engine
    const engine = new ParticleEngine(settings);
    engine.setCanvasSize(canvasSize.width, canvasSize.height);
    engineRef.current = engine;
    ;(window as any).__ff_engine = engine;

    // If store already has particles (e.g., from upload), use them; otherwise create default image
    const existing = useForceFieldStore.getState().particles;
    if (existing && existing.length > 0) {
      engine.updateParticlesFromStore(existing);
      setParticleCount(existing.length);
    } else {
      const initialParticles = engine.generateParticlesFromImage(createDefaultImage(canvasSize.width, canvasSize.height));
      setParticles(initialParticles);
      setParticleCount(initialParticles.length);
    }

    // Apply initial color filtering
    engine.applyColorFiltering();

    // Force initial draw of particles
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    ctx.fillStyle = settings.canvasBackgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = settings.particleOpacity;
    engine.drawParticles(ctx);
    ctx.restore();

    // Start animation immediately and keep it running
    setIsAnimating(true);

    return () => {
      ro.disconnect();
    };
  }, []);

  // When desiredCanvasSize changes, only resize canvas/engine (do not regenerate default image)
  useEffect(() => {
    if (!desiredCanvasSize) return;
    setCanvasSize({ width: desiredCanvasSize.width, height: desiredCanvasSize.height });
    if (engineRef.current) {
      engineRef.current.setCanvasSize(desiredCanvasSize.width, desiredCanvasSize.height);
    }
  }, [desiredCanvasSize]);

  // Recording controls registered into store
  useEffect(() => {
    const pickMime = () => {
      // Try MP4 formats first, then fall back to WebM
      const candidates = [
        exportSettings.mimeType || 'video/mp4',
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1.4D001E',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      for (const m of candidates) { 
        if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; 
      }
      return 'video/webm'; // Final fallback
    };

    const start = () => {
      if (!canvasRef.current) return;
      try {
        // snapshot desired size to restore later
        restoreSizeRef.current = desiredCanvasSize ? { ...desiredCanvasSize } : { ...canvasSize };
        // Reset frame timing for recording
        lastFrameTimeRef.current = performance.now();
        recordingFrameTimeRef.current = 1000 / (exportSettings.fps || 60);
        // Ensure a small delay so canvas has resized before capture
        setTimeout(() => {
          // START EVENT RECORDING
          const w = exportSettings.width || canvasSize.width;
          const h = exportSettings.height || canvasSize.height;
          
          // Capture current canvas as image for replay
          let initialImage: { imageData: string; width: number; height: number } | undefined;
          if (canvasRef.current) {
            try {
              const imageDataUrl = canvasRef.current.toDataURL('image/png');
              initialImage = {
                imageData: imageDataUrl,
                width: w,
                height: h,
              };
              console.log('[ForceFieldCanvas] Captured initial image for recording');
            } catch (e) {
              console.warn('[ForceFieldCanvas] Failed to capture initial image:', e);
            }
          }
          
          eventRecorder.startRecording(
            settings,
            w,
            h,
            initialImage
          );
          console.log('[ForceFieldCanvas] Event recording started');
          
          const targetFps = exportSettings.fps || 60;
          const stream = canvasRef.current!.captureStream(targetFps);
          const mime = pickMime();
          // Increase bitrate for better quality, adjust based on resolution
          const width = exportSettings.width || canvasSize.width;
          const height = exportSettings.height || canvasSize.height;
          const pixels = width * height;
          // Calculate bitrate: ~0.1 bits per pixel per frame at target FPS
          const bitrate = Math.min(50_000_000, Math.max(2_000_000, Math.floor(pixels * targetFps * 0.1)));
          const mr = new MediaRecorder(stream, { 
            mimeType: mime, 
            videoBitsPerSecond: bitrate,
          });
          recordedChunksRef.current = [];
          // Request data more frequently for smoother recording
          let dataInterval: NodeJS.Timeout | null = null;
          mr.ondataavailable = (e) => { 
            if (e.data && e.data.size > 0) {
              recordedChunksRef.current.push(e.data);
            }
          };
          // Request data chunks every 100ms for smoother recording
          dataInterval = setInterval(() => {
            if (mr.state === 'recording') {
              mr.requestData();
            }
          }, 100);
          mr.onstop = () => {
            console.log('[ForceFieldCanvas] MediaRecorder onstop called');
            try {
              if (dataInterval) {
                clearInterval(dataInterval);
                console.log('[ForceFieldCanvas] Cleared data interval');
              }
              
              // STOP EVENT RECORDING
              const recording = eventRecorder.stopRecording();
              console.log('[ForceFieldCanvas] Event recording stopped:', recording?.events.length || 0, 'events');
              
              const blob = new Blob(recordedChunksRef.current, { type: mime });
              console.log('[ForceFieldCanvas] Created blob, size:', blob.size, 'bytes, type:', mime);
              const url = URL.createObjectURL(blob);
              setRecordingUrl(url);
              setRecordingMimeType(mime);
              setIsRecording(false);
              console.log('[ForceFieldCanvas] Set recording URL and stopped recording flag');
              
              // Stop particle state recording and store the recorded states (in onstop to ensure it happens after recording)
              if (engineRef.current) {
                console.log('[ForceFieldCanvas] Stopping state recording...');
                engineRef.current.stopStateRecording();
                const states = engineRef.current.getRecordedStates();
                console.log('[ForceFieldCanvas] Retrieved states from engine:', states?.length || 0, 'frames');
                
                if (!states || states.length === 0) {
                  console.error('[ForceFieldCanvas] ERROR: No states retrieved from engine!');
                } else {
                  console.log('[ForceFieldCanvas] First frame sample:', {
                    timestamp: states[0]?.timestamp,
                    particleCount: states[0]?.particles?.length || 0,
                  });
                }
                
                // Store in closure ref (this is the primary storage)
                try {
                  recordedStatesClosureRef.current = states;
                  console.log('[ForceFieldCanvas] Stored in closure ref, current value:', recordedStatesClosureRef.current?.length || 0, 'frames');
                } catch (error) {
                  console.error('[ForceFieldCanvas] ERROR storing in closure ref:', error);
                }
                
                // Also try to store in component ref (backup)
                try {
                  // Verify the ref is actually a ref object
                  if (recordedParticleStatesRef && typeof recordedParticleStatesRef === 'object' && 'current' in recordedParticleStatesRef) {
                    recordedParticleStatesRef.current = states;
                    console.log('[ForceFieldCanvas] Stored in component ref, current value:', recordedParticleStatesRef.current?.length || 0, 'frames');
                  } else {
                    console.warn('[ForceFieldCanvas] WARNING: recordedParticleStatesRef is not a valid ref object:', typeof recordedParticleStatesRef, recordedParticleStatesRef);
                  }
                } catch (error) {
                  console.warn('[ForceFieldCanvas] Could not store in recordedParticleStatesRef, using closure ref only:', error);
                }
                
                console.log('[ForceFieldCanvas] Final stored states count:', recordedStatesClosureRef.current?.length || 0, 'frames');
              } else {
                console.error('[ForceFieldCanvas] ERROR: engineRef.current is null!');
              }
              
              // restore canvas size
              const restoreSize = restoreSizeRef.current;
              if (restoreSize) {
                console.log('[ForceFieldCanvas] Restoring canvas size:', restoreSize);
                setDesiredCanvasSize(restoreSize);
                restoreSizeRef.current = null;
              }
            } catch (error) {
              console.error('[ForceFieldCanvas] ERROR in mr.onstop:', error);
              setIsRecording(false);
            }
          };
          mr.start(100); // Request data every 100ms
          mediaRecorderRef.current = mr;
          setIsRecording(true);
          // Start particle state recording
          if (engineRef.current) {
            console.log('[ForceFieldCanvas] Starting state recording at', exportSettings.fps || 60, 'FPS');
            engineRef.current.startStateRecording(exportSettings.fps || 60);
            console.log('[ForceFieldCanvas] State recording started successfully');
          } else {
            console.error('[ForceFieldCanvas] ERROR: engineRef.current is null, cannot start state recording!');
          }
        }, 200); // Slightly longer delay to ensure canvas is ready
      } catch (e) {
        console.warn('Failed to start recording', e);
        setIsRecording(false);
      }
    };
    
    const stop = () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        try { mr.stop(); } catch {}
      }
      // Note: State recording is stopped in mr.onstop to ensure it happens after recording completes
    };

    setRecorderControl({ 
      start, 
      stop,
      getRecordedStates: () => {
        console.log('[ForceFieldCanvas] getRecordedStates called');
        const closureStates = recordedStatesClosureRef.current;
        const refStates = recordedParticleStatesRef.current;
        console.log('[ForceFieldCanvas] Closure ref states:', closureStates?.length || 0, 'frames');
        console.log('[ForceFieldCanvas] Component ref states:', refStates?.length || 0, 'frames');
        
        const result = closureStates || refStates;
        console.log('[ForceFieldCanvas] Returning states:', result?.length || 0, 'frames');
        
        if (!result || result.length === 0) {
          console.error('[ForceFieldCanvas] ERROR: No recorded states available!');
          console.error('[ForceFieldCanvas] Closure ref:', closureStates);
          console.error('[ForceFieldCanvas] Component ref:', refStates);
        }
        
        return result;
      },
    });
    return () => { setRecorderControl(null); };
  }, [canvasRef.current, exportSettings, canvasSize, desiredCanvasSize]);

  // Update engine when settings change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Update particles when they change in store
  useEffect(() => {
    if (engineRef.current && particles.length > 0) {
      // Ensure canvas size is set before updating particles
      if (desiredCanvasSize) {
        engineRef.current.setCanvasSize(desiredCanvasSize.width, desiredCanvasSize.height);
      } else {
        engineRef.current.setCanvasSize(canvasSize.width, canvasSize.height);
      }
      // Ensure settings are up to date before updating particles
      engineRef.current.updateSettings(settings);
      engineRef.current.updateParticlesFromStore(particles);
      
      // Force an immediate draw of updated particles
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Update canvas dimensions if they've changed
          const targetSize = desiredCanvasSize || canvasSize;
          if (canvas.width !== targetSize.width || canvas.height !== targetSize.height) {
            canvas.width = targetSize.width;
            canvas.height = targetSize.height;
          }
          
          // Clear and draw particles immediately
          const currentSettings = settings;
          ctx.fillStyle = currentSettings.canvasBackgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          ctx.save();
          ctx.globalAlpha = currentSettings.particleOpacity;
          engineRef.current.drawParticles(ctx);
          ctx.restore();
        }
      }
    }
  }, [particles, desiredCanvasSize, canvasSize, settings]);

  // Cache background image when data URL changes
  // Watch both the settings AND any session-stored imageDataUrl
  useEffect(() => {
    // First try to use the stored imageDataUrl, then fall back to temporary window reference
    const imageDataUrl = settings.backgroundImage?.imageDataUrl || (typeof window !== 'undefined' ? (window as any).__tempBackgroundImageDataUrl : null);
    
    if (imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        console.log('[Canvas] Background image loaded successfully');
        backgroundImageRef.current = img;
      };
      img.onerror = () => {
        console.error('[Canvas] Failed to load background image');
        backgroundImageRef.current = null;
      };
      img.src = imageDataUrl;
    } else {
      backgroundImageRef.current = null;
    }
  }, [settings.backgroundImage]);


  // Keyboard event handlers for hotkey functionality
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Toggle force disable on 'A' press (ignore repeats)
    if (event.key.toLowerCase() === 'a' && !event.repeat) {
      const next = !isForceDisabled;
      setIsForceDisabled(next);
      if (engineRef.current) {
        engineRef.current.setForceDisabled(next);
      }
    }
    // Toggle combine forces
    if (event.key.toLowerCase() === 'c') {
      const current = useForceFieldStore.getState().settings.combineForces || false;
      useForceFieldStore.getState().updateSettings({ combineForces: !current });
    }
    // Toggle glow
    if (event.key.toLowerCase() === 'g') {
      const current = useForceFieldStore.getState().settings.visual?.glowEnabled || false;
      useForceFieldStore.getState().updateSettings({ visual: { ...(useForceFieldStore.getState().settings.visual || {}), glowEnabled: !current } });
    }
    // Toggle color filter enabled
    if (event.key.toLowerCase() === 'f') {
      const current = useForceFieldStore.getState().settings.colorFilterSettings.enabled;
      useForceFieldStore.getState().updateSettings({ colorFilterSettings: { ...useForceFieldStore.getState().settings.colorFilterSettings, enabled: !current } });
      if (engineRef.current) engineRef.current.updateSettings({ colorFilterSettings: useForceFieldStore.getState().settings.colorFilterSettings });
    }
  }, [isForceDisabled]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // No-op for 'A' to keep toggle behavior on key press
  }, []);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Animation loop - use refs to avoid recreating callback
  const settingsRef = useRef(settings);
  const canvasSizeRef = useRef(canvasSize);
  const isRecordingRef = useRef(isRecording);
  const exportSettingsRef = useRef(exportSettings);
  
  // Update refs when values change
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  useEffect(() => {
    exportSettingsRef.current = exportSettings;
  }, [exportSettings]);

  // Animation loop - stable callback that doesn't recreate
  const animate = useCallback(() => {
    if (!canvasRef.current || !engineRef.current) return;

    const now = performance.now();
    const targetFps = isRecordingRef.current ? (exportSettingsRef.current.fps || 60) : 60;
    const frameTime = 1000 / targetFps;

    // Frame rate limiting during recording
    if (isRecordingRef.current) {
      const elapsed = now - lastFrameTimeRef.current;
      if (elapsed < frameTime) {
        // Skip this frame to maintain target FPS
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      lastFrameTimeRef.current = now;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions only if they changed (avoid clearing canvas unnecessarily)
    const currentCanvasSize = canvasSizeRef.current;
    if (canvas.width !== currentCanvasSize.width || canvas.height !== currentCanvasSize.height) {
      canvas.width = currentCanvasSize.width;
      canvas.height = currentCanvasSize.height;
    }

    // Always draw background color first
    const currentSettings = settingsRef.current;
    ctx.fillStyle = currentSettings.canvasBackgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw background image on top of background color (if present)
    if (currentSettings.backgroundImage?.imageDataUrl && backgroundImageRef.current) {
      const img = backgroundImageRef.current;
      ctx.save();
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Move to center for rotation
      ctx.translate(centerX + currentSettings.backgroundImage.positionX, 
                   centerY + currentSettings.backgroundImage.positionY);
      ctx.rotate((currentSettings.backgroundImage.rotation * Math.PI) / 180);
      ctx.scale(currentSettings.backgroundImage.scale, currentSettings.backgroundImage.scale);
      
      // CRITICAL: Always use original dimensions to ensure perfect alignment with tiles
      // The originalWidth/originalHeight represent the actual image dimensions
      // Any other "width"/"height" value is ignored - we use the source image dimensions
      const drawWidth = currentSettings.backgroundImage.originalWidth ?? img.width;
      const drawHeight = currentSettings.backgroundImage.originalHeight ?? img.height;
      
      // Draw from center - this creates perfect alignment with particle tiles
      // Tiles also use the same originalWidth/originalHeight for their calculations
      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();
    }

    // Update particles first (this is the heavy operation)
    engineRef.current.updateParticles();

    // Draw particles with opacity
    ctx.save();
    ctx.globalAlpha = currentSettings.particleOpacity;
    engineRef.current.drawParticles(ctx);
    ctx.restore();

    // Always continue the animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, []); // Empty deps - use refs to access current values

  // Start animation and keep it running
  useEffect(() => {
    // Start animation immediately
    animate();

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  // Adaptive performance controller: nudge visible fraction up/down based on FPS
  useEffect(() => {
    if (!settings.performance?.adaptiveEnabled) return;
    const current = settings.performance.visibleFraction ?? 1;
    const target = settings.performance.targetFps ?? 60;
    const step = settings.performance.adjustStep ?? 0.1;
    const minFrac = settings.performance.minVisibleFraction ?? 0.3;

    let next = current;
    if (fps < target - 5) {
      next = Math.max(minFrac, current - step);
    } else if (fps > target + 5) {
      next = Math.min(1, current + step);
    }
    if (next !== current) {
      // Update settings with new fraction
      useForceFieldStore.getState().updateSettings({ performance: { ...(settings.performance || {}), visibleFraction: next } });
    }

    // Auto-throttle expensive visual modes when FPS drops
    if (settings.visual?.autoThrottle) {
      const shouldDisableAdditive = fps < target - 10 && settings.visual.additiveBlend;
      const shouldDisableGlow = fps < target - 10 && settings.visual.glowEnabled;
      if (shouldDisableAdditive || shouldDisableGlow) {
        useForceFieldStore.getState().updateSettings({
          visual: {
            ...(settings.visual || {}),
            additiveBlend: shouldDisableAdditive ? false : settings.visual.additiveBlend,
            glowEnabled: shouldDisableGlow ? false : settings.visual.glowEnabled,
          },
        });
      }
    }
  }, [fps, settings.performance]);

  // Mouse event handlers - use refs to avoid recreating callbacks
  const setMousePositionRef = useRef(setMousePosition);
  useEffect(() => {
    setMousePositionRef.current = setMousePosition;
  }, [setMousePosition]);

  // Throttle store updates to avoid performance issues
  const lastStoreUpdateRef = useRef(0);
  const STORE_UPDATE_INTERVAL = 100; // Update store at most every 100ms

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Update mouse position directly in the engine for smooth force application (this is critical)
    if (engineRef.current) {
      engineRef.current.setMousePosition(x, y, true);
    }

    // Record event if recording
    if (eventRecorder.isRecordingActive()) {
      eventRecorder.recordMouseMove(x, y);
    }
    
    // Throttle store updates to avoid expensive re-renders on every mouse move
    const now = performance.now();
    if (now - lastStoreUpdateRef.current >= STORE_UPDATE_INTERVAL) {
      setMousePositionRef.current({ x, y, active: true });
      lastStoreUpdateRef.current = now;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Update mouse position directly in the engine
    if (engineRef.current) {
      engineRef.current.setMousePosition(0, 0, false);
    }

    // Record event if recording
    if (eventRecorder.isRecordingActive()) {
      eventRecorder.recordMouseLeave();
    }
    
    // Update the store immediately on leave (not throttled)
    setMousePositionRef.current({ x: 0, y: 0, active: false });
  }, []);

  const handleMouseEnter = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Update mouse position directly in the engine
    if (engineRef.current) {
      engineRef.current.setMousePosition(x, y, true);
    }

    // Record event if recording
    if (eventRecorder.isRecordingActive()) {
      eventRecorder.recordMouseEnter();
    }
    
    // Update the store immediately on enter (not throttled)
    setMousePositionRef.current({ x, y, active: true });
    lastStoreUpdateRef.current = performance.now();
  }, []);

  const handleSnapshot = useCallback(() => {
    if (!canvasRef.current) return;
    
    // Get canvas image data
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL('image/png');
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `forcefield-snapshot-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleCanvasClick = useCallback(() => {
    // Focus the canvas when clicked to enable keyboard events
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
  }, []);

  return (
    <div className="w-full h-full p-4 flex items-center justify-center relative">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        onClick={handleCanvasClick}
        className="border border-purple-500/30 rounded-lg shadow-lg cursor-crosshair"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain'
        }}
        tabIndex={0} // Make canvas focusable for keyboard events
      />
      {/* Visual indicator when force is disabled */}
      {/* Overlays */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
        {isForceDisabled && (
          <div className="bg-red-500/80 text-white px-3 py-1 rounded-lg text-sm font-medium">
            Force Disabled (A)
          </div>
        )}
        <div className="bg-black/60 text-purple-200 px-3 py-1 rounded-lg text-xs font-medium border border-purple-500/30 flex gap-2 items-center">
          <span>FPS: {fps}</span>
          {settings.performance?.adaptiveEnabled && (
            <span className="opacity-80">vis: {(settings.performance.visibleFraction ?? 1).toFixed(2)}</span>
          )}
        </div>
      </div>

      {/* Action buttons in grid layout - bottom-right corner */}
      <div className="absolute bottom-4 right-4">
        <div className="grid grid-cols-2 gap-2">
          {/* Animate Button */}
          <Button
            size="sm"
            className={`w-12 h-12 p-0 flex items-center justify-center rounded border transition-all ${
              currentPulseConfig?.mode === 'continuous'
                ? (continuousForcePulseId
                    ? 'bg-cyan-600/70 hover:bg-cyan-600/80 text-cyan-100 border-cyan-400/40 animate-pulse'
                    : 'bg-cyan-600/40 hover:bg-cyan-600/50 text-cyan-100 border-cyan-400/20')
                : 'bg-purple-600/50 hover:bg-purple-600/70 text-purple-100 border-purple-400/30'
            }`}
            title={currentPulseConfig?.mode === 'continuous' ? (continuousForcePulseId ? 'Stop Continuous Force' : 'Start Continuous Force') : 'Animate (trigger current force pulse)'}
            onClick={() => {
              const state = useForceFieldStore.getState();
              const { continuousForcePulseId, setContinuousForcePulse } = state;
              
              // Handle continuous mode
              if (currentPulseConfig?.mode === 'continuous') {
                if (continuousForcePulseId) {
                  // Stop continuous force
                  if (engineRef.current) {
                    engineRef.current.removeContinuousPulse(continuousForcePulseId);
                  }
                  setContinuousForcePulse(null);
                } else {
                  // Start continuous force
                  const pulseId = `continuous-${Date.now()}`;
                  setContinuousForcePulse(pulseId);
                  if (engineRef.current && currentPulseConfig) {
                    const pulse = { ...currentPulseConfig };
                    delete (pulse as any).id;
                    delete (pulse as any).mode;
                    engineRef.current.setContinuousPulse(pulseId, pulse);
                  }
                }
              } else {
                // Impulse mode
                enqueuePulse(currentPulseConfig);
              }
            }}
          >
            {currentPulseConfig?.mode === 'continuous' && continuousForcePulseId ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>

          {/* Snapshot Button */}
          <Button
            size="sm"
            className="w-12 h-12 p-0 flex items-center justify-center rounded border bg-blue-600/70 hover:bg-blue-600/80 text-blue-100 border-blue-400/30"
            title="Take Snapshot"
            onClick={handleSnapshot}
          >
            <Camera className="w-5 h-5" />
          </Button>

          {/* Record Button */}
          <Button
            size="sm"
            className={`w-12 h-12 p-0 flex items-center justify-center rounded border ${ 
              isRecording
                ? 'bg-red-600/70 hover:bg-red-600/80 text-red-100 border-red-400/30'
                : 'bg-green-600/70 hover:bg-green-600/80 text-green-100 border-green-400/30'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
            onClick={() => {
              if (!isRecording) {
                const { preset, width, height } = exportSettings;
                let w = width, h = height;
                if (preset !== 'custom') {
                  if (preset === 'instagramReel') { w = 1080; h = 1920; }
                  if (preset === 'youtube') { w = 1920; h = 1080; }
                  if (preset === 'square') { w = 1080; h = 1080; }
                  const img = useForceFieldStore.getState().particles?.[0];
                }
                setDesiredCanvasSize({ width: w, height: h });
                useForceFieldStore.getState().startRecording();
              } else {
                useForceFieldStore.getState().stopRecording();
              }
            }}
          >
            {isRecording ? (
              <Circle className="w-5 h-5 fill-current" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </Button>

          {/* Refresh Button */}
          <Button
            size="sm"
            className="w-12 h-12 p-0 flex items-center justify-center rounded border bg-amber-600/70 hover:bg-amber-600/80 text-amber-100 border-amber-400/30"
            title="Refresh Forcefield"
            onClick={() => {
              // Regenerate particles from the current uploaded image to fill the entire canvas
              if (engineRef.current && currentImageData) {
                try {
                  // Get current settings to check animation mode
                  const currentSettings = settings;
                  
                  // Generate particles based on current animation mode
                  let newParticles;
                  if (currentSettings.animationMode === 'imageCrops') {
                    // Use image crop tiles mode
                    newParticles = engineRef.current.generateParticlesFromImageTiles(
                      currentImageData, 
                      currentSettings.imageCropGridSize ?? 16, 
                      currentSettings.backgroundImage
                    );
                  } else {
                    // Use regular particles mode
                    newParticles = engineRef.current.generateParticlesFromImage(
                      currentImageData, 
                      currentSettings.backgroundImage
                    );
                  }
                  
                  // Update the store with new particles
                  setParticles(newParticles);
                  setParticleCount(newParticles.length);
                  
                  // Apply any active color filtering to the new particles
                  engineRef.current.applyColorFiltering();
                } catch (error) {
                  console.error('Error refreshing particles:', error);
                }
              }
            }}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
} 