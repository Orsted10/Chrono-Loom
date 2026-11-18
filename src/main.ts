import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { LoomEngine } from './LoomEngine.js';
import { AgentAria } from './AgentAria.js';
import { ConstellationMode } from './ConstellationMode.js';
import { AccessibilityManager } from './AccessibilityManager.js';
import { DemoDirector } from './DemoDirector.js';
import { MRSurfaceManager } from './MRSurfaceManager.js';
import { MultiplayerSync } from './MultiplayerSync.js';
import { EuclideanEngine } from './EuclideanEngine.js';

// Interactive Chrono-Loom Temporal Thread representation (Phase 1 visual trails)
interface TemporalThread {
  points: THREE.Vector3[];
  line: THREE.Line;
  handedness: Handedness;
  birthTime: number;
  maxLife: number;
}

class ChronoLoomApp {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  public loomEngine: LoomEngine;
  public agentAria: AgentAria;
  public constellationMode: ConstellationMode;
  public accessibilityManager: AccessibilityManager;
  public demoDirector: DemoDirector;
  public mrSurfaceManager: MRSurfaceManager;
  public multiplayerSync: MultiplayerSync;
  public euclideanEngine: EuclideanEngine;
  private clock: THREE.Clock;

  // Active Chrono-Threads woven by pinching
  private activeThreads: Map<Handedness, TemporalThread> = new Map();
  private completedThreads: TemporalThread[] = [];
  private threadsGroup: THREE.Group;

  // Bioluminescent Pinch Spark Particles
  private pinchSparks: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkVelocities: Float32Array;
  private sparkLives: Float32Array;
  private readonly MAX_SPARKS = 120;

  // HTML HUD telemetry elements
  private hudLeftDistEl!: HTMLElement;
  private hudLeftStatusEl!: HTMLElement;
  private hudRightDistEl!: HTMLElement;
  private hudRightStatusEl!: HTMLElement;
  private hudModeEl!: HTMLElement;
  private hudPalmBadgeEl!: HTMLElement;
  private hudLoomStateEl!: HTMLElement;
  private hudNodesCountEl!: HTMLElement;
  private hudStringsCountEl!: HTMLElement;
  private hudPulsesCountEl!: HTMLElement;
  private hudAriaBadgeEl!: HTMLElement;
  private hudConstellationEl!: HTMLElement;
  private hudA11yBadgeEl!: HTMLElement;

  // On-screen Demo Recording Telemetry Elements
  private demoPanelEl!: HTMLElement;
  private demoToggleBtn!: HTMLElement;
  private demoHandTrackingEl!: HTMLElement;
  private demoSeatedRadiusEl!: HTMLElement;
  private demoAriaStateEl!: HTMLElement;
  private demoA11yStatusEl!: HTMLElement;
  private demoMultiplayerEl!: HTMLElement | null;
  private demoScaleStatusEl!: HTMLElement | null;
  private demoAriaIntentEl!: HTMLElement | null;
  private demoGpuShadersEl!: HTMLElement | null;
  private demoPolyrhythmEl!: HTMLElement;
  private isDemoTelemetryVisible = true;

