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

// [Chrono-Loom Milestone 3/6] feat(ui): add keyboard toggle [H] to hide/show telemetry overlay
