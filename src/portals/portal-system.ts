/**
 * Non-Euclidean Raymarched SDF Portals & 120 Hz Momentum-Preserving Physics (`src/portals/portal-system.ts`)
 *
 * Implements:
 * 1. Orthonormal Portal Coordinate Frames (right, up, normal)
 * 2. Exact Non-Euclidean Point, Velocity, Spin & Quaternion Transforms:
 *      p' = T_B * R_pi * T_A^-1 * p
 *      v' = (R_B * R_pi * R_A^-1) * v   (100% scalar speed ||v|| preservation + optional flingBoost)
 *      w' = (R_B * R_pi * R_A^-1) * w
 * 3. Lockstep CSG Throat Cylinder Subtraction behind active portals so the marble
 *    rolls/falls smoothly into the aperture plane without bouncing off the host wall/floor
 * 4. Interactive Portal Gun SDF Raycaster (`[Q]` Blue Portal / `[E]` or Right-Click Orange Portal)
 */

import type {
  CpuWorldEvaluator,
  MarbleState,
  PortalPair,
  Quat,
  Vec3,
} from '../contracts';

export type PortalEnd = 'blue' | 'orange';

export interface PortalBasis {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly normal: Vec3;
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
 * Evaluate the combined CSG throat cylinder distance for all active linked portal pairs.
 * Subtracted from the world SDF on both CPU and GPU so the marble doesn't collide
 * with the host wall or floor when entering an active portal aperture.
 */
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
    let worldDist = evaluator.distance(p, time);

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
 * 120 Hz Momentum-Preserving Portal Crossing Solver ("Speedy marble goes in, speedy marble comes out").
 *
 * Checks if the marble center crossed an active portal aperture plane within `radius`.
 * When triggered, teleports position, rotates linear velocity `v` and angular velocity `omega`
 * by `R_B * R_pi * R_A^-1`, and preserves 100% of scalar speed `||v||` (scaled by optional `flingBoost`).
 */
export function stepPortalCrossing(
  prevPos: Vec3,
  state: MarbleState,
  portals: readonly PortalPair[],
  dt: number,
): {
  readonly state: MarbleState;
  readonly crossed: PortalCrossingEvent | null;
} {
  let cooldown = Math.max(0, (state.portalCooldown ?? 0) - dt);
  if (portals.length === 0 || state.status !== 'racing') {
    return {
      state: cooldown !== (state.portalCooldown ?? 0)
        ? { ...state, portalCooldown: cooldown }
        : state,
      crossed: null,
    };
  }

  let nextVel = state.velocity;

  for (let i = 0; i < portals.length; i++) {
    const pair = portals[i];
    const activeA = pair.activeA ?? true;
    const activeB = pair.activeB ?? true;
    if (!activeA || !activeB) continue;

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

      const prevZ = vDot(dpPrev, side.inBasis.normal);
      const currX = vDot(dpCurr, side.inBasis.right);
      const currY = vDot(dpCurr, side.inBasis.up);
      const currZ = vDot(dpCurr, side.inBasis.normal);
      const rPlanar = Math.hypot(currX, currY);

      // Gentle funnel capture when rolling into a floor/upward portal throat
      if (
        cooldown <= 0 &&
        rPlanar <= pair.radius * 0.92 &&
        currZ > 0.02 &&
        currZ <= state.radius + 0.25 &&
        side.inBasis.normal[1] > 0.5
      ) {
        nextVel = vSub(nextVel, vScale(side.inBasis.normal, 42.0 * dt));
      }

      if (cooldown > 0) continue;

      const vn = vDot(nextVel, side.inBasis.normal);
      const crossedPlane =
        rPlanar <= pair.radius &&
        vn < -0.02 &&
        prevZ > -0.35 &&
        currZ <= 0.12 &&
        prevZ >= currZ;

      if (crossedPlane) {
        const entrySpeed = vLen(state.velocity);
        const flingBoost = pair.flingBoost ?? 1.0;

        // Rotate velocity by R_B * R_pi * R_A^-1, preserving 100% of scalar speed (times flingBoost)
        const rotatedVel = transformVectorAcrossPortal(state.velocity, side.inBasis, side.outBasis);
        const exitVel = vScale(rotatedVel, flingBoost);
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

        // Transform position into exit frame, placed just outside the exit aperture plane
        const clampedX = Math.max(-pair.radius * 0.65, Math.min(pair.radius * 0.65, currX));
        const clampedY = Math.max(-pair.radius * 0.65, Math.min(pair.radius * 0.65, currY));
        const exitClearance = Math.max(state.radius + 0.08, -currZ + 0.14);
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
          portalCooldown: 0.14,
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
  // Candidate rays: primary aim ray, then progressively pitched-down rays so firing a portal
  // while rolling on a track always lands on a valid course surface ahead.
  const candidateRays: Vec3[] = [
    cleanDir,
    vNorm([cleanDir[0], cleanDir[1] - 0.32, cleanDir[2]], [0, -0.5, -0.86]),
    vNorm([cleanDir[0], cleanDir[1] - 0.68, cleanDir[2]], [0, -0.8, -0.6]),
    [0, -1, 0],
  ];

  // Temporarily disable portal throat carving during surface placement raycast
  const savedPortals = evaluator.getPortals?.() ?? [];
  evaluator.setPortals?.([]);

  let hitPos: Vec3 | null = null;
  let hitNormal: Vec3 = [0, 1, 0];

  try {
    for (const rd of candidateRays) {
      let t = 0.75;
      const maxT = 44.0;
      for (let step = 0; step < 72; step++) {
        const p = vAdd(origin, vScale(rd, t));
        const d = evaluator.distance(p, time);
        if (d < 0.04) {
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
    // Fallback to a point ahead and slightly grounded
    hitPos = vAdd(origin, vScale(cleanDir, 4.5));
    hitNormal = evaluator.normal(hitPos, time);
  }

  // Choose an intuitive `up` tangent vector on the hit surface
  const upHint: Vec3 =
    Math.abs(hitNormal[1]) < 0.78
      ? [0, 1, 0]
      : vNorm([cleanDir[0], 0, cleanDir[2]], [0, 0, -1]);
  const basis = computePortalBasis(hitNormal, upHint);
  // Nudge portal slightly onto the surface plane
  const surfacePos = vAdd(hitPos, vScale(basis.normal, 0.02));

  if (end === 'blue') {
    return {
      pair: {
        ...currentPair,
        posA: surfacePos,
        normalA: basis.normal,
        upA: basis.up,
        activeA: true,
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
      activeB: true,
    },
    hitPos: surfacePos,
    hitNormal: basis.normal,
  };
}
