import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine } from './LoomEngine.js';
import { ConstellationMode } from './ConstellationMode.js';
import { AgentAria } from './AgentAria.js';
import { AccessibilityManager } from './AccessibilityManager.js';
import { EuclideanEngine } from './EuclideanEngine.js';
import { HarmonicVault } from './HarmonicVault.js';

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

/**
 * Phase 20: Multi-Angle Trailer Mode & Competition Submission Polish
 * 60-second 6-Act "OMG Director's Cut" cinematic masterclass choreography:
 * - Act 1: Awakening the Seed Orb (Tactile Pinch & Pull)
 * - Act 2: Weaving Constellation #322 (Bimanual Resonant Triangle)
 * - Act 3: 3D Arpeggio Plucking & Supernova Burst (Kinetic Collisions)
 * - Act 4: Agent Aria Co-Composer (AI Call-and-Response & Orbit Sweep)
 * - Act 5: Euclidean Polyrhythm Twist, Raga Yaman Scale & Quantum Strings
 * - Act 6: Zero-Fatigue Accessibility (Pull-Closer 0.35m + Sub-Bass Rings + Audio Vault)
 *
 * Smoothly blends dolly zooms, macro string close-ups, and seated POV shots
 * with automatic HUD hide/reveal choreography.
 */
export class DemoDirector {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private constellationMode: ConstellationMode;
  private agentAria: AgentAria;

  // Optional Phase 7, 12, 18 module references
  public accessibilityManager: AccessibilityManager | null = null;
  public euclideanEngine: EuclideanEngine | null = null;
  public harmonicVault: HarmonicVault | null = null;

  // Showcase state
  public isPlaying = false;
  public isTrailerCut = true;
  public isGodModePlaythrough = false;
  public elapsedTime = 0;
  public TOTAL_DURATION = 60.0; // 60s trailer or 180s god-mode walkthrough

  // 3D Cinematic Title Banner
  private bannerGroup: THREE.Group;
  private bannerSprite: THREE.Sprite | null = null;
  public currentAct = '';

  // Original Camera State for smooth restoration
  private origRigPos = new THREE.Vector3(0, 1.2, 0);
  private origRigRot = new THREE.Euler(0, 0, 0);

  // Dynamic Camera Rig Targets for Smooth Multi-Angle Blending
  private targetCamPos = new THREE.Vector3(0, 1.2, 0);
  private targetCamRot = new THREE.Euler(0, 0, 0);

  // Reusable vectors for zero-garbage performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();

  // Internal choreographed timeline milestone guards
  private hasAwakened = false;
  private hasSpawnedNode1 = false;
  private hasSpawnedNode2 = false;
  private hasSpawnedNode3 = false;
  private hasWovenStrings = false;
  private hasPlucked = false;
  private hasFistBumpedAria = false;
  private hasTwistedEuclidean = false;
  private hasShiftedScale = false;
  private hasActivatedCompactA11y = false;
  private hasTriggeredHapticWaves = false;
  private hasStartedAudioRecording = false;

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

  public setAccessibilityManager(a11y: AccessibilityManager): void {
    this.accessibilityManager = a11y;
  }

  public setEuclideanEngine(engine: EuclideanEngine): void {
    this.euclideanEngine = engine;
  }

  public setHarmonicVault(vault: HarmonicVault): void {
    this.harmonicVault = vault;
  }

  /**
   * Toggles the 60-second 6-Act "OMG Director's Cut" trailer
   */
  public toggleDemo(): boolean {
    if (this.isPlaying) {
      this.stopDemo();
      return false;
    } else {
      this.startDemo(true);
      return true;
    }
  }

  /**
   * Dedicated entry point for Shift+D or [TRAILER CUT] button
   */
  public startTrailerCut(): void {
    this.isGodModePlaythrough = false;
    this.TOTAL_DURATION = 60.0;
    this.startDemo(true);
  }

  /**
   * Dedicated entry point for 3-Minute "OMG God-Mode Playthrough"
   */
  public startGodModePlaythrough(): void {
    this.isGodModePlaythrough = true;
    this.TOTAL_DURATION = 180.0;
    this.startDemo(true);
  }

