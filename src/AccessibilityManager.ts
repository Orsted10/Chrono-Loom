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

// Cached colors and position constants to guarantee Zero-GC in per-frame loops
const COLOR_BASS = new THREE.Color(0xf59e0b);
const COLOR_MID = new THREE.Color(0x00f0ff);
const COLOR_HIGH = new THREE.Color(0xd946ef);
const COLOR_GOLD = new THREE.Color(0xffd700);
const CHIME_DEFAULT_POS = new THREE.Vector3(0, 1.2, -0.4);

export class AccessibilityManager {
  private sceneManager: SceneManager;
  private handInputManager: HandInputManager;
  private loomEngine: LoomEngine;
  private spatialSynth: SpatialSynth;

  // Master Accessibility Flags
  public isAccessibilitySuiteEnabled = true;
  public isGazeAssistEnabled = true;
  public isOneHandedModeActive = true;
  public isShapeSynesthesiaEnabled = true;

  // Phase 16: Dwell-Select & Single-Switch Accessibility
  public isDwellModeActive = true;
  public dwellProgress = 0.0;
  private dwellTimer = 0.0;
  private readonly DWELL_DURATION = 0.85; // 0.85s steady hold to auto-latch
  private dwellCooldown = 0.0;
  private lastDwellNodeId: string | null = null;
  private dwellFillMesh!: THREE.Mesh;
  private dwellFillMat!: THREE.MeshBasicMaterial;

  // Phase 16: Low-Vision High-Contrast & Dyslexia-Friendly Typography
  public isHighContrastEnabled = false;
  public isDyslexiaTypographyEnabled = false;

  // Ergonomic Seated Auto-Bring Workspace State
  public isWorkspaceCompact = false;
  private currentZOffset = 0.0;
  private targetZOffset = 0.0;
  private currentScale = 1.0;
  private targetScale = 1.0;
  private readonly COMPACT_Z_OFFSET = 0.15; // Shifts center from z = -0.45m to z = -0.30m
  private readonly COMPACT_SCALE = 0.72;    // Shrinks workspace to 0.35m micro-radius

  // Magnetic Gaze / Proximity Assist
  public focusedNode: HarmonicNode | null = null;
  private magneticReticle: THREE.Group;
  private reticleMaterial: THREE.MeshBasicMaterial;

  // Virtual Anchor Tether for One-Handed Weaving
  public latchedAnchorNode: HarmonicNode | null = null;
  private tetherGroup: THREE.Group;
  private tetherLine: THREE.Line;
  private tetherPromptSprite: THREE.Sprite;
  private lastTetherActionTime = 0;

  // Visual Haptic Sub-Bass Waveform Ripple Pool (Deaf / Hard-of-Hearing)
  private hapticWavePool: VisualHapticWave[] = [];
  private hapticContainer: THREE.Group;
  private readonly MAX_HAPTIC_WAVES = 12;

  // Reusable vectors for zero-garbage performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();

  constructor(
    sceneManager: SceneManager,
    handInputManager: HandInputManager,
    loomEngine: LoomEngine,
    spatialSynth: SpatialSynth
  ) {
    this.sceneManager = sceneManager;
    this.handInputManager = handInputManager;
    this.loomEngine = loomEngine;
    this.spatialSynth = spatialSynth;

    // 1. Magnetic Snap Reticle
    const { group: reticleGroup, material: reticleMat } = this.createMagneticReticle();
    this.magneticReticle = reticleGroup;
    this.reticleMaterial = reticleMat;
    this.sceneManager.scene.add(this.magneticReticle);

    // 2. Virtual Anchor Tether (One-Handed Weaving)
    const { group: tetherGrp, line: tetherLn, prompt: tetherPr } = this.createVirtualAnchorTether();
    this.tetherGroup = tetherGrp;
    this.tetherLine = tetherLn;
    this.tetherPromptSprite = tetherPr;
    this.sceneManager.scene.add(this.tetherGroup);

    // 3. Visual Haptic Sub-Bass Waveform Pool
    this.hapticContainer = new THREE.Group();
    this.hapticContainer.name = 'VisualHapticRings';
    this.sceneManager.scene.add(this.hapticContainer);
    this.initHapticWavePool(this.MAX_HAPTIC_WAVES);

    console.log('[AccessibilityManager] Initialized. Suite: ACTIVE (1-Hand Tether + Gaze Snap + Haptic Waves).');
  }

