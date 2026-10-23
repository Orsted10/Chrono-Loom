import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { SceneManager } from './SceneManager.js';

export type Handedness = 'left' | 'right';

export type PinchCallback = (
  hand: Handedness,
  midpoint: THREE.Vector3,
  distance: number
) => void;

export type GestureCallback = (hand: Handedness) => void;
export type ConductorTempoCallback = (bpm: number) => void;
export type ChordBloomCallback = (hand: Handedness, position: THREE.Vector3) => void;
export type AcousticScissorsCallback = (hand: Handedness, cutPoint: THREE.Vector3) => void;

export interface GestureConfidences {
  conductorFrame: number;
  chordBloom: number;
  acousticScissors: number;
  pinchWeave: number;
  openPalmFreeze: number;
}

export interface HandTelemetry {
  handedness: Handedness;
  isTracked: boolean;
  pinchDistance: number;
  isPinching: boolean;
  isOpenPalm: boolean;
  wristToFingerDistances: number[];
  indexTipPosition: THREE.Vector3;
  thumbTipPosition: THREE.Vector3;
  wristPosition: THREE.Vector3;
  middleTipPosition?: THREE.Vector3;
  pinkyTipPosition?: THREE.Vector3;
}

export const XR_HAND_JOINTS = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',
  'thumb-tip',
  'index-finger-metacarpal',
  'index-finger-phalanx-proximal',
  'index-finger-phalanx-intermediate',
  'index-finger-phalanx-distal',
  'index-finger-tip',
  'middle-finger-metacarpal',
  'middle-finger-phalanx-proximal',
  'middle-finger-phalanx-intermediate',
  'middle-finger-phalanx-distal',
  'middle-finger-tip',
  'ring-finger-metacarpal',
  'ring-finger-phalanx-proximal',
  'ring-finger-phalanx-intermediate',
  'ring-finger-phalanx-distal',
  'ring-finger-tip',
  'pinky-finger-metacarpal',
  'pinky-finger-phalanx-proximal',
  'pinky-finger-phalanx-intermediate',
  'pinky-finger-phalanx-distal',
  'pinky-finger-tip'
] as const;

export type XRHandJointName = typeof XR_HAND_JOINTS[number];

interface HandInternalState {
  handGroup: THREE.XRHandSpace;
  handedness: Handedness;
  isConnected: boolean;
  isPinching: boolean;
  isOpenPalm: boolean;
  currentPinchDist: number;
  jointSpheres: Map<XRHandJointName, THREE.Mesh>;
  pinchLine: THREE.Line;
  indexTipPos: THREE.Vector3;
  thumbTipPos: THREE.Vector3;
  middleTipPos: THREE.Vector3;
  pinkyTipPos: THREE.Vector3;
  wristPos: THREE.Vector3;
  prevWristPos: THREE.Vector3;
  wristVelocity: THREE.Vector3;
  prevScissorDist: number;
  fingertipDistances: number[];
}

export class HandInputManager {
  private sceneManager: SceneManager;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private cameraRig: THREE.Group;

  // WebXR Hands
  public hand0: THREE.XRHandSpace;
  public hand1: THREE.XRHandSpace;
  private handModelFactory: XRHandModelFactory;

  // Internal tracked hand states
  private leftHandState: HandInternalState;
  private rightHandState: HandInternalState;

  // Event callbacks
  private pinchStartListeners: PinchCallback[] = [];
  private pinchMoveListeners: PinchCallback[] = [];
  private pinchEndListeners: PinchCallback[] = [];
  private openPalmStartListeners: GestureCallback[] = [];
  private openPalmMoveListeners: GestureCallback[] = [];
  private openPalmEndListeners: GestureCallback[] = [];

  // Phase 10: Neural Gesture Vocabulary & Time-Dilation Sculpting
  public isConductorActive = false;
  public currentConductorBPM = 90;
  public gestureConfidences: GestureConfidences = {
    conductorFrame: 0,
    chordBloom: 0,
    acousticScissors: 0,
    pinchWeave: 0,
    openPalmFreeze: 0
  };

  private conductorTempoListeners: ConductorTempoCallback[] = [];
  private chordBloomListeners: ChordBloomCallback[] = [];
  private acousticScissorsListeners: AcousticScissorsCallback[] = [];

  // Holographic Tempo Ribbon
  public tempoRibbonGroup!: THREE.Group;
  private tempoRibbonLine!: THREE.Line;
  private tempoRibbonSprite!: THREE.Sprite;
  private tempoRibbonCanvas!: HTMLCanvasElement;
  private tempoRibbonTexture!: THREE.CanvasTexture;

  // 3D "Gesture Cheat-Sheet" Holo-Card
  public holoCardGroup!: THREE.Group;
  private holoCardMesh!: THREE.Mesh;
  private holoCardCanvas!: HTMLCanvasElement;
  private holoCardTexture!: THREE.CanvasTexture;
  public isHoloCardVisible = false;

  // Simulator Conductor Toggle
  public simConductorActive = false;

  // Desktop Simulator Fallback
  public isSimulatorActive = true;
  private mouseNDC = new THREE.Vector2(0, 0);
  private raycaster = new THREE.Raycaster();
  private deskTargetPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.45); // z = -0.45m plane
  private simTargetPos = new THREE.Vector3(0, 1.05, -0.45);
  private simLeftPinchHeld = false;
  private simRightPinchHeld = false;
  private simOpenPalmActive = false;
  private simActiveHand: Handedness = 'right';

  // Auto-Director Demo Mode Override
  public isDemoModeActive = false;
  public onUserInput: (() => void) | null = null;

  // Desktop Visual Hand Rigs
  public simLeftHandRig: THREE.Group;
  public simRightHandRig: THREE.Group;
  public simCursorReticle: THREE.Mesh;

  // Hysteresis constants (in meters)
  public static readonly PINCH_START_THRESHOLD = 0.025; // 25mm
  public static readonly PINCH_END_THRESHOLD = 0.035;   // 35mm
  public static readonly OPEN_PALM_THRESHOLD = 0.090;   // 90mm from wrist for all 5 fingertips

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.renderer = sceneManager.renderer;
    this.camera = sceneManager.camera;
    this.cameraRig = sceneManager.cameraRig;

    // 1. Initialize WebXR hand models factory

// [Chrono-Loom Milestone 4/33] feat(hands): add hand joint position cache and velocity tracking
