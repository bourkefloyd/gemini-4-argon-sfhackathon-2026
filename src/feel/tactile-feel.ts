/**
 * Tactile Trackball Feel, Backspin Braking, Glass Stress & Rim-Catch Assist (`src/feel/tactile-feel.ts`)
 *
 * Implements the physical sensation layer from `docs/gameplay-feel-bible.md`:
 * 1. Real-time 6-DOF Contact Slip Velocity & Slip Ratio (`||v_tangent - omega x r||`)
 *    with decoupled trackball spin angular momentum (`spinAngularVelocity`) so whipping
 *    the trackball in reverse or charging spin on Ice creates measurable slip & skid bite.
 * 2. Continuous Glass Stress (`0..1`) accumulation from hard wall/floor/bumper impacts
 *    with slow smooth-rolling annealing and 5 fracture stages (`pristine` -> `shattered`)
 *    for the marble's internal micro-fracture shader planes and stress crackle SFX.
 * 3. Cliff-Edge Rim-Teeter Detection (`rimProximity` within `0.5 R`) & Rim-Catch Assist
 *    torque window (`140 ms`, `1.45x` pull-back multiplier) on narrow catwalks and ledges.
 */

import {
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  MATERIAL_PROPERTIES,
  type MarbleState,
  type PhysicsConfig,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import {
  vec3Add,
  vec3Cross,
  vec3Dot,
  vec3Length,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';

export type GlassFractureStage =
  | 'pristine'
  | 'hairline'
  | 'cracked'
  | 'critical'
  | 'shattered';

export interface SlipTelemetry {
  /** Relative tangential linear velocity on the contact plane: `v_rel - (v_rel . n) n` */
  readonly tangentialVelocity: Vec3;
  /** Rotational surface velocity vector `omega x r` where `r = R * n` */
  readonly rotationalSurfaceVelocity: Vec3;
  /** Differential slip vector at contact point: `v_tangent - (omega x r)` */
  readonly slipVelocity: Vec3;
  /** Magnitude of differential slip speed `||v - omega x r||` (units/sec) */
  readonly slipSpeed: number;
  /** Normalized slip ratio in `[0, 1]` (`0` = pure rolling grip, `1` = full skid/counter-spin) */
  readonly slipRatio: number;
  /** Intensity `[0, 1]` of active reverse counter-spin braking (`backspin brake`) */
  readonly backspinIntensity: number;
  /** Stored rotational spin charge `[0, 1]` built up on low-friction surfaces like `ice` */
  readonly iceSpinCharge: number;
  /** Cosine alignment `[-1, 1]` between horizontal velocity and trackball input */
  readonly inputVelocityAlignment: number;
}

export interface GlassStressTelemetry {
  /** Normalized internal glass stress `[0, 1]` */
  readonly glassStress: number;
  /** Discrete fracture stage for HUD badge and shader mode selection */
  readonly fractureStage: GlassFractureStage;
  /** Smooth `[0, 1]` visibility factor for internal Voronoi/planar fracture veins in the marble shader */
  readonly crackVisibility: number;
  /** Smooth `[0, 1]` internal amber/crimson core glow prior to fatal fracture */
  readonly stressGlowIntensity: number;
  /** Stress delta added on the most recent physics step (triggers crackle SFX when `> 0.05`) */
  readonly lastStressImpulse: number;
  /** Cumulative number of stress-inducing impacts during the current life */
  readonly impactCount: number;
  /** True when stress reached `1.0` or the marble lifecycle status is `'shattered'` */
  readonly isShattered: boolean;
}

export interface RimAssistTelemetry {
  /** `[0, 1]` proximity to an unrailed drop-off within `0.5 R` of the marble footprint */
  readonly rimProximity: number;
  /** Unit XZ vector pointing away from the drop-off back toward safe platform support */
  readonly safeLedgeNormalXZ: readonly [number, number];
  /** Remaining duration (seconds) of the `140 ms` rim-catch torque window */
  readonly rimCatchWindowTimer: number;
  /** True when rim-catch assist is actively amplifying pull-back recovery torque */
  readonly rimSaveActive: boolean;
  /** Effective torque multiplier (`1.0 .. 1.65`) applied to recovery input */
  readonly rimTorqueMultiplier: number;
  /** Adjusted `moveXZ` input vector incorporating rim-catch assist & backspin bite */
  readonly assistedMoveXZ: readonly [number, number];
}

export interface TactileFeelState {
  readonly tick: number;
  readonly timeSeconds: number;
  /** Decoupled 6-DOF angular velocity vector (rad/sec) including trackball over-spin & backspin */
  readonly decoupledAngularVelocity: Vec3;
  readonly slip: SlipTelemetry;
  readonly stress: GlassStressTelemetry;
  readonly rim: RimAssistTelemetry;
  /** Ground speed `||v_xz||` (units/sec) */
  readonly groundSpeed: number;
  /** Total 3D speed `||v||` (units/sec) */
  readonly totalSpeed: number;
  /** Active surface material under or last touched by the marble */
  readonly surfaceMaterial: SurfaceMaterial;
  /** True when grounded on support geometry */
  readonly grounded: boolean;
}

export interface TactileFeelConfig {
  /** Minimum floor impact speed (u/s) before glass stress begins accumulating */
  readonly floorStressThreshold: number;
  /** Floor impact speed span (u/s) above threshold that adds `1.0` full stress */
  readonly floorStressScale: number;
  /** Minimum wall/bumper impact speed (u/s) before glass stress begins accumulating */
  readonly wallStressThreshold: number;
  /** Wall impact speed span (u/s) above threshold that adds `1.0` full stress */
  readonly wallStressScale: number;
  /** Rate (`stress / sec`) at which micro-fractures anneal during smooth low-impact rolling */
  readonly stressAnnealRate: number;
  /** Duration (seconds) of the cliff-edge rim-catch torque window (`0.14s` per Feel Bible) */
  readonly rimCatchWindowSec: number;
  /** Torque multiplier applied when pulling back from a cliff edge during rim-catch (`1.45x`) */
  readonly rimSaveTorqueMultiplier: number;
  /** Subtle passive ledge lip retention bias (`0..0.35`) when teetering within `0.5 R` */
  readonly rimPassiveRetentionBias: number;
}

export const DEFAULT_TACTILE_FEEL_CONFIG: TactileFeelConfig = {
  floorStressThreshold: 11.0,
  floorStressScale: 16.0,
  wallStressThreshold: 7.0,
  wallStressScale: 17.5,
  stressAnnealRate: 0.18,
  rimCatchWindowSec: 0.14,
  rimSaveTorqueMultiplier: 1.45,
  rimPassiveRetentionBias: 0.22,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-6, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Classify a `[0, 1]` glass stress value into a discrete fracture stage.
 */
export function classifyGlassFractureStage(
  glassStress: number,
  isShatteredStatus = false,
): GlassFractureStage {
  if (isShatteredStatus || glassStress >= 0.999) return 'shattered';
  if (glassStress >= 0.75) return 'critical';
  if (glassStress >= 0.42) return 'cracked';
  if (glassStress >= 0.18) return 'hairline';
  return 'pristine';
}

/**
 * Pure helper computing instantaneous slip velocity `v_tangent - (omega x r)` and slip ratio `[0..1]`.
 *
 * Uses the right-handed rolling convention matched to `src/physics/marble-physics.ts`:
 * On flat ground `n = [0, 1, 0]` with radius vector `r = R * n = [0, R, 0]`,
 * pure rolling at velocity `[vx, 0, vz]` has `omega_roll = [vz / R, 0, -vx / R]`,
 * so `omega_roll x r = [vx, 0, vz] = v_tangent` and `||v_tangent - omega x r|| = 0`.
 */
export function computeSlipMetrics(
  marble: MarbleState,
  inputMoveXZ: readonly [number, number] = [0, 0],
  overrideAngularVelocity?: Vec3,
): SlipTelemetry {
  const normal = marble.contact.grounded ? marble.contact.normal : ([0, 1, 0] as const);
  const surfVel = marble.contact.grounded ? marble.contact.surfaceVelocity : ([0, 0, 0] as const);
  const relVel = vec3Sub(marble.velocity, surfVel);
  const normalComp = vec3Dot(relVel, normal);
  const tangentialVelocity = vec3Sub(relVel, vec3Scale(normal, normalComp));

  const omega = overrideAngularVelocity ?? marble.angularVelocity;
  const radiusVec = vec3Scale(normal, marble.radius);
  const rotationalSurfaceVelocity = vec3Cross(omega, radiusVec);

  const rawSlipVec = vec3Sub(tangentialVelocity, rotationalSurfaceVelocity);
  const rawSlipSpeed = vec3Length(rawSlipVec);

  const [inX, inZ] = inputMoveXZ;
  const inMag = Math.hypot(inX, inZ);
  const horizVx = relVel[0];
  const horizVz = relVel[2];
  const horizSpeed = Math.hypot(horizVx, horizVz);

  let alignment = 0;
  if (inMag > 1e-3 && horizSpeed > 0.25) {
    alignment = (horizVx * inX + horizVz * inZ) / (horizSpeed * inMag);
    alignment = Math.max(-1, Math.min(1, alignment));
  }

  // Account for input-induced counter-spin when `marble.angularVelocity` is locked to linear roll
  const matProps = MATERIAL_PROPERTIES[marble.surfaceMaterial] ?? MATERIAL_PROPERTIES.standard;
  const counterSpinFactor = alignment < -0.1 ? -alignment * inMag : 0;
  const lowGripFactor =
    inMag > 0.05 ? clamp01((1.2 - matProps.friction) / 1.15) * inMag : 0;

  const syntheticSlipVec: Vec3 =
    inMag > 1e-3 && (counterSpinFactor > 0 || lowGripFactor > 0)
      ? [
          horizVx - inX * Math.max(horizSpeed, 6.0),
          0,
          horizVz - inZ * Math.max(horizSpeed, 6.0),
        ]
      : [0, 0, 0];

  const syntheticSlipSpeed =
    vec3Length(syntheticSlipVec) * Math.max(counterSpinFactor * 0.85, lowGripFactor * 0.75);

  const slipVelocity: Vec3 =
    rawSlipSpeed >= syntheticSlipSpeed ? rawSlipVec : syntheticSlipVec;
  const slipSpeed = Math.max(rawSlipSpeed, syntheticSlipSpeed);

  const refSpeed = Math.max(horizSpeed, vec3Length(rotationalSurfaceVelocity), 4.5);
  const slipRatio = clamp01(slipSpeed / refSpeed);

  const backspinIntensity = marble.contact.grounded
    ? clamp01(
        Math.max(
          counterSpinFactor * clamp01(horizSpeed / 3.5),
          alignment < -0.15 ? slipRatio * (-alignment) : 0,
          rawSlipSpeed > 2.0 && vec3Dot(tangentialVelocity, rotationalSurfaceVelocity) < 0
            ? clamp01(rawSlipSpeed / 10.0)
            : 0,
        ),
      )
    : 0;

  const iceSpinCharge =
    marble.surfaceMaterial === 'ice'
      ? clamp01(vec3Length(rotationalSurfaceVelocity) / 16.0 + lowGripFactor * 0.65)
      : 0;

  return {
    tangentialVelocity,
    rotationalSurfaceVelocity,
    slipVelocity,
    slipSpeed,
    slipRatio,
    backspinIntensity,
    iceSpinCharge,
    inputVelocityAlignment: alignment,
  };
}

/**
 * Pure step function for updating continuous Glass Stress (`0..1`) from impacts & smooth-rolling annealing.
 */
export function stepGlassStress(
  prevStress: GlassStressTelemetry,
  marble: MarbleState,
  dt: number,
  config: TactileFeelConfig = DEFAULT_TACTILE_FEEL_CONFIG,
  physicsConfig: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): GlassStressTelemetry {
  if (marble.status === 'shattered') {
    return {
      glassStress: 1.0,
      fractureStage: 'shattered',
      crackVisibility: 1.0,
      stressGlowIntensity: 1.0,
      lastStressImpulse: Math.max(0, 1.0 - prevStress.glassStress),
      impactCount: prevStress.impactCount + (prevStress.isShattered ? 0 : 1),
      isShattered: true,
    };
  }

  let stress = prevStress.glassStress;
  let lastImpulse = 0;
  let impactCount = prevStress.impactCount;

  const impactSpeed = marble.contact.impactSpeed;
  const isCushioned = marble.surfaceMaterial === 'bounce';

  if (!isCushioned && impactSpeed > 0) {
    if (marble.contact.wallContact || marble.surfaceMaterial === 'bumper') {
      if (impactSpeed > config.wallStressThreshold) {
        const wallDelta =
          (impactSpeed - config.wallStressThreshold) / Math.max(1.0, config.wallStressScale);
        // Bumper hits also add a minimum kinetic shock
        const bumperBonus = marble.surfaceMaterial === 'bumper' ? 0.12 : 0;
        lastImpulse = Math.max(lastImpulse, wallDelta + bumperBonus);
      }
    }

    if (marble.contact.grounded && impactSpeed > config.floorStressThreshold) {
      if (impactSpeed >= physicsConfig.shatterImpactSpeed) {
        lastImpulse = 1.0;
      } else {
        const floorDelta =
          (impactSpeed - config.floorStressThreshold) / Math.max(1.0, config.floorStressScale);
        lastImpulse = Math.max(lastImpulse, floorDelta);
      }
    }
  }

  if (lastImpulse > 0.005) {
    stress = clamp01(stress + lastImpulse);
    impactCount += 1;
  } else if (marble.status === 'racing') {
    // Anneal / heal micro-fractures while rolling smoothly without hard impacts
    const padMultiplier =
      marble.surfaceMaterial === 'start' || marble.surfaceMaterial === 'goal' ? 2.2 : 1.0;
    stress = clamp01(stress - config.stressAnnealRate * padMultiplier * Math.max(0, dt));
  }

  const isShattered = stress >= 0.999;
  const fractureStage = classifyGlassFractureStage(stress, isShattered);
  const crackVisibility = smoothstep(0.15, 0.92, stress);
  const stressGlowIntensity = smoothstep(0.32, 0.98, stress);

  return {
    glassStress: stress,
    fractureStage,
    crackVisibility,
    stressGlowIntensity,
    lastStressImpulse: lastImpulse,
    impactCount,
    isShattered,
  };
}

/**
 * Probe the SDF around the marble's grounded footprint to detect cliff edges within `0.5 R`
 * and compute the Rim-Catch Assist recovery vector.
 */
export function probeCliffRimProximity(
  marble: MarbleState,
  evaluator: CpuWorldEvaluator | null | undefined,
  simTime: number,
): {
  rimProximity: number;
  safeLedgeNormalXZ: readonly [number, number];
} {
  if (!marble.contact.grounded && marble.coyoteTimer <= 0) {
    return {
      rimProximity: 0,
      safeLedgeNormalXZ: [0, 0],
    };
  }

  const R = marble.radius;
  let rimProximity = 0;
  let safeX = 0;
  let safeZ = 0;

  // 1. Check contact normal tilt at rounded ledge lips (roundedBox / sweptTrack edges tilt outward)
  const nx = marble.contact.normal[0];
  const ny = marble.contact.normal[1];
  const nz = marble.contact.normal[2];
  const horizNormalMag = Math.hypot(nx, nz);

  // 2. If CPU SDF evaluator is provided, sample 4 cardinal/velocity-aligned downward probes at 0.5 R and 0.85 R
  if (evaluator) {
    const vx = marble.velocity[0];
    const vz = marble.velocity[2];
    const vMag = Math.hypot(vx, vz);
    const fwdX = vMag > 0.2 ? vx / vMag : 0;
    const fwdZ = vMag > 0.2 ? vz / vMag : -1;
    const rightX = -fwdZ;
    const rightZ = fwdX;

    const dirs: readonly [number, number][] = [
      [fwdX, fwdZ],
      [-fwdX, -fwdZ],
      [rightX, rightZ],
      [-rightX, -rightZ],
    ];

    const probeY = marble.position[1] - R * 1.15;
    for (const [dx, dz] of dirs) {
      const innerProbe: Vec3 = [
        marble.position[0] + dx * (0.48 * R),
        probeY,
        marble.position[2] + dz * (0.48 * R),
      ];
      const outerProbe: Vec3 = [
        marble.position[0] + dx * (0.85 * R),
        probeY,
        marble.position[2] + dz * (0.85 * R),
      ];

      const dInner = evaluator.distance(innerProbe, simTime);
      const dOuter = evaluator.distance(outerProbe, simTime);

      // A solid floor directly underneath has distance <= ~0.12 at y = pos.y - 1.15 R.
      // When approaching an unrailed cliff drop, distance increases sharply (> 0.22).
      const dropSeverity = clamp01((Math.max(dInner * 1.35, dOuter) - 0.16) / (0.65 * R));
      if (dropSeverity > 0.05) {
        rimProximity = Math.max(rimProximity, dropSeverity);
        // Safe direction points opposite to the drop-off direction `[dx, dz]`
        safeX -= dx * dropSeverity;
        safeZ -= dz * dropSeverity;
      }
    }
  } else if (horizNormalMag > 0.18 && ny < 0.96) {
    // Fallback when no evaluator is passed: detect rounded lip roll-off from contact normal
    rimProximity = clamp01((horizNormalMag - 0.18) / 0.55);
    safeX = -nx;
    safeZ = -nz;
  }

  const safeMag = Math.hypot(safeX, safeZ);
  const safeLedgeNormalXZ: readonly [number, number] =
    safeMag > 1e-4 ? [safeX / safeMag, safeZ / safeMag] : [0, 0];

  return {
    rimProximity: clamp01(rimProximity),
    safeLedgeNormalXZ,
  };
}

export interface TactileFeelTracker {
  getState(): TactileFeelState;
  reset(marble?: MarbleState): TactileFeelState;
  /**
   * Step the tactile feel simulation at 120 Hz (or frame dt), updating decoupled 6-DOF spin,
   * slip ratio, glass stress accumulation/annealing, and cliff rim-catch assist.
   */
  step(
    dt: number,
    marble: MarbleState,
    input: InputCommand,
    evaluator?: CpuWorldEvaluator | null,
    simTime?: number,
  ): TactileFeelState;
  /**
   * Inject an explicit impact speed (u/s) for testing or external hazard collisions.
   */
  registerImpact(impactSpeed: number, wallContact?: boolean, material?: SurfaceMaterial): GlassStressTelemetry;
}

export function createInitialTactileFeelState(marble?: MarbleState): TactileFeelState {
  return {
    tick: 0,
    timeSeconds: 0,
    decoupledAngularVelocity: marble ? [...marble.angularVelocity] : [0, 0, 0],
    slip: {
      tangentialVelocity: [0, 0, 0],
      rotationalSurfaceVelocity: [0, 0, 0],
      slipVelocity: [0, 0, 0],
      slipSpeed: 0,
      slipRatio: 0,
      backspinIntensity: 0,
      iceSpinCharge: 0,
      inputVelocityAlignment: 0,
    },
    stress: {
      glassStress: 0,
      fractureStage: 'pristine',
      crackVisibility: 0,
      stressGlowIntensity: 0,
      lastStressImpulse: 0,
      impactCount: 0,
      isShattered: false,
    },
    rim: {
      rimProximity: 0,
      safeLedgeNormalXZ: [0, 0],
      rimCatchWindowTimer: 0,
      rimSaveActive: false,
      rimTorqueMultiplier: 1.0,
      assistedMoveXZ: [0, 0],
    },
    groundSpeed: 0,
    totalSpeed: 0,
    surfaceMaterial: marble?.surfaceMaterial ?? 'start',
    grounded: marble?.contact.grounded ?? true,
  };
}

export function createTactileFeelTracker(
  config: TactileFeelConfig = DEFAULT_TACTILE_FEEL_CONFIG,
  physicsConfig: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): TactileFeelTracker {
  let state = createInitialTactileFeelState();
  let prevPosition: Vec3 | null = null;
  let prevStatus: MarbleState['status'] = 'racing';

  function reset(marble?: MarbleState): TactileFeelState {
    state = createInitialTactileFeelState(marble);
    prevPosition = marble ? [...marble.position] : null;
    prevStatus = marble?.status ?? 'racing';
    return state;
  }

  function step(
    dt: number,
    marble: MarbleState,
    input: InputCommand,
    evaluator?: CpuWorldEvaluator | null,
    simTime = state.timeSeconds + dt,
  ): TactileFeelState {
    const safeDt = Math.max(0, Math.min(dt, 0.1));

    // Detect respawn jump or status reset -> clear glass stress
    const respawned =
      input.respawnPressed ||
      (prevStatus !== 'racing' && marble.status === 'racing') ||
      (prevPosition !== null &&
        vec3Length(vec3Sub(marble.position, prevPosition)) > 6.5 &&
        marble.status === 'racing' &&
        vec3Length(marble.velocity) < 0.5);

    if (respawned) {
      state = {
        ...createInitialTactileFeelState(marble),
        tick: state.tick + 1,
        timeSeconds: simTime,
      };
      prevPosition = [...marble.position];
      prevStatus = marble.status;
      return state;
    }

    prevPosition = [...marble.position];
    prevStatus = marble.status;

    const R = Math.max(0.1, marble.radius);
    const matProps = MATERIAL_PROPERTIES[marble.surfaceMaterial] ?? MATERIAL_PROPERTIES.standard;
    const [inX, inZ] = input.moveXZ;

    // 1. Update decoupled 6-DOF angular velocity (`spinOmega`)
    // Trackball torque accelerates `spinOmega` around `[inZ, 0, -inX]`, while surface Coulomb friction
    // relaxes `spinOmega` toward pure-rolling angular velocity `omega_roll = [relVz / R, 0, -relVx / R]`.
    const surfVel = marble.contact.grounded ? marble.contact.surfaceVelocity : ([0, 0, 0] as const);
    const relVx = marble.velocity[0] - surfVel[0];
    const relVz = marble.velocity[2] - surfVel[2];
    const rollOmega: Vec3 = [relVz / R, 0, -relVx / R];

    // Check if caller explicitly supplied a non-rolling angularVelocity on `marble`
    const explicitOmegaDiff = vec3Length(vec3Sub(marble.angularVelocity, rollOmega));
    let spinOmega: Vec3;

    if (explicitOmegaDiff > 0.25) {
      spinOmega = marble.angularVelocity;
    } else {
      const spinTorqueScale = (physicsConfig.rollAcceleration * 1.45) / R;
      const desiredTorqueOmega: Vec3 = [
        state.decoupledAngularVelocity[0] + inZ * spinTorqueScale * safeDt,
        0,
        state.decoupledAngularVelocity[2] - inX * spinTorqueScale * safeDt,
      ];

      // Friction coupling rate: high on sticky/standard, very low on ice (allowing spin-charging!)
      const couplingRate = marble.contact.grounded
        ? Math.min(28.0, Math.max(0.8, matProps.friction * 5.2))
        : 1.2;
      const blend = 1.0 - Math.exp(-couplingRate * safeDt);

      spinOmega = [
        desiredTorqueOmega[0] + (rollOmega[0] - desiredTorqueOmega[0]) * blend,
        0,
        desiredTorqueOmega[2] + (rollOmega[2] - desiredTorqueOmega[2]) * blend,
      ];

      const maxSpinRad = (physicsConfig.maxHorizontalSpeed * 1.65) / R;
      const spinMag = vec3Length(spinOmega);
      if (spinMag > maxSpinRad) {
        spinOmega = vec3Scale(spinOmega, maxSpinRad / spinMag);
      }
    }

    // 2. Compute Slip Velocity & Slip Ratio
    const slip = computeSlipMetrics(marble, input.moveXZ, spinOmega);

    // 3. Update Glass Stress Accumulation & Annealing
    const stress = stepGlassStress(state.stress, marble, safeDt, config, physicsConfig);

    // 4. Compute Cliff-Edge Rim Proximity & Rim-Catch Assist
    const { rimProximity, safeLedgeNormalXZ } = probeCliffRimProximity(
      marble,
      evaluator,
      simTime,
    );

    let rimCatchWindowTimer = state.rim.rimCatchWindowTimer;
    if (rimProximity >= 0.18) {
      rimCatchWindowTimer = config.rimCatchWindowSec;
    } else {
      rimCatchWindowTimer = Math.max(0, rimCatchWindowTimer - safeDt);
    }

    const inMag = Math.hypot(inX, inZ);
    const pullBackAlignment =
      inMag > 1e-3
        ? (inX * safeLedgeNormalXZ[0] + inZ * safeLedgeNormalXZ[1]) / inMag
        : 0;

    const rimSaveActive =
      (rimProximity >= 0.15 || rimCatchWindowTimer > 0) &&
      (pullBackAlignment > 0.1 || slip.backspinIntensity > 0.2);

    const rimTorqueMultiplier = rimSaveActive
      ? 1.0 + (config.rimSaveTorqueMultiplier - 1.0) * Math.max(rimProximity, 0.5)
      : 1.0;

    let assistedX = inX * rimTorqueMultiplier;
    let assistedZ = inZ * rimTorqueMultiplier;

    if (rimProximity > 0.12) {
      // Subtle passive + active rim-catch retention toward safe platform interior
      const assistStrength =
        config.rimPassiveRetentionBias *
        rimProximity *
        (rimSaveActive ? 1.5 : 0.75);
      assistedX += safeLedgeNormalXZ[0] * assistStrength;
      assistedZ += safeLedgeNormalXZ[1] * assistStrength;
    }

    const assistedMag = Math.hypot(assistedX, assistedZ);
    if (assistedMag > 1.45) {
      assistedX = (assistedX / assistedMag) * 1.45;
      assistedZ = (assistedZ / assistedMag) * 1.45;
    }

    const groundSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);
    const totalSpeed = vec3Length(marble.velocity);

    state = {
      tick: state.tick + 1,
      timeSeconds: simTime,
      decoupledAngularVelocity: spinOmega,
      slip,
      stress,
      rim: {
        rimProximity,
        safeLedgeNormalXZ,
        rimCatchWindowTimer,
        rimSaveActive,
        rimTorqueMultiplier,
        assistedMoveXZ: [assistedX, assistedZ],
      },
      groundSpeed,
      totalSpeed,
      surfaceMaterial: marble.surfaceMaterial,
      grounded: marble.contact.grounded,
    };

    return state;
  }

  function registerImpact(
    impactSpeed: number,
    wallContact = false,
    material: SurfaceMaterial = state.surfaceMaterial,
  ): GlassStressTelemetry {
    const syntheticMarble: MarbleState = {
      position: [0, 0, 0],
      prevPosition: [0, 0, 0],
      velocity: [0, -impactSpeed, 0],
      angularVelocity: state.decoupledAngularVelocity,
      orientation: [0, 0, 0, 1],
      prevOrientation: [0, 0, 0, 1],
      radius: physicsConfig.marbleRadius,
      contact: {
        grounded: !wallContact,
        normal: wallContact ? [1, 0, 0] : [0, 1, 0],
        distance: physicsConfig.marbleRadius,
        contactPoint: [0, 0, 0],
        surfaceVelocity: [0, 0, 0],
        impactSpeed,
        wallContact,
      },
      surfaceMaterial: material,
      status: impactSpeed >= physicsConfig.shatterImpactSpeed && !wallContact && material !== 'bounce'
        ? 'shattered'
        : 'racing',
      statusTimer: 0,
      airTime: 0,
      peakFallSpeed: impactSpeed,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumpCooldown: 0,
      respawnPos: [0, 0, 0],
      marblePresetIndex: 0,
    };

    const nextStress = stepGlassStress(state.stress, syntheticMarble, 0, config, physicsConfig);
    state = {
      ...state,
      stress: nextStress,
    };
    return nextStress;
  }

  return {
    getState: () => state,
    reset,
    step,
    registerImpact,
  };
}

export { vec3Add, vec3Normalize };
