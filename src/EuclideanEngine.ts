import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { LoomEngine, HarmonicNode } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';

export const ALLOWED_EUCLIDEAN_STEPS = [3, 4, 5, 7, 8, 12, 16] as const;
export type EuclideanStepCount = typeof ALLOWED_EUCLIDEAN_STEPS[number];

export interface ScalePreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  keyNumber: number;
  frequencies: number[];
  noteNames: string[];
  palette: {
    primaryColor: THREE.Color;
    accentColor: THREE.Color;
    cymaticColor: THREE.Color;
    ambientColor: THREE.Color;
    backgroundFogColor: THREE.Color;
  };
}

export interface EuclideanRingConfig {
  k: number;
  n: EuclideanStepCount;
  pattern: boolean[];
  ringGroup: THREE.Group;
  guideRing: THREE.Line;
  pipMeshes: THREE.Mesh[];
  playheadMesh: THREE.Mesh;
  labelSprite: THREE.Sprite;
  labelCanvas: HTMLCanvasElement;
  labelTexture: THREE.CanvasTexture;
  currentStep: number;
  lastTriggeredStep: number;
  pipScales: number[];
}

/**
 * Bjorklund's Euclidean Algorithm E(k, n)
 * Generates an array of n booleans with k active hits distributed as evenly as possible.
 */
export function computeBjorklundPattern(k: number, n: number): boolean[] {
  k = Math.max(0, Math.min(k, n));
  if (n <= 0) return [];
  if (k === 0) return new Array(n).fill(false);
  if (k === n) return new Array(n).fill(true);

  let ones: number[][] = Array.from({ length: k }, () => [1]);
  let zeros: number[][] = Array.from({ length: n - k }, () => [0]);

  while (zeros.length > 0) {
    if (zeros.length <= 1) {
      ones = ones.concat(zeros);
      break;
    }
    const minLen = Math.min(ones.length, zeros.length);
    for (let i = 0; i < minLen; i++) {
      ones[i] = ones[i].concat(zeros.pop()!);
    }
    if (zeros.length > 0 && ones.length < zeros.length) {
      const remainder = zeros;
      zeros = ones;
      ones = remainder;
    }
  }

  return ones.flat().map((v) => v === 1);
}

export function getEuclideanRhythmName(k: number, n: number): string {
  if (n === 8 && k === 3) return 'Tresillo (Cuban / Habanera)';
  if (n === 8 && k === 5) return 'Cinquillo (Calypso / Tango)';
  if (n === 16 && k === 7) return 'Samba (Brazilian)';
  if (n === 12 && k === 7) return 'Bembé (West African Bell)';
  if (n === 12 && k === 5) return 'Venda (South African)';
  if (n === 5 && k === 2) return 'Khafif-e-ramal';
  if (n === 5 && k === 3) return 'Cumbia / Persian';
  if (n === 7 && k === 4) return 'Ruchenitza (Bulgarian)';
  if (n === 3 && k === 2) return 'Swing / Shuffle';
  if (n === 4 && k === 1) return 'Quarter Downbeat';
  if (n === 4 && k === 2) return 'Backbeat / Half-Time';
  if (n === 4 && k === 3) return 'Dotted Syncopation';
  if (n === 4 && k === 4) return 'Four-on-the-Floor';
  if (n === 16 && k === 4) return 'Classic 4/4 Pulse';
  if (n === 16 && k === 9) return 'Central African 9/16';
  if (n === 16 && k === 11) return 'Frank Zappa 11/16';
  return `Euclidean E(${k}, ${n})`;
}

/**
 * 5 Curated Spatial Scale Presets
 */
export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: 'celestial_lydian',
    name: 'Celestial Lydian',
    shortName: 'Lydian',
    description: 'Resonant, ethereal, uplifting sci-fi harmony with raised 4th',
    keyNumber: 1,
    frequencies: [
      130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, // Octave 3
      261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, // Octave 4
      523.25, 587.33, 659.25                                   // Octave 5
    ],
    noteNames: ['C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'],
    palette: {
      primaryColor: new THREE.Color(0x00f0ff), // Cyan
      accentColor: new THREE.Color(0xffd700),  // Gold
      cymaticColor: new THREE.Color(0x00f0ff), // Cyan
      ambientColor: new THREE.Color(0x0a192f), // Indigo void
      backgroundFogColor: new THREE.Color(0x030712)
    }
  },
  {
    id: 'tokyo_midnight_hirajoshi',
    name: 'Tokyo Midnight Hirajoshi',
    shortName: 'Hirajoshi',
    description: 'Cinematic Japanese pentatonic synthwave (1, 2, b3, 5, b6)',
    keyNumber: 2,
    frequencies: [
      110.00, 123.47, 130.81, 164.81, 174.61, // Octave 2/3
      220.00, 246.94, 261.63, 329.63, 349.23, // Octave 3/4
      440.00, 493.88, 523.25, 659.25, 698.46, // Octave 4/5
      880.00
    ],
    noteNames: ['A2', 'B2', 'C3', 'E3', 'F3', 'A3', 'B3', 'C4', 'E4', 'F4', 'A4', 'B4', 'C5', 'E5', 'F5', 'A5'],
    palette: {
      primaryColor: new THREE.Color(0xf43f5e), // Neon Rose
      accentColor: new THREE.Color(0xc084fc),  // Electric Violet
      cymaticColor: new THREE.Color(0xd946ef), // Cyber Pink
      ambientColor: new THREE.Color(0x1a0526), // Deep violet
      backgroundFogColor: new THREE.Color(0x090111)
    }
  },
  {
    id: 'raga_yaman_evening',
    name: 'Raga Yaman Evening',
    shortName: 'Raga Yaman',
    description: 'Ancient meditative North Indian Kalyan evening thaat (Tivra Ma)',
    keyNumber: 3,
    frequencies: [
      130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, // C3 to B3
      261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, // C4 to B4
      523.25, 587.33, 659.25, 783.99                          // C5 to G5
    ],
    noteNames: ['Sa3', 'Re3', 'Ga3', 'Ma#3', 'Pa3', 'Dha3', 'Ni3', 'Sa4', 'Re4', 'Ga4', 'Ma#4', 'Pa4', 'Dha4', 'Ni4', 'Sa5', 'Re5', 'Ga5', 'Pa5'],
    palette: {
      primaryColor: new THREE.Color(0xf59e0b), // Amber Gold
      accentColor: new THREE.Color(0xfbbf24),  // Saffron Glow
      cymaticColor: new THREE.Color(0xea580c), // Sunset Orange
      ambientColor: new THREE.Color(0x241002), // Warm Amber Dusk
      backgroundFogColor: new THREE.Color(0x0c0500)
    }
  },
  {
    id: 'dorian_cyber_noir',
    name: 'Dorian Cyber-Noir',
    shortName: 'Dorian Noir',
    description: 'Nocturnal cyberpunk Blade Runner groove (1, 2, b3, 4, 5, 6, b7)',
    keyNumber: 4,
    frequencies: [
      73.42, 87.31, 110.00, 130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, // D2-B3
      261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33        // C4-D5

// [Chrono-Loom Milestone 2/9] feat(euclidean): implement Bjorklund algorithm E(k, n) for Euclidean rhythm steps
