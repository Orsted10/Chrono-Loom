import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine, HarmonicNode, ChronoString } from './LoomEngine.js';
import { DemoDirector } from './DemoDirector.js';

export type TutorialStep = 1 | 2 | 3 | 'COMPLETED';

interface GhostHandMesh {
  group: THREE.Group;
  wristMesh: THREE.Mesh;
  tipMeshes: THREE.Mesh[];
  boneLines: THREE.Line[];
  pinchLine: THREE.Line;
  glowLight: THREE.PointLight;
}

export class TutorialGuide {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private demoDirector: DemoDirector;

  // Tutorial State
  public isActive = false;
  public currentStep: TutorialStep = 1;
  public isDismissed = false;
  private stepTimer = 0;
  private celebrationTimer = 0;
  private isCelebrating = false;

  public readonly STORAGE_KEY = 'chronoloom_onboarded_v1';

  // 3D Scene Visuals
  public guideGroup: THREE.Group;
  private ghostHand!: GhostHandMesh;

  // 3D Billboard Step Badge
  private badgeGroup!: THREE.Group;
  private badgeCanvas!: HTMLCanvasElement;
  private badgeTexture!: THREE.CanvasTexture;
  private badgeSprite!: THREE.Sprite;

  // 3D Spatial Target Beacons & Tether Visualizer
  private beaconGroup!: THREE.Group;
  private beaconRingA!: THREE.Mesh;
  private beaconRingB!: THREE.Mesh;
  private guideTetherLine!: THREE.Line;
  private sweepArrowGroup!: THREE.Group;

  // Celebratory Sparkle Particles
  private sparkleMesh!: THREE.Points;
  private sparklePositions!: Float32Array;
  private sparkleVelocities!: Float32Array;
  private sparkleLives!: Float32Array;
  private readonly MAX_SPARKLES = 60;

  // Target coordinates for demonstration
  private seedOrbPos = new THREE.Vector3(0, 1.20, -0.45);
  private node1Pos = new THREE.Vector3(0, 1.20, -0.45);
  private node2Pos = new THREE.Vector3(0.20, 1.26, -0.42);

  // Reusable vectors for zero-allocation performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    demoDirector: DemoDirector
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.demoDirector = demoDirector;

    // 1. Root group for tutorial visuals
    this.guideGroup = new THREE.Group();
    this.guideGroup.name = 'TutorialGuideRoot';
    this.guideGroup.visible = false;
    this.sceneManager.scene.add(this.guideGroup);

    // 2. Build 3D Ghost Hand
    this.createGhostHand();

    // 3. Build Floating 3D Step Badge Billboard
    this.createStepBadge();

    // 4. Build 3D Spatial Beacons & Guideways
    this.createSpatialBeacons();

    // 5. Build Celebratory Sparkle Particle System
    this.createSparkleSystem();

    // 6. Hook LoomEngine physical action events
    this.hookLoomEvents();

