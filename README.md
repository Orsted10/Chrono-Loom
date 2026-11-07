# Chrono-Loom: Hands-First Spatial Synth & AI Co-Composer
### Official Entry for the Meta VR Start Developer Competition 2026

**Chrono-Loom** is a hands-first WebXR spatial musical instrument, kinetic clockwork engine, and agentic AI co-composition experience built for Meta Quest headsets and modern WebXR browsers. Designed from the ground up for ergonomic seated play (within an airplane-seat 2-foot envelope), Chrono-Loom turns pinch gestures, spatial tension, and kinetic pulses into an acoustic cyber-cathedral of self-playing music sculptures.

---

## Targeted Award Categories

1. **Best Seated VR Experience**:
   - Strictly confined to an airplane-seat radius ($< 0.55\text{m}$, centered $0.45\text{m}$ in front of the user at eye level $y = 1.2\text{m}$).
   - Ergonomic curved frosted-glass **Seated Comfort Arc** console zone.
   - Zero physical chair collision; 100% playable while leaning back comfortably.

2. **Best Agentic Interaction ("Agent Aria")**:
   - An expressive autonomous spatial AI companion orb at `(0.35, 1.35, -0.50)` built from three counter-rotating glowing rings.
   - Operates a live perception-action state machine (`OBSERVING` $\to$ `HARMONIZING` $\to$ `WEAVING` $\to$ `CELEBRATING`).
   - Observes user plucking tempo (BPM) and spatial density; autonomously flies to empty harmonic sweet-spots, spawns complementary purple/gold AI nodes, and weaves counter-melody strings.
   - Fist-bump or pinch Aria directly to cycle AI modes: `CO-CREATE`, `RHYTHM BOOST`, `ZEN SOLO`.

3. **Best Reason to Come Back (Daily Constellation Challenge)**:
   - Floating spatial wrist HUD tracks daily challenges (e.g. `Constellation #322`).
   - Guides kinetic pulses through 3 Target Resonance Rings to trigger a massive 120-particle supernova, triumphant spatial chord progression, and Aria's celebratory orbital dance.

4. **Mixed Reality (MR) Passthrough & Visual Immersion (Quest 3 & Pro)**:
   - Full WebXR `immersive-ar` support with automatic room passthrough integration: seamlessly dissolves the dark void and fog while keeping floating holographic instruments, the comfort arc, and Aria in the user's real room.
   - Dual session launcher: **ENTER VR** (dark cyber-zen void) or **ENTER AR (PASSTHROUGH)** (holographic mixed reality).
   - Audio-reactive Cymatic Sonar Wave rings expand across the floor and comfort arc matching each pluck frequency.
   - Soft additive-blended glow aura halos on all nodes, pulses, and Aria for cinematic neon bloom without mobile frame drops.

5. **Best Accessibility Forward Experience ($25,000 Award Target)**:
   - **One-Handed Complete Playability & Virtual Anchor Tether**: 100% of spatial weaving can be performed with a single hand (or gaze). Pinching a node once latches a dynamic electric tether; pinching another node (or empty space) completes the weave without continuous dragging.
   - **Magnetic Gaze & Proximity Snap**: Nodes within 0.11m or camera gaze cone softly snap into a 3D magnetic reticle, allowing users with motor tremors or limited reach to target nodes effortlessly.
   - **Ergonomic Seated Auto-Bring ([PULL CLOSER] / Key C)**: Shifts the entire Loom and Comfort Arc closer (from $z = -0.45\text{m}$ to $z = -0.30\text{m}$) and compacts the workspace down to a $0.35\text{m}$ micro-radius for users with restricted arm mobility or wheelchair lap trays.
   - **Shape-Coded Synesthesia & Note Badges (Colorblind Safe)**: Pitch tiers are encoded as distinct 3D polyhedra (Bass = Cube, Mid = Octahedron, High = Tetrahedron) with floating billboard note labels (`C3`, `E4`, `G4`, `C5`).
   - **Visual Haptic Sub-Bass Waveform Rings (Deaf / Hard-of-Hearing Safe)**: Notes expand crisp sinusoidal ripple waves with thickness proportional to volume and ripple frequency proportional to pitch, letting Deaf players visually feel rhythms and solve the Daily Constellation puzzle!

---

## Core Technical Features

- **Pure Procedural Web Audio API (Zero External Audio Files)**:
  - 100% synthesized in real time with zero network assets or latency.
  - Lydian / Pentatonic harmonic tuning (C3 to E5) guarantees that every combination of strings and pulses sounds resonant and harmonious.
  - Dual-oscillator blend (fundamental `sine` + warm `triangle`), biquad filter lowpass sweep ($3200\text{Hz} \to 450\text{Hz}$), and fast $0.01\text{s}$ attack / $1.2\text{s}$ exponential decay ADSR envelope.
  - **3D HRTF Spatial Panning**: Every voice routes through a Web Audio `PannerNode` (`panningModel = 'HRTF'`) positioned at the exact 3D world coordinates $(x, y, z)$ in Three.js space, with continuous head-tracking listener updates.
  - **Cathedral Stereo Delay / Reverb Feedback Loop**: Master delay bus with $280\text{ms}$ delay, lowpass air-absorption filtering ($2200\text{Hz}$), and a $0.35$ feedback ratio.

- **Native WebXR Hand Tracking & Euclidean Pinch Detector**:
  - Direct integration with `renderer.xr.getHand(0)` and `getHand(1)` as `THREE.XRHandSpace`.
  - Offline-safe `XRHandModelFactory` sphere primitives augmented with glowing low-poly joint indicators.
  - High-precision Euclidean pinch hysteresis:
    - `onPinchStart` at $< 0.025\text{m}$ ($25\text{mm}$).
    - `onPinchMove` while held.
    - `onPinchEnd` at $> 0.035\text{m}$ ($35\text{mm}$).
  - Open Palm / Stop gesture ($> 0.09\text{m}$ from wrist for all 5 fingertips) toggles **Palm-Muting**, freezing nodes into icy blue and absorbing incoming pulses.

- **Kinetic Clockwork Pulses**:
  - Glowing Chrono-Pulse beads travel along strings at a steady tempo.
  - When reaching a node, a pulse triggers that node's spatial note, flashes its scale by $1.4\times$, and cascades along connected branches to create self-playing polyrhythmic 3D sculptures.

- **Full Desktop 3D Simulator Fallback**:
  - Raycasts mouse to the $z = -0.45\text{m}$ comfort plane.
  - Left-Click Hold = Left Hand Pinch, Right-Click / Spacebar Hold = Right Hand Pinch, <kbd>O</kbd> Key = Open Palm Gesture, <kbd>H</kbd> Key = Toggle Demo Telemetry Bar.

---

## Quickstart & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Dev Server
```bash
npm run dev
```
- Open [http://localhost:5173](http://localhost:5173) on Desktop.
- Open `http://<YOUR-LOCAL-IP>:5173` on Meta Quest Browser and click **ENTER VR**.


<!-- [Chrono-Loom Milestone 6/9] docs(constellation): document Daily Constellation retention loop in README.md -->
