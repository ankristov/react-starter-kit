# Image Crops Mode - Quick Start Guide

## What is Image Crops Mode?

Image Crops mode cuts your uploaded image into square tiles. Each tile is a particle that scatters when forces are applied, then returns to reconstruct the original image. It's a beautiful way to visualize image decomposition and reassembly under force dynamics.

## How to Use

### 1. Upload an Image
Click the **Upload** button and select any image (JPG, PNG, WebP, etc.)

### 2. Select Animation Mode
At the top of the control panel, you'll see two cards:
- **● ● ●** (Particles) - Default colored circle mode
- **⊞⊞⊞** (Image Crops) - Square tile mode

Click the **Image Crops** card to switch to tile mode.

### 3. Configure Tile Settings

#### Grid Size (8-64)
Controls how many tiles to create per side:
- **8×8** = 64 large tiles (minimal detail)
- **16×16** = 256 tiles (recommended default)
- **24×24** = 576 tiles (good detail)
- **32×32** = 1024 tiles (very detailed, more particles)
- **64×64** = 4096 tiles (extreme, may be slow)

**Recommendation:** Start at 16, adjust based on image size and performance.

#### Rotate Tiles When Scattered
When enabled, tiles will spin/rotate as they scatter away from forces. Creates a dynamic, swirling effect.

#### Glow Tiles When Scattered
When enabled, tiles get a glowing effect during motion. Best combined with additive blending.

### 4. Adjust Shared Settings

These controls work identically for both modes:

**Forces**
- Gravity, Wind, Tornado, Shockwave, Ripple, Burst, etc.
- All 26 force types available
- Adjust strength, duration, direction, frequency

**Visual Effects**
- Trails: Fade motion paths
- Glow: Add light bloom
- Additive Blend: Light accumulation effect
- Auto Throttle: Smooth performance

**Performance**
- Adaptive Mode: Auto-adjust visible tiles for smooth 60 FPS
- Target FPS: Set desired frame rate
- Visible Fraction: Minimum percentage of tiles to draw

**Healing**
- Restoration Force: How fast tiles return to original positions
- Partial Healing: Subset of tiles return faster
- Speed Multiplier: Adjust return animation speed

**Collisions**
- Tile-to-tile collision detection
- Separation strength and radius

### 5. Apply a Force Impact

1. Select a force type from the dropdown (e.g., "Burst", "Tornado")
2. Adjust parameters (strength, direction, origin, etc.)
3. Click **Impact!** to trigger

Tiles will scatter according to the force, then smoothly return to reconstruct the image.

### 6. Record Animation
1. Set export format and FPS (top right)
2. Click **Start Recording**
3. Apply forces/impacts to create your animation
4. Click **Stop Recording**
5. Download WebM or click **Smooth Video** for interpolated version

## Creative Tips

### Beautiful Combinations
1. **Swirling Reconstruction**
   - Force: Tornado (Clockwise)
   - Duration: 2000ms
   - Strength: 50+
   - Enable Tile Rotation

2. **Explosive Scatter & Return**
   - Force: Supernova
   - Intensity: 2.0
   - Radius: 1500px
   - Enable Glow & Additive Blend

3. **Gentle Wave Motion**
   - Force: Wave Left
   - Frequency: 2.0
   - Wave Count: 5
   - No rotation needed

4. **Chaotic Jitter**
   - Force: Random Jitter
   - Chaos: 1.5
   - Duration: 1500ms
   - Enable Rotation

5. **Spatial Compression**
   - Force: Implosion
   - Strength: 60
   - Duration: 1000ms
   - Watch tiles compress toward center

### Performance Tuning

If animation is too slow:
- Reduce grid size (e.g., 16→12)
- Enable Adaptive Mode under Performance
- Reduce target FPS
- Disable tile rotation/glow
- Enable collision culling

If tiles don't return quickly enough:
- Increase Restoration Force (main controls)
- Increase healing Speed Multiplier
- Reduce force duration

### Canvas Size Presets

- **Original**: Use image's native size
- **Instagram Reel**: 1080×1920 (vertical video)
- **YouTube**: 1920×1080 (horizontal video)
- **Square**: 1080×1080 (social media)
- **Custom**: Set your own dimensions

Larger canvas = larger tile images = better detail but more memory.

## Troubleshooting

**Q: Tiles aren't showing up**
- Check animation mode is set to "Image Crops"
- Try clicking Refresh button
- Check particle opacity slider (should not be 0%)

**Q: Animation is very slow**
- Reduce grid size
- Enable Adaptive Mode
- Reduce canvas size
- Try a smaller image

**Q: Tiles don't return to original position**
- Increase Restoration Force value
- Check healing is enabled
- Try reducing force strength

**Q: Recording not working**
- Interpolation server may be unavailable
- Check console for errors
- Ensure both servers running: `npm run dev` + `npm run start-interpolate-server`

**Q: Video download failed**
- Try downloading original WebM first
- Check browser console for errors
- Ensure sufficient disk space

## Advanced Usage

### Combining with Particles Mode
1. Start in Particles mode to see base effect
2. Switch to Image Crops with same force settings
3. Compare visual style differences

### Pre-planning Animations
1. Test force parameters without recording
2. Note effective combinations
3. Record final animation with optimized settings

### Multi-Force Sequences
Use the **Force Impact** panel to queue multiple forces:
1. Apply first force (e.g., Burst)
2. Wait for particles to return (no force needed)
3. Apply second force (e.g., Tornado)
4. Repeat for sequence

### Export Optimization
For smooth playback:
- Set FPS to 30 (smoother for slower motion)
- Use "Smooth Video" to interpolate to 60 FPS
- Record at target resolution to avoid upscaling
- Use Additive Blend and Trails for motion blur effect

## Settings Persistence

Your animation mode choice and settings are automatically saved to browser localStorage:
- Default mode on startup
- Grid size preference
- Force parameters
- Visual effect settings

Load "Default State" to restore saved configuration.

## Combining Modes in Recording

You can switch modes during recording:
1. Start recording in Particles mode
2. Switch to Image Crops mode (animation continues recording)
3. Apply forces in new mode
4. Result: Video shows mode transition

This creates unique hybrid animations!

---

**Pro Tip:** Start simple (16×16 grid, basic force) and iterate. Each parameter change can dramatically affect visual results. Experiment!
