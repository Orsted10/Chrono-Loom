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
        this.loomEngine.spawnParticleBurst(targetNode.position, 12, new THREE.Color(0xffd700), 0.04);
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
      position: new THREE.Vector3(0, 1.2, -0.4),
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
      // Mid Tier: Crystalline Octahedron
      coreGeo = new THREE.OctahedronGeometry(0.035, 1);
      shellGeo = new THREE.OctahedronGeometry(0.043, 1);
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

    // Border styling based on tier
    const borderColor =
      tierInfo.tier === 'BASS' ? '#f59e0b' : tierInfo.tier === 'MID' ? '#00f0ff' : '#a855f7';
    ctx.fillStyle = 'rgba(7, 24, 45, 0.90)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 5;

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

    // Text: Note Name + Pitch Tier + Frequency
    ctx.font = 'bold 46px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${tierInfo.noteName} [${tierInfo.tier}]`, 256, 68);

    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillStyle = borderColor;
    ctx.fillText(`${Math.round(freq)} Hz // ${tierInfo.shapeName}`, 256, 114);

// [Chrono-Loom Milestone 14/19] feat(a11y): add smooth 0.6s cubic-ease translation between distance modes
