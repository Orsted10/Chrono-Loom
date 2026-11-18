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

    // 1. Subtle, translucent planar fill (faint cyber-grid)
    const planeGeo = new THREE.PlaneGeometry(config.width, config.height, 4, 4);
    const isTable = config.semanticLabel === 'table' || config.semanticLabel === 'desk';
    const baseColor = isTable ? 0x00f0ff : 0xa855f7;

    const fillMaterial = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: 0.04,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const planeMesh = new THREE.Mesh(planeGeo, fillMaterial);
    group.add(planeMesh);

    // 2. Subtle neon edge wireframes (glows on strike/scan, fades over 4s)
    const edgesGeo = new THREE.EdgesGeometry(planeGeo);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: isTable ? 0x00f0ff : 0x38bdf8,
      linewidth: 2,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const wireframeLines = new THREE.LineSegments(edgesGeo, wireframeMaterial);
    group.add(wireframeLines);

    // 3. Impact Ripple Ring for acoustic wall-bounces
    const rippleGeo = new THREE.RingGeometry(0.02, 0.045, 32);
    const rippleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
    rippleMesh.position.z = 0.005; // Just off the surface
    rippleMesh.visible = false;
    group.add(rippleMesh);

    this.surfacesGroup.add(group);

    const surface: MRSurface = {
      id: config.id,
      orientation: config.orientation,
      semanticLabel: config.semanticLabel,
      center: config.center,
      normal: config.normal.clone().normalize(),
      width: config.width,
      height: config.height,
      rotation: config.rotation,
      meshGroup: group,
      planeMesh,
      wireframeLines,
      wireframeMaterial,
      fillMaterial,
      lastHitTime: performance.now() / 1000,
      flashIntensity: 0.8,
      isSimulated: config.isSimulated,
      rippleMesh
    };

    this.surfaces.set(config.id, surface);
    return surface;
  }

  /**
   * Procedural Radar Scanner Wave for Room Scanning
   */
  private createScanRadarWave(): void {
    const geo = new THREE.RingGeometry(0.1, 0.25, 64);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(0x00f0ff) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float dist = distance(vUv, vec2(0.5));
          float alpha = smoothstep(0.5, 0.45, dist) * smoothstep(0.2, 0.35, dist);
          gl_FragColor = vec4(uColor, alpha * 0.7);
        }
      `
    });

    this.scanGridMaterial = mat;
    this.scanGridMesh = new THREE.Mesh(geo, mat);
    this.scanGridMesh.rotation.x = -Math.PI / 2;
    this.scanGridMesh.position.set(0, 0.89, -0.45);
    this.scanGridMesh.visible = false;
    this.surfacesGroup.add(this.scanGridMesh);
  }

  /**
   * Main per-frame update loop called from animation loop
   */
  public update(deltaTime: number, frame?: XRFrame): void {
    const now = performance.now() / 1000;

    // 1. Process WebXR Detected Planes if available in Quest 3 AR Passthrough
    if (frame && (frame as any).detectedPlanes && this.isRoomScanEnabled) {
      this.updateWebXRPlanes(frame);
    }

    // 2. Animate and fade surface wireframes & ripples
    for (const surface of this.surfaces.values()) {
      if (!this.isRoomScanEnabled) {
        surface.meshGroup.visible = false;
        continue;
      }
      surface.meshGroup.visible = true;

      // Calculate time since last hit / scan
      const elapsedSinceHit = now - surface.lastHitTime;

      // Fading out after 4s unless a pulse strikes them
      let targetOpacity = 0.05; // Idle subtle trace
      if (elapsedSinceHit < 4.0) {
        const fade = 1.0 - elapsedSinceHit / 4.0;
        targetOpacity = THREE.MathUtils.lerp(0.05, 0.75, fade) + surface.flashIntensity * 0.4;
      } else {
        targetOpacity = THREE.MathUtils.lerp(surface.wireframeMaterial.opacity, 0.05, 0.05);
      }

      surface.flashIntensity = Math.max(0, surface.flashIntensity - deltaTime * 1.5);
      surface.wireframeMaterial.opacity = THREE.MathUtils.clamp(targetOpacity, 0.04, 0.95);
      surface.fillMaterial.opacity = THREE.MathUtils.clamp(targetOpacity * 0.12, 0.01, 0.15);

      // Animate hit ripple ring if active
      if (surface.rippleMesh && surface.rippleMesh.visible) {
        const rippleScale = surface.rippleMesh.scale.x + deltaTime * 2.2;
        surface.rippleMesh.scale.set(rippleScale, rippleScale, 1);
        const rippleMat = surface.rippleMesh.material as THREE.MeshBasicMaterial;
        rippleMat.opacity = Math.max(0, rippleMat.opacity - deltaTime * 1.8);
        if (rippleMat.opacity <= 0.01) {
          surface.rippleMesh.visible = false;
        }
      }
    }

    // 3. Animate Room Scan Radar Wave
    if (this.isScanningActive && this.scanGridMesh && this.scanGridMaterial) {
      this.scanWaveTimer += deltaTime;
      const progress = this.scanWaveTimer / 1.5;
      const scale = 1.0 + progress * 5.5;
      this.scanGridMesh.scale.set(scale, scale, 1);
      this.scanGridMaterial.uniforms.uTime.value = this.scanWaveTimer;

      if (progress >= 1.0) {
        this.isScanningActive = false;
        this.scanGridMesh.visible = false;
      }
    }
  }

  /**
   * Ingests native WebXR XRPlane detected planes from Meta Quest AR Passthrough
   */
  private updateWebXRPlanes(frame: XRFrame): void {
    const planes = (frame as any).detectedPlanes as Set<any>;
    if (!planes || planes.size === 0) return;

    const refSpace = this.sceneManager.renderer.xr.getReferenceSpace();
    if (!refSpace) return;

    for (const plane of planes) {
      const pose = frame.getPose(plane.planeSpace, refSpace);
      if (!pose) continue;

      const planeId = `xr_plane_${plane.lastChangedTime || Math.round(pose.transform.position.x * 100)}`;
      let surface = this.surfaces.get(planeId);

      const pos = new THREE.Vector3(
        pose.transform.position.x,
        pose.transform.position.y,
        pose.transform.position.z
      );
      const rot = new THREE.Euler().setFromRotationMatrix(
        new THREE.Matrix4().fromArray(pose.transform.matrix)
      );

      // Determine plane orientation & label
      const orientation = plane.orientation || 'horizontal';
      let label: 'desk' | 'table' | 'wall' | 'floor' = 'wall';
      if (orientation === 'horizontal') {
        if (pos.y < 0.3) label = 'floor';
        else if (pos.y <= 1.05) label = 'table';
        else label = 'desk';
      }

      if (!surface) {
        // Compute bounding size from polygon if available
        let width = 1.2;
        let height = 0.8;
        if (plane.polygon && plane.polygon.length >= 3) {
          let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
          for (const pt of plane.polygon) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minZ = Math.min(minZ, pt.z);
            maxZ = Math.max(maxZ, pt.z);
          }
          width = Math.max(0.3, maxX - minX);
          height = Math.max(0.3, maxZ - minZ);
        }

        const normal = orientation === 'horizontal' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
        normal.applyEuler(rot);

        surface = this.registerSurface({
          id: planeId,
          orientation,
          semanticLabel: label,
          center: pos,
          normal,
          width,
          height,
          rotation: rot,
          isSimulated: false
        });
      } else {
        // Update existing surface pose
        surface.center.copy(pos);
        surface.rotation.copy(rot);
        surface.meshGroup.position.copy(pos);
        surface.meshGroup.rotation.copy(rot);
      }
    }
  }

  /**
   * Physical Surface Anchoring:
   * Checks if a Harmonic Node position is within 0.06m of a detected desk/table plane.
   * If matched, returns the surface and the magnetic snapped Y height for the base-pedestal.
   */
  public checkSurfaceAnchor(
    nodePosition: THREE.Vector3,
    threshold = 0.06
  ): { surface: MRSurface; anchorY: number } | null {
    if (!this.isRoomScanEnabled) return null;

    for (const surface of this.surfaces.values()) {
      // Only anchor to horizontal surfaces (tables, desks)
      if (surface.orientation !== 'horizontal') continue;

      const surfaceY = surface.center.y;
      const distY = Math.abs(nodePosition.y - surfaceY);

      if (distY <= threshold) {
        // Check horizontal bounds with 0.15m margin
        const halfW = surface.width / 2 + 0.15;
        const halfH = surface.height / 2 + 0.15;

        const dx = Math.abs(nodePosition.x - surface.center.x);
        const dz = Math.abs(nodePosition.z - surface.center.z);

        if (dx <= halfW && dz <= halfH) {
          // Snap height just above the table surface
          return {
            surface,
            anchorY: surfaceY + 0.045
          };
        }
      }
    }

    return null;
  }

  /**
   * Wall-Bounce Ray / Plane Intersection:
   * Tests if a moving Photon Dart intersects any physical surface during deltaTime.
   */
  public checkPhotonBounce(
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    deltaTime: number
  ): { hit: boolean; hitPoint: THREE.Vector3; normal: THREE.Vector3; surface: MRSurface } | null {
    const stepDist = velocity.length() * deltaTime;
    if (stepDist <= 0.0001) return null;

    const rayDir = this._v1.copy(velocity).normalize();
    const nextPos = this._v2.copy(origin).addScaledVector(velocity, deltaTime);

    for (const surface of this.surfaces.values()) {
      this._planeNormal.copy(surface.normal);
      this._planePoint.copy(surface.center);

      // Check if ray is moving toward the plane
      const denom = this._planeNormal.dot(rayDir);
      if (Math.abs(denom) < 0.001) continue; // Parallel

      const toCenter = this._v3.subVectors(this._planePoint, origin);
      const t = toCenter.dot(this._planeNormal) / denom;

      // Check if intersection occurs within this step frame (with small tolerance)
      if (t >= -0.01 && t <= stepDist + 0.03) {
        const hitPoint = origin.clone().addScaledVector(rayDir, t);

        // Check if hit point lies within the planar bounds of this surface
        const localHit = hitPoint.clone().sub(surface.center);
        // Inverse transform to surface local space
        const invRot = new THREE.Euler(-surface.rotation.x, -surface.rotation.y, -surface.rotation.z);
        localHit.applyEuler(invRot);

        const halfW = surface.width / 2 + 0.20;
        const halfH = surface.height / 2 + 0.20;

        if (Math.abs(localHit.x) <= halfW && Math.abs(localHit.y) <= halfH) {
          // Adjust normal if hitting from behind
          const hitNormal = denom < 0 ? surface.normal.clone() : surface.normal.clone().negate();
          return {
            hit: true,
            hitPoint,
            normal: hitNormal,
            surface
          };
        }
      }
    }

    return null;
  }

  /**
   * Flashes a surface and spawns an acoustic impact ripple when struck by a pulse or dart
   */
  public flashSurface(surface: MRSurface, hitPoint: THREE.Vector3): void {
    surface.lastHitTime = performance.now() / 1000;
    surface.flashIntensity = 1.0;

    if (surface.rippleMesh) {
      // Localize ripple to hit point on plane
      const localPos = surface.meshGroup.worldToLocal(hitPoint.clone());
      surface.rippleMesh.position.set(localPos.x, localPos.y, 0.005);
      surface.rippleMesh.scale.set(1, 1, 1);
      (surface.rippleMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
      surface.rippleMesh.visible = true;
    }
  }

  /**
   * Toggles the MR Room Scan ON/OFF
   */
  public toggleRoomScan(): boolean {
    this.isRoomScanEnabled = !this.isRoomScanEnabled;
    this.surfacesGroup.visible = this.isRoomScanEnabled;

    if (this.isRoomScanEnabled) {
      // Trigger scan wave animation
      this.isScanningActive = true;
      this.scanWaveTimer = 0;
      if (this.scanGridMesh) {
        this.scanGridMesh.visible = true;
        this.scanGridMesh.scale.set(1, 1, 1);
      }

      // Flash all surfaces
      const now = performance.now() / 1000;
      for (const surface of this.surfaces.values()) {
        surface.lastHitTime = now;
        surface.flashIntensity = 1.0;
      }
      console.log('[MRSurfaceManager] MR Room Scan: ACTIVE. Detected surfaces highlighted.');
    } else {
      console.log('[MRSurfaceManager] MR Room Scan: OFF. Real-world surfaces hidden.');
    }

    return this.isRoomScanEnabled;
  }

  /**
   * Status telemetry summary for HUD and demo recording
   */
  public getStatusSummary(): {
    isEnabled: boolean;
    surfaceCount: number;
    hasTable: boolean;
    activeMode: string;
  } {
    let hasTable = false;
    for (const surface of this.surfaces.values()) {
      if (surface.semanticLabel === 'table' || surface.semanticLabel === 'desk') {
        hasTable = true;
        break;
      }
    }

    return {
      isEnabled: this.isRoomScanEnabled,
      surfaceCount: this.surfaces.size,
      hasTable,
      activeMode: this.isRoomScanEnabled
        ? (this.sceneManager.isPassthroughActive ? 'QUEST 3 MR PLANES' : 'SIMULATED DESK/WALLS')
        : 'DISABLED'
    };
  }
}
