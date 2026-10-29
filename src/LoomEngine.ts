import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { SpatialSynth, HARMONIC_SCALE_FREQUENCIES } from './SpatialSynth.js';
import { MRSurfaceManager, MRSurface } from './MRSurfaceManager.js';
import {
  createQuantumStringGeometry,
  createQuantumStringMaterial
} from './QuantumStringMaterial.js';
import { RibbonTrailPool } from './RibbonTrailPool.js';

// Harmonic Node interface with kinetic scale flashing
export interface HarmonicNode {
  id: string;
  position: THREE.Vector3;
  meshGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  wireframeMesh: THREE.Mesh;
  innerGlow: THREE.PointLight;
  isMuted: boolean;
  isGrabbed: boolean;
  grabbedByHand: Handedness | null;
  baseColor: THREE.Color;
  muteColor: THREE.Color;
  rotationSpeed: THREE.Vector3;
  currentScale: number;
  noteFrequency: number;
  auraSprite: THREE.Sprite;
  pitchTier?: 'BASS' | 'MID' | 'HIGH';
  noteName?: string;
  shapeName?: string;
  pitchLabelSprite?: THREE.Sprite;
  isSurfaceAnchored?: boolean;
  anchoredPlaneId?: string;
  pedestalGroup?: THREE.Group;
  targetFrequency?: number;
  euclideanConfig?: any;
}

// ChronoString interface
export interface ChronoString {
  id: string;
  nodeA: HarmonicNode;
  nodeB: HarmonicNode;
  length: number;
  frequency: number;
  color: THREE.Color;
  meshGroup: THREE.Group;
  tubeMesh: THREE.Mesh;
  glowLine: THREE.Line;
  vibrationAmplitude: number;
  vibrationDecay: number;
  vibrationFrequency: number;
  vibrationPhase: number;
  vibrationNormal: THREE.Vector3;
  lastPluckTime: number;
  quantumMaterial?: THREE.ShaderMaterial;
  solitonProgress?: number;
}

// Autonomous Kinetic Chrono-Pulse bead traveling along strings
export interface ChronoPulse {
  id: string;
  stringId: string;
  sourceNode: HarmonicNode;
  targetNode: HarmonicNode;
  progress: number; // 0.0 to 1.0
  speed: number;
  meshGroup: THREE.Group;
  mesh: THREE.Mesh;
  glowLight: THREE.PointLight;
  color: THREE.Color;
  auraSprite: THREE.Sprite;
}

// Phase 9: Luminous Photon Dart shooting outward from open-ended strings
export interface PhotonDart {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  frequency: number;
  meshGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  tailLine: THREE.Line;
  tailPoints: THREE.Vector3[];
  light: THREE.PointLight;
  bouncesRemaining: number;
  maxBounces: number;
  life: number;
  maxLife: number;
}

// Particle for plucks, collisions, and awakening bursts
interface LoomParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class LoomEngine {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;

  // Root container in Three.js scene
  public loomGroup: THREE.Group;

  // Accessibility Manager reference
  public accessibilityManager: any = null;

  public setAccessibilityManager(a11y: any): void {
    this.accessibilityManager = a11y;
  }

  // Phase 9: MR Surface Manager (Plane Detection & Physical Surface Anchoring)
  public mrSurfaceManager: MRSurfaceManager | null = null;

  public setMRSurfaceManager(manager: MRSurfaceManager): void {
    this.mrSurfaceManager = manager;
  }

  // Phase 9: Luminous Photon Darts & Stray Wall-Bounce Pulses
  public photonDarts: Map<string, PhotonDart> = new Map();
  private nextDartIndex = 1;
  private readonly MAX_ACTIVE_DARTS = 8;

  // Phase 14: Instanced GPU Ribbon Trail Pool (Max 256 instances, 1 draw call)
  public ribbonTrailPool: RibbonTrailPool;
  private prevLeftTipPos: THREE.Vector3 | null = null;
  private prevRightTipPos: THREE.Vector3 | null = null;
  private prevPulsePositions: Map<string, THREE.Vector3> = new Map();

  // 3D Holographic Toast Notification
  private toastSprite: THREE.Sprite | null = null;
  private toastTimer = 0;
  private toastDuration = 3.2;

  // 1. Seed Orb state
  private seedOrbGroup: THREE.Group | null = null;
  private seedOrbMesh!: THREE.Mesh;
  private seedOrbShell!: THREE.Mesh;
  private seedOrbPrompt!: THREE.Sprite;
  private isLoomAwakened = false;
  private isSeedOrbGrabbed = false;
  private seedOrbInitialPos = new THREE.Vector3(0, 1.2, -0.45);
  private seedOrbCurrentPos = new THREE.Vector3(0, 1.2, -0.45);

  // 2. Harmonic Nodes
  public nodes: Map<string, HarmonicNode> = new Map();
  private nextNodeIndex = 1;

  // Pinch-hold timer for spawning nodes in empty space
  private pinchHoldTimers: Map<
    Handedness,
    {
      startTime: number;
      startPosition: THREE.Vector3;
      hasSpawned: boolean;
    }
  > = new Map();

  // 3. ChronoStrings
  public strings: Map<string, ChronoString> = new Map();
  private nextStringIndex = 1;

  // 4. Autonomous Kinetic Pulses (The Clockwork Engine)
  public pulses: Map<string, ChronoPulse> = new Map();
  private nextPulseIndex = 1;
  private clockworkPulseTimer = 0;
  private readonly CLOCKWORK_BEAT_INTERVAL = 2.4; // Periodic pulse beat (seconds)
  private readonly MAX_ACTIVE_PULSES = 12;

