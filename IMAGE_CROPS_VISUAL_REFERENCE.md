# Image Crops Feature - Visual Reference & Examples

## Animation Mode Selector (UI)

```
┌─────────────────────────────────┐
│      ANIMATION MODE             │
├─────────────────────────────────┤
│  ┌─────────────┐  ┌──────────┐  │
│  │   ●●●       │  │  ⊞⊞⊞     │  │
│  │             │  │          │  │
│  │ Particles   │  │ Image    │  │
│  │             │  │ Crops    │  │
│  └─────────────┘  └──────────┘  │
│     (Cyan)         (Magenta)    │
│    SELECTED          default    │
└─────────────────────────────────┘
```

When clicked, selection changes with visual feedback (border glow, shadow, background color).

---

## Grid Size Examples

### 8×8 Grid (64 tiles)
```
Large tiles, less detail
████████
████████
████████
████████
████████
████████
████████
████████
```

### 16×16 Grid (256 tiles - RECOMMENDED)
```
Good balance of detail and performance
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
████████████████
```

### 32×32 Grid (1024 tiles)
```
High detail, more particles
[Grid too large to display - represents 32×32]
Very detailed but impacts performance
```

### 64×64 Grid (4096 tiles)
```
Maximum detail, use only if:
- High-end GPU
- Small canvas
- Static animations
- Not real-time interaction
```

---

## Control Panel Layout - Image Crops Mode

```
┌────────────────────────────────────┐
│  MAIN SECTION                      │
├────────────────────────────────────┤
│                                    │
│  Animation Mode Selector (Cards)   │
│  ┌─────────────┬─────────────┐    │
│  │   ●●●       │  ⊞⊞⊞ *     │    │
│  │ Particles   │  Image Crops│    │
│  └─────────────┴─────────────┘    │
│                                    │
│  Grid Size: 8─────●───────────64  │
│  Value: 16                         │
│  Total tiles: 256                  │
│                                    │
│  ☑ Rotate tiles when scattered    │
│  ☑ Glow tiles when scattered      │
│                                    │
│  [Shape selector]                  │
│  [Canvas background color]         │
│  [Background image settings]       │
│  [Particle opacity]                │
│  [Canvas size preset]              │
│  [Image scale]                     │
│  [Restoration force]               │
│  [Viscosity]                       │
│  [Walls toggle]                    │
│                                    │
└────────────────────────────────────┘
```

\* = Current mode

---

## Control Panel Layout - Particles Mode

```
┌────────────────────────────────────┐
│  MAIN SECTION                      │
├────────────────────────────────────┤
│                                    │
│  Animation Mode Selector (Cards)   │
│  ┌─────────────┬─────────────┐    │
│  │   ●●● *     │  ⊞⊞⊞       │    │
│  │ Particles   │  Image Crops│    │
│  └─────────────┴─────────────┘    │
│                                    │
│  Grid Resolution (Density):        │
│  100──────●───────────────50000    │
│  Value: [10000]                    │
│  Particles: 12,847                 │
│                                    │
│  [Shape selector]                  │
│  [Canvas background color]         │
│  [Background image settings]       │
│  [Particle opacity]                │
│  [Canvas size preset]              │
│  [Image scale]                     │
│  [Restoration force]               │
│  [Viscosity]                       │
│  [Walls toggle]                    │
│                                    │
└────────────────────────────────────┘
```

---

## Force Impact Section (Shared by Both Modes)

```
┌────────────────────────────────────┐
│  FORCE IMPACT                      │
├────────────────────────────────────┤
│                                    │
│  Preset: [Burst ▼]                │
│                                    │
│  ┌─ TIMING & EASING ──────────┐  │
│  │ Duration: [1500] ms         │  │
│  │ Ease Type: [Ease-In-Out ▼] │  │
│  │ Ease In: [0.2]              │  │
│  │ Ease Out: [0.2]             │  │
│  └─────────────────────────────┘  │
│                                    │
│  ┌─ FORCE PARAMETERS ─────────┐  │
│  │ Strength: [30]              │  │
│  │ Intensity: [1.0]            │  │
│  │ Radius: [1500] px           │  │
│  └─────────────────────────────┘  │
│                                    │
│  ┌─ ORIGIN ───────────────────┐  │
│  │ Origin X: [0.5]             │  │
│  │ Origin Y: [0.5]             │  │
│  └─────────────────────────────┘  │
│                                    │
│       [    IMPACT!    ]            │
│                                    │
└────────────────────────────────────┘

Same controls work for both Particles and Image Crops!
```

