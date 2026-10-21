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
  private arcGlowEdge: THREE.LineSegments;
  private pulseRing: THREE.Mesh;

  // Phase 12: Chromatic Lighting References
  public ambientLight!: THREE.AmbientLight;
  public keyLight!: THREE.DirectionalLight;
  public rimLight!: THREE.DirectionalLight;
  public deskGlow!: THREE.PointLight;

  // Audio-Reactive Cymatic Sonar Wave Pool
  private cymaticPool: CymaticWave[] = [];
  private cymaticContainer: THREE.Group;

  private isUserInteracting = false;
  private targetDeskHighlight = 0;
  private currentDeskHighlight = 0;

  constructor(options: SceneManagerOptions = {}) {
    this.container = options.container || document.body;
    this.clock = new THREE.Clock();

    // 1. Scene setup with cyber-zen bioluminescent void fog
    this.scene = new THREE.Scene();
    const voidColor = new THREE.Color(0x030712);
    this.scene.background = voidColor;
    this.scene.fog = new THREE.FogExp2(0x030712, 0.12);

    // 2. Camera rig: Seated VR eye level (y = 1.2m, z = 0)
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'CameraRig';
    this.cameraRig.position.set(0, 1.2, 0);
    this.scene.add(this.cameraRig);

    // Camera attached to rig
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.05,
      80
    );
    this.camera.position.set(0, 0, 0);
    this.cameraRig.add(this.camera);

    // 3. Renderer with WebXR enabled
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // Unified WebXR Launch Toolbar (VR Void + Mixed Reality AR Passthrough)
    const launchToolbar = document.createElement('div');
    launchToolbar.id = 'webxr-launch-toolbar';
    launchToolbar.className = 'webxr-toolbar-container';

    const vrButton = VRButton.createButton(this.renderer, {
      optionalFeatures: ['hand-tracking', 'local-floor', 'bounded-floor', 'layers']
    });
    vrButton.id = 'vr-button-element';

    const arButton = ARButton.createButton(this.renderer, {
      optionalFeatures: [
        'hand-tracking',
        'local-floor',
        'hit-test',
        'plane-detection',
        'mesh-detection'
      ]
    });
    arButton.id = 'ar-button-element';

    launchToolbar.appendChild(vrButton);
    launchToolbar.appendChild(arButton);
    document.body.appendChild(launchToolbar);

    // Watch WebXR session transitions to enable/disable Quest Passthrough
    this.renderer.xr.addEventListener('sessionstart', () => {
      const session = this.renderer.xr.getSession() as any;
      const isAR =
        session?.mode === 'immersive-ar' ||
        session?.environmentBlendMode === 'additive' ||
        session?.environmentBlendMode === 'alpha-blend';
      this.setPassthroughMode(!!isAR);
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.setPassthroughMode(false);
    });

    // 4. Lighting: Subtle bioluminescent accents
    this.setupLighting();

    // 5. Procedural grid floor
    this.floorMaterial = this.createFloorGrid();

    // 6. Floating ambient dust particles (exactly 300 points)
    const { mesh, positions, velocities, phases } = this.createAmbientDustParticles(300);
    this.particlesMesh = mesh;
    this.particlePositions = positions;
    this.particleVelocities = velocities;
    this.particlePhases = phases;
    this.scene.add(this.particlesMesh);

    // 7. Seated Comfort Arc Desk Zone (0.45m in front of user, 2-foot reach radius)
    const { group, material, glowEdge } = this.createSeatedComfortArc();
    this.comfortArcGroup = group;
    this.arcMaterial = material;
    this.arcGlowEdge = glowEdge;
    this.scene.add(this.comfortArcGroup);

    // 8. Concentric floor pulse & Cymatic Sonar Wave Pool
    this.pulseRing = this.createFloorPulseRing();
    this.scene.add(this.pulseRing);

    this.cymaticContainer = new THREE.Group();
    this.cymaticContainer.name = 'CymaticWaves';
    this.scene.add(this.cymaticContainer);
    this.initCymaticWavePool(8);

    // 9. Floating 3D Title Header high above workspace (y = 1.75m, z = -1.2m)
    this.titleHeaderGroup = this.createFloatingTitleHeader();
    this.scene.add(this.titleHeaderGroup);

    // 10. Resize and interactions
    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  /**
   * Sets up subtle cyberpunk bioluminescent lighting
   */
  private setupLighting(): void {
    // Ambient soft indigo/teal glow
    this.ambientLight = new THREE.AmbientLight(0x0a192f, 0.9);
    this.scene.add(this.ambientLight);

    // Main overhead key light (soft cyan bioluminescence)
    this.keyLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
    this.keyLight.position.set(1.5, 3.5, 0.5);
    this.scene.add(this.keyLight);

    // Fill rim light (neon magenta / deep purple)
    this.rimLight = new THREE.DirectionalLight(0xa855f7, 0.8);
    this.rimLight.position.set(-2, 1.5, -2);
    this.scene.add(this.rimLight);

    // Under-desk soft bioluminescent point light

// [Chrono-Loom Milestone 5/20] feat(scene): configure directional key light and ambient celestial fill
