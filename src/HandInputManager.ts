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
    this.handModelFactory = new XRHandModelFactory();

    // 2. Track both WebXR hands (0 and 1)
    this.hand0 = this.renderer.xr.getHand(0);
    this.hand1 = this.renderer.xr.getHand(1);

    this.cameraRig.add(this.hand0);
    this.cameraRig.add(this.hand1);

    // Attach factory models (creates sphere primitives dynamically when connected)
    this.hand0.add(this.handModelFactory.createHandModel(this.hand0, 'spheres'));
    this.hand1.add(this.handModelFactory.createHandModel(this.hand1, 'spheres'));

    // 3. Create joint visual overlays & telemetry state containers
    this.leftHandState = this.createHandInternalState('left', this.hand0);
    this.rightHandState = this.createHandInternalState('right', this.hand1);

    // Bind WebXR hand connection events
    this.setupHandEvents(this.hand0, 0);
    this.setupHandEvents(this.hand1, 1);

    // 4. Build Desktop Mouse/Keyboard Simulator Visuals & Handlers
    const { leftRig, rightRig, reticle } = this.createDesktopSimulatorVisuals();
    this.simLeftHandRig = leftRig;
    this.simRightHandRig = rightRig;
    this.simCursorReticle = reticle;

    this.sceneManager.scene.add(this.simLeftHandRig);
    this.sceneManager.scene.add(this.simRightHandRig);
    this.sceneManager.scene.add(this.simCursorReticle);

    this.setupDesktopControls();

    // 5. Initialize Phase 10: Tempo Ribbon & 3D Gesture Holo-Card
    this.createTempoRibbonVisuals();
    this.createGestureHoloCard();

    // Listen to XR Session lifecycle to toggle simulator
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.isSimulatorActive = false;
      this.simLeftHandRig.visible = false;
      this.simRightHandRig.visible = false;
      this.simCursorReticle.visible = false;
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.isSimulatorActive = true;
      this.simLeftHandRig.visible = true;
      this.simRightHandRig.visible = true;
      this.simCursorReticle.visible = true;
    });
  }

  /**
   * Builds joint visual indicators and internal tracking state
   */
  private createHandInternalState(defaultHandedness: Handedness, parentGroup: THREE.XRHandSpace): HandInternalState {
    const jointSpheres = new Map<XRHandJointName, THREE.Mesh>();

    // Glowing low-poly joint geometry
    const standardJointGeo = new THREE.SphereGeometry(0.007, 8, 8);
    const keyJointGeo = new THREE.SphereGeometry(0.010, 10, 10);

    // Shared glowing materials
    const standardJointMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false
    });

    const indexTipMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    const thumbTipMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });

    const wristMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    // Populate joint indicators
    for (const jointName of XR_HAND_JOINTS) {
      let geo = standardJointGeo;
      let mat = standardJointMat;

      if (jointName === 'index-finger-tip') {
        geo = keyJointGeo;
        mat = indexTipMat;
      } else if (jointName === 'thumb-tip') {
        geo = keyJointGeo;
        mat = thumbTipMat;
      } else if (jointName === 'wrist') {
        geo = keyJointGeo;
        mat = wristMat;
      } else if (jointName === 'middle-finger-metacarpal') {
        geo = standardJointGeo;
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `Joint_${jointName}`;
      mesh.visible = false;
      parentGroup.add(mesh);
      jointSpheres.set(jointName, mesh);
    }

    // Dynamic pinch laser line between index-tip and thumb-tip
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
      blending: THREE.AdditiveBlending
    });
    const pinchLine = new THREE.Line(lineGeo, lineMat);
    pinchLine.visible = false;
    parentGroup.add(pinchLine);

    return {
      handGroup: parentGroup,
      handedness: defaultHandedness,
      isConnected: false,
      isPinching: false,
      isOpenPalm: false,
      currentPinchDist: 0.06,
      jointSpheres,
      pinchLine,
      indexTipPos: new THREE.Vector3(),
      thumbTipPos: new THREE.Vector3(),
      middleTipPos: new THREE.Vector3(),
      pinkyTipPos: new THREE.Vector3(),
      wristPos: new THREE.Vector3(),
      prevWristPos: new THREE.Vector3(),
      wristVelocity: new THREE.Vector3(),
      prevScissorDist: 0.04,
      fingertipDistances: [0.07, 0.07, 0.07, 0.07, 0.07]
    };
  }

  /**
   * Sets up WebXR hand connected/disconnected listeners
   */
  private setupHandEvents(handGroup: THREE.XRHandSpace, index: number): void {
    handGroup.addEventListener('connected', (event) => {
      const xrInputSource = event.data;
      const handedness: Handedness =
        xrInputSource && xrInputSource.handedness === 'left' ? 'left' : 'right';

      const state = handedness === 'left' ? this.leftHandState : this.rightHandState;
      state.isConnected = true;
      state.handedness = handedness;

      // Reveal joints
      state.jointSpheres.forEach((sphere) => (sphere.visible = true));
      state.pinchLine.visible = true;
      console.log(`[HandInputManager] WebXR hand #${index} connected as ${handedness}`);
    });

    handGroup.addEventListener('disconnected', (event) => {
      const xrInputSource = event.data;
      const handedness: Handedness =
        xrInputSource && xrInputSource.handedness === 'left' ? 'left' : 'right';

      const state = handedness === 'left' ? this.leftHandState : this.rightHandState;
      state.isConnected = false;
      state.jointSpheres.forEach((sphere) => (sphere.visible = false));
      state.pinchLine.visible = false;
      console.log(`[HandInputManager] WebXR hand #${index} disconnected (${handedness})`);
    });
  }

  /**
   * Creates 3D visual representations for Desktop Simulator
   */
  private createDesktopSimulatorVisuals(): {
    leftRig: THREE.Group;
    rightRig: THREE.Group;
    reticle: THREE.Mesh;
  } {
    const leftRig = this.createSimHandRig('left');
    const rightRig = this.createSimHandRig('right');

    leftRig.position.set(-0.16, 1.05, -0.45);
    rightRig.position.set(0.16, 1.05, -0.45);

    // Projected target cursor reticle on the desk plane
    const reticleGeo = new THREE.RingGeometry(0.018, 0.024, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const reticle = new THREE.Mesh(reticleGeo, reticleMat);
    reticle.position.set(0, 1.05, -0.449);

    return { leftRig, rightRig, reticle };
  }

  /**
   * Helper to construct a bioluminescent virtual hand skeleton for desktop testing
   */
  private createSimHandRig(handedness: Handedness): THREE.Group {
    const group = new THREE.Group();
    group.name = `SimHandRig_${handedness}`;

    const jointMat = new THREE.MeshBasicMaterial({
      color: handedness === 'left' ? 0xa855f7 : 0x00f0ff,
      transparent: true,
      opacity: 0.85
    });

    const tipMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95
    });

    const boneMat = new THREE.LineBasicMaterial({
      color: handedness === 'left' ? 0xc084fc : 0x38bdf8,
      transparent: true,
      opacity: 0.5
    });

    // Node definitions relative to wrist (0, 0, 0)
    const sign = handedness === 'left' ? -1 : 1;
    const jointPositions: Record<string, THREE.Vector3> = {
      wrist: new THREE.Vector3(0, 0, 0),
      palm: new THREE.Vector3(0, 0.035, -0.015),
      thumb_base: new THREE.Vector3(sign * -0.02, 0.02, -0.005),
      thumb_mid: new THREE.Vector3(sign * -0.035, 0.04, -0.01),
      thumb_tip: new THREE.Vector3(sign * -0.03, 0.055, -0.01),
      index_base: new THREE.Vector3(sign * -0.015, 0.05, -0.02),
      index_mid: new THREE.Vector3(sign * -0.015, 0.07, -0.025),
      index_tip: new THREE.Vector3(sign * -0.01, 0.088, -0.025),
      middle_base: new THREE.Vector3(0, 0.052, -0.02),
      middle_mid: new THREE.Vector3(0, 0.074, -0.025),
      middle_tip: new THREE.Vector3(0, 0.095, -0.025),
      ring_base: new THREE.Vector3(sign * 0.015, 0.048, -0.018),
      ring_mid: new THREE.Vector3(sign * 0.015, 0.068, -0.022),
      ring_tip: new THREE.Vector3(sign * 0.015, 0.086, -0.022),
      pinky_base: new THREE.Vector3(sign * 0.028, 0.042, -0.015),
      pinky_mid: new THREE.Vector3(sign * 0.03, 0.058, -0.018),
      pinky_tip: new THREE.Vector3(sign * 0.032, 0.074, -0.018)
    };

    // Store joint meshes on userData
    group.userData.nodes = {};
    for (const [name, pos] of Object.entries(jointPositions)) {
      const isTip = name.endsWith('_tip');
      const isWrist = name === 'wrist';
      const radius = isWrist ? 0.012 : isTip ? 0.009 : 0.006;
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 8, 8),
        isTip ? tipMat.clone() : jointMat
      );
      sphere.position.copy(pos);
      sphere.name = name;
      group.add(sphere);
      group.userData.nodes[name] = sphere;
    }

    // Connective bones
    const bones = [
      ['wrist', 'palm'],
      ['wrist', 'thumb_base'],
      ['thumb_base', 'thumb_mid'],
      ['thumb_mid', 'thumb_tip'],
      ['palm', 'index_base'],
      ['index_base', 'index_mid'],
      ['index_mid', 'index_tip'],
      ['palm', 'middle_base'],
      ['middle_base', 'middle_mid'],
      ['middle_mid', 'middle_tip'],
      ['palm', 'ring_base'],
      ['ring_base', 'ring_mid'],
      ['ring_mid', 'ring_tip'],
      ['palm', 'pinky_base'],
      ['pinky_base', 'pinky_mid'],
      ['pinky_mid', 'pinky_tip']
    ];

    group.userData.boneLines = [];
    for (const [a, b] of bones) {
      const pA = jointPositions[a];
      const pB = jointPositions[b];
      const lineGeo = new THREE.BufferGeometry().setFromPoints([pA, pB]);
      const line = new THREE.Line(lineGeo, boneMat);
      group.add(line);
      group.userData.boneLines.push({ line, nameA: a, nameB: b });
    }

    // Pinch line between thumb and index tips
    const pinchLineGeo = new THREE.BufferGeometry().setFromPoints([
      jointPositions.thumb_tip,
      jointPositions.index_tip
    ]);
    const pinchLineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });
    const pinchLine = new THREE.Line(pinchLineGeo, pinchLineMat);
    group.add(pinchLine);
    group.userData.pinchLine = pinchLine;

    // Slight ergonomic rest tilt
    group.rotation.x = -Math.PI * 0.15;
    return group;
  }

  /**
   * Sets up Desktop Mouse and Keyboard controls
   */
  private setupDesktopControls(): void {
    const dom = this.renderer.domElement;

    // Prevent context menu on right click to allow smooth Right-Click Drag
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse movement: project onto the z = -0.45m desk zone plane
    dom.addEventListener('pointermove', (e: MouseEvent) => {
      if (this.isDemoModeActive && (Math.abs(e.movementX) > 4 || Math.abs(e.movementY) > 4)) {
        this.onUserInput?.();
      }

      this.mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouseNDC, this.camera);
      const intersection = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(this.deskTargetPlane, intersection);

      if (hit) {
        // Clamp to comfortable seated desk envelope (radius ~0.45m)
        intersection.x = THREE.MathUtils.clamp(intersection.x, -0.45, 0.45);
        intersection.y = THREE.MathUtils.clamp(intersection.y, 0.80, 1.35);
        this.simTargetPos.copy(intersection);

        // Dynamically assign active hand based on mouse horizontal side
        if (!this.simLeftPinchHeld && !this.simRightPinchHeld) {
          this.simActiveHand = intersection.x < 0 ? 'left' : 'right';
        }
      }
    });

    // Pointer down: Left Click = Left Pinch, Right Click = Right Pinch
    dom.addEventListener('pointerdown', (e: MouseEvent) => {
      if (this.isDemoModeActive) {
        this.onUserInput?.();
      }
      if (!this.isSimulatorActive) return;

      if (e.button === 0) {
        // Left Click -> Left Pinch
        this.simLeftPinchHeld = true;
        this.simActiveHand = 'left';
      } else if (e.button === 2) {
        // Right Click -> Right Pinch
        this.simRightPinchHeld = true;
        this.simActiveHand = 'right';
      }
    });

    // Pointer up
    dom.addEventListener('pointerup', (e: MouseEvent) => {
      if (!this.isSimulatorActive) return;

      if (e.button === 0) {
        this.simLeftPinchHeld = false;
      } else if (e.button === 2) {
        this.simRightPinchHeld = false;
      }
    });

    // Keyboard controls: Spacebar = Right Hand Pinch, 'O' = Toggle Open Palm, '1'/'2' = Hand Select
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.isDemoModeActive && e.key !== 'd' && e.key !== 'D') {
        this.onUserInput?.();
      }
      if (!this.isSimulatorActive) return;

      if (e.code === 'Space') {
        this.simRightPinchHeld = true;
        this.simActiveHand = 'right';
      } else if (e.key === 'o' || e.key === 'O') {
        this.simOpenPalmActive = !this.simOpenPalmActive;
        console.log(`[HandInputManager] Simulator Open Palm state: ${this.simOpenPalmActive}`);
      } else if (e.key === 'g' || e.key === 'G') {
        this.toggleGestureHoloCard();
      } else if (e.key === 't' || e.key === 'T') {
        this.toggleSimulatorConductor();
      } else if (e.key === 'b' || e.key === 'B') {
        this.emitChordBloom(this.simActiveHand, this.simTargetPos.clone());
      } else if (e.key === 'x' || e.key === 'X') {
        this.emitAcousticScissors(this.simActiveHand, this.simTargetPos.clone());
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      if (!this.isSimulatorActive) return;

      if (e.code === 'Space') {
        this.simRightPinchHeld = false;
      }
    });
  }

  /**
   * Main per-frame update loop called from animation loop
   */
  public update(deltaTime: number): void {
    const isXRPresenting = this.renderer.xr.isPresenting;
    this.isSimulatorActive = !isXRPresenting;

    if (isXRPresenting) {
      // 1. Process Native WebXR Hand Tracking
      this.simLeftHandRig.visible = false;
      this.simRightHandRig.visible = false;
      this.simCursorReticle.visible = false;

      this.updateWebXRHand(this.leftHandState);
      this.updateWebXRHand(this.rightHandState);
    } else {
      // 2. Process Desktop Simulator Fallback
      this.simLeftHandRig.visible = true;
      this.simRightHandRig.visible = true;
      this.simCursorReticle.visible = true;

      this.updateDesktopSimulator(deltaTime);
    }

    // Highlight desk zone if any hand is pinching or hovering
    const anyPinching = this.leftHandState.isPinching || this.rightHandState.isPinching;
    this.sceneManager.setDeskHighlight(anyPinching ? 1.0 : 0.2);

    // 3. Process Neural Gesture Vocabulary (Conductor Frame, Chord Bloom, Acoustic Scissors)
    this.updateNeuralGestures(deltaTime);
  }

  /**
   * Native WebXR Hand calculations (Euclidean Pinch & Open Palm)
   */
  private updateWebXRHand(state: HandInternalState): void {
    const handGroup = state.handGroup as any;
    if (!state.isConnected || !handGroup.joints) {
      return;
    }

    const joints = handGroup.joints;

    // 1. Update visual joint positions & collect key joint coordinates
    for (const jointName of XR_HAND_JOINTS) {
      const xrJoint = joints[jointName];
      const sphereMesh = state.jointSpheres.get(jointName);

      if (xrJoint && sphereMesh) {
        if (xrJoint.visible) {
          sphereMesh.visible = true;
          sphereMesh.position.copy(xrJoint.position);
          sphereMesh.quaternion.copy(xrJoint.quaternion);

          if (jointName === 'index-finger-tip') {
            xrJoint.getWorldPosition(state.indexTipPos);
          } else if (jointName === 'thumb-tip') {
            xrJoint.getWorldPosition(state.thumbTipPos);
          } else if (jointName === 'middle-finger-tip') {
            xrJoint.getWorldPosition(state.middleTipPos);
          } else if (jointName === 'pinky-finger-tip') {
            xrJoint.getWorldPosition(state.pinkyTipPos);
          } else if (jointName === 'wrist') {
            xrJoint.getWorldPosition(state.wristPos);
          }
        } else {
          sphereMesh.visible = false;
        }
      }
    }

    // 2. Reliable Euclidean Pinch Detector
    const pinchDist = state.indexTipPos.distanceTo(state.thumbTipPos);
    state.currentPinchDist = pinchDist;
    const midpoint = new THREE.Vector3()
      .addVectors(state.indexTipPos, state.thumbTipPos)
      .multiplyScalar(0.5);

    // Update dynamic pinch line
    const localIndexTip = state.jointSpheres.get('index-finger-tip')?.position;
    const localThumbTip = state.jointSpheres.get('thumb-tip')?.position;
    if (localIndexTip && localThumbTip) {
      const linePosAttr = state.pinchLine.geometry.attributes.position as THREE.BufferAttribute;
      linePosAttr.setXYZ(0, localIndexTip.x, localIndexTip.y, localIndexTip.z);
      linePosAttr.setXYZ(1, localThumbTip.x, localThumbTip.y, localThumbTip.z);
      linePosAttr.needsUpdate = true;
    }

    // Hysteresis threshold logic
    if (!state.isPinching && pinchDist < HandInputManager.PINCH_START_THRESHOLD) {
      state.isPinching = true;
      this.highlightJointsOnPinch(state, true);
      this.emitPinchStart(state.handedness, midpoint, pinchDist);
    } else if (state.isPinching) {
      this.emitPinchMove(state.handedness, midpoint, pinchDist);

      if (pinchDist > HandInputManager.PINCH_END_THRESHOLD) {
        state.isPinching = false;
        this.highlightJointsOnPinch(state, false);
        this.emitPinchEnd(state.handedness, midpoint, pinchDist);
      }
    }

    // 3. Open Palm / Stop Gesture Detection: all 5 fingertips > 0.09m from wrist
    const fingertips: XRHandJointName[] = [
      'thumb-tip',
      'index-finger-tip',
      'middle-finger-tip',
      'ring-finger-tip',
      'pinky-finger-tip'
    ];

    let allExtended = true;
    state.fingertipDistances = [];

    for (let i = 0; i < fingertips.length; i++) {
      const tipMesh = state.jointSpheres.get(fingertips[i]);
      if (tipMesh && tipMesh.visible) {
        const tipWorld = new THREE.Vector3();
        tipMesh.getWorldPosition(tipWorld);
        const dist = state.wristPos.distanceTo(tipWorld);
        state.fingertipDistances.push(dist);

        if (dist <= HandInputManager.OPEN_PALM_THRESHOLD) {
          allExtended = false;
        }
      } else {
        allExtended = false;
      }
    }

    if (allExtended && !state.isOpenPalm) {
      state.isOpenPalm = true;
      this.emitOpenPalmStart(state.handedness);
    } else if (state.isOpenPalm) {
      if (allExtended) {
        this.emitOpenPalmMove(state.handedness);
      } else {
        state.isOpenPalm = false;
        this.emitOpenPalmEnd(state.handedness);
      }
    }
  }

  /**
   * Programmatically positions and pinches a simulated hand rig for DemoDirector
   */
  public setSimHandPose(hand: Handedness, position: THREE.Vector3, isPinching: boolean): void {
    if (hand === 'left') {
      this.simLeftHandRig.position.copy(position);
      this.simLeftPinchHeld = isPinching;
    } else {
      this.simRightHandRig.position.copy(position);
      this.simRightPinchHeld = isPinching;
    }
  }

  /**
   * Sets the pinch state of a simulated hand rig for DemoDirector
   */
  public setSimPinch(hand: Handedness, isPinching: boolean): void {
    if (hand === 'left') {
      this.simLeftPinchHeld = isPinching;
    } else {
      this.simRightPinchHeld = isPinching;
    }
  }

  /**
   * Updates Desktop Simulator: animates simulated hands, pinch and gesture states
   */
  private updateDesktopSimulator(deltaTime: number): void {
    if (this.isDemoModeActive) {
      // In Demo Mode, DemoDirector drives simLeftHandRig and simRightHandRig positions & pinches
      this.simCursorReticle.visible = false;
      this.animateSimRig('left', this.simLeftHandRig, this.simLeftPinchHeld, this.leftHandState);
      this.animateSimRig('right', this.simRightHandRig, this.simRightPinchHeld, this.rightHandState);
      return;
    }
    this.simCursorReticle.visible = true;

    // Smooth cursor reticle motion
    this.simCursorReticle.position.lerp(this.simTargetPos, 0.25);

    // Active hand moves to target position
    const activeRig = this.simActiveHand === 'left' ? this.simLeftHandRig : this.simRightHandRig;
    const idleRig = this.simActiveHand === 'left' ? this.simRightHandRig : this.simLeftHandRig;

    // Follow mouse cursor
    activeRig.position.lerp(this.simTargetPos, 0.22);

    // Idle hand returns to gentle resting zone on comfort arc
    const idleTarget =
      this.simActiveHand === 'left'
        ? new THREE.Vector3(0.18, 1.03, -0.44)
        : new THREE.Vector3(-0.18, 1.03, -0.44);
    idleRig.position.lerp(idleTarget, 0.08);

    // Animate Left Hand simulation
    this.animateSimRig('left', this.simLeftHandRig, this.simLeftPinchHeld, this.leftHandState);

    // Animate Right Hand simulation
    this.animateSimRig('right', this.simRightHandRig, this.simRightPinchHeld, this.rightHandState);
  }

  /**
   * Animates procedural bones and evaluates gestures for the simulated hand rig
   */
  private animateSimRig(
    hand: Handedness,
    rig: THREE.Group,
    isPinchCommanded: boolean,
    state: HandInternalState
  ): void {
    const nodes = rig.userData.nodes;
    if (!nodes) return;

    const indexTip = nodes['index_tip'] as THREE.Mesh;
    const thumbTip = nodes['thumb_tip'] as THREE.Mesh;
    const wrist = nodes['wrist'] as THREE.Mesh;

    // 1. Pinch animation: index tip moves towards thumb tip
    const sign = hand === 'left' ? -1 : 1;
    const restIndexPos = new THREE.Vector3(sign * -0.01, 0.088, -0.025);
    const restThumbPos = new THREE.Vector3(sign * -0.03, 0.055, -0.01);

    // Pinched target position (fingertips touching at midpoint)
    const pinchTouchPos = new THREE.Vector3(sign * -0.022, 0.068, -0.015);

    if (isPinchCommanded) {
      indexTip.position.lerp(pinchTouchPos, 0.35);
      thumbTip.position.lerp(pinchTouchPos, 0.35);
    } else {
      indexTip.position.lerp(restIndexPos, 0.2);
      thumbTip.position.lerp(restThumbPos, 0.2);
    }

    // Open Palm gesture simulation: fingertips flare outward
    const tips = ['thumb_tip', 'index_tip', 'middle_tip', 'ring_tip', 'pinky_tip'];
    if (this.simOpenPalmActive) {
      // Flare fingers away from palm
      nodes['thumb_tip'].position.y = 0.07;
      nodes['index_tip'].position.y = 0.105;
      nodes['middle_tip'].position.y = 0.112;
      nodes['ring_tip'].position.y = 0.103;
      nodes['pinky_tip'].position.y = 0.092;
    }

    // Update connective bone lines
    const boneLines = rig.userData.boneLines;
    if (boneLines) {
      for (const { line, nameA, nameB } of boneLines) {
        const nodeA = nodes[nameA];
        const nodeB = nodes[nameB];
        if (nodeA && nodeB) {
          const attr = line.geometry.attributes.position as THREE.BufferAttribute;
          attr.setXYZ(0, nodeA.position.x, nodeA.position.y, nodeA.position.z);
          attr.setXYZ(1, nodeB.position.x, nodeB.position.y, nodeB.position.z);
          attr.needsUpdate = true;
        }
      }
    }

    // Update pinch line on sim hand
    const pinchLine = rig.userData.pinchLine as THREE.Line;
    if (pinchLine) {
      const pAttr = pinchLine.geometry.attributes.position as THREE.BufferAttribute;
      pAttr.setXYZ(0, indexTip.position.x, indexTip.position.y, indexTip.position.z);
      pAttr.setXYZ(1, thumbTip.position.x, thumbTip.position.y, thumbTip.position.z);
      pAttr.needsUpdate = true;
    }

    // 2. Measure world Euclidean distances
    const indexWorld = new THREE.Vector3();
    const thumbWorld = new THREE.Vector3();
    const middleWorld = new THREE.Vector3();
    const pinkyWorld = new THREE.Vector3();
    const wristWorld = new THREE.Vector3();

    indexTip.getWorldPosition(indexWorld);
    thumbTip.getWorldPosition(thumbWorld);
    wrist.getWorldPosition(wristWorld);

    const middleTip = nodes['middle_tip'] as THREE.Mesh;
    const pinkyTip = nodes['pinky_tip'] as THREE.Mesh;
    if (middleTip) {
      middleTip.getWorldPosition(middleWorld);
      state.middleTipPos.copy(middleWorld);
    }
    if (pinkyTip) {
      pinkyTip.getWorldPosition(pinkyWorld);
      state.pinkyTipPos.copy(pinkyWorld);
    }

    state.indexTipPos.copy(indexWorld);
    state.thumbTipPos.copy(thumbWorld);
    state.wristPos.copy(wristWorld);

    const dist = indexWorld.distanceTo(thumbWorld);
    state.currentPinchDist = dist;
    const midpoint = new THREE.Vector3().addVectors(indexWorld, thumbWorld).multiplyScalar(0.5);

    // Color feedback on tips and pinch line
    const isPinching = isPinchCommanded || dist < HandInputManager.PINCH_START_THRESHOLD;
    (indexTip.material as THREE.MeshBasicMaterial).color.setHex(isPinching ? 0x00ff88 : 0x00f0ff);
    (thumbTip.material as THREE.MeshBasicMaterial).color.setHex(isPinching ? 0xffd700 : 0x38bdf8);

    // 3. Trigger Pinch Events with Hysteresis
    if (!state.isPinching && dist < HandInputManager.PINCH_START_THRESHOLD) {
      state.isPinching = true;
      this.emitPinchStart(hand, midpoint, dist);
    } else if (state.isPinching) {
      this.emitPinchMove(hand, midpoint, dist);

      if (dist > HandInputManager.PINCH_END_THRESHOLD) {
        state.isPinching = false;
        this.emitPinchEnd(hand, midpoint, dist);
      }
    }

    // 4. Trigger Open Palm Gesture
    state.fingertipDistances = [];
    let allExtended = true;
    for (const tipName of tips) {
      const tipMesh = nodes[tipName] as THREE.Mesh;
      const tipW = new THREE.Vector3();
      tipMesh.getWorldPosition(tipW);
      const d = wristWorld.distanceTo(tipW);
      state.fingertipDistances.push(d);
      if (d <= HandInputManager.OPEN_PALM_THRESHOLD) {
        allExtended = false;
      }
    }

    if (allExtended && !state.isOpenPalm) {
      state.isOpenPalm = true;
      this.emitOpenPalmStart(hand);
    } else if (state.isOpenPalm) {
      if (allExtended) {
        this.emitOpenPalmMove(hand);
      } else {
        state.isOpenPalm = false;
        this.emitOpenPalmEnd(hand);
      }
    }
  }

  /**
   * Visual glowing response on joint spheres during pinch
   */
  private highlightJointsOnPinch(state: HandInternalState, isPinching: boolean): void {
    const indexMesh = state.jointSpheres.get('index-finger-tip');
    const thumbMesh = state.jointSpheres.get('thumb-tip');

    if (indexMesh) {
      (indexMesh.material as THREE.MeshBasicMaterial).color.setHex(
        isPinching ? 0x00ff88 : 0x00f0ff
      );
      indexMesh.scale.setScalar(isPinching ? 1.4 : 1.0);
    }

    if (thumbMesh) {
      (thumbMesh.material as THREE.MeshBasicMaterial).color.setHex(
        isPinching ? 0xffd700 : 0x38bdf8
      );
      thumbMesh.scale.setScalar(isPinching ? 1.4 : 1.0);
    }
  }

  // ----------------------------------------------------
  // Public Event Subscription API
  // ----------------------------------------------------

  public onPinchStart(cb: PinchCallback): void {
    this.pinchStartListeners.push(cb);
  }

  public onPinchMove(cb: PinchCallback): void {
    this.pinchMoveListeners.push(cb);
  }

  public onPinchEnd(cb: PinchCallback): void {
    this.pinchEndListeners.push(cb);
  }

  public onOpenPalmStart(cb: GestureCallback): void {
    this.openPalmStartListeners.push(cb);
  }

  public onOpenPalmMove(cb: GestureCallback): void {
    this.openPalmMoveListeners.push(cb);
  }

  public onOpenPalmEnd(cb: GestureCallback): void {
    this.openPalmEndListeners.push(cb);
  }

  private emitPinchStart(hand: Handedness, midpoint: THREE.Vector3, dist: number): void {
    for (const cb of this.pinchStartListeners) cb(hand, midpoint, dist);
  }

  private emitPinchMove(hand: Handedness, midpoint: THREE.Vector3, dist: number): void {
    for (const cb of this.pinchMoveListeners) cb(hand, midpoint, dist);
  }

  private emitPinchEnd(hand: Handedness, midpoint: THREE.Vector3, dist: number): void {
    for (const cb of this.pinchEndListeners) cb(hand, midpoint, dist);
  }

  private emitOpenPalmStart(hand: Handedness): void {
    for (const cb of this.openPalmStartListeners) cb(hand);
  }

  private emitOpenPalmMove(hand: Handedness): void {
    for (const cb of this.openPalmMoveListeners) cb(hand);
  }

  private emitOpenPalmEnd(hand: Handedness): void {
    for (const cb of this.openPalmEndListeners) cb(hand);
  }

  /**
   * Retrieves live telemetry data for UI HUD display
   */
  public getTelemetry(handedness: Handedness): HandTelemetry {
    const state = handedness === 'left' ? this.leftHandState : this.rightHandState;
    return {
      handedness,
      isTracked: this.isSimulatorActive || state.isConnected,
      pinchDistance: state.currentPinchDist,
      isPinching: state.isPinching,
      isOpenPalm: state.isOpenPalm,
      wristToFingerDistances: state.fingertipDistances,
      indexTipPosition: state.indexTipPos.clone(),
      thumbTipPosition: state.thumbTipPos.clone(),
      wristPosition: state.wristPos.clone(),
      middleTipPosition: state.middleTipPos.clone(),
      pinkyTipPosition: state.pinkyTipPos.clone()
    };
  }

  /**
   * Toggle simulator open palm for UI button
   */
  public toggleSimulatorOpenPalm(): boolean {
    this.simOpenPalmActive = !this.simOpenPalmActive;
    return this.simOpenPalmActive;
  }

  // ----------------------------------------------------
  // Phase 10: Neural Gesture Vocabulary & Time-Dilation Sculpting
  // ----------------------------------------------------

  public onConductorTempo(cb: ConductorTempoCallback): void {
    this.conductorTempoListeners.push(cb);
  }

  public onChordBloom(cb: ChordBloomCallback): void {
    this.chordBloomListeners.push(cb);
  }

  public onAcousticScissors(cb: AcousticScissorsCallback): void {
    this.acousticScissorsListeners.push(cb);
  }

  private emitConductorTempo(bpm: number): void {
    for (const cb of this.conductorTempoListeners) cb(bpm);
  }

  public emitChordBloom(hand: Handedness, position: THREE.Vector3): void {
    for (const cb of this.chordBloomListeners) cb(hand, position);
  }

  public emitAcousticScissors(hand: Handedness, cutPoint: THREE.Vector3): void {
    for (const cb of this.acousticScissorsListeners) cb(hand, cutPoint);
  }

  /**
   * Toggles the 3D Gesture Holo-Card tucked behind the left wrist
   */
  public toggleGestureHoloCard(): boolean {
    this.isHoloCardVisible = !this.isHoloCardVisible;
    this.holoCardGroup.visible = this.isHoloCardVisible;
    console.log(`[HandInputManager] 3D Gesture Holo-Card: ${this.isHoloCardVisible ? 'VISIBLE' : 'HIDDEN'}`);
    return this.isHoloCardVisible;
  }

  /**
   * Toggles Simulator Conductor Frame Mode
   */
  public toggleSimulatorConductor(): boolean {
    this.simConductorActive = !this.simConductorActive;
    console.log(`[HandInputManager] Simulator Conductor Frame: ${this.simConductorActive ? 'ON' : 'OFF'}`);
    return this.simConductorActive;
  }

  /**
   * Builds the Holographic Tempo Ribbon connecting both palms during Conductor Frame
   */
  private createTempoRibbonVisuals(): void {
    this.tempoRibbonGroup = new THREE.Group();
    this.tempoRibbonGroup.name = 'TempoRibbonGroup';

// [Chrono-Loom Milestone 25/33] test(hands): verify desktop simulator parity with WebXR hand tracking
