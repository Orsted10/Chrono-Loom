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

// [Chrono-Loom Milestone 6/25] feat(audio): implement fast attack (10ms) and exponential decay ADSR envelope
