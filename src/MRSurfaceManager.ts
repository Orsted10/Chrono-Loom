import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';

export interface MRSurface {
  id: string;
  orientation: 'horizontal' | 'vertical';
  semanticLabel: 'desk' | 'table' | 'wall' | 'floor';
  center: THREE.Vector3;
  normal: THREE.Vector3;
  width: number;
  height: number;
  rotation: THREE.Euler;
  meshGroup: THREE.Group;
  planeMesh: THREE.Mesh;
  wireframeLines: THREE.LineSegments;
  wireframeMaterial: THREE.LineBasicMaterial;
  fillMaterial: THREE.MeshBasicMaterial;
  lastHitTime: number;
  flashIntensity: number;
  isSimulated: boolean;
  rippleMesh?: THREE.Mesh;
}

export class MRSurfaceManager {
  private sceneManager: SceneManager;
  public surfacesGroup: THREE.Group;
  public surfaces: Map<string, MRSurface> = new Map();

  // MR Room Scan state
  public isRoomScanEnabled = true;
  private scanWaveTimer = 0;
  private isScanningActive = false;

  // Reusable vectors for zero-garbage performance
  private _v1 = new THREE.Vector3();
  private _v2 = new THREE.Vector3();
  private _v3 = new THREE.Vector3();
  private _planeNormal = new THREE.Vector3();
  private _planePoint = new THREE.Vector3();

  // Radar Scan Grid Mesh
  private scanGridMesh: THREE.Mesh | null = null;
  private scanGridMaterial: THREE.ShaderMaterial | null = null;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    this.surfacesGroup = new THREE.Group();
    this.surfacesGroup.name = 'MRSurfacesContainer';
    this.sceneManager.scene.add(this.surfacesGroup);

    // Initialize high-fidelity simulated real-world room surfaces
    // (Physical desk/table + 4 walls) for Desktop Simulator & VR testing
    this.initSimulatedRoomSurfaces();

    // Create radar wave scanner
    this.createScanRadarWave();
  }

  /**
   * Initializes realistic simulated physical surfaces:
   * 1. Physical Seated Desk/Table plane at y = 0.88m, centered in front of user
   * 2. Front Room Wall at z = -1.60m
   * 3. Left Room Wall at x = -1.45m
   * 4. Right Room Wall at x = 1.45m
   */
  private initSimulatedRoomSurfaces(): void {
    // 1. Physical Desk / Table Plane (Horizontal at y = 0.88m, z = -0.45m)
    this.registerSurface({

// [Chrono-Loom Milestone 1/8] feat(mr): initialize MRSurfaceManager.ts for Mixed Reality Passthrough
