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

    this.broadcastChannel = new BroadcastChannel('chrono_loom_p2p_jam');
    this.broadcastChannel.onmessage = (event) => {
      this.handleIncomingData(event.data, true);
    };
  }

  // ----------------------------------------------------
  // 3. WebRTC DataChannel Cross-Device Handshake
  // ----------------------------------------------------

  public async startHosting(): Promise<string> {
    this.currentRole = 'HOST';
    this.connectionState = 'WAITING_PEER';
    this.updateHUDStatus();

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Create reliable low-latency DataChannel
    this.dataChannel = this.peerConnection.createDataChannel('chrono-loom-sync', {
      ordered: false,
      maxRetransmits: 0 // Ultra-fast UDP-like behavior for VR 30Hz
    });

    this.setupDataChannel(this.dataChannel);

    // Create Offer
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Await ICE candidates to bundle into one single complete self-contained code
    const completeOffer = await this.waitForIceGatheringComplete(this.peerConnection);
    const offerCode = btoa(JSON.stringify(completeOffer || offer));

    // Also announce presence on BroadcastChannel for instant local pairing
    this.broadcastChannel?.postMessage({ type: 'CHRONO_LOOM_HOST_HELLO' });

    console.log('[MultiplayerSync] Host initialized. Offer code generated.');
    return offerCode;
  }

  public async joinWithOffer(offerCode: string): Promise<string> {
    this.currentRole = 'JOIN';
    this.connectionState = 'CONNECTING';
    this.updateHUDStatus();

    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel(this.dataChannel);
    };

    const offer = JSON.parse(atob(offerCode.trim()));
    await this.peerConnection.setRemoteDescription(offer);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    const completeAnswer = await this.waitForIceGatheringComplete(this.peerConnection);
    const answerCode = btoa(JSON.stringify(completeAnswer || answer));

    console.log('[MultiplayerSync] Joiner initialized. Answer code generated.');
    return answerCode;
  }

  public async finalizeHostWithAnswer(answerCode: string): Promise<void> {
    if (!this.peerConnection) return;
    const answer = JSON.parse(atob(answerCode.trim()));
    await this.peerConnection.setRemoteDescription(answer);
    console.log('[MultiplayerSync] Host accepted joiner answer. Handshake finalizing.');
  }

  public instantLocalMultiTabConnect(): void {
    if (!this.broadcastChannel) return;

    if (this.currentRole === 'SOLO') {
      // Act as Host
      this.currentRole = 'HOST';
      this.connectionState = 'WAITING_PEER';
      this.isUsingBroadcast = true;
      this.updateHUDStatus();
      this.broadcastChannel.postMessage({ type: 'CHRONO_LOOM_HOST_HELLO' });
      this.loomEngine.showHolographicToast('⚡ LOCAL JAM HOST READY', 'OPEN A 2ND BROWSER TAB TO PAIR INSTANTLY', 3.5);
    } else {
      // Announce join request
      this.broadcastChannel.postMessage({ type: 'CHRONO_LOOM_JOIN_REQUEST' });
    }
  }

  private waitForIceGatheringComplete(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit | null> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve(pc.localDescription);
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve(pc.localDescription);
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // Fallback timeout after 1.8 seconds so user never hangs
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve(pc.localDescription);
      }, 1800);
    });
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    channel.onopen = () => {
      this.onConnectionEstablished(false);
    };

    channel.onclose = () => {
      this.onConnectionClosed();
    };

    channel.onerror = (err) => {
      console.warn('[MultiplayerSync] DataChannel Error:', err);
    };

    channel.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data);
        this.handleIncomingData(packet, false);
      } catch (e) {
        console.warn('[MultiplayerSync] Malformed packet:', e);
      }
    };
  }

  private onConnectionEstablished(isBroadcast: boolean): void {
    this.isConnected = true;
    this.isUsingBroadcast = isBroadcast;
    this.connectionState = 'CONNECTED';
    this.ghostAvatarGroup.visible = true;
    this.constellationMode.isCoopMultiplayer = true;

    this.updateHUDStatus();
    this.start30HzSync();

    // If host, transmit full state snapshot to joiner immediately
    if (this.currentRole === 'HOST') {
      const snapshot = this.loomEngine.getLoomSnapshot();
      this.sendPacket({ type: 'SNAPSHOT_RES', snapshot });
    }

    this.loomEngine.showHolographicToast(
      '🌐 JAM ROOM CONNECTED!',
      isBroadcast ? 'Local P2P Broadcast Channel Active (30Hz)' : 'WebRTC Direct DataChannel Active (30Hz)',
      4.0
    );
    console.log(`[MultiplayerSync] P2P Connected via ${isBroadcast ? 'BroadcastChannel' : 'WebRTC'}!`);
  }

  private onConnectionClosed(): void {
    this.isConnected = false;
    this.connectionState = 'DISCONNECTED';
    this.ghostAvatarGroup.visible = false;
    this.constellationMode.isCoopMultiplayer = false;
    this.stop30HzSync();
    this.updateHUDStatus();
    console.log('[MultiplayerSync] P2P Disconnected.');
  }

  public disconnect(): void {
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'CHRONO_LOOM_DISCONNECT' });
    }
    this.currentRole = 'SOLO';
    this.onConnectionClosed();
  }

  // ----------------------------------------------------
  // 4. 30Hz Sync Loop & Delta Compression
  // ----------------------------------------------------

  private start30HzSync(): void {
    this.stop30HzSync();
    const intervalMs = Math.round(1000 / this.SYNC_FPS);

    this.syncTimer = window.setInterval(() => {
      this.broadcastFrameUpdate();
    }, intervalMs);
  }

  private stop30HzSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private broadcastFrameUpdate(): void {
    if (!this.isConnected) return;

    // 1. Gather local camera head pose
    const head = this.sceneManager.camera.position;

    // 2. Gather local hands telemetry
    const lTele = this.handInputManager.getTelemetry('left');
    const rTele = this.handInputManager.getTelemetry('right');

    // 3. Delta Compression for Harmonic Nodes:
    // Only send nodes that have moved > 2mm since last transmission!
    const movedNodes: [string, number, number, number][] = [];
    for (const node of this.loomEngine.nodes.values()) {
      const pos = node.position;
      const last = this.lastSentNodePositions.get(node.id);
      if (!last || last.distanceTo(pos) > 0.002) {
        movedNodes.push([
          node.id,
          Math.round(pos.x * 1000) / 1000,
          Math.round(pos.y * 1000) / 1000,
          Math.round(pos.z * 1000) / 1000
        ]);
        if (!last) {
          this.lastSentNodePositions.set(node.id, pos.clone());
        } else {
          last.copy(pos);
        }
      }
    }

    const framePacket = {
      type: 'FRAME',
      head: [Math.round(head.x * 1000) / 1000, Math.round(head.y * 1000) / 1000, Math.round(head.z * 1000) / 1000],
      lh: [
        Math.round(lTele.wristPosition.x * 1000) / 1000,
        Math.round(lTele.wristPosition.y * 1000) / 1000,
        Math.round(lTele.wristPosition.z * 1000) / 1000,
        lTele.isPinching ? 1 : 0,
        Math.round(lTele.pinchDistance * 1000) / 1000,
        lTele.isOpenPalm ? 1 : 0
      ],
      rh: [
        Math.round(rTele.wristPosition.x * 1000) / 1000,
        Math.round(rTele.wristPosition.y * 1000) / 1000,
        Math.round(rTele.wristPosition.z * 1000) / 1000,
        rTele.isPinching ? 1 : 0,
        Math.round(rTele.pinchDistance * 1000) / 1000,
        rTele.isOpenPalm ? 1 : 0
      ],
      mn: movedNodes.length > 0 ? movedNodes : undefined,
      t: performance.now()
    };

    this.sendPacket(framePacket);
  }

  public sendPacket(packet: any): void {
    const json = JSON.stringify(packet);

    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(json);
    } else if (this.isUsingBroadcast && this.broadcastChannel) {
      this.broadcastChannel.postMessage(packet);
    }
  }

  // ----------------------------------------------------
  // 5. Incoming Packet Dispatcher
  // ----------------------------------------------------

  private handleIncomingData(packet: any, isFromBroadcast: boolean): void {
    if (!packet || !packet.type) return;

    // Presence handshake messages for BroadcastChannel
    if (isFromBroadcast) {
      if (packet.type === 'CHRONO_LOOM_HOST_HELLO') {
        if (this.currentRole === 'SOLO' || this.currentRole === 'JOIN') {
          this.currentRole = 'JOIN';
          this.broadcastChannel?.postMessage({ type: 'CHRONO_LOOM_JOIN_REQUEST' });
        }
        return;
      } else if (packet.type === 'CHRONO_LOOM_JOIN_REQUEST') {
        if (this.currentRole === 'HOST') {
          this.broadcastChannel?.postMessage({
            type: 'CHRONO_LOOM_JOIN_ACCEPT',
            snapshot: this.loomEngine.getLoomSnapshot()
          });
          if (!this.isConnected) this.onConnectionEstablished(true);
        }
        return;
      } else if (packet.type === 'CHRONO_LOOM_JOIN_ACCEPT') {
        if (this.currentRole === 'JOIN' && !this.isConnected) {
          this.onConnectionEstablished(true);
          if (packet.snapshot) {
            this.loomEngine.applyLoomSnapshot(packet.snapshot);
          }
        }
        return;
      } else if (packet.type === 'CHRONO_LOOM_DISCONNECT') {
        this.onConnectionClosed();
        return;
      }
    }

    switch (packet.type) {
      case 'FRAME': {
        // Compute round-trip ping
        if (packet.t) {
          const now = performance.now();
          this.pingMs = Math.max(1, Math.round((now - packet.t) * 0.5));
        }

        // Remote Head Target
        if (packet.head) {
          this.remoteHeadTarget.set(packet.head[0], packet.head[1], packet.head[2]);
        }

        // Remote Left Hand Target
        if (packet.lh) {
          this.remoteLeftWristTarget.set(packet.lh[0], packet.lh[1], packet.lh[2]);
          this.remoteLeftPinching = packet.lh[3] === 1;
        }

        // Remote Right Hand Target
        if (packet.rh) {
          this.remoteRightWristTarget.set(packet.rh[0], packet.rh[1], packet.rh[2]);
          this.remoteRightPinching = packet.rh[3] === 1;
        }

        // Delta-compressed moved nodes
        if (packet.mn && Array.isArray(packet.mn)) {
          for (const [id, x, y, z] of packet.mn) {
            this.loomEngine.applyRemoteNodeMove(id, new THREE.Vector3(x, y, z));
          }
        }
        break;
      }

      case 'NODE_SPAWN':
        this.loomEngine.applyRemoteNodeSpawn(
          packet.id,
          new THREE.Vector3(packet.pos[0], packet.pos[1], packet.pos[2]),
          packet.freq
        );
        break;

      case 'NODE_MOVE':
        this.loomEngine.applyRemoteNodeMove(
          packet.id,
          new THREE.Vector3(packet.pos[0], packet.pos[1], packet.pos[2])
        );
        break;

      case 'STR_WEAVE':
        this.loomEngine.applyRemoteStringWeave(packet.id, packet.nodeA, packet.nodeB);
        break;

      case 'STR_PLUCK':
        this.loomEngine.applyRemoteStringPluck(
          packet.id,
          packet.pos ? new THREE.Vector3(packet.pos[0], packet.pos[1], packet.pos[2]) : undefined,
          packet.vel || 1.0
        );
        break;

      case 'STR_SEVER':
        this.loomEngine.applyRemoteStringSever(
          new THREE.Vector3(packet.cutPoint[0], packet.cutPoint[1], packet.cutPoint[2]),
          packet.stringId
        );
        break;

      case 'BPM_SYNC':
        this.loomEngine.applyRemoteBPM(packet.bpm);
        break;

      case 'RING_HIT':
        this.constellationMode.applyRemoteRingHit(packet.ringId);
        break;

      case 'SUPERNOVA':
        this.constellationMode.applyRemoteHarmonizedCoop();
        break;

      case 'SNAPSHOT_RES':
        if (packet.snapshot) {
          this.loomEngine.applyLoomSnapshot(packet.snapshot);
        }
        break;
    }
  }

  // ----------------------------------------------------
  // 6. Hook LoomEngine & Constellation Events
  // ----------------------------------------------------

  private hookLoomEngineEvents(): void {
    this.loomEngine.onNodeCreated = (node) => {
      if (!this.isConnected) return;
      this.sendPacket({
        type: 'NODE_SPAWN',
        id: node.id,
        pos: [Math.round(node.position.x * 1000) / 1000, Math.round(node.position.y * 1000) / 1000, Math.round(node.position.z * 1000) / 1000],
        freq: Math.round(node.noteFrequency * 10) / 10
      });
    };

    this.loomEngine.onStringCreated = (str) => {
      if (!this.isConnected) return;
      this.sendPacket({
        type: 'STR_WEAVE',
        id: str.id,
        nodeA: str.nodeA.id,
        nodeB: str.nodeB.id
      });
    };

    this.loomEngine.onStringPlucked = (stringId, pos, vel) => {
      if (!this.isConnected) return;
      this.sendPacket({
        type: 'STR_PLUCK',
        id: stringId,
        pos: [Math.round(pos.x * 1000) / 1000, Math.round(pos.y * 1000) / 1000, Math.round(pos.z * 1000) / 1000],
        vel: Math.round(vel * 100) / 100
      });
    };

    this.loomEngine.onStringSevered = (cutPoint, stringId) => {
      if (!this.isConnected) return;
      this.sendPacket({
        type: 'STR_SEVER',
        cutPoint: [Math.round(cutPoint.x * 1000) / 1000, Math.round(cutPoint.y * 1000) / 1000, Math.round(cutPoint.z * 1000) / 1000],
        stringId
      });
    };

    this.loomEngine.onBPMChanged = (bpm) => {
      if (!this.isConnected) return;
      this.sendPacket({ type: 'BPM_SYNC', bpm });
    };
  }

  private hookConstellationEvents(): void {
    this.constellationMode.onRingHit = (ringId) => {
      if (!this.isConnected) return;
      this.sendPacket({ type: 'RING_HIT', ringId });
    };

    this.constellationMode.onHarmonizedCoop = () => {
      if (!this.isConnected) return;
      this.sendPacket({ type: 'SUPERNOVA', val: true });
    };
  }

  // ----------------------------------------------------
  // 7. Per-Frame Render Update (Lerp 60/90fps interpolation)
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    if (!this.isConnected) {
      this.ghostAvatarGroup.visible = false;
      return;
    }

    this.ghostAvatarGroup.visible = true;

    // Smooth lerp transforms (0.28 factor eliminates network jitter)
    this.headCrestGroup.position.lerp(this.remoteHeadTarget, 0.28);
    this.leftGhostHand.group.position.lerp(this.remoteLeftWristTarget, 0.28);
    this.rightGhostHand.group.position.lerp(this.remoteRightWristTarget, 0.28);

    // Dynamic pinch laser visibility & light response
    this.leftGhostHand.pinchLine.visible = this.remoteLeftPinching;
    this.rightGhostHand.pinchLine.visible = this.remoteRightPinching;
    this.leftGhostHand.glowLight.intensity = this.remoteLeftPinching ? 2.5 : 1.1;
    this.rightGhostHand.glowLight.intensity = this.remoteRightPinching ? 2.5 : 1.1;

    // Subtle breathing rotation on Head Crest
    this.headCrestGroup.rotation.y += 0.02;
    this.headCrestSprite.lookAt(this.sceneManager.camera.position);

    // Periodically refresh ping readout
    if (Math.random() < 0.03) {
      const pingText = `● 30Hz P2P SYNC | ${this.pingMs}ms`;
      this.drawHeadCrestPlate('CO-WEAVER // GHOST PEER', pingText);
    }
  }

  // ----------------------------------------------------
  // 8. Cyber Modal UI & HUD Bindings
  // ----------------------------------------------------

  public setHUDElements(jamBtn: HTMLElement | null, jamBadge: HTMLElement | null): void {
    this.hudJamBtn = jamBtn;
    this.hudJamBadge = jamBadge;
    this.updateHUDStatus();

    if (this.hudJamBtn) {
      this.hudJamBtn.addEventListener('click', () => {
        this.toggleModal();
      });
    }
  }

  private updateHUDStatus(): void {
    if (this.hudJamBadge) {
      if (this.isConnected) {
        this.hudJamBadge.className = 'badge badge-rose';
        this.hudJamBadge.textContent = `JAM: CONNECTED (${this.isUsingBroadcast ? 'LOCAL' : 'WEBRTC'} 30Hz)`;
      } else if (this.connectionState === 'WAITING_PEER') {
        this.hudJamBadge.className = 'badge badge-gold';
        this.hudJamBadge.textContent = 'JAM: HOSTING (WAITING)';
      } else if (this.connectionState === 'CONNECTING') {
        this.hudJamBadge.className = 'badge badge-cyan';
        this.hudJamBadge.textContent = 'JAM: CONNECTING...';
      } else {
        this.hudJamBadge.className = 'badge badge-cyan';
        this.hudJamBadge.textContent = 'JAM: SOLO';
      }
    }

    if (this.hudJamBtn) {
      this.hudJamBtn.textContent = this.isConnected
        ? 'Jam Room: P2P Active [J]'
        : this.currentRole === 'HOST'
        ? 'Jam Room: Hosting [J]'
        : 'Jam Room: Solo [J]';
      this.hudJamBtn.classList.toggle('active', this.isConnected);
    }
  }

  public toggleModal(): void {
    if (!this.modalContainer) return;
    const isVisible = this.modalContainer.style.display === 'flex';
    this.modalContainer.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      this.refreshModalContent();
    }
  }

  private createModalUI(): void {
    const modal = document.createElement('div');
    modal.id = 'jam-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(4, 9, 20, 0.85);
      backdrop-filter: blur(12px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: 'Space Grotesk', sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: rgba(7, 24, 45, 0.95);
        border: 2px solid #f43f5e;
        box-shadow: 0 0 35px rgba(244, 63, 94, 0.35);
        border-radius: 20px;
        width: 90%;
        max-width: 580px;
        padding: 26px 30px;
        color: #f8fafc;
        position: relative;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(244,63,94,0.3); padding-bottom: 14px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              <span style="color: #f43f5e;">⚡</span> ZERO-BACKEND P2P MULTIPLAYER JAM
            </div>
            <div style="font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #fb7185; margin-top: 3px;">
              WEBRTC DATACHANNELS // 30HZ DELTA SYNC // NO SERVER REQUIRED
            </div>
          </div>
          <button id="close-jam-modal-btn" style="background: none; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
        </div>

        <div id="jam-modal-body"></div>
      </div>
    `;

    document.body.appendChild(modal);
    this.modalContainer = modal;

    const closeBtn = modal.querySelector('#close-jam-modal-btn');
    closeBtn?.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    window.addEventListener('keydown', (e) => {
      if ((e.key === 'j' || e.key === 'J') && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        this.toggleModal();
      } else if (e.key === 'Escape' && modal.style.display === 'flex') {
        modal.style.display = 'none';
      }
    });
  }

  private refreshModalContent(): void {
    const body = document.getElementById('jam-modal-body');
    if (!body) return;

    if (this.isConnected) {
      body.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 38px; margin-bottom: 10px;">🌐</div>
          <div style="font-size: 20px; font-weight: 700; color: #34d399;">CONNECTED WITH CO-WEAVER!</div>
          <div style="font-size: 13px; font-family: 'JetBrains Mono', monospace; color: #94a3b8; margin: 8px 0 20px;">
            Transport: <strong style="color: #fb7185;">${this.isUsingBroadcast ? 'Local P2P BroadcastChannel' : 'WebRTC DataChannel'}</strong><br/>
            Rate: <strong>30Hz Delta-Compressed</strong> | Ping: <strong>${this.pingMs}ms</strong>
          </div>
          <button id="disconnect-jam-btn" style="
            background: rgba(239, 68, 68, 0.2);
            border: 1px solid #ef4444;
            color: #fca5a5;
            font-weight: 700;
            padding: 10px 24px;
            border-radius: 10px;
            cursor: pointer;
          ">DISCONNECT / RETURN TO SOLO</button>
        </div>
      `;

      body.querySelector('#disconnect-jam-btn')?.addEventListener('click', () => {
        this.disconnect();
        this.refreshModalContent();
      });
      return;
    }

    body.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Option 1: Instant Local Multi-Tab Jam -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 14px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
            <span>⚡</span> Instant Local Multi-Tab Jam
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; margin: 4px 0 10px;">
            Pairs instantly between two browser tabs or windows on this computer. Zero setup, zero copy-paste!
          </div>
          <button id="local-pair-jam-btn" style="
            background: linear-gradient(135deg, rgba(0, 240, 255, 0.25), rgba(56, 189, 248, 0.15));
            border: 1px solid #00f0ff;
            color: #00f0ff;
            font-weight: 700;
            padding: 9px 18px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
          ">⚡ PAIR INSTANT MULTI-TAB JAM</button>
        </div>

        <!-- Option 2: Cross-Device WebRTC Host -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 14px; font-weight: 700; color: #f43f5e; display: flex; align-items: center; gap: 6px;">
            <span>👑</span> Host Cross-Device WebRTC Jam
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; margin: 4px 0 10px;">
            Create a room invite code to co-weave with a friend on another headset or PC across the internet.
          </div>
          <div id="host-controls">
            <button id="create-host-btn" style="
              background: linear-gradient(135deg, rgba(244, 63, 94, 0.25), rgba(251, 113, 133, 0.15));
              border: 1px solid #f43f5e;
              color: #fb7185;
              font-weight: 700;
              padding: 9px 18px;
              border-radius: 8px;
              cursor: pointer;
              font-size: 12px;
            ">👑 GENERATE HOST INVITE CODE</button>
          </div>
        </div>

        <!-- Option 3: Join WebRTC Host -->
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 14px 18px;">
          <div style="font-size: 14px; font-weight: 700; color: #fbbf24; display: flex; align-items: center; gap: 6px;">
            <span>🔗</span> Join Cross-Device WebRTC Jam
          </div>
          <div style="font-size: 11.5px; color: #94a3b8; margin: 4px 0 8px;">
            Paste your friend's Host Invite Code below:
          </div>
          <div style="display: flex; gap: 8px;">
            <input id="join-invite-input" placeholder="Paste Base64 Host Code here..." style="
              flex: 1;
              background: rgba(3, 7, 18, 0.8);
              border: 1px solid rgba(245, 158, 11, 0.4);
              border-radius: 6px;
              padding: 8px 12px;
              color: #fff;
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
            "/>
            <button id="connect-join-btn" style="
              background: rgba(245, 158, 11, 0.2);
              border: 1px solid #fbbf24;
              color: #fbbf24;
              font-weight: 700;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 12px;
            ">CONNECT</button>
          </div>
          <div id="join-answer-box" style="margin-top: 10px; display: none;"></div>
        </div>
      </div>
    `;

    // Hook Local Pair
    body.querySelector('#local-pair-jam-btn')?.addEventListener('click', () => {
      this.instantLocalMultiTabConnect();
      this.refreshModalContent();
    });

    // Hook Host Generation
    body.querySelector('#create-host-btn')?.addEventListener('click', async () => {
      const hostControls = body.querySelector('#host-controls');
      if (hostControls) {
        hostControls.innerHTML = `<div style="font-size: 12px; color: #fb7185;">Generating WebRTC STUN Offer...</div>`;
      }
      try {
        const code = await this.startHosting();
        if (hostControls) {
          hostControls.innerHTML = `
            <div style="margin-top: 6px;">
              <textarea readonly style="
                width: 100%;
                height: 55px;
                background: rgba(3, 7, 18, 0.85);
                border: 1px solid #f43f5e;
                border-radius: 6px;
                padding: 6px;
                color: #fca5a5;
                font-family: 'JetBrains Mono', monospace;
                font-size: 9.5px;
                resize: none;
              ">${code}</textarea>
              <div style="display: flex; gap: 8px; margin-top: 6px;">
                <button id="copy-host-code-btn" style="
                  background: rgba(244, 63, 94, 0.2);
                  border: 1px solid #f43f5e;
                  color: #fb7185;
                  font-weight: 700;
                  padding: 6px 14px;
                  border-radius: 6px;
                  cursor: pointer;
                  font-size: 11px;
                ">COPY CODE</button>
              </div>
              <div style="margin-top: 12px;">
                <div style="font-size: 11.5px; color: #94a3b8; margin-bottom: 4px;">Paste Joiner Answer Code below to finish:</div>
                <div style="display: flex; gap: 8px;">
                  <input id="host-answer-input" placeholder="Paste Joiner Answer Code..." style="
                    flex: 1;
                    background: rgba(3, 7, 18, 0.8);
                    border: 1px solid rgba(244, 63, 94, 0.4);
                    border-radius: 6px;
                    padding: 6px 10px;
                    color: #fff;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 11px;
                  "/>
                  <button id="host-finalize-btn" style="
                    background: rgba(52, 211, 153, 0.2);
                    border: 1px solid #34d399;
                    color: #34d399;
                    font-weight: 700;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 11px;
                  ">ACCEPT</button>
                </div>
              </div>
            </div>
          `;

          body.querySelector('#copy-host-code-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(code);
            this.loomEngine.showHolographicToast('📋 HOST CODE COPIED!', 'Send this to your friend to join.');
          });

          body.querySelector('#host-finalize-btn')?.addEventListener('click', async () => {
            const ansInput = body.querySelector('#host-answer-input') as HTMLInputElement;
            if (ansInput && ansInput.value.trim()) {
              await this.finalizeHostWithAnswer(ansInput.value.trim());
              this.loomEngine.showHolographicToast('⚡ FINALIZING PEER CONNECTION...', 'Waiting for DataChannel open.');
            }
          });
        }
      } catch (err) {
        console.error('[MultiplayerSync] Failed to host:', err);
      }
    });

    // Hook Joiner Connect
    body.querySelector('#connect-join-btn')?.addEventListener('click', async () => {
      const input = body.querySelector('#join-invite-input') as HTMLInputElement;
      const val = input ? input.value.trim() : '';
      if (!val) return;

      const answerBox = body.querySelector('#join-answer-box') as HTMLElement;
      if (answerBox) {
        answerBox.style.display = 'block';
        answerBox.innerHTML = `<div style="font-size: 12px; color: #fbbf24;">Connecting & Generating Answer...</div>`;
      }

      try {
        const answerCode = await this.joinWithOffer(val);
        if (answerBox) {
          answerBox.innerHTML = `
            <div style="font-size: 11.5px; color: #34d399; font-weight: 700; margin-bottom: 4px;">
              ✓ Answer Code Generated! Send this back to Host:
            </div>
            <textarea readonly style="
              width: 100%;
              height: 55px;
              background: rgba(3, 7, 18, 0.85);
              border: 1px solid #34d399;
              border-radius: 6px;
              padding: 6px;
              color: #a7f3d0;
              font-family: 'JetBrains Mono', monospace;
              font-size: 9.5px;
              resize: none;
            ">${answerCode}</textarea>
            <button id="copy-answer-btn" style="
              margin-top: 6px;
              background: rgba(52, 211, 153, 0.2);
              border: 1px solid #34d399;
              color: #34d399;
              font-weight: 700;
              padding: 6px 14px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
            ">COPY ANSWER CODE</button>
          `;

          body.querySelector('#copy-answer-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(answerCode);
            this.loomEngine.showHolographicToast('📋 ANSWER CODE COPIED!', 'Send this back to the Host.');
          });
        }
      } catch (err) {
        console.error('[MultiplayerSync] Failed to join:', err);
        if (answerBox) {
          answerBox.innerHTML = `<div style="font-size: 12px; color: #ef4444;">Connection failed. Invalid Host Code.</div>`;
        }
      }
    });
  }

  // ----------------------------------------------------
  // 9. URL Hash Signaling (#jam=offer:...)
  // ----------------------------------------------------

  private checkUrlHashSignaling(): void {
    const hash = window.location.hash;
    if (hash.startsWith('#jam=offer:')) {
      const code = hash.replace('#jam=offer:', '');
      setTimeout(() => {
        this.toggleModal();
        const input = document.getElementById('join-invite-input') as HTMLInputElement;
        if (input) {
          input.value = code;
        }
      }, 800);
    }
  }
}
