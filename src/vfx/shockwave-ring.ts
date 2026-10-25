/**
 * Isometric Grid Shockwave & Rim-Danger Pulse (`src/vfx/shockwave-ring.ts`)
 *
 * Tracks up to 4 expanding SDF surface shockwave rings triggered on:
 *   - `'hard_landing'` (high-speed vertical landing on course tiles)
 *   - `'bumper_hit'` (arcade bumper or piston hammer impact)
 *   - `'portal_exit'` (high-momentum non-Euclidean SDF portal emergence)
 *   - `'crater_blast'` (realtime CSG Singularity / Crater Cannon detonation)
 *
 * Each shockwave expands across the 3D SDF surface and illuminates the anti-aliased
 * `fwidth` isometric contour gridlines with a neon cyan (`#1ff5ff`) and neon magenta (`#ff2ad4`)
 * wavefront, accompanied by a continuous cliff-edge Rim-Danger Pulse probe (`evaluateRimDanger`).
 */

import type { CpuWorldEvaluator, MarbleState, Vec3 } from '../contracts';
import { vec3Add, vec3Length, vec3Lerp, vec3Normalize, vec3Scale, vec3Sub } from '../sdf/eval-cpu';

export const MAX_SHOCKWAVE_RINGS = 4;

export const NEON_CYAN_RGB: Vec3 = [0.12, 0.96, 1.0];
export const NEON_MAGENTA_RGB: Vec3 = [1.0, 0.16, 0.83];

export type ShockwaveTriggerKind =
  | 'hard_landing'
  | 'bumper_hit'
  | 'portal_exit'
  | 'crater_blast';

export interface ShockwavePreset {
  readonly kind: ShockwaveTriggerKind;
  readonly kindId: number;
  readonly maxRadius: number;
  readonly durationSec: number;
  readonly ringWidth: number;
  readonly peakIntensity: number;
  /** 0 = pure neon cyan, 1 = pure neon magenta, 0.5 = dual cyan/magenta harmonic */
  readonly magentaMix: number;
}

export const SHOCKWAVE_PRESETS: Record<ShockwaveTriggerKind, ShockwavePreset> = {
  hard_landing: {
    kind: 'hard_landing',
    kindId: 1,
    maxRadius: 6.5,
    durationSec: 0.95,
    ringWidth: 0.55,
    peakIntensity: 1.0,
    magentaMix: 0.25,
  },
  bumper_hit: {
    kind: 'bumper_hit',
    kindId: 2,
    maxRadius: 7.5,
    durationSec: 0.85,
    ringWidth: 0.62,
    peakIntensity: 1.2,
    magentaMix: 0.82,
  },
  portal_exit: {
    kind: 'portal_exit',
    kindId: 3,
    maxRadius: 8.5,
    durationSec: 1.05,
    ringWidth: 0.68,
    peakIntensity: 1.25,
    magentaMix: 0.5,
  },
  crater_blast: {
    kind: 'crater_blast',
    kindId: 4,
    maxRadius: 10.5,
    durationSec: 1.2,
    ringWidth: 0.85,
    peakIntensity: 1.45,
    magentaMix: 0.72,
  },
};

export interface ShockwaveRing {
  readonly id: number;
  readonly slotIndex: number;
  readonly kind: ShockwaveTriggerKind;
  readonly center: Vec3;
  readonly spawnTime: number;
  readonly ageSec: number;
  readonly durationSec: number;
  readonly currentRadius: number;
  readonly maxRadius: number;
  readonly ringWidth: number;
  readonly initialIntensity: number;
  readonly intensity: number;
  readonly magentaMix: number;
  readonly primaryColor: Vec3;
  readonly secondaryColor: Vec3;
  readonly active: boolean;
}

export interface ShockwaveTriggerOptions {
  readonly kind: ShockwaveTriggerKind;
  readonly center: Vec3;
  readonly intensity?: number;
  readonly maxRadius?: number;
  readonly durationSec?: number;
  readonly ringWidth?: number;
  readonly magentaMix?: number;
  readonly spawnTime?: number;
}

