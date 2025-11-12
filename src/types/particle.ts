export interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  shape: 'circle' | 'square' | 'triangle';
  visible?: boolean; // Add visibility property for filtering
  healingMultiplier?: number; // Multiplier applied to restoration force for partial healing
}

export type ForceType = 'attraction' | 'repulsion' | 'vortex' | 'collider' | 'turbulence';

export interface ForceSettings {
  attraction: {
    strength: number;
    radius: number;
  };
  repulsion: {
    strength: number;
    radius: number;
  };
  vortex: {
    strength: number;
    radius: number;
    clockwise: boolean;
  };
  collider: {
    impactForce: number;
    bounceDamping: number;
    hardness: number;
    radius: number;
  };
  turbulence: {
    strength: number;
    frequency: number;
    chaos: number;
    radius: number;
  };
}

export interface ForceFieldSettings {
  particleDensity: number;
  particleShape: 'circle' | 'square' | 'triangle';
  forceType: ForceType;
  combineForces?: boolean;
  activeForces?: ForceType[];
  continuousMode?: boolean; // true = continuous forces via input; false = one-off impulses only
  forceSettings: ForceSettings;
  healingFactor: number;
  restorationForce: number;
  wallsEnabled: boolean;
  canvasBackgroundColor: string;
  imageScale?: number; // scale factor applied to image-to-particle mapping
  colorFilterSettings: ColorFilterSettings; // Add color filter settings
  performance?: PerformanceSettings;
  partialHealing?: PartialHealingSettings;
  visual?: VisualSettings;
  collisions?: ParticleCollisionSettings;
}

export interface ColorFilterSettings {
  enabled: boolean;
  selectedColors: string[];
  filterMode: 'show' | 'hide'; // 'show' = only show selected, 'hide' = hide selected
  colorTolerance: number; // Number of color clusters to create (1-20)
}

export interface ColorInfo {
  color: string;
  count: number;
  percentage: number;
  name: string; // Human-readable color name
  rgb: { r: number; g: number; b: number };
}

export interface ColorGroup {
  id: string;
  representativeColor: string;
  colors: string[];
  count: number;
  percentage: number;
  name: string;
  rgb: { r: number; g: number; b: number };
}

export interface ControlPanelSettings {
  particleDensity: number;
  particleShape: 'circle' | 'square' | 'triangle';
  forceType: ForceType;
  combineForces?: boolean;
  activeForces?: ForceType[];
  continuousMode?: boolean;
  forceSettings: ForceSettings;
  healingFactor: number;
  restorationForce: number;
  wallsEnabled: boolean;
  canvasBackgroundColor: string;
  imageScale?: number;
  colorFilterSettings: ColorFilterSettings; // Add to control panel settings
  performance?: PerformanceSettings;
  partialHealing?: PartialHealingSettings;
  visual?: VisualSettings;
  collisions?: ParticleCollisionSettings;
}

export interface PerformanceSettings {
  adaptiveEnabled: boolean;
  targetFps: number; // desired FPS, e.g., 60 desktop
  minVisibleFraction: number; // floor for throttling, e.g., 0.3
  adjustStep: number; // step size for adjustments, e.g., 0.05
  visibleFraction?: number; // current throttle fraction [0..1]
}

export interface PartialHealingSettings {
  enabled: boolean;
  fastFraction: number; // [0..1] fraction of particles that heal faster
  speedMultiplier: number; // multiplier for restoration force for selected particles
}

export interface VisualSettings {
  trailsEnabled: boolean;
  trailFade: number; // [0..1] amount of fade each frame (e.g., 0.1)
  glowEnabled: boolean;
  glowStrength: number; // px of shadow blur
  additiveBlend: boolean; // use 'lighter' composite
  autoThrottle?: boolean; // automatically disable expensive effects when FPS drops
}

export interface ParticleCollisionSettings {
  enabled: boolean;
  strength: number; // separation impulse multiplier
  radiusMultiplier: number; // expand collision radius relative to size sum
}

export type ExportPreset = 'original' | 'instagramReel' | 'youtube' | 'square' | 'custom';

export interface ExportSettings {
  preset: ExportPreset;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  mimeType?: string; // e.g., 'video/webm;codecs=vp9'
}

// Force pulse types for one-click, cursor-free disturbances
export type ForcePulseType =
  | 'gravity'
  | 'wind'
  | 'tornado'
  | 'shockwave'
  | 'noise'
  | 'ripple'
  | 'burst'
  | 'implosion'
  | 'magnetPair'
  | 'waterfall'
  | 'gravityFlip'
  | 'shear'
  | 'crosswind'
  | 'swirlField'
  | 'ringSpin'
  | 'spiralIn'
  | 'spiralOut'
  | 'waveLeft'
  | 'waveUp'
  | 'randomJitter'
  | 'supernova'
  | 'ringBurst'
  | 'edgeBurst'
  | 'multiBurst'
  | 'quake';

export interface ForcePulse {
  id: string;
  type: ForcePulseType;
  durationMs: number;
  strength: number; // generic scale used by type-specific fields
  origin?: { x: number; y: number; normalized?: boolean }; // default center if omitted
  directionDeg?: number; // for wind/gravity direction
  clockwise?: boolean; // for tornado
  frequency?: number; // for noise/ripple
  chaos?: number; // for noise
}

export interface MousePosition {
  x: number;
  y: number;
  active: boolean;
} 