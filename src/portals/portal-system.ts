/**
 * Non-Euclidean Raymarched SDF Portals & 120 Hz Momentum-Preserving Physics (`src/portals/portal-system.ts`)
 *
 * Implements:
 * 1. Pre-Placed, Always-On Landmark Portals on Every Course (`getDefaultCoursePortals(course)`)
 * 2. 1-Key "Smart Portal Bridge" (`placeSmartPortalBridge`) + Targeted Cursor Raycast Aim (`raycastPortalAimPreview`, `raycastAndPlacePortal`)
 * 3. Orthonormal Portal Coordinate Frames (`right`, `up`, `normal`)
 * 4. Exact Non-Euclidean Point, Velocity, Spin & Quaternion Transforms:
 *      p' = T_B * R_pi * T_A^-1 * p
 *      v' = (R_B * R_pi * R_A^-1) * v
 *      w' = (R_B * R_pi * R_A^-1) * w
 * 5. Generous Magnetic Capture Funnel (within 2.5 * R) & Guaranteed Minimum Fling Speed (`minExitSpeed = 14.5 u/s` + `1.25x` momentum boost)
 * 6. Lockstep CSG Throat Cylinder Subtraction behind active portals so the marble
 *    rolls/falls smoothly into the aperture plane without bouncing off the host wall/floor
 */

import type {
  CourseSpec,
  CpuWorldEvaluator,
  MarbleState,
  PortalPair,
  Quat,
  Vec3,
} from '../contracts';

export type PortalEnd = 'blue' | 'orange';

export const DEFAULT_PORTAL_RADIUS = 1.55;
export const DEFAULT_PORTAL_FLING_BOOST = 1.25;
export const DEFAULT_PORTAL_MIN_EXIT_SPEED = 14.5;
export const DEFAULT_PORTAL_COOLDOWN_SEC = 0.35;
export const PORTAL_MAGNETIC_FUNNEL_RADIUS_MULT = 2.5;

export interface PortalBasis {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly normal: Vec3;
}

export interface PortalAimPreview {
  readonly active: boolean;
  readonly end: PortalEnd;
  readonly position: Vec3;
  readonly normal: Vec3;
  readonly up: Vec3;
  readonly radius: number;
}

export interface PortalCrossingEvent {
  readonly pairId: string;
  readonly fromEnd: PortalEnd;
  readonly toEnd: PortalEnd;
  readonly entryPosition: Vec3;
  readonly exitPosition: Vec3;
  readonly entryVelocity: Vec3;
  readonly exitVelocity: Vec3;
  readonly entrySpeed: number;
  readonly exitSpeed: number;
}

function vAdd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vScale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function vDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vLen(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

function vNorm(a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len < 1e-7) return fallback;
  return [a[0] / len, a[1] / len, a[2] / len];
}

/**
 * Construct a right-handed orthonormal basis `(right, up, normal)` for a portal face.
 * Matches the GPU shader basis construction `right = normalize(cross(up, normal))`.
 */
export function computePortalBasis(normalInput: Vec3, upHint: Vec3 = [0, 1, 0]): PortalBasis {
  const normal = vNorm(normalInput, [0, 1, 0]);
  let upProj = vSub(upHint, vScale(normal, vDot(upHint, normal)));
  if (vLen(upProj) < 1e-4) {
    const fallbackUp: Vec3 = Math.abs(normal[1]) < 0.85 ? [0, 1, 0] : [0, 0, -1];
    upProj = vSub(fallbackUp, vScale(normal, vDot(fallbackUp, normal)));
  }
  const up = vNorm(upProj, [0, 1, 0]);
  const right = vNorm(vCross(up, normal), [1, 0, 0]);
  return { right, up, normal };
}

/**
 * Pre-placed, always-on landmark portal pairs for every course (`getDefaultCoursePortals(course)`).
 *
 * Ensures every course (Course 1–6 plus custom/architect courses) spawns with a high-visibility
 * Linked Blue + Orange Portal Pair right on the track with generous `radius = 1.55` and
 * `flingBoost = 1.25` that flings the marble across gaps toward the next terrace or goal.
 */