export interface ShockwavePointSample {
  /** Combined shockwave intensity at world point `p` (`>= 0`) */
  readonly totalIntensity: number;
  /** Multiplier for the isometric contour gridline brightness at `p` */
  readonly gridLineBoost: number;
  /** Blended neon cyan/magenta RGB wave color at `p` */
  readonly waveColor: Vec3;
  /** Number of active rings contributing at `p` */
  readonly contributingRings: number;
}

export interface RimDangerState {
  /** Normalized `[0..1]` proximity to an unrailed cliff drop-off */
  readonly rimProximity: number;
  /** Time-modulated warning pulse `[0..1]` for HUD & shader rim glow */
  readonly pulseIntensity: number;
  /** Unit world direction pointing toward the steepest nearby drop-off */
  readonly cliffDirection: Vec3;
  /** True when `rimProximity >= 0.35` (active rim-save torque window) */
  readonly inDangerZone: boolean;
}

export interface ShockwaveShaderSnippet {
  readonly maxRings: typeof MAX_SHOCKWAVE_RINGS;
  readonly glsl: string;
  readonly wgsl: string;
}

export interface ShockwaveRingManager {
  getRings(): readonly ShockwaveRing[];
  getActiveRings(): readonly ShockwaveRing[];
  getRimDanger(): RimDangerState;
  trigger(options: ShockwaveTriggerOptions): ShockwaveRing;
  step(dt: number, simTime?: number): readonly ShockwaveRing[];
  evaluateAtPoint(p: Vec3): ShockwavePointSample;
  updateRimDanger(
    marble: Pick<MarbleState, 'position' | 'velocity' | 'radius' | 'contact'>,
    evaluator: CpuWorldEvaluator,
    simTime: number,
  ): RimDangerState;
  detectMarbleEvents(
    prevMarble: MarbleState | null,
    currMarble: MarbleState,
    simTime: number,
  ): readonly ShockwaveRing[];
  packUniforms(): {
    /** `vec4[4]`: `[centerX, centerY, centerZ, currentRadius]` */
    uShockwaveRings: Float32Array;
    /** `vec4[4]`: `[intensity, ringWidth, magentaMix, kindId]` */
    uShockwaveParams: Float32Array;
    /** `vec4`: `[rimProximity, pulseIntensity, cliffDirX, cliffDirZ]` */
    uRimDanger: Float32Array;
  };
  clear(): void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function createEmptyRing(slotIndex: number): ShockwaveRing {
  return {
    id: 0,
    slotIndex,
    kind: 'hard_landing',
    center: [0, 0, 0],
    spawnTime: 0,
    ageSec: 0,
    durationSec: 1.0,
    currentRadius: 0,
    maxRadius: 6.5,
    ringWidth: 0.55,
    initialIntensity: 0,
    intensity: 0,
    magentaMix: 0.25,
    primaryColor: NEON_CYAN_RGB,
    secondaryColor: NEON_MAGENTA_RGB,
    active: false,
  };
}

/**
 * Evaluate continuous SDF cliff-edge drop proximity (`rimProximity`) around the marble.
 * Probes 8 compass directions around the marble at downward offset `-1.25 * R`.
 */
export function evaluateRimDanger(
  marble: Pick<MarbleState, 'position' | 'velocity' | 'radius' | 'contact'>,
  evaluator: CpuWorldEvaluator,
  simTime: number,
): RimDangerState {
  if (!marble.contact.grounded) {
    return {
      rimProximity: 0,
      pulseIntensity: 0,
      cliffDirection: [0, 0, 0],
      inDangerZone: false,
    };
  }

  const r = marble.radius;
  const probeHorizDist = r * 1.45;
  const probeDropY = -r * 1.25;
  const numProbes = 8;

  let maxDropScore = 0;
  let accumDirX = 0;
  let accumDirZ = 0;

  for (let i = 0; i < numProbes; i++) {
    const angle = (i * Math.PI * 2) / numProbes;
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    const probePoint: Vec3 = [
      marble.position[0] + dx * probeHorizDist,
      marble.position[1] + probeDropY,
      marble.position[2] + dz * probeHorizDist,
    ];

    const distToFloor = evaluator.distance(probePoint, simTime);
    // On a continuous flat or sloped floor, distToFloor at y - 1.25R is <= 0.35R.
    // Over an unrailed cliff edge, distToFloor jumps above 0.55R..1.4R.
    const dropExcess = distToFloor - r * 0.55;
    if (dropExcess > 0) {
      const score = clamp(dropExcess / (r * 0.95), 0, 1);
      if (score > maxDropScore) {
        maxDropScore = score;
      }
      accumDirX += dx * score;
      accumDirZ += dz * score;
    }
  }

  if (maxDropScore <= 0.01) {
    return {
      rimProximity: 0,
      pulseIntensity: 0,
      cliffDirection: [0, 0, 0],
      inDangerZone: false,
    };
  }

  const cliffDirection = vec3Normalize([accumDirX, 0, accumDirZ]);
  // Boost danger when rolling toward the cliff edge
  const towardCliffSpeed = Math.max(
    0,
    marble.velocity[0] * cliffDirection[0] + marble.velocity[2] * cliffDirection[2],
  );
  const speedFactor = 1.0 + clamp(towardCliffSpeed / 12.0, 0, 0.35);
  const rimProximity = clamp(maxDropScore * speedFactor, 0, 1);
  const pulseWave = 0.65 + 0.35 * Math.sin(simTime * 18.0);
  const pulseIntensity = clamp(rimProximity * pulseWave, 0, 1);

  return {
    rimProximity,
    pulseIntensity,
    cliffDirection,
    inDangerZone: rimProximity >= 0.35,
  };
}

/**
 * Create the 4-slot Isometric Grid Shockwave & Rim-Danger Pulse manager.
 */
export function createShockwaveManager(): ShockwaveRingManager {
  let nextRingId = 1;
  const rings: ShockwaveRing[] = [
    createEmptyRing(0),
    createEmptyRing(1),
    createEmptyRing(2),
    createEmptyRing(3),
  ];

  let rimDanger: RimDangerState = {
    rimProximity: 0,
    pulseIntensity: 0,
    cliffDirection: [0, 0, 0],
    inDangerZone: false,
  };

  const uShockwaveRings = new Float32Array(MAX_SHOCKWAVE_RINGS * 4);
  const uShockwaveParams = new Float32Array(MAX_SHOCKWAVE_RINGS * 4);
  const uRimDanger = new Float32Array(4);

  function selectSlotIndex(): number {
    // 1. Prefer an inactive slot
    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      if (!rings[i].active) return i;
    }
    // 2. Otherwise evict the ring with the lowest remaining intensity (or oldest age)
    let bestIdx = 0;
    let lowestIntensity = Infinity;
    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      if (rings[i].intensity < lowestIntensity) {
        lowestIntensity = rings[i].intensity;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function trigger(options: ShockwaveTriggerOptions): ShockwaveRing {
    const preset = SHOCKWAVE_PRESETS[options.kind];
    const slotIndex = selectSlotIndex();
    const initialIntensity = Math.max(0.05, options.intensity ?? preset.peakIntensity);
    const maxRadius = Math.max(0.5, options.maxRadius ?? preset.maxRadius);
    const durationSec = Math.max(0.1, options.durationSec ?? preset.durationSec);
    const ringWidth = Math.max(0.12, options.ringWidth ?? preset.ringWidth);
    const magentaMix = clamp(options.magentaMix ?? preset.magentaMix, 0, 1);

    const primaryColor = vec3Lerp(NEON_CYAN_RGB, NEON_MAGENTA_RGB, magentaMix);
    const secondaryColor = vec3Lerp(NEON_MAGENTA_RGB, NEON_CYAN_RGB, magentaMix);

    const ring: ShockwaveRing = {
      id: nextRingId++,
      slotIndex,
      kind: options.kind,
      center: [...options.center],
      spawnTime: options.spawnTime ?? 0,
      ageSec: 0,
      durationSec,
      currentRadius: 0.15,
      maxRadius,
      ringWidth,
      initialIntensity,
      intensity: initialIntensity,
      magentaMix,
      primaryColor,
      secondaryColor,
      active: true,
    };

    rings[slotIndex] = ring;
    return ring;
  }

  function step(dt: number): readonly ShockwaveRing[] {
    const clampedDt = Math.max(0, dt);
    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      const r = rings[i];
      if (!r.active) continue;

      const nextAge = r.ageSec + clampedDt;
      if (nextAge >= r.durationSec) {
        rings[i] = {
          ...r,
          ageSec: r.durationSec,
          currentRadius: r.maxRadius,
          intensity: 0,
          active: false,
        };
        continue;
      }

      const u = clamp(nextAge / r.durationSec, 0, 1);
      // Fast ease-out wavefront expansion + smooth power decay
      const expansionProgress = 1.0 - Math.pow(1.0 - u, 2.15);
      const currentRadius = 0.15 + (r.maxRadius - 0.15) * expansionProgress;
      const intensity = r.initialIntensity * Math.pow(1.0 - u, 1.65);

      rings[i] = {
        ...r,
        ageSec: nextAge,
        currentRadius,
        intensity,
      };
    }
    return rings;
  }

  function evaluateAtPoint(p: Vec3): ShockwavePointSample {
    let totalIntensity = 0;
    let colorAccum: Vec3 = [0, 0, 0];
    let contributingRings = 0;

    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      const r = rings[i];
      if (!r.active || r.intensity <= 1e-4) continue;

      const dist = vec3Length(vec3Sub(p, r.center));
      const radialDelta = (dist - r.currentRadius) / r.ringWidth;
      const primaryEnvelope = Math.exp(-radialDelta * radialDelta * 1.85);

      // Subtle inner harmonic echo ring trailing behind the main shockfront
      const echoDelta = (dist - r.currentRadius * 0.72) / (r.ringWidth * 0.75);
      const echoEnvelope = 0.35 * Math.exp(-echoDelta * echoDelta * 2.2);

      const wave = (primaryEnvelope + echoEnvelope) * r.intensity;
      if (wave > 1e-3) {
        contributingRings++;
        totalIntensity += wave;
        // Blend between neon cyan leading edge and neon magenta trailing wake
        const edgeMix = clamp(0.5 + 0.5 * Math.sin(radialDelta * 2.4 + r.magentaMix * Math.PI), 0, 1);
        const ringCol = vec3Lerp(NEON_CYAN_RGB, NEON_MAGENTA_RGB, clamp(0.5 * r.magentaMix + 0.5 * edgeMix, 0, 1));
        colorAccum = vec3Add(colorAccum, vec3Scale(ringCol, wave));
      }
    }

    const waveColor: Vec3 =
      totalIntensity > 1e-4
        ? vec3Scale(colorAccum, 1 / totalIntensity)
        : NEON_CYAN_RGB;

    return {
      totalIntensity,
      gridLineBoost: 1.0 + totalIntensity * 2.4,
      waveColor,
      contributingRings,
    };
  }