---

## Animation Sequence Example

### Burst Force on Image Crops (16×16 grid)

```
FRAME 0: Original Image (256 tiles)
████████████████████████████████
████████████████████████████████
████████████████████████████████
████████████████████████████████

FRAME 5: Tiles scattering (outward from center)
  ▢▢▢▢▢  ▢▢▢▢▢
 ▢            ▢
▢              ▢
▢    ████████  ▢
▢    ████████  ▢
▢    ████████  ▢
▢    ████████  ▢
 ▢            ▢
  ▢▢▢▢▢  ▢▢▢▢▢

FRAME 15: Peak scatter (max distance)
▢▢                            ▢▢
                    
▢                                ▢

            ████████
            ████████
            ████████
            ████████
            
▢                                ▢
                    
▢▢                            ▢▢

FRAME 25: Returning (moving back)
  ▢▢▢▢▢  ▢▢▢▢▢
 ▢            ▢
▢              ▢
▢    ████████  ▢
▢    ████████  ▢
▢    ████████  ▢
▢    ████████  ▢
 ▢            ▢
  ▢▢▢▢▢  ▢▢▢▢▢

FRAME 30: Reconstructed (original position)
████████████████████████████████
████████████████████████████████
████████████████████████████████
████████████████████████████████
```

With `tileRotationOnScatter: true`, tiles spin during scatter/return.
With `tileGlowOnScatter: true`, tiles glow while scattered.

---

## Force Type Visual Effects

### Attractive Forces (tiles move inward)
```
  ⊞ ⊞ ⊞
⊞       ⊞
⊞   ↓   ⊞   →   Center compression
⊞       ⊞
  ⊞ ⊞ ⊞
```
Examples: Implosion, Gravity (if center)

### Repulsive Forces (tiles move outward)
```
      ⊞
  ⊞   ↑   ⊞
⊞   Center   ⊞   →   Radial expansion
  ⊞   ↑   ⊞
      ⊞
```
Examples: Burst, Supernova, Ring Burst

### Rotational Forces (tiles spin/orbit)
```
  ↻ ⊞ ↻
⊞       ⊞
⊞   ⤴   ⊞   →   Circular motion
⊞       ⊞
  ↻ ⊞ ↻
```
Examples: Tornado, Vortex, Ring Spin

### Directional Forces (tiles push one way)
```
⊞ ⊞ ⊞
→ → →   →   Motion in direction
⊞ ⊞ ⊞
```
Examples: Wind, Gravity (vertical), Wave Left

---

## Settings Impact on Visuals

### Restoration Force
```
LOW (0-100):        HIGH (300-500):
Slow return         Fast return
Floaty motion       Snappy motion
Drifting effect     Elastic effect
```

### Viscosity (Healing Factor)
```
LOW (0-20):         HIGH (50-100):
Lively bouncy        Smooth gliding
Chaotic scatter     Controlled motion
Sharp stops         Gradual slowdown
```

### Image Scale
```
SCALE 0.5:          SCALE 1.0:          SCALE 2.0:
Zoomed out          Original            Zoomed in
Smaller tiles       Normal view         Larger tiles
```

### Particle Opacity
```
0% (transparent)    50% (semi)          100% (solid)
Ghostly faint       Translucent         Bold solid
Ethereal effect     Normal rendering    High contrast
```

---

## UI Color Scheme

```
Animation Mode Cards:
┌─────────────────────┐
│ PARTICLES (Default) │  ← Cyan theme (●●●)
│ Border: cyan-400    │     glowing when selected
│ Bg: cyan-500/20     │
└─────────────────────┘

┌─────────────────────┐
│ IMAGE CROPS (New)   │  ← Magenta theme (⊞⊞⊞)
│ Border: fuchsia-400 │     glowing when selected
│ Bg: fuchsia-500/20  │
└─────────────────────┘

Selected state:
- Brighter border
- Stronger background color
- Box shadow glow effect
- Shadow color matches theme

Unselected state:
- Dimmer border
- Darker background
- Subtle hover effect
- Interactive cursor
```

---

## File Type Support

