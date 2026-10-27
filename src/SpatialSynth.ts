import * as THREE from 'three';

// Lydian / Pentatonic scale frequencies across 3 octaves (C3 to E5)
export const HARMONIC_SCALE_FREQUENCIES = [
  130.81, // C3 (deep warm bass)
  146.83, // D3
  164.81, // E3
  185.00, // F#3 (Lydian #4)
  196.00, // G3
  220.00, // A3
  246.94, // B3
  261.63, // C4 (middle octave)
  293.66, // D4
  329.63, // E4
  369.99, // F#4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5 (crystal bell octave)
  587.33, // D5
  659.25  // E5
];

export interface NoteVoiceOptions {
  frequency: number;
  position: THREE.Vector3;
  intensity?: number;
  duration?: number;
  harmonicMultiplier?: number;
  filterCutoff?: number;
}

export type VocalChirpType =
  | 'AFFIRMATIVE'
  | 'CURIOUS'
  | 'TRIUMPHANT'
  | 'CELEBRATING'
  | 'CALL_RESPONSE'
  | 'RESET';

export class SpatialSynth {
  public audioCtx: AudioContext | null = null;
  private listener: AudioListener | null = null;

  // Active scale frequencies (defaults to Celestial Lydian)
  public activeScaleFrequencies: number[] = [...HARMONIC_SCALE_FREQUENCIES];

  public setActiveScaleFrequencies(freqs: number[]): void {
    if (freqs && freqs.length > 0) {
      this.activeScaleFrequencies = [...freqs];
    }
  }

  // Master Spatial Cathedral Reverb / Delay Bus
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;
  private delayFilter: BiquadFilterNode | null = null;
  private wetGain: GainNode | null = null;
  private dryGain: GainNode | null = null;

  // Phase 15: Master Dynamics Limiter (threshold: -10dB, ratio: 6:1, knee: 12)
  public masterLimiter: DynamicsCompressorNode | null = null;

  // Phase 15: Procedural Stereo Convolution Reverb (Exponential-decay velvet noise)
  public convolverNode: ConvolverNode | null = null;
  public convolverGain: GainNode | null = null;

  // Phase 15: Living Harmonic Drone Bed (Velocity-coupled 3-oscillator ambient pad)
  private droneOscRoot: OscillatorNode | null = null;
  private droneOscFifth: OscillatorNode | null = null;
  private droneOscSub: OscillatorNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;
  private droneGain: GainNode | null = null;
  private droneDuckingGain: GainNode | null = null;
  private isDroneActive = false;
  private currentDroneRoot = 130.81; // C3

  private isInitialized = false;

  constructor() {
    this.setupAutoResumeListeners();
  }

  /**
   * Configures automatic AudioContext initialization on first user interaction
   * (VRButton click, pointerdown, pinch, or keydown)
   */
  private setupAutoResumeListeners(): void {
    const resumeHandler = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', resumeHandler);
      window.removeEventListener('keydown', resumeHandler);
      window.removeEventListener('touchstart', resumeHandler);
    };

    window.addEventListener('pointerdown', resumeHandler, { once: true });
    window.addEventListener('keydown', resumeHandler, { once: true });
    window.addEventListener('touchstart', resumeHandler, { once: true });

