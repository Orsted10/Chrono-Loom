import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';

export interface SceneManagerOptions {
  container?: HTMLElement;
  showDeskArc?: boolean;
}

interface CymaticWave {
  mesh: THREE.Mesh;
  progress: number;
  speed: number;
  maxRadius: number;
  color: THREE.Color;
  active: boolean;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cameraRig: THREE.Group;
  public comfortArcGroup: THREE.Group;
  public particlesMesh: THREE.Points;
  public titleHeaderGroup: THREE.Group;
  public floorMesh!: THREE.Mesh;
  public container: HTMLElement;

  public isPassthroughActive = false;

  private clock: THREE.Clock;
  private particlePositions: Float32Array;
  private particleVelocities: Float32Array;
  private particlePhases: Float32Array;
  private floorMaterial: THREE.MeshBasicMaterial;
  private arcMaterial: THREE.MeshPhysicalMaterial;

// [Chrono-Loom Milestone 1/20] feat(scene): initialize WebGLRenderer with antialias and logarithmic depth buffer
