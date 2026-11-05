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
    loomEngine: LoomEngine,
    spatialSynth: SpatialSynth
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.spatialSynth = spatialSynth;

    this.ariaGroup = new THREE.Group();
    this.ariaGroup.name = 'AgentAria';
    this.ariaGroup.position.copy(this.homePosition);

    // 1. Core Pulsing Orb
    const coreGeo = new THREE.IcosahedronGeometry(0.032, 2);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xa855f7, // Royal Purple
      emissive: 0x7c3aed,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
      transmission: 0.5,
      ior: 1.45,
      transparent: true,
      opacity: 0.95
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.ariaGroup.add(this.coreMesh);

    // 2. Three Counter-Rotating Glowing Rings
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff, // Electric Cyan
      wireframe: false,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xa855f7, // Neon Magenta
      wireframe: false,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0xffd700, // Warm Gold
      wireframe: false,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0022, 16, 48), ringMat1);
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0022, 16, 48), ringMat2);
    this.ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.070, 0.0022, 16, 48), ringMat3);

    this.ariaGroup.add(this.ring1);
    this.ariaGroup.add(this.ring2);
    this.ariaGroup.add(this.ring3);

    // 3. Aria Inner Glow Light
    this.coreGlowLight = new THREE.PointLight(0xa855f7, 1.8, 1.4);
    this.ariaGroup.add(this.coreGlowLight);

    // 4. High-Dynamic Neon Glow Halos (Dual-layer additive blended sprites)
    const auraTex = this.createAuraTexture();

    const innerAuraMat = new THREE.SpriteMaterial({
      map: auraTex,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.innerAuraSprite = new THREE.Sprite(innerAuraMat);
    this.innerAuraSprite.scale.set(0.16, 0.16, 1);
    this.ariaGroup.add(this.innerAuraSprite);

    const outerHaloMat = new THREE.SpriteMaterial({
      map: auraTex,
      color: 0xa855f7,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.outerHaloSprite = new THREE.Sprite(outerHaloMat);
    this.outerHaloSprite.scale.set(0.28, 0.28, 1);
    this.ariaGroup.add(this.outerHaloSprite);

    // 5. Floating Spatial HUD Badge above Aria
    const { sprite, canvas, ctx } = this.createSpatialBadge();
    this.badgeSprite = sprite;
    this.badgeCanvas = canvas;
    this.badgeCtx = ctx;
    this.badgeSprite.position.set(0, 0.125, 0);
    this.ariaGroup.add(this.badgeSprite);

    // 6. Laser Beam Filaments Group (Optical harmonic weaving)
    this.laserGroup = new THREE.Group();
    this.laserGroup.name = 'AriaLaserFilaments';
    this.sceneManager.scene.add(this.laserGroup);
    this.initLaserFilaments();

    this.sceneManager.scene.add(this.ariaGroup);
    this.updateSpatialBadge();

    // 7. Initialize Web Speech API
    this.initSpeechRecognition();

    console.log('[AgentAria] Aria v2 initialized (Call-and-Response & Voice Director). Mode: CO-CREATE.');
  }

  public setEuclideanEngine(engine: any): void {
    this.euclideanEngine = engine;
  }

  /**
   * Initializes glowing holographic laser beam filaments for Call-and-Response
   */
  private initLaserFilaments(): void {
    const beamGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 1, 8);
    // Align cylinder along Z axis for lookAt
    beamGeo.rotateX(Math.PI / 2);

    for (let i = 0; i < 4; i++) {
      const beamMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0xa855f7,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(beamGeo, beamMat);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      const line = new THREE.Line(lineGeo, lineMat);

      this.laserGroup.add(mesh);
      this.laserGroup.add(line);

      this.laserBeams.push({
        mesh,
        line,
        active: false,
        target: new THREE.Vector3(),
        intensity: 0
      });
    }
  }

  /**
   * Initializes Web Speech API if supported in browser / WebXR headset
   */
  private initSpeechRecognition(): void {
    const SpeechRec =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        this.speechRecognition = new SpeechRec();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = false;
        this.speechRecognition.lang = 'en-US';

        this.speechRecognition.onstart = () => {
          this.isListening = true;
          this.state = 'LISTENING_VOICE';
          this.triggerEmotionalAnim('CURIOUS_TILT', 3.0);
          this.spatialSynth.playVocalFormantChirp(
            'CURIOUS',
            this.ariaGroup.position,
            1.2
          );
          this.updateSpatialBadge();
          this.onListeningStateChanged?.(true);
        };

        this.speechRecognition.onresult = (event: any) => {
          if (event.results && event.results.length > 0) {
            const transcript = event.results[0][0].transcript;
            console.log(`[AgentAria] Speech heard: "${transcript}"`);
            this.lastVoiceTranscript = transcript;
            this.executeNaturalIntent(transcript);
          }
        };

        this.speechRecognition.onerror = (e: any) => {
          console.warn('[AgentAria] Speech recognition note/error:', e?.error || e);
          this.isListening = false;
          if (this.state === 'LISTENING_VOICE') {
            this.state = 'OBSERVING';
          }
          this.updateSpatialBadge();
          this.onListeningStateChanged?.(false);
        };

        this.speechRecognition.onend = () => {
          this.isListening = false;
          if (this.state === 'LISTENING_VOICE') {
            this.state = 'OBSERVING';
          }
          this.updateSpatialBadge();
          this.onListeningStateChanged?.(false);
        };

        this.isSpeechSupported = true;
        console.log('[AgentAria] Web Speech API active & ready.');
      } catch (err) {
        console.warn('[AgentAria] SpeechRecognition initialization failed:', err);
        this.isSpeechSupported = false;
      }
    } else {
      this.isSpeechSupported = false;
      console.log('[AgentAria] Web Speech API not supported natively; HUD intent chips available.');
    }
  }

  /**
   * Toggles Push-to-Talk speech recognition
   */
  public toggleSpeechListening(): void {
    if (this.isListening) {
      try {
        this.speechRecognition?.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
      if (this.state === 'LISTENING_VOICE') this.state = 'OBSERVING';
      this.updateSpatialBadge();
      this.onListeningStateChanged?.(false);
    } else {
      if (this.speechRecognition) {
        try {
          this.speechRecognition.start();
        } catch (e) {
          console.warn('[AgentAria] Could not start speech recognition:', e);
        }
      } else {

// [Chrono-Loom Milestone 6/25] feat(aria): implement autonomous spring-damper orbital physics around seated user
