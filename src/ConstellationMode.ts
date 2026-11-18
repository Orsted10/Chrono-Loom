import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { HandInputManager } from './HandInputManager.js';
import { LoomEngine } from './LoomEngine.js';
import { SpatialSynth } from './SpatialSynth.js';
import { AgentAria } from './AgentAria.js';

export type GameMode = 'FREEFORM' | 'DAILY_CONSTELLATION';

export interface ConstellationDayInfo {
  dayNumber: number;
  dayOffset: number;
  name: string;
  subtitle: string;
  rings: {
    id: string;
    pos: THREE.Vector3;
    freq: number;
    baseColor: THREE.Color;
    energizedColor: THREE.Color;
  }[];
  isHarmonized: boolean;
}

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

  // Phase 18: 7-Day Constellation Archive & Harmonic Streak
  public activeDayOffset = 0;
  public activeDayNumber = 322;
  public activeConstellationName = "#322 Today's Zenith";
  public activeConstellationSub = 'Corona Borealis Triad';
  public harmonyStreak = 0;
  public readonly STREAK_KEY = 'chronoloom_streak_v1';
  public isArchiveDrawerOpen = false;
  private archiveDrawerGroup!: THREE.Group;
  private archiveHeaderSprite!: THREE.Sprite;
  private archiveButtons: {
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

    this.harmonyStreak = this.getHarmonyStreak();

    this.modeGroup = new THREE.Group();
    this.modeGroup.name = 'ConstellationMode';
    this.sceneManager.scene.add(this.modeGroup);

    // 1. Container for Target Rings
    this.ringContainer = new THREE.Group();
    this.ringContainer.name = 'TargetRings';
    this.modeGroup.add(this.ringContainer);

    // 2. Build Spatial Wrist HUD & 7-Day Archive Drawer
    this.hudGroup = this.createSpatialWristHUD();
    this.modeGroup.add(this.hudGroup);

    // 3. Initialize Daily Constellation Puzzle (defaults to offset 0: #322 Today's Zenith)
    this.loadConstellationByDayOffset(0);

    console.log('[ConstellationMode] Initialized 7-Day Constellation Archive & Spatial Wrist HUD.');
  }

  // ----------------------------------------------------
  // 1. 7-Day Constellation Archive & Deterministic Generator
  // ----------------------------------------------------

  /**
   * Deterministic seeded constellation generator
   * Supports curated historical 7-day sequence (0 to -6) and procedural infinite archive
   */
  public getConstellationByDayOffset(offset: number): ConstellationDayInfo {
    const baseDay = 322;
    const dayNumber = baseDay + offset;

    const curatedPresets: Record<number, { name: string; sub: string; rings: any[] }> = {
      0: {
        name: "#322 Today's Zenith",
        sub: 'Corona Borealis Triad',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.18, 1.15, -0.44), freq: 329.63, baseColor: new THREE.Color(0x00f0ff), energizedColor: new THREE.Color(0x34d399) },
          { id: 'ring_2', pos: new THREE.Vector3(0.00, 1.28, -0.46), freq: 440.00, baseColor: new THREE.Color(0xa855f7), energizedColor: new THREE.Color(0xfbbf24) },
          { id: 'ring_3', pos: new THREE.Vector3(0.18, 1.13, -0.43), freq: 523.25, baseColor: new THREE.Color(0xf59e0b), energizedColor: new THREE.Color(0x00ff88) }
        ]
      },
      '-1': {
        name: '#321 Pleiades Triad',
        sub: 'Taurus Seven Sisters',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.14, 1.24, -0.42), freq: 369.99, baseColor: new THREE.Color(0x38bdf8), energizedColor: new THREE.Color(0x2563eb) },
          { id: 'ring_2', pos: new THREE.Vector3(0.08, 1.14, -0.45), freq: 293.66, baseColor: new THREE.Color(0xa855f7), energizedColor: new THREE.Color(0xf43f5e) },
          { id: 'ring_3', pos: new THREE.Vector3(0.16, 1.30, -0.41), freq: 493.88, baseColor: new THREE.Color(0xfbbf24), energizedColor: new THREE.Color(0xffffff) }
        ]
      },
      '-2': {
        name: '#320 Lyra Spiral',
        sub: 'Vega Resonance',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.20, 1.18, -0.46), freq: 261.63, baseColor: new THREE.Color(0x6366f1), energizedColor: new THREE.Color(0x00f0ff) },
          { id: 'ring_2', pos: new THREE.Vector3(-0.02, 1.12, -0.40), freq: 392.00, baseColor: new THREE.Color(0xf43f5e), energizedColor: new THREE.Color(0xf59e0b) },
          { id: 'ring_3', pos: new THREE.Vector3(0.12, 1.26, -0.45), freq: 587.33, baseColor: new THREE.Color(0x2dd4bf), energizedColor: new THREE.Color(0x10b981) }
        ]
      },
      '-3': {
        name: "#319 Orion's Harp",
        sub: 'Belt of Orion',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.16, 1.12, -0.45), freq: 146.83, baseColor: new THREE.Color(0xd97706), energizedColor: new THREE.Color(0xfbbf24) },
          { id: 'ring_2', pos: new THREE.Vector3(0.02, 1.22, -0.42), freq: 220.00, baseColor: new THREE.Color(0x06b6d4), energizedColor: new THREE.Color(0x34d399) },
          { id: 'ring_3', pos: new THREE.Vector3(0.19, 1.20, -0.44), freq: 329.63, baseColor: new THREE.Color(0x8b5cf6), energizedColor: new THREE.Color(0xec4899) }
        ]
      },
      '-4': {
        name: '#318 Andromeda Gate',
        sub: 'Spiral Nexus',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.12, 1.30, -0.43), freq: 196.00, baseColor: new THREE.Color(0x0ea5e9), energizedColor: new THREE.Color(0xf59e0b) },
          { id: 'ring_2', pos: new THREE.Vector3(0.00, 1.15, -0.46), freq: 261.63, baseColor: new THREE.Color(0xc084fc), energizedColor: new THREE.Color(0x84cc16) },
          { id: 'ring_3', pos: new THREE.Vector3(0.14, 1.16, -0.41), freq: 392.00, baseColor: new THREE.Color(0xf97316), energizedColor: new THREE.Color(0xfbbf24) }
        ]
      },
      '-5': {
        name: '#317 Cygnus Cross',
        sub: 'Northern Cross',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.22, 1.22, -0.44), freq: 185.00, baseColor: new THREE.Color(0x10b981), energizedColor: new THREE.Color(0x00f0ff) },
          { id: 'ring_2', pos: new THREE.Vector3(0.00, 1.25, -0.44), freq: 523.25, baseColor: new THREE.Color(0x00f0ff), energizedColor: new THREE.Color(0xffffff) },
          { id: 'ring_3', pos: new THREE.Vector3(0.20, 1.18, -0.42), freq: 659.25, baseColor: new THREE.Color(0xec4899), energizedColor: new THREE.Color(0xfbbf24) }
        ]
      },
      '-6': {
        name: '#316 Cassiopeia Crown',
        sub: 'Circumpolar Throne',
        rings: [
          { id: 'ring_1', pos: new THREE.Vector3(-0.15, 1.16, -0.42), freq: 164.81, baseColor: new THREE.Color(0xeab308), energizedColor: new THREE.Color(0x10b981) },
          { id: 'ring_2', pos: new THREE.Vector3(-0.04, 1.28, -0.45), freq: 246.94, baseColor: new THREE.Color(0x06b6d4), energizedColor: new THREE.Color(0x8b5cf6) },
          { id: 'ring_3', pos: new THREE.Vector3(0.16, 1.24, -0.43), freq: 369.99, baseColor: new THREE.Color(0xf43f5e), energizedColor: new THREE.Color(0xfef08a) }
        ]
      }
    };

    const preset = curatedPresets[offset];
    if (preset) {
      return {
        dayNumber,
        dayOffset: offset,
        name: preset.name,
        subtitle: preset.sub,
        rings: preset.rings,
        isHarmonized: this.isDaySolved(dayNumber)
      };
    }

    // Procedural deterministic fallback for any arbitrary dayOffset
    const seed = Math.abs(dayNumber * 9301 + 49297);
    const r1 = ((seed * 11) % 1000) / 1000;
    const r2 = ((seed * 17) % 1000) / 1000;
    const r3 = ((seed * 23) % 1000) / 1000;

    const scale = [220.00, 261.63, 329.63, 392.00, 440.00, 523.25, 659.25];
    const freq1 = scale[Math.floor(r1 * scale.length)];
    const freq2 = scale[Math.floor(r2 * scale.length)];
    const freq3 = scale[Math.floor(r3 * scale.length)];

    return {
      dayNumber,
      dayOffset: offset,
      name: `#${dayNumber} Cosmic Alignment`,
      subtitle: 'Deterministic Deep Space Locus',
      rings: [
        {
          id: 'ring_1',
          pos: new THREE.Vector3(-0.20 + r1 * 0.1, 1.12 + r2 * 0.1, -0.45),
          freq: freq1,
          baseColor: new THREE.Color(0x00f0ff),
          energizedColor: new THREE.Color(0x34d399)
        },
        {
          id: 'ring_2',
          pos: new THREE.Vector3(-0.05 + r2 * 0.1, 1.22 + r3 * 0.1, -0.44),
          freq: freq2,
          baseColor: new THREE.Color(0xa855f7),
          energizedColor: new THREE.Color(0xfbbf24)
        },
        {
          id: 'ring_3',
          pos: new THREE.Vector3(0.12 + r3 * 0.1, 1.14 + r1 * 0.1, -0.42),
          freq: freq3,
          baseColor: new THREE.Color(0xf59e0b),
          energizedColor: new THREE.Color(0x00ff88)
        }
      ],
      isHarmonized: this.isDaySolved(dayNumber)
    };
  }

  /**
   * Loads a target constellation by day offset (0 = today, -1 = yesterday, etc.)
   */
  public loadConstellationByDayOffset(offset: number): void {
    this.currentMode = 'DAILY_CONSTELLATION';
    this.activeDayOffset = offset;
    const info = this.getConstellationByDayOffset(offset);

    this.activeDayNumber = info.dayNumber;
    this.activeConstellationName = info.name;
    this.activeConstellationSub = info.subtitle;

    this.clearTargetRings();
    this.isHarmonized = false;
    this.removeVictoryBanner();

    for (const config of info.rings) {
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

    console.log(`[ConstellationMode] Loaded Constellation "${info.name}" (${info.subtitle}) with ${this.targetRings.length} rings.`);
  }

  /**
   * Backward-compatible alias for Day #322
   */
  public initDailyPuzzle322(): void {
    this.loadConstellationByDayOffset(0);
  }

  // ----------------------------------------------------
  // Streak Tracking & Persistence
  // ----------------------------------------------------

  public recordDailyHarmonyStreak(dayNum: number): void {
    try {
      const raw = localStorage.getItem(this.STREAK_KEY);
      let data = raw ? JSON.parse(raw) : { streakCount: 0, lastSolvedDay: 0, solvedDays: [] };
      if (!Array.isArray(data.solvedDays)) data.solvedDays = [];

      if (!data.solvedDays.includes(dayNum)) {
        data.solvedDays.push(dayNum);
        if (data.lastSolvedDay === dayNum - 1) {
          data.streakCount += 1;
        } else if (data.lastSolvedDay === dayNum) {
          // already counted today
        } else {
          data.streakCount = 1;
        }
        data.lastSolvedDay = dayNum;
        localStorage.setItem(this.STREAK_KEY, JSON.stringify(data));
      }
      this.harmonyStreak = data.streakCount || 1;
      this.refreshArchiveDrawerLabels();
    } catch (e) {
      console.warn('[ConstellationMode] Failed to save streak:', e);
    }
  }

  public getHarmonyStreak(): number {
    try {
      const raw = localStorage.getItem(this.STREAK_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return data.streakCount || 0;
      }
    } catch (e) {}
    return 0;
  }

  public isDaySolved(dayNum: number): boolean {
    try {
      const raw = localStorage.getItem(this.STREAK_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return Array.isArray(data.solvedDays) && data.solvedDays.includes(dayNum);
      }
    } catch (e) {}
    return false;
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
  }

  /**
   * Energizes a single Target Resonance Ring
   */
  private energizeRing(ring: TargetResonanceRing, pulse: any): void {
    ring.isEnergized = true;
    ring.energizeTime = performance.now();

    // Turn vibrant energized color
    const mat = ring.torusMesh.material as THREE.MeshStandardMaterial;
    mat.color.copy(ring.energizedColor);
    mat.emissive.copy(ring.energizedColor);
    mat.emissiveIntensity = 1.2;
    ring.glowLight.color.copy(ring.energizedColor);
    ring.glowLight.intensity = 2.4;

    // Resonant spatial tone
    this.spatialSynth.playSpatialNote({
      frequency: ring.targetFrequency,
      position: ring.position,
      intensity: 1.4,
      duration: 1.4
    });

    // Particle burst at ring center & visual haptic sub-bass wave
    this.loomEngine.spawnParticleBurst(ring.position, 18, ring.energizedColor, 0.06);
    this.accessibilityManager?.triggerVisualHapticWave(ring.position, ring.targetFrequency, 1.6);

    if (!this.isApplyingRemote) {
      this.onRingHit?.(ring.id);
    }

    console.log(`[ConstellationMode] Ring [${ring.id}] ENERGIZED! (${ring.targetFrequency.toFixed(1)}Hz)`);
  }

  /**
   * Phase 11: Remote Multiplayer Ring Energize
   */
  public applyRemoteRingHit(ringId: string): void {
    const ring = this.targetRings.find((r) => r.id === ringId);
    if (ring && !ring.isEnergized) {
      this.isApplyingRemote = true;
      this.energizeRing(ring, null);
      this.isApplyingRemote = false;

      const allEnergized = this.targetRings.every((r) => r.isEnergized);
      if (allEnergized && !this.isHarmonized && this.targetRings.length === 3) {
        this.triggerConstellationHarmonized(true);
      }
    }
  }

  /**
   * Phase 11: Remote Multiplayer Supernova
   */
  public applyRemoteHarmonizedCoop(): void {
    if (!this.isHarmonized) {
      this.isApplyingRemote = true;
      this.triggerConstellationHarmonized(true);
      this.isApplyingRemote = false;
    }
  }

  /**
   * Victory Celebration: Massive celebratory supernova & chord progression
   * In Cooperative Mode: Doubles particle supernova intensity (240 gold + 120 purple + 80 cyan)!
   */
  public triggerConstellationHarmonized(isCoop: boolean = false): void {
    this.isHarmonized = true;
    const coopActive = isCoop || this.isCoopMultiplayer;
    console.log(`[ConstellationMode] CONSTELLATION HARMONIZED! (Co-op: ${coopActive}) Triggering Supernova & Triumphant Progression.`);

    // Record streak in localStorage
    this.recordDailyHarmonyStreak(this.activeDayNumber);

    const centerPos = new THREE.Vector3(0, 1.22, -0.45);

    // 1. Massive Particle Supernova: Doubled intensity in Co-op mode!
    const goldCount = coopActive ? 240 : 120;
    const purpleCount = coopActive ? 120 : 60;
    this.loomEngine.spawnParticleBurst(centerPos, goldCount, new THREE.Color(0xffd700), coopActive ? 0.15 : 0.12);
    this.loomEngine.spawnParticleBurst(centerPos, purpleCount, new THREE.Color(0xa855f7), coopActive ? 0.12 : 0.09);
    if (coopActive) {
      this.loomEngine.spawnParticleBurst(centerPos, 80, new THREE.Color(0x00f0ff), 0.14);
      this.sceneManager.triggerCymaticPulse(centerPos, new THREE.Color(0xffd700), 2.2);
    }

    // 2. Triumphant Spatial Chord Progression (C4 -> E4 -> G4 -> B4 -> C5)
    const victoryNotes = [261.63, 329.63, 392.00, 493.88, 523.25];
    victoryNotes.forEach((freq, idx) => {
      setTimeout(() => {
        this.spatialSynth.playSpatialNote({
          frequency: freq,
          position: centerPos,
          intensity: coopActive ? 1.8 : 1.5,
          duration: 2.2
        });
        if (coopActive) {
          // Dual voice harmony (Octave + 5th overtone)
          this.spatialSynth.playSpatialNote({
            frequency: freq * 1.5,
            position: new THREE.Vector3(centerPos.x + (idx % 2 === 0 ? 0.1 : -0.1), centerPos.y + 0.05, centerPos.z),
            intensity: 1.2,
            duration: 1.8
          });
        }
      }, idx * 150);
    });

    // 3. Display 3D Holographic Victory Banner
    this.spawnVictoryBanner(centerPos, coopActive);

    // 4. Signal Aria to enter joyful CELEBRATING flight dance!
    this.agentAria.triggerCelebrating();

    // 5. Notify multiplayer peer if not remote triggered
    if (!this.isApplyingRemote && coopActive) {
      this.onHarmonizedCoop?.();
    }
  }

  /**
   * Spawns radiant 3D holographic victory billboard
   */
  private spawnVictoryBanner(pos: THREE.Vector3, isCoop: boolean = false): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Gold/Emerald border
    ctx.fillStyle = 'rgba(7, 24, 45, 0.94)';
    ctx.strokeStyle = isCoop ? '#f43f5e' : '#ffd700';
    ctx.lineWidth = 8;
    this.drawRoundedRect(ctx, 20, 20, 984, 216, 40);
    ctx.fill();
    ctx.stroke();

    // Glow banner
    ctx.shadowColor = isCoop ? '#f43f5e' : '#00ff88';
    ctx.shadowBlur = 25;

    ctx.font = 'bold 48px "Space Grotesk", sans-serif';
    ctx.fillStyle = isCoop ? '#ffd700' : '#ffd700';
    ctx.textAlign = 'center';
    ctx.fillText(isCoop ? '✨ CO-OP HARMONIZED! // DUAL SUPERNOVA' : 'CONSTELLATION HARMONIZED!', 512, 104);

    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.fillStyle = isCoop ? '#fb7185' : '#34d399';
    const streakStr = `🔥 HARMONY STREAK: ${this.harmonyStreak} DAYS`;
    ctx.fillText(
      isCoop
        ? `TWO WEAVERS RESONATING AS ONE // ${streakStr}`
        : `${this.activeConstellationName.toUpperCase()} COMPLETE // ${streakStr}`,
      512,
      172
    );

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.98,
      depthTest: false
    });

    this.victoryBanner = new THREE.Sprite(mat);
    this.victoryBanner.scale.set(isCoop ? 0.65 : 0.58, 0.145, 1);
    this.victoryBanner.position.set(pos.x, pos.y + 0.16, pos.z);
    this.modeGroup.add(this.victoryBanner);
  }

  private removeVictoryBanner(): void {
    if (this.victoryBanner) {
      this.modeGroup.remove(this.victoryBanner);
      (this.victoryBanner.material as THREE.Material).dispose();
      this.victoryBanner = null;
    }
  }

  // ----------------------------------------------------
  // 2. Spatial Wrist HUD & 7-Day Archive Drawer
  // ----------------------------------------------------

  /**
   * Builds the tactile floating Wrist HUD with 6 big interactive buttons & 7-Day Archive Drawer
   */
  public toggleWristHUD(): boolean {
    this.hudGroup.visible = !this.hudGroup.visible;
    return this.hudGroup.visible;
  }

  private createSpatialWristHUD(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'SpatialWristHUD';
    group.position.copy(this.defaultHudPos);
    group.visible = false; // Hidden by default to keep 3D spatial field clean and uncluttered!

    // Background glass plate (extended to 0.42m height)
    const plateGeo = new THREE.PlaneGeometry(0.32, 0.42);
    const plateMat = new THREE.MeshBasicMaterial({
      color: 0x07182d,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide
    });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    group.add(plate);

    // Glowing border outline
    const edgesGeo = new THREE.EdgesGeometry(plateGeo);
    const glowLine = new THREE.LineSegments(
      edgesGeo,
      new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 })
    );
    group.add(glowLine);

    // Tactile Buttons Configuration (6 Buttons including 7-Day Archive & Scale Presets)
    const buttonData = [
      {
        id: 'btn_puzzle',
        label: 'DAILY PUZZLE #322',
        sub: '3-Ring Harmonic Challenge',
        yOffset: 0.145,
        baseColor: 0x0284c7,
        hoverColor: 0x00f0ff,
        action: () => {
          this.currentMode = 'DAILY_CONSTELLATION';
          this.loadConstellationByDayOffset(0);
          this.playButtonAudioChime(587.33);
        }
      },
      {
        id: 'btn_archive',
        label: '⭐ 7-DAY ARCHIVE ▾',
        sub: `Revisit Past Constellations [${this.harmonyStreak}🔥]`,
        yOffset: 0.088,
        baseColor: 0x0891b2,
        hoverColor: 0x22d3ee,
        action: () => {
          this.toggleArchiveDrawer();
          this.playButtonAudioChime(659.25);
        }
      },
      {
        id: 'btn_freeform',
        label: 'FREEFORM LOOM',
        sub: 'Open Creative Sculpting',
        yOffset: 0.030,
        baseColor: 0x7c3aed,
        hoverColor: 0xa855f7,
        action: () => {
          this.currentMode = 'FREEFORM';
          this.clearTargetRings();
          this.removeVictoryBanner();
          this.playButtonAudioChime(440.0);
        }
      },
      {
        id: 'btn_scale',
        label: 'CYCLE SCALE [1-5]',
        sub: 'Lydian / Hirajoshi / Yaman',
        yOffset: -0.028,
        baseColor: 0xc026d3,
        hoverColor: 0xf43f5e,
        action: () => {
          this.onScaleCycle?.();
          this.playButtonAudioChime(493.88);
        }
      },
      {
        id: 'btn_a11y',
        label: 'ACCESSIBILITY: ON',
        sub: '1-Hand Tether & Shapes',
        yOffset: -0.086,
        baseColor: 0x059669,
        hoverColor: 0x10b981,
        action: () => {
          const enabled = this.accessibilityManager?.toggleAccessibilitySuite() ?? false;
          this.playButtonAudioChime(enabled ? 523.25 : 329.63);
        }
      },
      {
        id: 'btn_reset',
        label: 'CLEAR & RESET',
        sub: 'Restore Seed Orb',
        yOffset: -0.144,
        baseColor: 0xb45309,
        hoverColor: 0xf59e0b,
        action: () => {
          this.loomEngine.resetLoom();
          this.agentAria.reset();
          if (this.currentMode === 'DAILY_CONSTELLATION') {
            this.loadConstellationByDayOffset(this.activeDayOffset);
          }
          this.playButtonAudioChime(329.63);
        }
      }
    ];

    for (const b of buttonData) {
      // 3D Button Box
      const btnGeo = new THREE.BoxGeometry(0.28, 0.045, 0.012);
      const btnMat = new THREE.MeshStandardMaterial({
        color: b.baseColor,
        emissive: b.baseColor,
        emissiveIntensity: 0.45,
        roughness: 0.3,
        metalness: 0.5
      });
      const btnMesh = new THREE.Mesh(btnGeo, btnMat);
      btnMesh.position.set(0, b.yOffset, 0.008);
      group.add(btnMesh);

      // Label sprite
      const labelSprite = this.createButtonLabelSprite(b.label, b.sub);
      labelSprite.position.set(0, b.yOffset, 0.018);
      group.add(labelSprite);

      this.buttons.push({
        id: b.id,
        mesh: btnMesh,
        labelSprite,
        action: b.action,
        baseColor: b.baseColor,
        hoverColor: b.hoverColor
      });
    }

    // Attach 7-Day Archive Side Drawer
    this.archiveDrawerGroup = this.createArchiveDrawer();
    group.add(this.archiveDrawerGroup);

    return group;
  }

  /**
   * Builds the 7-Day Star-Map side drawer attached to the Wrist HUD
   */
  private createArchiveDrawer(): THREE.Group {
    const drawer = new THREE.Group();
    drawer.name = 'ConstellationArchiveDrawer';
    drawer.position.set(0.27, 0, 0);
    drawer.visible = false;

    // Drawer glass background
    const drawerGeo = new THREE.PlaneGeometry(0.22, 0.42);
    const drawerMat = new THREE.MeshBasicMaterial({
      color: 0x051326,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide
    });
    const drawerPlate = new THREE.Mesh(drawerGeo, drawerMat);
    drawer.add(drawerPlate);

    const drawerEdges = new THREE.EdgesGeometry(drawerGeo);
    const drawerLine = new THREE.LineSegments(
      drawerEdges,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    drawer.add(drawerLine);

    // Drawer Header Sprite
    this.archiveHeaderSprite = this.createArchiveHeaderSprite();
    this.archiveHeaderSprite.position.set(0, 0.175, 0.015);
    drawer.add(this.archiveHeaderSprite);

    // 7 Day Buttons: Offsets 0, -1, -2, -3, -4, -5, -6
    const offsets = [0, -1, -2, -3, -4, -5, -6];
    const btnGeo = new THREE.BoxGeometry(0.19, 0.038, 0.010);

    offsets.forEach((offset, idx) => {
      const yPos = 0.12 - idx * 0.046;
      const info = this.getConstellationByDayOffset(offset);
      const isSolved = this.isDaySolved(info.dayNumber);

      const baseColor = isSolved ? 0x059669 : (offset === 0 ? 0x0284c7 : 0x1e293b);
      const hoverColor = isSolved ? 0x10b981 : 0x00f0ff;

      const btnMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.5
      });
      const btnMesh = new THREE.Mesh(btnGeo, btnMat);
      btnMesh.position.set(0, yPos, 0.008);
      drawer.add(btnMesh);

      const labelText = `#${info.dayNumber} ${info.name.split(' ')[1] || 'Star'}${offset === 0 ? ' (TODAY)' : ''}`;
      const subText = isSolved ? '⭐ SOLVED' : info.subtitle.slice(0, 18);

      const labelSprite = this.createButtonLabelSprite(labelText, subText);
      labelSprite.scale.set(0.18, 0.045, 1);
      labelSprite.position.set(0, yPos, 0.016);
      drawer.add(labelSprite);

      this.archiveButtons.push({
        id: `archive_day_${offset}`,
        mesh: btnMesh,
        labelSprite,
        action: () => {
          this.loadConstellationByDayOffset(offset);
          this.playButtonAudioChime(523.25);
          this.refreshArchiveDrawerLabels();
        },
        baseColor,
        hoverColor
      });
    });

    return drawer;
  }

  private createArchiveHeaderSprite(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 30px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.fillText('7-DAY STAR-MAP', 256, 38);

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`🔥 STREAK: ${this.harmonyStreak} DAYS`, 256, 76);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.19, 0.045, 1);
    return sprite;
  }

  public toggleArchiveDrawer(): boolean {
    this.isArchiveDrawerOpen = !this.isArchiveDrawerOpen;
    if (this.archiveDrawerGroup) {
      this.archiveDrawerGroup.visible = this.isArchiveDrawerOpen;
      if (this.isArchiveDrawerOpen) {
        this.refreshArchiveDrawerLabels();
      }
    }
    return this.isArchiveDrawerOpen;
  }

  public refreshArchiveDrawerLabels(): void {
    if (!this.archiveDrawerGroup) return;

    // Refresh Header
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 30px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.textAlign = 'center';
    ctx.fillText('7-DAY STAR-MAP', 256, 38);

    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`🔥 STREAK: ${this.harmonyStreak} DAYS`, 256, 76);

    (this.archiveHeaderSprite.material as THREE.SpriteMaterial).map = new THREE.CanvasTexture(canvas);
    (this.archiveHeaderSprite.material as THREE.SpriteMaterial).map!.needsUpdate = true;

    // Refresh Buttons Solved Colors
    const offsets = [0, -1, -2, -3, -4, -5, -6];
    offsets.forEach((offset, idx) => {
      const btn = this.archiveButtons[idx];
      if (!btn) return;

      const info = this.getConstellationByDayOffset(offset);
      const isSolved = this.isDaySolved(info.dayNumber);
      const isCurrent = this.activeDayOffset === offset;

      const col = isCurrent ? 0x0284c7 : (isSolved ? 0x059669 : 0x1e293b);
      (btn.mesh.material as THREE.MeshStandardMaterial).color.setHex(col);
      (btn.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(col);
    });
  }

  private createButtonLabelSprite(mainText: string, subText: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.font = 'bold 36px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(mainText, 256, 52);

    ctx.font = '22px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subText, 256, 96);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.26, 0.065, 1);
    return sprite;
  }

  private playButtonAudioChime(freq: number): void {
    this.spatialSynth.playSpatialNote({
      frequency: freq,
      position: this.hudGroup.position,
      intensity: 1.2,
      duration: 0.35
    });
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y + w, x, y, r);
    ctx.closePath();
  }

  /**
   * Evaluates hand fingertip touches on HUD buttons
   */
  private checkButtonTouches(): void {
    const rightTele = this.handInputManager.getTelemetry('right');
    if (!rightTele.isTracked) return;

    const fingerPos = rightTele.indexTipPosition;
    const now = performance.now();

    const activeButtons = this.isArchiveDrawerOpen
      ? [...this.buttons, ...this.archiveButtons]
      : this.buttons;

    for (const btn of activeButtons) {
      const btnWorld = new THREE.Vector3();
      btn.mesh.getWorldPosition(btnWorld);
      const d = fingerPos.distanceTo(btnWorld);

      // Poke threshold: 35mm
      if (d < 0.035 && now - this.lastButtonPressTime > 400) {
        this.lastButtonPressTime = now;
        (btn.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.0;
        setTimeout(() => {
          (btn.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.45;
        }, 180);
        btn.action();
        break;
      }
    }
  }

  // ----------------------------------------------------
  // Per-Frame Update Loop
  // ----------------------------------------------------

  public update(deltaTime: number): void {
    const time = performance.now() * 0.001;

    // 1. Position Wrist HUD: only update if visible
    if (this.hudGroup.visible) {
      const leftTele = this.handInputManager.getTelemetry('left');
      if (leftTele.isTracked && !this.handInputManager.isSimulatorActive) {
        // Anchored to Left Wrist in VR
        const wristPos = leftTele.wristPosition;
        this.hudGroup.position.set(wristPos.x - 0.08, wristPos.y + 0.06, wristPos.z + 0.04);
        this.hudGroup.lookAt(this.sceneManager.camera.position);
      } else {
        // Smoothly float at top-left ergonomic position
        this.hudGroup.position.lerp(this.defaultHudPos, 0.1);
        this.hudGroup.lookAt(this.sceneManager.camera.position);
      }
    }

    // 2. Animate Target Resonance Rings
    for (const ring of this.targetRings) {
      ring.torusMesh.rotation.z += 0.015;
      ring.torusMesh.rotation.y += 0.008;

      if (ring.isEnergized) {
        // Glowing energized pulse
        const p = Math.sin(time * 6.0) * 0.3;
        ring.glowLight.intensity = 1.8 + p;
      } else {
        // Subtle ambient ring glow
        const p = Math.sin(time * 2.5) * 0.15;
        ring.glowLight.intensity = 1.0 + p;
      }
    }

    // 3. Periodic preview chime in puzzle mode (every 6 seconds)
    if (this.currentMode === 'DAILY_CONSTELLATION' && !this.isHarmonized) {
      this.previewChimeTimer += deltaTime;
      if (this.previewChimeTimer >= 6.5) {
        this.previewChimeTimer = 0;
        this.playPreviewSequence();
      }
    }

    // 4. Check Kinetic Pulses passing through rings
    this.checkPulseRingIntersections();

    // 5. Check tactile finger pokes on Wrist HUD
    this.checkButtonTouches();

    // 6. Floating Victory Banner bob
    if (this.victoryBanner) {
      this.victoryBanner.position.y = 1.38 + Math.sin(time * 2.5) * 0.012;
    }

    // 7. Compact Seated Workspace lerp for Target Resonance Rings
    if (this.accessibilityManager) {
      const targetZ = this.accessibilityManager.isWorkspaceCompact ? 0.15 : 0.0;
      const targetScale = this.accessibilityManager.isWorkspaceCompact ? 0.72 : 1.0;
      this.ringContainer.position.z = THREE.MathUtils.lerp(this.ringContainer.position.z, targetZ, 0.12);
      this.ringContainer.scale.setScalar(THREE.MathUtils.lerp(this.ringContainer.scale.x, targetScale, 0.12));
    }
  }

  /**
   * Status readout for UI HUD
   */
  public getStatusSummary(): {
    currentMode: GameMode;
    ringsEnergized: number;
    totalRings: number;
    isHarmonized: boolean;
    dayNumber: number;
    constellationName: string;
    constellationSub: string;
    harmonyStreak: number;
    isArchiveOpen: boolean;
  } {
    const energizedCount = this.targetRings.filter((r) => r.isEnergized).length;
    return {
      currentMode: this.currentMode,
      ringsEnergized: energizedCount,
      totalRings: this.targetRings.length,
      isHarmonized: this.isHarmonized,
      dayNumber: this.activeDayNumber,
      constellationName: this.activeConstellationName,
      constellationSub: this.activeConstellationSub,
      harmonyStreak: this.harmonyStreak,
      isArchiveOpen: this.isArchiveDrawerOpen
    };
  }
}
