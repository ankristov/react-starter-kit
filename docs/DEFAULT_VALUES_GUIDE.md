# Default Values Configuration Guide

This guide explains where to modify default values for all UI elements in the Force Field application.

## Overview

The application uses a centralized configuration system where most default values are defined in the Zustand store. This makes it easy to customize the initial state of all controls and settings.

## Main Configuration Files

### 1. **Primary Defaults - `src/store/forceFieldStore.ts`**

This is the **main file** containing the `defaultSettings` object with all core defaults:

#### Particle Settings
```typescript
particleDensity: 2000,           // Number of particles
particleShape: 'circle',         // 'circle' | 'square' | 'triangle'
particleOpacity: 1.0,           // 0.0 to 1.0
```

#### Force Settings
```typescript
forceType: 'repulsion',         // Default force type
forceSettings: {
  attraction: { strength: 25, radius: 35 },
  repulsion: { strength: 20, radius: 30 },
  vortex: { strength: 40, radius: 35, clockwise: true },
  collider: { impactForce: 3.5, bounceDamping: 0.8, hardness: 0.5, radius: 25 },
  turbulence: { strength: 12, frequency: 1.5, chaos: 0.4, radius: 45 },
},
```

#### Physics Settings
```typescript
healingFactor: 8,               // Particle restoration speed
restorationForce: 30,           // Force pulling particles back
wallsEnabled: true,             // Boundary walls on/off
wallRepulsion: {
  enabled: false,               // Wall collision repulsion
  strength: 1.0,               // Repulsion strength (0-5)
},
```

#### Visual Effects
```typescript
visual: {
  trailsEnabled: false,         // Particle trails
  trailFade: 0.08,             // Trail fade rate
  glowEnabled: false,          // Particle glow effect
  glowStrength: 8,             // Glow intensity
  additiveBlend: false,        // Additive color blending
  autoThrottle: true,          // Auto performance throttling
},
```

#### Performance Settings
```typescript
performance: {
  adaptiveEnabled: false,       // Adaptive performance mode
  targetFps: 60,               // Target frame rate
  minVisibleFraction: 0.3,     // Minimum visible particles
  adjustStep: 0.1,             // Performance adjustment step
  visibleFraction: 1.0,        // Current visible fraction
},
```

#### Collision Settings
```typescript
collisions: {
  enabled: false,              // Particle-to-particle collisions
  strength: 0.8,               // Collision force
  radiusMultiplier: 1.2,       // Collision detection radius
},
particleInteraction: {
  elasticity: 0.5,             // Bounce factor (0=sticky, 1=bouncy)
  collisionStrength: 0.8,      // Separation force
  friction: 0.5,               // Movement resistance
},
```

#### Color Filter Settings
```typescript
colorFilterSettings: {
  enabled: true,               // Color filtering on/off
  selectedColors: [],          // Initially selected colors
  filterMode: 'show',          // 'show' | 'hide'
  colorTolerance: 10,          // Color clustering sensitivity
},
```

#### Animation Mode Settings
```typescript
animationMode: 'particles',    // 'particles' | 'imageCrops'
imageCropGridSize: 16,         // Grid size for image crop mode
tileRotationOnScatter: true,   // Rotate tiles when scattered
tileGlowOnScatter: false,      // Glow tiles when scattered
```

#### Background Settings
```typescript
canvasBackgroundColor: '#0f0f23',  // Dark blue background
backgroundImage: null,              // No default background image
imageScale: 1,                      // Image scaling factor
```

### 2. **Control Panel UI Defaults - `src/components/ControlPanel.tsx`**

Initial state values for UI controls (around lines 70-120):

#### Canvas Size Controls
```typescript
const [customWidth, setCustomWidth] = useState<number>(desiredCanvasSize?.width || 800);
const [customHeight, setCustomHeight] = useState<number>(desiredCanvasSize?.height || 600);
const [canvasPreset, setCanvasPreset] = useState<CanvasPreset>('original');
```

