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
  public onScaleCycle?: () => void;

  // Accessibility Manager reference
  public accessibilityManager: any = null;

  public setAccessibilityManager(a11y: any): void {
    this.accessibilityManager = a11y;
  }

  // Target Resonance Rings
  public targetRings: TargetResonanceRing[] = [];
  private ringContainer: THREE.Group;
  private previewChimeTimer = 0;

  // Spatial Wrist HUD
  private hudGroup: THREE.Group;
  private defaultHudPos = new THREE.Vector3(-0.38, 1.35, -0.48);
  private buttons: {
    id: string;
    mesh: THREE.Mesh;
    labelSprite: THREE.Sprite;
    action: () => void;
    baseColor: number;
    hoverColor: number;
  }[] = [];

  // Victory Celebration State
  public isHarmonized = false;
  private victoryBanner: THREE.Sprite | null = null;
  private victoryTimer = 0;

  // Touch poke cooldown
  private lastButtonPressTime = 0;

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    spatialSynth: SpatialSynth,
    agentAria: AgentAria
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;

// [Chrono-Loom Milestone 2/17] feat(constellation): implement deterministic daily seed generator based on UTC date
