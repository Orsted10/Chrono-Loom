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

// [Chrono-Loom Milestone 1/9] feat(euclidean): initialize EuclideanEngine.ts for polyrhythm generation
