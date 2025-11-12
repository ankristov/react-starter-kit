## Technical Requirements

### 1. Frontend Architecture
- **UI**: React + TypeScript, Tailwind/shadcn for components.
- **Rendering**: WebGL canvas (PixiJS/Three.js or custom GLSL). CPU fallback for lower counts.
- **State**: Zustand or Redux for parameters, presets, and UI state.

### 2. Physics & Simulation
- **GPU path**: regl/WebGL2/WebGPU compute or fragment-shader ping‑pong for velocity/position.
- **CPU path**: Optimized typed arrays; spatial hashing/grid for collisions.
- **Determinism**: Seeded PRNG for repeatable presets (optional).
 - **Color filter pipeline**: Efficient visibility masks (bitset/boolean flags) applied before physics and render loops to skip hidden particles.

### 3. Performance Targets
- 60 FPS up to 10,000 particles on modern desktop (RTX‑class iGPU/dGPU).
- Adaptive degradation on mobile: auto lower particle count/effects.
- Lazy-load heavy modules (encoders, ML models) on demand.
 - Color filtering must scale linearly: skipping N% of particles reduces per‑frame work by ~N% within ±10% tolerance.

### 4. Data Flow
- Image upload → pixel sampling → particle creation → render loop → export/embedding (optional).
- Settings persisted in localStorage; per-file overrides via file hash.
 - Color filter settings persisted (selected colors, mode, grouping) per file when a file hash is available.

### 5. Security & Privacy
- No secrets in client code; optional cloud APIs configured via env and proxied.
- Sanitize file input; constrain canvas operations to prevent OOM.

### 6. Accessibility (A11y)
- Keyboard-accessible controls; labels; color-contrast aware UI.
- Reduced motion preference respected for effects intensity.

### 7. Internationalization (optional)
- Copy strings centralized; ready for localization.

### 8. Telemetry (optional)
- Anonymous performance and feature usage with opt‑in consent.

### 9. Testing
- Unit tests for sampling, forces, damping/healing convergence.
- Visual regression for key presets (snapshot frames).
- Performance tests for target particle counts.

### 10. Risks & Mitigations
- GIF export CPU heavy → worker/wasm encoders; progress UI.
- WebCodecs availability → fallback to MediaRecorder.
- Mobile GPU variance → aggressive adaptivity and feature gates.
