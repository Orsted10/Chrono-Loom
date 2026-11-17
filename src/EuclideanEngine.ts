import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { LoomEngine, HarmonicNode } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';

export const ALLOWED_EUCLIDEAN_STEPS = [3, 4, 5, 7, 8, 12, 16] as const;
export type EuclideanStepCount = typeof ALLOWED_EUCLIDEAN_STEPS[number];

export interface ScalePreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keyNumber: number;
  frequencies: number[];
  noteNames: string[];
  palette: {
    primaryColor: THREE.Color;
    accentColor: THREE.Color;
    cymaticColor: THREE.Color;
    ambientColor: THREE.Color;
    backgroundFogColor: THREE.Color;
  };
}

export interface EuclideanRingConfig {
  k: number;
  n: EuclideanStepCount;
  pattern: boolean[];
  ringGroup: THREE.Group;
  guideRing: THREE.Line;
  pipMeshes: THREE.Mesh[];
  playheadMesh: THREE.Mesh;
  labelSprite: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  labelTexture: THREE.CanvasTexture;
  currentStep: number;
  lastTriggeredStep: number;
  pipScales: number[];
}

/**
 * Bjorklund's Euclidean Algorithm E(k, n)
 * Generates an array of n booleans with k active hits distributed as evenly as possible.
 */
export function computeBjorklundPattern(k: number, n: number): boolean[] {
  k = Math.max(0, Math.min(k, n));
  if (n <= 0) return [];
  if (k === 0) return new Array(n).fill(false);
  if (k === n) return new Array(n).fill(true);

  let ones: number[][] = Array.from({ length: k }, () => [1]);
  let zeros: number[][] = Array.from({ length: n - k }, () => [0]);

  while (zeros.length > 0) {
    if (zeros.length <= 1) {
      ones = ones.concat(zeros);
      break;
    }
    const minLen = Math.min(ones.length, zeros.length);
    for (let i = 0; i < minLen; i++) {
      ones[i] = ones[i].concat(zeros.pop()!);
    }
    if (zeros.length > 0 && ones.length < zeros.length) {
      const remainder = zeros;
      zeros = ones;
      ones = remainder;
    }
  }

  return ones.flat().map((v) => v === 1);
}

export function getEuclideanRhythmName(k: number, n: number): string {
  if (n === 8 && k === 3) return 'Tresillo (Cuban / Habanera)';
  if (n === 8 && k === 5) return 'Cinquillo (Calypso / Tango)';
  if (n === 16 && k === 7) return 'Samba (Brazilian)';
  if (n === 12 && k === 7) return 'Bembé (West African Bell)';
  if (n === 12 && k === 5) return 'Venda (South African)';
  if (n === 5 && k === 2) return 'Khafif-e-ramal';
  if (n === 5 && k === 3) return 'Cumbia / Persian';
  if (n === 7 && k === 4) return 'Ruchenitza (Bulgarian)';
  if (n === 3 && k === 2) return 'Swing / Shuffle';
  if (n === 4 && k === 1) return 'Quarter Downbeat';
  if (n === 4 && k === 2) return 'Backbeat / Half-Time';
  if (n === 4 && k === 3) return 'Dotted Syncopation';
  if (n === 4 && k === 4) return 'Four-on-the-Floor';
  if (n === 16 && k === 4) return 'Classic 4/4 Pulse';
  if (n === 16 && k === 9) return 'Central African 9/16';
  if (n === 16 && k === 11) return 'Frank Zappa 11/16';
  return `Euclidean E(${k}, ${n})`;
}

/**
 * 5 Curated Spatial Scale Presets
 */
