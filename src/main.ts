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

// [Chrono-Loom Milestone 1/6] feat(core): setup main application lifecycle and animation loop in main.ts
