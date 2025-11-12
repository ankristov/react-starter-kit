## Product Requirements Document (PRD)

### 1. Core Concept
- **Idea**: Convert an uploaded image into an interactive particle field. User interactions apply forces; the system “heals” back to the original arrangement with beautiful, smooth transitions.
- **Loop**: Image → particle field → user forces → disruption → healing → stable image.

### 2. Goals
- **Playfulness**: Immediate, delightful interactions with cursor/touch and impact presets.
- **Beauty**: High-quality transitions, motion blur/trails, smooth easing, glow/bloom.
- **Creativity**: Rich customization of physics and visuals; presets to share and remix.
- **Shareability**: Simple recording and embedding for social/posts/sites.

### 3. Non‑Goals (v1)
- Full-featured image editing suite (beyond basic preprocessing like background removal and palette simplification).
- Heavy multi-user collaboration (beyond future roadmap ideas).
- Complex 3D scene editing (depth is simulated/parallax only in add-ons).

### 4. Target Users & Use Cases
- **Designers/Marketers**: Generative hero visuals, logo reveals, landing-page effects, shareable snippets.
- **Creators/Developers**: Interactive embeds, background animations, experimentation playground.
- **Educators/Students**: Visualizing force fields and particle systems.

### 5. Success Metrics
- **Performance**: 60 FPS up to 10k particles on modern desktop; adaptive degradation on mobile.
- **Engagement**: Time-on-canvas, number of interactions per session, preset saves/loads.
- **Output**: Successful exports (MP4/WebM/GIF), embed usages, error-free completion rate.

### 6. Key Experience Principles
- **Immediate feedback**: Interactions feel responsive; no noticeable lag.
- **Graceful motion**: Easing and damping eliminate jitter; healing feels organic.
- **Progressive control**: Sensible defaults; advanced controls available without clutter.
- **Safe performance**: Adaptive particle count/effects for device capability.

### 7. High‑Level Requirements (overview)
- Image upload (JPG/PNG/WebP/GIF) → pixel sampling → particle creation with color mapping and shapes.
- Interactions: cursor/touch forces, impact presets (explosion, gravity, vortex, magnet, shockwave, wind).
- Healing: spring-like return force; adjustable healing speed; partial/organic healing.
- Customization panel: particle props (size/shape/mass/elasticity/friction/color mode), system forces, visual effects, collision toggle, palette filtering.
- Output: record to MP4/WebM/GIF; embeddable widget; auto-resizing canvas.
- Tech: React UI + WebGL renderer; GPU-accelerated updates; Zustand/Redux for state.
 - Color-based filtering: select specific colors or color groups to display/hide to reduce compute and focus visuals.

### 8. Constraints & Assumptions
- Runs in modern browsers; mobile support with adaptive performance.
- No hardcoded secrets; optional cloud APIs for background removal.
- Export implemented in-browser where possible; fall back to worker-based encoders.

### 9. Acceptance (done) Criteria
- User can upload supported images and see particles within 2 seconds on desktop.
- Interactions apply forces with visible, smooth response under 50 ms input latency.
- Healing reliably returns particles to original positions without jitter at low viscosity.
- Recording produces playable MP4/WebM/GIF at chosen resolution/FPS.
- Embed snippet works in WordPress (Gutenberg/Elementor) and plain HTML pages.
 - Enabling color filtering hides non-matching particles from both physics and rendering within 100 ms and yields proportional performance gains at scale.
