# Chrono-Loom: Hands-First Spatial Synth & AI Co-Composer
### Official Entry for the Meta VR Start Developer Competition 2026

[![Meta Quest 3 & Pro](https://img.shields.io/badge/Meta%20Quest-3%20%26%20Pro%20Ready-00f0ff?style=for-the-badge&logo=meta)](https://github.com/Orsted10/Chrono-Loom)
[![WebXR 90Hz/120Hz Locked](https://img.shields.io/badge/WebXR-90Hz%20%2F%20120Hz%20Locked-10b981?style=for-the-badge)](https://github.com/Orsted10/Chrono-Loom)
[![Pure Procedural Audio](https://img.shields.io/badge/Web%20Audio-100%25%20Procedural-f59e0b?style=for-the-badge)](https://github.com/Orsted10/Chrono-Loom)
[![Zero-Backend P2P](https://img.shields.io/badge/Multiplayer-WebRTC%20P2P%2030Hz-a855f7?style=for-the-badge)](https://github.com/Orsted10/Chrono-Loom)
[![Accessibility Award Target](https://img.shields.io/badge/Accessibility-Award%20Target%20%2425k-ec4899?style=for-the-badge)](https://github.com/Orsted10/Chrono-Loom)

**Chrono-Loom** is a hands-first WebXR spatial musical instrument, kinetic clockwork sculpture engine, and autonomous agentic AI co-composer built for Meta Quest 3 and WebXR-compliant headsets. Strictly engineered for **zero-fatigue seated play** within an airplane-seat $0.55\text{m}$ envelope, Chrono-Loom turns pinch gestures, spatial geometric tension, and cascading kinetic pulses into an acoustic cyber-cathedral of self-playing music sculptures.

---

## 🏆 Targeted Award Categories & Scorecard

### 1. Best Seated VR Experience
- **Strict Airplane-Seat Envelope**: Confined within a $< 0.55\text{m}$ reach radius centered $0.45\text{m}$ in front of the seated user at eye level ($y = 1.20\text{m}$).
- **Ergonomic Seated Comfort Arc Console**: Curved frosted-glass console with bioluminescent interactive boundary edge that highlights upon plucks and prevents arm fatigue.
- **Zero Physical Chair Collision**: 100% playable leaning back comfortably with forearms rested on armrests or desk.
- **Ergonomic Auto-Bring (`Key C` / `[PULL CLOSER]`)**: Instantly pulls the entire workspace closer (from $z = -0.45\text{m}$ to $z = -0.30\text{m}$) and compacts the radius down to $0.35\text{m}$ for users with limited mobility or wheelchair lap trays.

### 2. Best Agentic Interaction ("Agent Aria v2")
- **Autonomous Perception-Action State Machine**: 3-ring gyroscope companion orb orbiting at `(0.35, 1.35, -0.50)` operating across `OBSERVING`, `HARMONIZING`, `WEAVING`, `CALL_AND_RESPONSE`, and `CELEBRATING`.
- **Musical Phrase Analyzer & Call-and-Response**: Aria listens to the user's last 4 plucked notes, analyzes rhythmic density and interval tension, flies to a complementary spatial sweet-spot, and weaves a 2-bar counter-melody via optical laser filaments.
- **Push-to-Talk Natural Intent Director (`Key V` / `[🎤 TALK TO ARIA]`)**: Web Speech API recognition parses natural commands (*"make it faster"*, *"add a bassline"*, *"switch to raga scale"*, *"harmonize with me"*, *"clear the loom"*) with expressive 3D emotional animations (curious head-tilt, joyful barrel-roll, focused laser weave) and dual-formant procedural vocalizations.
- **Tactile Fist-Bump & Poke Interaction**: Reaching out to fist-bump or poke Aria cycles modes: `CO-CREATE`, `RHYTHM BOOST`, `ZEN SOLO`.

### 3. Best Reason to Come Back (7-Day Constellation Archive & Harmonic Vault)
- **Deterministic 7-Day Star-Map Drawer (`Key Y` / `[⭐ STAR-MAP]`)**: Seeded daily constellation puzzles (*#319 Orion's Harp*, *#320 Lyra Spiral*, *#321 Pleiades Triad*, *#322 Today's Zenith*) with daily harmony streak tracking.
- **Harmonic Vault (`Key K` / `[📁 VAULT]`)**: Local gallery of up to 8 saved sculptures with auto-generated miniature 2D SVG star-map thumbnails.
- **1-Click Lossless Audio Loop Recorder (`[🔴 REC LOOP]`)**: Captures pristine 15-second lossless 16-bit stereo PCM `.wav` loops + `.json` constellation snapshots directly via `MediaStreamDestination`.
- **Portable Constellation Sharing**: 1-click Base64 URL hash export (`#loom=...`) for instant constellation sharing across devices.

### 4. Mixed Reality (MR) Passthrough & Visual Immersion (Quest 3 & Pro)
- **Automatic Passthrough Void Dissolution**: Entering `immersive-ar` dissolves the dark void fog and opaque floor, seamlessly placing floating holographic instruments and Aria directly in the user's physical room.
- **WebXR Plane Detection & Wall-Bounce Acoustics**: Pinched nodes magnetically snap onto real-world tables and desks ($< 0.06\text{m}$) with a holographic base-pedestal. Stray Chrono-Pulses eject outward as luminous **Photon Darts**, physically bouncing off real walls and triggering early-reflection stereo echoes in `SpatialSynth` scaled to room dimensions.
- **Custom GLSL Quantum Strings (`QuantumStringMaterial`)**: Standing-wave transverse harmonics ($\sin(n\pi u)\cos(\omega t)$) computed directly in the vertex shader with spectral chromatic aberration fringes and traveling soliton energy packets.
- **GPU Instanced Ribbon Trails (`RibbonTrailPool`)**: 256 instanced ribbons trailing behind moving fingertips and flying pulses in exactly 1 draw call, smoothly tapering over $0.45\text{s}$ with Adreno GPU precision guards.

### 5. Best Accessibility Forward Experience ($25,000 Award Target)
- **1-Handed Virtual Anchor Tether & Magnetic Gaze Snap**: 100% of spatial weaving can be performed with a single hand or gaze. Pinching a node once latches a dynamic wavy electric tether; pinching a second node (or empty space) completes the weave without continuous dragging.
- **Dual-Input Parity (Hands + Quest Touch Controllers)**: Automatically renders sleek transparent laser styluses at controller tips with variable haptic pulses scaled to string tension and sub-bass frequencies.
- **Dwell-Select & Single-Switch Mode (`Key S` / `[DWELL MODE]`)**: Motor-disability players hold gaze or hand steady on a node for $0.85\text{s}$ (with animated 360° cyan-to-gold fill-ring) to auto-latch anchor tethers, or trigger via spacebar single-switch.
- **High-Contrast Rim-Lighting & Dyslexia Typography (`Key L`)**: $2.5\times$ emissive electric-gold rim outlines for low-vision players and letter-spaced dyslexia-friendly typography badges.
- **Shape-Coded Synesthesia**: Polyhedral encoding (Cube = Bass, Octahedron = Mid, Tetrahedron = High) with floating 3D note badges (`C3`, `E4`, `A4`, `C5`).
- **Visual Haptic Sub-Bass Waveform Rings**: Concentric ripple rings with thickness scaled to sub-bass frequency, enabling Deaf and hard-of-hearing players to visually feel acoustic rhythms.

---

## ⚡ Quest 3 90Hz/120Hz Frame-Pacing & Zero-GC Profiler

Chrono-Loom is architected for strict zero-garbage frame pacing on Meta Quest 3 Adreno 740 GPUs:
1. **Zero Per-Frame Heap Allocations**: All `update(dt)` loops across `LoomEngine.ts`, `SceneManager.ts`, `AgentAria.ts`, and `AccessibilityManager.ts` utilize module-scoped scratch vectors (`_scratchVecA`, `_scratchVecB`, `_scratchQuat`, `_scratchColor`).
2. **Dynamic Foveated Rendering**: Calls `renderer.xr.setFoveation(1.0)` on session start for maximum eye-tracked / fixed foveation fill-rate optimization.
3. **90Hz / 120Hz Refresh Rate Negotiation**: Negotiates target frame rate via `session.updateTargetFrameRate(120)` with 90Hz fallback.
4. **Real-Time Telemetry Profiler (`Key P` / `[📊 PROFILER]`)**:
   - **2D DOM HUD Badge**: Rolling average FPS, frame time (ms), draw calls, triangle count, active audio voices, and `0 KB/frame` GC status.
   - **3D In-VR Floating Holographic Billboard**: Canvas billboard floating at `(0.42, 1.46, -0.48)` for undeniable video capture proof of locked 90–120 FPS during headset recordings.

---

## 🎬 6-Act Multi-Angle "OMG Director's Cut" Trailer Mode

Press **`Shift + D`** or click **`[🎥 TRAILER CUT]`** to launch the choreographed 60-second multi-angle masterclass walkthrough:
- **Act 1 (0.0s – 8.0s)**: *Awakening the Seed Orb* — Gentle breathing dolly forward; right hand pinches golden seed orb, pulls open, detonating awakening burst and swelling ambient pad.
- **Act 2 (8.0s – 18.0s)**: *Weaving Constellation #322* — Angled macro high-quarter camera view; bimanual weaving of Ring 1 (E4), Ring 2 (A4), and Ring 3 (C5).
- **Act 3 (18.0s – 28.0s)**: *Kinetic Pulses & Supernova* — Low hero angle; sweeping index arpeggio plucks, cascading Clockwork beads, resonance rings energized, victory supernova explosion!
- **Act 4 (28.0s – 39.0s)**: *Agent Aria Co-Composer* — Wide 16° circular orbit sweep; fist-bumping Aria triggers Call-and-Response counter-melody via glowing optical laser filaments.
- **Act 5 (39.0s – 50.0s)**: *Euclidean Polyrhythm & Raga Scale* — Extreme macro string zoom; left wrist twist cycles Bjorklund $E(5,8)$ constellation ring, morphs scale to **Raga Yaman Evening** with sunset amber/rose lighting and vibrating quantum standing waves.
- **Act 6 (50.0s – 60.0s)**: *Accessibility Suite & Audio Vault Capture* — Seated POV restoration; Pull-Closer compact reach ($0.30\text{m}$), sub-bass visual waveform rings, live 15-second lossless `.wav` recording, and grand finale chord.
- *Yields control instantly if the user moves their mouse, touches a controller, or pinches in space.*

---

## 🎮 Complete Controls Matrix

| Action | Optical Hand Tracking (Quest) | Quest Touch Controllers | Desktop 3D Simulator |
|---|---|---|---|
| **Awaken Loom** | Pinch golden Seed Orb & pull outward | Pull Trigger on Seed Orb & drag outward | Left-Click Drag on Seed Orb outward |
| **Spawn Harmonic Node** | Pinch empty comfort space for 0.2s | Hold Index Trigger in space for 0.2s | Hold Left-Click in space for 0.2s |
| **Move Node** | Pinch & drag any node | Grip / Trigger on node & drag | Left-Click Drag node |
| **Weave ChronoString** | Drag Node to Node, or 2-hand pinch | Drag Node to Node with laser stylus | Left-Click Drag Node to Node |
| **1-Hand Virtual Tether** | Pinch Node A once $\to$ Pinch Node B | Click Node A $\to$ Click Node B | Click Node A $\to$ Click Node B |
| **3D Spatial Plucking** | Sweep index fingertip through string | Sweep laser stylus tip through string | Sweep cursor through string |
| **Palm-Muting (Freeze)** | Open Palm near node ($< 0.12\text{m}$) | Open hand / release grip near node | Press <kbd>O</kbd> & hover near node |
| **Cycle Aria AI Mode** | Fist-bump or pinch Aria ($< 0.08\text{m}$) | Touch Aria with controller tip | Click "Cycle Aria Mode" / Poke 3D |
| **Push-to-Talk Voice** | Speak into Quest mic | Speak into Quest mic | Press <kbd>V</kbd> or click <em>Talk to Aria</em> |
| **Euclidean Rhythm Twist** | Twist wrist roll while pinching node | Twist wrist roll while gripping node | Mouse Wheel over node while pinching |
| **Scale Modes [1–5]** | Poke Wrist HUD Scale button | Press <kbd>A</kbd>/<kbd>X</kbd> or poke HUD | Keys <kbd>1</kbd>–<kbd>5</kbd> / click Scale button |
| **Time-Dilation Conductor** | Face palms & raise/lower hands | Hold grips & raise/lower controllers | Press <kbd>T</kbd> / click Conductor |
| **Harmonic Chord Bloom** | Pinch node + outward flick | Grip node + outward flick | Press <kbd>B</kbd> while hovering node |
| **Acoustic Scissors Cut** | Index + middle finger scissor snip | Trigger + Grip squeeze on string | Press <kbd>X</kbd> while hovering string |
| **Dwell-Select / Switch** | Hold hand steady on node for 0.85s | Hold laser on node for 0.85s | Press Single-Switch <kbd>S</kbd> |
| **Pull Workspace Closer** | Poke HUD or press Key <kbd>C</kbd> | Poke HUD or press Key <kbd>C</kbd> | Press <kbd>C</kbd> / click Pull Closer |
| **Toggle A11y Suite** | Poke HUD or press Key <kbd>A</kbd> | Poke HUD or press Key <kbd>A</kbd> | Press <kbd>A</kbd> / click A11y Suite |
| **Contrast & Dyslexia** | Poke HUD or press Key <kbd>L</kbd> | Poke HUD or press Key <kbd>L</kbd> | Press <kbd>L</kbd> / click Contrast & Font |
| **First-Pluck Guide** | Poke <em>[? GUIDE]</em> on wrist | Poke <em>[? GUIDE]</em> | Press <kbd>U</kbd> / click [? GUIDE] |
| **7-Day Star-Map** | Poke <em>⭐ Star-Map</em> on wrist | Poke <em>⭐ Star-Map</em> | Press <kbd>Y</kbd> / click Star-Map |
| **Harmonic Vault** | Poke <em>📁 Vault</em> on wrist | Poke <em>📁 Vault</em> | Press <kbd>K</kbd> / click Vault |
| **Lossless WAV Recorder** | Poke <em>🔴 Rec Loop</em> on wrist | Poke <em>🔴 Rec Loop</em> | Click [🔴 Rec Loop [15s]] |
| **Zero-GC Profiler** | Poke <em>📊 Profiler</em> on wrist | Poke <em>📊 Profiler</em> | Press <kbd>P</kbd> / click Profiler |
| **Trailer Cut Showcase** | Press <kbd>Shift+D</kbd> | Press <kbd>Shift+D</kbd> | Press <kbd>Shift+D</kbd> / click Trailer Cut |
| **P2P Multiplayer Jam** | Poke <em>Jam Room</em> on wrist | Poke <em>Jam Room</em> | Press <kbd>J</kbd> / click Jam Room |

---

## 🥽 Meta Quest 3 / Passthrough / Accessibility Test Guide

### 1. Mixed Reality Passthrough Testing
1. Launch Chrono-Loom on Meta Quest Browser over HTTPS.
2. Click **ENTER AR (PASSTHROUGH)** on the launcher toolbar.
3. Observe the cyber-zen dark void dissolve instantly: your physical room is visible in full color passthrough.
4. Pinch and spawn a Harmonic Node; bring it within $0.06\text{m}$ of your physical desk or table: notice it magnetically docks with a holographic base-pedestal.
5. Pluck a string with velocity $> 1.1\text{m/s}$: watch a luminous Photon Dart eject outward, physically bounce off your real walls/ceiling, and trigger spatial early-reflection stereo echoes in `SpatialSynth`!

### 2. Zero-Fatigue Seated & Accessibility Testing
1. Lean completely back in your chair. Press <kbd>C</kbd> or poke **[PULL CLOSER]**: notice the entire loom shifts closer ($z = -0.30\text{m}$) and shrinks to a $0.35\text{m}$ radius for zero arm-extension fatigue.
2. Press <kbd>S</kbd> to enable **Dwell Mode**: hover your gaze or single hand over any node for $0.85\text{s}$ without pinching; observe the 360° radial fill-ring complete and auto-latch the Virtual Anchor Tether.
3. Press <kbd>L</kbd> to enable **High-Contrast Rim-Lighting & Dyslexia Typography**: observe high-visibility electric-gold outlines and letter-spaced note badges.

### 3. Quest 3 90Hz/120Hz Frame-Pacing Verification
1. Press <kbd>P</kbd> or click **[📊 Profiler [P]]**.
2. Look at the floating 3D holographic billboard in VR:
   - Frame rate shows locked **90.0 FPS** or **120.0 FPS**.
   - Frame time reads **11.1 ms** (90Hz) or **8.3 ms** (120Hz).
   - GC Allocation reads **0 KB / frame** (zero per-frame heap churn).
   - Dynamic Foveation confirms **1.0 (Maximum Adreno Optimization)**.

---

## 🧱 Architecture Overview

```
                                  +-----------------------+
                                  |     SceneManager      |
                                  |  WebXR Pacing 90/120Hz|
                                  |  Foveation 1.0 (Adreno|
                                  +-----------+-----------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
         +-----------v-----------+                         +-----------v-----------+
         |   HandInputManager    |                         |      LoomEngine       |
         |  Hands + Touch Haptics|                         |  Zero-GC Kinetic Loop |
         |  Euclidean Hysteresis |                         |  Quantum Strings GLSL |
         +-----------+-----------+                         +-----------+-----------+
                     |                                                 |
         +-----------+-----------+                         +-----------+-----------+
         |   AccessibilityManager|                         |     SpatialSynth      |
         |  1-Hand Tether & Dwell|                         |  Procedural HRTF 3D   |
         |  Visual Haptic Waves  |                         |  Stereo Reverb + Pad  |
         +-----------------------+                         +-----------+-----------+
                     |                                                 |
     +---------------+---------------+                 +---------------+---------------+
     |               |               |                 |               |               |
+----v-----+   +-----v----+   +------v---+       +-----v----+    +-----v----+    +-----v----+
|AgentAria |   |Euclidean |   |MRSurfaces|       |Harmonic  |    |Multiplayer|   |DemoDirector|
|Co-Composer|  |Engine    |   |Plane Snaps|      |Vault     |    |WebRTC P2P |   |6-Act 60s Cut|
|Voice Int. |  |5 Scales  |   |Wall Echo |       |15s Lossless|  |Ghost Hands|   |Dolly/Macro |
+----------+   +----------+   +----------+       +----------+    +----------+    +----------+
```

---

## 🚀 Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Local Dev Server
```bash
npm run dev
```
- Open `http://localhost:5173` on Desktop.
- Open `http://<YOUR-LOCAL-IP>:5173` on Meta Quest Browser.

### 3. Production Build
```bash
npm run build
```
Compiles a production bundle with Three.js chunk splitting, strict TypeScript verification, and zero warnings.

---

## 🌐 Instant Free HTTPS Deployment (For Competition Judges)

WebXR requires a secure `https://` origin. Deploy the `/dist` directory in seconds:

### Option A: Vercel (Instant HTTPS)
```bash
npx vercel --prod
```
Deploys via the pre-configured [vercel.json](file:///e:/META/vercel.json) with valid SSL certificates.

### Option B: GitHub Pages
```bash
npx gh-pages -d dist
```

---

## 📄 License
MIT License. Created for the **Meta VR Start Developer Competition 2026**.
