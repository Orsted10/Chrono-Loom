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

// [Chrono-Loom Milestone 11/25] feat(audio): update AudioListener position and forward/up vectors from camera