  constructor() {
    this.clock = new THREE.Clock();

    // 1. Initialize Scene and Seated VR Environment
    this.sceneManager = new SceneManager();

    // 2. Initialize Hand Input Manager
    this.handInputManager = new HandInputManager(this.sceneManager);

    // 3. Initialize Spatial Loom Engine (Nodes, Strings, Pulses, SpatialSynth)
    this.loomEngine = new LoomEngine(this.sceneManager, this.handInputManager);

    // 4. Initialize Phase 4: Agent Aria (AI Spatial Co-Composer)
    this.agentAria = new AgentAria(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.loomEngine.spatialSynth
    );

    // 5. Initialize Phase 4: Daily Constellation Challenge & Wrist HUD
    this.constellationMode = new ConstellationMode(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.loomEngine.spatialSynth,
      this.agentAria
    );

    // 6. Initialize Phase 7: Accessibility Manager (One-Handed Tether + Gaze Snap + Haptic Waves)
    this.accessibilityManager = new AccessibilityManager(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.loomEngine.spatialSynth
    );
    this.loomEngine.setAccessibilityManager(this.accessibilityManager);
    this.constellationMode.setAccessibilityManager(this.accessibilityManager);

    // 6.6. Initialize Phase 8: Demo Director (Cinematic Auto-Showcase)
    this.demoDirector = new DemoDirector(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.constellationMode,
      this.agentAria
    );

    // 6.7. Initialize Phase 9: MR Surface Manager (WebXR Plane Detection & Wall-Bounce Acoustics)
    this.mrSurfaceManager = new MRSurfaceManager(this.sceneManager);
    this.loomEngine.setMRSurfaceManager(this.mrSurfaceManager);

    // 6.8. Initialize Phase 11: Zero-Backend P2P Multiplayer Jam Rooms (WebRTC + BroadcastChannel)
    this.multiplayerSync = new MultiplayerSync(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.constellationMode
    );
    this.multiplayerSync.setHUDElements(
      document.getElementById('jam-room-btn'),
      document.getElementById('jam-room-badge')
    );

    // 6.9. Initialize Phase 12: Euclidean Polyrhythm Engine & Scale Modes
    this.euclideanEngine = new EuclideanEngine(
      this.sceneManager,
      this.handInputManager,
      this.loomEngine,
      this.loomEngine.spatialSynth
    );
    this.euclideanEngine.setHUDElements(
      document.getElementById('scale-mode-badge'),
      document.getElementById('scale-cycle-btn')
    );
    this.constellationMode.onScaleCycle = () => {
      this.euclideanEngine.cycleNextScale();
    };

    // 6.10. Initialize Phase 13: Agent Aria v2 Call-and-Response & Voice Director
    this.agentAria.setEuclideanEngine(this.euclideanEngine);
    this.loomEngine.addStringPluckedListener((stringId, pos, vel, freq) => {
      this.agentAria.recordUserPluck(stringId, pos, vel, freq);
    });

    // Check if URL contains shareable Loom hash
    if (window.location.hash.startsWith('#loom=')) {
      this.loomEngine.loadFromUrlHash(window.location.hash);
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#loom=')) {
        this.loomEngine.loadFromUrlHash(window.location.hash);
      }
    });

    // 7. Setup Temporal Thread Weave container (Phase 1 trails)
    this.threadsGroup = new THREE.Group();
    this.threadsGroup.name = 'ChronoThreads';
    this.sceneManager.scene.add(this.threadsGroup);

    // 7. Setup Pinch Sparks Particle System
    const { mesh, positions, velocities, lives } = this.createPinchSparksSystem();
    this.pinchSparks = mesh;
    this.sparkPositions = positions;
    this.sparkVelocities = velocities;
    this.sparkLives = lives;
    this.sceneManager.scene.add(this.pinchSparks);

    // 8. Connect Pinch & Gesture Listeners for Phase 1 Threads
    this.setupGestureInteractions();

    // 9. Connect HTML HUD telemetry readouts
    this.setupHUD();

    // 10. Start WebXR animation loop
    this.sceneManager.renderer.setAnimationLoop(this.animate.bind(this));

    console.log('[ChronoLoomApp] Phase 4 (Agent Aria & Constellation Mode) Initialized.');
  }

  /**
   * Builds the particle system for temporal pinch sparks
   */
  private createPinchSparksSystem(): {
    mesh: THREE.Points;
    positions: Float32Array;
    velocities: Float32Array;
    lives: Float32Array;
  } {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.MAX_SPARKS * 3);
    const velocities = new Float32Array(this.MAX_SPARKS * 3);
    const lives = new Float32Array(this.MAX_SPARKS);

    // Initially hide all offscreen
    for (let i = 0; i < this.MAX_SPARKS; i++) {
      positions[i * 3 + 1] = -999;
      lives[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#00ff88');
    grad.addColorStop(0.7, '#00f0ff');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.PointsMaterial({
      size: 0.022,
      map: texture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Points(geometry, material);
    return { mesh, positions, velocities, lives };
  }

  /**
   * Spawns radiant sparks at the pinch midpoint
   */
  private spawnSparksAt(pos: THREE.Vector3, count: number = 6): void {
    let spawned = 0;
    for (let i = 0; i < this.MAX_SPARKS && spawned < count; i++) {
      if (this.sparkLives[i] <= 0) {
        const i3 = i * 3;
        this.sparkPositions[i3] = pos.x + (Math.random() - 0.5) * 0.005;
        this.sparkPositions[i3 + 1] = pos.y + (Math.random() - 0.5) * 0.005;
        this.sparkPositions[i3 + 2] = pos.z + (Math.random() - 0.5) * 0.005;

        const speed = 0.03 + Math.random() * 0.06;
        const theta = Math.random() * Math.PI * 2;
        const phi = (Math.random() - 0.5) * Math.PI;

        this.sparkVelocities[i3] = Math.cos(theta) * Math.cos(phi) * speed;
        this.sparkVelocities[i3 + 1] = Math.sin(phi) * speed + 0.02;
        this.sparkVelocities[i3 + 2] = Math.sin(theta) * Math.cos(phi) * speed;

        this.sparkLives[i] = 0.5 + Math.random() * 0.4;
        spawned++;
      }
    }
  }

  /**
   * Wires up pinch and open-palm callbacks
   */
  private setupGestureInteractions(): void {
    // 1. Pinch Start
    this.handInputManager.onPinchStart((hand, midpoint, distance) => {
      this.spawnSparksAt(midpoint, 8);

      const points = [midpoint.clone(), midpoint.clone()];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

      const color = hand === 'left' ? 0xa855f7 : 0x00f0ff;
      const lineMat = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      const line = new THREE.Line(lineGeo, lineMat);
      this.threadsGroup.add(line);

      this.activeThreads.set(hand, {
        points,
        line,
        handedness: hand,
        birthTime: this.clock.getElapsedTime(),
        maxLife: 6.0
      });
    });

    // 2. Pinch Move
    this.handInputManager.onPinchMove((hand, midpoint, distance) => {
      const thread = this.activeThreads.get(hand);
      if (thread) {
        const lastPoint = thread.points[thread.points.length - 1];
        if (lastPoint.distanceTo(midpoint) > 0.005) {
          thread.points.push(midpoint.clone());
          thread.line.geometry.dispose();
          thread.line.geometry = new THREE.BufferGeometry().setFromPoints(thread.points);

          if (Math.random() < 0.2) {
            this.spawnSparksAt(midpoint, 1);
          }
        }
      }
    });

    // 3. Pinch End
    this.handInputManager.onPinchEnd((hand, midpoint, distance) => {
      this.spawnSparksAt(midpoint, 6);

      const thread = this.activeThreads.get(hand);
      if (thread) {
        this.completedThreads.push(thread);
        this.activeThreads.delete(hand);

        if (this.completedThreads.length > 6) {
          const old = this.completedThreads.shift()!;
          this.threadsGroup.remove(old.line);
          old.line.geometry.dispose();
          (old.line.material as THREE.Material).dispose();
        }
      }
    });

    // 4. Open Palm / Stop Gesture: Temporal shockwave
    this.handInputManager.onOpenPalmStart((hand) => {
      this.sceneManager.setDeskHighlight(1.0);
    });
  }

  /**
   * Hooks into HTML DOM elements for telemetry display & button clicks
   */
  private setupHUD(): void {
    this.hudLeftDistEl = document.getElementById('left-dist') || document.createElement('span');
    this.hudLeftStatusEl = document.getElementById('left-status') || document.createElement('span');
    this.hudRightDistEl = document.getElementById('right-dist') || document.createElement('span');
    this.hudRightStatusEl =
      document.getElementById('right-status') || document.createElement('span');
    this.hudModeEl = document.getElementById('session-mode') || document.createElement('span');
    this.hudPalmBadgeEl =
      document.getElementById('palm-status-badge') || document.createElement('span');

    this.hudLoomStateEl =
      document.getElementById('loom-state-badge') || document.createElement('span');
    this.hudNodesCountEl =
      document.getElementById('nodes-count') || document.createElement('span');
    this.hudStringsCountEl =
      document.getElementById('strings-count') || document.createElement('span');
    this.hudPulsesCountEl =
      document.getElementById('pulses-count') || document.createElement('span');
    this.hudAriaBadgeEl =
      document.getElementById('aria-mode-badge') || document.createElement('span');
    this.hudConstellationEl =
      document.getElementById('constellation-progress') || document.createElement('span');
    this.hudA11yBadgeEl =
      document.getElementById('a11y-suite-badge') || document.createElement('span');

    // On-screen Demo Recording Telemetry Elements
    this.demoPanelEl = document.getElementById('demo-telemetry-panel') || document.createElement('div');
    this.demoToggleBtn = document.getElementById('toggle-telemetry-btn') || document.createElement('button');
    this.demoHandTrackingEl = document.getElementById('demo-hand-tracking') || document.createElement('span');
    this.demoSeatedRadiusEl = document.getElementById('demo-seated-radius') || document.createElement('span');
    this.demoAriaStateEl = document.getElementById('demo-aria-state') || document.createElement('span');
    this.demoA11yStatusEl = document.getElementById('demo-a11y-status') || document.createElement('span');
    this.demoMultiplayerEl = document.getElementById('demo-multiplayer-status');
    this.demoScaleStatusEl = document.getElementById('demo-scale-status');
    this.demoAriaIntentEl = document.getElementById('demo-aria-intent');
    this.demoGpuShadersEl = document.getElementById('demo-gpu-shaders');
    this.demoPolyrhythmEl = document.getElementById('demo-polyrhythm-bpm') || document.createElement('span');

    // Toggle demo telemetry panel via button or 'H' hotkey
    const toggleDemoPanel = () => {
      this.isDemoTelemetryVisible = !this.isDemoTelemetryVisible;
      this.demoPanelEl.classList.toggle('minimized', !this.isDemoTelemetryVisible);
      this.demoToggleBtn.textContent = this.isDemoTelemetryVisible ? 'HIDE [H]' : 'SHOW [H]';
    };

    this.demoToggleBtn.addEventListener('click', toggleDemoPanel);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'h' || e.key === 'H') {
        toggleDemoPanel();
      }
    });

    // Button to clear threads
    const clearBtn = document.getElementById('clear-threads-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearAllThreads();
      });
    }

    // Button to reset spatial loom
    const resetLoomBtn = document.getElementById('reset-loom-btn');
    if (resetLoomBtn) {
      resetLoomBtn.addEventListener('click', () => {
        this.loomEngine.resetLoom();
        this.agentAria.reset();
        this.constellationMode.initDailyPuzzle322();
        this.clearAllThreads();
      });
    }

    // Button to cycle Aria AI mode from HUD
    const ariaCycleBtn = document.getElementById('aria-cycle-btn');
    if (ariaCycleBtn) {
      ariaCycleBtn.addEventListener('click', () => {
        this.agentAria.cycleAIMode();
      });
    }

    // Button to toggle constellation mode from HUD
    const puzzleToggleBtn = document.getElementById('puzzle-toggle-btn');
    if (puzzleToggleBtn) {
      puzzleToggleBtn.addEventListener('click', () => {
        if (this.constellationMode.currentMode === 'DAILY_CONSTELLATION') {
          this.constellationMode.currentMode = 'FREEFORM';
          this.constellationMode.initDailyPuzzle322();
          puzzleToggleBtn.textContent = 'Mode: Freeform';
        } else {
          this.constellationMode.currentMode = 'DAILY_CONSTELLATION';
          this.constellationMode.initDailyPuzzle322();
          puzzleToggleBtn.textContent = 'Mode: Constellation #322';
        }
      });
    }

    // Button to toggle open palm simulation
    const palmSimBtn = document.getElementById('sim-openpalm-btn');
    if (palmSimBtn) {
      palmSimBtn.addEventListener('click', () => {
        const active = this.handInputManager.toggleSimulatorOpenPalm();
        palmSimBtn.classList.toggle('active', active);
      });
    }

    // Button to toggle Accessibility Suite
    const a11yBtn = document.getElementById('a11y-toggle-btn');
    const updateA11yBtnText = () => {
      if (a11yBtn) {
        const on = this.accessibilityManager.isAccessibilitySuiteEnabled;
        a11yBtn.textContent = on ? 'A11y Suite: ON' : 'A11y Suite: OFF';
        a11yBtn.classList.toggle('active', on);
      }
    };
    if (a11yBtn) {
      a11yBtn.addEventListener('click', () => {
        this.accessibilityManager.toggleAccessibilitySuite();
        updateA11yBtnText();
      });
      updateA11yBtnText();
    }

    // Button to toggle Compact Seated Workspace (Pull Closer)
    const compactBtn = document.getElementById('compact-toggle-btn');
    const updateCompactBtnText = () => {
      if (compactBtn) {
        const on = this.accessibilityManager.isWorkspaceCompact;
        compactBtn.textContent = on ? 'Restore Dist [C]' : 'Pull Closer [C]';
        compactBtn.classList.toggle('active', on);
      }
    };
    if (compactBtn) {
      compactBtn.addEventListener('click', () => {
        this.accessibilityManager.toggleWorkspaceCompact();
        updateCompactBtnText();
      });
      updateCompactBtnText();
    }

    // Phase 16: Dwell-Select & Single-Switch Mode Button
    const dwellBtn = document.getElementById('dwell-mode-btn');
    const updateDwellBtnText = () => {
      if (dwellBtn) {
        const on = this.accessibilityManager.isDwellModeActive;
        dwellBtn.textContent = on ? 'Dwell Mode: ON [S]' : 'Dwell Mode: OFF [S]';
        dwellBtn.classList.toggle('active', on);
      }
    };
    if (dwellBtn) {
      dwellBtn.addEventListener('click', () => {
        this.accessibilityManager.toggleDwellMode();
        updateDwellBtnText();
      });
      updateDwellBtnText();
    }

    // Phase 16: High-Contrast Rim-Lighting & Dyslexia Typography Button
    const contrastFontBtn = document.getElementById('contrast-font-btn');
    const updateContrastBtnText = () => {
      if (contrastFontBtn) {
        const on = this.accessibilityManager.isHighContrastEnabled || this.accessibilityManager.isDyslexiaTypographyEnabled;
        contrastFontBtn.textContent = on ? 'Contrast & Font: ON [L]' : 'Contrast & Font: OFF [L]';
        contrastFontBtn.classList.toggle('active', on);
      }
    };
    if (contrastFontBtn) {
      contrastFontBtn.addEventListener('click', () => {
        this.accessibilityManager.toggleHighContrast();
        this.accessibilityManager.toggleDyslexiaTypography();
        updateContrastBtnText();
      });
      updateContrastBtnText();
    }

    // Button for Auto-Director Cinematic Showcase
    const demoBtn = document.getElementById('demo-showcase-btn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        this.demoDirector.toggleDemo();
      });
    }

    // Button to Share Loom Link via URL hash
    const shareBtn = document.getElementById('share-loom-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.loomEngine.copyShareLinkToClipboard(this.agentAria.mode);
      });
    }

    // Button to toggle MR Room Scan (Plane Detection & Wall-Bounce Acoustics)
    const scanBtn = document.getElementById('room-scan-toggle-btn');
    const updateScanBtnText = () => {
      if (scanBtn) {
        const on = this.mrSurfaceManager.isRoomScanEnabled;
        scanBtn.textContent = on ? 'MR Room Scan: ON [R]' : 'MR Room Scan: OFF [R]';
        scanBtn.classList.toggle('active', on);
      }
    };
    if (scanBtn) {
      scanBtn.addEventListener('click', () => {
        this.mrSurfaceManager.toggleRoomScan();
        updateScanBtnText();
      });
      updateScanBtnText();
    }

    // Button to toggle 3D Gesture Holo-Card Cheat-Sheet
    const gestureGuideBtn = document.getElementById('gesture-guide-btn');
    if (gestureGuideBtn) {
      gestureGuideBtn.addEventListener('click', () => {
        this.handInputManager.toggleGestureHoloCard();
        gestureGuideBtn.classList.toggle('active', this.handInputManager.isHoloCardVisible);
      });
    }

    // Button to toggle Simulator Conductor Frame (Time-Dilation)
    const conductorBtn = document.getElementById('conductor-mode-btn');
    if (conductorBtn) {
      conductorBtn.addEventListener('click', () => {
        this.handInputManager.toggleSimulatorConductor();
        conductorBtn.classList.toggle('active', this.handInputManager.simConductorActive);
      });
    }

    // Phase 13: Push-to-Talk Speech Recognition & Natural Intent Director
    const talkAriaBtn = document.getElementById('talk-aria-btn');
    const ariaVoiceBadge = document.getElementById('aria-voice-badge');
    const ariaChipsToggleBtn = document.getElementById('aria-chips-toggle-btn');
    const ariaChipsDrawer = document.getElementById('aria-intent-chips-drawer');

    if (talkAriaBtn) {
      talkAriaBtn.addEventListener('click', () => {
        this.agentAria.toggleSpeechListening();
      });
    }

    this.agentAria.onListeningStateChanged = (isListening) => {
      if (talkAriaBtn) {
        talkAriaBtn.classList.toggle('active', isListening);
        talkAriaBtn.textContent = isListening ? '🔴 Listening... [V]' : '🎤 Talk to Aria [V]';
      }
      if (ariaVoiceBadge) {
        ariaVoiceBadge.style.display = isListening ? 'inline-flex' : 'none';
      }
    };

    if (ariaChipsToggleBtn && ariaChipsDrawer) {
      ariaChipsToggleBtn.addEventListener('click', () => {
        const isHidden = ariaChipsDrawer.style.display === 'none';
        ariaChipsDrawer.style.display = isHidden ? 'flex' : 'none';
        ariaChipsToggleBtn.textContent = isHidden ? 'Voice Intents ▾' : 'Voice Intents ▴';
      });
    }

    document.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const intent = btn.getAttribute('data-intent');
        if (intent) {
          this.agentAria.executeNaturalIntent(intent);
        }
      });
    });

    // Keyboard shortcuts: C for Compact Workspace, A for Accessibility Suite, D for Auto-Demo, R for Room Scan, G for Gesture Guide, T for Conductor, V for Voice Director, J for Jam Room
    window.addEventListener('keydown', (e) => {
      if (e.key === 'c' || e.key === 'C') {
        this.accessibilityManager.toggleWorkspaceCompact();
        updateCompactBtnText();
      } else if (e.key === 'a' || e.key === 'A') {
        this.accessibilityManager.toggleAccessibilitySuite();
        updateA11yBtnText();
      } else if (e.key === 'd' || e.key === 'D') {
        this.demoDirector.toggleDemo();
      } else if (e.key === 'r' || e.key === 'R') {
        this.mrSurfaceManager.toggleRoomScan();
        updateScanBtnText();
      } else if (e.key === 'g' || e.key === 'G') {
        this.handInputManager.toggleGestureHoloCard();
        if (gestureGuideBtn) gestureGuideBtn.classList.toggle('active', this.handInputManager.isHoloCardVisible);
      } else if (e.key === 't' || e.key === 'T') {
        this.handInputManager.toggleSimulatorConductor();
        if (conductorBtn) conductorBtn.classList.toggle('active', this.handInputManager.simConductorActive);
      } else if (e.key === 'v' || e.key === 'V') {
        this.agentAria.toggleSpeechListening();
      } else if (e.key === 'j' || e.key === 'J') {
        this.multiplayerSync.toggleModal();
      } else if (e.key === 's' || e.key === 'S') {
        if (this.accessibilityManager.focusedNode) {
          this.accessibilityManager.triggerSwitchSelect();
        } else {
          this.accessibilityManager.toggleDwellMode();
          updateDwellBtnText();
        }
      } else if (e.key === 'l' || e.key === 'L') {
        this.accessibilityManager.toggleHighContrast();
        this.accessibilityManager.toggleDyslexiaTypography();
        updateContrastBtnText();
      }
    });
  }

  /**
   * Cleans up all drawn temporal threads
   */
  private clearAllThreads(): void {
    for (const thread of this.completedThreads) {
      this.threadsGroup.remove(thread.line);
      thread.line.geometry.dispose();
      (thread.line.material as THREE.Material).dispose();
    }
    this.completedThreads = [];

    this.activeThreads.forEach((thread) => {
      this.threadsGroup.remove(thread.line);
      thread.line.geometry.dispose();
      (thread.line.material as THREE.Material).dispose();
    });
    this.activeThreads.clear();
  }

  /**
   * Per-frame updates for thread shimmers and spark particles
   */
  private updateTemporalEffects(deltaTime: number, currentTime: number): void {
    for (const thread of this.completedThreads) {
      const mat = thread.line.material as THREE.LineBasicMaterial;
      const age = currentTime - thread.birthTime;
      mat.opacity = Math.max(0.15, 0.85 - (age / thread.maxLife) * 0.7);
    }

    let anyAlive = false;
    for (let i = 0; i < this.MAX_SPARKS; i++) {
      if (this.sparkLives[i] > 0) {
        anyAlive = true;
        const i3 = i * 3;
        this.sparkPositions[i3] += this.sparkVelocities[i3] * deltaTime;
        this.sparkPositions[i3 + 1] += this.sparkVelocities[i3 + 1] * deltaTime;
        this.sparkPositions[i3 + 2] += this.sparkVelocities[i3 + 2] * deltaTime;

        this.sparkVelocities[i3] *= 0.95;
        this.sparkVelocities[i3 + 1] -= 0.015 * deltaTime;
        this.sparkVelocities[i3 + 2] *= 0.95;

        this.sparkLives[i] -= deltaTime;
        if (this.sparkLives[i] <= 0) {
          this.sparkPositions[i3 + 1] = -999;
        }
      }
    }

    if (anyAlive) {
      const attr = this.pinchSparks.geometry.attributes.position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  }

  /**
   * Refreshes HTML HUD telemetry readouts
   */
  private updateHUD(): void {
    const left = this.handInputManager.getTelemetry('left');
    const right = this.handInputManager.getTelemetry('right');
    const isXR = this.sceneManager.renderer.xr.isPresenting;
    const loomStatus = this.loomEngine.getStatusSummary();
    const puzzleStatus = this.constellationMode.getStatusSummary();

    // Mode
    if (this.hudModeEl) {
      if (isXR) {
        if (this.sceneManager.isPassthroughActive) {
          this.hudModeEl.textContent = 'WebXR Passthrough MR Active (Quest 3)';
          this.hudModeEl.className = 'badge badge-emerald';
        } else {
          this.hudModeEl.textContent = 'WebXR Immersive VR Active';
          this.hudModeEl.className = 'badge badge-green';
        }
      } else {
        this.hudModeEl.textContent = 'Desktop 3D Simulator Active';
        this.hudModeEl.className = 'badge badge-cyan';
      }
    }

    // Left Hand
    if (this.hudLeftDistEl) {
      const dMm = Math.round(left.pinchDistance * 1000);
      this.hudLeftDistEl.textContent = `${dMm} mm`;
    }
    if (this.hudLeftStatusEl) {
      if (left.isPinching) {
        this.hudLeftStatusEl.textContent = 'PINCHING';
        this.hudLeftStatusEl.className = 'status-tag status-pinched';
      } else if (left.pinchDistance < 0.035) {
        this.hudLeftStatusEl.textContent = 'PROXIMITY';
        this.hudLeftStatusEl.className = 'status-tag status-near';
      } else {
        this.hudLeftStatusEl.textContent = 'RESTING';
        this.hudLeftStatusEl.className = 'status-tag status-rest';
      }
    }

    // Right Hand
    if (this.hudRightDistEl) {
      const dMm = Math.round(right.pinchDistance * 1000);
      this.hudRightDistEl.textContent = `${dMm} mm`;
    }
    if (this.hudRightStatusEl) {
      if (right.isPinching) {
        this.hudRightStatusEl.textContent = 'PINCHING';
        this.hudRightStatusEl.className = 'status-tag status-pinched';
      } else if (right.pinchDistance < 0.035) {
        this.hudRightStatusEl.textContent = 'PROXIMITY';
        this.hudRightStatusEl.className = 'status-tag status-near';
      } else {
        this.hudRightStatusEl.textContent = 'RESTING';
        this.hudRightStatusEl.className = 'status-tag status-rest';
      }
    }

    // Open Palm status
    if (this.hudPalmBadgeEl) {
      const isPalm = left.isOpenPalm || right.isOpenPalm;
      this.hudPalmBadgeEl.textContent = isPalm ? 'OPEN PALM (ACTIVE)' : 'CLOSED / RELAXED';
      this.hudPalmBadgeEl.className = isPalm ? 'badge badge-emerald' : 'badge badge-muted';
    }

    // Spatial Loom Phase 2 & 3 Telemetry
    if (this.hudLoomStateEl) {
      this.hudLoomStateEl.textContent = loomStatus.isAwakened
        ? 'LOOM AWAKENED'
        : 'SEED ORB PULSING';
      this.hudLoomStateEl.className = loomStatus.isAwakened
        ? 'badge badge-emerald'
        : 'badge badge-gold';
    }
    if (this.hudNodesCountEl) {
      this.hudNodesCountEl.textContent = `${loomStatus.nodeCount}`;
    }
    if (this.hudStringsCountEl) {
      this.hudStringsCountEl.textContent = `${loomStatus.stringCount}`;
    }
    if (this.hudPulsesCountEl) {
      this.hudPulsesCountEl.textContent = `${loomStatus.pulseCount}`;
    }

    // Phase 4: Agent Aria & Daily Constellation HUD Readouts
    if (this.hudAriaBadgeEl) {
      this.hudAriaBadgeEl.textContent = `ARIA: ${this.agentAria.mode.replace('_', ' ')} (${this.agentAria.state})`;
      this.hudAriaBadgeEl.className =
        this.agentAria.mode === 'CO-CREATE'
          ? 'badge badge-purple'
          : this.agentAria.mode === 'RHYTHM_BOOST'
          ? 'badge badge-gold'
          : 'badge badge-cyan';
    }

    if (this.hudConstellationEl) {
      if (puzzleStatus.isHarmonized) {
        this.hudConstellationEl.textContent = 'CONSTELLATION HARMONIZED!';
        this.hudConstellationEl.className = 'badge badge-emerald';
      } else if (puzzleStatus.currentMode === 'DAILY_CONSTELLATION') {
        this.hudConstellationEl.textContent = `PUZZLE #322: ${puzzleStatus.ringsEnergized} / ${puzzleStatus.totalRings} RINGS`;
        this.hudConstellationEl.className = 'badge badge-gold';
      } else {
        this.hudConstellationEl.textContent = 'FREEFORM LOOM';
        this.hudConstellationEl.className = 'badge badge-muted';
      }
    }

    // Phase 7: Accessibility Manager Status Readout
    const a11ySummary = this.accessibilityManager.getStatusSummary();
    if (this.hudA11yBadgeEl) {
      this.hudA11yBadgeEl.textContent = a11ySummary.suiteEnabled
        ? (a11ySummary.isCompact ? 'A11Y: COMPACT (<0.35m)' : 'A11Y SUITE: ACTIVE')
        : 'A11Y: OFF';
      this.hudA11yBadgeEl.className = a11ySummary.suiteEnabled ? 'badge badge-emerald' : 'badge badge-muted';
    }

    // Update Demo Showcase button state
    const demoBtn = document.getElementById('demo-showcase-btn');
    if (demoBtn) {
      if (this.demoDirector.isPlaying) {
        demoBtn.textContent = `🎬 Stop Demo (${Math.round(this.demoDirector.elapsedTime)}s)`;
        demoBtn.classList.add('active');
      } else {
        demoBtn.textContent = '🎬 Auto-Demo [D]';
        demoBtn.classList.remove('active');
      }
    }

    // Live On-Screen Telemetry Bar for Demo Recording
    if (this.isDemoTelemetryVisible) {
      if (this.demoHandTrackingEl) {
        if (this.demoDirector.isPlaying) {
          const actShort = this.demoDirector.currentAct.split(':')[0] || 'SHOWCASE';
          this.demoHandTrackingEl.textContent = `🎬 ${actShort} (${this.demoDirector.elapsedTime.toFixed(1)}s / 45s)`;
        } else {
          if (this.handInputManager.areControllersActive) {
            this.demoHandTrackingEl.textContent = 'TOUCH CONTROLLERS (DUAL-INPUT + HAPTICS ON)';
            this.demoHandTrackingEl.style.color = '#38bdf8';
          } else {
            const leftState = left.isPinching ? 'PINCH' : left.isTracked ? 'TRACKED' : 'STANDBY';
            const rightState = right.isPinching ? 'PINCH' : right.isTracked ? 'TRACKED' : 'STANDBY';
            const confidence = (left.isTracked || right.isTracked) ? '99.4%' : 'OFFLINE';
            this.demoHandTrackingEl.textContent = `ACTIVE (L: ${leftState} | R: ${rightState} | Conf: ${confidence})`;
          }
        }
      }

      if (this.demoSeatedRadiusEl) {
        // Compute max distance of active hand or nodes from user seated position (0, 1.2, 0)
        let maxReach = this.accessibilityManager.isWorkspaceCompact ? 0.32 : 0.45;
        if (right.isTracked) {
          const reach = right.indexTipPosition.distanceTo(new THREE.Vector3(0, 1.2, 0));
          maxReach = Math.max(maxReach, reach);
        }
        const reachLimit = this.accessibilityManager.isWorkspaceCompact
          ? '< 0.35m (Compact Micro-Radius [C])'
          : '< 0.55m (Airplane Seat Compliant)';
        this.demoSeatedRadiusEl.textContent = `${maxReach.toFixed(2)}m ${reachLimit}`;
      }

      if (this.demoAriaStateEl) {
        const a11yStatus = this.accessibilityManager.isAccessibilitySuiteEnabled ? 'A11y: ON' : 'A11y: OFF';
        this.demoAriaStateEl.textContent = `[${this.agentAria.state} / ${this.agentAria.mode.replace('_', ' ')} | ${a11yStatus}]`;
      }

      if (this.demoAriaIntentEl) {
        if (this.agentAria.isListening) {
          this.demoAriaIntentEl.textContent = 'LISTENING... (Speak now)';
          this.demoAriaIntentEl.style.color = '#34d399';
        } else if (this.agentAria.lastVoiceIntent) {
          this.demoAriaIntentEl.textContent = `${this.agentAria.lastVoiceIntent} ("${this.agentAria.lastVoiceTranscript.slice(0, 18)}")`;
          this.demoAriaIntentEl.style.color = '#c084fc';
        } else {
          this.demoAriaIntentEl.textContent = 'IDLE (Voice Key [V])';
          this.demoAriaIntentEl.style.color = '#94a3b8';
        }
      }

      if (this.demoA11yStatusEl) {
        if (!a11ySummary.suiteEnabled) {
          this.demoA11yStatusEl.textContent = 'OFF';
          this.demoA11yStatusEl.style.color = '#94a3b8';
        } else if (a11ySummary.isDwellMode && a11ySummary.dwellProgress > 0) {
          this.demoA11yStatusEl.textContent = `DWELL-SELECTING: ${(a11ySummary.dwellProgress * 100).toFixed(0)}% (0.85s Hold)`;
          this.demoA11yStatusEl.style.color = '#ffd700';
        } else if (a11ySummary.hasLatchedTether) {
          this.demoA11yStatusEl.textContent = 'TETHER LATCHED [PINCH/DWELL TO WEAVE]';
          this.demoA11yStatusEl.style.color = '#fbbf24';
        } else if (a11ySummary.focusedNodeId) {
          const dwellStr = a11ySummary.isDwellMode ? ' [DWELL HOLD READY]' : '';
          this.demoA11yStatusEl.textContent = `MAGNETIC SNAP: Node [${a11ySummary.focusedNodeId}]${dwellStr}`;
          this.demoA11yStatusEl.style.color = '#00f0ff';
        } else {
          const fontStr = a11ySummary.isDyslexia ? ' + DYSLEXIA FONT' : '';
          const hcStr = a11ySummary.isHighContrast ? ' + AAA CONTRAST' : '';
          this.demoA11yStatusEl.textContent = a11ySummary.isCompact
            ? `ON (Compact 0.35m + Dwell [S]${hcStr}${fontStr})`
            : `ON (1-Hand Tether + Dwell [S]${hcStr}${fontStr})`;
          this.demoA11yStatusEl.style.color = '#34d399';
        }
      }

      if (this.demoMultiplayerEl) {
        if (this.multiplayerSync.isConnected) {
          this.demoMultiplayerEl.textContent = `CONNECTED (${this.multiplayerSync.pingMs}ms | 30Hz P2P)`;
          this.demoMultiplayerEl.style.color = '#34d399';
        } else if (this.multiplayerSync.connectionState === 'WAITING_PEER') {
          this.demoMultiplayerEl.textContent = 'HOSTING (WAITING PEER)';
          this.demoMultiplayerEl.style.color = '#fbbf24';
        } else {
          this.demoMultiplayerEl.textContent = 'SOLO (WebRTC Ready [J])';
          this.demoMultiplayerEl.style.color = '#fb7185';
        }
      }

      if (this.demoScaleStatusEl) {
        this.demoScaleStatusEl.textContent = `${this.euclideanEngine.activeScale.shortName} (Key [${this.euclideanEngine.activeScaleIndex + 1}])`;
        this.demoScaleStatusEl.style.color = `#${this.euclideanEngine.activeScale.palette.accentColor.getHexString()}`;
      }

      if (this.demoGpuShadersEl) {
        const ribbonCount = this.loomEngine.ribbonTrailPool.instancedMesh.count;
        this.demoGpuShadersEl.textContent = `Quantum Strings // ${ribbonCount} Ribbons (1-DC)`;
      }

      if (this.demoPolyrhythmEl) {
        const bpm = this.loomEngine.globalBPM;
        const mrStatus = this.mrSurfaceManager.isRoomScanEnabled
          ? `MR Scan: ${this.mrSurfaceManager.surfaces.size} Surfaces`
          : 'MR Scan: OFF';
        let anchoredCount = 0;
        for (const n of this.loomEngine.nodes.values()) {
          if (n.isSurfaceAnchored) anchoredCount++;
        }
        const anchorStr = anchoredCount > 0 ? ` | Anchored: ${anchoredCount}` : '';
        const conductorStr = this.handInputManager.isConductorActive ? ' [CONDUCTOR ⚡]' : '';
        this.demoPolyrhythmEl.textContent = `${loomStatus.nodeCount} Nodes | ${loomStatus.stringCount} Strings | ${bpm} BPM${conductorStr} | ${mrStatus}${anchorStr}`;
      }
    }
  }

  /**
   * Main animation loop per WebXR / requestAnimationFrame
   */
  private animate(timestamp: number, frame?: XRFrame): void {
    const deltaTime = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update scene and ambient particles
    this.sceneManager.update(deltaTime);

    // 2. Update hands & pinch detection
    this.handInputManager.update(deltaTime);

    // 3. Update 3D HRTF Web Audio listener position and orientation
    this.loomEngine.spatialSynth.updateListener(this.sceneManager.camera);

    // 4. Update Spatial Loom Engine (Seed Orb, Nodes, ChronoStrings, Plucking & Kinetic Pulses)
    this.loomEngine.update(deltaTime);

    // 5. Update Phase 4: Agent Aria (Autonomous AI State Machine & Weaving)
    this.agentAria.update(deltaTime);

    // 6. Update Phase 4: Daily Constellation Challenge & Wrist HUD
    this.constellationMode.update(deltaTime);

    // 6.5. Update Phase 7: Accessibility Manager (One-Handed Tether, Gaze Reticle, Sub-Bass Waves)
    this.accessibilityManager.update(deltaTime);

    // 6.6. Update Phase 8: Demo Director (Cinematic Auto-Showcase)
    this.demoDirector.update(deltaTime);

    // 6.7. Update Phase 9: MR Surface Manager (WebXR Plane Detection & Room Acoustics)
    this.mrSurfaceManager.update(deltaTime, frame);

    // 6.8. Update Phase 11: Multiplayer Sync (Ghost Avatar Lerp & 30Hz Heartbeat)
    this.multiplayerSync.update(deltaTime);

    // 6.9. Update Phase 12: Euclidean Polyrhythms & Scale Pitch Morphs
    this.euclideanEngine.update(deltaTime);

    // 7. Update visual spark particles
    this.updateTemporalEffects(deltaTime, elapsedTime);

    // 8. Update HUD
    this.updateHUD();

    // 9. Render Scene
    this.sceneManager.render();
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new ChronoLoomApp();
});