  // ----------------------------------------------------
  // 1. Magnetic Gaze & Proximity Assist
  // ----------------------------------------------------

  /**
   * Builds high-contrast magnetic reticle that snaps around focused nodes
   */
  private createMagneticReticle(): {
    group: THREE.Group;
    material: THREE.MeshBasicMaterial;
  } {
    const group = new THREE.Group();
    group.name = 'MagneticReticle';
    group.visible = false;

    // Central target ring
    const ringGeo = new THREE.RingGeometry(0.052, 0.058, 36);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    // Phase 16: Dwell-Select Radial Fill-Ring (0.85s steady hold visualization)
    const dwellGeo = new THREE.RingGeometry(0.038, 0.048, 48, 1, Math.PI / 2, 0.001);
    this.dwellFillMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.dwellFillMesh = new THREE.Mesh(dwellGeo, this.dwellFillMat);
    this.dwellFillMesh.name = 'DwellFillRing';
    this.dwellFillMesh.visible = false;
    group.add(this.dwellFillMesh);

    // 4 Corner Brackets
    const bracketMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });

    const bSize = 0.065;
    const bLen = 0.018;

    const createBracket = (sx: number, sy: number) => {
      const pts = [
        new THREE.Vector3(sx * (bSize - bLen), sy * bSize, 0),
        new THREE.Vector3(sx * bSize, sy * bSize, 0),
        new THREE.Vector3(sx * bSize, sy * (bSize - bLen), 0)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return new THREE.Line(geo, bracketMat);
    };

    group.add(createBracket(1, 1));
    group.add(createBracket(-1, 1));
    group.add(createBracket(1, -1));
    group.add(createBracket(-1, -1));

    return { group, material: ringMat };
  }

  /**
   * Updates gaze cone raycast and hand proximity to locate focused node
   */
  private updateMagneticFocus(): void {
    if (!this.isAccessibilitySuiteEnabled || !this.isGazeAssistEnabled) {
      this.focusedNode = null;
      this.magneticReticle.visible = false;
      return;
    }

    const camera = this.sceneManager.camera;
    const camPos = this._v1.setFromMatrixPosition(camera.matrixWorld);
    const camDir = this._v2.set(0, 0, -1).applyQuaternion(camera.quaternion).normalize();

    let bestNode: HarmonicNode | null = null;
    let bestScore = -999; // Higher is better alignment

    const leftTele = this.handInputManager.getTelemetry('left');
    const rightTele = this.handInputManager.getTelemetry('right');
    const activeHandPos = rightTele.isTracked
      ? rightTele.indexTipPosition
      : leftTele.isTracked
      ? leftTele.indexTipPosition
      : null;

    for (const node of this.loomEngine.nodes.values()) {
      const nodePos = node.position;

      // 1. Hand proximity check (< 0.11m magnetic snap zone)
      if (activeHandPos) {
        const handDist = activeHandPos.distanceTo(nodePos);
        if (handDist < 0.11) {
          // Priority to hand proximity
          const score = 100 - handDist * 100;
          if (score > bestScore) {
            bestScore = score;
            bestNode = node;
          }
          continue;
        }
      }

      // 2. Gaze alignment check
      const toNode = this._v3.subVectors(nodePos, camPos);
      const dist = toNode.length();
      if (dist < 1.2 && dist > 0.1) {
        toNode.normalize();
        const dot = camDir.dot(toNode); // Cosine of angle
        // Within ~18 degrees cone (dot > 0.95)
        if (dot > 0.95) {
          const score = dot * 50 - dist * 5;
          if (score > bestScore) {
            bestScore = score;
            bestNode = node;
          }
        }
      }
    }

    this.focusedNode = bestNode;

    if (this.focusedNode) {
      this.magneticReticle.visible = true;
      this.magneticReticle.position.copy(this.focusedNode.position);
      this.magneticReticle.lookAt(camPos);
      this.magneticReticle.rotation.z += 0.015;

      // Glow pulsing
      const pulse = 0.75 + Math.sin(performance.now() * 0.008) * 0.25;
      this.reticleMaterial.opacity = pulse;
    } else {
      this.magneticReticle.visible = false;
    }
  }

  // ----------------------------------------------------
  // 2. Virtual Anchor Tether (One-Handed Weaving)
  // ----------------------------------------------------

  /**
   * Builds the glowing visual tether line and floating status badge
   */
  private createVirtualAnchorTether(): {
    group: THREE.Group;
    line: THREE.Line;
    prompt: THREE.Sprite;
  } {
    const group = new THREE.Group();
    group.name = 'VirtualAnchorTether';
    group.visible = false;

    // Segmented glowing electric line
    const numPts = 16;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < numPts; i++) pts.push(new THREE.Vector3(0, 0, 0));

    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffd700,
      linewidth: 3,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);

    // Floating tether instructions sprite
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 6;
    const x = 30, y = 30, w = 964, h = 196, r = 32;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + w, x, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 18;

    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('VIRTUAL ANCHOR TETHER ACTIVE [1-HANDED MODE]', 512, 105);

    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fde047';
    ctx.fillText('PINCH ANOTHER NODE TO WEAVE // PINCH SPACE TO SPAWN', 512, 160);

    const texture = new THREE.CanvasTexture(canvas);
    const promptMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const prompt = new THREE.Sprite(promptMat);
    prompt.scale.set(0.38, 0.095, 1);
    prompt.visible = false; // Clean scene: Golden laser filament visually communicates tether without text billboard!
    group.add(prompt);

    return { group, line, prompt };
  }

  /**
   * One-Handed Tether Pinch Interceptor:
   * Called by HandInputManager/LoomEngine on pinch start.
   * Returns true if the pinch was handled by the Virtual Anchor Tether.
   */
  public handleOneHandedPinch(hand: Handedness, pinchPos: THREE.Vector3): boolean {
    if (!this.isAccessibilitySuiteEnabled || !this.isOneHandedModeActive) {
      return false;
    }

    const now = performance.now();
    if (now - this.lastTetherActionTime < 240) return false; // Debounce

    // Check if pinch is targeting a node (or magnetically focused node)
    const targetNode = this.focusedNode || this.findNearestNode(pinchPos, 0.095);

    // Case A: No anchor latched yet
    if (!this.latchedAnchorNode) {
      if (targetNode) {
        this.latchedAnchorNode = targetNode;
        this.tetherGroup.visible = true;
        this.lastTetherActionTime = now;

        // Latch chime
        this.spatialSynth.playSpatialNote({
          frequency: 587.33,
          position: targetNode.position,
          intensity: 1.1,
          duration: 0.4
        });
        this.loomEngine.spawnParticleBurst(targetNode.position, 12, COLOR_GOLD, 0.04);
        console.log(`[Accessibility] Latched Virtual Anchor Tether on Node [${targetNode.id}].`);
        return true;
      }
      return false;
    }

    // Case B: Anchor is already latched!
    if (this.latchedAnchorNode) {
      this.lastTetherActionTime = now;

      // Sub-case B1: Pinched the same node -> Cancel / Release Tether
      if (targetNode && targetNode.id === this.latchedAnchorNode.id) {
        console.log('[Accessibility] Tether released / unlatched.');
        this.releaseTether(false);
        return true;
      }

      // Sub-case B2: Pinched a different node -> WEAVE STRING!
      if (targetNode && targetNode.id !== this.latchedAnchorNode.id) {
        this.loomEngine.createChronoString(this.latchedAnchorNode, targetNode);
        this.triggerVisualHapticWave(targetNode.position, targetNode.noteFrequency, 1.4);
        this.releaseTether(true);
        return true;
      }

      // Sub-case B3: Pinched empty comfort space -> SPAWN NODE & WEAVE STRING!
      if (this.isWithinComfortBounds(pinchPos)) {
        const newNode = this.loomEngine.spawnHarmonicNode(pinchPos);
        this.loomEngine.createChronoString(this.latchedAnchorNode, newNode);
        this.triggerVisualHapticWave(newNode.position, newNode.noteFrequency, 1.4);
        this.releaseTether(true);
        return true;
      }
    }

    return false;
  }

  /**
   * Releases active virtual anchor tether
   */
  public releaseTether(wasWeaveSuccessful: boolean): void {
    if (wasWeaveSuccessful && this.latchedAnchorNode) {
      this.spatialSynth.playSpatialNote({
        frequency: 659.25,
        position: this.latchedAnchorNode.position,
        intensity: 1.2,
        duration: 0.6
      });
    }
    this.latchedAnchorNode = null;
    this.tetherGroup.visible = false;
  }

  // ----------------------------------------------------
  // Phase 16: Dwell-Select & Single-Switch Accessibility
  // ----------------------------------------------------

  /**
   * Universal Single-Switch Trigger:
   * Clicking switch/spacebar immediately selects the currently focused node without manual pinch.
   */
  public triggerSwitchSelect(): boolean {
    if (this.focusedNode) {
      this.handleDwellSelection(this.focusedNode);
      return true;
    }
    return false;
  }

  /**
   * Toggles Hands-Free Dwell Selection mode (0.85s steady gaze/hand hold)
   */
  public toggleDwellMode(): boolean {
    this.isDwellModeActive = !this.isDwellModeActive;
    this.dwellTimer = 0.0;
    this.dwellProgress = 0.0;
    this.updateDwellFillRing(0);
    this.spatialSynth.playSpatialNote({
      frequency: this.isDwellModeActive ? 523.25 : 349.23,
      position: CHIME_DEFAULT_POS,
      intensity: 1.1,
      duration: 0.4
    });
    console.log(`[Accessibility] Dwell-Select Mode: ${this.isDwellModeActive ? 'ON (0.85s hold)' : 'OFF'}`);
    return this.isDwellModeActive;
  }

  /**
   * Executes selection when 0.85s dwell completes on a node
   */
  public handleDwellSelection(targetNode: HarmonicNode): void {
    if (!this.latchedAnchorNode) {
      // Case A: Latch Virtual Anchor Tether
      this.latchedAnchorNode = targetNode;
      this.tetherGroup.visible = true;
      this.spatialSynth.playSpatialNote({
        frequency: 587.33,
        position: targetNode.position,
        intensity: 1.25,
        duration: 0.45
      });
      this.loomEngine.spawnParticleBurst(targetNode.position, 16, COLOR_GOLD, 0.05);
      this.handInputManager.pulseHaptics('right', 0.8, 60, targetNode.noteFrequency);
      console.log(`[Accessibility] Dwell-Selected: Latched Anchor on Node [${targetNode.id}].`);
      return;
    }

    if (targetNode.id === this.latchedAnchorNode.id) {
      // Case B1: Dwelled on same node -> Unlatch / Cancel
      this.releaseTether(false);
      this.handInputManager.pulseHaptics('right', 0.4, 30);
      console.log('[Accessibility] Dwell-Selected: Tether unlatched.');
    } else {
      // Case B2: Dwelled on different node -> WEAVE STRING!
      this.loomEngine.createChronoString(this.latchedAnchorNode, targetNode);
      this.triggerVisualHapticWave(targetNode.position, targetNode.noteFrequency, 1.5);
      this.spatialSynth.playSpatialNote({
        frequency: 659.25,
        position: targetNode.position,
        intensity: 1.3,
        duration: 0.6
      });
      this.handInputManager.pulseHaptics('right', 0.9, 75, targetNode.noteFrequency);
      this.releaseTether(true);
      console.log(`[Accessibility] Dwell-Selected: Weave completed to Node [${targetNode.id}].`);
    }
  }

  private updateDwellSelect(deltaTime: number): void {
    if (!this.isAccessibilitySuiteEnabled || !this.isDwellModeActive) {
      this.dwellTimer = 0.0;
      this.dwellProgress = 0.0;
      this.updateDwellFillRing(0);
      return;
    }

    if (this.dwellCooldown > 0) {
      this.dwellCooldown -= deltaTime;
      this.dwellProgress = 0.0;
      this.updateDwellFillRing(0);
      return;
    }

    if (this.focusedNode) {
      if (this.lastDwellNodeId !== this.focusedNode.id) {
        this.lastDwellNodeId = this.focusedNode.id;
        this.dwellTimer = 0.0;
      }

      this.dwellTimer += deltaTime;
      this.dwellProgress = Math.min(1.0, this.dwellTimer / this.DWELL_DURATION);
      this.updateDwellFillRing(this.dwellProgress);

      if (this.dwellProgress >= 1.0) {
        this.handleDwellSelection(this.focusedNode);
        this.dwellTimer = 0.0;
        this.dwellProgress = 0.0;
        this.dwellCooldown = 0.6;
        this.updateDwellFillRing(0);
      }
    } else {
      this.dwellTimer = 0.0;
      this.dwellProgress = 0.0;
      this.lastDwellNodeId = null;
      this.updateDwellFillRing(0);
    }
  }

  private updateDwellFillRing(progress: number): void {
    if (!this.dwellFillMesh) return;
    if (progress <= 0.005) {
      this.dwellFillMesh.visible = false;
      return;
    }

    this.dwellFillMesh.visible = true;
    this.dwellFillMesh.geometry.dispose();
    const sweepAngle = progress * Math.PI * 2;
    this.dwellFillMesh.geometry = new THREE.RingGeometry(
      0.038,
      0.048,
      48,
      1,
      Math.PI / 2,
      -sweepAngle
    );

    const r = THREE.MathUtils.lerp(0.0, 1.0, progress);
    const g = THREE.MathUtils.lerp(0.94, 0.84, progress);
    const b = THREE.MathUtils.lerp(1.0, 0.0, progress);
    this.dwellFillMat.color.setRGB(r, g, b);
    this.dwellFillMat.opacity = 0.75 + progress * 0.25;
  }

  // ----------------------------------------------------
  // Phase 16: High-Contrast Rim-Lighting & Dyslexia Typography
  // ----------------------------------------------------

  public toggleHighContrast(): boolean {
    this.isHighContrastEnabled = !this.isHighContrastEnabled;
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('high-contrast-mode', this.isHighContrastEnabled);
    }

    for (const node of this.loomEngine.nodes.values()) {
      const coreMat = node.coreMesh.material as THREE.MeshPhysicalMaterial;
      const wireMat = node.wireframeMesh.material as THREE.MeshBasicMaterial;
      if (this.isHighContrastEnabled) {
        coreMat.emissiveIntensity = 2.4;
        coreMat.roughness = 0.05;
        wireMat.color.setHex(0xffea00);
        wireMat.opacity = 1.0;
        node.wireframeMesh.scale.setScalar(1.22);
      } else {
        coreMat.emissiveIntensity = 0.6;
        coreMat.roughness = 0.2;
        wireMat.color.copy(node.baseColor);
        wireMat.opacity = 0.75;
        node.wireframeMesh.scale.setScalar(1.0);
      }
    }

    if (this.reticleMaterial) {
      this.reticleMaterial.color.setHex(this.isHighContrastEnabled ? 0xffea00 : 0x00f0ff);
    }

    this.refreshAllNodePitchLabels();

    this.spatialSynth.playSpatialNote({
      frequency: this.isHighContrastEnabled ? 523.25 : 392.00,
      position: CHIME_DEFAULT_POS,
      intensity: 1.1,
      duration: 0.4
    });

    console.log(`[Accessibility] High-Contrast Rim-Lighting: ${this.isHighContrastEnabled ? 'ON' : 'OFF'}`);
    return this.isHighContrastEnabled;
  }

  public toggleDyslexiaTypography(): boolean {
    this.isDyslexiaTypographyEnabled = !this.isDyslexiaTypographyEnabled;
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dyslexia-friendly-mode', this.isDyslexiaTypographyEnabled);
    }

    this.refreshAllNodePitchLabels();

    this.spatialSynth.playSpatialNote({
      frequency: this.isDyslexiaTypographyEnabled ? 659.25 : 440.00,
      position: CHIME_DEFAULT_POS,
      intensity: 1.1,
      duration: 0.4
    });

    console.log(`[Accessibility] Dyslexia-Friendly Typography: ${this.isDyslexiaTypographyEnabled ? 'ON' : 'OFF'}`);
    return this.isDyslexiaTypographyEnabled;
  }

  public refreshAllNodePitchLabels(): void {
    for (const node of this.loomEngine.nodes.values()) {
      if (node.pitchLabelSprite) {
        node.meshGroup.remove(node.pitchLabelSprite);
        node.pitchLabelSprite.geometry.dispose();
        (node.pitchLabelSprite.material as THREE.Material).dispose();
      }
      const newSprite = this.createPitchLabelSprite(node.noteFrequency);
      newSprite.visible = false; // Hidden by default, shown on hover/grab to prevent visual clutter
      node.meshGroup.add(newSprite);
      node.pitchLabelSprite = newSprite;
    }
  }

  private isWithinComfortBounds(pos: THREE.Vector3): boolean {
    const origin = this._v1.set(0, 1.2, -0.45);
    return pos.distanceTo(origin) < 0.65 && pos.z <= -0.10 && pos.y >= 0.85 && pos.y <= 1.55;
  }

  private findNearestNode(pos: THREE.Vector3, maxDist: number = 0.08): HarmonicNode | null {
    let nearest: HarmonicNode | null = null;
    let minDist = maxDist;
    for (const node of this.loomEngine.nodes.values()) {
      const d = pos.distanceTo(node.position);
      if (d < minDist) {
        minDist = d;
        nearest = node;
      }
    }
    return nearest;
  }

  // ----------------------------------------------------
  // 3. Ergonomic Seated Auto-Bring Workspace
  // ----------------------------------------------------

  /**
   * Toggles the workspace closer to the user (from z = -0.45m to z = -0.30m)
   * and compacts the radius for users with restricted arm mobility.
   */
  public toggleWorkspaceCompact(): boolean {
    this.setWorkspaceCompact(!this.isWorkspaceCompact);
    return this.isWorkspaceCompact;
  }

  public setWorkspaceCompact(compact: boolean): void {
    this.isWorkspaceCompact = compact;
    this.targetZOffset = compact ? this.COMPACT_Z_OFFSET : 0.0;
    this.targetScale = compact ? this.COMPACT_SCALE : 1.0;

    // Audio chime confirmation
    this.spatialSynth.playSpatialNote({
      frequency: compact ? 523.25 : 392.00,
      position: CHIME_DEFAULT_POS,
      intensity: 1.2,
      duration: 0.6
    });

    console.log(`[Accessibility] Seated Workspace Auto-Bring: ${compact ? 'COMPACT (0.35m radius, z = -0.30m)' : 'NORMAL (0.55m radius, z = -0.45m)'}`);
  }

  // ----------------------------------------------------
  // 4. Shape-Coded Synesthesia & Note Badges
  // ----------------------------------------------------

  /**
   * Generates distinct 3D geometry matching the pitch tier
   * (Cube = Bass, Octahedron = Mid, Tetrahedron = High)
   */
  public createShapeCodedGeometry(freq: number): {
    coreGeo: THREE.BufferGeometry;
    shellGeo: THREE.BufferGeometry;
    tierInfo: PitchTierInfo;
  } {
    const tierInfo = getPitchTierInfo(freq);
    let coreGeo: THREE.BufferGeometry;
    let shellGeo: THREE.BufferGeometry;

    if (tierInfo.tier === 'BASS') {
      // Bass Tier: Robust cube with beveled edges
      coreGeo = new THREE.BoxGeometry(0.046, 0.046, 0.046);
      shellGeo = new THREE.BoxGeometry(0.056, 0.056, 0.056);
    } else if (tierInfo.tier === 'MID') {
      // Mid Tier: Pure Faceted Gemstone Octahedron (Zero wireframe subdivision clutter)
      coreGeo = new THREE.OctahedronGeometry(0.035, 0);
      shellGeo = new THREE.OctahedronGeometry(0.043, 0);
    } else {
      // High Tier: Sharp Stellated Tetrahedron
      coreGeo = new THREE.TetrahedronGeometry(0.040, 0);
      shellGeo = new THREE.TetrahedronGeometry(0.048, 0);
    }

    return { coreGeo, shellGeo, tierInfo };
  }

  /**
   * Builds high-contrast 3D pitch/note billboard label badge
   * e.g. "C3 [BASS] // 130Hz" for colorblind/deaf accessibility
   */
  public createPitchLabelSprite(freq: number): THREE.Sprite {
    const tierInfo = getPitchTierInfo(freq);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;

    // Border styling based on tier & accessibility mode
    const isHighContrast = this.isHighContrastEnabled;
    const isDyslexia = this.isDyslexiaTypographyEnabled;

    let borderColor =
      tierInfo.tier === 'BASS' ? '#f59e0b' : tierInfo.tier === 'MID' ? '#00f0ff' : '#a855f7';
    let bgColor = 'rgba(7, 24, 45, 0.90)';

    if (isHighContrast) {
      borderColor = '#ffea00';
      bgColor = 'rgba(0, 0, 0, 0.98)';
    }

    ctx.fillStyle = bgColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isHighContrast ? 8 : 5;

    const x = 12, y = 12, w = 488, h = 136, r = 24;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + w, x, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isDyslexia) {
      ctx.font = 'bold 42px "OpenDyslexic", "Atkinson Hyperlegible", "Lexend", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      const spacedTitle = `${tierInfo.noteName}   [${tierInfo.tier}]`;
      ctx.fillText(spacedTitle, 256, 68);

      ctx.font = 'bold 24px "OpenDyslexic", "Atkinson Hyperlegible", "Lexend", monospace';
      ctx.fillStyle = borderColor;
      const spacedSub = `${Math.round(freq)} Hz   //   ${tierInfo.shapeName}`;
      ctx.fillText(spacedSub, 256, 114);
    } else {
      ctx.font = 'bold 46px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(`${tierInfo.noteName} [${tierInfo.tier}]`, 256, 68);

      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillStyle = borderColor;
      ctx.fillText(`${Math.round(freq)} Hz // ${tierInfo.shapeName}`, 256, 114);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.12, 0.038, 1);
    // Position neatly beneath node (-0.065m), preventing any collision with Euclidean ring (+0.082m)
    sprite.position.set(0, -0.065, 0);
    return sprite;
  }

  // ----------------------------------------------------
  // 5. Deaf / Hard-of-Hearing Visual Haptic Waveform Rings
  // ----------------------------------------------------

  /**
   * Initializes a pool of expanding sinusoidal waveform rings
   */
  private initHapticWavePool(count: number): void {
    const ringGeo = new THREE.RingGeometry(0.02, 0.038, 48);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.hapticContainer.add(mesh);

      this.hapticWavePool.push({
        mesh,
        center: new THREE.Vector3(),
        progress: 1.0,
        speed: 1.6,
        maxRadius: 0.32,
        frequency: 261.63,
        thickness: 0.02,
        color: new THREE.Color(0x00f0ff),
        active: false
      });
    }
  }

  /**
   * Fires a crisp 3D visual haptic sub-bass ripple ring:
   * Thickness reflects intensity; ripple speed reflects pitch frequency.
   */
  public triggerVisualHapticWave(pos: THREE.Vector3, frequency: number, intensity: number = 1.0): void {
    if (!this.isAccessibilitySuiteEnabled) return;

    let wave = this.hapticWavePool.find((w) => !w.active);
    if (!wave) {
      wave = this.hapticWavePool.reduce((p, c) => (c.progress > p.progress ? c : p));
    }

    const tierInfo = getPitchTierInfo(frequency);
    const waveColor =
      tierInfo.tier === 'BASS'
        ? COLOR_BASS
        : tierInfo.tier === 'MID'
        ? COLOR_MID
        : COLOR_HIGH;

    wave.center.copy(pos);
    wave.mesh.position.copy(pos);
    wave.color.copy(waveColor);
    (wave.mesh.material as THREE.MeshBasicMaterial).color.copy(waveColor);
    wave.progress = 0.0;
    wave.speed = 1.2 + (frequency / 600) * 0.8;
    wave.maxRadius = 0.22 + intensity * 0.14;
    wave.thickness = tierInfo.tier === 'BASS' ? 0.045 : tierInfo.tier === 'MID' ? 0.028 : 0.016;
    wave.frequency = frequency;
    wave.active = true;
    wave.mesh.visible = true;
  }

  /**
   * Toggles master accessibility suite
   */
  public toggleAccessibilitySuite(): boolean {
    this.isAccessibilitySuiteEnabled = !this.isAccessibilitySuiteEnabled;
    this.magneticReticle.visible = false;
    this.releaseTether(false);

    // Note badges remain sleek and context-aware (visible on hover/grab)
    for (const node of this.loomEngine.nodes.values()) {
      if ((node as any).pitchLabelSprite) {
        (node as any).pitchLabelSprite.visible = false;
      }
    }

    console.log(`[Accessibility] Master Suite: ${this.isAccessibilitySuiteEnabled ? 'ENABLED' : 'DISABLED'}`);
    return this.isAccessibilitySuiteEnabled;
  }

  // ----------------------------------------------------
  // 6. Per-Frame Update
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    const time = performance.now() * 0.001;

    // 1. Smoothly interpolate Ergonomic Auto-Bring workspace offset & scale
    this.currentZOffset = THREE.MathUtils.lerp(this.currentZOffset, this.targetZOffset, 0.12);
    this.currentScale = THREE.MathUtils.lerp(this.currentScale, this.targetScale, 0.12);

    // Apply to Loom Engine group
    this.loomEngine.loomGroup.position.z = this.currentZOffset;
    this.loomEngine.loomGroup.scale.setScalar(this.currentScale);

    // Apply to SceneManager Seated Comfort Arc
    this.sceneManager.comfortArcGroup.position.z = this.currentZOffset;
    this.sceneManager.comfortArcGroup.scale.setScalar(this.currentScale);

    // 2. Update Magnetic Gaze & Proximity Assist + Dwell-Select Radial Ring
    this.updateMagneticFocus();
    this.updateDwellSelect(deltaTime);

    // 3. Update Virtual Anchor Tether (One-Handed Weaving)
    if (this.latchedAnchorNode && this.tetherGroup.visible) {
      const pA = this.latchedAnchorNode.position;

      // Find active hand or fallback to cursor/gaze center
      const rightTele = this.handInputManager.getTelemetry('right');
      const leftTele = this.handInputManager.getTelemetry('left');
      const pB = rightTele.isTracked
        ? rightTele.indexTipPosition
        : leftTele.isTracked
        ? leftTele.indexTipPosition
        : this._v1.set(0, 1.2, -0.45);

      // Interpolate wavy electric tether line
      const linePosAttr = this.tetherLine.geometry.attributes.position as THREE.BufferAttribute;
      const numPts = linePosAttr.count;

      for (let i = 0; i < numPts; i++) {
        const s = i / (numPts - 1);
        const waveDisp = Math.sin(time * 12 + s * Math.PI * 4) * 0.008 * Math.sin(Math.PI * s);
        const pt = this._v2.lerpVectors(pA, pB, s);
        pt.y += waveDisp;
        linePosAttr.setXYZ(i, pt.x, pt.y, pt.z);
      }
      linePosAttr.needsUpdate = true;

      // Position prompt badge between nodes
      const mid = this._v3.addVectors(pA, pB).multiplyScalar(0.5);
      this.tetherPromptSprite.position.set(mid.x, mid.y + 0.08, mid.z);
    }

    // 4. Update Visual Haptic Sub-Bass Waveform Rings
    for (const wave of this.hapticWavePool) {
      if (!wave.active) continue;

      wave.progress += deltaTime * wave.speed;
      if (wave.progress >= 1.0) {
        wave.active = false;
        wave.mesh.visible = false;
        continue;
      }

      // Expansion radius
      const currentRadius = 0.03 + wave.progress * wave.maxRadius;
      const scale = currentRadius / 0.038;
      wave.mesh.scale.set(scale, scale, 1);

      // Camera orientation (billboard ripple ring)
      wave.mesh.lookAt(this.sceneManager.camera.position);

      // Opacity fadeout with sinusoidal ripple pulse
      const alpha = Math.sin((1.0 - wave.progress) * Math.PI);
      const ripplePulse = 0.7 + Math.sin(wave.progress * 18.0) * 0.3;
      (wave.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, alpha * ripplePulse * 0.85);
    }
  }

  /**
   * Status summary for HUD and demo telemetry
   */
  public getStatusSummary(): {
    suiteEnabled: boolean;
    isOneHanded: boolean;
    isCompact: boolean;
    hasLatchedTether: boolean;
    focusedNodeId: string | null;
    isDwellMode: boolean;
    dwellProgress: number;
    isHighContrast: boolean;
    isDyslexia: boolean;
  } {
    return {
      suiteEnabled: this.isAccessibilitySuiteEnabled,
      isOneHanded: this.isOneHandedModeActive,
      isCompact: this.isWorkspaceCompact,
      hasLatchedTether: this.latchedAnchorNode !== null,
      focusedNodeId: this.focusedNode ? this.focusedNode.id : null,
      isDwellMode: this.isDwellModeActive,
      dwellProgress: this.dwellProgress,
      isHighContrast: this.isHighContrastEnabled,
      isDyslexia: this.isDyslexiaTypographyEnabled
    };
  }
}
