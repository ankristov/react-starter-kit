# Wall Collision Analysis & Solution

## The Problem: Last Row & Column Displacement

When you click "Collisions ON" in the Wall Properties section, the last column and row of tiles displace and overlay the previous ones. This happens **only from the right and bottom sides**, not from the left and top.

### Root Cause

The issue stems from how particle size-based clamping works with edge tiles:

1. **Particles store their center position** (x, y)
2. **Each particle has a size** (collision radius): `particle.size = Math.max(displayTileWidth, displayTileHeight) / 2`
3. **When walls are enabled (bounce mode)**, particles get clamped inward by their size:
   ```typescript
   if (particle.x + particle.size > this.canvasWidth) {
     particle.x = this.canvasWidth - particle.size;  // Clamp inward by size!
   }
   ```

### Why Only Right & Bottom?

- **Left/Top walls**: Clamp formula is `particle.size` (inward by minimum)
- **Right/Bottom walls**: Clamp formula is `this.canvasWidth - particle.size` (inward by varying amounts)

**The critical difference:**
- Edge tiles have **different sizes** because they're remainder pixels of the grid
- For example, in an 800px image with 8 columns:
  - Regular tiles: 100px wide (size = 50)
  - Last column: 0-100px wide but actually 0-100px ≠ column 7 (67-100px is 33px!)
  
When clamped by their individual sizes, edge particles move inward by different amounts:
- Tile A: clamped to 800 - 50 = 750
- Tile B: clamped to 800 - 60 = 740 (different position!)

This creates **relative displacement and overlapping**.

### Why Only Right & Bottom?

The asymmetry exists because:
1. **Left bound** clamping: `particle.x = particle.size` (uniform inward displacement)
2. **Right bound** clamping: `particle.x = canvasWidth - particle.size` (varies with each particle's size)
3. Same pattern for top vs bottom

The left and top bounds use direct assignment to a fixed value (the size), so all particles move equally. The right and bottom bounds subtract a varying size from a constant, causing differential displacement.

## The Solution: Two Wall Modes

The solution introduces **two distinct wall collision modes**:

### 1. BOUNCE Mode (Default)
- **Behavior**: Traditional elastic collision with bouncing
- **Use case**: When you want dynamic particle interactions with walls
- **Issue**: Causes displacement of edge tiles due to size-based clamping
- **Physics**: 
  - Velocity reversal with elasticity coefficient
  - Particles clamped by their collision size
  - Can apply repulsion force on impact

### 2. CONFINE Mode (NEW - Recommended for Grid Layouts)
- **Behavior**: Hard boundary confinement without bouncing
- **Use case**: Perfect for tile-based grids where you want perfect alignment
- **Advantage**: No size-based displacement - all particles confined exactly to canvas boundaries
- **Physics**:
  - Particles clamped directly to canvas edges (0 to canvasWidth, 0 to canvasHeight)
  - Center position becomes boundary position (no "particle size" offset)
  - Velocity stops in constrained directions
  - Can still apply repulsion force when hitting boundary

## Implementation Details

### ParticleEngine Changes (particleEngine.ts)

Two separate collision handling paths:

```typescript
if (wallMode === 'confine') {
  // Hard clamp to canvas boundaries, no size offset
  const clampedX = Math.max(0, Math.min(particle.x, this.canvasWidth));
  const clampedY = Math.max(0, Math.min(particle.y, this.canvasHeight));
  
  particle.x = clampedX;
  particle.y = clampedY;
  
  // Kill velocity in constrained directions
  if (hitLeftWall || hitRightWall) particle.vx = 0;
  if (hitTopWall || hitBottomWall) particle.vy = 0;
} else {
  // Original bounce mode with size-based clamping
  // (Kept for backward compatibility)
}
```

### ControlPanel Changes (ControlPanel.tsx)

New UI section in Wall Properties:
- **Mode Selector**: Two buttons - "Bounce" and "Confine"
- **Conditional Display**: Only shows when Collisions are ON
- **Description**: Explains difference between modes

## Behavior Comparison

| Aspect | Bounce Mode | Confine Mode |
|--------|-------------|--------------|
| Grid Alignment | ❌ Edge tiles shift inward | ✅ Perfect grid maintained |
| Particle Physics | ✅ Elastic bouncing | ❌ Hard stop (no bounce) |
| Wall Interaction | Dynamic movement | Static boundary |
| Right/Bottom Bias | ❌ Yes (displacement) | ✅ No (symmetric) |
| Repulsion Available | ✅ Yes | ✅ Yes |
| Velocity After Impact | Reversed + damped | Zeroed |
| Use Case | Free-form particle sim | Tile-based grid layouts |

## How to Use

1. **Upload an image** (or use default)
2. **Go to Wall Properties section**
3. **Click "Collisions ON"** to enable wall interaction
4. **Select Wall Mode**:
   - Choose **"Confine"** for perfect grid alignment (no displacement)
   - Choose **"Bounce"** for elastic particle bouncing
5. **Optional**: Enable "Repulsion" to push particles away from edges
6. **Optional**: Adjust "Repulsion Strength" (0-5) for intensity

## Technical Notes

### Why Right/Bottom Displacement Happens (Bounce Mode)

In the original bounce mode with edge tiles:
- Last column: rendered as 33px wide (not 100px)
- Particle size calculated as: `max(33, height) / 2` 
- When hitting right wall: `x = 800 - particle.size` = 800 - 16.5 = 783.5
- Regular columns: `x = 800 - 50` = 750

The 33.5px difference causes visible displacement.

### Confine Mode Advantage

By clamping to exact canvas boundaries without size consideration:
- All particles snap to exactly 0 or canvasWidth (800) on hit
- No differential spacing
- Perfect grid preservation
- Suitable for pixel-perfect layouts

## Future Enhancements

Possible improvements:
1. **"Hard Bounce" mode**: Prevent leaving canvas but maintain size-based physics
2. **"Soft Confine" mode**: Smooth deceleration toward boundary instead of hard stop
3. **Direction-specific modes**: Different behavior for each wall
4. **Particle size adjustment**: Auto-scale edge tiles to match grid spacing
