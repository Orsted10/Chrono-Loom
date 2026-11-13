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
      id: 'sim_surface_table',
      orientation: 'horizontal',
      semanticLabel: 'table',
      center: new THREE.Vector3(0, 0.88, -0.45),
      normal: new THREE.Vector3(0, 1, 0),
      width: 1.15,
      height: 0.65,
      rotation: new THREE.Euler(-Math.PI / 2, 0, 0),
      isSimulated: true
    });

    // 2. Front Wall Plane (Vertical at z = -1.65m)
    this.registerSurface({
      id: 'sim_surface_front_wall',
      orientation: 'vertical',
      semanticLabel: 'wall',
      center: new THREE.Vector3(0, 1.30, -1.65),
      normal: new THREE.Vector3(0, 0, 1),
      width: 2.80,
      height: 2.20,
      rotation: new THREE.Euler(0, 0, 0),
      isSimulated: true
    });

    // 3. Left Wall Plane (Vertical at x = -1.50m)
    this.registerSurface({
      id: 'sim_surface_left_wall',
      orientation: 'vertical',
      semanticLabel: 'wall',
      center: new THREE.Vector3(-1.50, 1.30, -0.40),
      normal: new THREE.Vector3(1, 0, 0),
      width: 2.40,
      height: 2.20,
      rotation: new THREE.Euler(0, Math.PI / 2, 0),
      isSimulated: true
    });

    // 4. Right Wall Plane (Vertical at x = 1.50m)
    this.registerSurface({
      id: 'sim_surface_right_wall',
      orientation: 'vertical',
      semanticLabel: 'wall',
      center: new THREE.Vector3(1.50, 1.30, -0.40),
      normal: new THREE.Vector3(-1, 0, 0),
      width: 2.40,
      height: 2.20,
      rotation: new THREE.Euler(0, -Math.PI / 2, 0),
      isSimulated: true
    });
  }

  /**
   * Builds and registers a new physical surface with translucent fill and neon edge wireframes
   */
  private registerSurface(config: {
    id: string;
    orientation: 'horizontal' | 'vertical';
    semanticLabel: 'desk' | 'table' | 'wall' | 'floor';
    center: THREE.Vector3;
    normal: THREE.Vector3;
    width: number;
    height: number;
    rotation: THREE.Euler;
    isSimulated: boolean;
  }): MRSurface {
    const group = new THREE.Group();
    group.name = `Surface_${config.id}`;
    group.position.copy(config.center);
    group.rotation.copy(config.rotation);

// [Chrono-Loom Milestone 2/8] feat(mr): detect real-world horizontal and vertical planes via XRFrame.detectedPlanes
