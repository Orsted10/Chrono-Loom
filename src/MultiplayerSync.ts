import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { LoomEngine, HarmonicNode, ChronoString } from './LoomEngine.js';
import { ConstellationMode } from './ConstellationMode.js';

export type JamRoomRole = 'SOLO' | 'HOST' | 'JOIN';
export type JamConnectionState = 'DISCONNECTED' | 'WAITING_PEER' | 'CONNECTING' | 'CONNECTED';

interface GhostHandMesh {
  group: THREE.Group;
  wristMesh: THREE.Mesh;
  tipMeshes: THREE.Mesh[];
  boneLines: THREE.Line[];
  pinchLine: THREE.Line;
  glowLight: THREE.PointLight;
}

export class MultiplayerSync {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private constellationMode: ConstellationMode;

  // Connection State
  public currentRole: JamRoomRole = 'SOLO';
  public connectionState: JamConnectionState = 'DISCONNECTED';
  public isConnected = false;
  public pingMs = 0;
  private lastPingSentTime = 0;

  // WebRTC PeerConnection & DataChannel
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Local BroadcastChannel fallback for instant multi-tab zero-config pairing
  private broadcastChannel: BroadcastChannel | null = null;
  private isUsingBroadcast = false;

  // 30Hz Heartbeat & Delta Compression
  private syncTimer: number | null = null;
  private readonly SYNC_FPS = 30;
  private lastSentNodePositions: Map<string, THREE.Vector3> = new Map();

  // 3D Ghost Avatar Visuals in Three.js
  public ghostAvatarGroup: THREE.Group;
  private leftGhostHand!: GhostHandMesh;
  private rightGhostHand!: GhostHandMesh;
  private headCrestGroup!: THREE.Group;
  private headCrestSprite!: THREE.Sprite;
  private headCrestCanvas!: HTMLCanvasElement;
  private headCrestTexture!: THREE.CanvasTexture;

  // Target interpolated positions for smooth 60/90fps rendering
  private remoteHeadTarget = new THREE.Vector3(0, 1.62, 0.45);
  private remoteLeftWristTarget = new THREE.Vector3(-0.2, 1.15, -0.4);
  private remoteRightWristTarget = new THREE.Vector3(0.2, 1.15, -0.4);
  private remoteLeftTipTarget = new THREE.Vector3(-0.2, 1.22, -0.45);
  private remoteRightTipTarget = new THREE.Vector3(0.2, 1.22, -0.45);
  private remoteLeftPinching = false;
  private remoteRightPinching = false;

  // DOM UI Elements
  private modalContainer: HTMLElement | null = null;
  private hudJamBtn: HTMLElement | null = null;
  private hudJamBadge: HTMLElement | null = null;

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    constellationMode: ConstellationMode
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.constellationMode = constellationMode;

    // 1. Root visual group for remote peer avatar
    this.ghostAvatarGroup = new THREE.Group();
    this.ghostAvatarGroup.name = 'RemoteGhostAvatar';
    this.ghostAvatarGroup.visible = false;
    this.sceneManager.scene.add(this.ghostAvatarGroup);

    // 2. Build 3D Ghost Hands & Head Crest
    this.createGhostAvatarVisuals();

    // 3. Initialize BroadcastChannel fallback
    this.initBroadcastChannel();

    // 4. Hook local LoomEngine events for delta transmission
    this.hookLoomEngineEvents();

    // 5. Hook Cooperative Constellation events
    this.hookConstellationEvents();

    // 6. Build sleek cyber DOM Modal dialog
    this.createModalUI();

    // 7. Check if URL contains WebRTC join hash (#jam=offer:...)
    this.checkUrlHashSignaling();

    console.log('[MultiplayerSync] Initialized Zero-Backend P2P Jam System (WebRTC + BroadcastChannel).');
  }

  // ----------------------------------------------------
  // 1. 3D Ghost Avatar Visuals (Ghost Hands + Head Crest)
  // ----------------------------------------------------

  private createGhostAvatarVisuals(): void {
    // A. Left & Right 3D Ghost Hands
    this.leftGhostHand = this.createGhostHand('left');
    this.rightGhostHand = this.createGhostHand('right');
    this.ghostAvatarGroup.add(this.leftGhostHand.group);
    this.ghostAvatarGroup.add(this.rightGhostHand.group);

    // B. Floating Head Crest Hologram
    this.headCrestGroup = new THREE.Group();
    this.headCrestGroup.name = 'RemoteHeadCrest';
    this.ghostAvatarGroup.add(this.headCrestGroup);

    // Geometric ethereal hex-ring diadem
    const hexGeo = new THREE.RingGeometry(0.11, 0.125, 6);
    const hexMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e, // Radiant Rose
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const hexRing = new THREE.Mesh(hexGeo, hexMat);
    this.headCrestGroup.add(hexRing);

    const torusGeo = new THREE.TorusGeometry(0.082, 0.005, 8, 32);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xfb7185,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,

// [Chrono-Loom Milestone 1/8] feat(multiplayer): initialize MultiplayerSync.ts for zero-backend P2P jam rooms
