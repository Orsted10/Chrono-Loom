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
      noteName: note,
      shapeName: 'CUBE',
      description: 'Bass Anchor (Heavy Resonance)'
    };
  } else if (freq < 460) {
    // Mid Tier (205 - 460 Hz): Crystalline Octahedron
    let note = 'C4';
    if (freq > 420) note = 'A4';
    else if (freq > 380) note = 'G4';
    else if (freq > 350) note = 'F#4';
    else if (freq > 310) note = 'E4';
    else if (freq > 280) note = 'D4';
    else if (freq > 240) note = 'B3';
    else if (freq > 210) note = 'A3';
    return {
      tier: 'MID',
      noteName: note,
      shapeName: 'OCTAHEDRON',
      description: 'Harmonic Core (Warm Lydian)'
    };
  } else {
    // High Tier (> 460 Hz): Star / Stellated Tetrahedron
    let note = 'C5';
    if (freq > 620) note = 'E5';
    else if (freq > 560) note = 'D5';
    else if (freq > 480) note = 'B4';
    return {
      tier: 'HIGH',
      noteName: note,
      shapeName: 'TETRAHEDRON',
      description: 'Crystal Bell (Sparkling Overtone)'
    };
  }
}

export class AccessibilityManager {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;

// [Chrono-Loom Milestone 2/19] feat(a11y): implement One-Handed Complete Playability mode for limited mobility