  function updateRimDanger(
    marble: Pick<MarbleState, 'position' | 'velocity' | 'radius' | 'contact'>,
    evaluator: CpuWorldEvaluator,
    simTime: number,
  ): RimDangerState {
    rimDanger = evaluateRimDanger(marble, evaluator, simTime);
    return rimDanger;
  }

  function detectMarbleEvents(
    prevMarble: MarbleState | null,
    currMarble: MarbleState,
    simTime: number,
  ): readonly ShockwaveRing[] {
    const spawned: ShockwaveRing[] = [];
    if (!prevMarble) return spawned;

    // 1. Hard landing or high-fall shatter impact
    const justLanded = !prevMarble.contact.grounded && currMarble.contact.grounded;
    const justShattered = prevMarble.status !== 'shattered' && currMarble.status === 'shattered';
    if (
      (justLanded && currMarble.contact.impactSpeed >= 6.5) ||
      justShattered
    ) {
      const impactScale = clamp(currMarble.contact.impactSpeed / 18.0, 0.65, 1.5);
      spawned.push(
        trigger({
          kind: 'hard_landing',
          center: currMarble.contact.contactPoint,
          intensity: impactScale,
          maxRadius: 5.5 + impactScale * 2.5,
          spawnTime: simTime,
        }),
      );
    }

    // 2. Bumper / Piston hit
    if (
      currMarble.surfaceMaterial === 'bumper' &&
      currMarble.contact.impactSpeed >= 3.0 &&
      prevMarble.surfaceMaterial !== 'bumper'
    ) {
      spawned.push(
        trigger({
          kind: 'bumper_hit',
          center: currMarble.contact.contactPoint,
          intensity: clamp(currMarble.contact.impactSpeed / 12.0, 0.85, 1.45),
          spawnTime: simTime,
        }),
      );
    }

    return spawned;
  }