    // Also watch VR Button click
    const vrBtn = document.getElementById('vr-button-element');
    if (vrBtn) {
      vrBtn.addEventListener('click', () => this.ensureContext());
    }
  }

  /**
   * Ensures AudioContext and the Cathedral Delay/Reverb Bus are created
   */
  public ensureContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.listener = this.audioCtx.listener;
        this.setupCathedralDelayBus();
        this.isInitialized = true;
        console.log('[SpatialSynth] Procedural HRTF Web Audio Synthesizer & Cathedral Bus initialized.');
      }
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.audioCtx && !this.isDroneActive) {
      this.initHarmonicDroneBed();
    }

    return this.audioCtx;
  }

  /**
   * Procedural Stereo Delay/Reverb Cathedral Feedback Bus & Phase 15 Convolution Reverb & Master Limiter
   */
  private setupCathedralDelayBus(): void {
    if (!this.audioCtx) return;

    // 1. Master Dynamics Limiter (Tuned threshold -10dB, ratio 6:1 to prevent digital clipping on Quest 3)
    this.masterLimiter = this.audioCtx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-10.0, 0); // -10 dB
    this.masterLimiter.knee.setValueAtTime(12.0, 0);       // 12 dB soft knee
    this.masterLimiter.ratio.setValueAtTime(6.0, 0);       // 6:1 ratio
    this.masterLimiter.attack.setValueAtTime(0.003, 0);     // 3ms fast transparent attack
    this.masterLimiter.release.setValueAtTime(0.15, 0);    // 150ms release
    this.masterLimiter.connect(this.audioCtx.destination);

    // 2. Master Dry Output
    this.dryGain = this.audioCtx.createGain();
    this.dryGain.gain.setValueAtTime(0.85, 0);
    this.dryGain.connect(this.masterLimiter);

    // 3. Cathedral Delay Node (280ms acoustic room bounce)
    this.delayNode = this.audioCtx.createDelay(1.5);
    this.delayNode.delayTime.setValueAtTime(0.28, 0);

    // 4. Air-absorption Lowpass Filter for natural reflections
    this.delayFilter = this.audioCtx.createBiquadFilter();
    this.delayFilter.type = 'lowpass';
    this.delayFilter.frequency.setValueAtTime(2200, 0);

    // 5. Cathedral Feedback Gain (0.35 feedback ratio)
    this.feedbackGain = this.audioCtx.createGain();
    this.feedbackGain.gain.setValueAtTime(0.35, 0);

    // Wire delay feedback loop: Delay -> Filter -> FeedbackGain -> Delay
    this.delayNode.connect(this.delayFilter);
    this.delayFilter.connect(this.feedbackGain);
    this.feedbackGain.connect(this.delayNode);

    // 6. Wet Cathedral Delay Gain out to Master Limiter
    this.wetGain = this.audioCtx.createGain();
    this.wetGain.gain.setValueAtTime(0.35, 0);
    this.delayFilter.connect(this.wetGain);
    this.wetGain.connect(this.masterLimiter);

    // 7. Phase 15: Procedural Stereo Convolution Reverb (Exponential-decay velvet noise)
    this.setupProceduralConvolutionReverb();

    // 8. Phase 15: Living Harmonic Drone Bed
    this.initHarmonicDroneBed();
  }

  /**
   * Phase 15: Procedural Stereo Impulse Response Generator
   * Synthesizes an exponential-decay velvet stereo AudioBuffer at startup feeding
   * a ConvolverNode wet/dry bus so every pluck blooms in an infinite 3D acoustic space
   * without external .wav asset downloads.
   */
  private setupProceduralConvolutionReverb(): void {
    if (!this.audioCtx || !this.masterLimiter) return;

    try {
      const durationSec = 2.8;
      const decayRate = 3.2;
      const sampleRate = this.audioCtx.sampleRate;
      const numSamples = Math.floor(sampleRate * durationSec);
      const buffer = this.audioCtx.createBuffer(2, numSamples, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      // Synthesize velvet stereo impulse response
      const earlySamples = Math.floor(sampleRate * 0.035);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-decayRate * t);

        if (i < earlySamples) {
          // Specular early reflections at golden ratio time taps
          const isTap =
            i % Math.floor(sampleRate * 0.0053) === 0 ||
            i % Math.floor(sampleRate * 0.0089) === 0 ||
            i % Math.floor(sampleRate * 0.0143) === 0;
          if (isTap) {
            const signL = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.2);
            const signR = (Math.random() > 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.2);
            left[i] = signL * env * 0.9;
            right[i] = signR * env * 0.9;
          } else {
            left[i] = 0;
            right[i] = 0;
          }
        } else {
          // Diffuse velvet noise tail with air absorption damping
          const hfDamping = Math.exp(-t * 2.2);
          const noiseL = (Math.random() * 2.0 - 1.0) * env * (0.35 + 0.65 * hfDamping);
          const noiseR = (Math.random() * 2.0 - 1.0) * env * (0.35 + 0.65 * hfDamping);

          // Lowpass filter smoothing to soften noise into a warm cathedral bloom
          left[i] = i > 0 ? (noiseL + left[i - 1] * 0.35) * 0.74 : noiseL;
          right[i] = i > 0 ? (noiseR + right[i - 1] * 0.35) * 0.74 : noiseR;
        }
      }

      this.convolverNode = this.audioCtx.createConvolver();
      this.convolverNode.buffer = buffer;

      this.convolverGain = this.audioCtx.createGain();
      this.convolverGain.gain.setValueAtTime(0.38, 0); // Infinite bloom level

      this.convolverNode.connect(this.convolverGain);
      this.convolverGain.connect(this.masterLimiter);

      console.log('[SpatialSynth] Procedural Velvet Stereo Convolution Reverb ready.');
    } catch (e) {
      console.warn('[SpatialSynth] Failed to setup procedural convolution reverb:', e);
    }
  }

  /**
   * Phase 15: Living Harmonic Drone Bed
   * A velocity-coupled, low-CPU 3-oscillator warm pad that tracks the root and fifth
   * of the active Loom nodes, swelling gently as more strings are connected and ducking
   * cleanly during fast arpeggios.
   */
  private initHarmonicDroneBed(): void {
    if (!this.audioCtx || !this.masterLimiter || this.isDroneActive) return;

    try {
      const now = this.audioCtx.currentTime;

      // 1. Osc 1: Warm Root Triangle (with subtle -4 cents detune)
      this.droneOscRoot = this.audioCtx.createOscillator();
      this.droneOscRoot.type = 'triangle';
      this.droneOscRoot.frequency.setValueAtTime(this.currentDroneRoot, now);
      this.droneOscRoot.detune.setValueAtTime(-4, now);

      // 2. Osc 2: Smooth Fifth Sine (with subtle +4 cents detune)
      this.droneOscFifth = this.audioCtx.createOscillator();
      this.droneOscFifth.type = 'sine';
      this.droneOscFifth.frequency.setValueAtTime(this.currentDroneRoot * 1.5, now);
      this.droneOscFifth.detune.setValueAtTime(4, now);

      // 3. Osc 3: Deep Sub-Octave Triangle (Root / 2)
      this.droneOscSub = this.audioCtx.createOscillator();
      this.droneOscSub.type = 'triangle';
      this.droneOscSub.frequency.setValueAtTime(this.currentDroneRoot * 0.5, now);

      // Mix individual oscillator weights
      const gainRoot = this.audioCtx.createGain();
      gainRoot.gain.setValueAtTime(0.40, now);
      this.droneOscRoot.connect(gainRoot);

      const gainFifth = this.audioCtx.createGain();
      gainFifth.gain.setValueAtTime(0.30, now);
      this.droneOscFifth.connect(gainFifth);

      const gainSub = this.audioCtx.createGain();
      gainSub.gain.setValueAtTime(0.35, now);
      this.droneOscSub.connect(gainSub);

      // Warm Analog Lowpass Filter (450Hz warmth with gentle resonance)
      this.droneFilter = this.audioCtx.createBiquadFilter();
      this.droneFilter.type = 'lowpass';
      this.droneFilter.frequency.setValueAtTime(450, now);
      this.droneFilter.Q.setValueAtTime(1.8, now);

      gainRoot.connect(this.droneFilter);
      gainFifth.connect(this.droneFilter);
      gainSub.connect(this.droneFilter);

      // Fast-acting Ducking Gain for Pluck Arpeggios
      this.droneDuckingGain = this.audioCtx.createGain();
      this.droneDuckingGain.gain.setValueAtTime(1.0, now);
      this.droneFilter.connect(this.droneDuckingGain);

      // Master Swell Gain (coupled to string count)
      this.droneGain = this.audioCtx.createGain();
      this.droneGain.gain.setValueAtTime(0.0, now); // Starts silent until strings are woven
      this.droneDuckingGain.connect(this.droneGain);

      // Route into Master Limiter and Convolution Reverb bloom
      this.droneGain.connect(this.masterLimiter);
      if (this.convolverNode) {
        this.droneGain.connect(this.convolverNode);
      }

      // Start all 3 oscillators
      this.droneOscRoot.start(now);
      this.droneOscFifth.start(now);
      this.droneOscSub.start(now);

      this.isDroneActive = true;
      console.log('[SpatialSynth] Living Harmonic Drone Bed active.');
    } catch (e) {
      console.warn('[SpatialSynth] Failed to init harmonic drone bed:', e);
    }
  }

  /**
   * Fast-acting velocity-coupled ducking during fast arpeggios
   */
  public triggerDroneDucking(velocity: number = 1.0): void {
    if (!this.audioCtx || !this.droneDuckingGain) return;
    try {
      const now = this.audioCtx.currentTime;
      const duckDepth = Math.max(0.25, 1.0 - Math.min(1.0, velocity * 0.75));
      this.droneDuckingGain.gain.cancelScheduledValues(now);
      this.droneDuckingGain.gain.setValueAtTime(this.droneDuckingGain.gain.value, now);
      this.droneDuckingGain.gain.linearRampToValueAtTime(duckDepth, now + 0.02);
      this.droneDuckingGain.gain.setTargetAtTime(1.0, now + 0.04, 0.45);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Updates drone pad root & fifth, and swells volume with string count
   */
  public updateDroneBed(activeFrequencies: number[], stringCount: number): void {
    if (!this.audioCtx || !this.droneGain) return;

    try {
      const now = this.audioCtx.currentTime;

      // 1. Swell gain coupled to string count
      let targetVolume = 0.0;
      if (stringCount === 1) targetVolume = 0.06;
      else if (stringCount === 2) targetVolume = 0.11;
      else if (stringCount >= 3) targetVolume = Math.min(0.22, 0.11 + stringCount * 0.02);

      this.droneGain.gain.setTargetAtTime(targetVolume, now, 0.6);

      // 2. Track key center (lowest harmonic frequency among active nodes)
      if (activeFrequencies && activeFrequencies.length > 0) {
        let lowest = activeFrequencies[0];
        for (const f of activeFrequencies) {
          if (f < lowest) lowest = f;
        }

        // Normalize root to bass octave [65Hz, 196Hz]
        while (lowest > 200.0) lowest *= 0.5;
        while (lowest < 65.0) lowest *= 2.0;

        if (Math.abs(lowest - this.currentDroneRoot) > 1.0) {
          this.currentDroneRoot = lowest;
          if (this.droneOscRoot && this.droneOscFifth && this.droneOscSub) {
            this.droneOscRoot.frequency.setTargetAtTime(this.currentDroneRoot, now, 0.45);
            this.droneOscFifth.frequency.setTargetAtTime(this.currentDroneRoot * 1.5, now, 0.45);
            this.droneOscSub.frequency.setTargetAtTime(this.currentDroneRoot * 0.5, now, 0.45);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Updates Web Audio listener position and orientation every frame from Three.js camera
   */
  public updateListener(camera: THREE.Camera): void {
    if (!this.audioCtx || !this.listener) return;

    const now = this.audioCtx.currentTime;
    const camPos = new THREE.Vector3();
    const camForward = new THREE.Vector3();
    const camUp = new THREE.Vector3(0, 1, 0);

    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camForward);
    camUp.applyQuaternion(camera.quaternion);

    if (this.listener.positionX) {
      this.listener.positionX.setValueAtTime(camPos.x, now);
      this.listener.positionY.setValueAtTime(camPos.y, now);
      this.listener.positionZ.setValueAtTime(camPos.z, now);
      this.listener.forwardX.setValueAtTime(camForward.x, now);
      this.listener.forwardY.setValueAtTime(camForward.y, now);
      this.listener.forwardZ.setValueAtTime(camForward.z, now);
      this.listener.upX.setValueAtTime(camUp.x, now);
      this.listener.upY.setValueAtTime(camUp.y, now);
      this.listener.upZ.setValueAtTime(camUp.z, now);
    } else {
      // Backward compatibility fallback for WebKit
      (this.listener as any).setPosition(camPos.x, camPos.y, camPos.z);
      (this.listener as any).setOrientation(
        camForward.x,
        camForward.y,
        camForward.z,
        camUp.x,
        camUp.y,
        camUp.z
      );
    }
  }

  /**
   * Plays a 3D HRTF Spatialized Note with dual oscillator blend, biquad filter sweep,
   * fast 0.01s attack, and 1.2s exponential decay envelope.
   */
  public playSpatialNote(options: NoteVoiceOptions): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryGain || !this.delayNode) return;

    try {
      const now = ctx.currentTime;
      const intensity = options.intensity ?? 1.0;
      const duration = options.duration ?? 1.2;
      const harmonicMul = options.harmonicMultiplier ?? 2.0;
      const filterFreq = options.filterCutoff ?? 3200;

      // 1. Dual Oscillators: Fundamental Sine + Warm Triangle
      const oscSine = ctx.createOscillator();
      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(options.frequency, now);

      const oscTri = ctx.createOscillator();
      oscTri.type = 'triangle';
      oscTri.frequency.setValueAtTime(options.frequency * harmonicMul, now);

      // Balance harmonic mix
      const triGain = ctx.createGain();
      triGain.gain.setValueAtTime(0.35, now);
      oscTri.connect(triGain);

      // 2. Biquad Filter (Lowpass sweep from bright chime to acoustic warmth)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + duration * 0.85);

      // 3. ADSR Amplitude Envelope: Fast 0.01s attack, smooth 1.2s exponential decay
      const voiceGain = ctx.createGain();
      const peakAmp = 0.24 * Math.min(1.6, Math.max(0.3, intensity));
      voiceGain.gain.setValueAtTime(0.0001, now);
      voiceGain.gain.linearRampToValueAtTime(peakAmp, now + 0.01);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // 4. 3D HRTF Panner positioned at exact Three.js world coordinates
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.35;
      panner.maxDistance = 12.0;
      panner.rolloffFactor = 1.0;
      panner.coneInnerAngle = 360;

      if (panner.positionX) {
        panner.positionX.setValueAtTime(options.position.x, now);
        panner.positionY.setValueAtTime(options.position.y, now);
        panner.positionZ.setValueAtTime(options.position.z, now);
      } else {
        (panner as any).setPosition(
          options.position.x,
          options.position.y,
          options.position.z
        );
      }

      // 5. Connect Signal Chain:
      // Oscillators -> Filter -> VoiceGain -> HRTF Panner -> [Master Dry + Cathedral Delay Bus]
      oscSine.connect(filter);
      triGain.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(panner);

      panner.connect(this.dryGain);
      panner.connect(this.delayNode);
      if (this.convolverNode) {
        panner.connect(this.convolverNode);
      }

      // Start & Stop with automatic garbage cleanup
      oscSine.start(now);
      oscTri.start(now);
      oscSine.stop(now + duration + 0.05);
      oscTri.stop(now + duration + 0.05);
    } catch (e) {
      console.warn('[SpatialSynth] Audio playback note safeguard:', e);
    }
  }

  /**
   * Synthesizes a realistic physical early-reflection stereo echo
   * when a Chrono-Pulse or Photon Dart bounces off a real-world wall or table.
   * Uses real room dimensions (distance to listener) to compute acoustic slapback delay,
   * frequency-dependent material absorption (drywall vs wood), and 3D HRTF spatialization.
   */
  public playWallReflectionEcho(
    hitPoint: THREE.Vector3,
    distanceToListener: number,
    surfaceType: 'wall' | 'table' | 'desk' | 'floor' = 'wall',
    sourceFrequency: number = 440
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.dryGain) return;

    try {
      const now = ctx.currentTime;

      // 1. Acoustic Slapback Delay modeled after real speed of sound (343 m/s)
      // Slapback time = 2 * d / 343, clamped between 12ms and 65ms for crisp, audible Haas reflection
      const physicalDelaySec = THREE.MathUtils.clamp((distanceToListener * 2) / 343.0, 0.012, 0.065);

      // 2. High-Frequency Absorption based on material
      // Drywall/plaster walls absorb high frequencies (~1800Hz lowpass)
      // Wood/composite tables absorb mid-highs (~1200Hz lowpass)
      const cutoffFreq = surfaceType === 'table' || surfaceType === 'desk' ? 1300 : 2200;

      // 3. Early Reflection Tone: Filtered short transient chirp at harmonic octave
      const osc = ctx.createOscillator();
      osc.type = surfaceType === 'table' || surfaceType === 'desk' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(sourceFrequency * 1.5, now + physicalDelaySec);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(60, sourceFrequency * 0.75),
        now + physicalDelaySec + 0.12
      );

      // 4. Acoustic Absorption Filter
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoffFreq, now + physicalDelaySec);

      // 5. Amplitude Envelope: Brief slapback pulse
      const gain = ctx.createGain();
      // Inverse distance attenuation based on real room dimensions
      const distanceAttenuation = THREE.MathUtils.clamp(1.0 / (distanceToListener * 1.2 + 0.5), 0.2, 1.1);
      const peakAmp = 0.16 * distanceAttenuation;

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.setValueAtTime(0.0001, now + physicalDelaySec);
      gain.gain.linearRampToValueAtTime(peakAmp, now + physicalDelaySec + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + physicalDelaySec + 0.14);

      // 6. 3D HRTF Panner located at the exact wall/table bounce coordinates
      const panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 0.4;
      panner.maxDistance = 15.0;
      panner.rolloffFactor = 1.0;

      if (panner.positionX) {

// [Chrono-Loom Milestone 18/25] refactor(audio): streamline SpatialSynth note triggering API with options object
