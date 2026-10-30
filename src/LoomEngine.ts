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
    this.seedOrbGroup.add(this.seedOrbPrompt);

    this.loomGroup.add(this.seedOrbGroup);
  }

  /**
   * Renders billboard text prompt
   */
  private createFloatingPromptSprite(message: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Translucent glass pill backdrop
    ctx.fillStyle = 'rgba(7, 24, 45, 0.85)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.lineWidth = 6;
    this.roundRect(ctx, 30, 40, 964, 176, 40);
    ctx.fill();
    ctx.stroke();

    // Subtle neon inner glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;

    // Golden / Cyan text
    ctx.font = 'bold 38px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, 512, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.36, 0.09, 1);
    return sprite;
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + w, x, y, r);
    ctx.closePath();
  }

  /**
   * Awakens the Loom: dissolves prompt and spawns first Harmonic Node
   */
  private awakenLoomAt(spawnPos: THREE.Vector3): void {
    if (this.isLoomAwakened) return;
    this.isLoomAwakened = true;

    console.log('[LoomEngine] Loom Awakened! Dissolving seed orb prompt & spawning Harmonic Node #1.');

    // Particle burst at Seed Orb release point
    this.spawnParticleBurst(spawnPos, 35, new THREE.Color(0xffd700), 0.08);

    // Audio-reactive cymatic wave pulse on floor & desk zone
    this.sceneManager.triggerCymaticPulse(spawnPos, new THREE.Color(0xffd700), 1.6);
    this.accessibilityManager?.triggerVisualHapticWave(spawnPos, 523.25, 1.5);

    // Audio chime for awakening routed through 3D Spatial Panner
    this.spatialSynth.playSpatialNote({
      frequency: 523.25, // C5
      position: spawnPos,
      intensity: 1.6,
      duration: 1.8
    });

    // Fade out and remove Seed Orb group
    if (this.seedOrbGroup) {
      this.loomGroup.remove(this.seedOrbGroup);
      this.seedOrbGroup = null;
    }

    // Spawn first Harmonic Node at the release point
    this.spawnHarmonicNode(spawnPos);
  }

  // ----------------------------------------------------
  // 2. Harmonic Nodes
  // ----------------------------------------------------

  /**
   * Spawns a glowing crystalline Harmonic Node
   * Equipped with Shape-Coded Synesthesia & Note Badges for Deaf / Colorblind accessibility
   */
  public spawnHarmonicNode(
    position: THREE.Vector3,
    customFrequency?: number,
    customId?: string
  ): HarmonicNode {
    const id = customId || `node_${this.nextNodeIndex++}`;
    if (customId && customId.startsWith('node_')) {
      const idx = parseInt(customId.replace('node_', ''), 10);
      if (!isNaN(idx) && idx >= this.nextNodeIndex) {
        this.nextNodeIndex = idx + 1;
      }
    }
    const group = new THREE.Group();
    group.name = `HarmonicNode_${id}`;
    group.position.copy(position);

    // Assign harmonic note frequency to node based on sequence
    const scaleIndex = (this.nextNodeIndex - 2) % HARMONIC_SCALE_FREQUENCIES.length;
    const noteFrequency = customFrequency || HARMONIC_SCALE_FREQUENCIES[scaleIndex];

    // Shape-Coded Synesthesia: Geometry matched to pitch tier (Cube = Bass, Octahedron = Mid, Tetrahedron = High)
    let coreGeo: THREE.BufferGeometry;
    let shellGeo: THREE.BufferGeometry;
    let tierInfo: any = { tier: 'MID', noteName: 'C4', shapeName: 'OCTAHEDRON' };

    if (this.accessibilityManager && this.accessibilityManager.isShapeSynesthesiaEnabled) {
      const syn = this.accessibilityManager.createShapeCodedGeometry(noteFrequency);
      coreGeo = syn.coreGeo;
      shellGeo = syn.shellGeo;
      tierInfo = syn.tierInfo;
    } else {
      coreGeo = new THREE.OctahedronGeometry(0.035, 1);
      shellGeo = new THREE.OctahedronGeometry(0.043, 1);
    }

    const baseColor = new THREE.Color(0x00f0ff);
    const muteColor = new THREE.Color(0x38bdf8);

    const coreMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.15,
      metalness: 0.2,
      transmission: 0.65,
      ior: 1.45,
      emissive: 0x0088aa,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Outer emissive wireframe shell
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const wireframeMesh = new THREE.Mesh(shellGeo, shellMat);
    group.add(wireframeMesh);

    // Inner glow point light
    const innerGlow = new THREE.PointLight(0x00f0ff, 1.2, 0.45);
    group.add(innerGlow);

    // Soft additive-blended glow aura halo sprite
    const auraMat = new THREE.SpriteMaterial({
      map: this.getAuraTexture(),
      color: baseColor,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const auraSprite = new THREE.Sprite(auraMat);
    auraSprite.scale.set(0.16, 0.16, 1);
    group.add(auraSprite);

    // 3D Billboard Pitch/Note Label for Deaf & Colorblind players
    let pitchLabelSprite: THREE.Sprite | undefined;
    if (this.accessibilityManager) {
      const sprite: THREE.Sprite = this.accessibilityManager.createPitchLabelSprite(noteFrequency);
      sprite.visible = !!this.accessibilityManager.isAccessibilitySuiteEnabled;
      group.add(sprite);
      pitchLabelSprite = sprite;
    }

    this.loomGroup.add(group);

    // Birth particle spark, floor cymatic pulse & visual haptic sub-bass ring
    this.spawnParticleBurst(position, 18, baseColor, 0.05);
    this.sceneManager.triggerCymaticPulse(position, baseColor, 1.0);
    this.accessibilityManager?.triggerVisualHapticWave(position, noteFrequency, 1.2);
    this.spatialSynth.playSpatialNote({
      frequency: noteFrequency,
      position,
      intensity: 1.0,
      duration: 1.0
    });

    const node: HarmonicNode = {
      id,
      position: group.position,
      meshGroup: group,
      coreMesh,
      wireframeMesh,
      innerGlow,
      isMuted: false,
      isGrabbed: false,
      grabbedByHand: null,
      baseColor,
      muteColor,
      rotationSpeed: new THREE.Vector3(
        0.008 + Math.random() * 0.012,
        0.012 + Math.random() * 0.016,
        0.006 + Math.random() * 0.01
      ),
      currentScale: 1.0,
      noteFrequency,
      auraSprite,
      pitchTier: tierInfo.tier,
      noteName: tierInfo.noteName,
      shapeName: tierInfo.shapeName,
      pitchLabelSprite
    };

    this.nodes.set(id, node);

    // Phase 9: Physical Surface Anchoring check on initial spawn
    if (this.mrSurfaceManager) {
      const anchor = this.mrSurfaceManager.checkSurfaceAnchor(position, 0.06);
      if (anchor) {
        node.position.y = anchor.anchorY;
        group.position.copy(node.position);
        this.attachOrUpdatePedestal(node, anchor.surface);
      }
    }

    console.log(`[LoomEngine] Spawned Harmonic Node [${id}] (freq: ${noteFrequency.toFixed(1)}Hz) at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
    if (!this.isApplyingRemote) {
      this.onNodeCreated?.(node);
    }
    return node;
  }

  /**
   * Attaches or updates a glowing holographic base-pedestal extending down to the physical table/desk
   */
  public attachOrUpdatePedestal(node: HarmonicNode, surface: MRSurface): void {
    if (!this.mrSurfaceManager || !this.mrSurfaceManager.isRoomScanEnabled) return;

    node.isSurfaceAnchored = true;
    node.anchoredPlaneId = surface.id;

    const surfaceY = surface.center.y;
    const height = Math.max(0.015, node.position.y - surfaceY);

    if (!node.pedestalGroup) {
      const pedGroup = new THREE.Group();

// [Chrono-Loom Milestone 20/84] feat(loom): attach soft additive-blended glow aura halo sprites to nodes
