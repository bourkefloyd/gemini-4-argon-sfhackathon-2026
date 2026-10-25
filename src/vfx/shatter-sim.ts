/**
 * Raymarched SDF Glass Shatter & Whisk-Broom Reassembly (`src/vfx/shatter-sim.ts`)
 *
 * When the marble transitions to `'shattered'` (from a high fall or piston crush):
 *   1. Ballistic Phase (`0.0s .. 1.2s`):
 *      Simulates 8–12 faceted glass shards bursting outward from the impact site and
 *      bouncing with restitution & spin across the CPU SDF course floor for 1.2 seconds.
 *   2. Whisk-Broom Sweep & Reassembly Phase (`1.2s .. 1.75s`):
 *      Homage to the iconic 1984 Marble Madness whisk-broom respawn — a virtual whisk broom
 *      sweeps the scattered shards together and arcs them smoothly back into a unified sphere
 *      at the active checkpoint `respawnPos`.
 *   3. GPU Raymarcher Integration:
 *      Exports `getShatterShaderSnippet()` (GLSL ES 3.00 & WGSL) and `uShatterShards`
 *      uniform packing (`vec4[12]` where `.xyz` = shard world center, `.w` = effective radius)
 *      so the fullscreen raymarcher renders refractive faceted glass fragments.
 */

