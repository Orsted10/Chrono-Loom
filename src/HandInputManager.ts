import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { SceneManager } from './SceneManager.js';

export type Handedness = 'left' | 'right';

export type PinchCallback = (
  hand: Handedness,
  midpoint: THREE.Vector3,
  distance: number
) => void;

export type GestureCallback = (hand: Handedness) => void;
export type ConductorTempoCallback = (bpm: number) => void;
export type ChordBloomCallback = (hand: Handedness, position: THREE.Vector3) => void;
export type AcousticScissorsCallback = (hand: Handedness, cutPoint: THREE.Vector3) => void;

export interface GestureConfidences {
  conductorFrame: number;
  chordBloom: number;
  acousticScissors: number;
  pinchWeave: number;
  openPalmFreeze: number;
}

export interface HandTelemetry {
  handedness: Handedness;
  isTracked: boolean;
  pinchDistance: number;
  isPinching: boolean;
  isOpenPalm: boolean;
  wristToFingerDistances: number[];
  indexTipPosition: THREE.Vector3;
  thumbTipPosition: THREE.Vector3;
  wristPosition: THREE.Vector3;
  middleTipPosition?: THREE.Vector3;
  pinkyTipPosition?: THREE.Vector3;
}

export const XR_HAND_JOINTS = [
  'wrist',
  'thumb-metacarpal',
  'thumb-phalanx-proximal',
  'thumb-phalanx-distal',

// [Chrono-Loom Milestone 1/33] feat(hands): initialize WebXR hand tracking input sources (getHand 0 & 1)