  function packUniforms() {
    uShockwaveRings.fill(0);
    uShockwaveParams.fill(0);

    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      const r = rings[i];
      const base = i * 4;
      if (!r.active || r.intensity <= 1e-4) continue;
      uShockwaveRings[base + 0] = r.center[0];
      uShockwaveRings[base + 1] = r.center[1];
      uShockwaveRings[base + 2] = r.center[2];
      uShockwaveRings[base + 3] = r.currentRadius;

      uShockwaveParams[base + 0] = r.intensity;
      uShockwaveParams[base + 1] = r.ringWidth;
      uShockwaveParams[base + 2] = r.magentaMix;
      uShockwaveParams[base + 3] = SHOCKWAVE_PRESETS[r.kind].kindId;
    }

    uRimDanger[0] = rimDanger.rimProximity;
    uRimDanger[1] = rimDanger.pulseIntensity;
    uRimDanger[2] = rimDanger.cliffDirection[0];
    uRimDanger[3] = rimDanger.cliffDirection[2];

    return {
      uShockwaveRings,
      uShockwaveParams,
      uRimDanger,
    };
  }

  function clear() {
    for (let i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
      rings[i] = createEmptyRing(i);
    }
    rimDanger = {
      rimProximity: 0,
      pulseIntensity: 0,
      cliffDirection: [0, 0, 0],
      inDangerZone: false,
    };
  }

  return {
    getRings: () => rings,
    getActiveRings: () => rings.filter((r) => r.active),
    getRimDanger: () => rimDanger,
    trigger,
    step,
    evaluateAtPoint,
    updateRimDanger,
    detectMarbleEvents,
    packUniforms,
    clear,
  };
}

