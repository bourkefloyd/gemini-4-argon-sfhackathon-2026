/**
 * Realtime CSG Level-Mutating Weapons, Powerups & Destructible Hazards (`src/weapons/weapons-system.ts`)
 *
 * Shares a fixed-capacity `FieldMutation` ring buffer (`MAX_FIELD_MUTATIONS = 16`)
 * between the 120 Hz CPU physics SDF evaluator (`src/sdf/eval-cpu.ts`) and the
 * GPU WebGL2/WGSL raymarching shader (`src/rendering/shader-compiler.ts`) with
 * ZERO mesh rebuild cost:
 *
 * - `[F]` Ability 1 — CSG Matter Bomb / Crater Cannon (`subtractSphere`):
 *     Carves a smooth spherical crater into walls/floors or under enemy Black Steelies,
 *     with `fwidth` isometric gridlines & elevation contours automatically wrapping into the crater.
 * - `[V]` Ability 2 — Ferrofluid Bridge Extruder (`unionCapsule` trail):
 *     For 3.5 seconds, extrudes solid `smoothUnion` SDF capsules directly underneath the rolling
 *     marble as it drives off a cliff into thin air — painting a solid 3D skybridge in realtime.
 * - `[B]` Ability 3 — Tectonic Pop-Ramp (`unionRamp` launch wedge + upward impulse):
 *     Erupts a smooth SDF ramp under/ahead of the marble at high speed to vault over acid trenches.
 * - `[N]` Ability 4 — Cryo Freeze Pulse (`materialOverride` sphere):
 *     Freezes lethal `acid` or `sticky` surfaces within a blast radius into fast crystalline `ice`.
 */

import {
  type FieldMutation,
  MATERIAL_IDS,
  MAX_FIELD_MUTATIONS,
  type MarbleState,
  type SdfSample,
  type Vec3,
  type WeaponAbilityId,
} from '../contracts';

export const BRIDGE_EXTRUDER_DURATION_SEC = 3.5;
export const BRIDGE_EXTRUDER_SEGMENT_STEP = 0.85;
export const BRIDGE_EXTRUDER_CAPSULE_RADIUS = 1.05;

export interface WeaponControllerState {
  readonly mutations: readonly FieldMutation[];
  readonly bridgeExtruderRemainingSec: number;
  readonly lastExtruderAnchor: Vec3 | null;
  readonly lastActivatedAbility: WeaponAbilityId | null;
  readonly lastActivatedTime: number;
  readonly nextMutationCounter: number;
}

