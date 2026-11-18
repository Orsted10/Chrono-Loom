import * as THREE from 'three';

export interface RibbonSegmentData {
  pA: THREE.Vector3;
  pB: THREE.Vector3;
  color: THREE.Color;
  initialWidth: number;
  age: number;
  maxLife: number; // 0.45 seconds
  active: boolean;
}

/**
 * Phase 14: InstancedMesh GPU Ribbon Trail Pool
 * Renders bioluminescent ribbons trailing behind moving fingertips and flying Chrono-Pulses
 * in exactly 1 draw call (max 256 instances), smoothly tapering opacity and width over 0.45s.
 * 100% compatible with Meta Quest 3 Adreno GPUs via explicit GLSL precision guards.
 */
export class RibbonTrailPool {
  public static readonly MAX_INSTANCES = 256;
  public static readonly DEFAULT_LIFETIME = 0.45; // 0.45 seconds

  public instancedMesh: THREE.InstancedMesh;
  private segments: RibbonSegmentData[];
  private nextFreeIndex = 0;

  // Instanced Attributes
  private trailLifeArray: Float32Array;
  private trailColorArray: Float32Array;
  private aTrailLife: THREE.InstancedBufferAttribute;
  private aTrailColor: THREE.InstancedBufferAttribute;

  // Scratch objects for zero-allocation per frame
  private _matrix = new THREE.Matrix4();
  private _vDir = new THREE.Vector3();
  private _vMid = new THREE.Vector3();
  private _vCam = new THREE.Vector3();
  private _vSide = new THREE.Vector3();
  private _vNorm = new THREE.Vector3();

