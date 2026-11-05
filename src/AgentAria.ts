import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine, HarmonicNode } from './LoomEngine.js';
import { SpatialSynth, VocalChirpType } from './SpatialSynth.js';

export type AriaState =
  | 'OBSERVING'
  | 'HARMONIZING'
  | 'WEAVING'
  | 'CELEBRATING'
  | 'CALL_AND_RESPONSE'
  | 'LISTENING_VOICE';

export type AriaAIMode = 'CO-CREATE' | 'RHYTHM_BOOST' | 'ZEN_SOLO';

export type AriaEmotionalAnim =
  | 'NONE'
  | 'CURIOUS_TILT'
  | 'JOYFUL_BARREL_ROLL'
  | 'FOCUSED_WEAVE'
  | 'CLEANSING_WAVE';

export interface UserPluckRecord {
  time: number;
  frequency: number;
  position: THREE.Vector3;
  velocity: number;
  stringId: string;
}

export interface CounterMelodyNote {
  frequency: number;
  delaySec: number;
  duration: number;
  intensity: number;
  hasTriggered: boolean;
  targetPoint: THREE.Vector3;
}

export class AgentAria {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;
  public euclideanEngine: any = null;

  // Root Three.js container
  public ariaGroup: THREE.Group;

  // 3D Visual Mesh Components
  private coreMesh: THREE.Mesh;
  private ring1: THREE.Mesh;
  private ring2: THREE.Mesh;
  private ring3: THREE.Mesh;
  private coreGlowLight: THREE.PointLight;
  private badgeSprite: THREE.Sprite;
  private badgeCanvas: HTMLCanvasElement;
  private badgeCtx: CanvasRenderingContext2D;

  // High-Dynamic Glow Halos (Dual-layer additive blended sprites)
  private innerAuraSprite: THREE.Sprite;
  private outerHaloSprite: THREE.Sprite;
  private auraTexture: THREE.CanvasTexture | null = null;

  // Spatial Positions
  private homePosition = new THREE.Vector3(0.35, 1.35, -0.50);
  private currentPosition = new THREE.Vector3(0.35, 1.35, -0.50);
  private targetFlightPosition = new THREE.Vector3(0.35, 1.35, -0.50);
  private flightProgress = 1.0;
  private flightSpeed = 1.6;

  // State Machine
  public state: AriaState = 'OBSERVING';
  public mode: AriaAIMode = 'CO-CREATE';

  // Autonomous Weaving Clock
  private autonomousTimer = 0;
  private readonly WEAVE_INTERVAL = 8.0; // Every 8 seconds
  private lastFistBumpTime = 0;
  public observedBPM = 90;

  // Zen Solo chord timer
  private zenChordTimer = 0;

  // Celebrating flight angles
  private celebrateAngle = 0;

  // Phase 13: 3D Expressive Emotional Animations
  public currentAnim: AriaEmotionalAnim = 'NONE';
  private animTimer = 0.0;
  private animDuration = 1.0;
  private baseAnimRotation = new THREE.Euler(0, 0, 0);

  // Phase 13: Real-Time Musical Phrase Analyzer (Call & Response)
  private userPlucks: UserPluckRecord[] = [];
  private lastCallResponseTime = 0;
  private callResponseTimer = 0;
  private callResponseSequence: CounterMelodyNote[] = [];
  private callResponseOrigin = new THREE.Vector3();
  private callResponseTarget = new THREE.Vector3();
  private callResponsePhase: 'FLYING_TO_RESPONSE' | 'PLAYING_NOTES' | 'RETURNING' = 'FLYING_TO_RESPONSE';

  // Phase 13: Laser Beam Filaments (Optical harmonic weaving)
  private laserGroup: THREE.Group;
  private laserBeams: Array<{
    mesh: THREE.Mesh;
    line: THREE.Line;
    active: boolean;
    target: THREE.Vector3;
    intensity: number;
  }> = [];

  // Phase 13: Web Speech API & Push-to-Talk Voice Director
  private speechRecognition: any = null;
  public isListening = false;
  public isSpeechSupported = false;
  public lastVoiceTranscript = '';
  public lastVoiceIntent = '';
  public onListeningStateChanged?: (isListening: boolean) => void;

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,

// [Chrono-Loom Milestone 2/25] feat(aria): design Aria 3D mesh with three concentric glowing gold/purple rings
