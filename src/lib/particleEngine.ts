import type { Particle, ForceFieldSettings, MousePosition, ForcePulse, RecordedFrame } from '../types/particle';
import { getColorDistance } from './colorUtils';
import { generateTilesFromImage } from './imageTiler';

export class ParticleEngine {
  private particles: Particle[] = [];
  private settings: ForceFieldSettings;
  private mousePosition: MousePosition = { x: 0, y: 0, active: false };
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;
  private forceDisabled: boolean = false;
  private forceWasJustEnabled: boolean = false; // Track when force is re-enabled
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private mouseHasMoved: boolean = false;
  private activePulses: Array<ForcePulse & { id: string; start: number } > = [];
  // For randomize effect: store random target positions per particle
  private randomizeTargets: Map<string, Map<number, { x: number; y: number }>> = new Map();
  // For state recording: store particle states during recording
  // OPTIMIZATION: Only store what we need for rendering to minimize memory and CPU overhead
  private isRecordingStates: boolean = false;
  private recordedFrames: Array<{ timestamp: number; particles: Array<{ x: number; y: number; color: string; size: number; shape: 'circle' | 'square' | 'triangle'; visible: boolean }> }> = [];
  private recordingStartTime: number = 0;
  private recordingFps: number = 30; // Record at 30fps to minimize overhead (animation still runs at 60fps)
  private lastRecordedFrameTime: number = 0;
  private replayBaseTime: number | undefined; // Base time for replay pulse timing

  constructor(settings: ForceFieldSettings) {
    this.settings = settings;
  }

  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  setForceDisabled(disabled: boolean): void {
    const wasDisabled = this.forceDisabled;
    this.forceDisabled = disabled;
    // If force was just re-enabled (was disabled, now enabled), mark it
    if (wasDisabled && !disabled) {
      this.forceWasJustEnabled = true;
    }
  }

  generateParticlesFromImage(imageData: ImageData): Particle[] {
    const { width: imageWidth, height: imageHeight, data } = imageData;
    const particles: Particle[] = [];
    
    // Calculate the scale to map canvas coordinates to image coordinates
    const scale = this.settings.imageScale ?? 1;
    
    // Calculate the effective particle system dimensions on canvas (scaled image area)
    const scaledImageW = imageWidth * scale;
    const scaledImageH = imageHeight * scale;
    const offsetX = (this.canvasWidth - scaledImageW) / 2;
    const offsetY = (this.canvasHeight - scaledImageH) / 2;
    
    // Calculate particle spacing and size to ensure full canvas coverage
    // Goal: Generate approximately particleDensity particles that fill the canvas without gaps
    const canvasArea = this.canvasWidth * this.canvasHeight;
    const aspectRatio = this.canvasWidth / this.canvasHeight;
    
    // Calculate spacing between particle centers based on desired density
    // For full coverage, we need particles to overlap slightly
    // Spacing should be less than 2 * particleSize to ensure overlap
    const targetSpacing = Math.sqrt(canvasArea / this.settings.particleDensity);
    
    // Calculate number of particles per dimension to achieve target density
    const particlesPerRow = Math.max(1, Math.ceil(this.canvasWidth / targetSpacing));
    const particlesPerCol = Math.max(1, Math.ceil(this.canvasHeight / targetSpacing));
    
    // Calculate actual spacing to evenly distribute particles
    const actualSpacingX = this.canvasWidth / particlesPerRow;
    const actualSpacingY = this.canvasHeight / particlesPerCol;
    
    // Calculate particle size to ensure overlap and coverage
    // For circles: diameter = 2 * radius, so we want 2 * size >= spacing for overlap
    // For squares: side = 2 * size, so we want 2 * size >= spacing for overlap
    // Use a factor to ensure good overlap - particles should overlap by at least 10-30%
    // This ensures no gaps appear between particles
    const maxSpacing = Math.max(actualSpacingX, actualSpacingY);
    const overlapFactor = 1.3; // Ensures particles overlap by 30% to eliminate gaps
    const baseParticleSize = Math.max(2, Math.ceil(maxSpacing * overlapFactor / 2));
    
    // Calculate total particles that will be generated
    const totalParticles = particlesPerRow * particlesPerCol;
    const expectedParticles = this.settings.particleDensity;
    console.log(`Generating ${totalParticles} particles (${particlesPerRow}x${particlesPerCol}) with size ${baseParticleSize}, spacing ${actualSpacingX.toFixed(2)}x${actualSpacingY.toFixed(2)}, expected ~${expectedParticles}`);
    
    // Generate particles with proper spacing to fill entire canvas
    for (let row = 0; row < particlesPerCol; row++) {
      for (let col = 0; col < particlesPerRow; col++) {
        // Calculate particle position to evenly cover canvas from edge to edge
        // Position particles at the center of each grid cell
        const canvasX = col * actualSpacingX + actualSpacingX / 2;
        const canvasY = row * actualSpacingY + actualSpacingY / 2;
        
        // Ensure particles are within canvas bounds
        const clampedCanvasX = Math.max(baseParticleSize, Math.min(canvasX, this.canvasWidth - baseParticleSize));
        const clampedCanvasY = Math.max(baseParticleSize, Math.min(canvasY, this.canvasHeight - baseParticleSize));
        
        // Map canvas coordinates to image coordinates
        const imageX = Math.floor((clampedCanvasX - offsetX) / scale);
        const imageY = Math.floor((clampedCanvasY - offsetY) / scale);
        
        // Clamp to image bounds
        const clampedX = Math.max(0, Math.min(imageX, imageWidth - 1));
        const clampedY = Math.max(0, Math.min(imageY, imageHeight - 1));
        
        // Sample color from image
        const index = (clampedY * imageWidth + clampedX) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const color = `rgb(${r}, ${g}, ${b})`;
        
        // Use calculated particle position and size
        particles.push({ 
          x: clampedCanvasX, 
          y: clampedCanvasY, 
          originalX: clampedCanvasX, 
          originalY: clampedCanvasY, 
          vx: 0, 
          vy: 0, 
          color, 
          size: baseParticleSize, 
          shape: this.settings.particleShape, 
          visible: true 
        });
      }
    }

    // Assign partial healing multipliers if enabled
    if (this.settings.partialHealing?.enabled) {
      const fraction = Math.min(Math.max(this.settings.partialHealing.fastFraction, 0), 1) || 0;
      const count = Math.floor(particles.length * fraction);
      for (let i = 0; i < count; i++) {
        particles[i].healingMultiplier = this.settings.partialHealing.speedMultiplier || 2.0;
      }
    }

    // Store particles and apply color filtering
    this.particles = particles;
    this.applyColorFiltering();
    
    return particles;
  }

  updateParticlesFromStore(particles: Particle[]): void {
    this.particles = particles;
    // Apply color filtering when particles are updated from store
    this.applyColorFiltering();
  }

  enqueuePulse(pulse: Omit<ForcePulse, 'id'>): void {
    const id = Math.random().toString(36).slice(2);
    const now = performance.now();
    this.activePulses.push({ ...(pulse as any), id, start: now });
    
    // For randomize effect, assign random target positions to all particles
    if (pulse.type === 'randomize') {
      const targets = new Map<number, { x: number; y: number }>();
      this.particles.forEach((particle, index) => {
        if (particle.visible !== false) {
          // Random position within canvas bounds with some margin
          const margin = 50;
          const randomX = margin + Math.random() * (this.canvasWidth - 2 * margin);
          const randomY = margin + Math.random() * (this.canvasHeight - 2 * margin);
          targets.set(index, { x: randomX, y: randomY });
        }
      });
      this.randomizeTargets.set(id, targets);
    }
  }

