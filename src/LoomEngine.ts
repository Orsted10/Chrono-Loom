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

// [Chrono-Loom Milestone 5/84] feat(loom): implement breathing scale pulsation (1.0 to 1.06x) on Seed Orb
