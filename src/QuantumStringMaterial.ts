import * as THREE from 'three';

export const QUANTUM_STRING_RADIUS = 0.0032;
export const QUANTUM_STRING_SEGMENTS_LENGTH = 36;
export const QUANTUM_STRING_SEGMENTS_RADIAL = 8;

/**
 * Creates the standardized reference cylinder geometry for Quantum Strings.
 * Normalized along the Y-axis so Y = 0.0 is nodeA and Y = 1.0 is nodeB.
 */
export function createQuantumStringGeometry(): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(
    QUANTUM_STRING_RADIUS,
    QUANTUM_STRING_RADIUS,
    1.0,
    QUANTUM_STRING_SEGMENTS_RADIAL,
    QUANTUM_STRING_SEGMENTS_LENGTH,
    false
  );
  // Shift pivot so Y extends from 0.0 (nodeA) to 1.0 (nodeB)
  geo.translate(0, 0.5, 0);
  return geo;
}

/**
 * Creates the custom THREE.ShaderMaterial for Quantum Strings:
 * - Computes standing-wave transverse harmonics directly in vertex shader
 * - Renders traveling energy solitons
 * - Produces chromatic aberration fringes along peak vibrational amplitude
 * - Adreno GPU mediump/highp precision guards for 100% Quest 3 WebXR compatibility
 */
