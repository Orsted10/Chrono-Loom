import * as THREE from 'three';
import { LoomEngine } from './LoomEngine';
import { EuclideanEngine } from './EuclideanEngine';
import { SceneManager } from './SceneManager';
import { SpatialSynth } from './SpatialSynth';
import { AgentAria, AriaAIMode } from './AgentAria';

export interface GodModeComposition {
  id: string;
  name: string;
  tagline: string;
  scaleIndex: number;
  scaleName: string;
  bpm: number;
  description: string;
  icon: string;
  nodeLayout: Array<{
    x: number;
    y: number;
    z: number;
    noteFreq?: number;
    k: number;
    n: number;
  }>;
  stringConnections: Array<[number, number]>;
  ariaMode: AriaAIMode;
}

export const GOD_MODE_PRESETS: GodModeComposition[] = [
  {
    id: 'cyber-cathedral',
    name: 'Cyber-Cathedral Zenith',
    tagline: 'Dual-Triangle Lydian Harp & Infinite Reverb',
    scaleIndex: 0, // Celestial Lydian
    scaleName: 'Celestial Lydian',
    bpm: 92,
    description: 'Intertwined crystalline triangles sounding luminous fourths and fifths with cascading quantum solitons.',
    icon: '✨',
    nodeLayout: [
      { x: -0.22, y: 1.08, z: -0.48, k: 3, n: 8 },  // Base Left
      { x: 0.22, y: 1.08, z: -0.48, k: 3, n: 8 },   // Base Right
      { x: 0.0, y: 1.38, z: -0.44, k: 5, n: 8 },    // Apex High
      { x: -0.14, y: 1.22, z: -0.38, k: 2, n: 4 },  // Inner Left
      { x: 0.14, y: 1.22, z: -0.38, k: 2, n: 4 },   // Inner Right
      { x: 0.0, y: 1.10, z: -0.36, k: 1, n: 4 },    // Core Center
    ],
    stringConnections: [
      [0, 1], [1, 2], [2, 0], // Outer Triangle
      [3, 4], [4, 5], [5, 3], // Inner Triangle
      [0, 3], [1, 4], [2, 5], // Interlocking struts
    ],
    ariaMode: 'CO-CREATE'
  },
  {
    id: 'tokyo-midnight',
    name: 'Tokyo Midnight Neon',
    tagline: 'Hirajoshi Pentagram & Sub-Bass Pulse',
    scaleIndex: 1, // Cyberpunk Hirajoshi
    scaleName: 'Hirajoshi Minor',
    bpm: 80,
    description: 'Traditional Japanese minor pentatonic arranged in a five-pointed star with deep 60Hz sub-bass haptic rings.',
    icon: '🌸',
    nodeLayout: [
      { x: 0.0, y: 1.36, z: -0.45, k: 1, n: 5 },    // Top
      { x: 0.24, y: 1.20, z: -0.46, k: 2, n: 5 },   // Top Right
      { x: 0.15, y: 0.98, z: -0.44, k: 3, n: 5 },   // Bottom Right
      { x: -0.15, y: 0.98, z: -0.44, k: 3, n: 5 },  // Bottom Left
      { x: -0.24, y: 1.20, z: -0.46, k: 2, n: 5 },  // Top Left
    ],
    stringConnections: [
      [0, 2], [2, 4], [4, 1], [1, 3], [3, 0], // Pentagram Star
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0]  // Outer Pentagonal Shield
    ],
    ariaMode: 'RHYTHM_BOOST'
  },
  {
    id: 'raga-sunset',
    name: 'Raga Yaman Sunset',
    tagline: 'Microtonal Evening Arc & Amber Resonance',
    scaleIndex: 3, // Sunset Yaman
    scaleName: 'Raga Yaman',
    bpm: 72,
    description: 'Sweeping 7-string celestial crescent evoking North Indian classical twilight with lush drone swells.',
    icon: '🌅',
    nodeLayout: [
      { x: -0.28, y: 1.02, z: -0.48, k: 3, n: 7 }, // Root Sa
      { x: -0.20, y: 1.12, z: -0.46, k: 2, n: 7 }, // Re
      { x: -0.10, y: 1.24, z: -0.44, k: 3, n: 7 }, // Ga
      { x: 0.00, y: 1.34, z: -0.42, k: 4, n: 7 },  // Teevra Ma
      { x: 0.10, y: 1.24, z: -0.44, k: 3, n: 7 },  // Pa
      { x: 0.20, y: 1.12, z: -0.46, k: 2, n: 7 },  // Dha
      { x: 0.28, y: 1.02, z: -0.48, k: 3, n: 7 },  // Ni
    ],
    stringConnections: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], // Arc Backbone
      [0, 3], [3, 6], [1, 5], [2, 4]                  // Cross-Resonant Bridges
    ],
    ariaMode: 'ZEN_SOLO'
  },
  {
    id: 'polyrhythm-matrix',
    name: 'Clockwork Polyrhythm Matrix',
    tagline: 'Interlocking 3:4 & 5:8 Euclidean Rhythms',
    scaleIndex: 2, // Solar Phrygian
    scaleName: 'Solar Phrygian',
    bpm: 116,
    description: 'High-energy kinetic matrix demonstrating Bjorklund Euclidean rhythms firing synchronized clockwork pulses.',
    icon: '⚙️',
    nodeLayout: [
      { x: -0.22, y: 1.26, z: -0.44, k: 3, n: 8 },  // Top-Left Tresillo
      { x: 0.22, y: 1.26, z: -0.44, k: 5, n: 8 },   // Top-Right Cinquillo
      { x: 0.22, y: 1.02, z: -0.44, k: 4, n: 12 },  // Bottom-Right Triplet
      { x: -0.22, y: 1.02, z: -0.44, k: 7, n: 16 }, // Bottom-Left Samba
      { x: 0.0, y: 1.14, z: -0.40, k: 1, n: 4 },    // Heart Downbeat
    ],
    stringConnections: [
      [0, 1], [1, 2], [2, 3], [3, 0], // Outer Box
      [0, 4], [1, 4], [2, 4], [3, 4], // Cross Spoke
      [0, 2], [1, 3]                  // Diametric Diagonals
    ],
    ariaMode: 'CO-CREATE'
  },
  {
    id: 'quantum-infinity',
    name: 'Quantum Lemniscate (Infinity)',
    tagline: 'Continuous Round-Robin Kinetic Pulse Relay',
    scaleIndex: 4, // Deep Obsidian
    scaleName: 'Deep Obsidian',
    bpm: 104,
    description: 'Figure-eight infinite topology where kinetic pulses perpetually circumnavigate the dual loops without stopping.',
    icon: '♾️',
    nodeLayout: [
      { x: 0.0, y: 1.18, z: -0.42, k: 2, n: 4 },   // Crossover Node
      { x: -0.15, y: 1.28, z: -0.44, k: 3, n: 8 }, // Left Upper
      { x: -0.25, y: 1.18, z: -0.44, k: 3, n: 8 }, // Left Outer
      { x: -0.15, y: 1.08, z: -0.44, k: 3, n: 8 }, // Left Lower
      { x: 0.15, y: 1.28, z: -0.44, k: 3, n: 8 },  // Right Upper
      { x: 0.25, y: 1.18, z: -0.44, k: 3, n: 8 },  // Right Outer
      { x: 0.15, y: 1.08, z: -0.44, k: 3, n: 8 },  // Right Lower
    ],
    stringConnections: [
      [0, 1], [1, 2], [2, 3], [3, 0], // Left Loop
      [0, 4], [4, 5], [5, 6], [6, 0], // Right Loop
      [1, 6], [3, 4]                  // Quantum Cross-Chords
    ],
    ariaMode: 'RHYTHM_BOOST'
  }
];