  updateParticles(): void {
    // Pre-calculate expensive values once
    const forceRadius = this.getForceRadius();
    const mouseActive = this.mousePosition.active && !this.forceDisabled;
    const continuous = !!this.settings.continuousMode;
    const mouseX = this.mousePosition.x;
    const mouseY = this.mousePosition.y;
    const now = performance.now();
    
    // Canvas bounds for culling
    const canvasMargin = 100; // Extra margin to avoid edge cases
    const minX = -canvasMargin;
    const maxX = this.canvasWidth + canvasMargin;
    const minY = -canvasMargin;
    const maxY = this.canvasHeight + canvasMargin;
    
    // Adaptive visible fraction: skip a percentage of visible particles to sustain FPS
    const visibleFraction = this.settings.performance?.adaptiveEnabled
      ? (this.settings.performance.visibleFraction ?? 1)
      : 1;
    let index = 0;
    // Optional spatial grid for simple local collision checks
    const collisionsEnabled = !!this.settings.collisions?.enabled;
    const gridSize = 16; // finer grid cell size in px (was 32, reduced for better detection)
    const grid: Map<string, number[]> = collisionsEnabled ? new Map() : new Map();
    if (collisionsEnabled) {
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        if (p.visible === false) continue;
        const gx = Math.floor(p.x / gridSize);
        const gy = Math.floor(p.y / gridSize);
        const key = `${gx},${gy}`;
        const arr = grid.get(key) || [];
        arr.push(i);
        grid.set(key, arr);
      }
    }

