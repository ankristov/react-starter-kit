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
  // For image tiles mode
  tileImageData?: ImageData; // Tile texture for image crops mode
  tileSize?: number; // Width in pixels for tile rendering
  tileHeightSize?: number; // Height in pixels for tile rendering (can differ from width for rectangular tiles)
  rotation?: number; // Rotation angle for scattered tiles effect
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
  particleOpacity: number; // opacity of particles (0-1, default 1.0)
  backgroundImage: BackgroundImageSettings | null;
  colorFilterSettings: ColorFilterSettings; // Add color filter settings
  performance?: PerformanceSettings;
  partialHealing?: PartialHealingSettings;
  visual?: VisualSettings;
  collisions?: ParticleCollisionSettings;
  particleInteraction?: ParticleInteractionSettings;
  // Animation mode settings
  animationMode?: 'particles' | 'imageCrops'; // 'particles' = pixel particles, 'imageCrops' = tiled image
  imageCropGridSize?: number; // Grid size for image tiles (8-64), e.g., 16 = 16x16 grid
  tileRotationOnScatter?: boolean; // Enable rotation effect when tiles scatter
  tileGlowOnScatter?: boolean; // Enable glow effect on scattered tiles
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
  particleInteraction?: ParticleInteractionSettings;
  animationMode?: 'particles' | 'imageCrops';
  imageCropGridSize?: number;
  tileRotationOnScatter?: boolean;
  tileGlowOnScatter?: boolean;
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

export interface ParticleInteractionSettings {
  elasticity: number; // 0-1: how bouncy particles are (0=sand, 1=billiard balls)
  collisionStrength: number; // 0-1: how forcefully particles push each other apart
  friction: number; // 0-1: energy loss during movement (0=floaty, 1=sticky/sluggish)
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
  | 'quake'
  | 'randomize';

export interface ForcePulse {
  id: string;
  type: ForcePulseType;
  durationMs: number;
  strength: number; // generic scale used by type-specific fields
  mode?: 'impulse' | 'continuous'; // 'impulse' = fire once, 'continuous' = keep applying until stopped (default: impulse)
  origin?: { x: number; y: number; normalized?: boolean }; // default center if omitted
  directionDeg?: number; // for wind/gravity direction
  clockwise?: boolean; // for tornado
  frequency?: number; // for noise/ripple
  chaos?: number; // for noise
  // Easing controls
  easeIn?: number; // 0-1, how much to ease in at start (0 = no ease, 1 = full ease)
  easeOut?: number; // 0-1, how much to ease out at end (0 = no ease, 1 = full ease)
  easeType?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic' | 'ease-in-quad' | 'ease-out-quad' | 'ease-in-out-quad'; // Type of easing curve
  inertiaMs?: number; // Additional time to let particles coast to a stop after pulse ends (default 0ms, no inertia)
  // For randomize - timing controls
  scatterSpeed?: number; // speed multiplier for moving to random positions (default 3.0)
  scatterDurationPercent?: number; // percentage of total duration for scatter phase (default 30)
  holdTimeMs?: number; // time to hold at random positions before returning (default 500ms)
  returnDurationPercent?: number; // percentage of total duration for return phase (default: remaining after scatter + hold)
  returnSpeed?: number; // speed multiplier for returning to original positions (default 2.0) - not used anymore but kept for compatibility
  // Type-specific parameters
  radius?: number; // for burst, implosion, shockwave, etc.
  intensity?: number; // for supernova, quake, etc.
  waveCount?: number; // for ripple, waveLeft, waveUp
  spiralTurns?: number; // for spiralIn, spiralOut
}

export interface MousePosition {
  x: number;
  y: number;
  active: boolean;
}

// Recorded particle state for video rendering - OPTIMIZED to only store visual data
export interface RecordedParticle {
  x: number;
  y: number;
  color: string; // RGB string
  size: number;
  shape: 'circle' | 'square' | 'triangle';
  visible: boolean;
}

export interface RecordedFrame {
  timestamp: number; // relative to recording start (ms)
  particles: RecordedParticle[];
}

export interface BackgroundImageSettings {
  imageDataUrl: string | null;
  scale: number;
  positionX: number;
  positionY: number;
  width: number | null;
  height: number | null;
  rotation: number;
  aspectRatioLock: boolean;
  originalWidth: number;
  originalHeight: number;
} 