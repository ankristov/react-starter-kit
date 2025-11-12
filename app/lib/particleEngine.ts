export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  originalX: number;
  originalY: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'triangle';
  visible?: boolean;
}

export interface ForceFieldSettings {
  particleDensity: number;
  healingFactor: number;
  particleSize: number;
  particleShape: 'circle' | 'square' | 'triangle';
  effectRadius: number;
  forceStrength: number;
  forceType: 'repulsion' | 'attraction' | 'vortex' | 'collider';
  pulseMode: boolean;
  repulsion: {
    strength: number;
    radius: number;
  };
  attractor: {
    strength: number;
    radius: number;
  };
  vortex: {
    strength: number;
    radius: number;
    direction: 'clockwise' | 'counterclockwise';
  };
  collider: {
    strength: number;
    radius: number;
  };
}

export interface MousePosition {
  x: number;
  y: number;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private settings: ForceFieldSettings;
  private mousePos: MousePosition = { x: 0, y: 0, active: false };
  private frameCounter = 0;

  constructor(settings: ForceFieldSettings) {
    this.settings = settings;
  }

  generateParticlesFromImage(imageData: ImageData): void {
    const { width, height, data } = imageData;
    const particles: Particle[] = [];
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / this.settings.particleDensity)));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const a = data[index + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        const color = `rgb(${r}, ${g}, ${b})`;
        
        particles.push({
          x: x,
          y: y,
          vx: 0,
          vy: 0,
          originalX: x,
          originalY: y,
          color,
          size: this.settings.particleSize,
          shape: this.settings.particleShape,
          visible: true,
        });
      }
    }

    this.particles = particles;
  }

  updateParticles(): void {
    this.particles.forEach(particle => {
      if (particle.visible === false) {
        return;
      }
      // Apply healing force (return to original position)
      const dx = particle.originalX - particle.x;
      const dy = particle.originalY - particle.y;
      particle.vx += dx * this.settings.healingFactor * 0.001;
      particle.vy += dy * this.settings.healingFactor * 0.001;

      // Apply mouse force if active
      if (this.mousePos.active) {
        const mouseDx = this.mousePos.x - particle.x;
        const mouseDy = this.mousePos.y - particle.y;
        const distance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

        if (distance < this.settings.effectRadius) {
          const force = this.calculateForce(mouseDx, mouseDy, distance);
          particle.vx += force.x;
          particle.vy += force.y;
        }
      }

      // Apply damping
      particle.vx *= 0.95;
      particle.vy *= 0.95;

      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
    });
  }

  private calculateForce(dx: number, dy: number, distance: number): { x: number; y: number } {
    const normalizedDx = dx / distance;
    const normalizedDy = dy / distance;
    const effectStrength = this.settings.forceStrength * 0.01;

    switch (this.settings.forceType) {
      case 'repulsion':
        const repulsionForce = effectStrength / (distance * 0.1);
        return {
          x: -normalizedDx * repulsionForce,
          y: -normalizedDy * repulsionForce
        };

      case 'attraction':
        const attractionForce = effectStrength / (distance * 0.1);
        return {
          x: normalizedDx * attractionForce,
          y: normalizedDy * attractionForce
        };

      case 'vortex':
        const vortexForce = effectStrength / (distance * 0.1);
        const direction = this.settings.vortex.direction === 'clockwise' ? 1 : -1;
        return {
          x: -normalizedDy * vortexForce * direction,
          y: normalizedDx * vortexForce * direction
        };

      case 'collider':
        const colliderForce = effectStrength * Math.exp(-distance / this.settings.collider.radius);
        return {
          x: -normalizedDx * colliderForce,
          y: -normalizedDy * colliderForce
        };

      default:
        return { x: 0, y: 0 };
    }
  }

  drawParticles(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    this.particles.forEach(particle => {
      if (particle.visible === false) {
        return;
      }
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 1;

      switch (particle.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fill();
          break;

        case 'square':
          ctx.fillRect(
            particle.x - particle.size,
            particle.y - particle.size,
            particle.size * 2,
            particle.size * 2
          );
          break;

        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y - particle.size);
          ctx.lineTo(particle.x - particle.size, particle.y + particle.size);
          ctx.lineTo(particle.x + particle.size, particle.y + particle.size);
          ctx.closePath();
          ctx.fill();
          break;
      }
    });
  }

  setMousePosition(x: number, y: number, active: boolean): void {
    this.mousePos = { x, y, active };
  }

  updateSettings(settings: Partial<ForceFieldSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  resetParticles(): void {
    this.particles.forEach(particle => {
      particle.x = particle.originalX;
      particle.y = particle.originalY;
      particle.vx = 0;
      particle.vy = 0;
    });
  }

  getParticleCount(): number {
    return this.particles.length;
  }

  getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Apply color-based filtering to particles by toggling their visibility.
   * When disabled, all particles are shown.
   */
  applyColorFilter(options: { enabled: boolean; selectedColors: string[]; mode: 'show' | 'hide' }): void {
    const { enabled, selectedColors, mode } = options;
    if (!enabled) {
      for (const p of this.particles) {
        p.visible = true;
      }
      return;
    }
    const set = new Set(selectedColors);
    for (const p of this.particles) {
      const inSet = set.has(p.color);
      p.visible = mode === 'show' ? inSet : !inSet;
    }
  }

  /**
   * Returns a histogram of colors present in the current particles, sorted by count desc.
   */
  getColorHistogram(limit: number = 16): Array<{ color: string; count: number }> {
    const counts = new Map<string, number>();
    for (const p of this.particles) {
      const c = counts.get(p.color) || 0;
      counts.set(p.color, c + 1);
    }
    const entries = Array.from(counts.entries())
      .map(([color, count]) => ({ color, count }))
      .sort((a, b) => b.count - a.count);
    return entries.slice(0, Math.max(0, limit));
  }
} 