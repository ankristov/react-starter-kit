## Functional Requirements (FRD)

### 1. Image Upload and Processing
- **Supported formats**: JPG, PNG, WebP, GIF (first frame; optional animated particle GIF mode).
- **Sampling**: Pixel sampling to particle positions; configurable density (resolution vs. performance).
- **Color mapping**: Particle color taken from source pixel; optional color palette simplification.
- **Preprocessing (optional)**:
  - Background removal via on-device ML (TF.js) or cloud API.
  - Palette simplification (cluster colors into k groups).

Acceptance criteria:
- Uploading any supported file renders a particle field with matching colors.
- Density slider affects particle count and visual resolution in real time or on regenerate.
- If background removal is enabled, background pixels are omitted/de‑emphasized.

### 2. Particle System
- **Particle properties (user configurable)**: size, shape (circle/square/custom sprite/emoji), mass, elasticity/restitution, friction/drag, color mode (original/gradient/random).
- **Physics model**:
  - Each particle has an immutable home position based on the image.
  - Spring-like restoration force toward home (healing).
  - Interactions: collision/repulsion/attraction between particles (toggleable).
- **Rendering**:
  - WebGL-based renderer (PixiJS/Three.js/custom GLSL).
  - GPU-accelerated updates to support thousands of particles.

Acceptance criteria:
- Changing size/shape/mass/drag updates behavior/appearance immediately.
- With collisions on, overlapping particles resolve separation with stable motion.
- Renderer maintains target FPS (see NFR) with 10k particles on desktop.

### 3. Interactions
- **Cursor/Touch**: repel/attract on hover/tap; push waves through the system.
- **Impact presets**: Explosion, Gravity, Vortex, Magnet, Shockwave, Wind.
- **Multi‑mode**: combine forces (e.g., gravity + wind); continuous vs. one‑off.

Acceptance criteria:
- All presets produce distinct, parameterized effects.
- User can combine two or more forces concurrently without instability.
- Continuous mode sustains a force until toggled off; one‑off applies a single impulse.

### 4. Healing / Restoration
- Constant spring force to home; adjustable healing speed.
- Partial healing: subset of particles heal faster for organic motion.

Acceptance criteria:
- Healing returns particles to within 0.5 px of home under default damping.
- At low viscosity, particles stabilize (no visible jitter) within 1 second of rest.

### 5. Customization Panel
- **Particle settings**: size slider; shape selector; mass, friction, elasticity; color mode.
- **System settings**: force strength/falloff; healing intensity; collisions on/off.
- **Visual effects**: motion blur, trails, glow/bloom, color shift over time.
- **Presets**: save/load user presets; optional public preset gallery.

Acceptance criteria:
- All controls persist via local storage or file‑specific settings where applicable.
- Saved presets restore identical visual/physical behavior when reloaded.

### 6. Output / Sharing
- **Recording**: export MP4/WebM; animated GIF.
- **Live embed**: embeddable widget; responsive canvas.

Acceptance criteria:
- Export produces playable files matching chosen resolution/FPS.
- Embed snippet renders the same effect with configurable init parameters.

### 7. Color-Based Filtering
- **Filtering goal**: Allow users to filter particles by specific colors to reduce on‑screen particles and corresponding compute cost.
- **Controls**: Enable/disable filter; select colors (exact or grouped); mode to show only selected colors or hide selected colors.
- **Color grouping (optional)**: Provide palette simplification into k color groups for easier selection.

Acceptance criteria:
- When filtering is enabled, non‑matching particles are excluded from physics updates and rendering.
- Toggling filters updates visible particles within 100 ms on desktop.
- With filtering active, overall frame time decreases proportionally to the number of hidden particles (e.g., hiding ~50% yields a measurable FPS or CPU improvement at 5k+ particles).
- Filter selection persists per file or globally as appropriate.
