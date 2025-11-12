import React, { useRef, useEffect, useCallback } from 'react';
import { useForceFieldStore } from '../../lib/forceFieldStore';
import { motion } from 'framer-motion';

export function ForceFieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  
  const {
    particleSystem,
    canvasRef: storeCanvasRef,
    isAnimating,
    setCanvasRef,
    setMousePosition,
    startAnimation,
    stopAnimation,
    initializeParticleSystem,
    loadDefaultImage
  } = useForceFieldStore();

  // Initialize canvas and particle system
  useEffect(() => {
    setCanvasRef(canvasRef as React.RefObject<HTMLCanvasElement>);
    initializeParticleSystem();
    loadDefaultImage();
  }, [setCanvasRef, initializeParticleSystem, loadDefaultImage]);

  // Animation loop
  useEffect(() => {
    if (!isAnimating || !particleSystem || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      particleSystem.updateParticles();
      particleSystem.drawParticles(ctx);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
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
      
      {/* Instructions overlay */}
      <motion.div
        className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <p className="font-medium">Move mouse or touch to create force field effects</p>
      </motion.div>
    </motion.div>
  );
} 