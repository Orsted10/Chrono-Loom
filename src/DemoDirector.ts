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
  private hasWovenStrings = false;
  private hasPlucked = false;
  private hasFistBumpedAria = false;

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    constellationMode: ConstellationMode,
    agentAria: AgentAria
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.constellationMode = constellationMode;
    this.agentAria = agentAria;

    this.bannerGroup = new THREE.Group();
    this.bannerGroup.name = 'DemoDirectorBanner';
    this.bannerGroup.position.set(0, 1.58, -0.85);
    this.bannerGroup.visible = false;
    this.sceneManager.scene.add(this.bannerGroup);

    // Yield control immediately on physical user interaction
    this.handInputManager.onUserInput = () => {
      if (this.isPlaying) {
        console.log('[DemoDirector] Physical user interaction detected -> yielding control back to user.');
        this.stopDemo();
      }
    };

    // Yield control on WebXR session start
    this.sceneManager.renderer.xr.addEventListener('sessionstart', () => {
      if (this.isPlaying) {
        this.stopDemo();
      }
    });
  }

  /**
   * Toggles the 45-second cinematic auto-showcase
   */
  public toggleDemo(): boolean {
    if (this.isPlaying) {
      this.stopDemo();
      return false;
    } else {
      this.startDemo();
      return true;
    }
  }

  /**
   * Starts the choreographed 45-second cinematic masterclass
   */
  public startDemo(): void {
    this.isPlaying = true;
    this.elapsedTime = 0;
    this.hasAwakened = false;
    this.hasSpawnedNode1 = false;
    this.hasSpawnedNode2 = false;
    this.hasSpawnedNode3 = false;
    this.hasWovenStrings = false;
    this.hasPlucked = false;
    this.hasFistBumpedAria = false;

    // Cache original camera rig transforms
    this.origRigPos.copy(this.sceneManager.cameraRig.position);
    this.origRigRot.copy(this.sceneManager.cameraRig.rotation);

    // Enable demo override in HandInputManager
    this.handInputManager.isDemoModeActive = true;

    // Reset Loom & Constellation Mode to pristine puzzle start
    this.loomEngine.resetLoom();
    this.agentAria.reset();
    this.constellationMode.initDailyPuzzle322();

    // Show banner
    this.bannerGroup.visible = true;
    this.updateBanner('ACT 1: AWAKENING THE SEED ORB', 'Pinching and pulling the golden seed orb open');

    // Initial hand rest positions
    this.handInputManager.setSimHandPose('left', new THREE.Vector3(-0.18, 1.03, -0.44), false);
    this.handInputManager.setSimHandPose('right', new THREE.Vector3(0.18, 1.03, -0.44), false);

    console.log('[DemoDirector] 🎬 AUTO-DIRECTOR SHOWCASE STARTED (45s Choreography). Press D or move mouse to exit.');
  }

  /**
   * Stops the demo and smoothly yields full control back to the user
   */
  public stopDemo(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.elapsedTime = 0;

    // Release any held virtual pinches
    this.handInputManager.setSimPinch('left', false);
    this.handInputManager.setSimPinch('right', false);
    this.handInputManager.isDemoModeActive = false;

    // Hide banner
    this.bannerGroup.visible = false;

    // Smoothly restore camera rig
    this.sceneManager.cameraRig.position.copy(this.origRigPos);
    this.sceneManager.cameraRig.rotation.copy(this.origRigRot);

    console.log('[DemoDirector] 🎬 AUTO-DIRECTOR SHOWCASE STOPPED. User has control.');
  }

  /**
   * Updates the 3D billboard banner displaying the current act
   */
  private updateBanner(actTitle: string, actDesc: string): void {
    if (this.currentAct === actTitle) return;
    this.currentAct = actTitle;

    if (this.bannerSprite) {
      this.bannerGroup.remove(this.bannerSprite);
      (this.bannerSprite.material as THREE.Material).dispose();
      this.bannerSprite = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Dark cyber glass pill with neon cyan/gold border
    ctx.fillStyle = 'rgba(7, 24, 45, 0.90)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    const x = 20, y = 20, w = 984, h = 216, r = 36;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + w, x, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;

    // Title
    ctx.font = 'bold 44px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`🎬 AUTO-DIRECTOR // ${actTitle}`, 512, 95);

    // Subtitle
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText(actDesc, 512, 148);

    // Hotkey Hint
    ctx.font = '18px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PRESS [D] OR MOVE MOUSE AT ANY TIME TO TAKE CONTROL', 512, 195);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.96,
      depthTest: false
    });

    this.bannerSprite = new THREE.Sprite(mat);
    this.bannerSprite.scale.set(0.65, 0.16, 1);
    this.bannerGroup.add(this.bannerSprite);
  }

  /**
   * Main per-frame choreographed timeline execution
   */
  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.elapsedTime += deltaTime;
    const t = this.elapsedTime;

    // Ensure camera rig looks at scene center
    this.bannerGroup.lookAt(this.sceneManager.camera.position);

    // -----------------------------------------------------------------
    // ACT 1: Seconds 0.0 - 6.0 | Awakening the Seed Orb
    // -----------------------------------------------------------------
    if (t < 6.0) {
      this.updateBanner('ACT 1: AWAKENING THE SEED ORB', 'Right hand pinches golden seed orb & pulls open');


// [Chrono-Loom Milestone 5/9] feat(demo): Phase 2: spawn harmonic nodes and weave multi-string constellation
