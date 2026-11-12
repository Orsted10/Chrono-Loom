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

      const seedOrbPos = new THREE.Vector3(0, 1.20, -0.45);
      const pullEndPos = new THREE.Vector3(0.14, 1.14, -0.38);

      if (t < 2.2) {
        // Right hand reaches from rest to Seed Orb
        const p = THREE.MathUtils.clamp(t / 2.0, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(new THREE.Vector3(0.18, 1.03, -0.44), seedOrbPos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 2.2 && t < 4.8) {
        // Pinch Seed Orb and pull outward
        const p = THREE.MathUtils.clamp((t - 2.2) / 2.4, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(seedOrbPos, pullEndPos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, true);
      } else if (t >= 4.8) {
        // Release pinch, triggering awakening
        this.handInputManager.setSimPinch('right', false);

        if (!this.hasAwakened) {
          this.hasAwakened = true;
          // Spawn first node at release position if not yet spawned
          if (this.loomEngine.nodes.size === 0) {
            this.loomEngine.spawnHarmonicNode(new THREE.Vector3(0.14, 1.14, -0.38));
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // ACT 2: Seconds 6.0 - 20.0 | Weaving Constellation #322
    // -----------------------------------------------------------------
    else if (t >= 6.0 && t < 20.0) {
      this.updateBanner(
        'ACT 2: WEAVING CONSTELLATION #322',
        'Spawning harmonic nodes inside Target Rings & weaving strings'
      );

      // Target Rings are at:
      // Ring 1: (-0.18, 1.15, -0.44) (E4)
      // Ring 2: (0.00, 1.28, -0.46)  (A4)
      // Ring 3: (0.18, 1.13, -0.43)  (C5)

      const ring1Pos = new THREE.Vector3(-0.18, 1.15, -0.44);
      const ring2Pos = new THREE.Vector3(0.00, 1.28, -0.46);
      const ring3Pos = new THREE.Vector3(0.18, 1.13, -0.43);

      if (t < 9.5) {
        // Left hand glides towards Ring 1 (-0.18, 1.15, -0.44)
        const p = THREE.MathUtils.clamp((t - 6.0) / 2.8, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const lPos = this._v1.lerpVectors(new THREE.Vector3(-0.18, 1.03, -0.44), ring1Pos, smoothP);
        this.handInputManager.setSimHandPose('left', lPos, false);

        // Right hand rests near Ring 3
        const rPos = this._v2.lerpVectors(new THREE.Vector3(0.14, 1.14, -0.38), ring3Pos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 9.5 && t < 10.2) {
        // Left hand pinches to spawn Node inside Ring 1
        this.handInputManager.setSimHandPose('left', ring1Pos, true);
        if (!this.hasSpawnedNode1) {
          this.hasSpawnedNode1 = true;
          this.loomEngine.spawnHarmonicNode(ring1Pos, 329.63);
        }
      } else if (t >= 10.2 && t < 13.5) {
        // Left hand pinches and drags from Ring 1 to Ring 2
        const p = THREE.MathUtils.clamp((t - 10.2) / 3.0, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const lPos = this._v1.lerpVectors(ring1Pos, ring2Pos, smoothP);
        this.handInputManager.setSimHandPose('left', lPos, true);
      } else if (t >= 13.5 && t < 14.5) {
        // Left hand releases at Ring 2, spawning Node 2 & weaving string
        this.handInputManager.setSimPinch('left', false);
        if (!this.hasSpawnedNode2) {
          this.hasSpawnedNode2 = true;
          const node2 = this.loomEngine.spawnHarmonicNode(ring2Pos, 440.00);

          // Weave string from Node 1 to Node 2
          const allNodes = Array.from(this.loomEngine.nodes.values());
          if (allNodes.length >= 2) {
            this.loomEngine.createChronoString(allNodes[0], allNodes[1]);
          }
        }
      } else if (t >= 14.5 && t < 18.0) {
        // Right hand pinches Ring 3, spawning Node 3 and completing the triangle weave
        const p = THREE.MathUtils.clamp((t - 14.5) / 2.8, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v2.lerpVectors(ring3Pos, ring1Pos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, true);

        if (!this.hasSpawnedNode3 && t > 15.0) {
          this.hasSpawnedNode3 = true;
          const node3 = this.loomEngine.spawnHarmonicNode(ring3Pos, 523.25);
          const allNodes = Array.from(this.loomEngine.nodes.values());
          if (allNodes.length >= 3) {
            this.loomEngine.createChronoString(allNodes[1], node3);
            this.loomEngine.createChronoString(node3, allNodes[0]);
          }
        }
      } else {
        this.handInputManager.setSimPinch('right', false);
        this.handInputManager.setSimPinch('left', false);
      }
    }

    // -----------------------------------------------------------------
    // ACT 3: Seconds 20.0 - 30.0 | 3D Arpeggio Plucking & Supernova
    // -----------------------------------------------------------------
    else if (t >= 20.0 && t < 30.0) {
      this.updateBanner(
        'ACT 3: KINETIC PULSES & SUPERNOVA',
        'Strumming strings in 3D to energize target rings & trigger supernova'
      );

      // Sweeping strum stroke across strings from left to right
      // Stroke 1 (t = 21 to 24): Right index sweeps through strings
      if (t >= 21.0 && t < 24.5) {
        const p = THREE.MathUtils.clamp((t - 21.0) / 3.0, 0, 1);
        const startStrum = new THREE.Vector3(-0.24, 1.22, -0.44);
        const endStrum = new THREE.Vector3(0.24, 1.18, -0.42);
        const strumPos = this._v1.lerpVectors(startStrum, endStrum, p);
        strumPos.y += Math.sin(p * Math.PI) * 0.04; // Gentle arced stroke

        this.handInputManager.setSimHandPose('right', strumPos, false);
      } else if (t >= 25.0 && t < 28.0) {
        // Stroke 2: Left index sweeps back in opposite direction
        const p = THREE.MathUtils.clamp((t - 25.0) / 2.8, 0, 1);
        const startStrum = new THREE.Vector3(0.22, 1.16, -0.42);
        const endStrum = new THREE.Vector3(-0.22, 1.24, -0.44);
        const strumPos = this._v1.lerpVectors(startStrum, endStrum, p);
        this.handInputManager.setSimHandPose('left', strumPos, false);
      }

      // Ensure pulses cascade through strings
      if (!this.hasPlucked && t >= 23.0) {
        this.hasPlucked = true;
        for (const str of this.loomEngine.strings.values()) {
          this.loomEngine.spawnChronoPulse(str.nodeA, str.nodeB, str);
        }
      }
    }

    // -----------------------------------------------------------------
    // ACT 4: Seconds 30.0 - 45.0 | Agent Aria Co-Composition & Orbit
    // -----------------------------------------------------------------
    else if (t >= 30.0 && t <= 45.0) {
      this.updateBanner(
        'ACT 4: AGENT ARIA CO-COMPOSITION',
        'Fist-bumping Aria to activate Rhythm Boost & cinematic orbit sweep'
      );

      const ariaHomePos = new THREE.Vector3(0.35, 1.35, -0.50);

      // Right hand reaches up to Fist-Bump Aria (t = 30.5 to 33.0)
      if (t >= 30.5 && t < 33.0) {
        const p = THREE.MathUtils.clamp((t - 30.5) / 2.2, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(new THREE.Vector3(0.18, 1.12, -0.42), ariaHomePos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 33.0 && t < 34.0) {
        // Fist-Bump contact!
        if (!this.hasFistBumpedAria) {
          this.hasFistBumpedAria = true;
          this.agentAria.cycleAIMode(); // Cycles to RHYTHM BOOST
        }
        // Right hand returns to resting comfort arc
        const p = THREE.MathUtils.clamp((t - 33.0) / 1.0, 0, 1);
        const rPos = this._v1.lerpVectors(ariaHomePos, new THREE.Vector3(0.18, 1.03, -0.44), p);
        this.handInputManager.setSimHandPose('right', rPos, false);
      }

      // Slow 15-degree cinematic camera orbit around the sculpture
      if (t >= 34.5) {
        const orbitProgress = (t - 34.5) / 10.5;
        const angle = Math.sin(orbitProgress * Math.PI) * 0.24; // ~14 degrees
        this.sceneManager.cameraRig.rotation.y = this.origRigRot.y + angle;
        this.sceneManager.cameraRig.position.x = this.origRigPos.x + Math.sin(angle) * 0.14;
        this.sceneManager.cameraRig.position.z = this.origRigPos.z + (1 - Math.cos(angle)) * 0.08;
      }

      // Conclude showcase at 44.8s
      if (t >= 44.8) {
        this.updateBanner('✨ CHRONO-LOOM SHOWCASE COMPLETE', 'Press [D] to replay // Press any key to take control');
      }
    }

    // Auto-loop or conclude after total duration
    if (t >= this.TOTAL_DURATION) {
      this.stopDemo();
    }
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}

// [Chrono-Loom Milestone 9/9] test(demo): verify seamless manual takeover when user pinches during auto-demo