export function createQuantumStringMaterial(
  color: THREE.Color,
  length: number = 0.3
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: color.clone() },
      uAmplitude: { value: 0.0 },
      uMaxAmplitude: { value: 0.024 },
      uVibrationPhase: { value: 0.0 },
      uSolitonProgress: { value: 0.0 },
      uSolitonAmp: { value: 0.25 },
      uTime: { value: 0.0 },
      uTransverseDir: { value: new THREE.Vector3(1, 0, 0) },
      uLength: { value: length }
    },
    vertexShader: `
      precision highp float;

      uniform float uAmplitude;
      uniform float uMaxAmplitude;
      uniform float uVibrationPhase;
      uniform float uSolitonProgress;
      uniform float uSolitonAmp;
      uniform float uTime;
      uniform vec3 uTransverseDir;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying float vU;
      varying float vDisplacement;
      varying float vSoliton;
      varying vec3 vWorldPos;

      const float PI = 3.14159265358979323846;

      void main() {
        vUv = uv;
        // u is normalized parameter [0.0, 1.0] along string length
        float u = clamp(position.y, 0.0, 1.0);
        vU = u;

        // 1. Standing-wave transverse harmonics: sin(n * PI * u) * cos(omega * t)
        // Fundamental mode (n = 1)
        float h1 = sin(PI * u) * cos(uVibrationPhase);
        
        // 2nd harmonic (n = 2, octave overtone)
        float h2 = sin(2.0 * PI * u) * cos(2.0 * uVibrationPhase + 0.42) * 0.38;
        
        // 3rd harmonic (n = 3, fifth overtone)
        float h3 = sin(3.0 * PI * u) * cos(3.0 * uVibrationPhase + 1.15) * 0.18;
        
        // 4th harmonic (n = 4, crystal shimmer)
        float h4 = sin(4.0 * PI * u) * cos(4.0 * uVibrationPhase + 2.05) * 0.08;

        float standingWave = (h1 + h2 + h3 + h4) * uAmplitude;

        // 2. Traveling energy solitons: solitary localized wave packets propagating along the string
        // Forward soliton propagating at speed c
        float sDist1 = abs(u - fract(uSolitonProgress));
        float soliton1 = exp(-sDist1 * sDist1 * 160.0) * uSolitonAmp;

        // Reverse reflecting soliton with subtle phase delay
        float sDist2 = abs(u - (1.0 - fract(uSolitonProgress * 0.88 + 0.3)));
        float soliton2 = exp(-sDist2 * sDist2 * 220.0) * (uSolitonAmp * 0.65);

        float totalSoliton = soliton1 + soliton2;
        vSoliton = totalSoliton;

        // Soliton produces local transverse pulse perturbation
        float solitonDisp = (soliton1 - soliton2) * 0.012;

        // Total transverse physical displacement
        float totalDisp = standingWave + solitonDisp;
        vDisplacement = totalDisp;

        // Displace vertex along transverse normal
        vec3 displacedPos = position;
        displacedPos += uTransverseDir * totalDisp;

        // Transform to view and clip space
        vec4 mvPos = modelViewMatrix * vec4(displacedPos, 1.0);
        gl_Position = projectionMatrix * mvPos;

        // Pass normal and view direction for fresnel and core laser filament
        vNormal = normalize(normalMatrix * normal);
        vViewDir = -normalize(mvPos.xyz);
        vWorldPos = (modelMatrix * vec4(displacedPos, 1.0)).xyz;
      }
    `,
    fragmentShader: `
      #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
      #else
      precision mediump float;
      #endif

      uniform vec3 uColor;
      uniform float uAmplitude;
      uniform float uMaxAmplitude;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying float vU;
      varying float vDisplacement;
      varying float vSoliton;
      varying vec3 vWorldPos;

      const float PI = 3.14159265358979323846;

      void main() {
        // 1. Surface incidence angle
        float ndotv = abs(dot(vNormal, vViewDir));
        
        // 2. Inner ultra-bright quantum core laser filament
        // Maximum intensity directly in the center spine of the cylinder
        float coreIntensity = pow(ndotv, 4.5);
        vec3 coreFilament = vec3(1.0, 1.0, 1.0) * coreIntensity * 0.92;

        // 3. Fresnel quantum edge aura
        float fresnel = pow(1.0 - ndotv, 2.8);
        vec3 edgeAura = uColor * fresnel * 0.85;

        // 4. Chromatic Aberration Fringe along peak amplitude
        // Antinodes experience maximal strain/curvature
        float strain = clamp(abs(vDisplacement) / max(uMaxAmplitude, 0.001), 0.0, 1.0);
        
        // Chromatic dispersion offsets: red and blue separate with quantum phase shifts
        float fringeWave = sin(vU * 16.0 * PI - uTime * 6.0);
        float fringeR = strain * (0.6 + 0.4 * sin(vU * 8.0 + uTime * 4.0));
        float fringeB = strain * (0.8 + 0.3 * cos(vU * 8.0 - uTime * 5.0));
        float fringeG = strain * 0.15 * fringeWave;

        vec3 spectralColor;
        spectralColor.r = uColor.r * (1.0 + fringeR) + fringeR * 0.35;
        spectralColor.g = uColor.g * (1.0 - strain * 0.2 + fringeG);
        spectralColor.b = uColor.b * (1.0 + fringeB) + fringeB * 0.45;

        // 5. Energy Soliton traveling quantum packet glow
        // Solitons light up the string with luminous turquoise / cyan high-energy photon bursts
        vec3 solitonGlow = vec3(0.2, 0.95, 1.0) * (vSoliton * 2.8);

        // 6. Quantum Standing-Wave Antinode Shimmer
        float antinodeShimmer = strain * 0.25 * (0.5 + 0.5 * sin(uTime * 18.0 + vU * 10.0));

        // Compose final color
        vec3 finalColor = spectralColor + coreFilament + edgeAura + solitonGlow + vec3(antinodeShimmer);

        // Smooth edge falloff and quantum transparency
        // Pinned nodes (u = 0, u = 1) blend seamlessly into the node crystals
        float nodeAnchorFade = smoothstep(0.0, 0.03, vU) * smoothstep(1.0, 0.97, vU);
        float alpha = clamp((0.55 + coreIntensity * 0.35 + fresnel * 0.45 + strain * 0.3 + vSoliton) * nodeAnchorFade, 0.0, 1.0);

        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
}