  /**
   * Starts the choreographed cinematic masterclass
   */
  public startDemo(isTrailer: boolean = true): void {
    this.isPlaying = true;
    this.isTrailerCut = isTrailer;
    this.elapsedTime = 0;

    // Reset timeline milestones
    this.hasAwakened = false;
    this.hasSpawnedNode1 = false;
    this.hasSpawnedNode2 = false;
    this.hasSpawnedNode3 = false;
    this.hasWovenStrings = false;
    this.hasPlucked = false;
    this.hasFistBumpedAria = false;
    this.hasTwistedEuclidean = false;
    this.hasShiftedScale = false;
    this.hasActivatedCompactA11y = false;
    this.hasTriggeredHapticWaves = false;
    this.hasStartedAudioRecording = false;

    // Cache original camera rig transforms
    this.origRigPos.copy(this.sceneManager.cameraRig.position);
    this.origRigRot.copy(this.sceneManager.cameraRig.rotation);
    this.targetCamPos.copy(this.origRigPos);
    this.targetCamRot.copy(this.origRigRot);

    // Enable demo override in HandInputManager
    this.handInputManager.isDemoModeActive = true;

    // Reset Loom & Constellation Mode to pristine puzzle start
    this.loomEngine.resetLoom();
    this.agentAria.reset();
    this.constellationMode.initDailyPuzzle322();

    // Reset scale to Celestial Lydian default
    if (this.euclideanEngine) {
      this.euclideanEngine.applyScalePreset(0, false);
    }

    // Reset workspace compact offset
    if (this.accessibilityManager) {
      this.accessibilityManager.setWorkspaceCompact(false);
    }

    // HUD Choreography: Fade non-essential HUD clutter for cinematic presentation
    if (typeof document !== 'undefined') {
      document.body.classList.add('trailer-cinematic-mode');
    }

    // Show 3D Title Banner
    this.bannerGroup.visible = true;
    this.updateBanner('ACT 1: AWAKENING THE SEED ORB', 'Right hand pinches golden seed orb & pulls open');

    // Initial hand rest positions
    this.handInputManager.setSimHandPose('left', new THREE.Vector3(-0.18, 1.03, -0.44), false);
    this.handInputManager.setSimHandPose('right', new THREE.Vector3(0.18, 1.03, -0.44), false);

    console.log('[DemoDirector] 🎬 6-ACT OMG DIRECTOR\'S CUT STARTED (60s Multi-Angle Choreography). Press D or move mouse to exit.');
  }

  /**
   * Stops the demo and smoothly yields full control back to the user
   */
  public stopDemo(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isGodModePlaythrough = false;
    this.elapsedTime = 0;

    // Release any held virtual pinches
    this.handInputManager.setSimPinch('left', false);
    this.handInputManager.setSimPinch('right', false);
    this.handInputManager.isDemoModeActive = false;

    // Hide banner
    this.bannerGroup.visible = false;

    // Restore HUD display
    if (typeof document !== 'undefined') {
      document.body.classList.remove('trailer-cinematic-mode');
    }

    // Stop audio recording if still running in demo
    if (this.harmonicVault && this.harmonicVault.isRecording) {
      this.harmonicVault.stopAudioRecording(false);
    }

    // Restore workspace compact mode
    if (this.accessibilityManager && this.accessibilityManager.isWorkspaceCompact) {
      this.accessibilityManager.setWorkspaceCompact(false);
    }

    // Smoothly restore camera rig
    this.sceneManager.cameraRig.position.copy(this.origRigPos);
    this.sceneManager.cameraRig.rotation.copy(this.origRigRot);

    console.log('[DemoDirector] 🎬 AUTO-DIRECTOR SHOWCASE STOPPED. User has full control.');
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
    const headerPrefix = this.isGodModePlaythrough ? '⚡ GOD-MODE PLAYTHROUGH' : '🎬 TRAILER CUT';
    ctx.fillText(`${headerPrefix} // ${actTitle}`, 512, 95);

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
    this.bannerSprite.scale.set(0.68, 0.17, 1);
    this.bannerGroup.add(this.bannerSprite);
  }