export function getDefaultCoursePortals(course: CourseSpec): readonly PortalPair[] {
  if (course.portals && course.portals.length > 0) {
    return course.portals.map((pair) => ({
      ...pair,
      radius: Math.max(DEFAULT_PORTAL_RADIUS, pair.radius ?? DEFAULT_PORTAL_RADIUS),
      activeA: pair.activeA ?? true,
      activeB: pair.activeB ?? true,
      flingBoost: pair.flingBoost && pair.flingBoost > 1.0 ? pair.flingBoost : DEFAULT_PORTAL_FLING_BOOST,
    }));
  }

  const baseId = course.id.replace(/-argon-mutated$/, '');
  switch (baseId) {
    case 'practice-race':
      return [
        {
          id: 'practice-chute-fling-portal',
          posA: [0.4, 5.42, -19.35],
          normalA: [0.0, 0.22, 0.9755],
          upA: [0.0, 0.9755, -0.22],
          posB: [27.05, 1.7, -19.85],
          normalB: [0.0, 0.36, -0.933],
          upB: [0.0, 0.933, 0.36],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    case 'beginner-chutes':
      return [
        {
          id: 'beginner-acid-vault-portal',
          posA: [2.8, 6.2, -18.5],
          normalA: [0.0, 0.34, 0.9404],
          upA: [0.0, 0.9404, -0.34],
          posB: [2.5, 6.55, -31.8],
          normalB: [-0.15, 0.691, -0.7071],
          upB: [-0.15, 0.7071, 0.691],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    case 'intermediate-madness':
      return [
        {
          id: 'intermediate-acid-vault-portal',
          posA: [-2.4, 7.55, -18.55],
          normalA: [0.0, 0.25, 0.968],
          upA: [0.0, 0.968, -0.25],
          posB: [20.2, 4.65, -28.6],
          normalB: [0.14, 0.52, -0.842],
          upB: [0.0, 0.85, 0.52],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    case 'aerial-catwalks':
      return [
        {
          id: 'aerial-chasm-fling-portal',
          posA: [-2.4, 10.65, -24.8],
          normalA: [0.0, 0.32, 0.9474],
          upA: [0.0, 0.9474, -0.32],
          posB: [6.2, 7.65, -39.2],
          normalB: [0.7071, 0.7071, 0.0],
          upB: [-0.7071, 0.7071, 0.0],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    case 'silly-race':
      return [
        {
          id: 'silly-uphill-express-portal',
          posA: [3.2, 5.45, -22.2],
          normalA: [0.0, 0.34, 0.9404],
          upA: [0.0, 0.9404, -0.34],
          posB: [3.2, 9.35, -38.5],
          normalB: [-0.28, 0.65, -0.7065],
          upB: [-0.28, 0.7065, 0.65],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    case 'ultimate-argon-core':
      return [
        {
          id: 'ultimate-reactor-fling-portal',
          posA: [0.0, 10.85, -24.2],
          normalA: [0.0, 0.32, 0.9474],
          upA: [0.0, 0.9474, -0.32],
          posB: [0.0, 7.05, -43.5],
          normalB: [0.0, 0.7071, -0.7071],
          upB: [0.0, 0.7071, 0.7071],
          radius: DEFAULT_PORTAL_RADIUS,
          activeA: true,
          activeB: true,
          flingBoost: DEFAULT_PORTAL_FLING_BOOST,
        },
      ];

    default:
      return [];
  }
}

/**
 * Transform a 3D point `p` from entry portal `(fromPos, fromBasis)` to exit portal `(toPos, toBasis)`
 * applying the 180-degree rotation R_pi around the portal up axis:
 *   local = (dp · r_A, dp · u_A, dp · n_A)
 *   p_out = pos_B - local.x * r_B + local.y * u_B - local.z * n_B
 */
export function transformPointAcrossPortal(
  p: Vec3,
  fromPos: Vec3,
  fromBasis: PortalBasis,
  toPos: Vec3,
  toBasis: PortalBasis,
): Vec3 {
  const dp = vSub(p, fromPos);
  const lx = vDot(dp, fromBasis.right);
  const ly = vDot(dp, fromBasis.up);
  const lz = vDot(dp, fromBasis.normal);

  return [
    toPos[0] - lx * toBasis.right[0] + ly * toBasis.up[0] - lz * toBasis.normal[0],
    toPos[1] - lx * toBasis.right[1] + ly * toBasis.up[1] - lz * toBasis.normal[1],
    toPos[2] - lx * toBasis.right[2] + ly * toBasis.up[2] - lz * toBasis.normal[2],
  ];
}

/**
 * Transform a 3D direction, velocity, or angular velocity vector `v` across a portal pair:
 *   v_out = (R_B * R_pi * R_A^-1) * v
 * Preserves 100% of Euclidean norm ||v_out|| == ||v||.
 */
export function transformVectorAcrossPortal(
  v: Vec3,
  fromBasis: PortalBasis,
  toBasis: PortalBasis,
): Vec3 {
  const vx = vDot(v, fromBasis.right);
  const vy = vDot(v, fromBasis.up);
  const vz = vDot(v, fromBasis.normal);

  return [
    -vx * toBasis.right[0] + vy * toBasis.up[0] - vz * toBasis.normal[0],
    -vx * toBasis.right[1] + vy * toBasis.up[1] - vz * toBasis.normal[1],
    -vx * toBasis.right[2] + vy * toBasis.up[2] - vz * toBasis.normal[2],
  ];
}

function mat3ToQuat(
  m00: number, m01: number, m02: number,
  m10: number, m11: number, m12: number,
  m20: number, m21: number, m22: number,
): Quat {
  const trace = m00 + m11 + m22;
  let x = 0;
  let y = 0;
  let z = 0;
  let w = 1;

  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1.0);
    w = 0.25 / s;
    x = (m21 - m12) * s;
    y = (m02 - m20) * s;
    z = (m10 - m01) * s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m00 - m11 - m22);
    w = (m21 - m12) / s;
    x = 0.25 * s;
    y = (m01 + m10) / s;
    z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = 2.0 * Math.sqrt(1.0 + m11 - m00 - m22);
    w = (m02 - m20) / s;
    x = (m01 + m10) / s;
    y = 0.25 * s;
    z = (m12 + m21) / s;
  } else {
    const s = 2.0 * Math.sqrt(1.0 + m22 - m00 - m11);
    w = (m10 - m01) / s;
    x = (m02 + m20) / s;
    y = (m12 + m21) / s;
    z = 0.25 * s;
  }

  const len = Math.hypot(x, y, z, w) || 1;
  return [x / len, y / len, z / len, w / len];
}

/**
 * Rotate a unit quaternion `q` across a portal pair using R_B * R_pi * R_A^-1.
 */
export function transformQuatAcrossPortal(
  q: Quat,
  fromBasis: PortalBasis,
  toBasis: PortalBasis,
): Quat {
  const c0 = transformVectorAcrossPortal([1, 0, 0], fromBasis, toBasis);
  const c1 = transformVectorAcrossPortal([0, 1, 0], fromBasis, toBasis);
  const c2 = transformVectorAcrossPortal([0, 0, 1], fromBasis, toBasis);

  const rotQ = mat3ToQuat(
    c0[0], c1[0], c2[0],
    c0[1], c1[1], c2[1],
    c0[2], c1[2], c2[2],
  );

  const [ax, ay, az, aw] = rotQ;
  const [bx, by, bz, bw] = q;
  const rx = aw * bx + ax * bw + ay * bz - az * by;
  const ry = aw * by - ax * bz + ay * bw + az * bx;
  const rz = aw * bz + ax * by - ay * bx + az * bw;
  const rw = aw * bw - ax * bx - ay * by - az * bz;
  const len = Math.hypot(rx, ry, rz, rw) || 1;
  return [rx / len, ry / len, rz / len, rw / len];
}

function sdSinglePortalThroat(p: Vec3, pos: Vec3, basis: PortalBasis, radius: number): number {
  const dp = vSub(p, pos);
  const lx = vDot(dp, basis.right);
  const ly = vDot(dp, basis.up);
  const lz = vDot(dp, basis.normal);

  const rPlanar = Math.hypot(lx, ly);
  const throatRadius = Math.max(0.25, radius - 0.06);
  const dx = rPlanar - throatRadius;
  const dz = Math.abs(lz) - 2.2;
  return Math.min(Math.max(dx, dz), 0) + Math.hypot(Math.max(dx, 0), Math.max(dz, 0));
}

/**
 * CSG-subtract an active portal throat from a world distance so CPU AST and
 * `.msdf` bytecode stay in lockstep wherever a linked aperture is carved open.
 *
 * The throat cylinder is subtracted from the world SDF on both CPU and GPU so
 * the marble doesn't collide with the host wall or floor inside an aperture.
 */
export function applyPortalThroatCarveToDistance(
  distance: number,
  p: Vec3,
  portals: readonly PortalPair[],
): number {
  if (portals.length === 0) return distance;
  const dThroat = evaluatePortalThroatCarve(p, portals);
  if (dThroat < 100 && -dThroat > distance) return -dThroat;
  return distance;
}

export function evaluatePortalThroatCarve(
  p: Vec3,
  portals: readonly PortalPair[],
): number {
  let minThroatDist = Infinity;
  for (let i = 0; i < portals.length; i++) {
    const pair = portals[i];
    const activeA = pair.activeA ?? true;
    const activeB = pair.activeB ?? true;
    if (!activeA || !activeB) continue;

    const basisA = computePortalBasis(pair.normalA, pair.upA);
    const basisB = computePortalBasis(pair.normalB, pair.upB);

    const dA = sdSinglePortalThroat(p, pair.posA, basisA, pair.radius);
    if (dA < minThroatDist) minThroatDist = dA;

    const dB = sdSinglePortalThroat(p, pair.posB, basisB, pair.radius);
    if (dB < minThroatDist) minThroatDist = dB;
  }
  return minThroatDist;
}

/**
 * Raymarch a single ray through non-Euclidean portal pairs on CPU (mirrors the GPU shader's
 * portal ray teleportation loop for unit testing and line-of-sight verification).
 */
export function tracePortalRayCpu(
  rayOrigin: Vec3,
  rayDir: Vec3,
  portals: readonly PortalPair[],
  evaluator: CpuWorldEvaluator,
  time = 0,
  maxHops = 2,
): {
  readonly hit: boolean;
  readonly hitPos: Vec3;
  readonly finalRayOrigin: Vec3;
  readonly finalRayDir: Vec3;
  readonly portalHops: number;
  readonly traversedPairIds: readonly string[];
} {
  let ro: Vec3 = [...rayOrigin];
  let rd: Vec3 = vNorm(rayDir, [0, 0, -1]);
  let t = 0.05;
  const maxT = 120.0;
  let portalHops = 0;
  let ignoreSide = -1;
  const traversedPairIds: string[] = [];

  for (let step = 0; step < 128; step++) {
    const p = vAdd(ro, vScale(rd, t));
    const worldDist = evaluator.distance(p, time);

    let bestApertureDist = Infinity;
    let bestPairIdx = -1;
    let bestEnteredA = true;

    for (let idx = 0; idx < portals.length; idx++) {
      const pair = portals[idx];
      const activeA = pair.activeA ?? true;
      const activeB = pair.activeB ?? true;
      if (!activeA || !activeB) continue;

      if (ignoreSide !== idx * 2) {
        const basisA = computePortalBasis(pair.normalA, pair.upA);
        const dpA = vSub(p, pair.posA);
        const rA = Math.hypot(vDot(dpA, basisA.right), vDot(dpA, basisA.up));
        const zA = vDot(dpA, basisA.normal);
        const dDiscA = Math.max(Math.abs(zA) - 0.02, rA - (pair.radius - 0.05));
        if (dDiscA < bestApertureDist) {
          bestApertureDist = dDiscA;
          bestPairIdx = idx;
          bestEnteredA = true;
        }
      }

      if (ignoreSide !== idx * 2 + 1) {
        const basisB = computePortalBasis(pair.normalB, pair.upB);
        const dpB = vSub(p, pair.posB);
        const rB = Math.hypot(vDot(dpB, basisB.right), vDot(dpB, basisB.up));
        const zB = vDot(dpB, basisB.normal);
        const dDiscB = Math.max(Math.abs(zB) - 0.02, rB - (pair.radius - 0.05));
        if (dDiscB < bestApertureDist) {
          bestApertureDist = dDiscB;
          bestPairIdx = idx;
          bestEnteredA = false;
        }
      }
    }

    if (bestApertureDist < 0.004 && bestApertureDist <= worldDist && portalHops < maxHops && bestPairIdx >= 0) {
      const pair = portals[bestPairIdx];
      const basisA = computePortalBasis(pair.normalA, pair.upA);
      const basisB = computePortalBasis(pair.normalB, pair.upB);
      const inPos = bestEnteredA ? pair.posA : pair.posB;
      const inBasis = bestEnteredA ? basisA : basisB;
      const outPos = bestEnteredA ? pair.posB : pair.posA;
      const outBasis = bestEnteredA ? basisB : basisA;

      const teleportedP = transformPointAcrossPortal(p, inPos, inBasis, outPos, outBasis);
      ro = vAdd(teleportedP, vScale(outBasis.normal, 0.045));
      rd = vNorm(transformVectorAcrossPortal(rd, inBasis, outBasis), outBasis.normal);
      t = 0.02;
      portalHops++;
      ignoreSide = bestEnteredA ? bestPairIdx * 2 + 1 : bestPairIdx * 2;
      traversedPairIds.push(pair.id);
      continue;
    }

    if (worldDist < 0.002) {
      return {
        hit: true,
        hitPos: p,
        finalRayOrigin: ro,
        finalRayDir: rd,
        portalHops,
        traversedPairIds,
      };
    }

    const stepDist = Math.min(worldDist, bestApertureDist);
    t += Math.max(stepDist * 0.88, 0.005);
    if (t >= maxT) break;
  }

  return {
    hit: false,
    hitPos: vAdd(ro, vScale(rd, t)),
    finalRayOrigin: ro,
    finalRayDir: rd,
    portalHops,
    traversedPairIds,
  };
}

/**
 * 120 Hz Momentum-Preserving Portal Crossing Solver ("Speedy marble goes in, speedy marble comes out")
 * with Generous Magnetic Capture Funnel (`2.5 * R`) and Guaranteed Minimum Fling Speed (`14.5 u/s` + `1.25x` boost).
 */
export function stepPortalCrossing(
  prevPos: Vec3,
  state: MarbleState,
  portals: readonly PortalPair[],
  dt: number,
  options?: {
    readonly minExitSpeed?: number;
    readonly defaultFlingBoost?: number;
    readonly cooldownSec?: number;
  },
): {
  readonly state: MarbleState;
  readonly crossed: PortalCrossingEvent | null;
} {
  const cooldown = Math.max(0, (state.portalCooldown ?? 0) - dt);
  if (portals.length === 0 || state.status !== 'racing') {
    return {
      state: cooldown !== (state.portalCooldown ?? 0)
        ? { ...state, portalCooldown: cooldown }
        : state,
      crossed: null,
    };
  }

  let nextVel = state.velocity;
  const minExitSpeed = options?.minExitSpeed ?? DEFAULT_PORTAL_MIN_EXIT_SPEED;
  const cooldownSec = options?.cooldownSec ?? DEFAULT_PORTAL_COOLDOWN_SEC;

  for (let i = 0; i < portals.length; i++) {
    const pair = portals[i];
    const activeA = pair.activeA ?? true;
    const activeB = pair.activeB ?? true;
    if (!activeA || !activeB) continue;

    const portalRadius = Math.max(0.5, pair.radius || DEFAULT_PORTAL_RADIUS);
    const basisA = computePortalBasis(pair.normalA, pair.upA);
    const basisB = computePortalBasis(pair.normalB, pair.upB);

    const sides: readonly {
      fromEnd: PortalEnd;
      toEnd: PortalEnd;
      inPos: Vec3;
      inBasis: PortalBasis;
      outPos: Vec3;
      outBasis: PortalBasis;
    }[] = [
      {
        fromEnd: 'blue',
        toEnd: 'orange',
        inPos: pair.posA,
        inBasis: basisA,
        outPos: pair.posB,
        outBasis: basisB,
      },
      {
        fromEnd: 'orange',
        toEnd: 'blue',
        inPos: pair.posB,
        inBasis: basisB,
        outPos: pair.posA,
        outBasis: basisA,
      },
    ];

    for (const side of sides) {
      const dpPrev = vSub(prevPos, side.inPos);
      const dpCurr = vSub(state.position, side.inPos);
      const dist3d = vLen(dpCurr);

      const prevZ = vDot(dpPrev, side.inBasis.normal);
      const currX = vDot(dpCurr, side.inBasis.right);
      const currY = vDot(dpCurr, side.inBasis.up);
      const currZ = vDot(dpCurr, side.inBasis.normal);
      const rPlanar = Math.hypot(currX, currY);

      // Generous Magnetic Capture Funnel within 2.5 * R of the entry aperture:
      // Gently pulls the marble's trajectory toward the portal center when rolling toward it
      // so the player never clips the torus rim and bounces off!
      const funnelRange = portalRadius * PORTAL_MAGNETIC_FUNNEL_RADIUS_MULT;
      if (cooldown <= 0 && dist3d <= funnelRange && currZ > -0.25 && currZ <= funnelRange) {
        const toCenter = vScale(dpCurr, -1 / Math.max(dist3d, 1e-4));
        const speed = vLen(nextVel);
        const approachingScore = speed > 0.15 ? vDot(vScale(nextVel, 1 / speed), toCenter) : 0.35;

        if (approachingScore > -0.05) {
          const proximity = 1.0 - dist3d / funnelRange;
          const lateralPullStrength = (22.0 + 26.0 * proximity) * Math.max(0.25, approachingScore);
          // Radial pull toward aperture center axis (lx -> 0, ly -> 0) and gentle intake pull into aperture
          const radialOffset = vAdd(
            vScale(side.inBasis.right, currX),
            vScale(side.inBasis.up, currY),
          );
          const radialLen = vLen(radialOffset);
          if (radialLen > 0.02) {
            const radialInward = vScale(radialOffset, -1 / radialLen);
            nextVel = vAdd(
              nextVel,
              vScale(radialInward, lateralPullStrength * Math.min(1.0, radialLen / portalRadius) * dt),
            );
          }
          // Gentle axial suction into the aperture throat when close in front
          if (rPlanar <= portalRadius * 1.15 && currZ > 0.0 && currZ <= state.radius + 1.2) {
            nextVel = vSub(nextVel, vScale(side.inBasis.normal, (28.0 + 20.0 * proximity) * dt));
          }
        }
      }

      if (cooldown > 0) continue;

      const vn = vDot(nextVel, side.inBasis.normal);
      const crossedPlane =
        rPlanar <= portalRadius * 1.05 &&
        (vn < 0.15 || prevZ > currZ) &&
        prevZ > -0.45 &&
        currZ <= state.radius * 0.55 &&
        prevZ >= currZ - 0.02;

      if (crossedPlane) {
        const entrySpeed = vLen(state.velocity);
        const flingBoost = pair.flingBoost ?? options?.defaultFlingBoost ?? DEFAULT_PORTAL_FLING_BOOST;

        // Rotate velocity by R_B * R_pi * R_A^-1, preserving 100% of scalar speed (times flingBoost)
        const rotatedVel = transformVectorAcrossPortal(state.velocity, side.inBasis, side.outBasis);
        const boostedVel = vScale(rotatedVel, flingBoost);
        const boostedSpeed = vLen(boostedVel);

        // Guaranteed Minimum Fling Speed (`minExitSpeed = 14.5 u/s` + `1.25x` momentum boost):
        // Even if the marble rolls into a portal slowly, shoot out of the exit portal with a
        // satisfying 14.5+ u/s launch arc along the exit normal + tangent direction!
        const targetExitSpeed = Math.max(minExitSpeed, boostedSpeed, entrySpeed * flingBoost);
        let exitDir = vNorm(boostedVel, side.outBasis.normal);
        if (vDot(exitDir, side.outBasis.normal) < 0.25) {
          exitDir = vNorm(
            vAdd(vScale(exitDir, 0.55), vScale(side.outBasis.normal, 0.85)),
            side.outBasis.normal,
          );
        }
        const exitVel = vScale(exitDir, targetExitSpeed);
        const exitSpeed = vLen(exitVel);

        // Rotate angular velocity & orientation quaternion across the portal frame
        const exitAngularVel = transformVectorAcrossPortal(
          state.angularVelocity,
          side.inBasis,
          side.outBasis,
        );
        const exitOrientation = transformQuatAcrossPortal(
          state.orientation,
          side.inBasis,
          side.outBasis,
        );

        // Exit Clearance: offset exit position by `normalB * (marbleRadius + 0.45)`
        // with a `350 ms` re-entry lock so the marble never double-triggers
        const clampedX = Math.max(-portalRadius * 0.45, Math.min(portalRadius * 0.45, currX * 0.5));
        const clampedY = Math.max(-portalRadius * 0.45, Math.min(portalRadius * 0.45, currY * 0.5));
        const exitClearance = state.radius + 0.45;
        const exitPos: Vec3 = [
          side.outPos[0] - clampedX * side.outBasis.right[0] + clampedY * side.outBasis.up[0] + exitClearance * side.outBasis.normal[0],
          side.outPos[1] - clampedX * side.outBasis.right[1] + clampedY * side.outBasis.up[1] + exitClearance * side.outBasis.normal[1],
          side.outPos[2] - clampedX * side.outBasis.right[2] + clampedY * side.outBasis.up[2] + exitClearance * side.outBasis.normal[2],
        ];

        const prevCrossings = state.portalCrossings ?? 0;
        const teleportedState: MarbleState = {
          ...state,
          position: exitPos,
          prevPosition: exitPos,
          velocity: exitVel,
          angularVelocity: exitAngularVel,
          orientation: exitOrientation,
          prevOrientation: exitOrientation,
          contact: {
            ...state.contact,
            grounded: false,
            normal: side.outBasis.normal,
          },
          portalCooldown: cooldownSec,
          portalCrossings: prevCrossings + 1,
          lastPortalExitSpeed: exitSpeed,
        };

        return {
          state: teleportedState,
          crossed: {
            pairId: pair.id,
            fromEnd: side.fromEnd,
            toEnd: side.toEnd,
            entryPosition: state.position,
            exitPosition: exitPos,
            entryVelocity: state.velocity,
            exitVelocity: exitVel,
            entrySpeed,
            exitSpeed,
          },
        };
      }
    }
  }

  return {
    state: {
      ...state,
      velocity: nextVel,
      portalCooldown: cooldown,
    },
    crossed: null,
  };
}

/**
 * 1-Key "Smart Portal Bridge" (`[Q]`):
 * Automatically places the Blue Entry Portal `3.5 m` directly ahead of the marble on the track
 * (facing the player!) and automatically places the Orange Exit Portal on the next elevated
 * terrace / checkpoint ahead (angled 45° toward the goal!) — so a single keypress creates a
 * working portal shortcut right in front of the player!
 */
export function placeSmartPortalBridge(
  marble: MarbleState,
  course: CourseSpec,
  evaluator: CpuWorldEvaluator,
  forwardHintXZ: readonly [number, number] = [0, -1],
  time = 0,
  currentPair?: PortalPair,
): PortalPair {
  const horizSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);
  const toGoalXZ: Vec3 = [
    course.goalPos[0] - marble.position[0],
    0,
    course.goalPos[2] - marble.position[2],
  ];

  // Determine player's forward roll direction in XZ
  const rollForward: Vec3 =
    horizSpeed > 0.65
      ? vNorm([marble.velocity[0], 0, marble.velocity[2]], [0, 0, -1])
      : Math.hypot(forwardHintXZ[0], forwardHintXZ[1]) > 0.1
        ? vNorm([forwardHintXZ[0], 0, forwardHintXZ[1]], [0, 0, -1])
        : vNorm(toGoalXZ, [0, 0, -1]);

  const savedPortals = evaluator.getPortals?.() ?? [];
  evaluator.setPortals?.([]);

  // 1. Place Blue Entry Portal 3.5m directly ahead of the marble on the track (facing the marble!)
  const probeAhead: Vec3 = [
    marble.position[0] + rollForward[0] * 3.5,
    marble.position[1] + 2.2,
    marble.position[2] + rollForward[2] * 3.5,
  ];
  let blueSurfacePos: Vec3 = [
    marble.position[0] + rollForward[0] * 3.5,
    marble.position[1],
    marble.position[2] + rollForward[2] * 3.5,
  ];

  try {
    let t = 0.1;
    for (let step = 0; step < 36; step++) {
      const p: Vec3 = [probeAhead[0], probeAhead[1] - t, probeAhead[2]];
      const d = evaluator.distance(p, time);
      if (d < 0.06) {
        blueSurfacePos = [p[0], p[1] + 0.55, p[2]];
        break;
      }
      t += Math.max(d * 0.85, 0.08);
      if (t > 8.0) break;
    }
  } finally {
    evaluator.setPortals?.(savedPortals);
  }

  // Blue portal normal faces back toward the approaching marble (slightly tilted upward for effortless capture)
  const blueNormal = vNorm(
    [-rollForward[0] * 0.92, 0.38, -rollForward[2] * 0.92],
    [0, 0.38, 0.92],
  );
  const blueBasis = computePortalBasis(blueNormal, [0, 1, 0]);

  // 2. Choose Orange Exit Portal on the next checkpoint / terrace ahead (angled 45° toward the goal)
  let exitTarget: Vec3 | null = null;
  if (course.checkpoints && course.checkpoints.length > 0) {
    const goalDist = vLen(vSub(course.goalPos, marble.position));
    let bestCp: Vec3 | null = null;
    let bestScore = Infinity;
    for (const cp of course.checkpoints) {
      const distFromMarble = vLen(vSub(cp.position, marble.position));
      const distFromCpToGoal = vLen(vSub(course.goalPos, cp.position));
      // Pick the next checkpoint ahead that is closer to the goal and at least 6m away from the marble
      if (distFromMarble > 5.5 && distFromCpToGoal < goalDist + 2.0 && distFromMarble < bestScore) {
        bestScore = distFromMarble;
        bestCp = cp.position;
      }
    }
    exitTarget = bestCp ?? course.checkpoints[course.checkpoints.length - 1].position;
  }

  if (!exitTarget || vLen(vSub(exitTarget, blueSurfacePos)) < 5.0) {
    // Fallback: place exit terrace 65% of the way toward the Goal Podium (or 4.5m in front of goal)
    const dirToGoal = vNorm(toGoalXZ, rollForward);
    const distToGoal = Math.hypot(toGoalXZ[0], toGoalXZ[2]);
    if (distToGoal > 9.0) {
      exitTarget = [
        course.goalPos[0] - dirToGoal[0] * 4.2,
        course.goalPos[1] + 0.95,
        course.goalPos[2] - dirToGoal[2] * 4.2,
      ];
    } else {
      exitTarget = [
        marble.position[0] + rollForward[0] * 14.0,
        marble.position[1] + 1.5,
        marble.position[2] + rollForward[2] * 14.0,
      ];
    }
  }

  const exitPos: Vec3 = [exitTarget[0], exitTarget[1] + 0.65, exitTarget[2]];
  const exitToGoalXZ = vNorm(
    [course.goalPos[0] - exitPos[0], 0, course.goalPos[2] - exitPos[2]],
    rollForward,
  );
  const invSqrt2 = Math.SQRT1_2;
  const orangeNormal = vNorm(
    [exitToGoalXZ[0] * invSqrt2, invSqrt2, exitToGoalXZ[2] * invSqrt2],
    [0, invSqrt2, -invSqrt2],
  );
  const orangeBasis = computePortalBasis(orangeNormal, [0, 1, 0]);

  return {
    id: currentPair?.id ?? 'smart-portal-bridge',
    posA: blueSurfacePos,
    normalA: blueBasis.normal,
    upA: blueBasis.up,
    posB: exitPos,
    normalB: orangeBasis.normal,
    upB: orangeBasis.up,
    radius: Math.max(DEFAULT_PORTAL_RADIUS, currentPair?.radius ?? DEFAULT_PORTAL_RADIUS),
    activeA: true,
    activeB: true,
    flingBoost: currentPair?.flingBoost ?? DEFAULT_PORTAL_FLING_BOOST,
  };
}

/**
 * Raycast from the camera through the cursor ray against `CpuWorldEvaluator` to compute
 * a live 3D Aim Ring / Trajectory Preview (`PortalAimPreview`) on the surface under the cursor.
 */
export function raycastPortalAimPreview(
  end: PortalEnd,
  origin: Vec3,
  aimDir: Vec3,
  evaluator: CpuWorldEvaluator,
  time: number,
  radius = DEFAULT_PORTAL_RADIUS,
): PortalAimPreview {
  const cleanDir = vNorm(aimDir, [0, -0.35, -0.93]);
  const candidateRays: Vec3[] = [
    cleanDir,
    vNorm([cleanDir[0], cleanDir[1] - 0.25, cleanDir[2]], [0, -0.5, -0.86]),
    vNorm([cleanDir[0], cleanDir[1] - 0.55, cleanDir[2]], [0, -0.8, -0.6]),
  ];

  const savedPortals = evaluator.getPortals?.() ?? [];
  evaluator.setPortals?.([]);

  let hitPos: Vec3 | null = null;
  let hitNormal: Vec3 = [0, 1, 0];

  try {
    for (const rd of candidateRays) {
      let t = 0.75;
      const maxT = 68.0;
      for (let step = 0; step < 84; step++) {
        const p = vAdd(origin, vScale(rd, t));
        const d = evaluator.distance(p, time);
        if (d < 0.045) {
          hitPos = p;
          hitNormal = evaluator.normal(p, time);
          break;
        }
        t += Math.max(d * 0.85, 0.08);
        if (t >= maxT) break;
      }
      if (hitPos) break;
    }
  } finally {
    evaluator.setPortals?.(savedPortals);
  }

  if (!hitPos) {
    const fallbackPos = vAdd(origin, vScale(cleanDir, 12.0));
    const basis = computePortalBasis([0, 1, 0], [0, 0, -1]);
    return {
      active: false,
      end,
      position: fallbackPos,
      normal: basis.normal,
      up: basis.up,
      radius,
    };
  }

  const upHint: Vec3 =
    Math.abs(hitNormal[1]) < 0.78
      ? [0, 1, 0]
      : vNorm([cleanDir[0], 0, cleanDir[2]], [0, 0, -1]);
  const basis = computePortalBasis(hitNormal, upHint);
  const surfacePos = vAdd(hitPos, vScale(basis.normal, 0.03));

  return {
    active: true,
    end,
    position: surfacePos,
    normal: basis.normal,
    up: basis.up,
    radius,
  };
}

/**
 * Raycast against the course SDF from `origin` along `aimDir` and place/relocate
 * either the Blue (`'blue'`) or Orange (`'orange'`) portal of `currentPair`.
 */
export function raycastAndPlacePortal(
  end: PortalEnd,
  currentPair: PortalPair,
  origin: Vec3,
  aimDir: Vec3,
  evaluator: CpuWorldEvaluator,
  time: number,
): {
  readonly pair: PortalPair;
  readonly hitPos: Vec3;
  readonly hitNormal: Vec3;
} {
  const cleanDir = vNorm(aimDir, [0, -0.35, -0.93]);
  const candidateRays: Vec3[] = [
    cleanDir,
    vNorm([cleanDir[0], cleanDir[1] - 0.32, cleanDir[2]], [0, -0.5, -0.86]),
    vNorm([cleanDir[0], cleanDir[1] - 0.68, cleanDir[2]], [0, -0.8, -0.6]),
    [0, -1, 0],
  ];

  const savedPortals = evaluator.getPortals?.() ?? [];
  evaluator.setPortals?.([]);

  let hitPos: Vec3 | null = null;
  let hitNormal: Vec3 = [0, 1, 0];

  try {
    for (const rd of candidateRays) {
      let t = 0.75;
      const maxT = 68.0;
      for (let step = 0; step < 84; step++) {
        const p = vAdd(origin, vScale(rd, t));
        const d = evaluator.distance(p, time);
        if (d < 0.045) {
          hitPos = p;
          hitNormal = evaluator.normal(p, time);
          break;
        }
        t += Math.max(d * 0.85, 0.08);
        if (t >= maxT) break;
      }
      if (hitPos) break;
    }
  } finally {
    evaluator.setPortals?.(savedPortals);
  }

  if (!hitPos) {
    hitPos = vAdd(origin, vScale(cleanDir, 4.5));
    hitNormal = evaluator.normal(hitPos, time);
  }

  const upHint: Vec3 =
    Math.abs(hitNormal[1]) < 0.78
      ? [0, 1, 0]
      : vNorm([cleanDir[0], 0, cleanDir[2]], [0, 0, -1]);
  const basis = computePortalBasis(hitNormal, upHint);
  const surfacePos = vAdd(hitPos, vScale(basis.normal, 0.02));
  const nextRadius = Math.max(DEFAULT_PORTAL_RADIUS, currentPair.radius || DEFAULT_PORTAL_RADIUS);
  const nextFlingBoost = currentPair.flingBoost ?? DEFAULT_PORTAL_FLING_BOOST;

  if (end === 'blue') {
    return {
      pair: {
        ...currentPair,
        posA: surfacePos,
        normalA: basis.normal,
        upA: basis.up,
        radius: nextRadius,
        activeA: true,
        flingBoost: nextFlingBoost,
      },
      hitPos: surfacePos,
      hitNormal: basis.normal,
    };
  }

  return {
    pair: {
      ...currentPair,
      posB: surfacePos,
      normalB: basis.normal,
      upB: basis.up,
      radius: nextRadius,
      activeB: true,
      flingBoost: nextFlingBoost,
    },
    hitPos: surfacePos,
    hitNormal: basis.normal,
  };
}