  constructor() {
    // Unit plane geometry: width 1.0 (X: -0.5 to 0.5), height 1.0 (Y: -0.5 to 0.5)
    const geo = new THREE.PlaneGeometry(1.0, 1.0, 1, 1);

    this.trailLifeArray = new Float32Array(RibbonTrailPool.MAX_INSTANCES);
    this.trailColorArray = new Float32Array(RibbonTrailPool.MAX_INSTANCES * 3);

    this.aTrailLife = new THREE.InstancedBufferAttribute(this.trailLifeArray, 1);
    this.aTrailColor = new THREE.InstancedBufferAttribute(this.trailColorArray, 3);

    geo.setAttribute('aTrailLife', this.aTrailLife);
    geo.setAttribute('aTrailColor', this.aTrailColor);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0.0 }
      },
      vertexShader: `
        precision highp float;
        attribute float aTrailLife;
        attribute vec3 aTrailColor;

        varying vec2 vUv;
        varying float vTrailLife;
        varying vec3 vTrailColor;

        void main() {
          vUv = uv;
          vTrailLife = aTrailLife;
          vTrailColor = aTrailColor;

          vec4 worldPos = instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif

        varying vec2 vUv;
        varying float vTrailLife;
        varying vec3 vTrailColor;

        void main() {
          // Lateral distance from ribbon spine: vUv.x is [0.0, 1.0], 0.5 is center
          float lateral = abs(vUv.x - 0.5) * 2.0; // 0.0 at center, 1.0 at edge
          
          // Smooth edge falloff
          float edgeAlpha = smoothstep(1.0, 0.0, lateral);
          
          // Core intense bright beam
          float coreBeam = smoothstep(0.45, 0.0, lateral) * 0.9;

          // Smoothly taper opacity over 0.45s (quadratic life fade)
          float lifeFade = vTrailLife * vTrailLife;

          // Longitudinal taper along segment length (vUv.y)
          float longFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
          longFade = mix(1.0, longFade, 0.35);

          float alpha = clamp((edgeAlpha * 0.72 + coreBeam) * lifeFade * longFade, 0.0, 1.0);
          vec3 finalColor = vTrailColor + vec3(0.2, 0.35, 0.5) * coreBeam;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `
    });

    this.instancedMesh = new THREE.InstancedMesh(
      geo,
      mat,
      RibbonTrailPool.MAX_INSTANCES
    );
    this.instancedMesh.name = 'QuantumRibbonTrailPool';
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false; // Keep persistent in viewer field of view

    this.segments = [];
    for (let i = 0; i < RibbonTrailPool.MAX_INSTANCES; i++) {
      this.segments.push({
        pA: new THREE.Vector3(),
        pB: new THREE.Vector3(),
        color: new THREE.Color(1, 1, 1),
        initialWidth: 0.014,
        age: 0,
        maxLife: RibbonTrailPool.DEFAULT_LIFETIME,
        active: false
      });
    }
  }

  /**
   * Adds a new trail segment connecting pA to pB
   */
  public addSegment(
    pA: THREE.Vector3,
    pB: THREE.Vector3,
    color: THREE.Color,
    initialWidth: number = 0.014
  ): void {
    if (pA.distanceTo(pB) < 0.002) return; // Discard micro-jitters

    const seg = this.segments[this.nextFreeIndex];
    seg.pA.copy(pA);
    seg.pB.copy(pB);
    seg.color.copy(color);
    seg.initialWidth = initialWidth;
    seg.age = 0.0;
    seg.maxLife = RibbonTrailPool.DEFAULT_LIFETIME;
    seg.active = true;

    this.nextFreeIndex =
      (this.nextFreeIndex + 1) % RibbonTrailPool.MAX_INSTANCES;
  }

  /**
   * Updates all active ribbon segments:
   * Advances age, tapers width and opacity over 0.45s, and builds camera-facing billboard matrices.
   */
  public update(deltaTime: number, cameraPosition: THREE.Vector3): void {
    let activeCount = 0;

    for (let i = 0; i < RibbonTrailPool.MAX_INSTANCES; i++) {
      const seg = this.segments[i];
      if (!seg.active) continue;

      seg.age += deltaTime;
      if (seg.age >= seg.maxLife) {
        seg.active = false;
        continue;
      }

      // Life linearly decreases from 1.0 down to 0.0 over 0.45s
      const life = Math.max(0.0, 1.0 - seg.age / seg.maxLife);

      // Smoothly taper width over 0.45s
      const currentWidth = seg.initialWidth * life;

      // Segment vector and length
      const dir = this._vDir.subVectors(seg.pB, seg.pA);
      const len = dir.length();
      if (len < 0.001) {
        seg.active = false;
        continue;
      }
      dir.normalize();

      // Midpoint
      const mid = this._vMid.addVectors(seg.pA, seg.pB).multiplyScalar(0.5);

      // Vector from midpoint to camera
      const toCam = this._vCam.subVectors(cameraPosition, mid).normalize();

      // Transverse ribbon vector (perpendicular to both motion and camera view)
      let side = this._vSide.crossVectors(dir, toCam);
      if (side.lengthSq() < 0.0001) {
        side.set(0, 1, 0).cross(dir);
      }
      side.normalize();

      // Normal to ribbon plane
      const norm = this._vNorm.crossVectors(side, dir).normalize();

      // Build 4x4 instance transform matrix:
      // X basis = side * currentWidth (tapering width!)
      // Y basis = dir * len (segment length)
      // Z basis = norm
      // Translation = mid
      this._matrix.makeBasis(
        side.multiplyScalar(currentWidth),
        dir.multiplyScalar(len),
        norm
      );
      this._matrix.setPosition(mid);

      this.instancedMesh.setMatrixAt(activeCount, this._matrix);
      this.trailLifeArray[activeCount] = life;
      this.trailColorArray[activeCount * 3 + 0] = seg.color.r;
      this.trailColorArray[activeCount * 3 + 1] = seg.color.g;
      this.trailColorArray[activeCount * 3 + 2] = seg.color.b;

      activeCount++;
    }

    this.instancedMesh.count = activeCount;
    if (activeCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.aTrailLife.needsUpdate = true;
      this.aTrailColor.needsUpdate = true;
    }
  }

  /**
   * Resets all active trail segments
   */
  public clear(): void {
    for (const seg of this.segments) {
      seg.active = false;
    }
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