export class CompositionsManager {
  private loomEngine: LoomEngine;
  private euclideanEngine: EuclideanEngine;
  private sceneManager: SceneManager;
  private spatialSynth: SpatialSynth;
  private aria: AgentAria;

  public activeCompositionId: string | null = null;
  public onCompositionLoaded?: (comp: GodModeComposition) => void;

  constructor(
    loomEngine: LoomEngine,
    euclideanEngine: EuclideanEngine,
    sceneManager: SceneManager,
    spatialSynth: SpatialSynth,
    aria: AgentAria
  ) {
    this.loomEngine = loomEngine;
    this.euclideanEngine = euclideanEngine;
    this.sceneManager = sceneManager;
    this.spatialSynth = spatialSynth;
    this.aria = aria;

    console.log('[CompositionsManager] Initialized with 5 God-Mode Presets.');
  }

  public getPresets(): GodModeComposition[] {
    return GOD_MODE_PRESETS;
  }

  /**
   * Instantly loads a breathtaking self-playing musical sculpture in 3D space
   */
  public async loadComposition(id: string): Promise<boolean> {
    const preset = GOD_MODE_PRESETS.find(p => p.id === id);
    if (!preset) {
      console.warn(`[CompositionsManager] Preset not found: ${id}`);
      return false;
    }

    console.log(`[CompositionsManager] Loading God-Mode Masterpiece: "${preset.name}"...`);

    // 1. Clear existing loom gracefully
    this.loomEngine.resetLoom();

    // 2. Set scale and tempo
    this.euclideanEngine.applyScalePreset(preset.scaleIndex, false);
    this.loomEngine.setGlobalBPM(preset.bpm);

    // 3. Set Aria AI companion mode
    this.aria.setAIMode(preset.ariaMode);

    // 4. Spawn Nodes in parallel sequence with rhythmic audio blossom
    const spawnedNodes: any[] = [];
    const freqs = this.spatialSynth.activeScaleFrequencies || [
      261.63, 293.66, 329.63, 369.99, 392.0, 440.0, 493.88, 523.25
    ];

    for (let i = 0; i < preset.nodeLayout.length; i++) {
      const def = preset.nodeLayout[i];
      const pos = new THREE.Vector3(def.x, def.y, def.z);
      const freq = def.noteFreq || freqs[i % freqs.length];

      const node = this.loomEngine.spawnHarmonicNode(pos, freq);
      if (node) {
        // Configure Euclidean rhythm
        this.euclideanEngine.attachEuclideanRing(node, def.k, def.n as any);
        spawnedNodes.push(node);

        // Small blossom particle burst
        this.loomEngine.spawnParticleBurst(pos, 10, node.baseColor, 0.04);
      }
    }

    // 5. Weave Strings between defined connections
    for (const [idxA, idxB] of preset.stringConnections) {
      if (idxA < spawnedNodes.length && idxB < spawnedNodes.length) {
        const nodeA = spawnedNodes[idxA];
        const nodeB = spawnedNodes[idxB];
        this.loomEngine.createChronoString(nodeA, nodeB);
      }
    }

    // 6. Audio Flourish & Cymatic Wave
    this.spatialSynth.playSpatialNote({
      frequency: freqs[0] * 2,
      position: new THREE.Vector3(0, 1.25, -0.45),
      intensity: 1.4,
      duration: 1.8
    });
    this.sceneManager.triggerCymaticPulse(
      new THREE.Vector3(0, 1.25, -0.45),
      new THREE.Color(0x00f0ff),
      1.8
    );

    // 7. Aria celebratory animation
    this.aria.triggerEmotionalAnim('JOYFUL_BARREL_ROLL', 1.2);

    this.activeCompositionId = preset.id;
    this.onCompositionLoaded?.(preset);

    // Holographic toast notification
    this.loomEngine.showHolographicToast(
      `✨ ${preset.name.toUpperCase()}`,
      `${preset.tagline} // ${preset.bpm} BPM`,
      3.2
    );

    return true;
  }
}
