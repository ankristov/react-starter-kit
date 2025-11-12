import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useForceFieldStore } from '../store/forceFieldStore';
import { ParticleEngine } from '../lib/particleEngine';
import { createDefaultImage } from '../lib/imageUtils';
import { useFps } from '../hooks/useFps';

export function ForceFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const animationRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const restoreSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [isForceDisabled, setIsForceDisabled] = useState(false);
  const fps = useFps(500);
  
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
    setIsRecording,
    setRecordingUrl,
    setDesiredCanvasSize,
    setRecorderControl,
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
      const candidates = [exportSettings.mimeType || 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      for (const m of candidates) { if ((window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; }
      return 'video/webm';
    };

    const start = () => {
      if (!canvasRef.current) return;
      try {
        // snapshot desired size to restore later
        restoreSizeRef.current = desiredCanvasSize ? { ...desiredCanvasSize } : { ...canvasSize };
        // Ensure a small delay so canvas has resized before capture
        setTimeout(() => {
          const stream = canvasRef.current!.captureStream(exportSettings.fps || 60);
          const mime = pickMime();
          const mr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
          recordedChunksRef.current = [];
          mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data); };
          mr.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: mime });
            const url = URL.createObjectURL(blob);
            setRecordingUrl(url);
            setIsRecording(false);
            // restore canvas size
            if (restoreSizeRef.current) setDesiredCanvasSize(restoreSizeRef.current);
            restoreSizeRef.current = null;
          };
          mr.start();
          mediaRecorderRef.current = mr;
          setIsRecording(true);
        }, 150);
      } catch (e) {
        console.warn('Failed to start recording', e);
      }
    };

    const stop = () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        try { mr.stop(); } catch {}
      }
    };

    setRecorderControl({ start, stop });
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
    }
  }, [particles, desiredCanvasSize, canvasSize, settings]);

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

  // Animation loop
  const animate = useCallback(() => {
    if (!canvasRef.current || !engineRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    // Clear canvas with background color
    ctx.fillStyle = settings.canvasBackgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    engineRef.current.updateParticles();
    engineRef.current.drawParticles(ctx);

    // Always continue the animation loop
    animationRef.current = requestAnimationFrame(animate);
  }, [settings.canvasBackgroundColor, canvasSize]);

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

  // Mouse event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Update mouse position directly in the engine for smooth force application
    if (engineRef.current) {
      engineRef.current.setMousePosition(x, y, true);
    }
    
    // Also update the store for other components that might need it
    setMousePosition({ x, y, active: true });
  }, [setMousePosition]);

  const handleMouseLeave = useCallback(() => {
    // Update mouse position directly in the engine
    if (engineRef.current) {
      engineRef.current.setMousePosition(0, 0, false);
    }
    
    // Also update the store
    setMousePosition({ x: 0, y: 0, active: false });
  }, [setMousePosition]);

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
    
    // Also update the store
    setMousePosition({ x, y, active: true });
  }, [setMousePosition]);

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
    </div>
  );
} 