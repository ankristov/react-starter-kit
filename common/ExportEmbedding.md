## Export & Embedding

### 1. Video/GIF Export
- **Formats**: MP4, WebM, GIF.
- **Controls**: resolution (480p/720p/1080p), duration/live recording, loop for GIF, FPS (30/60), compression presets.
- **Tech**: Canvas Capture Stream + MediaRecorder or WebCodecs; GIF via gif.js or ffmpeg.wasm (worker).
- **UX**: progress indicator; cancel; file size estimate.

Acceptance criteria:
- Exports finish without blocking UI; output matches resolution/FPS/loop settings.
- Failure modes show actionable messages; partial progress does not crash app.

### 2. Ready‑to‑Embed Script
- **Bundle**: single self‑contained `embed.js` with minimal CSS; CDN or self‑hosted.
- **HTML**: `<script>` + `<canvas>` snippet works in WordPress (Gutenberg/Elementor) and plain HTML.
- **Config**: init parameters for image, particle size, heal speed, and preset.

```javascript
ParticleApp.init({
  imageURL: 'mylogo.png',
  particleSize: 3,
  healSpeed: 0.05,
  preset: 'explosion'
});
```

Acceptance criteria:
- Copy/paste embed renders identical result across major browsers.
- Options permit overriding defaults without rebuilding.

### 3. React Native Support
- **Rendering**: `react-native-webgl`/`expo-gl` for WebGL; shared simulation logic as common JS.
- **Mobile UI**: gestures (tap/drag/long‑press/pinch); adaptive particle count.
- **Export**: save video to device; offline mode with preloaded images.

Acceptance criteria:
- Shared core engine module builds on web and RN with minimal shims.
- RN demo achieves smooth interaction at mobile‑appropriate particle counts.

### 4. Mobile Web App (PWA)
- **Capabilities**: installable; offline cache via service workers; responsive; touch gestures.

Acceptance criteria:
- Lighthouse PWA checks pass; offline loads main shell and last used preset.

### 5. Architecture for Export/Embed
- **Core**: Particle Engine (JS + WebGL/GLSL shaders).
- **UI Layer**: React/Tailwind or native UI.
- **Capture Layer**: Canvas → encoder (WebCodecs/MediaRecorder/GIF workers).
- **Export Manager**: save local; optional cloud upload for share links.
- **Embed Builder**: bundler emits `embed.js`; RN component; PWA shell.

### 6. User Flow (Record/Embed)
- Upload image → interact → Record → Stop → choose format → Download or Generate Embed.
