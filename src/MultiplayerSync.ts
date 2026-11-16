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
      transparent: true,
      opacity: 0.88
    });
    const torusRing = new THREE.Mesh(torusGeo, torusMat);
    torusRing.rotation.x = Math.PI * 0.5;
    this.headCrestGroup.add(torusRing);

    const crestLight = new THREE.PointLight(0xf43f5e, 1.4, 0.85);
    this.headCrestGroup.add(crestLight);

    // 3D Billboard text plate
    this.headCrestCanvas = document.createElement('canvas');
    this.headCrestCanvas.width = 512;
    this.headCrestCanvas.height = 140;
    this.headCrestTexture = new THREE.CanvasTexture(this.headCrestCanvas);
    this.headCrestTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.headCrestTexture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    this.headCrestSprite = new THREE.Sprite(spriteMat);
    this.headCrestSprite.scale.set(0.38, 0.104, 1);
    this.headCrestSprite.position.set(0, 0.16, 0);
    this.headCrestGroup.add(this.headCrestSprite);

    this.drawHeadCrestPlate('CO-WEAVER // GHOST PEER', '● 30Hz P2P SYNC');
  }

  private createGhostHand(hand: Handedness): GhostHandMesh {
    const group = new THREE.Group();
    group.name = `GhostHand_${hand}`;

    // Wrist Sphere
    const wristGeo = new THREE.SphereGeometry(0.013, 10, 10);
    const wristMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.5,
      transparent: true,
      opacity: 0.92
    });
    const wristMesh = new THREE.Mesh(wristGeo, wristMat);
    group.add(wristMesh);

    // Fingertip spheres (Thumb, Index, Middle, Ring, Pinky)
    const tipMeshes: THREE.Mesh[] = [];
    const tipGeo = new THREE.SphereGeometry(0.009, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0xfda4af,
      transparent: true,
      opacity: 0.95
    });

    const tipOffsets = [
      new THREE.Vector3(hand === 'left' ? -0.03 : 0.03, 0.045, -0.01),  // Thumb
      new THREE.Vector3(hand === 'left' ? -0.015 : 0.015, 0.075, -0.02), // Index
      new THREE.Vector3(0, 0.082, -0.022),                              // Middle
      new THREE.Vector3(hand === 'left' ? 0.015 : -0.015, 0.072, -0.018), // Ring
      new THREE.Vector3(hand === 'left' ? 0.03 : -0.03, 0.055, -0.015)   // Pinky
    ];

    const boneLines: THREE.Line[] = [];
    const boneMat = new THREE.LineBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0.7,
      linewidth: 2,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 5; i++) {
      const tipMesh = new THREE.Mesh(tipGeo, tipMat.clone());
      tipMesh.position.copy(tipOffsets[i]);
      group.add(tipMesh);
      tipMeshes.push(tipMesh);

      // Bone line linking wrist to tip
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        tipOffsets[i]
      ]);
      const line = new THREE.Line(lineGeo, boneMat);
      group.add(line);
      boneLines.push(line);
    }

    // Dynamic Pinch Laser Line (Thumb to Index)
    const pinchGeo = new THREE.BufferGeometry().setFromPoints([
      tipOffsets[0],
      tipOffsets[1]
    ]);
    const pinchMat = new THREE.LineBasicMaterial({
      color: 0xff0055,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const pinchLine = new THREE.Line(pinchGeo, pinchMat);
    pinchLine.visible = false;
    group.add(pinchLine);

    const glowLight = new THREE.PointLight(0xf43f5e, 1.2, 0.35);
    group.add(glowLight);

    return { group, wristMesh, tipMeshes, boneLines, pinchLine, glowLight };
  }

  private drawHeadCrestPlate(title: string, sub: string): void {
    const ctx = this.headCrestCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 140);

    // Glass backdrop
    ctx.fillStyle = 'rgba(7, 24, 45, 0.92)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 120, 20);
    ctx.fill();
    ctx.stroke();

    // Text Header
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 10;
    ctx.font = 'bold 26px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(title, 256, 56);

    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fb7185';
    ctx.fillText(sub, 256, 96);
    ctx.shadowBlur = 0;

    this.headCrestTexture.needsUpdate = true;
  }

  // ----------------------------------------------------
  // 2. BroadcastChannel (Instant Multi-Tab Local Testing)
  // ----------------------------------------------------

  private initBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;

// [Chrono-Loom Milestone 2/8] feat(multiplayer): configure WebRTC DataChannels with public STUN servers
