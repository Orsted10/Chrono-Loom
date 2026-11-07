import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';
import { AgentAria } from './AgentAria.js';

export type GameMode = 'FREEFORM' | 'DAILY_CONSTELLATION';

export interface TargetResonanceRing {
  id: string;
  position: THREE.Vector3;
  meshGroup: THREE.Group;
  torusMesh: THREE.Mesh;
  glowLight: THREE.PointLight;
  targetFrequency: number;
  baseColor: THREE.Color;
  energizedColor: THREE.Color;
  isEnergized: boolean;
  energizeTime: number;
}

export class ConstellationMode {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;
  private agentAria: AgentAria;

  // Root container
  public modeGroup: THREE.Group;

  // Current Game Mode
  public currentMode: GameMode = 'DAILY_CONSTELLATION';

  // Phase 11: Cooperative Multiplayer Constellation
  public isCoopMultiplayer = false;
  public onRingHit?: (ringId: string) => void;
  public onHarmonizedCoop?: () => void;
  private isApplyingRemote = false;

  // Phase 12: Scale Presets Wrist HUD Callback

// [Chrono-Loom Milestone 1/17] feat(constellation): create ConstellationMode.ts for Daily Challenge puzzles