/**
 * Returns GLSL ES 3.00 and WGSL shader helpers for illuminating the `fwidth` isometric
 * contour gridlines with expanding neon cyan/magenta shockwave rings and cliff-edge rim danger.
 */
export function getShockwaveShaderSnippet(): ShockwaveShaderSnippet {
  const glsl = `// --- Isometric Grid Shockwave & Rim-Danger Pulse Snippet (GLSL ES 3.00) ---
#define MAX_SHOCKWAVE_RINGS ${MAX_SHOCKWAVE_RINGS}
uniform vec4 uShockwaveRings[MAX_SHOCKWAVE_RINGS];
uniform vec4 uShockwaveParams[MAX_SHOCKWAVE_RINGS];
uniform vec4 uRimDanger; // [rimProximity, pulseIntensity, cliffDirX, cliffDirZ]

vec3 applyShockwaveAndRimContours(vec3 p, float gridMask, vec3 surfaceCol, vec3 marblePos) {
  const vec3 neonCyan = vec3(0.12, 0.96, 1.00);
  const vec3 neonMagenta = vec3(1.00, 0.16, 0.83);
  vec3 waveGlow = vec3(0.0);

  for (int i = 0; i < MAX_SHOCKWAVE_RINGS; i++) {
    vec4 ring = uShockwaveRings[i];
    vec4 param = uShockwaveParams[i];
    float intensity = param.x;
    if (intensity <= 0.001) continue;

    float width = max(param.y, 0.12);
    float dist = length(p - ring.xyz);
    float dNorm = (dist - ring.w) / width;
    float front = exp(-dNorm * dNorm * 1.85);
    float echoD = (dist - ring.w * 0.72) / (width * 0.75);
    float echo = 0.35 * exp(-echoD * echoD * 2.2);

    float mixT = clamp(0.5 * param.z + 0.5 * (0.5 + 0.5 * sin(dNorm * 2.4)), 0.0, 1.0);
    vec3 ringCol = mix(neonCyan, neonMagenta, mixT);
    float contourWeight = mix(0.28, 1.35, gridMask);
    waveGlow += ringCol * (front + echo) * intensity * contourWeight;
  }

  // Rim-Danger Pulse near cliff drop-offs around the marble
  if (uRimDanger.y > 0.01) {
    float dMarble = length(p.xz - marblePos.xz);
    float localDanger = exp(-dMarble * dMarble * 0.45) * uRimDanger.y;
    vec3 dangerCol = mix(vec3(1.0, 0.55, 0.12), neonMagenta, 0.45);
    waveGlow += dangerCol * localDanger * mix(0.25, 1.25, gridMask);
  }

  return surfaceCol + waveGlow;
}
`;

  const wgsl = `// --- Isometric Grid Shockwave & Rim-Danger Pulse Snippet (WGSL) ---
const MAX_SHOCKWAVE_RINGS: u32 = ${MAX_SHOCKWAVE_RINGS}u;

fn applyShockwaveAndRimContours(
  p: vec3<f32>,
  gridMask: f32,
  surfaceCol: vec3<f32>,
  marblePos: vec3<f32>,
  rings: array<vec4<f32>, ${MAX_SHOCKWAVE_RINGS}>,
  params: array<vec4<f32>, ${MAX_SHOCKWAVE_RINGS}>,
  rimDanger: vec4<f32>,
) -> vec3<f32> {
  let neonCyan = vec3<f32>(0.12, 0.96, 1.00);
  let neonMagenta = vec3<f32>(1.00, 0.16, 0.83);
  var waveGlow = vec3<f32>(0.0);

  for (var i: u32 = 0u; i < MAX_SHOCKWAVE_RINGS; i = i + 1u) {
    let ring = rings[i];
    let param = params[i];
    let intensity = param.x;
    if (intensity <= 0.001) { continue; }

    let width = max(param.y, 0.12);
    let dist = length(p - ring.xyz);
    let dNorm = (dist - ring.w) / width;
    let front = exp(-dNorm * dNorm * 1.85);
    let echoD = (dist - ring.w * 0.72) / (width * 0.75);
    let echo = 0.35 * exp(-echoD * echoD * 2.2);

    let mixT = clamp(0.5 * param.z + 0.5 * (0.5 + 0.5 * sin(dNorm * 2.4)), 0.0, 1.0);
    let ringCol = mix(neonCyan, neonMagenta, mixT);
    let contourWeight = mix(0.28, 1.35, gridMask);
    waveGlow = waveGlow + ringCol * (front + echo) * intensity * contourWeight;
  }

  if (rimDanger.y > 0.01) {
    let dMarble = length(p.xz - marblePos.xz);
    let localDanger = exp(-dMarble * dMarble * 0.45) * rimDanger.y;
    let dangerCol = mix(vec3<f32>(1.0, 0.55, 0.12), neonMagenta, 0.45);
    waveGlow = waveGlow + dangerCol * localDanger * mix(0.25, 1.25, gridMask);
  }

  return surfaceCol + waveGlow;
}
`;

  return {
    maxRings: MAX_SHOCKWAVE_RINGS,
    glsl,
    wgsl,
  };
}