    for (let i = 0; i < this.particles.length; i++) {
      const particle = this.particles[i];
      // Skip physics updates for hidden particles
      if (particle.visible === false) {
        continue;
      }
      // Throttle updates to a subset when adaptive is active
      if (visibleFraction < 1) {
        const stride = Math.max(1, Math.floor(1 / visibleFraction));
        if (index % stride !== 0) { index++; continue; }
      }
      index++;

      // Skip particles that are far outside canvas bounds (culling)
      if (particle.x < minX || particle.x > maxX || particle.y < minY || particle.y > maxY) {
        continue;
      }

      // Apply restoration force (magnet effect)
      if (this.settings.restorationForce > 0) {
        const dx = particle.originalX - particle.x;
        const dy = particle.originalY - particle.y;
        const distanceSquared = dx * dx + dy * dy;
        
        if (distanceSquared > 0.25) { // 0.5² = 0.25, avoid sqrt
          const distance = Math.sqrt(distanceSquared);
          const healingBoost = particle.healingMultiplier && this.settings.partialHealing?.enabled
            ? particle.healingMultiplier
            : 1;
          // Improved: use better scaling (0.02 instead of 0.01) so max force at 500 = 10 instead of 5
          const force = this.settings.restorationForce * 0.02 * healingBoost;
          particle.vx += (dx / distance) * force;
          particle.vy += (dy / distance) * force;
        }
      }

      // Apply pulses (cursor-free)
      if (this.activePulses.length > 0) {
        let ax = 0; let ay = 0;
        for (const p of this.activePulses) {
          const t = (now - p.start);
          const progress = Math.min(1, t / p.durationMs);
          let k = 1 - progress; // Base strength multiplier (1 at start, 0 at end)
          
          // Apply ease in/out if specified
          if ((p.easeIn && p.easeIn > 0) || (p.easeOut && p.easeOut > 0)) {
            const easeType = p.easeType ?? 'linear';
            const easeIn = p.easeIn ?? 0;
            const easeOut = p.easeOut ?? 0;
            let easedProgress = progress;
            
            // Apply easing curve based on type
            switch (easeType) {
              case 'linear':
                // No curve modification, just use progress
                break;
              case 'ease-in':
                easedProgress = easedProgress * easedProgress;
                break;
              case 'ease-out':
                easedProgress = 1 - (1 - easedProgress) * (1 - easedProgress);
                break;
              case 'ease-in-out':
                easedProgress = easedProgress < 0.5
                  ? 2 * easedProgress * easedProgress
                  : 1 - Math.pow(-2 * easedProgress + 2, 2) / 2;
                break;
              case 'ease-in-quad':
                easedProgress = easedProgress * easedProgress;
                break;
              case 'ease-out-quad':
                easedProgress = 1 - (1 - easedProgress) * (1 - easedProgress);
                break;
              case 'ease-in-out-quad':
                easedProgress = easedProgress < 0.5
                  ? 2 * easedProgress * easedProgress
                  : 1 - Math.pow(-2 * easedProgress + 2, 2) / 2;
                break;
              case 'ease-in-cubic':
                easedProgress = easedProgress * easedProgress * easedProgress;
                break;
              case 'ease-out-cubic':
                easedProgress = 1 - Math.pow(1 - easedProgress, 3);
                break;
              case 'ease-in-out-cubic':
                easedProgress = easedProgress < 0.5
                  ? 4 * easedProgress * easedProgress * easedProgress
                  : 1 - Math.pow(-2 * easedProgress + 2, 3) / 2;
                break;
            }
            
            // Apply ease in/out amounts (blend between linear and eased)
            if (easeIn > 0) {
              const linearStart = progress;
              const easedStart = easedProgress;
              easedProgress = linearStart * (1 - easeIn) + easedStart * easeIn;
            }
            
            if (easeOut > 0) {
              const linearEnd = progress;
              const easedEnd = easedProgress;
              easedProgress = linearEnd * (1 - easeOut) + easedEnd * easeOut;
            }
            
            k = 1 - easedProgress;
            k = Math.max(0, Math.min(1, k));
          }
          if (k <= 0) continue;
          switch (p.type) {
            case 'gravity': {
              const theta = ((p.directionDeg ?? 90) * Math.PI) / 180;
              ax += Math.cos(theta) * p.strength * 0.2 * k;
              ay += Math.sin(theta) * p.strength * 0.2 * k;
              break;
            }
            case 'wind': {
              const theta = ((p.directionDeg ?? 0) * Math.PI) / 180;
              const shear = Math.sin(particle.y * 0.01) * 0.2;
              ax += (Math.cos(theta) + shear) * p.strength * 0.15 * k;
              ay += Math.sin(theta) * p.strength * 0.07 * k;
              break;
            }
            case 'tornado': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const d = Math.hypot(dx, dy) + 1e-3;
              const dir = (p.clockwise ?? true) ? 1 : -1;
              ax += (-dy / d) * p.strength * 0.25 * dir * k;
              ay += (dx / d) * p.strength * 0.25 * dir * k;
              break;
            }
            case 'shockwave': {
              const ox = p.origin?.normalized ? p.origin.x * this.canvasWidth : (p.origin?.x ?? this.canvasWidth / 2);
              const oy = p.origin?.normalized ? p.origin.y * this.canvasHeight : (p.origin?.y ?? this.canvasHeight / 2);
              const dx = particle.x - ox; const dy = particle.y - oy; const r = Math.hypot(dx, dy) + 1e-3;
              const R = (t / p.durationMs) * Math.hypot(this.canvasWidth, this.canvasHeight) * 0.6;
              const thickness = Math.max(20, R * 0.08);
              const band = Math.exp(-((r - R) * (r - R)) / (2 * thickness * thickness));
              const f = p.strength * 1.0 * band * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'noise': {
              const tsec = now * 0.001;
              const freq = p.frequency ?? 1;
              const chaos = p.chaos ?? 0.5;
              ax += Math.sin(tsec * freq + particle.y * 0.01) * chaos * p.strength * 0.2 * k;
              ay += Math.cos(tsec * freq + particle.x * 0.01) * chaos * p.strength * 0.2 * k;
              break;
            }
            case 'ripple': {
              const ox = p.origin?.normalized ? p.origin.x * this.canvasWidth : (p.origin?.x ?? this.canvasWidth / 2);
              const oy = p.origin?.normalized ? p.origin.y * this.canvasHeight : (p.origin?.y ?? this.canvasHeight / 2);
              const dx = particle.x - ox; const dy = particle.y - oy; const r = Math.hypot(dx, dy) + 1e-3;
              const wave = Math.sin(r * 0.05 - (now * 0.005 * (p.frequency ?? 1)));
              const f = wave * (p.strength * 0.15) * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'burst': {
              const ox = p.origin?.normalized ? p.origin.x * this.canvasWidth : (p.origin?.x ?? this.canvasWidth * 0.5);
              const oy = p.origin?.normalized ? p.origin.y * this.canvasHeight : (p.origin?.y ?? this.canvasHeight * 0.5);
              const dx = particle.x - ox; const dy = particle.y - oy; const r = Math.hypot(dx, dy) + 1e-3;
              const intensity = p.intensity ?? 1.0;
              const radius = p.radius ?? 100;
              // Apply distance-based falloff if radius is specified
              const distanceFactor = radius > 0 ? Math.max(0, 1 - r / radius) : 1;
              const f = p.strength * 0.4 * intensity * distanceFactor * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'implosion': {
              const ox = p.origin?.normalized ? p.origin.x * this.canvasWidth : (p.origin?.x ?? this.canvasWidth * 0.5);
              const oy = p.origin?.normalized ? p.origin.y * this.canvasHeight : (p.origin?.y ?? this.canvasHeight * 0.5);
              const dx = particle.x - ox; const dy = particle.y - oy; const r = Math.hypot(dx, dy) + 1e-3;
              const intensity = p.intensity ?? 1.0;
              const radius = p.radius ?? 100;
              // Apply distance-based falloff if radius is specified
              const distanceFactor = radius > 0 ? Math.max(0, 1 - r / radius) : 1;
              const f = p.strength * 0.4 * intensity * distanceFactor * k;
              // Implosion pulls particles IN (opposite direction from burst)
              ax -= (dx / r) * f; ay -= (dy / r) * f;
              break;
            }
            case 'magnetPair': {
              const left = { x: this.canvasWidth * 0.33, y: this.canvasHeight * 0.5 };
              const right = { x: this.canvasWidth * 0.66, y: this.canvasHeight * 0.5 };
              const dlx = left.x - particle.x; const dly = left.y - particle.y; const dl = Math.hypot(dlx, dly) + 1e-3;
              const drx = right.x - particle.x; const dry = right.y - particle.y; const dr = Math.hypot(drx, dry) + 1e-3;
              const f = p.strength * 0.18 * k;
              ax += (dlx / dl) * f - (drx / dr) * f;
              ay += (dly / dl) * f - (dry / dr) * f;
              break;
            }
            case 'waterfall': {
              const theta = (90 * Math.PI) / 180;
              const column = Math.sin(particle.x * 0.02) * 0.5 + 0.5;
              ax += Math.cos(theta) * p.strength * 0.05 * k * 0.2;
              ay += Math.sin(theta) * p.strength * 0.25 * k * (0.5 + column);
              break;
            }
            case 'gravityFlip': {
              const theta = ((p.directionDeg ?? -90) * Math.PI) / 180;
              ax += Math.cos(theta) * p.strength * 0.2 * k;
              ay += Math.sin(theta) * p.strength * 0.2 * k;
              break;
            }
            case 'shear': {
              const s = (particle.y / this.canvasHeight - 0.5) * 2; // -1..1
              ax += s * p.strength * 0.2 * k;
              break;
            }
            case 'crosswind': {
              const theta = ((p.directionDeg ?? 0) * Math.PI) / 180;
              const row = Math.sin(particle.y * 0.03 + now * 0.003) * 0.5 + 0.5;
              ax += Math.cos(theta) * p.strength * 0.15 * k * row;
              ay += Math.sin(theta) * p.strength * 0.05 * k * row;
              break;
            }
            case 'swirlField': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const d = Math.hypot(dx, dy) + 1e-3;
              const rot = ((Math.sin((dx + dy) * 0.01) > 0) ? 1 : -1);
              ax += (-dy / d) * p.strength * 0.2 * rot * k;
              ay += (dx / d) * p.strength * 0.2 * rot * k;
              break;
            }
            case 'ringSpin': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const ring = Math.round((r / (Math.min(this.canvasWidth, this.canvasHeight) * 0.5)) * 6);
              const dir = (ring % 2 === 0) ? 1 : -1;
              ax += (-dy / r) * p.strength * 0.2 * dir * k;
              ay += (dx / r) * p.strength * 0.2 * dir * k;
              break;
            }
            case 'spiralIn': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              ax += (-dx / r) * p.strength * 0.12 * k + (-dy / r) * p.strength * 0.12 * k;
              ay += (-dy / r) * p.strength * 0.12 * k - (-dx / r) * p.strength * 0.12 * k;
              break;
            }
            case 'spiralOut': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              ax += (dx / r) * p.strength * 0.12 * k + (dy / r) * p.strength * 0.12 * k;
              ay += (dy / r) * p.strength * 0.12 * k - (dx / r) * p.strength * 0.12 * k;
              break;
            }
            case 'waveLeft': {
              const phase = Math.sin(particle.y * 0.03 - now * 0.004 * (p.frequency ?? 1));
              ax -= phase * p.strength * 0.15 * k;
              break;
            }
            case 'waveUp': {
              const phase = Math.sin(particle.x * 0.03 - now * 0.004 * (p.frequency ?? 1));
              ay -= phase * p.strength * 0.15 * k;
              break;
            }
            case 'randomJitter': {
              const r1 = (Math.random() - 0.5) * 2;
              const r2 = (Math.random() - 0.5) * 2;
              ax += r1 * p.strength * 0.1 * k;
              ay += r2 * p.strength * 0.1 * k;
              break;
            }
            case 'supernova': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const aniso = 0.5 + 0.5 * Math.sin((Math.atan2(dy, dx)) * 12);
              const f = p.strength * 0.6 * aniso * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'ringBurst': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const R = Math.min(this.canvasWidth, this.canvasHeight) * 0.25;
              const band = Math.exp(-((r - R) * (r - R)) / (2 * (R * 0.15) * (R * 0.15)));
              const f = p.strength * 0.8 * band * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'edgeBurst': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const border = Math.min(this.canvasWidth, this.canvasHeight) * 0.45;
              const band = Math.exp(-((r - border) * (r - border)) / (2 * (border * 0.03) * (border * 0.03)));
              const f = p.strength * 1.2 * band * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'multiBurst': {
              const centers = [
                { x: this.canvasWidth * 0.3, y: this.canvasHeight * 0.4 },
                { x: this.canvasWidth * 0.7, y: this.canvasHeight * 0.6 },
                { x: this.canvasWidth * 0.5, y: this.canvasHeight * 0.5 },
              ];
              let fx = 0, fy = 0;
              for (const c of centers) {
                const dx = particle.x - c.x; const dy = particle.y - c.y; const r = Math.hypot(dx, dy) + 1e-3;
                const f = p.strength * 0.3 * k;
                fx += (dx / r) * f; fy += (dy / r) * f;
              }
              ax += fx; ay += fy;
              break;
            }
            case 'quake': {
              const jiggle = Math.sin(now * 0.03 + particle.x * 0.05) * Math.cos(now * 0.027 + particle.y * 0.04);
              ax += jiggle * p.strength * 0.15 * k;
              ay += (Math.random() - 0.5) * p.strength * 0.05 * k;
              break;
            }
            case 'randomize': {
              const targets = this.randomizeTargets.get(p.id);
              if (!targets) break;
              
              const particleIndex = this.particles.indexOf(particle);
              const target = targets.get(particleIndex);
              if (!target) break;
              
              const scatterSpeed = p.scatterSpeed ?? 3.0;
              const holdTimeMs = p.holdTimeMs ?? 500;
              const scatterDurationPercent = p.scatterDurationPercent ?? 30;
              const returnDurationPercent = p.returnDurationPercent ?? 40;
              
              // Calculate phases with user-defined percentages
              const scatterDuration = p.durationMs * (scatterDurationPercent / 100);
              const holdStart = scatterDuration;
              const holdEnd = holdStart + holdTimeMs;
              const returnDuration = p.durationMs * (returnDurationPercent / 100);
              const returnStart = p.durationMs - returnDuration;
              
              if (t < scatterDuration) {
                // Scatter phase: move quickly to random position
                const dx = target.x - particle.x;
                const dy = target.y - particle.y;
                const distance = Math.hypot(dx, dy);
                if (distance > 1) {
                  // Apply ease in if specified
                  const easeInFactor = p.easeIn ? 1 - (1 - t / scatterDuration) * p.easeIn : 1;
                  const speed = scatterSpeed * p.strength * 0.1 * easeInFactor;
                  ax += (dx / distance) * speed;
                  ay += (dy / distance) * speed;
                }
              } else if (t < holdEnd) {
                // Hold phase: stay at random position (minimal movement)
                const dx = target.x - particle.x;
                const dy = target.y - particle.y;
                const distance = Math.hypot(dx, dy);
                if (distance > 1) {
                  // Small correction force to keep particles at target
                  const holdForce = 0.5;
                  ax += (dx / distance) * holdForce;
                  ay += (dy / distance) * holdForce;
                }
              } else if (t >= returnStart && t < p.durationMs) {
                // Return phase: let restoration force handle smooth return
                // Apply ease out if specified (affects restoration force multiplier)
                // The restoration force will naturally return particles
                // Ease out is handled by the restoration force system
              }
              break;
            }
          }
        }
        particle.vx += ax; particle.vy += ay;
      }

      // Apply forces based on mouse position
      // Apply force if mouse is active AND (has moved OR continuous mode OR force just enabled)
      // This ensures immediate response while avoiding unnecessary calculations when mouse is stationary
      if (mouseActive && (this.mouseHasMoved || continuous || this.forceWasJustEnabled)) {
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const distanceSquared = dx * dx + dy * dy;
        
        // Early exit: skip if particle is too far from mouse
        if (distanceSquared > forceRadius * forceRadius) {
          // Continue to next particle without applying force
        } else if (distanceSquared > 0) {
          const distance = Math.sqrt(distanceSquared);
          
          // Combine forces if enabled; otherwise use primary forceType
          const forcesToApply = this.settings.combineForces && this.settings.activeForces && this.settings.activeForces.length > 0
            ? this.settings.activeForces
            : [this.settings.forceType];

          for (const force of forcesToApply) {
            switch (force) {
            case 'attraction':
              this.applyAttractionOptimized(particle, dx, dy, distance, distanceSquared, forceRadius);
              break;
            case 'repulsion':
              this.applyRepulsionOptimized(particle, dx, dy, distance, distanceSquared, forceRadius);
              break;
            case 'vortex':
              this.applyVortexOptimized(particle, dx, dy, distance, distanceSquared, forceRadius);
              break;
            case 'collider':
              this.applyColliderOptimized(particle, dx, dy, distance, distanceSquared, forceRadius);
              break;
            case 'turbulence':
              this.applyTurbulenceOptimized(particle, dx, dy, distance, distanceSquared, forceRadius);
              break;
            }
          }
        }
      }

      // Motion Resistance (friction): Applied every frame as medium viscosity
      // Controls how much particles slow down from air resistance
      const motionResistance = (this.settings.particleInteraction?.friction ?? 0.5) * 0.8; // 0-0.8 range
      
      // Adaptive restoration damping: Scale damping based on restoration force to prevent oscillation
      // Physics: restoration force = spring, damping must be strong enough to prevent overshoot
      const stiffness = this.settings.restorationForce; // 0..500+
      
      // Calculate distance to origin for position-aware damping
      const dxToOrigin = particle.originalX - particle.x;
      const dyToOrigin = particle.originalY - particle.y;
      const distanceToOriginSquared = dxToOrigin * dxToOrigin + dyToOrigin * dyToOrigin;
      const distanceToOrigin = Math.sqrt(distanceToOriginSquared);
      
      // Critical damping for restoration force: damping coefficient ~ sqrt(stiffness)
      // For critical damping with restoration force acting as a spring:
      // We need damping = sqrt(stiffness * massEffect) to prevent overshoot
      const criticalDamping = Math.sqrt(Math.max(0, stiffness)) * 0.008; // 0.008 tuning factor
      
      // Add extra damping near the resting position to kill final vibrations
      let settlingDamping = criticalDamping;
      if (distanceToOrigin < 5) {
        const proximityFactor = 1 - (distanceToOrigin / 5); // 1.0 at origin, 0.0 at 5px away
        settlingDamping += proximityFactor * 0.3; // add up to +0.3 extra damping
      }
      
      // Combine motion resistance + settling damping (separate concerns)
      // Motion resistance acts uniformly; settling damping only near origin
      const totalDamping = motionResistance + settlingDamping;
      const damping = Math.max(0.05, Math.min(0.95, totalDamping));
      particle.vx *= (1 - damping);
      particle.vy *= (1 - damping);

      // Clamp max speed to avoid explosive motion at extreme settings
      const maxSpeed = Math.max(6, 0.02 * Math.min(this.canvasWidth, this.canvasHeight)); // ~12px/frame on 600px canvas
      const speed = Math.hypot(particle.vx, particle.vy);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        particle.vx *= scale;
        particle.vy *= scale;
      }

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Enhanced collision detection: Multi-pass with predictive separation
      if (collisionsEnabled) {
        const interactionSettings = this.settings.particleInteraction;
        const collisionStrengthOverride = interactionSettings?.collisionStrength ?? 0.8;
        const strength = collisionStrengthOverride;
        const radiusMul = this.settings.collisions?.radiusMultiplier ?? 1.2;
        const elasticity = this.settings.particleInteraction?.elasticity ?? 0.5;
        const collisionDamping = (1 - elasticity) * 0.7;
        
        // Multi-pass collision: Run 2 passes to catch and resolve deep overlaps
        for (let pass = 0; pass < 2; pass++) {
          const gx = Math.floor(particle.x / gridSize);
          const gy = Math.floor(particle.y / gridSize);
          
          for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
              const key = `${gx + ox},${gy + oy}`;
              const indices = grid.get(key);
              if (!indices) continue;
              
              for (const j of indices) {
                if (j === i) continue;
                const other = this.particles[j];
                if (other.visible === false) continue;
                
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const dist2 = dx * dx + dy * dy;
                const minDist = (particle.size + other.size) * radiusMul;
                const minDist2 = minDist * minDist;
                
                // Predictive separation: Push apart if getting close OR already overlapping
                // Prevention threshold: 1.3x of collision distance - start repelling before overlap
                const preventionThreshold = minDist * 1.3;
                const preventionThreshold2 = preventionThreshold * preventionThreshold;
                
                if (dist2 > 0 && dist2 < preventionThreshold2) {
                  const dist = Math.sqrt(dist2);
                  
                  // For overlapping particles: strong separation
                  // For nearby particles: gentle predictive push
                  if (dist2 < minDist2) {
                    // Active collision - strong separation
                    const overlap = (minDist - dist) * 0.5 * strength;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    particle.x += nx * overlap;
                    particle.y += ny * overlap;
                    other.x -= nx * overlap;
                    other.y -= ny * overlap;
                    
                    // Apply damping on actual collision
                    particle.vx *= (1 - collisionDamping);
                    particle.vy *= (1 - collisionDamping);
                    other.vx *= (1 - collisionDamping);
                    other.vy *= (1 - collisionDamping);
                  } else {
                    // Predictive mode: gentle repulsion to prevent collision
                    // Scale force by proximity: stronger when closer to collision distance
                    const preventiveFactor = 1 - (dist - minDist) / (preventionThreshold - minDist);
                    const preventiveForce = strength * 0.15 * preventiveFactor;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    
                    // Apply gentle repulsion to velocities
                    particle.vx += nx * preventiveForce;
                    particle.vy += ny * preventiveForce;
                    other.vx -= nx * preventiveForce;
                    other.vy -= ny * preventiveForce;
                    
                    // Apply light damping even in predictive mode (for smoother interaction)
                    // Use reduced damping: 30% of collision damping
                    const predictiveDamping = collisionDamping * 0.3;
                    particle.vx *= (1 - predictiveDamping);
                    particle.vy *= (1 - predictiveDamping);
                    other.vx *= (1 - predictiveDamping);
                    other.vy *= (1 - predictiveDamping);
                  }
                }
              }
            }
          }
        }
      }

      // Stabilize particles very close to their original positions to prevent micro-oscillation
      const speedSquared = particle.vx * particle.vx + particle.vy * particle.vy;
      
      // Recalculate distance to origin for stabilization checks
      const dxToOriginStab = particle.originalX - particle.x;
      const dyToOriginStab = particle.originalY - particle.y;
      const distanceToOriginSquaredStab = dxToOriginStab * dxToOriginStab + dyToOriginStab * dyToOriginStab;
      
      // With critical damping in place, we can snap to rest more aggressively
      // If within 1px of origin and speed is very low (or no restoration force), snap to rest
      if (distanceToOriginSquaredStab < 1 && speedSquared < 0.005) {
        particle.x = particle.originalX;
        particle.y = particle.originalY;
        particle.vx = 0;
        particle.vy = 0;
      }
      // For particles with any restoration force moving very slowly near origin, snap immediately
      else if (this.settings.restorationForce > 0 && distanceToOriginSquaredStab < 4 && speedSquared < 0.01) {
        particle.x = particle.originalX;
        particle.y = particle.originalY;
        particle.vx = 0;
        particle.vy = 0;
      }

      // Handle wall collisions
      if (this.settings.wallsEnabled) {
        // Calculate bounce response based on elasticity (0=dead bounce, 1=perfect bounce)
        const elasticity = this.settings.particleInteraction?.elasticity ?? 0.5;
        const bounceCoef = 0.5 + elasticity * 0.5; // maps 0-1 elasticity to 0.5-1.0 bounce coefficient
        
        if (particle.x - particle.size < 0) {
          particle.x = particle.size;
          particle.vx = -particle.vx * bounceCoef;
        } else if (particle.x + particle.size > this.canvasWidth) {
          particle.x = this.canvasWidth - particle.size;
          particle.vx = -particle.vx * bounceCoef;
        }

        if (particle.y - particle.size < 0) {
          particle.y = particle.size;
          particle.vy = -particle.vy * bounceCoef;
        } else if (particle.y + particle.size > this.canvasHeight) {
          particle.y = this.canvasHeight - particle.size;
          particle.vy = -particle.vy * bounceCoef;
        }
      }
    }
    
    // Record particle state if recording (after all updates)
    // Only do this check if actually recording to avoid overhead when not recording
    if (this.isRecordingStates) {
      try {
        const now = performance.now();
        const frameInterval = 1000 / this.recordingFps;
        const timeSinceStart = now - this.recordingStartTime;
        const timeSinceLastFrame = timeSinceStart - this.lastRecordedFrameTime;
        
        // Record frame if enough time has passed since last frame, or if this is the first frame
        if (this.lastRecordedFrameTime === 0 || timeSinceLastFrame >= frameInterval) {
          const timestamp = timeSinceStart;
          // OPTIMIZATION: Only record position + appearance data, skip velocity & original position
          // This reduces per-particle data from ~100 bytes to ~40 bytes (60% reduction)
          const particleCount = this.particles.length;
          const recordedParticles = new Array(particleCount);
          for (let i = 0; i < particleCount; i++) {
            const p = this.particles[i];
            recordedParticles[i] = {
              x: p.x,
              y: p.y,
              color: p.color,
              size: p.size,
              shape: p.shape,
              visible: p.visible ?? true,
            };
          }
          const frame = {
            timestamp,
            particles: recordedParticles,
          };
          this.recordedFrames.push(frame);
          this.lastRecordedFrameTime = timestamp;
          
          // Log every 60 frames to track progress without spamming
          if (this.recordedFrames.length % 60 === 0) {
            console.log('[ParticleEngine] Recorded', this.recordedFrames.length, 'frames so far (~', Math.round(this.recordedFrames.length / 30), 'sec)');
          }
        }
      } catch (error) {
        console.error('[ParticleEngine] ERROR recording particle state:', error);
        // Don't stop recording on error, just log it
      }
    }
    
    // Reset mouse movement flag after processing all particles
    this.mouseHasMoved = false;
    // Reset force just enabled flag after first frame
    this.forceWasJustEnabled = false;
    // Purge expired pulses
    if (this.activePulses.length > 0) {
      const before = this.activePulses.length;
      this.activePulses = this.activePulses.filter(p => {
        const isActive = (now - p.start) < p.durationMs;
        if (!isActive && p.type === 'randomize') {
          // Clean up randomize targets when pulse expires
          this.randomizeTargets.delete(p.id);
        }
        return isActive;
      });
    }
  }

  // Apply color filtering to particles - only call when needed
  applyColorFiltering(): void {
    const { colorFilterSettings } = this.settings;
    
    if (!colorFilterSettings.enabled) {
      // When filter is disabled, show all particles
      for (const particle of this.particles) {
        particle.visible = true;
      }
      return;
    }

    // Create a Set for O(1) lookups
    const selectedColorsSet = new Set(colorFilterSettings.selectedColors);
    const mode = colorFilterSettings.filterMode || 'show';

    // Apply filter mode: show selected vs hide selected
    for (const particle of this.particles) {
      const inSet = selectedColorsSet.has(particle.color);
      particle.visible = mode === 'show' ? inSet : !inSet;
    }
  }

  // Check if a particle should be visible based on color filter
  private shouldShowParticle(
    particleColor: string,
    selectedColors: string[],
    colorTolerance: number
  ): boolean {
    if (selectedColors.length === 0) {
      return true; // No filter applied
    }
    
    // Use Set for O(1) lookup instead of linear search
    const selectedColorsSet = new Set(selectedColors);
    return selectedColorsSet.has(particleColor);
  }

  private applyAttraction(particle: Particle, dx: number, dy: number, distance: number): void {
    const settings = this.settings.forceSettings.attraction;
    // Convert percentage to actual pixel radius based on canvas size
    const radiusPixels = (settings.radius / 100) * Math.min(this.canvasWidth, this.canvasHeight);
    
    // Check if particle is near its original position (stability zone)
    const distanceFromOriginal = Math.sqrt(
      Math.pow(particle.x - particle.originalX, 2) + 
      Math.pow(particle.y - particle.originalY, 2)
    );
    const stabilityZone = 0.5; // Much smaller zone - only 0.5 pixels
    
    // Apply force to all particles - increased multiplier for smoother movement
    const force = settings.strength * 0.1; // Increased from 0.01 to 0.1
    let forceMultiplier = 1;
    
    if (distance > radiusPixels) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (radiusPixels * radiusPixels) / (distance * distance);
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginal < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dx / distance) * force * forceMultiplier;
    particle.vy += (dy / distance) * force * forceMultiplier;
  }

  private applyRepulsion(particle: Particle, dx: number, dy: number, distance: number): void {
    const settings = this.settings.forceSettings.repulsion;
    // Convert percentage to actual pixel radius based on canvas size
    const radiusPixels = (settings.radius / 100) * Math.min(this.canvasWidth, this.canvasHeight);
    
    // Check if particle is near its original position (stability zone)
    const distanceFromOriginal = Math.sqrt(
      Math.pow(particle.x - particle.originalX, 2) + 
      Math.pow(particle.y - particle.originalY, 2)
    );
    const stabilityZone = 0.5; // Much smaller zone - only 0.5 pixels
    
    // Apply force to all particles - increased multiplier for smoother movement
    const force = settings.strength * 0.2; // Increased from 0.1 to 0.2
    let forceMultiplier = 1;
    
    if (distance > radiusPixels) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (radiusPixels * radiusPixels) / (distance * distance);
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginal < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx -= (dx / distance) * force * forceMultiplier;
    particle.vy -= (dy / distance) * force * forceMultiplier;
  }

  private applyVortex(particle: Particle, dx: number, dy: number, distance: number): void {
    const settings = this.settings.forceSettings.vortex;
    // Convert percentage to actual pixel radius based on canvas size
    const radiusPixels = (settings.radius / 100) * Math.min(this.canvasWidth, this.canvasHeight);
    
    // Check if particle is near its original position (stability zone)
    const distanceFromOriginal = Math.sqrt(
      Math.pow(particle.x - particle.originalX, 2) + 
      Math.pow(particle.y - particle.originalY, 2)
    );
    const stabilityZone = 0.5; // Much smaller zone - only 0.5 pixels
    
    // Apply force to all particles - increased multiplier for smoother movement
    const force = settings.strength * 0.2; // Increased from 0.1 to 0.2
    const direction = settings.clockwise ? 1 : -1;
    let forceMultiplier = 1;
    
    if (distance > radiusPixels) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (radiusPixels * radiusPixels) / (distance * distance);
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginal < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dy / distance) * force * forceMultiplier * direction;
    particle.vy -= (dx / distance) * force * forceMultiplier * direction;
  }

  private applyCollider(particle: Particle, dx: number, dy: number, distance: number): void {
    const settings = this.settings.forceSettings.collider;
    // Convert percentage to actual pixel radius based on canvas size
    const radiusPixels = (settings.radius / 100) * Math.min(this.canvasWidth, this.canvasHeight);
    
    // Check if particle is near its original position (stability zone)
    const distanceFromOriginal = Math.sqrt(
      Math.pow(particle.x - particle.originalX, 2) + 
      Math.pow(particle.y - particle.originalY, 2)
    );
    const stabilityZone = 0.5; // Much smaller zone - only 0.5 pixels
    
    // Apply force to all particles - increased multipliers for smoother movement
    const impact = settings.impactForce * 0.2; // Increased from 0.1 to 0.2
    const damping = settings.bounceDamping * 0.5;
    const hardness = settings.hardness * 0.3;
    let forceMultiplier = 1;
    
    if (distance > radiusPixels) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (radiusPixels * radiusPixels) / (distance * distance);
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginal < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dx / distance) * impact * forceMultiplier;
    particle.vy += (dy / distance) * impact * forceMultiplier;
    
    // Apply damping and hardness to all particles
    particle.vx *= (1 - damping * forceMultiplier);
    particle.vy *= (1 - damping * forceMultiplier);
    particle.vx *= (1 - hardness * forceMultiplier);
    particle.vy *= (1 - hardness * forceMultiplier);
  }

  private applyTurbulence(particle: Particle, dx: number, dy: number, distance: number): void {
    const settings = this.settings.forceSettings.turbulence;
    // Convert percentage to actual pixel radius based on canvas size
    const radiusPixels = (settings.radius / 100) * Math.min(this.canvasWidth, this.canvasHeight);
    
    // Check if particle is near its original position (stability zone)
    const distanceFromOriginal = Math.sqrt(
      Math.pow(particle.x - particle.originalX, 2) + 
      Math.pow(particle.y - particle.originalY, 2)
    );
    const stabilityZone = 0.5; // Much smaller zone - only 0.5 pixels
    
    // Apply force to all particles - increased multiplier for smoother movement
    const force = settings.strength * 0.1; // Increased from 0.01 to 0.1
    const frequency = settings.frequency;
    const chaos = settings.chaos;
    let forceMultiplier = 1;
    
    if (distance > radiusPixels) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (radiusPixels * radiusPixels) / (distance * distance);
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginal < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    // Add chaotic movement
    const time = Date.now() * 0.001;
    const noiseX = Math.sin(time * frequency + particle.x * 0.01) * chaos;
    const noiseY = Math.cos(time * frequency + particle.y * 0.01) * chaos;
    
    particle.vx += noiseX * force * forceMultiplier;
    particle.vy += noiseY * force * forceMultiplier;
  }

  drawParticles(ctx: CanvasRenderingContext2D): void {
    // Pre-calculate common values
    const twoPi = Math.PI * 2;
    // Visual effects
    const visual = this.settings.visual;
    if (visual?.trailsEnabled) {
      // Trails: draw a translucent rect to fade old frame
      ctx.fillStyle = `rgba(0,0,0,${visual.trailFade ?? 0.08})`;
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }
    // Glow/Additive blend
    if (visual?.glowEnabled || (this.settings.tileGlowOnScatter && this.settings.animationMode === 'imageCrops')) {
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = visual?.glowStrength ?? 8;
    } else {
      ctx.shadowBlur = 0;
    }
    if (visual?.additiveBlend) {
      ctx.globalCompositeOperation = 'lighter';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    
    // Canvas bounds for culling
    const canvasMargin = 50; // Smaller margin for drawing
    const minX = -canvasMargin;
    const maxX = this.canvasWidth + canvasMargin;
    const minY = -canvasMargin;
    const maxY = this.canvasHeight + canvasMargin;
    
    // Adaptive draw decimation to match update throttling
    const drawVisibleFraction = this.settings.performance?.adaptiveEnabled
      ? (this.settings.performance.visibleFraction ?? 1)
      : 1;
    const drawStride = drawVisibleFraction < 1 ? Math.max(1, Math.floor(1 / drawVisibleFraction)) : 1;
    let drawIndex = 0;

    for (const particle of this.particles) {
      // Decimate drawing when throttled
      if (drawStride > 1) {
        if (drawIndex % drawStride !== 0) { drawIndex++; continue; }
        drawIndex++;
      }
      // Skip drawing if particle is not visible (due to color filtering)
      if (particle.visible === false) {
        continue;
      }

      // Skip particles that are far outside canvas bounds (culling)
      if (particle.x < minX || particle.x > maxX || particle.y < minY || particle.y > maxY) {
        continue;
      }

      // Check if this is an image tile
      if (particle.tileImageData && this.settings.animationMode === 'imageCrops') {
        this.drawTile(ctx, particle);
      } else {
        // Draw regular particle shape
        ctx.fillStyle = particle.color;
        
        switch (particle.shape) {
          case 'circle':
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, twoPi);
            ctx.fill();
            break;
          case 'square':
            const size = particle.size;
            const halfSize = size;
            ctx.fillRect(
              particle.x - halfSize,
              particle.y - halfSize,
              size * 2,
              size * 2
            );
            break;
          case 'triangle':
            const triSize = particle.size;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y - triSize);
            ctx.lineTo(particle.x - triSize, particle.y + triSize);
            ctx.lineTo(particle.x + triSize, particle.y + triSize);
            ctx.closePath();
            ctx.fill();
            break;
        }
      }
    }
  }

  /**
   * Draw a tile particle (image crop)
   * Worker-safe implementation that avoids document.createElement
   */
  private drawTile(ctx: CanvasRenderingContext2D, particle: Particle): void {
    if (!particle.tileImageData || !particle.tileSize) return;

    ctx.save();

    // Translate to particle position
    ctx.translate(particle.x, particle.y);

    // Apply rotation if enabled - calculate rotation based on velocity magnitude
    if (this.settings.tileRotationOnScatter) {
      // Rotate based on velocity (faster movement = more rotation)
      const velocity = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      const rotationAngle = velocity * 0.02; // Scale velocity to rotation angle
      ctx.rotate(rotationAngle);
    }

    // Draw the tile image data directly
    // Support both square and rectangular tiles
    const tileWidth = particle.tileSize;
    const tileHeight = particle.tileHeightSize || particle.tileSize; // Default to square if height not specified
    
    ctx.drawImage(
      this.imageDataToCanvas(particle.tileImageData),
      -tileWidth / 2,
      -tileHeight / 2,
      tileWidth,
      tileHeight
    );

    ctx.restore();
  }

  /**
   * Convert ImageData to a drawable canvas element
   * Cached for performance - stores small canvas elements for tiles
   */
  private imageDataCanvasCache = new Map<ImageData, HTMLCanvasElement | OffscreenCanvas>();

  private imageDataToCanvas(imageData: ImageData): HTMLCanvasElement | OffscreenCanvas {
    // Check cache first
    if (this.imageDataCanvasCache.has(imageData)) {
      return this.imageDataCanvasCache.get(imageData)!;
    }

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    
    // Use OffscreenCanvas in worker, regular canvas in main thread
    if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') {
      canvas = new OffscreenCanvas(imageData.width, imageData.height);
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = imageData.width;
      canvas.height = imageData.height;
    } else {
      // Fallback - shouldn't reach here
      throw new Error('No canvas implementation available');
    }

    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.putImageData(imageData, 0, 0);

    // Cache for performance
    this.imageDataCanvasCache.set(imageData, canvas);

    return canvas;
  }

  setMousePosition(x: number, y: number, active: boolean): void {
    // Track if mouse has actually moved
    this.mouseHasMoved = (x !== this.lastMouseX || y !== this.lastMouseY);
    this.lastMouseX = x;
    this.lastMouseY = y;
    
    this.mousePosition = { x, y, active };
  }

  updateSettings(settings: Partial<ForceFieldSettings>): void {
    this.settings = { ...this.settings, ...settings };
    
    // Update particle properties if shape changed
    if (settings.particleShape !== undefined) {
      this.particles.forEach(particle => {
        particle.shape = settings.particleShape!;
      });
    }

    // Apply color filtering if color filter settings changed
    if (settings.colorFilterSettings !== undefined) {
      this.applyColorFiltering();
    }
  }

  resetParticles(): void {
    this.particles.forEach(particle => {
      particle.x = particle.originalX;
      particle.y = particle.originalY;
      particle.vx = 0;
      particle.vy = 0;
    });
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  // State recording methods
  startStateRecording(fps: number = 30): void {
    console.log('[ParticleEngine] startStateRecording called with FPS:', fps);
    console.log('[ParticleEngine] ℹ️  Recording at 30fps reduces overhead while keeping smooth motion');
    this.isRecordingStates = true;
    this.recordedFrames = [];
    this.recordingStartTime = performance.now();
    this.recordingFps = fps;
    this.lastRecordedFrameTime = 0;
    console.log('[ParticleEngine] Started state recording at', fps, 'FPS, startTime:', this.recordingStartTime);
  }

  stopStateRecording(): void {
    console.log('[ParticleEngine] stopStateRecording called');
    console.log('[ParticleEngine] isRecordingStates was:', this.isRecordingStates);
    console.log('[ParticleEngine] Total frames recorded:', this.recordedFrames.length);
    this.isRecordingStates = false;
    
    if (this.recordedFrames.length > 0) {
      console.log('[ParticleEngine] First frame timestamp:', this.recordedFrames[0]?.timestamp);
      console.log('[ParticleEngine] Last frame timestamp:', this.recordedFrames[this.recordedFrames.length - 1]?.timestamp);
      console.log('[ParticleEngine] First frame particle count:', this.recordedFrames[0]?.particles?.length || 0);
    } else {
      console.warn('[ParticleEngine] WARNING: No frames were recorded!');
    }
  }

  getRecordedStates(): RecordedFrame[] {
    console.log('[ParticleEngine] getRecordedStates called, returning', this.recordedFrames.length, 'frames');
    return this.recordedFrames;
  }

  clearRecordedStates(): void {
    this.recordedFrames = [];
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  // Pre-calculate force radius to avoid repeated calculations
  private getForceRadius(): number {
    const radiusPercentage = this.settings.forceSettings[this.settings.forceType]?.radius || 20;
    return (radiusPercentage / 100) * Math.min(this.canvasWidth, this.canvasHeight);
  }

  // Optimized force application methods that avoid redundant calculations
  private applyAttractionOptimized(particle: Particle, dx: number, dy: number, distance: number, distanceSquared: number, forceRadius: number): void {
    const settings = this.settings.forceSettings.attraction;
    
    // Check if particle is near its original position (stability zone) - avoid sqrt
    const dxFromOriginal = particle.x - particle.originalX;
    const dyFromOriginal = particle.y - particle.originalY;
    const distanceFromOriginalSquared = dxFromOriginal * dxFromOriginal + dyFromOriginal * dyFromOriginal;
    const stabilityZone = 0.25; // 0.5² = 0.25, avoid sqrt
    
    // Apply force to particles
    const force = settings.strength * 0.1;
    let forceMultiplier = 1;
    
    if (distanceSquared > forceRadius * forceRadius) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (forceRadius * forceRadius) / distanceSquared;
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginalSquared < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dx / distance) * force * forceMultiplier;
    particle.vy += (dy / distance) * force * forceMultiplier;
  }

  private applyRepulsionOptimized(particle: Particle, dx: number, dy: number, distance: number, distanceSquared: number, forceRadius: number): void {
    const settings = this.settings.forceSettings.repulsion;
    
    // Check if particle is near its original position (stability zone) - avoid sqrt
    const dxFromOriginal = particle.x - particle.originalX;
    const dyFromOriginal = particle.y - particle.originalY;
    const distanceFromOriginalSquared = dxFromOriginal * dxFromOriginal + dyFromOriginal * dyFromOriginal;
    const stabilityZone = 0.25; // 0.5² = 0.25, avoid sqrt
    
    // Apply force to particles
    const force = settings.strength * 0.2;
    let forceMultiplier = 1;
    
    if (distanceSquared > forceRadius * forceRadius) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (forceRadius * forceRadius) / distanceSquared;
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginalSquared < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx -= (dx / distance) * force * forceMultiplier;
    particle.vy -= (dy / distance) * force * forceMultiplier;
  }

  private applyVortexOptimized(particle: Particle, dx: number, dy: number, distance: number, distanceSquared: number, forceRadius: number): void {
    const settings = this.settings.forceSettings.vortex;
    
    // Check if particle is near its original position (stability zone) - avoid sqrt
    const dxFromOriginal = particle.x - particle.originalX;
    const dyFromOriginal = particle.y - particle.originalY;
    const distanceFromOriginalSquared = dxFromOriginal * dxFromOriginal + dyFromOriginal * dyFromOriginal;
    const stabilityZone = 0.25; // 0.5² = 0.25, avoid sqrt
    
    // Apply force to particles
    const force = settings.strength * 0.2;
    const direction = settings.clockwise ? 1 : -1;
    let forceMultiplier = 1;
    
    if (distanceSquared > forceRadius * forceRadius) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (forceRadius * forceRadius) / distanceSquared;
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginalSquared < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dy / distance) * force * forceMultiplier * direction;
    particle.vy -= (dx / distance) * force * forceMultiplier * direction;
  }

  private applyColliderOptimized(particle: Particle, dx: number, dy: number, distance: number, distanceSquared: number, forceRadius: number): void {
    const settings = this.settings.forceSettings.collider;
    
    // Check if particle is near its original position (stability zone) - avoid sqrt
    const dxFromOriginal = particle.x - particle.originalX;
    const dyFromOriginal = particle.y - particle.originalY;
    const distanceFromOriginalSquared = dxFromOriginal * dxFromOriginal + dyFromOriginal * dyFromOriginal;
    const stabilityZone = 0.25; // 0.5² = 0.25, avoid sqrt
    
    // Apply force to particles
    const impact = settings.impactForce * 0.2;
    const damping = settings.bounceDamping * 0.5;
    const hardness = settings.hardness * 0.3;
    let forceMultiplier = 1;
    
    if (distanceSquared > forceRadius * forceRadius) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (forceRadius * forceRadius) / distanceSquared;
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginalSquared < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    particle.vx += (dx / distance) * impact * forceMultiplier;
    particle.vy += (dy / distance) * impact * forceMultiplier;
    
    // Apply damping and hardness to all particles
    particle.vx *= (1 - damping * forceMultiplier);
    particle.vy *= (1 - damping * forceMultiplier);
    particle.vx *= (1 - hardness * forceMultiplier);
    particle.vy *= (1 - hardness * forceMultiplier);
  }

  private applyTurbulenceOptimized(particle: Particle, dx: number, dy: number, distance: number, distanceSquared: number, forceRadius: number): void {
    const settings = this.settings.forceSettings.turbulence;
    
    // Check if particle is near its original position (stability zone) - avoid sqrt
    const dxFromOriginal = particle.x - particle.originalX;
    const dyFromOriginal = particle.y - particle.originalY;
    const distanceFromOriginalSquared = dxFromOriginal * dxFromOriginal + dyFromOriginal * dyFromOriginal;
    const stabilityZone = 0.25; // 0.5² = 0.25, avoid sqrt
    
    // Apply force to particles
    const force = settings.strength * 0.1;
    const frequency = settings.frequency;
    const chaos = settings.chaos;
    let forceMultiplier = 1;
    
    if (distanceSquared > forceRadius * forceRadius) {
      // Outside radius: inverse square law (1/r²)
      forceMultiplier = (forceRadius * forceRadius) / distanceSquared;
    }
    
    // Only reduce force when particle is extremely close to original position
    if (distanceFromOriginalSquared < stabilityZone) {
      forceMultiplier *= 0.5; // Reduce by 50% instead of scaling to zero
    }
    
    // Add chaotic movement
    const time = Date.now() * 0.001;
    const noiseX = Math.sin(time * frequency + particle.x * 0.01) * chaos;
    const noiseY = Math.cos(time * frequency + particle.y * 0.01) * chaos;
    
    particle.vx += noiseX * force * forceMultiplier;
    particle.vy += noiseY * force * forceMultiplier;
  }

  addPulse(pulse: ForcePulse): string {
    const id = `pulse-${Date.now()}-${Math.random()}`;
    
    // Check if this is a replay pulse with recordedEventTimestamp
    let startTime = performance.now();
    if ((pulse as any).recordedEventTimestamp !== undefined && this.replayBaseTime !== undefined) {
      // For replay: calculate start time relative to replayBaseTime
      // so that pulse progress calculation works correctly
      startTime = this.replayBaseTime + (pulse as any).recordedEventTimestamp;
    }
    
    this.activePulses.push({
      ...pulse,
      id,
      start: startTime,
    });
    return id;
  }

  /**
   * Set base time for replay - used to properly time pulses during replay
   */
  setReplayBaseTime(baseTime: number): void {
    this.replayBaseTime = baseTime;
  }

  removePulse(id: string): void {
    this.activePulses = this.activePulses.filter(p => p.id !== id);
  }

  clearPulses(): void {
    this.activePulses = [];
  }

  getPulses(): Array<ForcePulse & { id: string }> {
    return this.activePulses.map(({ id, start, ...pulse }) => ({
      ...pulse,
      id,
    })) as any[];
  }

  getMousePosition(): { x: number; y: number; active: boolean } {
    return { ...this.mousePosition };
  }

  /**
   * Regenerate particles from current settings (for initial replay setup)
   */
  regenerateParticles(): void {
    const defaultImageData = new ImageData(
      new Uint8ClampedArray(this.canvasWidth * this.canvasHeight * 4).fill(0),
      this.canvasWidth,
      this.canvasHeight
    );
    // Fill with a simple gradient or default pattern
    const data = defaultImageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100;      // R
      data[i + 1] = 100;  // G
      data[i + 2] = 150;  // B
      data[i + 3] = 255;  // A
    }
    this.particles = this.generateParticlesFromImage(defaultImageData);
  }

  /**
   * Generate particles from image tiles (image crops mode)
   * Each tile becomes a particle that can scatter and reassemble
   */
  generateParticlesFromImageTiles(imageData: ImageData, gridSize: number): Particle[] {
    const { width: imageWidth, height: imageHeight } = imageData;
    const particles: Particle[] = [];

    const tiles = generateTilesFromImage(imageData, gridSize);

    // Calculate tile size to perfectly fill canvas without gaps
    // Tiles should fill entire canvas from corner to corner, no centering
    const displayTileWidth = this.canvasWidth / gridSize;
    const displayTileHeight = this.canvasHeight / gridSize;

    // Use full dimensions - tiles can be non-square to fill entire canvas
    // This ensures zero gaps at edges
    
    for (const tile of tiles) {
      // Calculate canvas position for this tile - place tiles in a grid covering full canvas
      // No offset/centering - start from (0,0) and fill to edges
      const tileLeft = tile.gridX * displayTileWidth;
      const tileTop = tile.gridY * displayTileHeight;
      const canvasX = tileLeft + displayTileWidth / 2;
      const canvasY = tileTop + displayTileHeight / 2;

      const particle: Particle = {
        x: canvasX,
        y: canvasY,
        originalX: canvasX,
        originalY: canvasY,
        vx: 0,
        vy: 0,
        color: tile.color,
        // Size for collision: use the larger dimension to ensure full collision coverage
        size: Math.max(displayTileWidth, displayTileHeight) / 2,
        shape: 'square',
        visible: true,
        tileImageData: tile.imageData,
        tileSize: displayTileWidth, // Store width for horizontal rendering
        tileHeightSize: displayTileHeight, // Store height for vertical rendering
        rotation: 0,
        healingMultiplier: 1.0,
      };

      particles.push(particle);
    }

    console.log(`Generated ${particles.length} tile particles in ${gridSize}x${gridSize} grid, tile size: ${displayTileWidth.toFixed(1)}x${displayTileHeight.toFixed(1)}px`);
    return particles;
  }
} 