export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: 'celestial_lydian',
    name: 'Celestial Lydian',
    shortName: 'Lydian',
    description: 'Resonant, ethereal, uplifting sci-fi harmony with raised 4th',
    keyNumber: 1,
    frequencies: [
      130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, // Octave 3
      261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, // Octave 4
      523.25, 587.33, 659.25                                   // Octave 5
    ],
    noteNames: ['C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'],
    palette: {
      primaryColor: new THREE.Color(0x00f0ff), // Cyan
      accentColor: new THREE.Color(0xffd700),  // Gold
      cymaticColor: new THREE.Color(0x00f0ff), // Cyan
      ambientColor: new THREE.Color(0x0a192f), // Indigo void
      backgroundFogColor: new THREE.Color(0x030712)
    }
  },
  {
    id: 'tokyo_midnight_hirajoshi',
    name: 'Tokyo Midnight Hirajoshi',
    shortName: 'Hirajoshi',
    description: 'Cinematic Japanese pentatonic synthwave (1, 2, b3, 5, b6)',
    keyNumber: 2,
    frequencies: [
      110.00, 123.47, 130.81, 164.81, 174.61, // Octave 2/3
      220.00, 246.94, 261.63, 329.63, 349.23, // Octave 3/4
      440.00, 493.88, 523.25, 659.25, 698.46, // Octave 4/5
      880.00
    ],
    noteNames: ['A2', 'B2', 'C3', 'E3', 'F3', 'A3', 'B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5', 'E5', 'F5', 'A5'],
    palette: {
      primaryColor: new THREE.Color(0xf43f5e), // Neon Rose
      accentColor: new THREE.Color(0xc084fc),  // Electric Violet
      cymaticColor: new THREE.Color(0xd946ef), // Cyber Pink
      ambientColor: new THREE.Color(0x1a0526), // Deep violet
      backgroundFogColor: new THREE.Color(0x090111)
    }
  },
  {
    id: 'raga_yaman_evening',
    name: 'Raga Yaman Evening',
    shortName: 'Raga Yaman',
    description: 'Ancient meditative North Indian Kalyan evening thaat (Tivra Ma)',
    keyNumber: 3,
    frequencies: [
      130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, // C3 to B3
      261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, // C4 to B4
      523.25, 587.33, 659.25, 783.99                          // C5 to G5
    ],
    noteNames: ['Sa3', 'Re3', 'Ga3', 'Ma#3', 'Pa3', 'Dha3', 'Ni3', 'Sa4', 'Re4', 'Ga4', 'Ma#4', 'Pa4', 'Dha4', 'Ni4', 'Sa5', 'Re5', 'Ga5', 'Pa5'],
    palette: {
      primaryColor: new THREE.Color(0xf59e0b), // Amber Gold
      accentColor: new THREE.Color(0xfbbf24),  // Saffron Glow
      cymaticColor: new THREE.Color(0xea580c), // Sunset Orange
      ambientColor: new THREE.Color(0x241002), // Warm Amber Dusk
      backgroundFogColor: new THREE.Color(0x0c0500)
    }
  },
  {
    id: 'dorian_cyber_noir',
    name: 'Dorian Cyber-Noir',
    shortName: 'Dorian Noir',
    description: 'Nocturnal cyberpunk Blade Runner groove (1, 2, b3, 4, 5, 6, b7)',
    keyNumber: 4,
    frequencies: [
      73.42, 87.31, 110.00, 130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, // D2-B3
      261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33        // C4-D5
    ],
    noteNames: ['D2', 'F2', 'A2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5'],
    palette: {
      primaryColor: new THREE.Color(0x10b981), // Matrix Emerald
      accentColor: new THREE.Color(0x34d399),  // Mint Neon
      cymaticColor: new THREE.Color(0x06b6d4), // Deep Teal
      ambientColor: new THREE.Color(0x021a14), // Dark Matrix
      backgroundFogColor: new THREE.Color(0x010d0a)
    }
  },
  {
    id: 'deep_sub_drone',
    name: 'Deep Sub-Harmonic Drone',
    shortName: 'Sub Drone',
    description: 'Cavernous acoustic sub-bass fundament & sub-harmonic overtone series',
    keyNumber: 5,
    frequencies: [
      43.65, 55.00, 65.41, 82.41, 98.00, 110.00, 130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 329.63, 440.00
    ],
    noteNames: ['F0', 'A0', 'C1', 'E1', 'G1', 'A1', 'C2', 'D2', 'E2', 'G2', 'A2', 'C3', 'E3', 'A3'],
    palette: {
      primaryColor: new THREE.Color(0xef4444), // Crimson Fire
      accentColor: new THREE.Color(0xf97316),  // Electric Blaze
      cymaticColor: new THREE.Color(0x991b1b), // Blood Obsidian
      ambientColor: new THREE.Color(0x1a0404), // Cavernous Crimson
      backgroundFogColor: new THREE.Color(0x0a0101)
    }
  }
];

export class EuclideanEngine {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;

  // Active Scale Preset
  public activeScaleIndex = 0; // 0 = Celestial Lydian
  public activeScale: ScalePreset = SCALE_PRESETS[0];

  // Twist Tracking for VR Hand Interaction
  private prevWristRoll: Map<Handedness, number> = new Map();
  private rollAccumulator: Map<Handedness, number> = new Map();

  // Hovered / Selected Node for Desktop Controls
  public hoveredNode: HarmonicNode | null = null;

  // Global Clock ticker for Polyrhythms
  private polyrhythmClock = 0;

  // HUD Elements
  private scaleBadgeEl: HTMLElement | null = null;
  private scaleCycleBtn: HTMLElement | null = null;

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    spatialSynth: SpatialSynth
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.spatialSynth = spatialSynth;

