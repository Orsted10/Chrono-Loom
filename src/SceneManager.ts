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
    this.deskGlow = new THREE.PointLight(0x00f0ff, 1.5, 2.5);
    this.deskGlow.position.set(0, 0.9, -0.45);
    this.scene.add(this.deskGlow);
  }

  /**
   * Phase 12: Smoothly shifts global chromatic lighting palette to match selected Scale Preset
   */
  public setChromaticPalette(palette: {
    primaryColor: THREE.Color;
    accentColor: THREE.Color;
    cymaticColor: THREE.Color;
    ambientColor: THREE.Color;
  }): void {
    if (this.ambientLight) this.ambientLight.color.copy(palette.ambientColor);
    if (this.keyLight) this.keyLight.color.copy(palette.primaryColor);
    if (this.rimLight) this.rimLight.color.copy(palette.accentColor);
    if (this.deskGlow) this.deskGlow.color.copy(palette.primaryColor);
    if (this.arcGlowEdge) (this.arcGlowEdge.material as THREE.LineBasicMaterial).color.copy(palette.primaryColor);
    if (this.pulseRing) (this.pulseRing.material as THREE.MeshBasicMaterial).color.copy(palette.cymaticColor);
  }

  /**
   * Builds procedural glowing cyber-zen floor grid at y = 0
   */
  private createFloorGrid(): THREE.MeshBasicMaterial {
    // Canvas-generated radial fading grid texture
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, size, size);

    // Radial vignette mask
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 20, center, center, center);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
    gradient.addColorStop(0.3, 'rgba(0, 240, 255, 0.12)');
    gradient.addColorStop(0.7, 'rgba(14, 165, 233, 0.04)');
    gradient.addColorStop(1, 'rgba(3, 7, 18, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Concentric rings
    ctx.lineWidth = 1.5;
    const rings = [60, 120, 180, 260, 340, 420];
    rings.forEach((r, idx) => {
      ctx.strokeStyle = idx % 2 === 0 ? 'rgba(0, 240, 255, 0.28)' : 'rgba(56, 189, 248, 0.12)';
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Radial spokes
    const numSpokes = 24;
    for (let i = 0; i < numSpokes; i++) {
      const angle = (i * Math.PI * 2) / numSpokes;
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(0, 240, 255, 0.2)' : 'rgba(14, 165, 233, 0.07)';
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * 40, center + Math.sin(angle) * 40);
      ctx.lineTo(center + Math.cos(angle) * 480, center + Math.sin(angle) * 480);
      ctx.stroke();
    }

    // Grid lines pattern overlay
    const gridSpacing = 32;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    const gridTexture = new THREE.CanvasTexture(canvas);
    gridTexture.wrapS = THREE.ClampToEdgeWrapping;
    gridTexture.wrapT = THREE.ClampToEdgeWrapping;

    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.MeshBasicMaterial({
      map: gridTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false
    });

    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = 0.001;
    this.scene.add(this.floorMesh);

    return floorMat;
  }

  /**
   * Concentric expanding energy wave on the floor
   */
  private createFloorPulseRing(): THREE.Mesh {
    const ringGeo = new THREE.RingGeometry(0.1, 0.15, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.003;
    return ringMesh;
  }

  /**
   * Creates exactly 300 floating ambient bioluminescent dust particles
   */
  private createAmbientDustParticles(count: number = 300): {
    mesh: THREE.Points;
    positions: Float32Array;
    velocities: Float32Array;
    phases: Float32Array;
  } {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    // Generate circular soft glow particle texture
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 64;
    const pCtx = pCanvas.getContext('2d')!;
    const pGrad = pCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    pGrad.addColorStop(0.2, 'rgba(0, 240, 255, 0.9)');
    pGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.3)');
    pGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    pCtx.fillStyle = pGrad;
    pCtx.fillRect(0, 0, 64, 64);

    const particleTexture = new THREE.CanvasTexture(pCanvas);

    // Distribute particles within a cylinder/hemisphere around seated user
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const radius = 0.25 + Math.random() * 2.2;
      const angle = Math.random() * Math.PI * 2;
      const height = 0.4 + Math.random() * 2.0;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = height;
      positions[i3 + 2] = Math.sin(angle) * radius;

      // Gentle floating drift velocities
      velocities[i3] = (Math.random() - 0.5) * 0.015;
      velocities[i3 + 1] = 0.008 + Math.random() * 0.018;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.015;

      phases[i] = Math.random() * Math.PI * 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 0.035,
      map: particleTexture,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const mesh = new THREE.Points(geometry, material);
    mesh.name = 'AmbientDustParticles';
    return { mesh, positions, velocities, phases };
  }

  /**
   * Curved semi-transparent "Seated Comfort Arc" desk zone 0.45m in front of the user
   * (Within a 2-foot / ~0.6m airplane-seat radius envelope)
   */
  private createSeatedComfortArc(): {
    group: THREE.Group;
    material: THREE.MeshPhysicalMaterial;
    glowEdge: THREE.LineSegments;
  } {
    const deskGroup = new THREE.Group();
    deskGroup.name = 'SeatedComfortArc';

    // Seated comfort geometry:
    // Center of arc is at the user (0, 0).
    // Radius spans from 0.38m (inner edge) to 0.56m (outer edge) -> comfortably 0.45m in front of user!
    // Angular span: centered along -Z axis (angle ~ -pi/2), spanning 70 degrees (Math.PI * 0.39)
    const innerRadius = 0.36;
    const outerRadius = 0.56;
    const thetaSegments = 48;
    const phiSegments = 8;
    const thetaStart = Math.PI * 0.5 - 0.65; // facing negative Z
    const thetaLength = 1.30; // ~74.5 degrees wide arc

    // Create curved surface
    const arcGeo = new THREE.RingGeometry(
      innerRadius,
      outerRadius,
      thetaSegments,
      phiSegments,
      thetaStart,
      thetaLength
    );

    // High-tech frosted glass / holographic physical material
    const arcMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x071b2d,
      emissive: 0x003d5c,
      emissiveIntensity: 0.3,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.45,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const arcMesh = new THREE.Mesh(arcGeo, arcMaterial);
    arcMesh.name = 'DeskSurface';

    // Position arc at comfortable lap/desk height (y = 0.98m), rotated horizontally with a slight 8-deg incline towards user
    arcMesh.rotation.x = Math.PI / 2 + 0.14; // slight tilt upward towards eyes
    arcMesh.position.set(0, 0.96, 0); // centered at user X,Z = 0, arcs into Z < 0
    deskGroup.add(arcMesh);

    // Glowing neon bioluminescent borders
    const edgesGeo = new THREE.EdgesGeometry(arcGeo, 20);
    const glowLineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const glowEdge = new THREE.LineSegments(edgesGeo, glowLineMat);
    glowEdge.rotation.copy(arcMesh.rotation);
    glowEdge.position.copy(arcMesh.position);
    glowEdge.position.y += 0.001;
    deskGroup.add(glowEdge);

    // Holographic chronoloom weaver ticks along the outer rim
    const tickGroup = new THREE.Group();
    const tickMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.6
    });

    const numTicks = 25;
    for (let i = 0; i <= numTicks; i++) {
      const t = i / numTicks;
      const angle = thetaStart + t * thetaLength;
      const r1 = outerRadius - 0.025;
      const r2 = outerRadius + 0.005;

      const p1 = new THREE.Vector3(Math.cos(angle) * r1, Math.sin(angle) * r1, 0);
      const p2 = new THREE.Vector3(Math.cos(angle) * r2, Math.sin(angle) * r2, 0);

      const tickLineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const tickLine = new THREE.Line(tickLineGeo, tickMat);
      tickGroup.add(tickLine);
    }
    tickGroup.rotation.copy(arcMesh.rotation);
    tickGroup.position.copy(arcMesh.position);
    tickGroup.position.y += 0.002;
    deskGroup.add(tickGroup);

    // Decorative holographic comfort-zone HUD reticle at center of arc (0, 0.98, -0.46)
    const reticleGeo = new THREE.RingGeometry(0.015, 0.022, 32);
    const reticleMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const reticleMesh = new THREE.Mesh(reticleGeo, reticleMat);
    reticleMesh.rotation.x = Math.PI / 2;
    reticleMesh.position.set(0, 1.0, -0.45);
    deskGroup.add(reticleMesh);

    return { group: deskGroup, material: arcMaterial, glowEdge };
  }

  /**
   * Triggers visual interactive feedback on the comfort arc desk
   */
  public setDeskHighlight(amount: number): void {
    this.targetDeskHighlight = THREE.MathUtils.clamp(amount, 0, 1);
  }

  /**
   * Updates animations per frame
   */
  public update(deltaTime: number): void {
    const elapsedTime = this.clock.getElapsedTime();

    // 1. Update floating ambient dust particles (gentle sinusoidal drift & wrap)
    const posAttr = this.particlesMesh.geometry.attributes.position as THREE.BufferAttribute;
    const count = this.particlePhases.length;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const phase = this.particlePhases[i];

      // Vertical oscillation
      this.particlePositions[i3 + 1] += this.particleVelocities[i3 + 1] * deltaTime;
      this.particlePositions[i3] += Math.sin(elapsedTime * 0.8 + phase) * 0.0006;
      this.particlePositions[i3 + 2] += Math.cos(elapsedTime * 0.8 + phase) * 0.0006;

      // Wrap particles if they float above 2.4m or drift too far
      if (this.particlePositions[i3 + 1] > 2.4) {
        this.particlePositions[i3 + 1] = 0.4;
      }
      const distSq =
        this.particlePositions[i3] * this.particlePositions[i3] +
        this.particlePositions[i3 + 2] * this.particlePositions[i3 + 2];
      if (distSq > 6.0) {
        this.particlePositions[i3] *= 0.7;
        this.particlePositions[i3 + 2] *= 0.7;
      }
    }
    posAttr.needsUpdate = true;

    // Subtle breathing glow on particles
    const pMat = this.particlesMesh.material as THREE.PointsMaterial;
    pMat.opacity = 0.65 + Math.sin(elapsedTime * 1.5) * 0.15;

    // 2. Expand floor pulse ring
    const pulseScale = (elapsedTime * 0.6) % 1.0;
    const ringRadius = 0.3 + pulseScale * 5.0;
    this.pulseRing.scale.set(ringRadius, ringRadius, 1);
    const pulseMat = this.pulseRing.material as THREE.MeshBasicMaterial;
    pulseMat.opacity = Math.max(0, (1 - pulseScale) * 0.35);

    // 3. Smooth comfort desk highlight interpolation
    this.currentDeskHighlight = THREE.MathUtils.lerp(
      this.currentDeskHighlight,
      this.targetDeskHighlight,
      0.1
    );
    this.arcMaterial.emissiveIntensity = 0.25 + this.currentDeskHighlight * 0.7;
    (this.arcGlowEdge.material as THREE.LineBasicMaterial).opacity =
      0.75 + this.currentDeskHighlight * 0.25;

    // Gentle desk floating micro-bob
    this.comfortArcGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.002;

    // Gentle 3D title header floating bob
    if (this.titleHeaderGroup) {
      this.titleHeaderGroup.position.y = 1.75 + Math.sin(elapsedTime * 1.4) * 0.008;
    }

    // 4. Animate Audio-Reactive Cymatic Sonar Waves
    for (const wave of this.cymaticPool) {
      if (wave.active) {
        wave.progress += deltaTime * wave.speed;
        const radius = 0.08 + wave.progress * wave.maxRadius;
        wave.mesh.scale.set(radius, radius, 1);
        const opacity = Math.max(0, (1 - wave.progress) * 0.85);
        (wave.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;

        if (wave.progress >= 1.0) {
          wave.active = false;
          wave.mesh.visible = false;
        }
      }
    }
  }

  /**
   * Initializes a reusable pool of expanding Cymatic Sonar Wave rings
   */
  private initCymaticWavePool(count: number = 8): void {
    const ringGeo = new THREE.RingGeometry(0.06, 0.10, 64);

    for (let i = 0; i < count; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });

      const mesh = new THREE.Mesh(ringGeo, ringMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, 0.004, 0);
      mesh.visible = false;
      this.cymaticContainer.add(mesh);

      this.cymaticPool.push({
        mesh,
        progress: 1.0,
        speed: 1.2,
        maxRadius: 2.2,
        color: new THREE.Color(0x00f0ff),
        active: false
      });
    }
  }

  /**
   * Triggers an expanding Cymatic Sonar Wave Ring on the floor and desk zone
   * when a string is plucked or a node pulse collision occurs.
   */
  public triggerCymaticPulse(pos: THREE.Vector3, color: THREE.Color, intensity: number = 1.0): void {
    // Find an inactive wave or the oldest active one
    let targetWave = this.cymaticPool.find((w) => !w.active);
    if (!targetWave) {
      targetWave = this.cymaticPool.reduce((prev, curr) =>
        curr.progress > prev.progress ? curr : prev
      );
    }

    targetWave.mesh.position.set(pos.x, 0.004, pos.z);
    targetWave.color.copy(color);
    (targetWave.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
    targetWave.progress = 0.0;
    targetWave.speed = 1.0 + intensity * 0.4;
    targetWave.maxRadius = 1.4 + intensity * 1.2;
    targetWave.active = true;
    targetWave.mesh.visible = true;

    // Flash Seated Comfort Arc desk highlight
    this.setDeskHighlight(Math.min(1.0, intensity * 0.85));
  }

  /**
   * Mixed Reality (MR) Passthrough Manager:
   * When immersive-ar session starts, clears background, hides dark fog and opaque floor
   * so user's real room is visible on Quest 3, leaving only floating holographic instruments!
   */
  public setPassthroughMode(isAR: boolean): void {
    this.isPassthroughActive = isAR;

// [Chrono-Loom Milestone 17/20] feat(cymatics): expand concentric wave rings across floor matching pluck frequencies