export function createInitialWeaponState(): WeaponControllerState {
  return {
    mutations: [],
    bridgeExtruderRemainingSec: 0,
    lastExtruderAnchor: null,
    lastActivatedAbility: null,
    lastActivatedTime: -10,
    nextMutationCounter: 1,
  };
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

function vNormXZ(v: Vec3, fallback: Vec3 = [0, 0, -1]): Vec3 {
  const len = Math.hypot(v[0], v[2]);
  if (len < 1e-4) return fallback;
  return [v[0] / len, 0, v[2] / len];
}

/**
 * Append a `FieldMutation` to the shared ring buffer, pruning expired entries
 * and capping to `maxMutations` (`MAX_FIELD_MUTATIONS = 16`).
 */
export function appendFieldMutation(
  mutations: readonly FieldMutation[],
  next: FieldMutation,
  currentTime: number,
  maxMutations = MAX_FIELD_MUTATIONS,
): FieldMutation[] {
  const active = mutations.filter((m) => currentTime <= m.spawnTime + m.ttl);
  active.push(next);
  if (active.length > maxMutations) {
    return active.slice(active.length - maxMutations);
  }
  return active;
}

/**
 * Remove expired mutations from the ring buffer.
 */
export function pruneExpiredMutations(
  mutations: readonly FieldMutation[],
  currentTime: number,
): FieldMutation[] {
  return mutations.filter((m) => currentTime <= m.spawnTime + m.ttl);
}

function sdCapsuleMutation(p: Vec3, a: Vec3, b: Vec3, r: number): number {
  const pax = p[0] - a[0];
  const pay = p[1] - a[1];
  const paz = p[2] - a[2];
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const baba = Math.max(bax * bax + bay * bay + baz * baz, 1e-6);
  const papa = pax * bax + pay * bay + paz * baz;
  const h = Math.min(1, Math.max(0, papa / baba));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

/**
 * Evaluate an oriented Tectonic Pop-Ramp wedge at world point `p`.
 * Matches `sdTectonicRamp` in GLSL ES 3.00 and WGSL shaders 1:1.
 *
 * - `posA`: world center of ramp
 * - `posB`: `[dirX, rise, dirZ]` where `(dirX, dirZ)` is the unit horizontal launch direction
 * - `radius`: ramp half-length (`halfWidth = radius * 0.85`)
 */
export function sdTectonicRampMutation(
  p: Vec3,
  posA: Vec3,
  posB: Vec3,
  radius: number,
): number {
  const dpx = p[0] - posA[0];
  const dpy = p[1] - posA[1];
  const dpz = p[2] - posA[2];

  const dirLen = Math.max(Math.hypot(posB[0], posB[2]), 1e-5);
  const fx = posB[0] / dirLen;
  const fz = posB[2] / dirLen;
  const rx = -fz;
  const rz = fx;

  const runCoord = dpx * fx + dpz * fz;
  const latCoord = dpx * rx + dpz * rz;

  const safeHalfLen = Math.max(radius, 0.05);
  const rise = posB[1];
  const halfWidth = safeHalfLen * 0.85;
  const thickness = 0.9;
  const railHeight = 0.32;
  const railThickness = 0.24;

  const tanTheta = (0.5 * rise) / safeHalfLen;
  const cosTheta = 1.0 / Math.sqrt(1.0 + tanTheta * tanTheta);
  const yTop = (runCoord / safeHalfLen) * (0.5 * rise);
  const halfThick = Math.max(0.075, 0.5 * thickness);

  const dRun = Math.abs(runCoord) - safeHalfLen;
  const dDeckY = (Math.abs(dpy - (yTop - halfThick)) - halfThick) * cosTheta;
  const dLat = Math.abs(latCoord) - halfWidth;

  let dDeck =
    Math.hypot(Math.max(dRun, 0), Math.max(dDeckY, 0), Math.max(dLat, 0)) +
    Math.min(Math.max(dRun, Math.max(dDeckY, dLat)), 0);

  if (railHeight > 0.001) {
    const halfRailThick = 0.5 * railThickness;
    const halfRailH = 0.5 * railHeight;
    const dRailLat = Math.abs(Math.abs(latCoord) - (halfWidth - halfRailThick)) - halfRailThick;
    const dRailY = (Math.abs(dpy - (yTop + halfRailH)) - halfRailH) * cosTheta;
    const dRail =
      Math.hypot(Math.max(dRun, 0), Math.max(dRailY, 0), Math.max(dRailLat, 0)) +
      Math.min(Math.max(dRun, Math.max(dRailY, dRailLat)), 0);
    dDeck = Math.min(dDeck, dRail);
  }

  return dDeck;
}

/**
 * Apply all active `FieldMutation` operations in the ring buffer to a CPU `SdfSample`.
 * Mirrors the GPU shader function `applyFieldMutations(world, p)` with exact mathematical parity.
 */
export function applyFieldMutationsToSample(
  baseSample: SdfSample,
  p: Vec3,
  mutations: readonly FieldMutation[],
  time: number,
): SdfSample {
  if (mutations.length === 0) return baseSample;

  let d = baseSample.distance;
  let material = baseSample.material;
  let materialId = baseSample.materialId;

  const count = Math.min(mutations.length, MAX_FIELD_MUTATIONS);
  for (let i = 0; i < count; i++) {
    const m = mutations[i];
    if (time > m.spawnTime + m.ttl) continue;

    const k = Math.max(m.blendK, 1e-4);

    if (m.kind === 'subtractSphere') {
      const dSphere =
        Math.hypot(p[0] - m.posA[0], p[1] - m.posA[1], p[2] - m.posA[2]) - m.radius;
      const h = Math.min(1.0, Math.max(0.0, 0.5 - (0.5 * (d + dSphere)) / k));
      d = d * (1.0 - h) + -dSphere * h + k * h * (1.0 - h);
    } else if (m.kind === 'unionCapsule') {
      const dCap = sdCapsuleMutation(p, m.posA, m.posB, m.radius);
      const h = Math.min(1.0, Math.max(0.0, 0.5 + (0.5 * (dCap - d)) / k));
      const nextD = dCap * (1.0 - h) + d * h - k * h * (1.0 - h);
      if (dCap <= d) {
        material = m.material;
        materialId = MATERIAL_IDS[m.material];
      }
      d = nextD;
    } else if (m.kind === 'unionRamp') {
      const dRamp = sdTectonicRampMutation(p, m.posA, m.posB, m.radius);
      const h = Math.min(1.0, Math.max(0.0, 0.5 + (0.5 * (dRamp - d)) / k));
      const nextD = dRamp * (1.0 - h) + d * h - k * h * (1.0 - h);
      if (dRamp <= d) {
        material = m.material;
        materialId = MATERIAL_IDS[m.material];
      }
      d = nextD;
    } else if (m.kind === 'materialOverride') {
      const overrideRadius = Math.max(4.5, m.radius);
      const dOverride =
        Math.hypot(p[0] - m.posA[0], p[1] - m.posA[1], p[2] - m.posA[2]) - overrideRadius;
      if (dOverride <= 0.0 && material !== 'goal') {
        material = 'ice';
        materialId = MATERIAL_IDS.ice;
      }
    }
  }

  if (
    d === baseSample.distance &&
    material === baseSample.material &&
    materialId === baseSample.materialId
  ) {
    return baseSample;
  }

  return {
    ...baseSample,
    distance: d,
    material,
    materialId,
    conveyorVelocity: material === 'ice' ? [0, 0, 0] : baseSample.conveyorVelocity,
  };
}

/**
 * Trigger one of the 4 CSG Level-Mutating Weapons / Powerups:
 * - `'matterBomb'` (`[F]`): Smooth-subtracts a spherical crater ahead of/under the marble
 * - `'bridgeExtruder'` (`[V]`): Starts a 3.5s Ferrofluid Bridge Extruder capsule trail beneath the marble
 * - `'popRamp'` (`[B]`): Erupts a smooth-unioned Tectonic Pop-Ramp wedge + upward launch impulse
 * - `'cryoFreeze'` (`[N]`): Freezes lethal `acid` or `sticky` surfaces within blast radius into `ice`
 */
export function triggerWeaponAbility(
  ability: WeaponAbilityId,
  weaponState: WeaponControllerState,
  marbleState: MarbleState,
  aimForwardXZ: Vec3,
  simTime: number,
  options?: {
    targetPosition?: Vec3;
    radius?: number;
  },
): {
  readonly weaponState: WeaponControllerState;
  readonly marbleState: MarbleState;
  readonly spawnedMutation: FieldMutation;
} {
  const heading = vNormXZ(
    Math.hypot(marbleState.velocity[0], marbleState.velocity[2]) > 0.65
      ? marbleState.velocity
      : aimForwardXZ,
    [0, 0, -1],
  );
  const mutId = `mut-${ability}-${weaponState.nextMutationCounter}`;

  if (ability === 'matterBomb') {
    const radius = options?.radius ?? 2.05;
    // Place crater ahead of the marble along heading so it carves into walls/floors or drops enemy Steelies
    const defaultTarget: Vec3 = [
      marbleState.position[0] + heading[0] * 2.4,
      marbleState.position[1] - marbleState.radius - 0.15,
      marbleState.position[2] + heading[2] * 2.4,
    ];
    const center = options?.targetPosition ?? defaultTarget;
    const mutation: FieldMutation = {
      id: mutId,
      kind: 'subtractSphere',
      posA: center,
      posB: [0, 0, 0],
      radius,
      blendK: 0.35,
      material: 'standard',
      spawnTime: simTime,
      ttl: 45.0,
    };

    return {
      weaponState: {
        ...weaponState,
        mutations: appendFieldMutation(weaponState.mutations, mutation, simTime),
        lastActivatedAbility: ability,
        lastActivatedTime: simTime,
        nextMutationCounter: weaponState.nextMutationCounter + 1,
      },
      marbleState,
      spawnedMutation: mutation,
    };
  }

  if (ability === 'bridgeExtruder') {
    const capRadius = options?.radius ?? BRIDGE_EXTRUDER_CAPSULE_RADIUS;
    const underY = marbleState.position[1] - marbleState.radius - capRadius + 0.05;
    const startA: Vec3 = [
      marbleState.position[0] - heading[0] * 0.7,
      underY,
      marbleState.position[2] - heading[2] * 0.7,
    ];
    const endB: Vec3 = [
      marbleState.position[0] + heading[0] * 1.45,
      underY,
      marbleState.position[2] + heading[2] * 1.45,
    ];
    const mutation: FieldMutation = {
      id: mutId,
      kind: 'unionCapsule',
      posA: startA,
      posB: endB,
      radius: capRadius,
      blendK: 0.38,
      material: 'standard',
      spawnTime: simTime,
      ttl: 45.0,
    };

    return {
      weaponState: {
        ...weaponState,
        mutations: appendFieldMutation(weaponState.mutations, mutation, simTime),
        bridgeExtruderRemainingSec: BRIDGE_EXTRUDER_DURATION_SEC,
        lastExtruderAnchor: endB,
        lastActivatedAbility: ability,
        lastActivatedTime: simTime,
        nextMutationCounter: weaponState.nextMutationCounter + 1,
      },
      marbleState,
      spawnedMutation: mutation,
    };
  }

  if (ability === 'popRamp') {
    const halfLen = options?.radius ?? 2.25;
    const rise = 1.85;
    const rampCenter: Vec3 =
      options?.targetPosition ?? [
        marbleState.position[0] + heading[0] * 1.15,
        marbleState.position[1] - marbleState.radius + 0.15,
        marbleState.position[2] + heading[2] * 1.15,
      ];
    const mutation: FieldMutation = {
      id: mutId,
      kind: 'unionRamp',
      posA: rampCenter,
      posB: [heading[0], rise, heading[2]],
      radius: halfLen,
      blendK: 0.32,
      material: 'bounce',
      spawnTime: simTime,
      ttl: 45.0,
    };

    // Impart immediate upward + forward tectonic eruption launch impulse
    const boostedVel: Vec3 = [
      marbleState.velocity[0] + heading[0] * 5.8,
      Math.max(marbleState.velocity[1] + 11.2, 12.8),
      marbleState.velocity[2] + heading[2] * 5.8,
    ];
    const liftedPos: Vec3 = [
      marbleState.position[0],
      marbleState.position[1] + 0.35,
      marbleState.position[2],
    ];

    return {
      weaponState: {
        ...weaponState,
        mutations: appendFieldMutation(weaponState.mutations, mutation, simTime),
        lastActivatedAbility: ability,
        lastActivatedTime: simTime,
        nextMutationCounter: weaponState.nextMutationCounter + 1,
      },
      marbleState: {
        ...marbleState,
        position: liftedPos,
        velocity: boostedVel,
        contact: {
          ...marbleState.contact,
          grounded: false,
        },
      },
      spawnedMutation: mutation,
    };
  }

  // ability === 'cryoFreeze'
  const cryoRadius = Math.max(4.5, options?.radius ?? 4.5);
  const cryoCenter: Vec3 =
    options?.targetPosition ?? [
      marbleState.position[0] + heading[0] * 1.2,
      marbleState.position[1] - marbleState.radius,
      marbleState.position[2] + heading[2] * 1.2,
    ];
  const mutation: FieldMutation = {
    id: mutId,
    kind: 'materialOverride',
    posA: cryoCenter,
    posB: [0, 0, 0],
    radius: cryoRadius,
    blendK: 0.25,
    material: 'ice',
    spawnTime: simTime,
    ttl: 45.0,
  };

  // Immediate 1.3x horizontal velocity glide boost when [X] Cryo Freeze is triggered while rolling
  const horizSpeed = Math.hypot(marbleState.velocity[0], marbleState.velocity[2]);
  const boostedVel: Vec3 =
    horizSpeed > 0.05
      ? [
          marbleState.velocity[0] * 1.3,
          marbleState.velocity[1],
          marbleState.velocity[2] * 1.3,
        ]
      : [
          marbleState.velocity[0] + heading[0] * 3.5,
          marbleState.velocity[1],
          marbleState.velocity[2] + heading[2] * 3.5,
        ];

  return {
    weaponState: {
      ...weaponState,
      mutations: appendFieldMutation(weaponState.mutations, mutation, simTime),
      lastActivatedAbility: ability,
      lastActivatedTime: simTime,
      nextMutationCounter: weaponState.nextMutationCounter + 1,
    },
    marbleState: {
      ...marbleState,
      velocity: boostedVel,
      surfaceMaterial: marbleState.surfaceMaterial === 'goal' ? 'goal' : 'ice',
    },
    spawnedMutation: mutation,
  };
}

/**
 * Step the active Ferrofluid Bridge Extruder (`[V]`) at 120 Hz.
 * While `bridgeExtruderRemainingSec > 0`, continuously extrudes smooth-unioned SDF capsules
 * directly beneath the rolling marble so it can drive straight off cliffs across the abyss!
 */
export function stepWeaponController(
  weaponState: WeaponControllerState,
  marbleState: MarbleState,
  aimForwardXZ: Vec3,
  dt: number,
  simTime: number,
): {
  readonly weaponState: WeaponControllerState;
  readonly marbleState: MarbleState;
} {
  let mutations = weaponState.mutations;
  let remaining = Math.max(0, weaponState.bridgeExtruderRemainingSec - dt);
  let anchor = weaponState.lastExtruderAnchor;
  let counter = weaponState.nextMutationCounter;
  let nextMarble = marbleState;

  if (weaponState.bridgeExtruderRemainingSec > 0 && marbleState.status === 'racing') {
    const capRadius = BRIDGE_EXTRUDER_CAPSULE_RADIUS;
    const heading = vNormXZ(
      Math.hypot(marbleState.velocity[0], marbleState.velocity[2]) > 0.35
        ? marbleState.velocity
        : aimForwardXZ,
      [0, 0, -1],
    );

    const targetUnder: Vec3 = [
      marbleState.position[0] + heading[0] * 0.95,
      (anchor ? anchor[1] : marbleState.position[1] - marbleState.radius - capRadius + 0.05),
      marbleState.position[2] + heading[2] * 0.95,
    ];

    if (!anchor) {
      anchor = [
        marbleState.position[0] - heading[0] * 0.5,
        targetUnder[1],
        marbleState.position[2] - heading[2] * 0.5,
      ];
    }

    const distFromAnchor = Math.hypot(
      targetUnder[0] - anchor[0],
      targetUnder[2] - anchor[2],
    );

    if (distFromAnchor >= BRIDGE_EXTRUDER_SEGMENT_STEP) {
      const segEnd: Vec3 = [
        targetUnder[0] + heading[0] * 0.45,
        anchor[1],
        targetUnder[2] + heading[2] * 0.45,
      ];
      const newCap: FieldMutation = {
        id: `mut-bridge-${counter++}`,
        kind: 'unionCapsule',
        posA: anchor,
        posB: segEnd,
        radius: capRadius,
        blendK: 0.38,
        material: 'standard',
        spawnTime: simTime,
        ttl: 45.0,
      };
      mutations = appendFieldMutation(mutations, newCap, simTime);
      anchor = targetUnder;
    }

    // Keep the marble supported on the freshly solidified ferrofluid bridge deck plane
    const deckTopY = anchor[1] + capRadius + marbleState.radius;
    if (marbleState.position[1] < deckTopY && marbleState.velocity[1] < 0) {
      nextMarble = {
        ...marbleState,
        position: [marbleState.position[0], deckTopY, marbleState.position[2]],
        velocity: [marbleState.velocity[0], Math.max(0, marbleState.velocity[1]), marbleState.velocity[2]],
        contact: {
          ...marbleState.contact,
          grounded: true,
          normal: [0, 1, 0],
        },
      };
    }
  } else if (remaining <= 0) {
    anchor = null;
  }

  return {
    weaponState: {
      ...weaponState,
      mutations,
      bridgeExtruderRemainingSec: remaining,
      lastExtruderAnchor: anchor,
      nextMutationCounter: counter,
    },
    marbleState: nextMarble,
  };
}

export { vAdd, vScale, vSub };