✅ **Supported Image Formats:**
- JPEG (.jpg, .jpeg) - Best for photos
- PNG (.png) - Best for graphics with transparency
- WebP (.webp) - Modern format, good compression
- BMP (.bmp) - Uncompressed bitmap
- GIF (.gif) - Animated GIF (first frame used)

🚫 **Not Supported:**
- SVG (vector graphics)
- TIFF (needs special handling)
- ICO (too small usually)

---

## Grid Size Performance Matrix

| Grid | Tiles | Memory | Desktop | Mobile | Notes |
|------|-------|--------|---------|--------|-------|
| 8×8 | 64 | ~10MB | 60fps | 60fps | Very fast |
| 12×12 | 144 | ~20MB | 60fps | 45fps | Good balance |
| 16×16 | 256 | ~40MB | 60fps | 30fps | **RECOMMENDED** |
| 20×20 | 400 | ~60MB | 45fps | 25fps | Detailed |
| 24×24 | 576 | ~90MB | 30fps | 15fps | High detail |
| 32×32 | 1024 | ~160MB | 20fps | 10fps | Very detailed |
| 48×48 | 2304 | ~360MB | 10fps | 5fps | Extreme |
| 64×64 | 4096 | ~640MB | <10fps | <5fps | Not recommended |

(Estimates for typical 1920×1080 images)

---

## Canvas Size Presets

```
Original (Image Size):
Uses image's native dimensions
Best for: Maintaining aspect ratio

Instagram Reel (1080×1920):
Vertical format
Best for: Social media vertical video

YouTube (1920×1080):
Horizontal format
Best for: YouTube, presentation

Square (1080×1080):
Equal dimensions
Best for: Social media (Instagram, TikTok)

Custom:
User-defined
Best for: Specific project needs
```

---

## State Diagram - Animation Mode System

```
                    ┌──────────────────┐
                    │  App Initializes │
                    └─────────┬────────┘
                              │
                    ┌─────────v────────┐
                    │ Default: Particles│
                    └─────────┬────────┘
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
    ┌───────v────────┐           ┌─────────────v──────┐
    │ User Clicks    │           │ User Clicks Image  │
    │ Particles Card │           │ Crops Card         │
    └───────┬────────┘           └─────────────┬──────┘
            │                                  │
    ┌───────v─────────────────┐      ┌────────v──────────────────┐
    │ animationMode =         │      │ animationMode =            │
    │ 'particles'             │      │ 'imageCrops'               │
    └───────┬─────────────────┘      └────────┬──────────────────┘
            │                                 │
    ┌───────v─────────────────┐      ┌────────v──────────────────┐
    │ Show Particles Controls:│      │ Show Image Crops Controls: │
    │ - Density slider        │      │ - Grid size slider         │
    │                         │      │ - Rotation toggle          │
    │ Regenerate particles    │      │ - Glow toggle              │
    │ from colors             │      │                            │
    │                         │      │ Regenerate particles       │
    └─────────────────────────┘      │ from tiles                 │
                                     └────────────────────────────┘
            │                                 │
            └──────────────┬──────────────────┘
                          │
                ┌─────────v─────────┐
                │ All Shared Controls:
                │ - Forces (all 26)
                │ - Effects
                │ - Performance
                │ - Recording
                │ - Export
                └───────────────────┘
```

---

## Quick Decision Tree: Which Grid Size?

```
                   START: Choose Grid Size
                          │
                    ┌─────v─────┐
                    │ Large     │
                    │ image?    │
                    │ >2000px   │
                    └─────┬─────┘
                     YES  │  NO
            ┌────────────┘ └──────────────┐
            │                             │
        ┌───v─────┐               ┌──────v──┐
        │ Fast    │               │ Need    │
        │ movement │              │ detail? │
        │?         │              │         │
        └───┬─────┘               └──┬───┬──┘
         YES│ NO                YES  │   │ NO
            │  │                     │   │
         12 │ 16               24    │   8
         x12 │ x16              x24   │   x8
            │  │                     │   │
            └──┴─────────┬───────────┴───┘
                        │
                   [CHOSEN]
                   Grid Size
```

---

**This visual reference helps understand the feature intuitively!**

For detailed technical info, see: `IMAGE_TILES_IMPLEMENTATION.md`
For usage guide, see: `IMAGE_CROPS_QUICK_START.md`