    // 1. Hook LoomEngine Node Spawn: automatically attach Euclidean Step-Ring!
    this.hookLoomNodeSpawns();

    // Attach to any existing nodes
    for (const node of this.loomEngine.nodes.values()) {
      if (!node.euclideanConfig) {
        this.attachEuclideanRing(node, 3, 8);
      }
    }

    // 2. Setup Desktop Mouse Wheel & Keyboard Handlers
    this.setupDesktopControls();

    // 3. Initialize default scale
    this.applyScalePreset(0, false);

    console.log('[EuclideanEngine] Initialized Euclidean Polyrhythm Engine & 5 Curated Scale Modes.');
  }

  // ----------------------------------------------------
  // 1. Automatic Euclidean Ring Attachment
  // ----------------------------------------------------

  private hookLoomNodeSpawns(): void {
    // When a node is created in LoomEngine, give it a Euclidean Step-Ring
    const originalSpawn = this.loomEngine.spawnHarmonicNode.bind(this.loomEngine);
    this.loomEngine.spawnHarmonicNode = (pos, freq, customId) => {
      const node = originalSpawn(pos, freq, customId);
      // Give each node a default Euclidean pattern: E(2, 4) or E(3, 8)
      const defaultSteps: EuclideanStepCount = node.id === 'node_1' ? 4 : 8;
      const defaultHits = node.id === 'node_1' ? 1 : 3;
      this.attachEuclideanRing(node, defaultHits, defaultSteps);
      return node;
    };
  }

  /**
   * Attaches or updates a radial constellation step-ring around a Harmonic Node
   */
  public attachEuclideanRing(node: HarmonicNode, k: number = 3, n: EuclideanStepCount = 8): void {
    if (node.euclideanConfig) {
      this.removeEuclideanRing(node);
    }

    k = Math.max(1, Math.min(k, n));
    const pattern = computeBjorklundPattern(k, n);
    const ringRadius = 0.062;

    const ringGroup = new THREE.Group();
    ringGroup.name = `EuclideanRing_${node.id}`;

    // A. Subtle circular orbital guide path
    const curve = new THREE.EllipseCurve(0, 0, ringRadius, ringRadius, 0, 2 * Math.PI, false, 0);
    const points = curve.getPoints(48).map((p) => new THREE.Vector3(p.x, p.y, 0));
    const guideGeo = new THREE.BufferGeometry().setFromPoints(points);
    const guideMat = new THREE.LineBasicMaterial({
      color: this.activeScale.palette.primaryColor,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending
    });
    const guideRing = new THREE.Line(guideGeo, guideMat);
    ringGroup.add(guideRing);

    // B. Pips around the ring
    const pipMeshes: THREE.Mesh[] = [];
    const pipScales: number[] = [];

    const activeGeo = new THREE.OctahedronGeometry(0.0055, 1);
    const restGeo = new THREE.SphereGeometry(0.0028, 6, 6);

    const activeMat = new THREE.MeshStandardMaterial({
      color: this.activeScale.palette.accentColor,
      emissive: this.activeScale.palette.accentColor,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.6
    });

    const restMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.28
    });

    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = ringRadius * Math.cos(theta);
      const y = ringRadius * Math.sin(theta);

      const isHit = pattern[i];
      const pip = new THREE.Mesh(isHit ? activeGeo : restGeo, isHit ? activeMat.clone() : restMat);
      pip.position.set(x, y, 0);
      ringGroup.add(pip);
      pipMeshes.push(pip);
      pipScales.push(1.0);
    }

    // C. Traveling Playhead Bead
    const playheadGeo = new THREE.SphereGeometry(0.0065, 8, 8);
    const playheadMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });
    const playheadMesh = new THREE.Mesh(playheadGeo, playheadMat);
    playheadMesh.position.set(0, ringRadius, 0);
    ringGroup.add(playheadMesh);

    // Playhead point light
    const playheadLight = new THREE.PointLight(this.activeScale.palette.accentColor, 1.2, 0.25);
    playheadMesh.add(playheadLight);

    // D. 3D Billboard Label Sprite above node
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const labelSprite = new THREE.Sprite(spriteMat);
    labelSprite.scale.set(0.24, 0.06, 1);
    labelSprite.position.set(0, 0.088, 0);
    ringGroup.add(labelSprite);

    node.meshGroup.add(ringGroup);

    node.euclideanConfig = {
      k,
      n,
      pattern,
      ringGroup,
      guideRing,
      pipMeshes,
      playheadMesh,
      labelSprite,
      labelCanvas,
      labelTexture,
      currentStep: 0,
      lastTriggeredStep: -1,
      pipScales
    };

    this.drawNodeLabel(node);
  }

  public removeEuclideanRing(node: HarmonicNode): void {
    if (!node.euclideanConfig) return;
    const cfg = node.euclideanConfig;
    node.meshGroup.remove(cfg.ringGroup);
    cfg.guideRing.geometry.dispose();
    (cfg.guideRing.material as THREE.Material).dispose();
    cfg.pipMeshes.forEach((p: THREE.Mesh) => {
      p.geometry.dispose();
      (p.material as THREE.Material).dispose();
    });
    cfg.playheadMesh.geometry.dispose();
    (cfg.playheadMesh.material as THREE.Material).dispose();
    cfg.labelTexture.dispose();
    node.euclideanConfig = undefined;
  }

  private drawNodeLabel(node: HarmonicNode): void {
    if (!node.euclideanConfig) return;
    const { k, n, labelCanvas, labelTexture } = node.euclideanConfig;
    const ctx = labelCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 128);

    // Cyber glass pill backdrop
    ctx.fillStyle = 'rgba(7, 24, 45, 0.88)';
    ctx.strokeStyle = `#${this.activeScale.palette.primaryColor.getHexString()}`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 108, 20);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`E(${k}, ${n})`, 256, 56);

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = `#${this.activeScale.palette.accentColor.getHexString()}`;
    const name = getEuclideanRhythmName(k, n);
    ctx.fillText(name.toUpperCase(), 256, 92);

    labelTexture.needsUpdate = true;
  }

  // ----------------------------------------------------
  // 2. Pinch-and-Twist Hand Interaction & Desktop Controls
  // ----------------------------------------------------

  public cycleNodeStepCount(node: HarmonicNode, dir: 1 | -1): void {
    if (!node.euclideanConfig) {
      this.attachEuclideanRing(node, 3, 8);
      return;
    }

    const currentN = node.euclideanConfig.n;
    const idx = ALLOWED_EUCLIDEAN_STEPS.indexOf(currentN);
    const nextIdx = THREE.MathUtils.clamp(
      (idx + dir + ALLOWED_EUCLIDEAN_STEPS.length) % ALLOWED_EUCLIDEAN_STEPS.length,
      0,
      ALLOWED_EUCLIDEAN_STEPS.length - 1
    );
    const newN = ALLOWED_EUCLIDEAN_STEPS[nextIdx];
    const newK = Math.max(1, Math.min(node.euclideanConfig.k, newN));

    this.attachEuclideanRing(node, newK, newN);
    this.spatialSynth.playSpatialNote({
      frequency: node.noteFrequency * 1.5,
      position: node.position,
      intensity: 0.9,
      duration: 0.2
    });
  }

  public adjustNodeHits(node: HarmonicNode, delta: number): void {
    if (!node.euclideanConfig) {
      this.attachEuclideanRing(node, 3, 8);
      return;
    }

    const { n, k } = node.euclideanConfig;
    let nextK = k + delta;

    if (nextK > n) {
      // Step up to next allowed steps count
      this.cycleNodeStepCount(node, 1);
      return;
    } else if (nextK < 1) {
      // Step down to previous allowed steps count
      this.cycleNodeStepCount(node, -1);
      return;
    }

    this.attachEuclideanRing(node, nextK, n);
    this.spatialSynth.playSpatialNote({
      frequency: node.noteFrequency,
      position: node.position,
      intensity: 1.0,
      duration: 0.15
    });
  }

  private setupDesktopControls(): void {
    // Mouse wheel on desktop while hovering/grabbing node cycles k and n
    window.addEventListener('wheel', (e: WheelEvent) => {
      // Find nearest node within comfort reach of reticle/mouse
      const targetPos = (this.handInputManager as any).simTargetPos || new THREE.Vector3(0, 1.2, -0.45);
      const nearest = this.loomEngine.findNearestNode(targetPos, 0.12);

      if (nearest && nearest.node) {
        e.preventDefault();
        if (e.shiftKey) {
          this.cycleNodeStepCount(nearest.node, e.deltaY < 0 ? 1 : -1);
        } else {
          this.adjustNodeHits(nearest.node, e.deltaY < 0 ? 1 : -1);
        }
      }
    }, { passive: false });

    // Keyboard Shortcuts:
    // '1'-'5' for Scale Modes, 'E' for Euclidean toggle, '['/']' for k, '{'/'}' for n
    window.addEventListener('keydown', (e: KeyboardEvent) => {

// [Chrono-Loom Milestone 6/9] feat(scales): add Celestial Lydian, Tokyo Midnight Hirajoshi, and Raga Yaman
