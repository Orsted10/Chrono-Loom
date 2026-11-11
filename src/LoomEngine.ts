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
      pedGroup.name = `Pedestal_${node.id}`;

      // 1. Glowing table projection ring flush on physical desk surface
      const ringGeo = new THREE.RingGeometry(0.038, 0.058, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: node.baseColor,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = -height + 0.002;
      ringMesh.name = 'BaseRing';
      pedGroup.add(ringMesh);

      // 2. Three vertical cyber energy conduit struts
      const strutGeo = new THREE.CylinderGeometry(0.002, 0.002, height, 8);
      const strutMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });

      const radius = 0.032;
      for (let i = 0; i < 3; i++) {
        const theta = (i * Math.PI * 2) / 3;
        const strut = new THREE.Mesh(strutGeo, strutMat);
        strut.position.set(Math.cos(theta) * radius, -height / 2, Math.sin(theta) * radius);
        strut.name = `Strut_${i}`;
        pedGroup.add(strut);
      }

      // 3. Subtle glow on table surface
      const floorGlow = new THREE.PointLight(node.baseColor, 1.2, 0.25);
      floorGlow.position.y = -height + 0.02;
      floorGlow.name = 'FloorGlow';
      pedGroup.add(floorGlow);

      node.pedestalGroup = pedGroup;
      node.meshGroup.add(pedGroup);

      // Subtle tactile snap sound
      this.spatialSynth.playSpatialNote({
        frequency: node.noteFrequency * 2,
        position: node.position,
        intensity: 0.6,
        duration: 0.35
      });
      this.spawnParticleBurst(new THREE.Vector3(node.position.x, surfaceY, node.position.z), 10, node.baseColor, 0.03);
    } else {
      // Update heights of existing pedestal elements if node moved slightly
      const ring = node.pedestalGroup.getObjectByName('BaseRing') as THREE.Mesh;
      if (ring) ring.position.y = -height + 0.002;

      const floorGlow = node.pedestalGroup.getObjectByName('FloorGlow') as THREE.PointLight;
      if (floorGlow) floorGlow.position.y = -height + 0.02;

      for (let i = 0; i < 3; i++) {
        const strut = node.pedestalGroup.getObjectByName(`Strut_${i}`) as THREE.Mesh;
        if (strut) {
          strut.position.y = -height / 2;
          strut.scale.y = height / 0.045;
        }
      }
    }
  }

  /**
   * Detaches and disposes the base-pedestal when node is pulled away from surface
   */
  public detachPedestal(node: HarmonicNode): void {
    if (node.pedestalGroup) {
      node.meshGroup.remove(node.pedestalGroup);
      node.pedestalGroup.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material.dispose();
        }
      });
      node.pedestalGroup = undefined;
    }
    node.isSurfaceAnchored = false;
    node.anchoredPlaneId = undefined;
  }

  /**
   * Finds the nearest Harmonic Node to a given 3D position
   */
  public findNearestNode(
    pos: THREE.Vector3,
    maxDistance: number = 0.075
  ): { node: HarmonicNode | null; distance: number } {
    let nearest: HarmonicNode | null = null;
    let minDist = maxDistance;

    for (const node of this.nodes.values()) {
      const d = pos.distanceTo(node.position);
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    }
    return { node: nearest, distance: minDist };
  }

  // ----------------------------------------------------
  // 3. Two-Hand String Weaving & Tension Physics
  // ----------------------------------------------------

  /**
   * Connects two Harmonic Nodes with a physical, resonant ChronoString
   */
  public createChronoString(
    nodeA: HarmonicNode,
    nodeB: HarmonicNode,
    customId?: string
  ): ChronoString | null {
    if (nodeA.id === nodeB.id) return null;

    // Prevent duplicate string between same nodes
    for (const str of this.strings.values()) {
      if (
        (str.nodeA.id === nodeA.id && str.nodeB.id === nodeB.id) ||
        (str.nodeA.id === nodeB.id && str.nodeB.id === nodeA.id)
      ) {
        return str;
      }
    }

    const id = customId || `string_${this.nextStringIndex++}`;
    if (customId && customId.startsWith('string_')) {
      const idx = parseInt(customId.replace('string_', ''), 10);
      if (!isNaN(idx) && idx >= this.nextStringIndex) {
        this.nextStringIndex = idx + 1;
      }
    }
    const group = new THREE.Group();
    group.name = `ChronoString_${id}`;

    // Calculate length L (between 0.1m and 0.6m)
    const length = nodeA.position.distanceTo(nodeB.position);

    // Map length to neon color spectrum (Cyan -> Magenta -> Gold)
    const color = this.mapLengthToNeonColor(length);

    // Map length to Lydian / Pentatonic frequency
    const frequency = this.spatialSynth.mapLengthToScaleFrequency(length);

    // Build Phase 14: Custom GLSL Quantum String cylinder mesh
    const tubeGeo = createQuantumStringGeometry();
    const tubeMat = createQuantumStringMaterial(color, length);
    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);

    const stringDir = new THREE.Vector3().subVectors(nodeB.position, nodeA.position);
    const upVector = new THREE.Vector3(0, 1, 0);
    tubeMesh.position.copy(nodeA.position);
    tubeMesh.quaternion.setFromUnitVectors(upVector, stringDir.clone().normalize());
    tubeMesh.scale.set(1, length, 1);
    group.add(tubeMesh);

    // Core bright neon laser filament (rendered via shader + lightweight anchor line)
    const glowLineGeo = new THREE.BufferGeometry().setFromPoints([
      nodeA.position.clone(),
      nodeB.position.clone()
    ]);
    const glowLineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 1,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const glowLine = new THREE.Line(glowLineGeo, glowLineMat);
    group.add(glowLine);

    this.loomGroup.add(group);

    const midPoint = new THREE.Vector3().addVectors(nodeA.position, nodeB.position).multiplyScalar(0.5);

    // Spatial sound & burst upon weaving
    this.spatialSynth.playSpatialNote({
      frequency,
      position: midPoint,
      intensity: 1.3,
      duration: 1.4
    });

    this.spawnParticleBurst(midPoint, 20, color, 0.06);

    const chronoStr: ChronoString = {
      id,
      nodeA,
      nodeB,
      length,
      frequency,
      color,
      meshGroup: group,
      tubeMesh,
      glowLine,
      vibrationAmplitude: 0.015,
      vibrationDecay: 2.2,
      vibrationFrequency: frequency * 0.12,
      vibrationPhase: 0,
      vibrationNormal: new THREE.Vector3(0, 1, 0),
      lastPluckTime: performance.now(),
      quantumMaterial: tubeMat,
      solitonProgress: 0.0
    };

    this.strings.set(id, chronoStr);

    // Spawn an autonomous Chrono-Pulse on the newly woven string!
    this.spawnChronoPulse(nodeA, nodeB, chronoStr);

    if (!this.isApplyingRemote) {
      this.onStringCreated?.(chronoStr);
    }

    console.log(`[LoomEngine] Created ChronoString [${id}] (L = ${(length * 100).toFixed(1)}cm, freq = ${frequency.toFixed(0)}Hz)`);
    return chronoStr;
  }

  /**
   * Maps string length L (0.1m - 0.6m) to neon spectrum:
   * Cyan (0.1m) -> Magenta (0.35m) -> Gold (0.60m)
   */
  private mapLengthToNeonColor(length: number): THREE.Color {
    const t = THREE.MathUtils.clamp((length - 0.1) / (0.6 - 0.1), 0, 1);
    const color = new THREE.Color();

    if (t < 0.5) {
      const subT = t / 0.5;
      color.copy(new THREE.Color(0x00f0ff)).lerp(new THREE.Color(0xd946ef), subT);
    } else {
      const subT = (t - 0.5) / 0.5;
      color.copy(new THREE.Color(0xd946ef)).lerp(new THREE.Color(0xf59e0b), subT);
    }
    return color;
  }

  /**
   * Creates a CatmullRomCurve3 path with sine-wave displacement for tension physics
   */
  private createSegmentedStringPath(
    pA: THREE.Vector3,
    pB: THREE.Vector3,
    segments: number,
    amplitude: number = 0,
    normal: THREE.Vector3 = this._v1.set(0, 1, 0)
  ): THREE.CatmullRomCurve3 {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const s = i / segments;
      const disp = amplitude * Math.sin(Math.PI * s);
      const pt = new THREE.Vector3()
        .lerpVectors(pA, pB, s)
        .addScaledVector(normal, disp);
      points.push(pt);
    }
    return new THREE.CatmullRomCurve3(points);
  }

  // ----------------------------------------------------
  // 4. Autonomous Kinetic Pulses (The Clockwork Engine)
  // ----------------------------------------------------

  /**
   * Spawns a glowing Chrono-Pulse bead traveling from sourceNode to targetNode
   */
  public spawnChronoPulse(
    sourceNode: HarmonicNode,
    targetNode: HarmonicNode,
    string: ChronoString
  ): ChronoPulse | null {
    if (this.pulses.size >= this.MAX_ACTIVE_PULSES) return null;

    const id = `pulse_${this.nextPulseIndex++}`;
    const group = new THREE.Group();
    group.name = `ChronoPulse_${id}`;
    group.position.copy(sourceNode.position);

    // Glowing bead sphere
    const beadGeo = new THREE.SphereGeometry(0.012, 10, 10);
    const beadMat = new THREE.MeshBasicMaterial({
      color: string.color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(beadGeo, beadMat);
    group.add(mesh);

    // Aura ring
    const auraGeo = new THREE.RingGeometry(0.014, 0.019, 16);
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    group.add(aura);

    // Radial light
    const glowLight = new THREE.PointLight(string.color, 1.4, 0.28);
    group.add(glowLight);

    // Soft additive-blended glow aura halo sprite
    const pulseAuraMat = new THREE.SpriteMaterial({
      map: this.getAuraTexture(),
      color: string.color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const pulseAuraSprite = new THREE.Sprite(pulseAuraMat);
    pulseAuraSprite.scale.set(0.065, 0.065, 1);
    group.add(pulseAuraSprite);

    this.loomGroup.add(group);

    // Speed: takes ~1.5 to 2.2 seconds to traverse string length
    const speed = 0.42;

    const pulse: ChronoPulse = {
      id,
      stringId: string.id,
      sourceNode,
      targetNode,
      progress: 0.0,
      speed,
      meshGroup: group,
      mesh,
      glowLight,
      color: string.color.clone(),
      auraSprite: pulseAuraSprite
    };

    this.pulses.set(id, pulse);
    return pulse;
  }

  /**
   * Advances all kinetic pulses, detects node arrivals, triggers scale flash & cascades
   */
  private updateKineticPulses(deltaTime: number): void {
    const finishedPulseIds: string[] = [];

    for (const [id, pulse] of this.pulses.entries()) {
      const string = this.strings.get(pulse.stringId);
      if (!string) {
        finishedPulseIds.push(id);
        continue;
      }

      // Progress along string scaled by global BPM (Time-Dilation Conductor Frame: 40-180 BPM)
      const length = Math.max(string.length, 0.08);
      const bpmFactor = this.globalBPM / 90;
      pulse.progress += (pulse.speed * bpmFactor * deltaTime) / length;

      // Position interpolation along string with vibration displacement
      const pA = pulse.sourceNode.position;
      const pB = pulse.targetNode.position;
      const s = THREE.MathUtils.clamp(pulse.progress, 0, 1);

      const disp =
        string.vibrationAmplitude *
        Math.cos(string.vibrationPhase) *
        Math.sin(Math.PI * s);

      pulse.meshGroup.position
        .lerpVectors(pA, pB, s)
        .addScaledVector(string.vibrationNormal, disp);

      // Phase 14: Feed pulse position into Instanced GPU Ribbon Trail Pool (tapering width & opacity)
      const pulsePos = pulse.meshGroup.position;
      const prevPos = this.prevPulsePositions.get(id);
      if (prevPos) {
        if (prevPos.distanceTo(pulsePos) > 0.0025) {
          this.ribbonTrailPool.addSegment(prevPos, pulsePos, pulse.color, 0.016);
          prevPos.copy(pulsePos);
        }
      } else {
        this.prevPulsePositions.set(id, pulsePos.clone());
      }

      // Pulse micro-spin & light breathing & aura halo pulse
      pulse.mesh.rotation.x += 0.05;
      pulse.mesh.rotation.y += 0.08;
      pulse.glowLight.intensity = 1.2 + Math.sin(performance.now() * 0.01) * 0.4;
      pulse.auraSprite.scale.setScalar(0.065 + Math.sin(performance.now() * 0.012) * 0.012);

      // Check arrival at target node
      if (pulse.progress >= 1.0) {
        finishedPulseIds.push(id);
        this.handlePulseArrival(pulse, string);
      }
    }

    // Clean up finished pulses
    for (const id of finishedPulseIds) {
      const pulse = this.pulses.get(id);
      if (pulse) {
        this.loomGroup.remove(pulse.meshGroup);
        pulse.mesh.geometry.dispose();
        (pulse.mesh.material as THREE.Material).dispose();
        pulse.auraSprite.geometry.dispose();
        (pulse.auraSprite.material as THREE.Material).dispose();
        this.pulses.delete(id);
        this.prevPulsePositions.delete(id);
      }
    }

    // Clockwork Beat Engine: Periodically inject pulses if strings exist and count is low
    if (this.strings.size > 0) {
      this.clockworkPulseTimer += deltaTime * (this.globalBPM / 90);
      if (
        this.clockworkPulseTimer >= this.CLOCKWORK_BEAT_INTERVAL ||
        this.pulses.size === 0
      ) {
        this.clockworkPulseTimer = 0;
        this.triggerClockworkPulseCycle();
      }
    }
  }

  /**
   * Pulse arrives at target node: triggers spatial audio, flashes scale 1.4x, and cascades!
   */
  private handlePulseArrival(pulse: ChronoPulse, arrivedString: ChronoString): void {
    const target = pulse.targetNode;

    // Check Palm-Mute status: if muted, absorb pulse with icy freeze
    if (target.isMuted) {
      this.spawnParticleBurst(target.position, 12, target.muteColor, 0.03);
      console.log(`[LoomEngine] Chrono-Pulse absorbed by FROZEN Node [${target.id}]`);
      return;
    }

    // 1. Trigger Target Node's Spatial Audio Note via HRTF Synthesizer
    this.spatialSynth.playSpatialNote({
      frequency: target.noteFrequency,
      position: target.position,
      intensity: 1.15,
      duration: 1.2
    });

    // 2. Flash node scale by 1.4x (smoothly decays back to 1.0x in update)
    target.currentScale = 1.4;

    // 3. Collision particle burst & Audio-Reactive Cymatic Sonar Wave
    this.spawnParticleBurst(target.position, 16, pulse.color, 0.055);
    this.sceneManager.triggerCymaticPulse(target.position, pulse.color, 1.25);
    this.accessibilityManager?.triggerVisualHapticWave(target.position, target.noteFrequency, 1.35);

    // 4. Cascade along connected strings (polyrhythmic kinetic sculpture!)
    this.cascadePulseFromNode(target, arrivedString);
  }

  /**
   * Cascades the kinetic pulse along connected strings
   */
  private cascadePulseFromNode(node: HarmonicNode, incomingString: ChronoString): void {
    if (this.pulses.size >= this.MAX_ACTIVE_PULSES) return;

    // Find all strings connected to this node
    const connectedStrings: { string: ChronoString; otherNode: HarmonicNode }[] = [];
    for (const str of this.strings.values()) {
      if (str.nodeA.id === node.id) {
        connectedStrings.push({ string: str, otherNode: str.nodeB });
      } else if (str.nodeB.id === node.id) {
        connectedStrings.push({ string: str, otherNode: str.nodeA });
      }
    }

    if (connectedStrings.length === 0) return;

    // Filter out the incoming string if other branches exist
    let outgoing = connectedStrings.filter((c) => c.string.id !== incomingString.id);

    // If it's a leaf node with only one string, bounce back AND shoot stray pulse outward!
    if (outgoing.length === 0) {
      outgoing = connectedStrings;

      // Phase 9: Allow stray Chrono-Pulses fired from open-ended strings to shoot outward
      // as luminous photon darts that bounce off real walls/tables and reflect back!
      if (this.photonDarts.size < this.MAX_ACTIVE_DARTS) {
        const otherNode = incomingString.nodeA.id === node.id ? incomingString.nodeB : incomingString.nodeA;
        const outDir = node.position.clone().sub(otherNode.position).normalize();
        outDir.y += 0.15;
        outDir.normalize();
        this.spawnPhotonDart(node.position, outDir, incomingString.color, node.noteFrequency);
      }
    }

    // Spawn pulse along next branch
    const nextBranch = outgoing[Math.floor(Math.random() * outgoing.length)];
    this.spawnChronoPulse(node, nextBranch.otherNode, nextBranch.string);
  }

  /**
   * Spawns a pulse from root nodes to sustain the Clockwork Engine
   */
  private triggerClockworkPulseCycle(): void {
    if (this.strings.size === 0) return;
    const allStrings = Array.from(this.strings.values());
    const randomStr = allStrings[Math.floor(Math.random() * allStrings.length)];
    this.spawnChronoPulse(randomStr.nodeA, randomStr.nodeB, randomStr);
  }

  // ----------------------------------------------------
  // 5. Plucking & Palm-Muting Interactions
  // ----------------------------------------------------

  /**
   * Checks if an index-finger-tip crossed or hit any ChronoString to pluck it
   */
  private checkStringPlucking(hand: Handedness, tipPos: THREE.Vector3, deltaTime: number): void {
    const prevPos = this.prevFingertipPositions.get(hand);
    if (!prevPos) {
      this.prevFingertipPositions.set(hand, tipPos.clone());
      return;
    }

    const fingerVel = tipPos.distanceTo(prevPos) / Math.max(deltaTime, 0.001);

    for (const str of this.strings.values()) {
      if (str.nodeA.isMuted || str.nodeB.isMuted) continue;

      const pA = str.nodeA.position;
      const pB = str.nodeB.position;

      const v = this._v2.subVectors(pB, pA);
      const w = this._v3.subVectors(tipPos, pA);

      const c1 = w.dot(v);
      const c2 = v.dot(v);

      if (c2 === 0) continue;

      const param = THREE.MathUtils.clamp(c1 / c2, 0, 1);
      const closestPoint = new THREE.Vector3().copy(pA).addScaledVector(v, param);
      const dist = tipPos.distanceTo(closestPoint);

      const isTouching = dist < 0.022;
      const timeSinceLastPluck = (performance.now() - str.lastPluckTime) / 1000;

      if (isTouching && timeSinceLastPluck > 0.16 && fingerVel > 0.05) {
        str.lastPluckTime = performance.now();

        // 1. Damped harmonic physical vibration
        str.vibrationAmplitude = 0.024 * Math.min(2.0, Math.max(0.6, fingerVel * 3));
        str.vibrationDecay = 2.4;
        str.vibrationPhase = 0;

        const dir = this._v1.subVectors(pB, pA).normalize();
        const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        str.vibrationNormal.crossVectors(dir, up).normalize();

        // 2. Emit burst of 15 glowing particles at the contact point & trigger floor cymatic pulse
        this.spawnParticleBurst(closestPoint, 15, str.color, 0.045);
        this.sceneManager.triggerCymaticPulse(closestPoint, str.color, 1.15);
        this.accessibilityManager?.triggerVisualHapticWave(closestPoint, str.frequency, fingerVel * 1.3);

        // 3. Play 3D HRTF Spatialized Pluck Note & Duck Drone Bed
        this.spatialSynth.triggerDroneDucking(fingerVel);
        this.spatialSynth.playSpatialNote({
          frequency: str.frequency,
          position: closestPoint,
          intensity: fingerVel * 1.2,
          duration: 1.3
        });

        // 4. Manual plucks inject kinetic pulses heading toward both ends of the string!
        this.spawnChronoPulse(str.nodeA, str.nodeB, str);

        // 5. Powerful plucks eject an energetic photon dart outward toward room walls!
        if (fingerVel > 1.1 && this.photonDarts.size < this.MAX_ACTIVE_DARTS) {
          const dartDir = str.vibrationNormal.clone();
          if (Math.random() < 0.5) dartDir.negate();
          this.spawnPhotonDart(closestPoint, dartDir, str.color, str.frequency);
        }

        console.log(`[LoomEngine] PLUCK! ChronoString [${str.id}] plucked at 3D pos (${closestPoint.x.toFixed(2)}, ${closestPoint.y.toFixed(2)}, ${closestPoint.z.toFixed(2)})`);
        if (!this.isApplyingRemote) {
          this.onStringPlucked?.(str.id, closestPoint, fingerVel);
          for (const listener of this.stringPluckedListeners) {
            listener(str.id, closestPoint, fingerVel, str.frequency);
          }
        }
      }
    }

    prevPos.copy(tipPos);
  }

  /**
   * Evaluates Open Palm gesture near nodes to toggle "Mute/Freeze" state
   */
  private checkPalmMuting(hand: Handedness, palmPos: THREE.Vector3): void {
    const telemetry = this.handInputManager.getTelemetry(hand);
    if (!telemetry.isOpenPalm) return;

    for (const node of this.nodes.values()) {
      const dist = palmPos.distanceTo(node.position);
      if (dist < 0.12) {
        if (!node.isMuted) {
          node.isMuted = true;
          this.applyNodeMuteVisuals(node, true);
          this.spawnParticleBurst(node.position, 12, node.muteColor, 0.03);
          console.log(`[LoomEngine] Harmonic Node [${node.id}] FROZEN / MUTED by ${hand} Open Palm!`);
        }
      } else if (dist > 0.22 && node.isMuted) {
        node.isMuted = false;
        this.applyNodeMuteVisuals(node, false);
        this.spawnParticleBurst(node.position, 8, node.baseColor, 0.03);
        console.log(`[LoomEngine] Harmonic Node [${node.id}] UNMUTED.`);
      }
    }
  }

  /**
   * Visual icy blue frost transformation for muted nodes
   */
  private applyNodeMuteVisuals(node: HarmonicNode, isMuted: boolean): void {
    const targetColor = isMuted ? node.muteColor : node.baseColor;
    const coreMat = node.coreMesh.material as THREE.MeshPhysicalMaterial;
    const shellMat = node.wireframeMesh.material as THREE.MeshBasicMaterial;

    coreMat.color.copy(targetColor);
    coreMat.emissive.copy(isMuted ? new THREE.Color(0x0284c7) : new THREE.Color(0x0088aa));
    coreMat.roughness = isMuted ? 0.4 : 0.15;
    shellMat.color.copy(targetColor);
    node.innerGlow.color.copy(targetColor);

    // Update aura glow halo color & opacity
    const auraMat = node.auraSprite.material as THREE.SpriteMaterial;
    auraMat.color.copy(targetColor);
    auraMat.opacity = isMuted ? 0.35 : 0.72;

    // Freeze any connected strings' vibrations immediately
    for (const str of this.strings.values()) {
      if (str.nodeA.id === node.id || str.nodeB.id === node.id) {
        str.vibrationAmplitude = 0;
      }
    }
  }

  // ----------------------------------------------------
  // Phase 9: Luminous Photon Darts & Wall-Bounce Reflections
  // ----------------------------------------------------

  /**
   * Spawns a luminous Photon Dart shooting outward from an open string or node
   */
  public spawnPhotonDart(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    color: THREE.Color,
    frequency: number
  ): PhotonDart {
    const id = `dart_${this.nextDartIndex++}`;
    const group = new THREE.Group();
    group.name = `PhotonDart_${id}`;
    group.position.copy(origin);

    // 1. Core Luminous Bead
    const coreGeo = new THREE.SphereGeometry(0.016, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // 2. Outer glow aura sprite
    const auraMat = new THREE.SpriteMaterial({
      map: this.getAuraTexture(),
      color: color.clone(),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const aura = new THREE.Sprite(auraMat);
    aura.scale.set(0.12, 0.12, 1);
    group.add(aura);

    // 3. Point light
    const light = new THREE.PointLight(color, 1.4, 0.55);
    group.add(light);

    // 4. Trailing light ribbon
    const tailPoints: THREE.Vector3[] = [];
    for (let i = 0; i < 5; i++) {
      tailPoints.push(origin.clone());
    }
    const tailGeo = new THREE.BufferGeometry().setFromPoints(tailPoints);
    const tailMat = new THREE.LineBasicMaterial({
      color: color.clone(),
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
      blending: THREE.AdditiveBlending
    });
    const tailLine = new THREE.Line(tailGeo, tailMat);
    this.loomGroup.add(tailLine);

    this.loomGroup.add(group);

    const speed = 2.2; // m/s
    const velocity = direction.clone().normalize().multiplyScalar(speed);

    const dart: PhotonDart = {
      id,
      position: group.position,
      velocity,
      color: color.clone(),
      frequency,
      meshGroup: group,
      coreMesh,
      tailLine,
      tailPoints,
      light,
      bouncesRemaining: 3,
      maxBounces: 3,
      life: 0,
      maxLife: 4.5
    };

    this.photonDarts.set(id, dart);
    return dart;
  }

  /**
   * Updates all active Photon Darts: advances along velocity vector,
   * performs physical wall-bounce against detected surfaces, triggers early-reflection stereo echo,
   * and checks collision with Harmonic Nodes.
   */
  private updatePhotonDarts(deltaTime: number): void {
    const toRemove: string[] = [];
    const seatedUserPos = new THREE.Vector3(0, 1.2, 0);

    for (const [id, dart] of this.photonDarts) {
      dart.life += deltaTime;

      if (dart.life >= dart.maxLife || dart.bouncesRemaining <= 0) {
        toRemove.push(id);
        continue;
      }

      // 1. Advance position along velocity vector
      dart.position.addScaledVector(dart.velocity, deltaTime);

      // 2. Update trailing light ribbon points
      for (let i = dart.tailPoints.length - 1; i > 0; i--) {
        dart.tailPoints[i].copy(dart.tailPoints[i - 1]);
      }
      dart.tailPoints[0].copy(dart.position);
      dart.tailLine.geometry.dispose();
      dart.tailLine.geometry = new THREE.BufferGeometry().setFromPoints(dart.tailPoints);

      // 3. Physical Wall/Table bounce check against detected MR Surfaces
      if (this.mrSurfaceManager) {
        const bounce = this.mrSurfaceManager.checkPhotonBounce(dart.position, dart.velocity, deltaTime);
        if (bounce) {
          // Snap position to hit point
          dart.position.copy(bounce.hitPoint);

          // Specular reflection: v' = v - 2(v . n)n
          const dot = dart.velocity.dot(bounce.normal);
          dart.velocity.sub(bounce.normal.clone().multiplyScalar(2 * dot));

          // Soft steering guidance back toward the user seated workspace (0, 1.2, -0.45)
          const towardWorkspace = new THREE.Vector3(0, 1.2, -0.45).sub(bounce.hitPoint).normalize();
          dart.velocity.lerp(towardWorkspace.multiplyScalar(dart.velocity.length()), 0.32);

          // Flash real-world wall/table surface with expanding ripple
          this.mrSurfaceManager.flashSurface(bounce.surface, bounce.hitPoint);

          // Trigger Early-Reflection Stereo Echo in SpatialSynth based on real room dimensions!
          const distToListener = bounce.hitPoint.distanceTo(seatedUserPos);
          this.spatialSynth.playWallReflectionEcho(
            bounce.hitPoint,
            distToListener,
            bounce.surface.semanticLabel,
            dart.frequency
          );

          // Spawn particle burst on the wall
          this.spawnParticleBurst(bounce.hitPoint, 14, dart.color, 0.045);

          dart.bouncesRemaining--;
        }
      }

      // 4. Check if reflected dart returns and strikes any Harmonic Node in the Loom!
      if (dart.bouncesRemaining < dart.maxBounces) {
        for (const node of this.nodes.values()) {
          if (dart.position.distanceTo(node.position) < 0.075) {
            // Reflected dart strike!
            node.currentScale = 1.4;
            this.spatialSynth.playSpatialNote({
              frequency: node.noteFrequency,
              position: node.position,
              intensity: 1.25,
              duration: 1.2
            });
            this.spawnParticleBurst(node.position, 18, dart.color, 0.05);
            this.sceneManager.triggerCymaticPulse(node.position, dart.color, 1.2);
            this.accessibilityManager?.triggerVisualHapticWave(node.position, node.noteFrequency, 1.3);

            // Re-ignite a pulse into connected strings
            const connected: ChronoString[] = [];
            for (const str of this.strings.values()) {
              if (str.nodeA.id === node.id || str.nodeB.id === node.id) {
                connected.push(str);
              }
            }
            if (connected.length > 0) {
              const str = connected[Math.floor(Math.random() * connected.length)];
              const other = str.nodeA.id === node.id ? str.nodeB : str.nodeA;
              this.spawnChronoPulse(node, other, str);
            }

            toRemove.push(id);
            break;
          }
        }
      }
    }

    // Clean up expired or consumed darts
    for (const id of toRemove) {
      const dart = this.photonDarts.get(id);
      if (dart) {
        this.loomGroup.remove(dart.meshGroup);
        dart.coreMesh.geometry.dispose();
        (dart.coreMesh.material as THREE.Material).dispose();

        this.loomGroup.remove(dart.tailLine);
        dart.tailLine.geometry.dispose();
        (dart.tailLine.material as THREE.Material).dispose();

        this.photonDarts.delete(id);
      }
    }
  }

  // ----------------------------------------------------
  // Hand Input Event Handlers
  // ----------------------------------------------------

  private bindHandEvents(): void {
    // 1. Pinch Start
    this.handInputManager.onPinchStart((hand, midpoint, distance) => {
      // Audio activation trigger
      this.spatialSynth.ensureContext();

      // A. Check Seed Orb interaction if not yet awakened
      if (!this.isLoomAwakened && this.seedOrbGroup) {
        const distToOrb = midpoint.distanceTo(this.seedOrbCurrentPos);
        if (distToOrb < 0.08) {
          this.isSeedOrbGrabbed = true;
          console.log('[LoomEngine] Seed Orb grabbed by hand!');
          return;
        }
      }

      // B0. One-Handed Virtual Anchor Tether check
      if (this.accessibilityManager?.handleOneHandedPinch(hand, midpoint)) {
        return;
      }

      // B. Check if pinching an existing Harmonic Node to drag it
      const { node } = this.findNearestNode(midpoint, 0.065);
      if (node) {
        node.isGrabbed = true;
        node.grabbedByHand = hand;
        this.checkTwoHandSimultaneousWeave();
        return;
      }

      // C. Otherwise, start 0.2s hold timer to spawn Harmonic Node in empty space
      if (this.isWithinComfortZone(midpoint)) {
        this.pinchHoldTimers.set(hand, {
          startTime: performance.now(),
          startPosition: midpoint.clone(),
          hasSpawned: false
        });
      }
    });

    // 2. Pinch Move
    this.handInputManager.onPinchMove((hand, midpoint, distance) => {
      // A. Seed Orb dragging
      if (this.isSeedOrbGrabbed && this.seedOrbGroup) {
        this.seedOrbCurrentPos.copy(midpoint);
        this.seedOrbGroup.position.copy(midpoint);

        if (midpoint.distanceTo(this.seedOrbInitialPos) > 0.055) {
          this.isSeedOrbGrabbed = false;
          this.awakenLoomAt(midpoint);
        }
        return;
      }

      // B. Move dragged Node
      for (const node of this.nodes.values()) {
        if (node.isGrabbed && node.grabbedByHand === hand) {
          if (this.mrSurfaceManager) {
            const anchor = this.mrSurfaceManager.checkSurfaceAnchor(midpoint, 0.06);
            if (anchor) {
              // Magnetically snap and lock onto physical surface!
              node.position.set(midpoint.x, anchor.anchorY, midpoint.z);
              node.meshGroup.position.copy(node.position);
              this.attachOrUpdatePedestal(node, anchor.surface);
            } else {
              node.position.copy(midpoint);
              node.meshGroup.position.copy(midpoint);
              this.detachPedestal(node);
            }
          } else {
            node.position.copy(midpoint);
            node.meshGroup.position.copy(midpoint);
          }
          this.updateConnectedStrings(node);
          if (!this.isApplyingRemote) {
            this.onNodeMoved?.(node.id, node.position);
          }
          return;
        }
      }

      // C. Evaluate 0.2s hold timer for empty space node spawning
      const timer = this.pinchHoldTimers.get(hand);
      if (timer && !timer.hasSpawned) {
        const holdDuration = (performance.now() - timer.startTime) / 1000;
        const drift = midpoint.distanceTo(timer.startPosition);

        if (holdDuration >= 0.20 && drift < 0.045) {
          timer.hasSpawned = true;
          const newNode = this.spawnHarmonicNode(midpoint);
          newNode.isGrabbed = true;
          newNode.grabbedByHand = hand;
        }
      }
    });

    // 3. Pinch End
    this.handInputManager.onPinchEnd((hand, midpoint, distance) => {
      this.pinchHoldTimers.delete(hand);

      if (this.isSeedOrbGrabbed) {
        this.isSeedOrbGrabbed = false;
        this.awakenLoomAt(midpoint);
        return;
      }

      for (const node of this.nodes.values()) {
        if (node.isGrabbed && node.grabbedByHand === hand) {
          node.isGrabbed = false;
          node.grabbedByHand = null;

          if (this.mrSurfaceManager) {
            const anchor = this.mrSurfaceManager.checkSurfaceAnchor(node.position, 0.06);
            if (anchor) {
              node.position.y = anchor.anchorY;
              node.meshGroup.position.copy(node.position);
              this.attachOrUpdatePedestal(node, anchor.surface);
              this.updateConnectedStrings(node);
            }
          }

          for (const otherNode of this.nodes.values()) {
            if (otherNode.id !== node.id) {
              const d = node.position.distanceTo(otherNode.position);
              if (d < 0.09) {
                this.createChronoString(node, otherNode);
                break;
              }
            }
          }
        }
      }
    });

    // Phase 10: Conductor Tempo Listener
    this.handInputManager.onConductorTempo((bpm) => {
      this.setGlobalBPM(bpm);
    });

    // Phase 10: Harmonic Chord Bloom (Pinch + Flick)
    this.handInputManager.onChordBloom((hand, position) => {
      this.triggerChordBloomAt(position, hand);
    });

    // Phase 10: Acoustic Scissors Snip
    this.handInputManager.onAcousticScissors((hand, cutPoint) => {
      this.triggerAcousticScissorsSnip(cutPoint);
    });
  }

  /**
   * Phase 10: Harmonic Chord Bloom:
   * Splits a single Harmonic Node into a triangulated 3-node major/minor triad cluster
   * with pre-wired strings, particle explosion, and synchronized pulses.
   */
  public triggerChordBloomAt(position: THREE.Vector3, hand: Handedness): void {
    const nearest = this.findNearestNode(position, 0.095);
    if (!nearest.node) return;

    const rootNode = nearest.node;
    const f0 = rootNode.noteFrequency;
    const p0 = rootNode.position;

    // Offsets for triangulated 3-node triad
    const pos2 = new THREE.Vector3(p0.x + 0.075, p0.y + 0.035, p0.z - 0.02);
    const pos3 = new THREE.Vector3(p0.x - 0.075, p0.y + 0.035, p0.z - 0.02);

    // Harmonic Major Triad frequencies (Root, Major 3rd ~1.25x, Perfect 5th ~1.50x)
    const f1 = f0 * 1.25;
    const f2 = f0 * 1.50;

    const node2 = this.spawnHarmonicNode(pos2, f1);
    const node3 = this.spawnHarmonicNode(pos3, f2);

    // Pre-wire 3 strings forming the closed resonant triangle
    const str1 = this.createChronoString(rootNode, node2);
    const str2 = this.createChronoString(node2, node3);
    const str3 = this.createChronoString(node3, rootNode);

    // Radiant golden chord bloom particle burst
    this.spawnParticleBurst(p0, 35, new THREE.Color(0xffd700), 0.09);
    this.sceneManager.triggerCymaticPulse(p0, new THREE.Color(0xffd700), 1.5);
    this.accessibilityManager?.triggerVisualHapticWave(p0, f0, 1.4);

    // Play all 3 chord notes simultaneously in SpatialSynth
    this.spatialSynth.playSpatialNote({ frequency: f0, position: p0, intensity: 1.2, duration: 1.6 });
    this.spatialSynth.playSpatialNote({ frequency: f1, position: pos2, intensity: 1.2, duration: 1.6 });
    this.spatialSynth.playSpatialNote({ frequency: f2, position: pos3, intensity: 1.2, duration: 1.6 });

    // Launch circulating kinetic pulses around the triad
    if (str1) this.spawnChronoPulse(rootNode, node2, str1);
    if (str2) this.spawnChronoPulse(node2, node3, str2);
    if (str3) this.spawnChronoPulse(node3, rootNode, str3);

    this.showHolographicToast('✨ HARMONIC CHORD BLOOM!', 'Major Triad Cluster Synthesized', 3.0);
    console.log(`[LoomEngine] CHORD BLOOM! Split node [${rootNode.id}] into Triad Cluster with nodes [${node2.id}, ${node3.id}]`);
  }

  /**
   * Phase 10: Acoustic Scissors Snip:
   * Cleanly severs a single string with an electric spark shower without deleting connected nodes.
   */
  public triggerAcousticScissorsSnip(cutPoint: THREE.Vector3): boolean {
    let nearestStr: ChronoString | null = null;
    let minDist = 0.065;

    for (const str of this.strings.values()) {
      const pA = str.nodeA.position;
      const pB = str.nodeB.position;

      const v = this._v2.subVectors(pB, pA);
      const w = this._v3.subVectors(cutPoint, pA);
      const c1 = w.dot(v);
      const c2 = v.dot(v);

      if (c2 === 0) continue;
      const param = THREE.MathUtils.clamp(c1 / c2, 0, 1);
      const closestOnLine = new THREE.Vector3().copy(pA).addScaledVector(v, param);
      const d = cutPoint.distanceTo(closestOnLine);

      if (d < minDist) {
        minDist = d;
        nearestStr = str;
      }
    }

    if (!nearestStr) return false;

    // Cleanly sever the string
    const stringId = nearestStr.id;
    this.loomGroup.remove(nearestStr.meshGroup);
    nearestStr.tubeMesh.geometry.dispose();
    (nearestStr.tubeMesh.material as THREE.Material).dispose();
    nearestStr.glowLine.geometry.dispose();
    (nearestStr.glowLine.material as THREE.Material).dispose();
    this.strings.delete(stringId);

    // Electric cyan/white spark shower at the cut point
    this.spawnParticleBurst(cutPoint, 28, new THREE.Color(0x00f0ff), 0.08);
    this.sceneManager.triggerCymaticPulse(cutPoint, new THREE.Color(0x00f0ff), 1.35);

    // Acoustic snap/twang in SpatialSynth
    this.spatialSynth.playSpatialNote({
      frequency: nearestStr.frequency * 2.8,
      position: cutPoint,
      intensity: 1.4,
      duration: 0.25
    });

    this.showHolographicToast('✂️ STRING SEVERED', 'Connected Nodes Preserved', 2.8);
    console.log(`[LoomEngine] SCISSORS SNIP! Severed string [${stringId}] without deleting nodes [${nearestStr.nodeA.id}, ${nearestStr.nodeB.id}].`);
    if (!this.isApplyingRemote) {
      this.onStringSevered?.(cutPoint, stringId);
    }
    return true;
  }

  /**
   * Two-Hand Simultaneous Weave
   */
  private checkTwoHandSimultaneousWeave(): void {
    let leftGrabbedNode: HarmonicNode | null = null;
    let rightGrabbedNode: HarmonicNode | null = null;

    for (const node of this.nodes.values()) {
      if (node.isGrabbed) {
        if (node.grabbedByHand === 'left') leftGrabbedNode = node;
        if (node.grabbedByHand === 'right') rightGrabbedNode = node;
      }
    }

    if (leftGrabbedNode && rightGrabbedNode && leftGrabbedNode.id !== rightGrabbedNode.id) {
      this.createChronoString(leftGrabbedNode, rightGrabbedNode);
    }
  }

  /**
   * Checks if position is within seated comfort envelope
   */
  private isWithinComfortZone(pos: THREE.Vector3): boolean {
    const userOrigin = this._v1.set(0, 1.2, 0);
    const distToUser = pos.distanceTo(userOrigin);
    return distToUser < 0.65 && pos.z <= -0.12 && pos.y >= 0.85 && pos.y <= 1.45;
  }

  /**
   * Re-evaluates length, pitch, and updates geometry of strings attached to a moved node
   */
  public updateConnectedStrings(node: HarmonicNode): void {
    for (const str of this.strings.values()) {
      if (str.nodeA.id === node.id || str.nodeB.id === node.id) {
        str.length = str.nodeA.position.distanceTo(str.nodeB.position);
        str.frequency = this.spatialSynth.mapLengthToScaleFrequency(str.length);
        str.color = this.mapLengthToNeonColor(str.length);

        if (str.quantumMaterial) {
          str.quantumMaterial.uniforms.uColor.value.copy(str.color);
          str.quantumMaterial.uniforms.uLength.value = str.length;
        } else if ((str.tubeMesh.material as any).color) {
          (str.tubeMesh.material as any).color.copy(str.color);
        }
      }
    }
  }

  // ----------------------------------------------------
  // 6. Particle Burst System
  // ----------------------------------------------------

  private initParticleSystem(): {
    mesh: THREE.Points;
    geo: THREE.BufferGeometry;
    positions: Float32Array;
    colors: Float32Array;
  } {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(this.MAX_PARTICLES * 3);
    const colors = new Float32Array(this.MAX_PARTICLES * 3);

    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      positions[i * 3 + 1] = -999;
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#38bdf8');
    grad.addColorStop(0.8, '#a855f7');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.PointsMaterial({
      size: 0.02,
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Points(geo, mat);
    return { mesh, geo, positions, colors };
  }

  public spawnParticleBurst(
    pos: THREE.Vector3,
    count: number,
    color: THREE.Color,
    speed: number = 0.05
  ): void {
    for (let i = 0; i < count; i++) {
      if (this.activeParticles.length >= this.MAX_PARTICLES) {
        this.activeParticles.shift();
      }

      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = speed * (0.5 + Math.random() * 0.8);

      const vel = new THREE.Vector3(
        Math.cos(theta) * Math.cos(phi) * spd,
        Math.sin(phi) * spd + 0.015,
        Math.sin(theta) * Math.cos(phi) * spd
      );

      this.activeParticles.push({
        position: pos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01,
          (Math.random() - 0.5) * 0.01
        )),
        velocity: vel,
        color: color.clone(),
        size: 0.02,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 0.6 + Math.random() * 0.5
      });
    }
  }

  // ----------------------------------------------------
  // Per-Frame Update Loop
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    const time = performance.now() * 0.001;

    // 1. Seed Orb Pulse & Prompt Floating
    if (!this.isLoomAwakened && this.seedOrbGroup) {
      this.seedOrbMesh.rotation.y += 0.012;
      this.seedOrbMesh.rotation.x += 0.008;
      this.seedOrbShell.rotation.y -= 0.018;
      this.seedOrbShell.rotation.z += 0.01;

      const pulse = 1 + Math.sin(time * 3.5) * 0.06;
      this.seedOrbMesh.scale.setScalar(pulse);
      this.seedOrbShell.scale.setScalar(pulse * 1.05);

      if (!this.isSeedOrbGrabbed) {
        this.seedOrbGroup.position.y = this.seedOrbInitialPos.y + Math.sin(time * 2.0) * 0.008;
      }
    }

    // 2. Harmonic Nodes tumbling & smooth 1.4x scale flash decay
    for (const node of this.nodes.values()) {
      node.coreMesh.rotation.x += node.rotationSpeed.x;
      node.coreMesh.rotation.y += node.rotationSpeed.y;
      node.wireframeMesh.rotation.x -= node.rotationSpeed.x * 1.2;
      node.wireframeMesh.rotation.y -= node.rotationSpeed.y * 1.2;

      // Smooth decay of kinetic pulse 1.4x scale flash
      if (node.currentScale > 1.001) {
        node.currentScale = THREE.MathUtils.lerp(node.currentScale, 1.0, 0.12);
        node.meshGroup.scale.setScalar(node.currentScale);
      } else {
        node.currentScale = 1.0;
        node.meshGroup.scale.setScalar(1.0);
      }

      // Glow intensity modulation
      const pulse = node.isMuted ? 0.3 : 0.6 + Math.sin(time * 4.0 + node.id.charCodeAt(5)) * 0.25;
      (node.coreMesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = pulse;

      // Soft glow aura halo scaling and breathing
      node.auraSprite.scale.setScalar(node.currentScale * 0.16);
      const auraMat = node.auraSprite.material as THREE.SpriteMaterial;
      if (!node.isMuted) {
        auraMat.opacity = 0.62 + Math.sin(time * 3.5 + node.id.charCodeAt(5)) * 0.15;
      }

      // Orient pitch label sprite towards camera
      if (node.pitchLabelSprite && node.pitchLabelSprite.visible) {
        node.pitchLabelSprite.lookAt(this.sceneManager.camera.position);
      }
    }

    // 3. Phase 14: Custom GLSL Quantum Strings (GPU standing-wave harmonics, chromatic fringe & solitons)
    for (const str of this.strings.values()) {
      if (str.nodeA.isMuted || str.nodeB.isMuted) {
        str.vibrationAmplitude = 0;
      }

      if (str.vibrationAmplitude > 0.0002) {
        str.vibrationAmplitude *= Math.exp(-str.vibrationDecay * deltaTime);
        str.vibrationPhase += str.vibrationFrequency * deltaTime * Math.PI * 2;
      } else {
        str.vibrationAmplitude = 0;
      }

      // Update Quantum String position, orientation and scale between nodeA and nodeB
      const dir = this._v1.subVectors(str.nodeB.position, str.nodeA.position);
      const len = Math.max(0.001, dir.length());
      dir.normalize();
      const up = this._v2.set(0, 1, 0);
      str.tubeMesh.position.copy(str.nodeA.position);
      str.tubeMesh.quaternion.setFromUnitVectors(up, dir);
      str.tubeMesh.scale.set(1, len, 1);

      // Compute local transverse vibration normal in cylinder's object space
      const localNormal = this._v3
        .copy(str.vibrationNormal)
        .applyQuaternion(str.tubeMesh.quaternion.clone().invert())
        .normalize();

      const qMat = (str.quantumMaterial || str.tubeMesh.material) as THREE.ShaderMaterial;
      if (qMat && qMat.uniforms) {
        qMat.uniforms.uAmplitude.value = str.vibrationAmplitude;
        qMat.uniforms.uVibrationPhase.value = str.vibrationPhase;
        qMat.uniforms.uSolitonProgress.value =
          (qMat.uniforms.uSolitonProgress.value + deltaTime * 1.5) % 1.0;
        if (str.vibrationAmplitude > 0.001) {
          qMat.uniforms.uSolitonAmp.value = Math.max(
            qMat.uniforms.uSolitonAmp.value,
            str.vibrationAmplitude * 35.0
          );
        }
        qMat.uniforms.uSolitonAmp.value = Math.max(
          0.2,
          qMat.uniforms.uSolitonAmp.value * Math.exp(-deltaTime * 1.6)
        );
        qMat.uniforms.uTransverseDir.value.copy(localNormal);
        qMat.uniforms.uTime.value += deltaTime;
      }

      // Keep glow line endpoints updated with zero CPU geometry re-allocations
      const linePosAttr = str.glowLine.geometry.attributes.position as THREE.BufferAttribute;
      linePosAttr.setXYZ(0, str.nodeA.position.x, str.nodeA.position.y, str.nodeA.position.z);
      linePosAttr.setXYZ(1, str.nodeB.position.x, str.nodeB.position.y, str.nodeB.position.z);
      linePosAttr.needsUpdate = true;
    }

    // 4. Update Autonomous Kinetic Pulses (The Clockwork Engine)
    this.updateKineticPulses(deltaTime);

    // 5. Plucking & Palm-Muting checks & Phase 14 Instanced Fingertip Ribbon Trails
    const leftTele = this.handInputManager.getTelemetry('left');
    const rightTele = this.handInputManager.getTelemetry('right');

    if (leftTele.isTracked) {
      this.checkStringPlucking('left', leftTele.indexTipPosition, deltaTime);
      this.checkPalmMuting('left', leftTele.wristPosition);

      // Feed left fingertip into GPU Ribbon Trail Pool (Cyan ribbon, tapering width & opacity)
      if (this.prevLeftTipPos) {
        if (this.prevLeftTipPos.distanceTo(leftTele.indexTipPosition) > 0.0025) {
          this.ribbonTrailPool.addSegment(
            this.prevLeftTipPos,
            leftTele.indexTipPosition,
            new THREE.Color(0x00f0ff),
            0.012
          );
          this.prevLeftTipPos.copy(leftTele.indexTipPosition);
        }
      } else {
        this.prevLeftTipPos = leftTele.indexTipPosition.clone();
      }
    } else {
      this.prevLeftTipPos = null;
    }

    if (rightTele.isTracked) {
      this.checkStringPlucking('right', rightTele.indexTipPosition, deltaTime);
      this.checkPalmMuting('right', rightTele.wristPosition);

      // Feed right fingertip into GPU Ribbon Trail Pool (Neon purple ribbon, tapering width & opacity)
      if (this.prevRightTipPos) {
        if (this.prevRightTipPos.distanceTo(rightTele.indexTipPosition) > 0.0025) {
          this.ribbonTrailPool.addSegment(
            this.prevRightTipPos,
            rightTele.indexTipPosition,
            new THREE.Color(0xa855f7),
            0.012
          );
          this.prevRightTipPos.copy(rightTele.indexTipPosition);
        }
      } else {
        this.prevRightTipPos = rightTele.indexTipPosition.clone();
      }
    } else {
      this.prevRightTipPos = null;
    }

    // Update GPU Ribbon Trail Pool (tapers instances over 0.45s, 1 draw call)
    this.ribbonTrailPool.update(deltaTime, this.sceneManager.camera.position);

    // 6. Update Pluck & Collision Particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.life -= deltaTime;
      if (p.life <= 0) {
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.position.addScaledVector(p.velocity, deltaTime);
      p.velocity.multiplyScalar(0.96);
      p.velocity.y -= 0.015 * deltaTime;
    }

    // Flush active particles to GPU buffer
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const i3 = i * 3;
      if (i < this.activeParticles.length) {
        const p = this.activeParticles[i];
        this.particlePositions[i3] = p.position.x;
        this.particlePositions[i3 + 1] = p.position.y;
        this.particlePositions[i3 + 2] = p.position.z;

        const alpha = Math.max(0, p.life / p.maxLife);
        this.particleColors[i3] = p.color.r * alpha;
        this.particleColors[i3 + 1] = p.color.g * alpha;
        this.particleColors[i3 + 2] = p.color.b * alpha;
      } else {
        this.particlePositions[i3 + 1] = -999;
      }
    }
    (this.particleGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particleGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    // 6.5. Update Phase 9: Luminous Photon Darts & Wall-Bounce Reflections
    this.updatePhotonDarts(deltaTime);

    // 7. Update 3D Holographic Toast Notification
    if (this.toastSprite) {
      this.toastTimer += deltaTime;
      this.toastSprite.position.y += 0.008 * deltaTime;
      this.toastSprite.lookAt(this.sceneManager.camera.position);

      if (this.toastTimer > this.toastDuration - 0.8) {
        const fade = (this.toastDuration - this.toastTimer) / 0.8;
        this.toastSprite.material.opacity = Math.max(0, fade * 0.98);
      }

      if (this.toastTimer >= this.toastDuration) {
        this.loomGroup.remove(this.toastSprite);
        (this.toastSprite.material as THREE.Material).dispose();
        this.toastSprite = null;
      }
    }

    // 8. Phase 15: Living Harmonic Drone Bed (Track root/fifth & swell with active strings)
    const activeFreqs = Array.from(this.nodes.values()).map(n => n.noteFrequency);
    this.spatialSynth.updateDroneBed(activeFreqs, this.strings.size);
  }

  /**
   * Status readout for UI HUD
   */
  public getStatusSummary(): {
    isAwakened: boolean;
    nodeCount: number;
    stringCount: number;
    pulseCount: number;
    seedOrbPosition: THREE.Vector3;
  } {
    return {
      isAwakened: this.isLoomAwakened,
      nodeCount: this.nodes.size,
      stringCount: this.strings.size,
      pulseCount: this.pulses.size,
      seedOrbPosition: this.seedOrbCurrentPos.clone()
    };
  }

  /**
   * Resets the Loom to initial state
   */
  public resetLoom(): void {
    // Clear pulses
    for (const pulse of this.pulses.values()) {
      this.loomGroup.remove(pulse.meshGroup);
      pulse.mesh.geometry.dispose();
      (pulse.mesh.material as THREE.Material).dispose();
      pulse.auraSprite.geometry.dispose();
      (pulse.auraSprite.material as THREE.Material).dispose();
    }
    this.pulses.clear();

    // Clear strings
    for (const str of this.strings.values()) {
      this.loomGroup.remove(str.meshGroup);
      str.tubeMesh.geometry.dispose();
      (str.tubeMesh.material as THREE.Material).dispose();
      str.glowLine.geometry.dispose();
      (str.glowLine.material as THREE.Material).dispose();
    }
    this.strings.clear();

    // Clear photon darts
    for (const dart of this.photonDarts.values()) {
      this.loomGroup.remove(dart.meshGroup);
      dart.coreMesh.geometry.dispose();
      (dart.coreMesh.material as THREE.Material).dispose();
      this.loomGroup.remove(dart.tailLine);
      dart.tailLine.geometry.dispose();
      (dart.tailLine.material as THREE.Material).dispose();
    }
    this.photonDarts.clear();

    // Clear nodes
    for (const node of this.nodes.values()) {
      if (node.pedestalGroup) {
        this.detachPedestal(node);
      }

// [Chrono-Loom Milestone 72/84] feat(share): encode active 3D node positions, strings, and Aria mode into URL hash
