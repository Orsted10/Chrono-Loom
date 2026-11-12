import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine } from './LoomEngine.js';
import { ConstellationMode } from './ConstellationMode.js';
import { AgentAria } from './AgentAria.js';

export interface DemoKeyframe {
  time: number;
  leftPos: THREE.Vector3;
  leftPinch: boolean;
  rightPos: THREE.Vector3;
  rightPinch: boolean;
  actName: string;
  actDesc: string;
  onEnter?: () => void;
}

export class DemoDirector {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private constellationMode: ConstellationMode;
  private agentAria: AgentAria;

  // Showcase state
  public isPlaying = false;
  public elapsedTime = 0;
  public readonly TOTAL_DURATION = 45.0;

  // 3D Cinematic Title Banner
  private bannerGroup: THREE.Group;
  private bannerSprite: THREE.Sprite | null = null;
  public currentAct = '';

  // Original Camera State for smooth restoration
  private origRigPos = new THREE.Vector3(0, 1.2, 0);
  private origRigRot = new THREE.Euler(0, 0, 0);

  // Reusable vectors for zero-garbage performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();

  // Internal choreographed timeline milestones
  private hasAwakened = false;
  private hasSpawnedNode1 = false;
  private hasSpawnedNode2 = false;
  private hasSpawnedNode3 = false;

// [Chrono-Loom Milestone 1/9] feat(demo): initialize DemoDirector.ts for hands-free video capture showcase