  // Phase 10: Global Time-Dilation BPM (Conductor Frame: 40-180 BPM)
  public globalBPM = 90;

  // Phase 11: Multiplayer Synchronization Hooks
  public onNodeCreated?: (node: HarmonicNode) => void;
  public onNodeMoved?: (nodeId: string, position: THREE.Vector3) => void;
  public onStringCreated?: (str: ChronoString) => void;
  public onStringPlucked?: (stringId: string, pos: THREE.Vector3, vel: number) => void;
  public onStringSevered?: (cutPoint: THREE.Vector3, stringId?: string) => void;
  public onBPMChanged?: (bpm: number) => void;
  public isApplyingRemote = false;

  // Phase 13: String Plucked Listeners for Phrase Analysis & Aria Call-and-Response
  public stringPluckedListeners: Array<(stringId: string, pos: THREE.Vector3, vel: number, frequency: number) => void> = [];

  public addStringPluckedListener(listener: (stringId: string, pos: THREE.Vector3, vel: number, frequency: number) => void): void {
    this.stringPluckedListeners.push(listener);
  }

  public setGlobalBPM(bpm: number): void {
    this.globalBPM = THREE.MathUtils.clamp(bpm, 40, 180);
    if (!this.isApplyingRemote) {
      this.onBPMChanged?.(this.globalBPM);
    }
  }

  // 5. Pluck & Collision Particle System
  private particleMesh: THREE.Points;
  private particleGeo: THREE.BufferGeometry;
  private particlePositions: Float32Array;
  private particleColors: Float32Array;
  private activeParticles: LoomParticle[] = [];
  private readonly MAX_PARTICLES = 360;

  // 6. Procedural Spatial Synthesizer (HRTF 3D Panning + Cathedral Delay)
  public spatialSynth: SpatialSynth;

  // Track previous fingertip positions for pluck velocity and collision detection
  private prevFingertipPositions: Map<Handedness, THREE.Vector3> = new Map();

  // Reusable vectors for zero-garbage performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();

  // Reusable procedural soft additive glow texture
  private auraTexture: THREE.CanvasTexture | null = null;

  /**
   * Generates or retrieves cached radial gradient glow texture
   * for high-dynamic additive bloom on mobile WebXR without post-processing hits
   */
  public getAuraTexture(): THREE.CanvasTexture {
    if (!this.auraTexture) {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const center = size / 2;
      const gradient = ctx.createRadialGradient(center, center, 2, center, center, center);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.85)');
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
      gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.08)');
      gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      this.auraTexture = new THREE.CanvasTexture(canvas);
      this.auraTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.auraTexture.wrapT = THREE.ClampToEdgeWrapping;
    }
    return this.auraTexture;
  }

  constructor(sceneManager: SceneManager, handInputManager: HandInputManager) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;

    this.loomGroup = new THREE.Group();
    this.loomGroup.name = 'LoomEngine';
    this.sceneManager.scene.add(this.loomGroup);

    // Initialize Procedural Spatial Synthesizer
    this.spatialSynth = new SpatialSynth();

    // Initialize pluck & collision particle burst system
    const { mesh, geo, positions, colors } = this.initParticleSystem();
    this.particleMesh = mesh;
    this.particleGeo = geo;
    this.particlePositions = positions;
    this.particleColors = colors;
    this.loomGroup.add(this.particleMesh);

    // Initialize Phase 14: Instanced GPU Ribbon Trail Pool (Max 256 instances, 1 draw call)
    this.ribbonTrailPool = new RibbonTrailPool();
    this.loomGroup.add(this.ribbonTrailPool.instancedMesh);

    // Initialize "First Five Minutes" Seed Orb at (0, 1.2, -0.45)
    this.createSeedOrb();

    // Hook Hand Input events
    this.bindHandEvents();
  }

  // ----------------------------------------------------
  // 1. "First Five Minutes" Seed Orb
  // ----------------------------------------------------

  private createSeedOrb(): void {
    this.seedOrbGroup = new THREE.Group();
    this.seedOrbGroup.name = 'SeedOrbGroup';
    this.seedOrbGroup.position.copy(this.seedOrbInitialPos);

    // Core pulsing golden icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(0.038, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.25,
      metalness: 0.85,
      emissive: 0xff9900,
      emissiveIntensity: 0.6
    });
    this.seedOrbMesh = new THREE.Mesh(coreGeo, coreMat);
    this.seedOrbGroup.add(this.seedOrbMesh);

    // Emissive outer wireframe shell
    const shellGeo = new THREE.IcosahedronGeometry(0.052, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0xfff089,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    this.seedOrbShell = new THREE.Mesh(shellGeo, shellMat);
    this.seedOrbGroup.add(this.seedOrbShell);

    // Warm golden point light
    const orbLight = new THREE.PointLight(0xffb700, 1.6, 0.6);
    this.seedOrbGroup.add(orbLight);

    // Floating 3D canvas text prompt above Seed Orb
    this.seedOrbPrompt = this.createFloatingPromptSprite(
      'PINCH & PULL ME WITH YOUR HAND TO WEAVE'
    );
    this.seedOrbPrompt.position.set(0, 0.12, 0);

// [Chrono-Loom Milestone 11/84] feat(loom): implement Loom awakening gesture (pulling Seed Orb > 0.12m)