#### Force Pulse Controls
```typescript
const [pulseSelected, setPulseSelected] = useState<ForcePulseType>('burst');
const [pulseDuration, setPulseDuration] = useState<number>(1500);
const [pulseHoldTime, setPulseHoldTime] = useState<number>(0);
const [pulseInertia, setPulseInertia] = useState<number>(500);
const [forceMode, setForceMode] = useState<'impulse' | 'continuous'>('impulse');
const [easeIn, setEaseIn] = useState<number>(0.2);
const [easeOut, setEaseOut] = useState<number>(0.2);
```

#### Grid Size Controls
```typescript
const [gridSizeInput, setGridSizeInput] = useState<string>((settings.imageCropGridSize ?? 16).toString());
```

### 3. **Export Settings Defaults - `src/store/forceFieldStore.ts`**

Default export/recording settings (around line 260):

```typescript
exportSettings: { 
  preset: 'instagramReel',      // Default export preset
  width: 1080,                  // Export width
  height: 1920,                 // Export height
  fps: 60,                      // Export frame rate
  durationSec: 5,               // Export duration
  mimeType: 'video/mp4'         // Export format
}
```

### 4. **Force-Specific Controls - `src/components/ForceTypeControls.tsx`**

Contains the individual force type slider configurations and their min/max ranges.

### 5. **Color Filter Defaults - `src/components/ColorFilter.tsx`**

Auto-selection behavior (around line 160):
```typescript
// Select all colors by default when groups are loaded
if (memoizedColorGroups.length > 0 && colorFilterSettings.selectedColors.length === 0) {
  const allColors = memoizedColorGroups.flatMap(group => group.colors);
  if (allColors.length > 0) {
    // Select all colors, enable the filter, and default to "Show selected"
    updateSettings({
      colorFilterSettings: {
        ...colorFilterSettings,
        selectedColors: allColors,
        enabled: true,
        filterMode: 'show',
      },
    });
  }
}
```

## How to Modify Defaults

### Quick Changes
For most settings, simply modify the values in the `defaultSettings` object in `src/store/forceFieldStore.ts`:

```typescript
// Example: Change default particle density
particleDensity: 3000,  // Changed from 2000

// Example: Enable trails by default
visual: {
  trailsEnabled: true,  // Changed from false
  // ... other visual settings
},

// Example: Change default force type
forceType: 'attraction',  // Changed from 'repulsion'
```

### UI Control Defaults
For control panel initial states, modify the `useState` calls in `src/components/ControlPanel.tsx`:

```typescript
// Example: Change default pulse type
const [pulseSelected, setPulseSelected] = useState<ForcePulseType>('tornado'); // Changed from 'burst'

// Example: Change default canvas size
const [customWidth, setCustomWidth] = useState<number>(1200); // Changed from 800
```

## Important Notes

1. **Persistence**: These defaults only affect new sessions. Users can save their own defaults using the "Save Default" button.

2. **File-Specific Settings**: The app supports file-specific settings that override global defaults.

3. **Reset Behavior**: The "Reset to Defaults" functionality uses these `defaultSettings` values.

4. **Performance Impact**: Some defaults (like `particleDensity`) significantly impact performance. Test changes on various devices.

5. **Validation**: Ensure new default values are within acceptable ranges defined in the UI controls.

## Testing Your Changes

After modifying defaults:

1. **Clear Browser Storage**: Clear localStorage to test with fresh defaults
2. **Test Reset Function**: Verify "Reset to Defaults" uses your new values
3. **Test Performance**: Ensure new defaults don't cause performance issues
4. **Test All Modes**: Check both 'particles' and 'imageCrops' animation modes

## Related Files

- `src/types/particle.ts` - Type definitions for all settings
- `src/lib/particleEngine.ts` - Core particle physics engine
- `src/components/ForceFieldCanvas.tsx` - Main canvas component
- `README.md` - General project documentation

---

*Last updated: November 28, 2025*