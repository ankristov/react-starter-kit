import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useForceFieldStore } from '../../lib/forceFieldStore';
import { motion } from 'framer-motion';
import { Play, Square, RotateCcw } from 'lucide-react';

export function ForceFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [localContinuousPulseId, setLocalContinuousPulseId] = useState<string | null>(null);
  
  const {
    particleSystem,
    canvasRef: storeCanvasRef,
    isAnimating,
    setCanvasRef,
    setMousePosition,
    startAnimation,
    stopAnimation,
    initializeParticleSystem,
    loadDefaultImage,
    continuousForcePulseId,
    setContinuousForcePulse,
  } = useForceFieldStore();

  // Initialize canvas and particle system
  useEffect(() => {
    setCanvasRef(canvasRef as React.RefObject<HTMLCanvasElement>);
    initializeParticleSystem();
    loadDefaultImage();
  }, [setCanvasRef, initializeParticleSystem, loadDefaultImage]);

  // Subscribe to continuous pulse ID changes from store
  useEffect(() => {
    const unsubscribe = useForceFieldStore.subscribe(
      (state) => state.continuousForcePulseId,
      (newId) => setLocalContinuousPulseId(newId)
    );
    return unsubscribe;
  }, []);

  // Animation loop with immediate draw
  useEffect(() => {
    if (!isAnimating || !particleSystem || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Force initial draw to show particles immediately
    ctx.fillStyle = canvas.style.backgroundColor || '#0B0B10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particleSystem.drawParticles(ctx);

    let isRunning = true;
    const animate = () => {
      if (!isRunning) return;
      particleSystem.updateParticles();
      particleSystem.drawParticles(ctx);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, particleSystem]);

  // Start animation when component mounts
  useEffect(() => {
    startAnimation();
    return () => stopAnimation();
  }, [startAnimation, stopAnimation]);

  // Mouse event handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePosition(x, y, true);
  }, [setMousePosition]);

  const handleMouseLeave = useCallback(() => {
    setMousePosition(0, 0, false);
  }, [setMousePosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    handleMouseMove(e);
  }, [handleMouseMove]);

  const handleMouseUp = useCallback(() => {
    setMousePosition(0, 0, false);
  }, [setMousePosition]);

  // Touch event handlers for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setMousePosition(x, y, true);
  }, [setMousePosition]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!canvasRef.current || e.touches.length === 0) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setMousePosition(x, y, true);
  }, [setMousePosition]);

  const handleTouchEnd = useCallback(() => {
    setMousePosition(0, 0, false);
  }, [setMousePosition]);

  return (
    <motion.div
      className="relative flex justify-center items-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-lg overflow-hidden"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="max-w-full max-h-[70vh] w-auto h-auto border border-purple-500/30 rounded-lg shadow-2xl"
        style={{ 
          cursor: 'crosshair',
          touchAction: 'none'
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      
      {/* Instructions */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs p-2 rounded max-w-48">
        <div>Click/drag to apply forces</div>
        <div>Touch: single finger</div>
      </div>

      {/* Control Buttons Grid (2x2) */}
      <div className="absolute top-2 right-2 grid grid-cols-2 gap-2">
        {/* Play/Stop Button */}
        <button
          onClick={() => {
            const { continuousForcePulseId, setContinuousForcePulse: storeSetContinuousForcePulse } = useForceFieldStore.getState();
            const engine = (window as any).__ff_engine;
            
            if (continuousForcePulseId) {
              // Stop: remove pulse from engine first, then clear store
              if (engine) {
                engine.removeContinuousPulse(continuousForcePulseId);
              }
              storeSetContinuousForcePulse(null);
            } else {
              // Start: set store ID and create pulse in engine
              const pulseId = 'canvas-btn';
              storeSetContinuousForcePulse(pulseId);
              if (engine) {
                const { currentPulseConfig } = useForceFieldStore.getState();
                if (currentPulseConfig) {
                  const pulse = { ...currentPulseConfig };
                  delete (pulse as any).id;
                  delete (pulse as any).mode;
                  engine.setContinuousPulse(pulseId, pulse);
                }
              }
            }
          }}
          title={localContinuousPulseId ? 'Stop Animation' : 'Play Animation'}
          className={`w-10 h-10 rounded flex items-center justify-center transition-all ${
            localContinuousPulseId
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {localContinuousPulseId ? <Square size={18} /> : <Play size={18} />}
        </button>

        {/* Refresh Button */}
        <button
          onClick={() => {
            const { settings, desiredCanvasSize } = useForceFieldStore.getState();
            const engine = (window as any).__ff_engine;
            
            if (engine) {
              // Get current settings
              const imageData = new Uint8ClampedArray(800 * 600 * 4);
              imageData.fill(0);
              for (let i = 3; i < imageData.length; i += 4) {
                imageData[i] = 255;
              }
              
              const defaultImage = new ImageData(imageData, 800, 600);
              
              // Update canvas size
              const size = desiredCanvasSize ?? { width: 800, height: 600 };
              engine.setCanvasSize(size.width, size.height);
              
              // Regenerate particles with current settings
              let particles;
              if (settings.animationMode === 'imageCrops') {
                particles = engine.generateParticlesFromImageTiles(defaultImage, settings.imageCropGridSize ?? 16, settings.backgroundImage);
              } else {
                particles = engine.generateParticlesFromImage(defaultImage, settings.backgroundImage);
              }
              
              // Update particles in store
              const { setParticles, setParticleCount } = useForceFieldStore.getState();
              setParticles?.(particles);
              setParticleCount?.(particles.length);
            }
          }}
          title="Refresh Particles"
          className="w-10 h-10 rounded bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center transition-all"
        >
          <RotateCcw size={18} />
        </button>

        {/* Placeholder buttons for 2x2 grid */}
        <button
          disabled
          title="Reserved"
          className="w-10 h-10 rounded bg-slate-600/50 text-slate-400 flex items-center justify-center transition-all opacity-50 cursor-not-allowed"
        >
          <span className="text-xs">—</span>
        </button>
        <button
          disabled
          title="Reserved"
          className="w-10 h-10 rounded bg-slate-600/50 text-slate-400 flex items-center justify-center transition-all opacity-50 cursor-not-allowed"
        >
          <span className="text-xs">—</span>
        </button>
      </div>
    </motion.div>
  );
} 