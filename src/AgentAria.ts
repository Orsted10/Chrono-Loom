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

// Module-scoped scratch vectors for Zero-GC frame pacing
const _ariaScratchVecA = new THREE.Vector3();
const _ariaScratchVecB = new THREE.Vector3();
const _ariaScratchVecC = new THREE.Vector3();

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

    // 1. Faceted Architectural Obsidian Crystal Core
    const coreGeo = new THREE.OctahedronGeometry(0.026, 0);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f172a,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.2,
      transmission: 0.85,
      ior: 1.55,
      thickness: 0.06,
      transparent: true,
      opacity: 0.95
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.ariaGroup.add(this.coreMesh);

    // Fine beveled crystal edges
    const edgeGeo = new THREE.EdgesGeometry(coreGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    this.coreMesh.add(edgeLines);

    // 2. Refined Platinum Satin Stabilizer Gimbal Rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.25,
      roughness: 0.2,
      metalness: 0.85
    });
    this.ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0010, 16, 64), ringMat);
    this.ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0008, 16, 64), ringMat);
    this.ring3 = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.0006, 16, 64), ringMat);

    this.ariaGroup.add(this.ring1);
    this.ariaGroup.add(this.ring2);
    this.ariaGroup.add(this.ring3);

    // 3. Subtle Localized Companion Light
    this.coreGlowLight = new THREE.PointLight(0x00f0ff, 0.35, 0.30);
    this.ariaGroup.add(this.coreGlowLight);

    // 4. Delicate Micro-Halo
    const auraTex = this.createAuraTexture();
    const innerAuraMat = new THREE.SpriteMaterial({
      map: auraTex,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.innerAuraSprite = new THREE.Sprite(innerAuraMat);
    this.innerAuraSprite.scale.set(0.08, 0.08, 1);
    this.ariaGroup.add(this.innerAuraSprite);

    this.outerHaloSprite = new THREE.Sprite(innerAuraMat);
    this.outerHaloSprite.scale.set(0.12, 0.12, 1);
    this.outerHaloSprite.visible = false;
    this.ariaGroup.add(this.outerHaloSprite);

    // 5. Floating Spatial HUD Badge (Hidden by default; reveals during voice push-to-talk)
    const { sprite, canvas, ctx } = this.createSpatialBadge();
    this.badgeSprite = sprite;
    this.badgeCanvas = canvas;
    this.badgeCtx = ctx;
    this.badgeSprite.position.set(0, 0.08, 0);
    this.badgeSprite.visible = false;
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
        // Fallback for browsers without Web Speech
        this.triggerEmotionalAnim('CURIOUS_TILT', 1.8);
        this.spatialSynth.playVocalFormantChirp('CURIOUS', this.ariaGroup.position);
        this.loomEngine.showHolographicToast(
          '🎤 VOICE: CLICK HUD CHIPS',
          'Use the quick command buttons below to talk with Aria!',
          2.8
        );
      }
    }
  }

  /**
   * Natural Intent Director: Parses human intent and executes actions
   * with 3D expressive emotional animations and procedural vocalizations!
   */
  public executeNaturalIntent(phrase: string): boolean {
    const text = phrase.toLowerCase().trim();
    this.lastVoiceTranscript = phrase;

    // 1. FASTER / TEMPO BOOST
    if (
      text.includes('fast') ||
      text.includes('speed') ||
      text.includes('tempo up') ||
      text.includes('accelerate') ||
      text.includes('quicker')
    ) {
      this.lastVoiceIntent = 'FASTER';
      const targetBPM = Math.min(180, this.loomEngine.globalBPM + 25);
      this.loomEngine.setGlobalBPM(targetBPM);

      this.triggerEmotionalAnim('JOYFUL_BARREL_ROLL', 0.85);
      this.spatialSynth.playVocalFormantChirp('TRIUMPHANT', this.ariaGroup.position, 1.3);

      this.loomEngine.spawnParticleBurst(
        this.ariaGroup.position,
        28,
        new THREE.Color(0xffd700),
        0.08
      );
      this.sceneManager.triggerCymaticPulse(
        this.ariaGroup.position,
        new THREE.Color(0xffd700),
        1.4
      );

      this.loomEngine.showHolographicToast(
        '⚡ TEMPO ACCELERATED!',
        `Aria boosted global clock to ${targetBPM} BPM`,
        2.8
      );
      this.updateSpatialBadge();
      return true;
    }

    // 2. SLOWER / RELAX TEMPO
    if (
      text.includes('slow') ||
      text.includes('chill') ||
      text.includes('tempo down') ||
      text.includes('decelerate') ||
      text.includes('calm')
    ) {
      this.lastVoiceIntent = 'SLOWER';
      const targetBPM = Math.max(40, this.loomEngine.globalBPM - 25);
      this.loomEngine.setGlobalBPM(targetBPM);

      this.triggerEmotionalAnim('CLEANSING_WAVE', 1.2);
      this.spatialSynth.playVocalFormantChirp('AFFIRMATIVE', this.ariaGroup.position, 1.1);

      this.loomEngine.spawnParticleBurst(
        this.ariaGroup.position,
        18,
        new THREE.Color(0x38bdf8),
        0.05
      );
      this.sceneManager.triggerCymaticPulse(
        this.ariaGroup.position,
        new THREE.Color(0x38bdf8),
        1.1
      );

      this.loomEngine.showHolographicToast(
        '🌊 TEMPO DECELERATED',
        `Aria relaxed global clock to ${targetBPM} BPM`,
        2.8
      );
      this.updateSpatialBadge();
      return true;
    }

    // 3. ADD BASSLINE / ANCHOR
    if (
      text.includes('bass') ||
      text.includes('bassline') ||
      text.includes('low note') ||
      text.includes('sub') ||
      text.includes('anchor')
    ) {
      this.lastVoiceIntent = 'ADD_BASSLINE';
      const bassPos = new THREE.Vector3(0.0, 0.94, -0.46);
      const bassNode = this.loomEngine.spawnHarmonicNode(bassPos);
      bassNode.baseColor = new THREE.Color(0xf59e0b); // Amber Gold
      bassNode.noteFrequency = 130.81; // C3 deep sub
      (bassNode.coreMesh.material as THREE.MeshPhysicalMaterial).color.setHex(0xf59e0b);

      const nearest = this.findNearestUserNode(bassPos);
      if (nearest) {
        this.loomEngine.createChronoString(bassNode, nearest);
      }

      this.triggerEmotionalAnim('FOCUSED_WEAVE', 1.5);
      this.spatialSynth.playVocalFormantChirp('AFFIRMATIVE', this.ariaGroup.position, 1.3);

      this.loomEngine.spawnParticleBurst(
        bassPos,
        24,
        new THREE.Color(0xf59e0b),
        0.07
      );
      this.sceneManager.triggerCymaticPulse(
        bassPos,
        new THREE.Color(0xf59e0b),
        1.5
      );

      this.loomEngine.showHolographicToast(
        '🎸 SUB-BASS ANCHORED!',
        'Aria synthesized a resonant C3 sub-harmonic node',
        3.0
      );
      this.updateSpatialBadge();
      return true;
    }

    // 4. HARMONIZE / CALL-AND-RESPONSE
    if (
      text.includes('harmon') ||
      text.includes('counter') ||
      text.includes('play with me') ||
      text.includes('sing') ||
      text.includes('melody')
    ) {
      this.lastVoiceIntent = 'HARMONIZE';
      this.triggerEmotionalAnim('FOCUSED_WEAVE', 2.0);

      // Force immediate Call-and-Response sequence
      if (this.userPlucks.length < 4) {
        // Synthesize simulated phrase if user hasn't plucked 4 notes yet
        const now = performance.now() * 0.001;
        this.userPlucks = [
          { time: now - 1.2, frequency: 261.63, position: new THREE.Vector3(-0.15, 1.15, -0.42), velocity: 1.0, stringId: 'sim_1' },
          { time: now - 0.8, frequency: 329.63, position: new THREE.Vector3(-0.05, 1.20, -0.44), velocity: 1.1, stringId: 'sim_2' },
          { time: now - 0.4, frequency: 392.00, position: new THREE.Vector3(0.05, 1.20, -0.44), velocity: 1.2, stringId: 'sim_3' },
          { time: now - 0.1, frequency: 523.25, position: new THREE.Vector3(0.15, 1.15, -0.42), velocity: 1.3, stringId: 'sim_4' }
        ];
      }

      this.initiateCallAndResponse(this.userPlucks.slice(-4));
      return true;
    }

    // 5. SCALE SWITCHING (Lydian, Hirajoshi, Raga Yaman, Dorian, Drone)
    if (
      text.includes('scale') ||
      text.includes('raga') ||
      text.includes('yaman') ||
      text.includes('lydian') ||
      text.includes('hirajoshi') ||
      text.includes('tokyo') ||
      text.includes('dorian') ||
      text.includes('noir') ||
      text.includes('drone')
    ) {
      this.lastVoiceIntent = 'SWITCH_SCALE';
      let targetIndex = 0;
      let scaleName = 'Celestial Lydian';

      if (text.includes('raga') || text.includes('yaman')) {
        targetIndex = 2;
        scaleName = 'Raga Yaman Evening';
      } else if (text.includes('hirajoshi') || text.includes('tokyo')) {
        targetIndex = 1;
        scaleName = 'Tokyo Midnight Hirajoshi';
      } else if (text.includes('dorian') || text.includes('noir')) {
        targetIndex = 3;
        scaleName = 'Dorian Cyber-Noir';
      } else if (text.includes('drone')) {
        targetIndex = 4;
        scaleName = 'Deep Sub-Drone';
      } else {
        targetIndex = 0;
        scaleName = 'Celestial Lydian';
      }

      if (this.euclideanEngine) {
        this.euclideanEngine.applyScalePreset(targetIndex, true);
      }

      this.triggerEmotionalAnim('JOYFUL_BARREL_ROLL', 0.9);
      this.spatialSynth.playVocalFormantChirp('AFFIRMATIVE', this.ariaGroup.position, 1.2);

      this.loomEngine.showHolographicToast(
        `🎵 SCALE: ${scaleName.toUpperCase()}`,
        'Aria morphed all harmonic nodes & chromatic lighting',
        2.8
      );
      this.updateSpatialBadge();
      return true;
    }

    // 6. CLEAR / RESET LOOM
    if (
      text.includes('clear') ||
      text.includes('reset') ||
      text.includes('clean') ||
      text.includes('empty') ||
      text.includes('erase')
    ) {
      this.lastVoiceIntent = 'CLEAR_LOOM';
      this.loomEngine.resetLoom();
      this.reset();

      this.triggerEmotionalAnim('CLEANSING_WAVE', 1.4);
      this.spatialSynth.playVocalFormantChirp('RESET', this.ariaGroup.position, 1.2);

      this.loomEngine.showHolographicToast(
        '🧹 SPATIAL LOOM CLEARED',
        'Aria refreshed the workspace to initial tranquil state',
        2.8
      );
      this.updateSpatialBadge();
      return true;
    }

    // Default: Unrecognized intent - curious tilt & vocal chirp
    this.lastVoiceIntent = 'UNKNOWN';
    this.triggerEmotionalAnim('CURIOUS_TILT', 1.8);
    this.spatialSynth.playVocalFormantChirp('CURIOUS', this.ariaGroup.position, 1.0);

    this.loomEngine.showHolographicToast(
      '❓ ARIA IS CURIOUS',
      `Heard: "${phrase.slice(0, 26)}..." (Try "Faster", "Bassline", "Raga", "Harmonize")`,
      3.2
    );
    this.updateSpatialBadge();
    return false;
  }

  /**
   * Records a user's tactile pluck event for real-time phrase analysis
   */
  public recordUserPluck(
    stringId: string,
    pos: THREE.Vector3,
    vel: number,
    freq: number
  ): void {
    const now = performance.now() * 0.001;

    // Prune plucks older than 5.5s
    this.userPlucks = this.userPlucks.filter((p) => now - p.time < 5.5);

    this.userPlucks.push({
      time: now,
      frequency: freq || 440,
      position: pos.clone(),
      velocity: vel,
      stringId
    });

    // Need at least 4 notes for a melodic phrase
    if (this.userPlucks.length >= 4) {
      const recent4 = this.userPlucks.slice(-4);
      const span = recent4[3].time - recent4[0].time;

      // Check if user played 4 notes within 5.0 seconds
      if (
        span <= 5.0 &&
        now - this.lastCallResponseTime > 6.0 &&
        this.state !== 'CALL_AND_RESPONSE' &&
        this.state !== 'LISTENING_VOICE'
      ) {
        this.lastCallResponseTime = now;
        this.initiateCallAndResponse(recent4);
      }
    }
  }

  /**
   * Real-Time Musical Phrase Analyzer:
   * Detects rhythmic density (average IOI) and melodic interval tension,
   * flies to a complementary spatial sweet-spot, and weaves a 2-bar counter-melody.
   */
  public initiateCallAndResponse(recent4: UserPluckRecord[]): void {
    const p0 = recent4[0];
    const p1 = recent4[1];
    const p2 = recent4[2];
    const p3 = recent4[3];

    // 1. Compute Rhythmic Density (Average Inter-Onset Interval)
    const avgIOI = Math.max(0.24, Math.min(0.65, (p3.time - p0.time) / 3));
    this.observedBPM = Math.round(60 / avgIOI);

    // 2. Compute Melodic Contour & Interval Tension
    const isAscending = p3.frequency > p0.frequency;
    const isDescending = p3.frequency < p0.frequency;
    const direction = isAscending ? 'ASCENDING' : isDescending ? 'DESCENDING' : 'ARCH';

    // 3. Generate 4 complementary counter-melody response frequencies
    const freqs = this.spatialSynth.activeScaleFrequencies || [
      261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 523.25
    ];

    let note1 = p3.frequency;
    let note2 = p3.frequency;
    let note3 = p3.frequency;
    let note4 = p0.frequency;

    if (isAscending) {
      // User soared up -> Aria weaves a descending counter-melody resolving to fifth
      note1 = this.snapToScale(p3.frequency * 1.5, freqs);
      note2 = this.snapToScale(p3.frequency * 1.333, freqs);
      note3 = this.snapToScale(p3.frequency * 1.125, freqs);
      note4 = this.snapToScale(p0.frequency * 2.0, freqs);
    } else if (isDescending) {
      // User went low -> Aria responds with an ascending uplifting phrase
      note1 = this.snapToScale(p3.frequency * 0.75, freqs);
      note2 = this.snapToScale(p3.frequency * 1.0, freqs);
      note3 = this.snapToScale(p3.frequency * 1.25, freqs);
      note4 = this.snapToScale(p3.frequency * 1.5, freqs);
    } else {
      // Arch/Oscillating -> Aria plays complementary triad arpeggio
      note1 = this.snapToScale(p3.frequency * 1.2, freqs);
      note2 = this.snapToScale(p3.frequency * 1.5, freqs);
      note3 = this.snapToScale(p3.frequency * 1.8, freqs);
      note4 = this.snapToScale(p3.frequency * 2.0, freqs);
    }

    // 4. Determine Complementary Spatial Sweet-Spot
    const center = _ariaScratchVecA.set(0, 0, 0);
    for (const p of recent4) center.add(p.position);
    center.multiplyScalar(0.25);

    // Complementary position opposite user's plucks within seated arc (< 0.55m)
    const targetPos = _ariaScratchVecB.set(
      -center.x * 0.8,
      Math.min(1.36, Math.max(1.10, center.y + 0.08)),
      Math.min(-0.35, Math.max(-0.52, center.z))
    );

    this.callResponseOrigin.copy(this.ariaGroup.position);
    this.callResponseTarget.copy(targetPos);
    this.targetFlightPosition.copy(targetPos);
    this.flightProgress = 0.0;

    // 5. Construct 2-bar timed counter-melody schedule
    const flightTime = 0.75;
    this.callResponseSequence = [
      {
        frequency: note1,
        delaySec: flightTime,
        duration: 1.2,
        intensity: 1.4,
        hasTriggered: false,
        targetPoint: p0.position.clone()
      },
      {
        frequency: note2,
        delaySec: flightTime + avgIOI,
        duration: 1.2,
        intensity: 1.35,
        hasTriggered: false,
        targetPoint: p1.position.clone()
      },
      {
        frequency: note3,
        delaySec: flightTime + avgIOI * 2,
        duration: 1.2,
        intensity: 1.35,
        hasTriggered: false,
        targetPoint: p2.position.clone()
      },
      {
        frequency: note4,
        delaySec: flightTime + avgIOI * 3,
        duration: 1.6,
        intensity: 1.45,
        hasTriggered: false,
        targetPoint: p3.position.clone()
      }
    ];

    this.callResponseTimer = 0;
    this.callResponsePhase = 'FLYING_TO_RESPONSE';
    this.state = 'CALL_AND_RESPONSE';

    // Aria singing formant vocalization
    this.spatialSynth.playVocalFormantChirp('CALL_RESPONSE', this.ariaGroup.position, 1.2);
    this.triggerEmotionalAnim('FOCUSED_WEAVE', flightTime + avgIOI * 4);

    this.loomEngine.showHolographicToast(
      '🎼 ARIA CALL-AND-RESPONSE!',
      `Weaving ${direction} counter-melody (${this.observedBPM} BPM)`,
      3.2
    );
    this.updateSpatialBadge();

    console.log(
      `[AgentAria] Initiated Call-and-Response! IOI: ${avgIOI.toFixed(2)}s (${this.observedBPM} BPM), notes: [${note1.toFixed(1)}, ${note2.toFixed(1)}, ${note3.toFixed(1)}, ${note4.toFixed(1)}] Hz`
    );
  }

  /**
   * Snaps a frequency to the nearest available note in a given scale array
   */
  private snapToScale(freq: number, scaleFreqs: number[]): number {
    let closest = scaleFreqs[0];
    let minDiff = 99999;
    for (const f of scaleFreqs) {
      const diff = Math.abs(f - freq);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    }
    return closest;
  }

  /**
   * Triggers an expressive 3D emotional animation
   */
  public triggerEmotionalAnim(anim: AriaEmotionalAnim, duration = 1.0): void {
    this.currentAnim = anim;
    this.animDuration = duration;
    this.animTimer = 0.0;
  }

  /**
   * Builds the 3D billboard canvas badge displaying Aria's status & AI Mode
   */
  private createSpatialBadge(): {
    sprite: THREE.Sprite;
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.14, 0.07, 1);
    return { sprite, canvas, ctx };
  }

  /**
   * Generates procedural radial glow aura texture for high-dynamic additive halos
   */
  private createAuraTexture(): THREE.CanvasTexture {
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
      gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
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

  /**
   * Refreshes the floating spatial text badge
   */
  public updateSpatialBadge(): void {
    const ctx = this.badgeCtx;
    const canvas = this.badgeCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Glass pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle =
      this.state === 'CALL_AND_RESPONSE'
        ? '#38bdf8'
        : this.state === 'LISTENING_VOICE'
        ? '#10b981'
        : this.mode === 'CO-CREATE'
        ? '#00f0ff'
        : this.mode === 'RHYTHM_BOOST'
        ? '#f59e0b'
        : '#a855f7';
    ctx.lineWidth = 5;
    this.drawRoundedRect(ctx, 20, 20, 472, 216, 28);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.font = 'bold 30px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('ARIA // SPATIAL AI', 256, 68);

    // AI Mode / Voice Pill
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    if (this.state === 'LISTENING_VOICE') {
      ctx.fillStyle = '#34d399';
      ctx.fillText('● [LISTENING TO VOICE...]', 256, 120);
    } else if (this.state === 'CALL_AND_RESPONSE') {
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('[CALL & RESPONSE ACTIVE]', 256, 120);
    } else {
      ctx.fillStyle =
        this.mode === 'CO-CREATE'
          ? '#00f0ff'
          : this.mode === 'RHYTHM_BOOST'
          ? '#fbbf24'
          : '#c084fc';
      ctx.fillText(`[MODE: ${this.mode.replace('_', ' ')}]`, 256, 120);
    }

    // State & Tempo readout
    ctx.font = '22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    let stateText = `${this.state} (${this.observedBPM} BPM)`;
    if (this.state === 'HARMONIZING') stateText = 'HARMONIZING SPACE...';
    if (this.state === 'WEAVING') stateText = 'WEAVING COUNTER-MELODY';
    if (this.state === 'CALL_AND_RESPONSE') stateText = `SINGING COUNTERPOINT (${this.observedBPM} BPM)`;
    if (this.state === 'LISTENING_VOICE') stateText = 'SPEAK INTENT ("FASTER", "BASSLINE")';
    if (this.state === 'CELEBRATING') stateText = 'CELEBRATING HARMONY!';
    ctx.fillText(stateText, 256, 172);

    // Interaction hint
    ctx.font = '16px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('POKE TO CYCLE | KEY V / [TALK] TO SPEAK', 256, 212);

    (this.badgeSprite.material.map as THREE.CanvasTexture).needsUpdate = true;
  }

  private drawRoundedRect(
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
   * Sets Aria's AI Mode explicitly
   */
  public setAIMode(mode: AriaAIMode): void {
    this.mode = mode;
    if (mode === 'RHYTHM_BOOST') {
      this.applyRhythmBoostMode();
    }
    this.updateSpatialBadge();
  }

  /**
   * Cycles Aria's AI Mode upon Fist-Bump or Pinch
   */
  public cycleAIMode(): void {
    const now = performance.now();
    if (now - this.lastFistBumpTime < 500) return; // Debounce
    this.lastFistBumpTime = now;

    if (this.mode === 'CO-CREATE') {
      this.mode = 'RHYTHM_BOOST';
      this.applyRhythmBoostMode();
    } else if (this.mode === 'RHYTHM_BOOST') {
      this.mode = 'ZEN_SOLO';
    } else {
      this.mode = 'CO-CREATE';
    }

    console.log(`[AgentAria] Mode cycled to: ${this.mode}`);

    // Formant vocalization affirmative chirp
    this.spatialSynth.playVocalFormantChirp('AFFIRMATIVE', this.ariaGroup.position, 1.2);
    this.triggerEmotionalAnim('JOYFUL_BARREL_ROLL', 0.7);

    // Particle burst of violet/gold sparks & floor cymatic wave
    this.loomEngine.spawnParticleBurst(
      this.ariaGroup.position,
      24,
      new THREE.Color(0xa855f7),
      0.07
    );
    this.sceneManager.triggerCymaticPulse(
      this.ariaGroup.position,
      new THREE.Color(
        this.mode === 'CO-CREATE'
          ? 0x00f0ff
          : this.mode === 'RHYTHM_BOOST'
          ? 0xf59e0b
          : 0xa855f7
      ),
      1.3
    );

    this.updateSpatialBadge();
  }

  /**
   * Rhythm Boost Mode: Boosts pulse speeds and weaves a bass anchor node
   */
  private applyRhythmBoostMode(): void {
    for (const pulse of this.loomEngine.pulses.values()) {
      pulse.speed = 0.85;
    }

    if (this.loomEngine.nodes.size >= 2) {
      const bassPos = new THREE.Vector3(0.0, 0.94, -0.46);
      const bassNode = this.loomEngine.spawnHarmonicNode(bassPos);
      bassNode.baseColor = new THREE.Color(0xf59e0b); // Gold
      bassNode.noteFrequency = 130.81; // C3 Deep bass
      (bassNode.coreMesh.material as THREE.MeshPhysicalMaterial).color.setHex(0xf59e0b);

      const nearest = this.findNearestUserNode(bassPos);
      if (nearest) {
        this.loomEngine.createChronoString(bassNode, nearest);
      }
    }
  }

  /**
   * Per-frame update loop for Aria's autonomous state machine & motion
   */
  public update(deltaTime: number): void {
    const time = performance.now() * 0.001;

    // 1. Counter-Rotating Rings animation
    let ringSpeedMultiplier = 1.0;
    if (this.currentAnim === 'FOCUSED_WEAVE') ringSpeedMultiplier = 3.2;

    this.ring1.rotation.x += 0.025 * ringSpeedMultiplier;
    this.ring1.rotation.y += 0.012 * ringSpeedMultiplier;
    this.ring2.rotation.y -= 0.035 * ringSpeedMultiplier;
    this.ring2.rotation.z += 0.018 * ringSpeedMultiplier;
    this.ring3.rotation.z += 0.022 * ringSpeedMultiplier;
    this.ring3.rotation.x -= 0.015 * ringSpeedMultiplier;

    // 2. Core Breathing Pulse & Light
    const breath = 1.0 + Math.sin(time * 3.0) * 0.08;
    this.coreMesh.scale.setScalar(breath);
    this.coreGlowLight.intensity =
      this.currentAnim === 'FOCUSED_WEAVE'
        ? 3.2 + Math.sin(time * 10.0) * 0.8
        : 1.6 + Math.sin(time * 4.0) * 0.4;

    // 2b. High-Dynamic Neon Glow Halos Breathing & Mode Chromatic Tint
    const haloPulse = Math.sin(time * 3.5) * 0.018;
    this.innerAuraSprite.scale.setScalar(0.16 + haloPulse);
    this.outerHaloSprite.scale.setScalar(0.28 + haloPulse * 1.6);

    const innerMat = this.innerAuraSprite.material as THREE.SpriteMaterial;
    const outerMat = this.outerHaloSprite.material as THREE.SpriteMaterial;

    if (this.state === 'LISTENING_VOICE') {
      innerMat.color.setHex(0x10b981);
      outerMat.color.setHex(0x34d399);
      innerMat.opacity = 0.90 + Math.sin(time * 8) * 0.1;
      outerMat.opacity = 0.55 + Math.sin(time * 6) * 0.15;
    } else if (this.state === 'CALL_AND_RESPONSE') {
      innerMat.color.setHex(0x00f0ff);
      outerMat.color.setHex(0x38bdf8);
      innerMat.opacity = 0.88 + Math.sin(time * 6) * 0.12;
      outerMat.opacity = 0.50 + Math.sin(time * 5) * 0.12;
    } else if (this.mode === 'CO-CREATE') {
      innerMat.color.setHex(0x00f0ff);
      outerMat.color.setHex(0xa855f7);
      innerMat.opacity = 0.72 + Math.sin(time * 4) * 0.12;
      outerMat.opacity = 0.36 + Math.sin(time * 3) * 0.08;
    } else if (this.mode === 'RHYTHM_BOOST') {
      innerMat.color.setHex(0xf59e0b);
      outerMat.color.setHex(0xf59e0b);
      innerMat.opacity = 0.82 + Math.sin(time * 6) * 0.15;
      outerMat.opacity = 0.45 + Math.sin(time * 4.5) * 0.1;
    } else {
      // ZEN_SOLO
      innerMat.color.setHex(0xa855f7);
      outerMat.color.setHex(0x38bdf8);
      innerMat.opacity = 0.60 + Math.sin(time * 2) * 0.1;
      outerMat.opacity = 0.30 + Math.sin(time * 1.5) * 0.06;
    }

    // 3. Update 3D Emotional Animations
    this.updateEmotionalAnimations(deltaTime, time);

    // 4. Update Laser Beam Filaments
    this.updateLaserFilaments(deltaTime, time);

    // 5. Check Interactive Hand Gesture: Fist-Bump or Pinch with Aria
    this.checkHandInteractions();

    // 6. State Machine Execution
    this.executeStateMachine(deltaTime, time);
  }

  /**
   * Updates 3D Emotional Animations (Head Tilt, Barrel Roll, Focused Weave, Cleansing Wave)
   */
  private updateEmotionalAnimations(deltaTime: number, time: number): void {
    if (this.currentAnim === 'NONE') {
      // Return gently to upright orientation
      this.ariaGroup.rotation.z = THREE.MathUtils.lerp(this.ariaGroup.rotation.z, 0, deltaTime * 6);
      this.ariaGroup.rotation.x = THREE.MathUtils.lerp(this.ariaGroup.rotation.x, 0, deltaTime * 6);
      return;
    }

    this.animTimer += deltaTime;
    const progress = Math.min(1.0, this.animTimer / this.animDuration);

    switch (this.currentAnim) {
      case 'CURIOUS_TILT': {
        // Expressive 25 degree head-tilt (0.44 rad) with curious forward lean
        const tiltAngle = Math.sin(progress * Math.PI) * 0.44;
        const pitchAngle = Math.sin(progress * Math.PI) * 0.14;
        this.ariaGroup.rotation.z = tiltAngle;
        this.ariaGroup.rotation.x = pitchAngle;
        break;
      }

      case 'JOYFUL_BARREL_ROLL': {
        // Continuous 360 degree spin around Z-axis with energetic vertical hop
        const rollAngle = progress * Math.PI * 2;
        this.ariaGroup.rotation.z = rollAngle;
        this.ariaGroup.position.y += Math.sin(progress * Math.PI) * 0.003;

        // Sparkling golden particles
        if (Math.random() < 0.35) {
          this.loomEngine.spawnParticleBurst(
            this.ariaGroup.position,
            2,
            new THREE.Color(0xffd700),
            0.04
          );
        }
        break;
      }

      case 'FOCUSED_WEAVE': {
        // Rings spin rapidly, slight pulsating scale
        const scalePulse = 1.0 + Math.sin(this.animTimer * 12.0) * 0.06;
        this.ariaGroup.scale.setScalar(scalePulse);
        break;
      }

      case 'CLEANSING_WAVE': {
        // Concentric expansion and smooth relaxation
        const ringScale = 1.0 + Math.sin(progress * Math.PI) * 0.45;
        this.ring1.scale.setScalar(ringScale);
        this.ring2.scale.setScalar(ringScale);
        this.ring3.scale.setScalar(ringScale);
        break;
      }
    }

    if (progress >= 1.0) {
      this.currentAnim = 'NONE';
      this.ring1.scale.setScalar(1);
      this.ring2.scale.setScalar(1);
      this.ring3.scale.setScalar(1);
      this.ariaGroup.scale.setScalar(1);
    }
  }

  /**
   * Updates Laser Beam Filaments connecting Aria to target nodes
   */
  private updateLaserFilaments(deltaTime: number, time: number): void {
    const ariaWorldPos = this.ariaGroup.position;

    for (const beam of this.laserBeams) {
      if (beam.active) {
        beam.intensity = Math.min(1.0, beam.intensity + deltaTime * 5.0);
        const dist = ariaWorldPos.distanceTo(beam.target);

        if (dist > 0.02) {
          const midPoint = _ariaScratchVecA.addVectors(ariaWorldPos, beam.target).multiplyScalar(0.5);
          beam.mesh.position.copy(midPoint);
          beam.mesh.scale.set(1, 1, dist);
          beam.mesh.lookAt(beam.target);

          // Update line endpoints
          const posAttr = beam.line.geometry.getAttribute('position') as THREE.BufferAttribute;
          posAttr.setXYZ(0, ariaWorldPos.x, ariaWorldPos.y, ariaWorldPos.z);
          posAttr.setXYZ(1, beam.target.x, beam.target.y, beam.target.z);
          posAttr.needsUpdate = true;

          const pulseOpacity = (0.7 + Math.sin(time * 24.0) * 0.28) * beam.intensity;
          (beam.mesh.material as THREE.MeshBasicMaterial).opacity = pulseOpacity;
          (beam.line.material as THREE.LineBasicMaterial).opacity = pulseOpacity * 0.9;
        }
      } else {
        beam.intensity = Math.max(0.0, beam.intensity - deltaTime * 4.0);
        (beam.mesh.material as THREE.MeshBasicMaterial).opacity = beam.intensity * 0.7;
        (beam.line.material as THREE.LineBasicMaterial).opacity = beam.intensity * 0.9;
      }
    }
  }

  /**
   * Checks if user reaches out to Fist-Bump or Pinch Aria
   */
  private checkHandInteractions(): void {
    const leftTele = this.handInputManager.getTelemetry('left');
    const rightTele = this.handInputManager.getTelemetry('right');
    const ariaPos = this.ariaGroup.position;

    // Check right hand interaction
    if (rightTele.isTracked) {
      const dIndex = rightTele.indexTipPosition.distanceTo(ariaPos);
      const dWrist = rightTele.wristPosition.distanceTo(ariaPos);
      if (dIndex < 0.075 || dWrist < 0.09 || (rightTele.isPinching && dIndex < 0.085)) {
        this.cycleAIMode();
        return;
      }
    }

    // Check left hand interaction
    if (leftTele.isTracked) {
      const dIndex = leftTele.indexTipPosition.distanceTo(ariaPos);
      const dWrist = leftTele.wristPosition.distanceTo(ariaPos);
      if (dIndex < 0.075 || dWrist < 0.09 || (leftTele.isPinching && dIndex < 0.085)) {
        this.cycleAIMode();
        return;
      }
    }
  }

  /**
   * Autonomous State Machine
   */
  private executeStateMachine(deltaTime: number, time: number): void {
    const activeNodes = this.loomEngine.nodes;

    switch (this.state) {
      case 'OBSERVING': {
        // Natural lifelike hovering around home position (Zero-GC scratch vector)
        const hoverOffset = _ariaScratchVecB.set(
          Math.sin(time * 1.2) * 0.015,
          Math.sin(time * 2.0) * 0.012,
          Math.cos(time * 1.5) * 0.01
        );
        this.ariaGroup.position.copy(this.homePosition).add(hoverOffset);

        // Core gently rotates to face active hand
        const rightTele = this.handInputManager.getTelemetry('right');
        if (rightTele.isTracked) {
          this.coreMesh.lookAt(rightTele.indexTipPosition);
        }

        // Mode: Zen Solo chord swells
        if (this.mode === 'ZEN_SOLO') {
          this.zenChordTimer += deltaTime;
          if (this.zenChordTimer >= 6.0) {
            this.zenChordTimer = 0;
            this.playZenAmbientChord();
          }
        }

        // Mode: Co-Create Autonomous Weaving Timer
        if (this.mode === 'CO-CREATE' && activeNodes.size >= 2) {
          this.autonomousTimer += deltaTime;
          if (this.autonomousTimer >= this.WEAVE_INTERVAL) {
            this.autonomousTimer = 0;
            this.beginHarmonizingSequence();
          }
        }
        break;
      }

      case 'LISTENING_VOICE': {
        // Hover in place with attentive listening orientation (Zero-GC scratch vector)
        const hoverOffset = _ariaScratchVecB.set(
          Math.sin(time * 2.5) * 0.008,
          Math.sin(time * 3.5) * 0.008,
          0
        );
        this.ariaGroup.position.copy(this.homePosition).add(hoverOffset);
        break;
      }

      case 'CALL_AND_RESPONSE': {
        this.callResponseTimer += deltaTime;

        if (this.callResponsePhase === 'FLYING_TO_RESPONSE') {
          this.flightProgress = Math.min(1.0, this.flightProgress + deltaTime * 2.2);
          this.ariaGroup.position.lerpVectors(
            this.callResponseOrigin,
            this.callResponseTarget,
            this.easeOutCubic(this.flightProgress)
          );

          if (this.flightProgress >= 1.0) {
            this.callResponsePhase = 'PLAYING_NOTES';
          }
        } else if (this.callResponsePhase === 'PLAYING_NOTES') {
          let allPlayed = true;

          this.callResponseSequence.forEach((note, index) => {
            if (!note.hasTriggered && this.callResponseTimer >= note.delaySec) {
              note.hasTriggered = true;

              // 1. Play spatialized note
              this.spatialSynth.playSpatialNote({
                frequency: note.frequency,
                position: this.ariaGroup.position,
                intensity: note.intensity,
                duration: note.duration,
                filterCutoff: 3800
              });

              // 2. Activate Laser Beam to target pluck point
              if (index < this.laserBeams.length) {
                const beam = this.laserBeams[index];
                beam.active = true;
                beam.target.copy(note.targetPoint);
                setTimeout(() => {
                  beam.active = false;
                }, 400);
              }

              // 3. Celebratory spark burst & floor cymatic wave
              this.loomEngine.spawnParticleBurst(
                this.ariaGroup.position,
                16,
                new THREE.Color(index % 2 === 0 ? 0x00f0ff : 0xa855f7),
                0.05
              );
              this.sceneManager.triggerCymaticPulse(
                this.ariaGroup.position,
                new THREE.Color(0x00f0ff),
                1.2
              );
            }

            if (!note.hasTriggered) {
              allPlayed = false;
            }
          });

          // After all notes played, linger briefly then return
          const lastNote = this.callResponseSequence[this.callResponseSequence.length - 1];
          if (allPlayed && this.callResponseTimer >= lastNote.delaySec + 0.8) {
            this.callResponsePhase = 'RETURNING';
            this.flightProgress = 0.0;
          }
        } else if (this.callResponsePhase === 'RETURNING') {
          this.flightProgress = Math.min(1.0, this.flightProgress + deltaTime * 1.5);
          this.ariaGroup.position.lerpVectors(
            this.callResponseTarget,
            this.homePosition,
            this.easeOutCubic(this.flightProgress)
          );

          if (this.flightProgress >= 1.0) {
            this.state = 'OBSERVING';
            this.currentAnim = 'NONE';
            this.laserBeams.forEach((b) => (b.active = false));
            this.updateSpatialBadge();
          }
        }
        break;
      }

      case 'HARMONIZING': {
        // Smooth flight toward the harmonic sweet-spot
        this.flightProgress = Math.min(1.0, this.flightProgress + deltaTime * this.flightSpeed);
        this.ariaGroup.position.lerpVectors(
          this.homePosition,
          this.targetFlightPosition,
          this.easeOutCubic(this.flightProgress)
        );

        if (this.flightProgress >= 1.0) {
          this.state = 'WEAVING';
          this.updateSpatialBadge();
        }
        break;
      }

      case 'WEAVING': {
        // Perform the autonomous weave at target sweet spot!
        this.executeWeaveAction();
        this.state = 'OBSERVING';
        this.flightProgress = 0.0;
        this.updateSpatialBadge();
        break;
      }

      case 'CELEBRATING': {
        // Triumphant orbital loop dance around constellation center
        this.celebrateAngle += deltaTime * 2.5;
        const radius = 0.28;
        this.ariaGroup.position.set(
          Math.cos(this.celebrateAngle) * radius,
          1.25 + Math.sin(this.celebrateAngle * 2) * 0.08,
          -0.45 + Math.sin(this.celebrateAngle) * radius
        );

        // Continuous sparkling trail
        if (Math.random() < 0.4) {
          this.loomEngine.spawnParticleBurst(
            this.ariaGroup.position,
            2,
            new THREE.Color(0xffd700),
            0.04
          );
        }
        break;
      }
    }
  }

  /**
   * Plans and begins autonomous flight to an empty harmonic sweet-spot
   */
  private beginHarmonizingSequence(): void {
    const sweetSpot = this.findHarmonicSweetSpot();
    if (!sweetSpot) return;

    this.targetFlightPosition.copy(sweetSpot);
    this.flightProgress = 0.0;
    this.state = 'HARMONIZING';
    this.updateSpatialBadge();

    // Flight takeoff chime
    this.spatialSynth.playSpatialNote({
      frequency: 523.25,
      position: this.ariaGroup.position,
      intensity: 1.1,
      duration: 0.8
    });
  }

  /**
   * Finds an empty harmonic position within the 2-foot seated comfort zone
   * that is at least 0.18m away from existing nodes.
   */
  private findHarmonicSweetSpot(): THREE.Vector3 | null {
    const candidateSpots = [
      new THREE.Vector3(-0.20, 1.18, -0.42),
      new THREE.Vector3(0.20, 1.18, -0.42),
      new THREE.Vector3(0.0, 1.30, -0.45),
      new THREE.Vector3(-0.15, 1.02, -0.44),
      new THREE.Vector3(0.15, 1.02, -0.44),
      new THREE.Vector3(-0.28, 1.10, -0.40),
      new THREE.Vector3(0.28, 1.10, -0.40)
    ];

    for (const spot of candidateSpots) {
      let tooClose = false;
      for (const node of this.loomEngine.nodes.values()) {
        if (spot.distanceTo(node.position) < 0.16) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) return spot;
    }

    return null;
  }

  /**
   * Spawns Complementary AI Node & weaves counter-melody string
   */
  private executeWeaveAction(): void {
    const spawnPos = this.targetFlightPosition.clone();

    // 1. Spawn Complementary AI Node (Purple/Gold)
    const aiNode = this.loomEngine.spawnHarmonicNode(spawnPos);
    aiNode.baseColor = new THREE.Color(0xa855f7); // Neon Purple
    (aiNode.coreMesh.material as THREE.MeshPhysicalMaterial).color.setHex(0xa855f7);
    (aiNode.wireframeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffd700); // Gold shell

    // 2. Weave counter-melody string connected to nearest user node
    const nearestUserNode = this.findNearestUserNode(spawnPos);
    if (nearestUserNode) {
      this.loomEngine.createChronoString(aiNode, nearestUserNode);
    }

    // 3. Celebratory energy burst & spatial counter-melody chord
    this.loomEngine.spawnParticleBurst(spawnPos, 22, new THREE.Color(0xa855f7), 0.06);
    this.spatialSynth.playSpatialNote({
      frequency: 369.99, // F#4 Lydian #4
      position: spawnPos,
      intensity: 1.4,
      duration: 1.5
    });

    console.log(`[AgentAria] Autonomously wove complementary AI node [${aiNode.id}]!`);
  }

  private findNearestUserNode(pos: THREE.Vector3): HarmonicNode | null {
    let nearest: HarmonicNode | null = null;
    let minDist = 999;
    for (const node of this.loomEngine.nodes.values()) {
      const d = pos.distanceTo(node.position);
      if (d > 0.05 && d < minDist) {
        minDist = d;
        nearest = node;
      }
    }
    return nearest;
  }

  /**
   * Zen Solo Mode: Ambient harmonic triad chord swell
   */
  private playZenAmbientChord(): void {
    const chords = [
      [261.63, 329.63, 392.0], // C major
      [220.0, 261.63, 329.63], // A minor
      [196.0, 246.94, 293.66], // G major
      [164.81, 196.0, 246.94]  // E minor
    ];
    const chord = chords[Math.floor(Math.random() * chords.length)];

    chord.forEach((freq, idx) => {
      setTimeout(() => {
        this.spatialSynth.playSpatialNote({
          frequency: freq,
          position: this.ariaGroup.position,
          intensity: 0.7,
          duration: 2.2,
          filterCutoff: 1800
        });
      }, idx * 120);
    });

    this.loomEngine.spawnParticleBurst(
      this.ariaGroup.position,
      8,
      new THREE.Color(0xa855f7),
      0.02
    );
  }

  private easeOutCubic(x: number): number {
    return 1 - Math.pow(1 - x, 3);
  }

  /**
   * Triggers victory celebration mode
   */
  public triggerCelebrating(): void {
    this.state = 'CELEBRATING';
    this.updateSpatialBadge();
  }

  /**
   * Resets Aria to initial observing state
   */
  public reset(): void {
    this.state = 'OBSERVING';
    this.mode = 'CO-CREATE';
    this.currentAnim = 'NONE';
    this.ariaGroup.position.copy(this.homePosition);
    this.flightProgress = 1.0;
    this.laserBeams.forEach((b) => (b.active = false));
    this.updateSpatialBadge();
  }
}
