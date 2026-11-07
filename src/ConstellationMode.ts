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
    this.loomEngine = loomEngine;
    this.spatialSynth = spatialSynth;
    this.agentAria = agentAria;

    this.modeGroup = new THREE.Group();
    this.modeGroup.name = 'ConstellationMode';
    this.sceneManager.scene.add(this.modeGroup);

    // 1. Container for Target Rings
    this.ringContainer = new THREE.Group();
    this.ringContainer.name = 'TargetRings';
    this.modeGroup.add(this.ringContainer);

    // 2. Build Spatial Wrist HUD
    this.hudGroup = this.createSpatialWristHUD();
    this.modeGroup.add(this.hudGroup);

    // 3. Initialize Daily Constellation Puzzle #322
    this.initDailyPuzzle322();

    console.log('[ConstellationMode] Initialized Daily Constellation #322 & Spatial Wrist HUD.');
  }

  // ----------------------------------------------------
  // 1. Daily Constellation Puzzle #322
  // ----------------------------------------------------

  /**
   * Spawns 3 Target Resonance Rings in 3D space
   */
  public initDailyPuzzle322(): void {
    this.clearTargetRings();
    this.isHarmonized = false;
    this.removeVictoryBanner();

    const ringConfigs = [
      {
        id: 'ring_1',
        pos: new THREE.Vector3(-0.18, 1.15, -0.44),
        freq: 329.63, // E4
        baseColor: new THREE.Color(0x00f0ff), // Cyan
        energizedColor: new THREE.Color(0x34d399) // Emerald
      },
      {
        id: 'ring_2',
        pos: new THREE.Vector3(0.00, 1.28, -0.46),
        freq: 440.00, // A4
        baseColor: new THREE.Color(0xa855f7), // Magenta
        energizedColor: new THREE.Color(0xfbbf24) // Gold
      },
      {
        id: 'ring_3',
        pos: new THREE.Vector3(0.18, 1.13, -0.43),
        freq: 523.25, // C5
        baseColor: new THREE.Color(0xf59e0b), // Amber
        energizedColor: new THREE.Color(0x00ff88) // Lime
      }
    ];

    for (const config of ringConfigs) {
      const group = new THREE.Group();
      group.position.copy(config.pos);

      // Torus Ring Mesh
      const torusGeo = new THREE.TorusGeometry(0.042, 0.0035, 16, 48);
      const torusMat = new THREE.MeshStandardMaterial({
        color: config.baseColor,
        emissive: config.baseColor,
        emissiveIntensity: 0.65,
        roughness: 0.2,
        metalness: 0.4,
        transparent: true,
        opacity: 0.88
      });
      const torusMesh = new THREE.Mesh(torusGeo, torusMat);
      group.add(torusMesh);

      // Outer concentric aura ring
      const auraGeo = new THREE.RingGeometry(0.046, 0.052, 32);
      const auraMat = new THREE.MeshBasicMaterial({
        color: config.baseColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      group.add(auraMesh);

      // Core point light
      const glowLight = new THREE.PointLight(config.baseColor, 1.2, 0.35);
      group.add(glowLight);

      this.ringContainer.add(group);

      this.targetRings.push({
        id: config.id,
        position: config.pos,
        meshGroup: group,
        torusMesh,
        glowLight,
        targetFrequency: config.freq,
        baseColor: config.baseColor,
        energizedColor: config.energizedColor,
        isEnergized: false,
        energizeTime: 0
      });
    }

    console.log('[ConstellationMode] Spawned 3 Target Resonance Rings for Constellation #322.');
  }

  /**
   * Cleans up all rings
   */
  private clearTargetRings(): void {
    for (const ring of this.targetRings) {
      this.ringContainer.remove(ring.meshGroup);
      ring.torusMesh.geometry.dispose();
      (ring.torusMesh.material as THREE.Material).dispose();
    }
    this.targetRings = [];
  }

  /**
   * Preview chime: periodically plays the target sequence (E4 -> A4 -> C5)
   */
  private playPreviewSequence(): void {
    this.targetRings.forEach((ring, idx) => {
      setTimeout(() => {
        if (!this.isHarmonized) {
          this.spatialSynth.playSpatialNote({
            frequency: ring.targetFrequency,
            position: ring.position,
            intensity: 0.85,
            duration: 0.9
          });
          // Ring brief pulse
          ring.glowLight.intensity = 2.0;
        }
      }, idx * 320);
    });
  }

  /**
   * Checks if kinetic Chrono-Pulses are passing through target rings
   */
  private checkPulseRingIntersections(): void {
    if (this.isHarmonized || this.currentMode !== 'DAILY_CONSTELLATION') return;

    for (const pulse of this.loomEngine.pulses.values()) {
      const pulsePos = pulse.meshGroup.position;

      for (const ring of this.targetRings) {
        if (!ring.isEnergized) {
          const dist = pulsePos.distanceTo(ring.position);

          // Pulse passes through ring aperture (< 45mm)
          if (dist < 0.045) {
            this.energizeRing(ring, pulse);
          }
        }
      }
    }

    // Check victory condition: all 3 rings energized!
    const allEnergized = this.targetRings.every((r) => r.isEnergized);
    if (allEnergized && !this.isHarmonized && this.targetRings.length === 3) {
      this.triggerConstellationHarmonized(this.isCoopMultiplayer);
    }

// [Chrono-Loom Milestone 6/17] feat(constellation): illuminate rings with neon blue activation pulse on hit