import {
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type MarbleLifecycleStatus,
  type MarbleState,
  type Quat,
  type Vec3,
} from '../contracts';
import {
  quatMultiply,
  quatNormalize,
  quatSlerp,
  vec3Add,
  vec3Dot,
  vec3Length,
  vec3Lerp,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';

export const MIN_SHATTER_SHARDS = 8;
export const MAX_SHATTER_SHARDS = 12;
export const DEFAULT_SHATTER_SHARD_COUNT = 10;
export const DEFAULT_BALLISTIC_DURATION_SEC = 1.2;
export const DEFAULT_WHISK_SWEEP_DURATION_SEC = 0.55;

export type ShatterPhase = 'idle' | 'ballistic' | 'whisk_sweep' | 'complete';

export interface GlassShard {
  readonly index: number;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly orientation: Quat;
  readonly angularVelocity: Vec3;
  readonly halfExtents: Vec3;
  readonly baseRadius: number;
  readonly effectiveRadius: number;
  readonly bounceCount: number;
  readonly grounded: boolean;
  /** Position frozen at the end of the 1.2s ballistic scatter for deterministic broom convergence */
  readonly scatterAnchor: Vec3;
  /** Orientation frozen at the end of the 1.2s ballistic scatter */
  readonly scatterOrientation: Quat;
}

export interface WhiskBroomState {
  readonly active: boolean;
  /** Normalized progress `[0..1]` through the whisk-broom sweep phase */
  readonly progress: number;
  /** World-space position of the sweeping whisk broom head */
  readonly sweepPosition: Vec3;
  /** Brisk lateral brushing oscillation angle in radians */
  readonly bristleAngleRad: number;
  /** Normalized convergence tightness `[0..1]` (1 = shards fully coalesced at respawnPos) */
  readonly convergence: number;
}

export interface ShatterSimConfig {
  /** Number of simulated glass shards (`8..12`, default `10`) */
  readonly shardCount?: number;
  /** Duration of ballistic floor bouncing before whisk-broom sweep (`1.2` seconds) */
  readonly ballisticDurationSec?: number;
  /** Duration of whisk-broom convergence back to checkpoint spawn (`0.55` seconds) */
  readonly sweepDurationSec?: number;
  /** Downward gravitational acceleration (`35.0` u/s^2) */
  readonly gravity?: number;
  /** Glass-on-tile bounce coefficient of restitution (`0.56`) */
  readonly shardRestitution?: number;
  /** Tangential floor friction damping per bounce (`0.84`) */
  readonly shardFriction?: number;
}

export interface ShatterSimState {
  readonly active: boolean;
  readonly phase: ShatterPhase;
  readonly elapsedSec: number;
  readonly ballisticDurationSec: number;
  readonly sweepDurationSec: number;
  readonly totalDurationSec: number;
  readonly originPos: Vec3;
  readonly respawnPos: Vec3;
  readonly shards: readonly GlassShard[];
  readonly whiskBroom: WhiskBroomState;
  /** Packed `Float32Array(48)` (`12 * vec4`) for `uShatterShards` uniform upload */
  readonly uShatterShards: Float32Array;
  /** Packed `Float32Array(48)` (`12 * vec4`) for shard orientation quaternions */
  readonly uShatterQuats: Float32Array;
}

export interface ShatterTriggerInput {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly radius?: number;
  readonly respawnPos: Vec3;
  readonly impactNormal?: Vec3;
  readonly impactSpeed?: number;
}

export interface ShatterSimulator {
  getState(): ShatterSimState;
  trigger(input: ShatterTriggerInput): ShatterSimState;
  reset(): ShatterSimState;
  step(dt: number, evaluator: CpuWorldEvaluator, simTime?: number): ShatterSimState;
  syncWithMarbleState(
    marble: MarbleState,
    evaluator: CpuWorldEvaluator,
    dt: number,
    simTime?: number,
  ): ShatterSimState;
  packUniforms(targetBuffer?: Float32Array): Float32Array;
}

export interface ShatterShaderSnippet {
  readonly uniformName: 'uShatterShards';
  readonly maxShards: typeof MAX_SHATTER_SHARDS;
  readonly glsl: string;
  readonly wgsl: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-6, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Deterministic golden-spiral unit direction for shard `index` out of `count`.
 * Biases upward in `Y` so shards burst above the floor plane rather than tunneling downward.
 */
function computeShardBurstDirection(index: number, count: number, normal: Vec3): Vec3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const theta = goldenAngle * index;
  const u = (index + 0.5) / count;
  // Bias vertical elevation into upper hemisphere [0.18 .. 0.92]
  const y = 0.18 + 0.74 * u;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const localDir: Vec3 = [r * Math.cos(theta), y, r * Math.sin(theta)];

  // Blend with impact surface normal to ensure shards eject away from walls/pistons too
  return vec3Normalize(vec3Add(localDir, vec3Scale(normal, 0.55)));
}

/**
 * Integrate quaternion `q` by world angular velocity `omega` over `dt`.
 */
function integrateQuaternion(q: Quat, omega: Vec3, dt: number): Quat {
  const speed = vec3Length(omega);
  if (speed <= 1e-5) return q;
  const axis = vec3Scale(omega, 1 / speed);
  const halfAngle = 0.5 * speed * dt;
  const s = Math.sin(halfAngle);
  const dq: Quat = [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(halfAngle)];
  return quatNormalize(quatMultiply(dq, q));
}

/**
 * Pack active glass shards into a `Float32Array(MAX_SHATTER_SHARDS * 4)` (`vec4[12]`)
 * suitable for `gl.uniform4fv(uShatterShardsLoc, packed)` or WebGPU uniform buffer upload.
 *
 * Layout per shard `i`: `[posX, posY, posZ, effectiveRadius]` (`effectiveRadius = 0` when inactive).
 */
export function packShatterUniforms(
  shards: readonly GlassShard[],
  active = true,
  target: Float32Array = new Float32Array(MAX_SHATTER_SHARDS * 4),
): Float32Array {
  target.fill(0);
  if (!active) return target;

  const limit = Math.min(shards.length, MAX_SHATTER_SHARDS);
  for (let i = 0; i < limit; i++) {
    const s = shards[i];
    const base = i * 4;
    target[base + 0] = s.position[0];
    target[base + 1] = s.position[1];
    target[base + 2] = s.position[2];
    target[base + 3] = Math.max(0, s.effectiveRadius);
  }
  return target;
}

/**
 * Pack shard orientation quaternions into `Float32Array(MAX_SHATTER_SHARDS * 4)`.
 */
export function packShatterOrientationUniforms(
  shards: readonly GlassShard[],
  active = true,
  target: Float32Array = new Float32Array(MAX_SHATTER_SHARDS * 4),
): Float32Array {
  target.fill(0);
  for (let i = 0; i < MAX_SHATTER_SHARDS; i++) {
    target[i * 4 + 3] = 1.0;
  }
  if (!active) return target;

  const limit = Math.min(shards.length, MAX_SHATTER_SHARDS);
  for (let i = 0; i < limit; i++) {
    const q = shards[i].orientation;
    const base = i * 4;
    target[base + 0] = q[0];
    target[base + 1] = q[1];
    target[base + 2] = q[2];
    target[base + 3] = q[3];
  }
  return target;
}

/**
 * Evaluate the CPU signed distance to the faceted glass shard cluster.
 * Mirrors the GPU `evalShatterShardsSdf` function in `getShatterShaderSnippet()`.
 */
export function evalShatterClusterSdfCpu(p: Vec3, shards: readonly GlassShard[]): number {
  let minDist = Infinity;
  for (let i = 0; i < shards.length; i++) {
    const s = shards[i];
    if (s.effectiveRadius <= 1e-4) continue;
    const dp = vec3Sub(p, s.position);
    // Faceted crystal prism approximation: sphere intersected with octahedral facet planes
    const r = s.effectiveRadius;
    const dSphere = vec3Length(dp) - r;
    const dOcta = (Math.abs(dp[0]) + Math.abs(dp[1]) + Math.abs(dp[2])) * 0.57735027 - r * 0.92;
    const dShard = Math.max(dSphere, dOcta);
    if (dShard < minDist) {
      minDist = dShard;
    }
  }
  return minDist;
}

/**
 * Create a stateful Raymarched SDF Glass Shatter & Whisk-Broom Reassembly simulator.
 */
export function createShatterSimulator(config: ShatterSimConfig = {}): ShatterSimulator {
  const shardCount = clamp(
    Math.round(config.shardCount ?? DEFAULT_SHATTER_SHARD_COUNT),
    MIN_SHATTER_SHARDS,
    MAX_SHATTER_SHARDS,
  );
  const ballisticDurationSec = Math.max(0.2, config.ballisticDurationSec ?? DEFAULT_BALLISTIC_DURATION_SEC);
  const sweepDurationSec = Math.max(0.15, config.sweepDurationSec ?? DEFAULT_WHISK_SWEEP_DURATION_SEC);
  const totalDurationSec = ballisticDurationSec + sweepDurationSec;
  const gravity = config.gravity ?? DEFAULT_PHYSICS_CONFIG.gravity;
  const shardRestitution = config.shardRestitution ?? 0.56;
  const shardFriction = config.shardFriction ?? 0.84;

  const uShatterShards = new Float32Array(MAX_SHATTER_SHARDS * 4);
  const uShatterQuats = new Float32Array(MAX_SHATTER_SHARDS * 4);
  let lastMarbleStatus: MarbleLifecycleStatus = 'racing';

  function createIdleState(originPos: Vec3 = [0, 0, 0], respawnPos: Vec3 = [0, 0, 0]): ShatterSimState {
    packShatterUniforms([], false, uShatterShards);
    packShatterOrientationUniforms([], false, uShatterQuats);
    return {
      active: false,
      phase: 'idle',
      elapsedSec: 0,
      ballisticDurationSec,
      sweepDurationSec,
      totalDurationSec,
      originPos,
      respawnPos,
      shards: [],
      whiskBroom: {
        active: false,
        progress: 0,
        sweepPosition: respawnPos,
        bristleAngleRad: 0,
        convergence: 0,
      },
      uShatterShards,
      uShatterQuats,
    };
  }

  let state: ShatterSimState = createIdleState();

  function trigger(input: ShatterTriggerInput): ShatterSimState {
    const marbleRadius = input.radius ?? DEFAULT_PHYSICS_CONFIG.marbleRadius;
    const normal = vec3Normalize(input.impactNormal ?? [0, 1, 0]);
    const impactSpeed = Math.max(
      input.impactSpeed ?? vec3Length(input.velocity),
      14.0,
    );

    // Reflect incoming marble velocity across the impact normal for realistic scatter
    const vn = vec3Dot(input.velocity, normal);
    const reflectedBaseVel: Vec3 =
      vn < 0
        ? vec3Sub(input.velocity, vec3Scale(normal, 1.35 * vn))
        : input.velocity;

    const shards: GlassShard[] = [];
    for (let i = 0; i < shardCount; i++) {
      const burstDir = computeShardBurstDirection(i, shardCount, normal);
      const frac = i / Math.max(1, shardCount - 1);
      const baseRadius = marbleRadius * (0.24 + 0.14 * ((i * 7) % 5) / 4);
      const spawnOffset = vec3Scale(burstDir, marbleRadius * 0.36);
      const startPos = vec3Add(input.position, spawnOffset);

      const radialSpeed = (3.8 + 3.4 * ((i * 3) % 5) / 4) * Math.min(1.6, impactSpeed / 22.0);
      const upKick = 3.2 + 2.8 * (1.0 - frac * 0.5);
      const shardVel: Vec3 = [
        reflectedBaseVel[0] * 0.38 + burstDir[0] * radialSpeed,
        Math.max(2.4, Math.min(9.5, reflectedBaseVel[1] * 0.22 + burstDir[1] * radialSpeed + upKick)),
        reflectedBaseVel[2] * 0.38 + burstDir[2] * radialSpeed,
      ];

      const spinAxis = vec3Normalize([
        Math.sin(i * 2.1 + 0.5),
        Math.cos(i * 1.7 + 0.3),
        Math.sin(i * 3.3 - 0.8),
      ]);
      const angularVelocity = vec3Scale(spinAxis, 9.0 + (i % 4) * 3.5);
      const initialQuat = integrateQuaternion([0, 0, 0, 1], angularVelocity, 0.04 * (i + 1));

      shards.push({
        index: i,
        position: startPos,
        velocity: shardVel,
        orientation: initialQuat,
        angularVelocity,
        halfExtents: [baseRadius * 1.25, baseRadius * 0.72, baseRadius * 0.95],
        baseRadius,
        effectiveRadius: baseRadius,
        bounceCount: 0,
        grounded: false,
        scatterAnchor: startPos,
        scatterOrientation: initialQuat,
      });
    }

    packShatterUniforms(shards, true, uShatterShards);
    packShatterOrientationUniforms(shards, true, uShatterQuats);

    state = {
      active: true,
      phase: 'ballistic',
      elapsedSec: 0,
      ballisticDurationSec,
      sweepDurationSec,
      totalDurationSec,
      originPos: [...input.position],
      respawnPos: [...input.respawnPos],
      shards,
      whiskBroom: {
        active: false,
        progress: 0,
        sweepPosition: [...input.position],
        bristleAngleRad: 0,
        convergence: 0,
      },
      uShatterShards,
      uShatterQuats,
    };

    return state;
  }

  function stepBallisticShard(
    shard: GlassShard,
    dt: number,
    evaluator: CpuWorldEvaluator,
    simTime: number,
  ): GlassShard {
    // Substep ballistic shards at <= 1/120s so high-speed shards never tunnel through thin floors
    const maxStep = 1 / 120;
    const subSteps = Math.max(1, Math.min(8, Math.ceil(dt / maxStep)));
    const subDt = dt / subSteps;

    let pos = shard.position;
    let vel = shard.velocity;
    let quat = shard.orientation;
    let angVel = shard.angularVelocity;
    let bounceCount = shard.bounceCount;
    let grounded = shard.grounded;

    for (let s = 0; s < subSteps; s++) {
      const tNow = simTime + s * subDt;
      vel = [vel[0], vel[1] - gravity * subDt, vel[2]];
      pos = vec3Add(pos, vec3Scale(vel, subDt));

      const sample = evaluator.sample(pos, tNow);
      const r = shard.baseRadius;
      if (sample.distance < r) {
        const n = evaluator.normal(pos, tNow);
        const penetration = r - sample.distance + 0.0015;
        pos = vec3Add(pos, vec3Scale(n, penetration));

        const surfVel = vec3Add(sample.kinematicVelocity, sample.conveyorVelocity);
        const relVel = vec3Sub(vel, surfVel);
        const vn = vec3Dot(relVel, n);

        if (vn < 0) {
          const bounceRestitution =
            -vn < 1.35 ? 0.0 : shardRestitution * Math.pow(0.82, Math.min(bounceCount, 5));
          const normalImpulse = -(1.0 + bounceRestitution) * vn;
          const afterBounce = vec3Add(relVel, vec3Scale(n, normalImpulse));

          // Apply tangential glass-on-tile friction
          const vt = vec3Sub(afterBounce, vec3Scale(n, vec3Dot(afterBounce, n)));
          const vnVec = vec3Scale(n, vec3Dot(afterBounce, n));
          vel = vec3Add(surfVel, vec3Add(vnVec, vec3Scale(vt, shardFriction)));

          if (-vn >= 1.1) {
            bounceCount += 1;
            // Impart fresh spin jitter on bounce
            angVel = [
              angVel[0] * 0.8 + vt[2] * 2.2,
              angVel[1] * 0.85,
              angVel[2] * 0.8 - vt[0] * 2.2,
            ];
          }
        }

        if (n[1] > 0.45 && Math.abs(vec3Dot(vec3Sub(vel, surfVel), n)) < 1.2) {
          grounded = true;
          angVel = vec3Scale(angVel, Math.max(0, 1 - 3.5 * subDt));
        } else {
          grounded = false;
        }
      } else {
        grounded = false;
      }

      quat = integrateQuaternion(quat, angVel, subDt);
    }

    return {
      ...shard,
      position: pos,
      velocity: vel,
      orientation: quat,
      angularVelocity: angVel,
      bounceCount,
      grounded,
      scatterAnchor: pos,
      scatterOrientation: quat,
    };
  }

  function step(dt: number, evaluator: CpuWorldEvaluator, simTime = 0): ShatterSimState {
    if (!state.active || state.phase === 'idle' || state.phase === 'complete') {
      return state;
    }

    const clampedDt = Math.max(0, Math.min(dt, 0.25));
    const prevElapsed = state.elapsedSec;
    const nextElapsed = prevElapsed + clampedDt;

    let currentShards = state.shards;

    // 1. Advance any remaining time inside the [0 .. ballisticDurationSec] window
    if (prevElapsed < ballisticDurationSec) {
      const ballisticDt = Math.min(clampedDt, ballisticDurationSec - prevElapsed);
      if (ballisticDt > 0) {
        currentShards = currentShards.map((shard) =>
          stepBallisticShard(shard, ballisticDt, evaluator, simTime),
        );
      }
    }

    // 2. If still in the ballistic phase (< 1.2s), return updated bouncing shards
    if (nextElapsed < ballisticDurationSec) {
      packShatterUniforms(currentShards, true, uShatterShards);
      packShatterOrientationUniforms(currentShards, true, uShatterQuats);
      state = {
        ...state,
        phase: 'ballistic',
        elapsedSec: nextElapsed,
        shards: currentShards,
        whiskBroom: {
          active: false,
          progress: 0,
          sweepPosition: state.originPos,
          bristleAngleRad: 0,
          convergence: 0,
        },
        uShatterShards,
        uShatterQuats,
      };
      return state;
    }

    // 3. Whisk-Broom Sweep & Reassembly Phase (elapsed >= 1.2s)
    const sweepElapsed = nextElapsed - ballisticDurationSec;
    const rawProgress = clamp(sweepElapsed / sweepDurationSec, 0, 1);
    const convergence = smoothstep(0, 1, rawProgress);

    // Compute centroid of scattered anchors for the whisk-broom sweep path
    let cx = 0;
    let cy = 0;
    let cz = 0;
    const nShards = Math.max(1, currentShards.length);
    for (let i = 0; i < currentShards.length; i++) {
      const a = currentShards[i].scatterAnchor;
      cx += a[0];
      cy += a[1];
      cz += a[2];
    }
    const scatterCentroid: Vec3 = [cx / nShards, cy / nShards, cz / nShards];
    const targetPos = state.respawnPos;

    // Parabolic broom lift arc between scatter centroid and checkpoint spawn
    const travelDist = vec3Length(vec3Sub(targetPos, scatterCentroid));
    const arcLift = Math.min(3.2, Math.max(0.65, travelDist * 0.22)) * Math.sin(Math.PI * convergence);
    const sweepBase = vec3Lerp(scatterCentroid, targetPos, convergence);
    const bristleLateral = Math.sin(rawProgress * Math.PI * 5.0) * (1.0 - convergence) * 0.45;
    const sweepPosition: Vec3 = [
      sweepBase[0] + bristleLateral,
      sweepBase[1] + arcLift,
      sweepBase[2] - bristleLateral * 0.5,
    ];
    const bristleAngleRad = Math.sin(rawProgress * Math.PI * 6.0) * 0.42 * (1.0 - convergence);

    const sweptShards: GlassShard[] = currentShards.map((shard, idx) => {
      // Stagger each shard slightly so the whisk broom gathers outer shards into a tight bundle
      const shardDelay = (idx / Math.max(1, currentShards.length - 1)) * 0.14;
      const localT = clamp((rawProgress - shardDelay) / (1.0 - shardDelay), 0, 1);
      const easedT = smoothstep(0, 1, localT);

      // Swirl inward toward the broom head, then lock onto respawnPos at easedT -> 1
      const swirlAngle = (1.0 - easedT) * (idx * 0.75 + rawProgress * 4.5);
      const ringSpread = (1.0 - easedT) * (1.0 - easedT) * 0.28;
      const basePos = vec3Lerp(shard.scatterAnchor, targetPos, easedT);
      const shardLift = Math.sin(Math.PI * easedT) * Math.max(0.45, travelDist * 0.18);

      const nextPos: Vec3 =
        rawProgress >= 0.999
          ? [...targetPos]
          : [
              basePos[0] + Math.cos(swirlAngle) * ringSpread,
              basePos[1] + shardLift,
              basePos[2] + Math.sin(swirlAngle) * ringSpread,
            ];

      const prevPos = shard.position;
      const nextVel: Vec3 =
        clampedDt > 1e-5 ? vec3Scale(vec3Sub(nextPos, prevPos), 1 / clampedDt) : [0, 0, 0];
      const nextQuat = quatSlerp(shard.scatterOrientation, [0, 0, 0, 1], easedT);
      const nextEffRadius = shard.baseRadius * (1.0 - 0.18 * easedT);

      return {
        ...shard,
        position: nextPos,
        velocity: nextVel,
        orientation: nextQuat,
        angularVelocity: vec3Scale(shard.angularVelocity, 1.0 - easedT),
        effectiveRadius: nextEffRadius,
        grounded: false,
      };
    });

    const isComplete = nextElapsed >= totalDurationSec;
    const nextPhase: ShatterPhase = isComplete ? 'complete' : 'whisk_sweep';

    packShatterUniforms(sweptShards, !isComplete, uShatterShards);
    packShatterOrientationUniforms(sweptShards, !isComplete, uShatterQuats);

    state = {
      ...state,
      active: !isComplete,
      phase: nextPhase,
      elapsedSec: nextElapsed,
      shards: sweptShards,
      whiskBroom: {
        active: !isComplete,
        progress: rawProgress,
        sweepPosition,
        bristleAngleRad,
        convergence,
      },
      uShatterShards,
      uShatterQuats,
    };

    return state;
  }

  function syncWithMarbleState(
    marble: MarbleState,
    evaluator: CpuWorldEvaluator,
    dt: number,
    simTime = 0,
  ): ShatterSimState {
    if (marble.status === 'shattered' && lastMarbleStatus !== 'shattered') {
      lastMarbleStatus = 'shattered';
      return trigger({
        position: marble.position,
        velocity: marble.velocity,
        radius: marble.radius,
        respawnPos: marble.respawnPos,
        impactNormal: marble.contact.normal,
        impactSpeed: marble.contact.impactSpeed,
      });
    }

    lastMarbleStatus = marble.status;

    if (marble.status !== 'shattered' && state.active && state.phase === 'complete') {
      return reset();
    }

    if (state.active) {
      // Keep respawnPos synced with marble's checkpoint respawn target
      if (
        state.respawnPos[0] !== marble.respawnPos[0] ||
        state.respawnPos[1] !== marble.respawnPos[1] ||
        state.respawnPos[2] !== marble.respawnPos[2]
      ) {
        state = {
          ...state,
          respawnPos: [...marble.respawnPos],
        };
      }
      return step(dt, evaluator, simTime);
    }

    return state;
  }

  function reset(): ShatterSimState {
    lastMarbleStatus = 'racing';
    state = createIdleState(state.originPos, state.respawnPos);
    return state;
  }

  return {
    getState: () => state,
    trigger,
    reset,
    step,
    syncWithMarbleState,
    packUniforms: (targetBuffer?: Float32Array) =>
      packShatterUniforms(state.shards, state.active, targetBuffer ?? uShatterShards),
  };
}

/**
 * Returns lockstep GLSL ES 3.00 and WGSL shader snippets for raymarching and shading
 * the refractive faceted glass shards (`uShatterShards`) during the shatter & whisk-broom sequence.
 */
export function getShatterShaderSnippet(): ShatterShaderSnippet {
  const glsl = `// --- Raymarched Glass Shatter & Whisk-Broom Shader Snippet (GLSL ES 3.00) ---
#define MAX_SHATTER_SHARDS ${MAX_SHATTER_SHARDS}
uniform vec4 uShatterShards[MAX_SHATTER_SHARDS];
uniform int uShatterShardCount;

float sdGlassShardFaceted(vec3 p, float r, float seed) {
  float c = cos(seed);
  float s = sin(seed);
  vec3 q = vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  float dSphere = length(q) - r;
  float dOcta = (abs(q.x * 1.12) + abs(q.y * 1.35) + abs(q.z * 0.95)) * 0.57735027 - r * 0.92;
  return max(dSphere, dOcta);
}

vec2 evalShatterShardsSdf(vec3 p) {
  float minD = 1000.0;
  int count = clamp(uShatterShardCount, 0, MAX_SHATTER_SHARDS);
  for (int i = 0; i < MAX_SHATTER_SHARDS; i++) {
    if (i >= count) break;
    vec4 shard = uShatterShards[i];
    if (shard.w <= 0.0001) continue;
    float d = sdGlassShardFaceted(p - shard.xyz, shard.w, float(i) * 1.61803 + uTime * 3.5);
    if (d < minD) {
      minD = d;
    }
  }
  return vec2(minD, 102.0);
}

vec3 shadeShatterGlassShard(vec3 p, vec3 n, vec3 V, vec3 baseCol, vec3 veinCol, vec3 sunDir) {
  vec3 L = normalize(sunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.0);
  vec3 refrDir = refract(-V, n, 1.0 / 1.52);
  float dispersion = 0.5 + 0.5 * sin(dot(p * 24.0, refrDir));
  vec3 prismTint = mix(baseCol, veinCol, dispersion);
  float spec = pow(max(dot(n, H), 0.0), 160.0) * 1.65;
  return prismTint * (0.42 + 0.75 * ndotl) + vec3(0.88, 0.97, 1.0) * fresnel * 0.85 + vec3(1.0) * spec;
}
`;

  const wgsl = `// --- Raymarched Glass Shatter & Whisk-Broom Shader Snippet (WGSL) ---
const MAX_SHATTER_SHARDS: u32 = ${MAX_SHATTER_SHARDS}u;

fn sdGlassShardFaceted(p: vec3<f32>, r: f32, seed: f32) -> f32 {
  let c = cos(seed);
  let s = sin(seed);
  let q = vec3<f32>(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
  let dSphere = length(q) - r;
  let dOcta = (abs(q.x * 1.12) + abs(q.y * 1.35) + abs(q.z * 0.95)) * 0.57735027 - r * 0.92;
  return max(dSphere, dOcta);
}

fn evalShatterShardsSdf(
  p: vec3<f32>,
  shards: array<vec4<f32>, ${MAX_SHATTER_SHARDS}>,
  shardCount: u32,
  time: f32,
) -> vec2<f32> {
  var minD: f32 = 1000.0;
  let limit = min(shardCount, MAX_SHATTER_SHARDS);
  for (var i: u32 = 0u; i < MAX_SHATTER_SHARDS; i = i + 1u) {
    if (i >= limit) { break; }
    let shard = shards[i];
    if (shard.w <= 0.0001) { continue; }
    let d = sdGlassShardFaceted(p - shard.xyz, shard.w, f32(i) * 1.61803 + time * 3.5);
    if (d < minD) {
      minD = d;
    }
  }
  return vec2<f32>(minD, 102.0);
}

fn shadeShatterGlassShard(
  p: vec3<f32>,
  n: vec3<f32>,
  V: vec3<f32>,
  baseCol: vec3<f32>,
  veinCol: vec3<f32>,
  sunDir: vec3<f32>,
) -> vec3<f32> {
  let L = normalize(sunDir);
  let H = normalize(L + V);
  let ndotl = max(dot(n, L), 0.0);
  let ndotv = clamp(dot(n, V), 0.0, 1.0);
  let fresnel = pow(1.0 - ndotv, 3.0);
  let refrDir = refract(-V, n, 1.0 / 1.52);
  let dispersion = 0.5 + 0.5 * sin(dot(p * 24.0, refrDir));
  let prismTint = mix(baseCol, veinCol, dispersion);
  let spec = pow(max(dot(n, H), 0.0), 160.0) * 1.65;
  return prismTint * (0.42 + 0.75 * ndotl) + vec3<f32>(0.88, 0.97, 1.0) * fresnel * 0.85 + vec3<f32>(1.0) * spec;
}
`;

  return {
    uniformName: 'uShatterShards',
    maxShards: MAX_SHATTER_SHARDS,
    glsl,
    wgsl,
  };
}
