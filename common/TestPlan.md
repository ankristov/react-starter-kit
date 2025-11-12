## Acceptance Test Plan

### Image Upload & Sampling
- [ ] Upload JPG/PNG/WebP/GIF; particles appear with correct colors.
- [ ] Density slider changes particle count and visual resolution; regenerate fast enough.
- [ ] Background removal omits background pixels when enabled.

### Forces & Interactions
- [ ] Attraction/Repulsion/Vortex respond to cursor/touch under 50 ms.
- [ ] Presets (Explosion/Gravity/Vortex/Magnet/Shockwave/Wind) show distinct effects.
- [ ] Continuous vs one‑off mode works; multiple forces combine without instability.

### Healing & Stability
- [ ] Healing returns particles to within 0.5 px of home at rest.
- [ ] Low viscosity settings do not produce visible jitter after 1 s of inactivity.

### Customization & Presets
- [ ] Size/shape/mass/drag/elasticity affect motion/appearance as expected.
- [ ] Visual effects (trails/blur/glow) toggle without large FPS drops on desktop.
- [ ] Save preset → reload page → load preset reproduces same look.
 
### Color-Based Filtering
- [ ] Enable filter → non-selected colors are hidden from physics and rendering within 100 ms.
- [ ] Selecting/deselecting colors updates visible particles correctly.
- [ ] With ~50% of particles hidden at 5k+, frame time improves by ≥35%.
- [ ] Filter settings persist per file (when a file hash is available) and globally otherwise.

### Export & Embedding
- [ ] MP4/WebM/GIF export finishes; output matches selected resolution/FPS/loop.
- [ ] Embed snippet works in Gutenberg, Elementor, and plain HTML page.

### Performance
- [ ] Desktop: 10k particles at 60 FPS; mobile adaptivity engages automatically.
- [ ] Long‑run test (5 min) shows no memory leaks or runaway allocations.
