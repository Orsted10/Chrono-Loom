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


// [Chrono-Loom Milestone 3/25] feat(audio): handle suspended AudioContext lifecycle on Quest browser
