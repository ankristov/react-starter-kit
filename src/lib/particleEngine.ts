import type { Particle, ForceFieldSettings, MousePosition, ForcePulse } from '../types/particle';
import { getColorDistance } from './colorUtils';

export class ParticleEngine {
  private particles: Particle[] = [];
  private settings: ForceFieldSettings;
  private mousePosition: MousePosition = { x: 0, y: 0, active: false };
  private canvasWidth: number = 800;
  private canvasHeight: number = 600;
  private forceDisabled: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private mouseHasMoved: boolean = false;
  private activePulses: Array<ForcePulse & { id: string; start: number } > = [];

  constructor(settings: ForceFieldSettings) {
    this.settings = settings;
  }

  setCanvasSize(width: number, height: number): void {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  setForceDisabled(disabled: boolean): void {
    this.forceDisabled = disabled;
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
    this.activePulses.push({ ...(pulse as any), id, start: performance.now() });
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
    const gridSize = 32; // coarse grid cell size in px
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
          const force = this.settings.restorationForce * 0.01 * healingBoost;
          particle.vx += (dx / distance) * force;
          particle.vy += (dy / distance) * force;
        }
      }

      // Apply pulses (cursor-free)
      if (this.activePulses.length > 0) {
        let ax = 0; let ay = 0;
        for (const p of this.activePulses) {
          const t = (now - p.start);
          const k = Math.max(0, 1 - t / p.durationMs);
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
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const f = p.strength * 0.4 * k;
              ax += (dx / r) * f; ay += (dy / r) * f;
              break;
            }
            case 'implosion': {
              const cx = this.canvasWidth * 0.5; const cy = this.canvasHeight * 0.5;
              const dx = particle.x - cx; const dy = particle.y - cy; const r = Math.hypot(dx, dy) + 1e-3;
              const f = p.strength * 0.4 * k;
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
          }
        }
        particle.vx += ax; particle.vy += ay;
      }

      // Apply forces based on mouse position (allow continuous mode to sustain force without movement)
      if (mouseActive && (this.mouseHasMoved || continuous)) {
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

      // Adaptive damping guard: increase damping as restorationForce grows to prevent overshoot
      const baseDamping = this.settings.healingFactor / 100; // user viscosity [0..1]
      const stiffness = this.settings.restorationForce; // 0..500+
      const extraDamping = Math.min(0.7, (stiffness / 500) * 0.7); // add up to +0.7 with strong stiffness
      const damping = Math.max(0.12, Math.min(0.98, baseDamping + extraDamping));
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

      // Simple local particle-particle separation using spatial grid
      if (collisionsEnabled) {
        const strength = this.settings.collisions?.strength ?? 0.8;
        const radiusMul = this.settings.collisions?.radiusMultiplier ?? 1.2;
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
              if (dist2 > 0 && dist2 < minDist2) {
                const dist = Math.sqrt(dist2);
                const overlap = (minDist - dist) * 0.5 * strength;
                const nx = dx / dist;
                const ny = dy / dist;
                particle.x += nx * overlap;
                particle.y += ny * overlap;
                other.x -= nx * overlap;
                other.y -= ny * overlap;
              }
            }
          }
        }
      }

      // Stabilize particles very close to their original positions to prevent micro-oscillation
      const dxToOrigin = particle.originalX - particle.x;
      const dyToOrigin = particle.originalY - particle.y;
      const distanceToOriginSquared = dxToOrigin * dxToOrigin + dyToOrigin * dyToOrigin;
      const speedSquared = particle.vx * particle.vx + particle.vy * particle.vy;
      // If within ~1px of origin and moving slow, snap to rest
      if (distanceToOriginSquared < 1 && speedSquared < 0.02) {
        particle.x = particle.originalX;
        particle.y = particle.originalY;
        particle.vx = 0;
        particle.vy = 0;
      }

      // Handle wall collisions
      if (this.settings.wallsEnabled) {
        if (particle.x - particle.size < 0) {
          particle.x = particle.size;
          particle.vx = -particle.vx * 0.8;
        } else if (particle.x + particle.size > this.canvasWidth) {
          particle.x = this.canvasWidth - particle.size;
          particle.vx = -particle.vx * 0.8;
        }

        if (particle.y - particle.size < 0) {
          particle.y = particle.size;
          particle.vy = -particle.vy * 0.8;
        } else if (particle.y + particle.size > this.canvasHeight) {
          particle.y = this.canvasHeight - particle.size;
          particle.vy = -particle.vy * 0.8;
        }
      }
    }
    
    // Reset mouse movement flag after processing all particles
    this.mouseHasMoved = false;
    // Purge expired pulses
    if (this.activePulses.length > 0) {
      this.activePulses = this.activePulses.filter(p => (now - p.start) < p.durationMs);
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
    if (visual?.glowEnabled) {
      ctx.shadowColor = 'rgba(255,255,255,0.6)';
      ctx.shadowBlur = visual.glowStrength ?? 8;
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

      // Set color once per particle
      ctx.fillStyle = particle.color;
      
      // Remove unnecessary strokeStyle and lineWidth for better performance
      // ctx.strokeStyle = particle.color;
      // ctx.lineWidth = 1;

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
} 