  /**
   * Main per-frame choreographed timeline execution
   */
  public update(deltaTime: number): void {
    if (!this.isPlaying) return;

    this.elapsedTime += deltaTime;
    // Map time to 60s normalized acts (so 180s God-Mode smoothly stretches across the full 3 minutes)
    const t = this.isGodModePlaythrough ? (this.elapsedTime / 180.0) * 60.0 : this.elapsedTime;

    // Always orient 3D banner towards camera
    this.bannerGroup.lookAt(this.sceneManager.camera.position);

    // Smoothly blend camera rig position & rotation toward target transforms (dolly / orbit smoothing)
    this.sceneManager.cameraRig.position.lerp(this.targetCamPos, 0.08);
    this.sceneManager.cameraRig.rotation.x = THREE.MathUtils.lerp(
      this.sceneManager.cameraRig.rotation.x,
      this.targetCamRot.x,
      0.08
    );
    this.sceneManager.cameraRig.rotation.y = THREE.MathUtils.lerp(
      this.sceneManager.cameraRig.rotation.y,
      this.targetCamRot.y,
      0.08
    );
    this.sceneManager.cameraRig.rotation.z = THREE.MathUtils.lerp(
      this.sceneManager.cameraRig.rotation.z,
      this.targetCamRot.z,
      0.08
    );

    // -----------------------------------------------------------------
    // ACT 1: Seconds 0.0 - 8.0 | Awakening the Seed Orb
    // Camera: Seated POV with gentle breathing dolly forward
    // -----------------------------------------------------------------
    if (t < 8.0) {
      this.updateBanner('ACT 1: AWAKENING THE SEED ORB', 'Right hand pinches golden seed orb & pulls open');

      // Camera: Seated eye-level with subtle forward drift into the orb
      this.targetCamPos.set(0, 1.20, -0.04 * (t / 8.0));
      this.targetCamRot.set(0, 0, 0);

      const seedOrbPos = new THREE.Vector3(0, 1.20, -0.45);
      const pullEndPos = new THREE.Vector3(0.14, 1.14, -0.38);

      if (t < 2.5) {
        // Right hand reaches from rest to Seed Orb
        const p = THREE.MathUtils.clamp(t / 2.2, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(new THREE.Vector3(0.18, 1.03, -0.44), seedOrbPos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 2.5 && t < 5.4) {
        // Pinch Seed Orb and pull outward
        const p = THREE.MathUtils.clamp((t - 2.5) / 2.6, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(seedOrbPos, pullEndPos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, true);
      } else if (t >= 5.4) {
        // Release pinch, triggering awakening
        this.handInputManager.setSimPinch('right', false);

        if (!this.hasAwakened) {
          this.hasAwakened = true;
          if (this.loomEngine.nodes.size === 0) {
            this.loomEngine.spawnHarmonicNode(new THREE.Vector3(0.14, 1.14, -0.38));
          }
        }
      }
    }

    // -----------------------------------------------------------------
    // ACT 2: Seconds 8.0 - 18.0 | Weaving Constellation #322
    // Camera: Angled macro high-quarter view looking down at geometry
    // -----------------------------------------------------------------
    else if (t >= 8.0 && t < 18.0) {
      this.updateBanner(
        'ACT 2: WEAVING THE CONSTELLATION',
        'Multi-hand bimanual weaving of resonant geometric strings'
      );

      // Camera: Macro high-quarter view from right
      this.targetCamPos.set(0.12, 1.30, -0.16);
      this.targetCamRot.set(-0.12, 0.14, 0);

      const ring1Pos = new THREE.Vector3(-0.18, 1.15, -0.44);
      const ring2Pos = new THREE.Vector3(0.00, 1.28, -0.46);
      const ring3Pos = new THREE.Vector3(0.18, 1.13, -0.43);

      if (t < 10.5) {
        // Left hand glides towards Ring 1
        const p = THREE.MathUtils.clamp((t - 8.0) / 2.3, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const lPos = this._v1.lerpVectors(new THREE.Vector3(-0.18, 1.03, -0.44), ring1Pos, smoothP);
        this.handInputManager.setSimHandPose('left', lPos, false);

        // Right hand hovers near Ring 3
        const rPos = this._v2.lerpVectors(new THREE.Vector3(0.14, 1.14, -0.38), ring3Pos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 10.5 && t < 11.2) {
        // Left hand pinches to spawn Node inside Ring 1
        this.handInputManager.setSimHandPose('left', ring1Pos, true);
        if (!this.hasSpawnedNode1) {
          this.hasSpawnedNode1 = true;
          this.loomEngine.spawnHarmonicNode(ring1Pos, 329.63);
        }
      } else if (t >= 11.2 && t < 13.8) {
        // Left hand drags from Ring 1 to Ring 2
        const p = THREE.MathUtils.clamp((t - 11.2) / 2.4, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const lPos = this._v1.lerpVectors(ring1Pos, ring2Pos, smoothP);
        this.handInputManager.setSimHandPose('left', lPos, true);
      } else if (t >= 13.8 && t < 14.8) {
        // Left hand releases at Ring 2, spawning Node 2 & weaving string
        this.handInputManager.setSimPinch('left', false);
        if (!this.hasSpawnedNode2) {
          this.hasSpawnedNode2 = true;
          this.loomEngine.spawnHarmonicNode(ring2Pos, 440.00);

          const allNodes = Array.from(this.loomEngine.nodes.values());
          if (allNodes.length >= 2) {
            this.loomEngine.createChronoString(allNodes[0], allNodes[1]);
          }
        }
      } else if (t >= 14.8 && t < 17.5) {
        // Right hand connects Ring 3 and completes triangle
        const p = THREE.MathUtils.clamp((t - 14.8) / 2.5, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v2.lerpVectors(ring3Pos, ring1Pos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, true);

        if (!this.hasSpawnedNode3 && t > 15.2) {
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
    // ACT 3: Seconds 18.0 - 28.0 | 3D Arpeggio Plucking & Supernova
    // Camera: Dynamic low-angle hero shot looking up through strings
    // -----------------------------------------------------------------
    else if (t >= 18.0 && t < 28.0) {
      this.updateBanner(
        'ACT 3: KINETIC PULSES & SUPERNOVA',
        'Sweeping spatial arpeggios energize rings & trigger supernova'
      );

      // Camera: Low-angle dramatic hero perspective
      this.targetCamPos.set(-0.08, 1.10, -0.14);
      this.targetCamRot.set(0.12, -0.08, 0);

      // Stroke 1 (t = 19.5 to 22.5): Right index sweeps through strings
      if (t >= 19.5 && t < 22.5) {
        const p = THREE.MathUtils.clamp((t - 19.5) / 2.8, 0, 1);
        const startStrum = new THREE.Vector3(-0.24, 1.22, -0.44);
        const endStrum = new THREE.Vector3(0.24, 1.18, -0.42);
        const strumPos = this._v1.lerpVectors(startStrum, endStrum, p);
        strumPos.y += Math.sin(p * Math.PI) * 0.04;

        this.handInputManager.setSimHandPose('right', strumPos, false);
      } else if (t >= 23.0 && t < 26.0) {
        // Stroke 2: Left index sweeps back in opposite direction
        const p = THREE.MathUtils.clamp((t - 23.0) / 2.6, 0, 1);
        const startStrum = new THREE.Vector3(0.22, 1.16, -0.42);
        const endStrum = new THREE.Vector3(-0.22, 1.24, -0.44);
        const strumPos = this._v1.lerpVectors(startStrum, endStrum, p);
        this.handInputManager.setSimHandPose('left', strumPos, false);
      }

      // Ensure pulses cascade through strings
      if (!this.hasPlucked && t >= 21.0) {
        this.hasPlucked = true;
        for (const str of this.loomEngine.strings.values()) {
          this.loomEngine.spawnChronoPulse(str.nodeA, str.nodeB, str);
        }
      }
    }

    // -----------------------------------------------------------------
    // ACT 4: Seconds 28.0 - 39.0 | Agent Aria Co-Composer Orbit
    // Camera: Wide 18-degree circular orbit sweep around workspace
    // -----------------------------------------------------------------
    else if (t >= 28.0 && t < 39.0) {
      this.updateBanner(
        'ACT 4: AGENT ARIA CO-COMPOSITION',
        'AI companion Call-and-Response with optical laser filaments'
      );

      // Camera: Cinematic smooth orbit
      const orbitProgress = (t - 28.0) / 11.0;
      const angle = Math.sin(orbitProgress * Math.PI) * 0.28; // ~16 degrees
      this.targetCamPos.set(Math.sin(angle) * 0.16, 1.22, (1 - Math.cos(angle)) * 0.10);
      this.targetCamRot.set(0, angle, 0);

      const ariaHomePos = new THREE.Vector3(0.35, 1.35, -0.50);

      // Right hand reaches up to Fist-Bump Aria (t = 29.0 to 31.5)
      if (t >= 29.0 && t < 31.5) {
        const p = THREE.MathUtils.clamp((t - 29.0) / 2.2, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const rPos = this._v1.lerpVectors(new THREE.Vector3(0.18, 1.12, -0.42), ariaHomePos, smoothP);
        this.handInputManager.setSimHandPose('right', rPos, false);
      } else if (t >= 31.5 && t < 33.0) {
        // Fist-Bump contact!
        if (!this.hasFistBumpedAria) {
          this.hasFistBumpedAria = true;
          this.agentAria.cycleAIMode(); // Cycles to RHYTHM BOOST
        }
        // Right hand returns to resting comfort arc
        const p = THREE.MathUtils.clamp((t - 31.5) / 1.2, 0, 1);
        const rPos = this._v1.lerpVectors(ariaHomePos, new THREE.Vector3(0.18, 1.03, -0.44), p);
        this.handInputManager.setSimHandPose('right', rPos, false);
      }
    }

    // -----------------------------------------------------------------
    // ACT 5: Seconds 39.0 - 50.0 | Euclidean Polyrhythm & Raga Scale
    // Camera: Extreme macro close-up of Quantum String standing waves & solitons
    // -----------------------------------------------------------------
    else if (t >= 39.0 && t < 50.0) {
      this.updateBanner(
        'ACT 5: EUCLIDEAN ENGINE & RAGA SCALE',
        'Bjorklund rhythm twist, sunset scale morph & GLSL standing waves'
      );

      // Camera: Extreme macro close-up right in front of the vibrating string
      this.targetCamPos.set(0.00, 1.20, -0.22);
      this.targetCamRot.set(0, 0, 0);

      const node1Pos = new THREE.Vector3(-0.18, 1.15, -0.44);

      // Left hand approaches Node 1 and performs a rotational twist gesture (t = 40.0 to 44.0)
      if (t >= 40.0 && t < 42.5) {
        const p = THREE.MathUtils.clamp((t - 40.0) / 2.2, 0, 1);
        const smoothP = this.easeInOutQuad(p);
        const lPos = this._v1.lerpVectors(new THREE.Vector3(-0.18, 1.03, -0.44), node1Pos, smoothP);
        this.handInputManager.setSimHandPose('left', lPos, true);
      } else if (t >= 42.5 && t < 45.5) {
        // Rotational twist interaction: shift scale preset to RAGA YAMAN EVENING
        if (!this.hasShiftedScale && this.euclideanEngine) {
          this.hasShiftedScale = true;
          this.euclideanEngine.applyScalePreset(2, true); // Preset 2 = Raga Yaman Evening
        }

        // Cycle Euclidean step count on first node
        if (!this.hasTwistedEuclidean && this.euclideanEngine) {
          this.hasTwistedEuclidean = true;
          const firstNode = Array.from(this.loomEngine.nodes.values())[0];
          if (firstNode) {
            this.euclideanEngine.cycleNodeStepCount(firstNode, 1);
          }
        }

        // Stimulate transverse standing-wave vibration on quantum strings
        for (const str of this.loomEngine.strings.values()) {
          str.vibrationAmplitude = 0.032;
          str.vibrationDecay = 1.1;
        }

        this.handInputManager.setSimPinch('left', false);
      } else {
        // Hands rest at comfort arc sides
        this.handInputManager.setSimHandPose('left', new THREE.Vector3(-0.18, 1.03, -0.44), false);
        this.handInputManager.setSimHandPose('right', new THREE.Vector3(0.18, 1.03, -0.44), false);
      }
    }

    // -----------------------------------------------------------------
    // ACT 6: Seconds 50.0 - 60.0 | Accessibility Suite & Audio Vault Capture
    // Camera: Restores smoothly to seated eye-level POV (0, 1.20, 0)
    // -----------------------------------------------------------------
    else if (t >= 50.0 && t <= 60.0) {
      this.updateBanner(
        'ACT 6: ACCESSIBILITY & AUDIO RECORDER',
        'Ergonomic seated auto-bring (0.35m), sub-bass waves & lossless loop capture'
      );

      // Camera: Pristine seated eye-level POV
      this.targetCamPos.set(0, 1.20, 0);
      this.targetCamRot.set(0, 0, 0);

      // Activate Ergonomic Seated Auto-Bring (Pull Closer to 0.35m radius)
      if (!this.hasActivatedCompactA11y && this.accessibilityManager) {
        this.hasActivatedCompactA11y = true;
        this.accessibilityManager.setWorkspaceCompact(true);
      }

      // Fire visual haptic waveform ripple rings (Deaf / Hard-of-Hearing visualization)
      if (!this.hasTriggeredHapticWaves && t >= 51.5) {
        this.hasTriggeredHapticWaves = true;
        for (const node of this.loomEngine.nodes.values()) {
          this.accessibilityManager?.triggerVisualHapticWave(node.position, 130.81, 1.8);
        }
      }

      // Trigger lossless audio loop recorder in HarmonicVault
      if (!this.hasStartedAudioRecording && this.harmonicVault && t >= 52.0) {
        this.hasStartedAudioRecording = true;
        this.harmonicVault.startAudioRecording();
      }

      // Grand Finale Title Banner at 57.5s
      if (t >= 57.5) {
        this.updateBanner(
          '✨ CHRONO-LOOM // COMPETITION ENTRY 2026',
          'Press [Shift+D] to replay // Press any key to take full control'
        );
      }
    }

    // -----------------------------------------------------------------
    // Conclude showcase after 60.0 seconds
    // -----------------------------------------------------------------
    if (t >= this.TOTAL_DURATION) {
      this.stopDemo();
    }
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}
