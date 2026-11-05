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

// [Chrono-Loom Milestone 1/25] feat(aria): initialize AgentAria.ts for autonomous AI companion entity