    // 7. Auto-start on first visit if not onboarded and not loading shared link
    this.checkInitialAutoStart();
  }

  // ----------------------------------------------------
  // 1. 3D Ghost Hand Construction
  // ----------------------------------------------------

  private createGhostHand(): void {
    const group = new THREE.Group();
    group.name = 'TutorialGhostHand';

    // Wrist Sphere (Translucent radiant cyan)
    const wristGeo = new THREE.SphereGeometry(0.013, 10, 10);
    const wristMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const wristMesh = new THREE.Mesh(wristGeo, wristMat);
    group.add(wristMesh);

    // 5 Fingertips (Thumb, Index, Middle, Ring, Pinky)
    const tipMeshes: THREE.Mesh[] = [];
    const tipGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.9
    });

    const tipOffsets = [
      new THREE.Vector3(0.028, 0.042, -0.01),   // Thumb
      new THREE.Vector3(0.014, 0.074, -0.018),  // Index
      new THREE.Vector3(0.0, 0.080, -0.020),    // Middle
      new THREE.Vector3(-0.014, 0.070, -0.016), // Ring
      new THREE.Vector3(-0.026, 0.052, -0.012)  // Pinky
    ];

    const boneLines: THREE.Line[] = [];
    const boneMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < 5; i++) {
      const tipMesh = new THREE.Mesh(tipGeo, tipMat.clone());
      tipMesh.position.copy(tipOffsets[i]);
      group.add(tipMesh);
      tipMeshes.push(tipMesh);

      // Bone line linking wrist to fingertip
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        tipOffsets[i]
      ]);
      const line = new THREE.Line(lineGeo, boneMat);
      group.add(line);
      boneLines.push(line);
    }

    // Dynamic Pinch Filament (Thumb to Index)
    const pinchGeo = new THREE.BufferGeometry().setFromPoints([
      tipOffsets[0],
      tipOffsets[1]
    ]);
    const pinchMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      linewidth: 3,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const pinchLine = new THREE.Line(pinchGeo, pinchMat);
    pinchLine.visible = false;
    group.add(pinchLine);

    const glowLight = new THREE.PointLight(0x00f0ff, 1.2, 0.4);
    group.add(glowLight);

    this.ghostHand = { group, wristMesh, tipMeshes, boneLines, pinchLine, glowLight };
    this.guideGroup.add(group);
  }

  // ----------------------------------------------------
  // 2. 3D Step Badge Billboard Construction
  // ----------------------------------------------------

  private createStepBadge(): void {
    this.badgeGroup = new THREE.Group();
    this.badgeGroup.name = 'TutorialStepBadge';
    this.badgeGroup.position.set(0, 1.35, -0.45);

    this.badgeCanvas = document.createElement('canvas');
    this.badgeCanvas.width = 512;
    this.badgeCanvas.height = 160;

    this.badgeTexture = new THREE.CanvasTexture(this.badgeCanvas);
    this.badgeTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.badgeTexture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    this.badgeSprite = new THREE.Sprite(spriteMat);
    this.badgeSprite.scale.set(0.38, 0.118, 1);
    this.badgeGroup.add(this.badgeSprite);

    this.guideGroup.add(this.badgeGroup);
    this.renderBadgeContent('STEP 1/3', 'PINCH & PULL SEED ORB', 'Pinch golden orb and pull outward to awaken');
  }

  private renderBadgeContent(pill: string, title: string, subtitle: string, isDone = false): void {
    const ctx = this.badgeCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 160);

    // Glass Background Card
    ctx.fillStyle = 'rgba(8, 14, 28, 0.90)';
    ctx.strokeStyle = isDone ? '#10b981' : '#00f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 140, 20);
    ctx.fill();
    ctx.stroke();

    // Step Pill Badge
    ctx.fillStyle = isDone ? 'rgba(16, 185, 129, 0.25)' : 'rgba(0, 240, 255, 0.22)';
    ctx.strokeStyle = isDone ? '#10b981' : '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 22, 120, 28, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = isDone ? '#34d399' : '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText(pill, 84, 41);

    // Title
    ctx.shadowColor = isDone ? '#10b981' : '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, 160, 44);
    ctx.shadowBlur = 0;

    // Subtitle
    ctx.font = '500 16px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subtitle, 26, 96);

    // Accent line along bottom
    ctx.fillStyle = isDone ? '#10b981' : '#38bdf8';
    ctx.fillRect(26, 120, 460, 2);

    this.badgeTexture.needsUpdate = true;
  }

  // ----------------------------------------------------
  // 3. 3D Spatial Beacons & Guideways
  // ----------------------------------------------------

  private createSpatialBeacons(): void {
    this.beaconGroup = new THREE.Group();
    this.beaconGroup.name = 'TutorialBeacons';
    this.guideGroup.add(this.beaconGroup);

    // Target Ring A (Encircles Seed Orb or Node 1)
    const ringGeoA = new THREE.TorusGeometry(0.042, 0.0035, 12, 32);
    const ringMatA = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffd700,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85
    });
    this.beaconRingA = new THREE.Mesh(ringGeoA, ringMatA);
    this.beaconRingA.position.copy(this.seedOrbPos);
    this.beaconGroup.add(this.beaconRingA);

    // Target Ring B (For Node 2 in Step 2)
    const ringMatB = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.7,
      transparent: true,
      opacity: 0.85
    });
    this.beaconRingB = new THREE.Mesh(ringGeoA.clone(), ringMatB);
    this.beaconRingB.position.copy(this.node2Pos);
    this.beaconRingB.visible = false;
    this.beaconGroup.add(this.beaconRingB);

    // Guided Tether Line (Connecting Node 1 to Node 2)
    const tetherGeo = new THREE.BufferGeometry().setFromPoints([
      this.node1Pos,
      this.node2Pos
    ]);
    const tetherMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });
    this.guideTetherLine = new THREE.Line(tetherGeo, tetherMat);
    this.guideTetherLine.visible = false;
    this.beaconGroup.add(this.guideTetherLine);

    // Pluck Sweep Chevron (For Step 3)
    this.sweepArrowGroup = new THREE.Group();
    this.sweepArrowGroup.name = 'PluckSweepGuide';
    this.sweepArrowGroup.visible = false;

    const arrowGeo = new THREE.TorusGeometry(0.028, 0.003, 8, 24, Math.PI * 0.9);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
    arrowMesh.rotation.z = -Math.PI * 0.5;
    this.sweepArrowGroup.add(arrowMesh);

    this.beaconGroup.add(this.sweepArrowGroup);
  }

  // ----------------------------------------------------
  // 4. Celebratory Sparkle Particles
  // ----------------------------------------------------

  private createSparkleSystem(): void {
    const geo = new THREE.BufferGeometry();
    this.sparklePositions = new Float32Array(this.MAX_SPARKLES * 3);
    this.sparkleVelocities = new Float32Array(this.MAX_SPARKLES * 3);
    this.sparkleLives = new Float32Array(this.MAX_SPARKLES);

    for (let i = 0; i < this.MAX_SPARKLES; i++) {
      this.sparklePositions[i * 3 + 1] = -999;
      this.sparkleLives[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.sparklePositions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffd700,
      size: 0.016,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparkleMesh = new THREE.Points(geo, mat);
    this.sparkleMesh.name = 'TutorialCelebrationSparkles';
    this.guideGroup.add(this.sparkleMesh);
  }

  private triggerCelebrationSparkles(origin: THREE.Vector3): void {
    for (let i = 0; i < this.MAX_SPARKLES; i++) {
      const i3 = i * 3;
      this.sparklePositions[i3] = origin.x + (Math.random() - 0.5) * 0.04;
      this.sparklePositions[i3 + 1] = origin.y + (Math.random() - 0.5) * 0.04;
      this.sparklePositions[i3 + 2] = origin.z + (Math.random() - 0.5) * 0.04;

      this.sparkleVelocities[i3] = (Math.random() - 0.5) * 0.35;
      this.sparkleVelocities[i3 + 1] = (Math.random() - 0.2) * 0.35;
      this.sparkleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.35;

      this.sparkleLives[i] = 1.0 + Math.random() * 0.8;
    }

    const attr = this.sparkleMesh.geometry.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }

  // ----------------------------------------------------
  // 5. Hook Physical Action Events
  // ----------------------------------------------------

  private hookLoomEvents(): void {
    // Step 1 Trigger: User Awakens Loom
    this.loomEngine.addLoomAwakenedListener((spawnPos) => {
      if (this.isActive && this.currentStep === 1) {
        this.node1Pos.copy(spawnPos);
        this.advanceToStep(2);
      }
    });

    // Step 2 Trigger: User Weaves First ChronoString
    this.loomEngine.addStringCreatedListener((str) => {
      if (this.isActive && this.currentStep === 2) {
        this.advanceToStep(3);
      }
    });

    // Step 3 Trigger: User Plucks First ChronoString
    this.loomEngine.addStringPluckedListener((stringId, pos, vel, freq) => {
      if (this.isActive && this.currentStep === 3) {
        this.completeTutorial(pos);
      }
    });
  }

  // ----------------------------------------------------
  // 6. Initial Auto-Start & Replay Controls
  // ----------------------------------------------------

  private checkInitialAutoStart(): void {
    const isUrlHash = window.location.hash.startsWith('#loom=');
    let hasCompletedBefore = false;
    try {
      hasCompletedBefore = localStorage.getItem(this.STORAGE_KEY) === 'true';
    } catch (e) {
      // Storage access blocked or unavailable
    }

    // Auto-start unobtrusively on first visit after 800ms
    if (!isUrlHash && !hasCompletedBefore) {
      setTimeout(() => {
        if (!this.demoDirector.isPlaying && !this.isDismissed && !this.isActive) {
          this.startGuide();
        }
      }, 800);
    }
  }

  /**
   * Starts or restarts the 3-step spatial tutorial
   */
  public startGuide(force = false): void {
    if (this.demoDirector.isPlaying) {
      console.log('[TutorialGuide] Auto-Director is active -> skipping tutorial.');
      return;
    }

    this.isActive = true;
    this.isDismissed = false;
    this.guideGroup.visible = true;
    this.stepTimer = 0;
    this.celebrationTimer = 0;
    this.isCelebrating = false;

    // Determine starting step based on current Loom state
    if (!this.loomEngine.isAwakened) {
      this.currentStep = 1;
      this.setupStep1();
    } else if (this.loomEngine.strings.size === 0) {
      this.currentStep = 2;
      this.setupStep2();
    } else {
      this.currentStep = 3;
      this.setupStep3();
    }

    console.log(`[TutorialGuide] Started First-Pluck Onboarding Guide at Step ${this.currentStep}.`);
  }

  /**
   * Dismisses and hides the tutorial guide
   */
  public dismissGuide(): void {
    this.isActive = false;
    this.isDismissed = true;
    this.guideGroup.visible = false;
    console.log('[TutorialGuide] Tutorial Guide dismissed.');
  }

  /**
   * Toggles the guide on/off (via [? GUIDE] button or Key U)
   */
  public toggleGuide(): boolean {
    if (this.isActive) {
      this.dismissGuide();
      return false;
    } else {
      this.startGuide(true);
      return true;
    }
  }

  // ----------------------------------------------------
  // 7. Step Setup Functions
  // ----------------------------------------------------

  private setupStep1(): void {
    this.beaconRingA.position.copy(this.seedOrbPos);
    this.beaconRingA.visible = true;
    this.beaconRingB.visible = false;
    this.guideTetherLine.visible = false;
    this.sweepArrowGroup.visible = false;

    this.badgeGroup.position.set(0, 1.34, -0.45);
    this.renderBadgeContent('STEP 1/3', 'PINCH & PULL SEED ORB', 'Pinch golden orb and pull outward to awaken');

    // Chime cue
    this.loomEngine.spatialSynth.playSpatialNote({
      frequency: 440.0,
      position: this.seedOrbPos,
      intensity: 0.8,
      duration: 0.3
    });
  }

  private setupStep2(): void {
    // If only 1 node exists, ensure there is a second node to connect to
    if (this.loomEngine.nodes.size < 2) {
      // Find node 1
      for (const n of this.loomEngine.nodes.values()) {
        this.node1Pos.copy(n.position);
        break;
      }
      // Position target node 2 with harmonic interval
      this.node2Pos.set(this.node1Pos.x + 0.20, this.node1Pos.y + 0.06, this.node1Pos.z + 0.02);
      this.loomEngine.spawnHarmonicNode(this.node2Pos.clone());
    } else {
      const nodes = Array.from(this.loomEngine.nodes.values());
      this.node1Pos.copy(nodes[0].position);
      this.node2Pos.copy(nodes[1].position);
    }

    this.beaconRingA.position.copy(this.node1Pos);
    this.beaconRingA.visible = true;
    this.beaconRingB.position.copy(this.node2Pos);
    this.beaconRingB.visible = true;

    // Update guided tether line
    const positions = (this.guideTetherLine.geometry.attributes.position as THREE.BufferAttribute);
    positions.setXYZ(0, this.node1Pos.x, this.node1Pos.y, this.node1Pos.z);
    positions.setXYZ(1, this.node2Pos.x, this.node2Pos.y, this.node2Pos.z);
    positions.needsUpdate = true;
    this.guideTetherLine.visible = true;

    this.sweepArrowGroup.visible = false;

    const mid = this._v1.lerpVectors(this.node1Pos, this.node2Pos, 0.5);
    this.badgeGroup.position.set(mid.x, mid.y + 0.14, mid.z);
    this.renderBadgeContent('STEP 2/3', 'CONNECT TWO NODES', 'Pinch Node #1 and drag tether to Node #2');

    this.loomEngine.spatialSynth.playSpatialNote({
      frequency: 523.25,
      position: this.node1Pos,
      intensity: 0.9,
      duration: 0.4
    });
  }

  private setupStep3(): void {
    this.beaconRingA.visible = false;
    this.beaconRingB.visible = false;
    this.guideTetherLine.visible = false;

    // Find center of first string
    let stringCenter = new THREE.Vector3(0.10, 1.23, -0.44);
    for (const str of this.loomEngine.strings.values()) {
      stringCenter = this._v1.lerpVectors(str.nodeA.position, str.nodeB.position, 0.5).clone();
      break;
    }

    this.sweepArrowGroup.position.copy(stringCenter);
    this.sweepArrowGroup.visible = true;

    this.badgeGroup.position.set(stringCenter.x, stringCenter.y + 0.13, stringCenter.z);
    this.renderBadgeContent('STEP 3/3', 'SWEEP FINGER TO PLUCK', 'Glide index fingertip through string to sound note');

    this.loomEngine.spatialSynth.playSpatialNote({
      frequency: 659.25,
      position: stringCenter,
      intensity: 0.9,
      duration: 0.4
    });
  }

  /**
   * Advances the guide to the specified step
   */
  public advanceToStep(nextStep: TutorialStep): void {
    this.stepTimer = 0;
    this.currentStep = nextStep;

    if (nextStep === 2) {
      this.setupStep2();
    } else if (nextStep === 3) {
      this.setupStep3();
    }
  }

  /**
   * Completes the tutorial with a celebratory chord, particles, and persists to localStorage
   */
  private completeTutorial(pluckPos: THREE.Vector3): void {
    this.currentStep = 'COMPLETED';
    this.isCelebrating = true;
    this.celebrationTimer = 0;

    // Persist in localStorage
    try {
      localStorage.setItem(this.STORAGE_KEY, 'true');
    } catch (e) {
      // Ignore storage errors
    }

    // Celebratory Sparkles
    this.triggerCelebrationSparkles(pluckPos);

    // Celebratory 3D Billboard
    this.badgeGroup.position.set(pluckPos.x, pluckPos.y + 0.15, pluckPos.z);
    this.renderBadgeContent('COMPLETED ✨', 'SPATIAL LOOM MASTERED', 'You are ready to compose in VR!', true);

    // Harmonious celebratory chord (C5 - E5 - G5)
    this.loomEngine.spatialSynth.playSpatialNote({
      frequency: 523.25,
      position: pluckPos,
      intensity: 1.2,
      duration: 1.2
    });
    setTimeout(() => {
      this.loomEngine.spatialSynth.playSpatialNote({
        frequency: 659.25,
        position: pluckPos,
        intensity: 1.1,
        duration: 1.2
      });
    }, 120);
    setTimeout(() => {
      this.loomEngine.spatialSynth.playSpatialNote({
        frequency: 783.99,
        position: pluckPos,
        intensity: 1.3,
        duration: 1.5
      });
    }, 240);

    // Hide beacons and ghost hand
    this.ghostHand.group.visible = false;
    this.beaconGroup.visible = false;

    console.log('[TutorialGuide] Tutorial Completed! User has mastered first-pluck spatial interaction.');
  }

  // ----------------------------------------------------
  // 8. Per-Frame Animation & Kinematics
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    if (!this.isActive) return;

    this.stepTimer += deltaTime;

    // Face step badge towards active camera
    this.badgeGroup.lookAt(this.sceneManager.camera.position);

    // Update celebratory sparkles
    if (this.isCelebrating) {
      this.celebrationTimer += deltaTime;
      this.updateSparkles(deltaTime);

      // Dissolve and dismiss after 3.5s of celebration
      if (this.celebrationTimer > 3.5) {
        this.dismissGuide();
      }
      return;
    }

    // Pulsate target beacons
    const time = performance.now() * 0.003;
    const pulseScale = 1.0 + Math.sin(time * 3.0) * 0.08;
    this.beaconRingA.scale.setScalar(pulseScale);
    this.beaconRingB.scale.setScalar(pulseScale);
    this.beaconRingA.rotation.z += 0.015;
    this.beaconRingB.rotation.z -= 0.015;

    // --------------------------------------------------
    // Animate Ghost Hand based on active micro-step
    // --------------------------------------------------
    if (this.currentStep === 1) {
      this.animateStep1GhostHand();
    } else if (this.currentStep === 2) {
      this.animateStep2GhostHand();
    } else if (this.currentStep === 3) {
      this.animateStep3GhostHand();
    }
  }

  /**
   * Step 1 Kinematics: Ghost hand reaches to Seed Orb, pinches, and pulls outward
   */
  private animateStep1GhostHand(): void {
    const loopDuration = 3.2;
    const t = this.stepTimer % loopDuration;

    const restPos = new THREE.Vector3(0.14, 1.08, -0.40);
    const orbPos = this.seedOrbPos;
    const pullEndPos = new THREE.Vector3(0.12, 1.14, -0.36);

    let handPos = this._v1;
    let isPinching = false;

    if (t < 1.0) {
      // Reaching from rest towards Seed Orb
      const p = this.easeInOutQuad(t / 1.0);
      handPos.lerpVectors(restPos, orbPos, p);
      isPinching = false;
    } else if (t >= 1.0 && t < 1.3) {
      // Touching orb and pinching fingers
      handPos.copy(orbPos);
      isPinching = true;
    } else if (t >= 1.3 && t < 2.4) {
      // Pulling outward (> 0.055m threshold)
      const p = this.easeInOutQuad((t - 1.3) / 1.1);
      handPos.lerpVectors(orbPos, pullEndPos, p);
      isPinching = true;
    } else {
      // Releasing pinch and returning to rest
      const p = this.easeInOutQuad((t - 2.4) / 0.8);
      handPos.lerpVectors(pullEndPos, restPos, p);
      isPinching = false;
    }

    this.applyGhostHandPose(handPos, isPinching);
  }

  /**
   * Step 2 Kinematics: Ghost hand pinches Node 1, drags tether across to Node 2, and releases
   */
  private animateStep2GhostHand(): void {
    const loopDuration = 3.4;
    const t = this.stepTimer % loopDuration;

    let handPos = this._v1;
    let isPinching = false;

    if (t < 0.8) {
      // Float to Node 1
      const p = this.easeInOutQuad(t / 0.8);
      handPos.lerpVectors(new THREE.Vector3(this.node1Pos.x + 0.08, this.node1Pos.y - 0.06, this.node1Pos.z), this.node1Pos, p);
      isPinching = false;
    } else if (t >= 0.8 && t < 1.1) {
      // Pinch at Node 1
      handPos.copy(this.node1Pos);
      isPinching = true;
    } else if (t >= 1.1 && t < 2.4) {
      // Drag tether across to Node 2
      const p = this.easeInOutQuad((t - 1.1) / 1.3);
      handPos.lerpVectors(this.node1Pos, this.node2Pos, p);
      isPinching = true;
    } else if (t >= 2.4 && t < 2.7) {
      // Release at Node 2
      handPos.copy(this.node2Pos);
      isPinching = false;
    } else {
      // Return towards Node 1
      const p = this.easeInOutQuad((t - 2.7) / 0.7);
      handPos.lerpVectors(this.node2Pos, this.node1Pos, p);
      isPinching = false;
    }

    this.applyGhostHandPose(handPos, isPinching);
  }

  /**
   * Step 3 Kinematics: Ghost hand extends index fingertip and sweeps through string
   */
  private animateStep3GhostHand(): void {
    const loopDuration = 2.6;
    const t = this.stepTimer % loopDuration;

    let center = this._v2.lerpVectors(this.node1Pos, this.node2Pos, 0.5);
    const sweepStart = new THREE.Vector3(center.x, center.y + 0.08, center.z - 0.04);
    const sweepEnd = new THREE.Vector3(center.x, center.y - 0.08, center.z + 0.04);

    let handPos = this._v1;

    if (t < 1.4) {
      // Sweeping downward through string
      const p = this.easeInOutQuad(t / 1.4);
      handPos.lerpVectors(sweepStart, sweepEnd, p);
    } else {
      // Smoothly returning upward to start position
      const p = this.easeInOutQuad((t - 1.4) / 1.2);
      handPos.lerpVectors(sweepEnd, sweepStart, p);
    }

    this.applyGhostHandPose(handPos, false);
  }

  /**
   * Applies 3D transform and finger curl / pinch states to the ghost hand mesh
   */
  private applyGhostHandPose(wristPos: THREE.Vector3, isPinching: boolean): void {
    this.ghostHand.group.position.copy(wristPos);

    // If pinching: snap thumb and index tip together and illuminate pinch beam
    const thumbMesh = this.ghostHand.tipMeshes[0];
    const indexMesh = this.ghostHand.tipMeshes[1];

    if (isPinching) {
      thumbMesh.position.set(0.016, 0.058, -0.015);
      indexMesh.position.set(0.016, 0.060, -0.015);
      this.ghostHand.pinchLine.visible = true;
      this.ghostHand.wristMesh.material = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.95
      });
      this.ghostHand.glowLight.color.setHex(0xffd700);
    } else {
      thumbMesh.position.set(0.028, 0.042, -0.01);
      indexMesh.position.set(0.014, 0.074, -0.018);
      this.ghostHand.pinchLine.visible = false;
      this.ghostHand.wristMesh.material = new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.85
      });
      this.ghostHand.glowLight.color.setHex(0x00f0ff);
    }

    // Update bone lines from wrist (0, 0, 0) to tip positions
    for (let i = 0; i < 5; i++) {
      const line = this.ghostHand.boneLines[i];
      const posAttr = line.geometry.attributes.position as THREE.BufferAttribute;
      const tipPos = this.ghostHand.tipMeshes[i].position;
      posAttr.setXYZ(1, tipPos.x, tipPos.y, tipPos.z);
      posAttr.needsUpdate = true;
    }
  }

  private updateSparkles(deltaTime: number): void {
    let anyAlive = false;
    for (let i = 0; i < this.MAX_SPARKLES; i++) {
      if (this.sparkleLives[i] > 0) {
        anyAlive = true;
        const i3 = i * 3;
        this.sparklePositions[i3] += this.sparkleVelocities[i3] * deltaTime;
        this.sparklePositions[i3 + 1] += this.sparkleVelocities[i3 + 1] * deltaTime;
        this.sparklePositions[i3 + 2] += this.sparkleVelocities[i3 + 2] * deltaTime;

        this.sparkleVelocities[i3] *= 0.96;
        this.sparkleVelocities[i3 + 1] -= 0.02 * deltaTime;
        this.sparkleVelocities[i3 + 2] *= 0.96;

        this.sparkleLives[i] -= deltaTime;
        if (this.sparkleLives[i] <= 0) {
          this.sparklePositions[i3 + 1] = -999;
        }
      }
    }

    if (anyAlive) {
      const attr = this.sparkleMesh.geometry.attributes.position as THREE.BufferAttribute;
      attr.needsUpdate = true;
    }
  }

  private easeInOutQuad(x: number): number {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }
}
