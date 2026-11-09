import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager, Handedness } from './HandInputManager.js';
import { LoomEngine, HarmonicNode } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';

export type PitchTier = 'BASS' | 'MID' | 'HIGH';

export interface PitchTierInfo {
  tier: PitchTier;
  noteName: string;
  shapeName: 'CUBE' | 'OCTAHEDRON' | 'TETRAHEDRON';
  description: string;
}

export interface VisualHapticWave {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  progress: number;
  speed: number;
  maxRadius: number;
  frequency: number;
  thickness: number;
  color: THREE.Color;
  active: boolean;
}

/**
 * Maps musical frequency to a distinct pitch tier and geometry
 * for Shape-Coded Synesthesia (Colorblind & Deaf friendly)
 */
export function getPitchTierInfo(freq: number): PitchTierInfo {
  if (freq < 205) {
    // Bass Tier (< 205 Hz): Cube / Hexagonal Prism
    let note = 'C3';
    if (freq > 180) note = 'F#3';
    else if (freq > 160) note = 'E3';
    else if (freq > 140) note = 'D3';
    return {
      tier: 'BASS',

// [Chrono-Loom Milestone 1/19] feat(a11y): initialize AccessibilityManager.ts for inclusive VR engineering
