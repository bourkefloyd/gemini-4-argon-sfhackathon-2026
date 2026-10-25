/**
 * 120 Hz Multi-Marble Bumper Physics & Live Crowd CSG World Mutator (`src/multiplayer/multi-marble-sim.ts`)
 *
 * Features:
 * - Simulates up to 8 concurrent player glass marbles at 120 Hz using `createMarbleSimulation`
 * - Pairwise 3D sphere-sphere depenetration + elastic impulse + tangential spin transfer (`resolveMarbleCollisions`)
 * - Live Crowd CSG World Mutator (`applyCrowdMutationsToCourse`) converting phone deck events
 *   (`rescueBridge`, `craterMortar`, `tectonicRamp`, `cryoFreeze`, `waveSurge`) into declarative `CourseSpec` CSG trees.
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  type MarbleState,
  type PhysicsConfig,
  type SdfNode,
  type SdfPrimitiveNode,
  type Vec3,
} from '../contracts';
import { createInitialMarbleState, createMarbleSimulation, type MarbleSimulation } from '../physics';
import {
  createCpuWorldEvaluator,
  vec3Add,
  vec3Dot,
  vec3Length,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';
import {
  MAX_ARENA_RACERS,
  PARTY_MARBLE_PALETTES,
  type PartyRoomSnapshot,
  type PartyWorldMutationEvent,
} from './party-types';

export interface MarbleCollisionEvent {
  readonly indexA: number;
  readonly indexB: number;
  readonly idA?: string;
  readonly idB?: string;
  readonly contactPoint: Vec3;
  readonly normalAtoB: Vec3;
  readonly normalImpulse: number;
  readonly relativeSpeed: number;
}

export interface MarbleCollisionOptions {
  /** Elastic restitution coefficient for glass-on-glass marble bumper impacts (default: 0.92) */
  readonly restitution?: number;
  /** Extra arcade bumper pop speed added on high-energy body checks (default: 1.6) */
  readonly arcadeBumperBoost?: number;
  /** Tangential spin friction transfer factor (default: 0.22) */
  readonly spinTransfer?: number;
}

/**
 * Resolves pairwise 3D sphere-sphere elastic collisions across an array of `MarbleState`s.
 *
 * Returns a new array of updated `MarbleState`s and a list of collision events triggered during the step.
 */
export function resolveMarbleCollisions(
  states: readonly MarbleState[],
  options: MarbleCollisionOptions = {},
): {
  readonly states: MarbleState[];
  readonly collisions: MarbleCollisionEvent[];
} {
  const restitution = options.restitution ?? 0.92;
  const arcadeBumperBoost = options.arcadeBumperBoost ?? 1.6;
  const spinTransfer = options.spinTransfer ?? 0.22;

  const nextStates: MarbleState[] = states.map((s) => ({
    ...s,
    position: [...s.position],
    velocity: [...s.velocity],
    angularVelocity: [...s.angularVelocity],
  }));
  const collisions: MarbleCollisionEvent[] = [];

  for (let i = 0; i < nextStates.length; i++) {
    const a = nextStates[i];
    if (a.status !== 'racing') continue;

    for (let j = i + 1; j < nextStates.length; j++) {
      const b = nextStates[j];
      if (b.status !== 'racing') continue;

      const delta = vec3Sub(b.position, a.position);
      const dist = vec3Length(delta);
      const minSep = a.radius + b.radius;

      if (dist >= minSep) continue;

      // Compute unit collision normal from A -> B
      const normalAtoB: Vec3 =
        dist > 1e-5
          ? vec3Scale(delta, 1 / dist)
          : [1, 0, 0];

      // 1. Symmetric positional depenetration so marbles never overlap
      const overlap = minSep - dist + 0.001;
      const halfCorrection = vec3Scale(normalAtoB, overlap * 0.5);
      const posA = vec3Sub(a.position, halfCorrection);
      const posB = vec3Add(b.position, halfCorrection);

      // 2. Relative velocity along collision normal
      const relVel = vec3Sub(b.velocity, a.velocity);
      const velAlongNormal = vec3Dot(relVel, normalAtoB);

      let velA = a.velocity;
      let velB = b.velocity;
      let angA = a.angularVelocity;
      let angB = b.angularVelocity;
      let impulseMag = 0;

      if (velAlongNormal < 0) {
        const approachSpeed = -velAlongNormal;
        // Equal-mass elastic sphere collision: J = -(1 + e) * v_rel_n / 2
        const baseImpulse = 0.5 * (1.0 + restitution) * approachSpeed;
        const extraPop = approachSpeed > 2.0 ? arcadeBumperBoost : 0.35;
        impulseMag = baseImpulse + extraPop;

        const impulseVec = vec3Scale(normalAtoB, impulseMag);
        velA = vec3Sub(velA, impulseVec);
        velB = vec3Add(velB, impulseVec);

        // Tangential spin / rub transfer
        const tangentVel = vec3Sub(relVel, vec3Scale(normalAtoB, velAlongNormal));
        const tangentSpin = vec3Scale(tangentVel, spinTransfer);
        angA = vec3Add(angA, [tangentSpin[2], 0, -tangentSpin[0]]);
        angB = vec3Sub(angB, [tangentSpin[2], 0, -tangentSpin[0]]);
      } else {
        // Gentle separation push if overlapping with positive relative normal velocity
        impulseMag = overlap * 8.0;
        const pushVec = vec3Scale(normalAtoB, impulseMag * 0.5);
        velA = vec3Sub(velA, pushVec);
        velB = vec3Add(velB, pushVec);
      }

      const contactPoint = vec3Add(posA, vec3Scale(normalAtoB, a.radius));

      nextStates[i] = {
        ...a,
        position: posA,
        velocity: velA,
        angularVelocity: angA,
      };
      nextStates[j] = {
        ...b,
        position: posB,
        velocity: velB,
        angularVelocity: angB,
      };

      collisions.push({
        indexA: i,
        indexB: j,
        contactPoint,
        normalAtoB,
        normalImpulse: impulseMag,
        relativeSpeed: Math.abs(velAlongNormal),
      });
    }
  }

  return {
    states: nextStates,
    collisions,
  };
}

/**
 * Applies active Crowd Chaos & Rescue mutations (`rescueBridge`, `craterMortar`,
 * `tectonicRamp`, `cryoFreeze`, `waveSurge`) to a `CourseSpec` CSG tree so both
 * the CPU SDF evaluator and GPU shader compiler reflect the audience's live edits.
 */
export function applyCrowdMutationsToCourse(
  baseCourse: CourseSpec,
  mutations: readonly PartyWorldMutationEvent[],
): CourseSpec {
  if (mutations.length === 0) {
    return baseCourse;
  }

  const hasCryoFreeze = mutations.some((m) => m.kind === 'cryoFreeze');
  const hasWaveSurge = mutations.some((m) => m.kind === 'waveSurge');

  const mapPrimitive = (node: SdfPrimitiveNode): SdfPrimitiveNode => {
    let updated = node;
    if (hasCryoFreeze && updated.material === 'acid') {
      updated = { ...updated, material: 'ice' };
    }
    if (hasWaveSurge && updated.kind === 'waveFloor') {
      updated = {
        ...updated,
        waveAmplitude: updated.waveAmplitude * 2.0,
        waveSpeed: updated.waveSpeed * 1.35,
      };
    }
    return updated;
  };

  const mappedNodes = baseCourse.nodes.map(mapPrimitive);
  const mappedHazards = baseCourse.hazards.map(mapPrimitive);

  // Build base CSG union node
  let rootScene: SdfNode =
    baseCourse.scene ?? {
      kind: 'union',
      children: [...mappedNodes, ...mappedHazards],
    };

  for (const mut of mutations) {
    if (mut.kind === 'rescueBridge') {
      const bridgeNode: SdfPrimitiveNode = {
        id: mut.id,
        kind: 'capsule',
        material: 'bounce',
        center: mut.position,
        a: [0, 0, 1.8],
        b: [0, 0, -2.4],
        radius: mut.radius,
        supportBias: true,
      };
      rootScene = {
        kind: 'smoothUnion',
        smoothRadius: mut.blendK,
        children: [rootScene, bridgeNode],
      };
    } else if (mut.kind === 'tectonicRamp') {
      const rampNode: SdfPrimitiveNode = {
        id: mut.id,
        kind: 'ramp',
        material: 'bumper',
        center: mut.position,
        axis: 'z',
        halfLength: 2.0,
        rise: 0.95,
        halfWidth: 1.6,
        thickness: 0.65,
        supportBias: true,
      };
      rootScene = {
        kind: 'smoothUnion',
        smoothRadius: mut.blendK,
        children: [rootScene, rampNode],
      };
    } else if (mut.kind === 'craterMortar') {
      const craterSphere: SdfPrimitiveNode = {
        id: mut.id,
        kind: 'sphere',
        material: 'standard',
        center: mut.position,
        radius: mut.radius,
      };
      rootScene = {
        kind: 'smoothSubtract',
        smoothRadius: mut.blendK,
        children: [rootScene, craterSphere],
      };
    } else if (mut.kind === 'cryoFreeze') {
      const icePatch: SdfPrimitiveNode = {
        id: mut.id,
        kind: 'cylinder',
        material: 'ice',
        center: mut.position,
        radius: mut.radius,
        halfHeight: 0.25,
        supportBias: true,
      };
      rootScene = {
        kind: 'smoothUnion',
        smoothRadius: 0.2,
        children: [rootScene, icePatch],
      };
    }
  }

  return {
    ...baseCourse,
    nodes: mappedNodes,
    hazards: mappedHazards,
    scene: rootScene,
  };
}

export interface ArenaMarbleSlot {
  readonly playerId: string;
  readonly handle: string;
  readonly slotIndex: number;
  readonly colorHex: string;
  readonly state: MarbleState;
}

export interface MultiMarbleArenaSimulation {
  syncPlayersFromRoom(snapshot: PartyRoomSnapshot): void;
  setCourse(course: CourseSpec): void;
  stepFixed(
    dt: number,
    inputsByPlayerId: ReadonlyMap<string, InputCommand>,
    simTime: number,
  ): {
    readonly marbles: readonly ArenaMarbleSlot[];
    readonly collisions: readonly MarbleCollisionEvent[];
  };
  getMarbles(): readonly ArenaMarbleSlot[];
  getEvaluator(): CpuWorldEvaluator;
  getEffectiveCourse(): CourseSpec;
}

/**
 * Computes a staggered starting grid offset around `course.startPos` for up to 8 racers
 * so newly spawned marbles don't telefrag each other on frame 0.
 */
export function getArenaSlotSpawnPosition(
  baseStartPos: Vec3,
  slotIndex: number,
  marbleRadius = DEFAULT_PHYSICS_CONFIG.marbleRadius,
): Vec3 {
  if (slotIndex === 0) {
    return [...baseStartPos];
  }
  const col = (slotIndex % 3) - 1; // -1, 0, +1
  const row = Math.floor(slotIndex / 3); // 0, 1, 2
  const spacingX = marbleRadius * 2.45;
  const spacingZ = marbleRadius * 2.45;
  return [
    baseStartPos[0] + col * spacingX,
    baseStartPos[1],
    baseStartPos[2] + row * spacingZ,
  ];
}

export function createMultiMarbleArenaSimulation(
  initialCourse: CourseSpec,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): MultiMarbleArenaSimulation {
  let baseCourse = initialCourse;
  let effectiveCourse = initialCourse;
  let evaluator = createCpuWorldEvaluator(effectiveCourse);
  let lastMutationSignature = '';

  interface InternalRacerEntry {
    playerId: string;
    handle: string;
    slotIndex: number;
    colorHex: string;
    sim: MarbleSimulation;
  }

  const racers = new Map<string, InternalRacerEntry>();

  function spawnRacerEntry(
    playerId: string,
    handle: string,
    slotIndex: number,
    colorHex?: string,
  ): InternalRacerEntry {
    const clampedSlot = Math.max(0, Math.min(MAX_ARENA_RACERS - 1, slotIndex));
    const palette = PARTY_MARBLE_PALETTES[clampedSlot % PARTY_MARBLE_PALETTES.length];
    const spawnPos = getArenaSlotSpawnPosition(
      effectiveCourse.startPos,
      clampedSlot,
      config.marbleRadius,
    );
    const slotCourse: CourseSpec = {
      ...effectiveCourse,
      startPos: spawnPos,
    };
    const sim = createMarbleSimulation(slotCourse, evaluator, config);
    const initial = createInitialMarbleState(slotCourse, clampedSlot % 4, config);
    sim.setState({
      ...initial,
      position: spawnPos,
      prevPosition: spawnPos,
      respawnPos: spawnPos,
    });

    return {
      playerId,
      handle,
      slotIndex: clampedSlot,
      colorHex: colorHex ?? palette.hex,
      sim,
    };
  }

  function syncPlayersFromRoom(snapshot: PartyRoomSnapshot) {
    const mutSig = snapshot.activeMutations.map((m) => m.id).join(',');
    if (mutSig !== lastMutationSignature) {
      lastMutationSignature = mutSig;
      effectiveCourse = applyCrowdMutationsToCourse(
        baseCourse,
        snapshot.activeMutations,
      );
      evaluator = createCpuWorldEvaluator(effectiveCourse);
      for (const entry of racers.values()) {
        const curState = entry.sim.getState();
        entry.sim.setCourse(
          {
            ...effectiveCourse,
            startPos: getArenaSlotSpawnPosition(
              effectiveCourse.startPos,
              entry.slotIndex,
              config.marbleRadius,
            ),
          },
          evaluator,
        );
        entry.sim.setState(curState);
      }
    }

    const activeRacerRecords = snapshot.players
      .filter((p) => p.role === 'racer' && p.racerSlot !== null)
      .slice(0, MAX_ARENA_RACERS);

    const activeIds = new Set(activeRacerRecords.map((p) => p.playerId));
    for (const existingId of racers.keys()) {
      if (!activeIds.has(existingId)) {
        racers.delete(existingId);
      }
    }

    for (const rec of activeRacerRecords) {
      const existing = racers.get(rec.playerId);
      if (!existing) {
        racers.set(
          rec.playerId,
          spawnRacerEntry(
            rec.playerId,
            rec.handle,
            rec.racerSlot ?? 0,
            rec.colorHex,
          ),
        );
      } else {
        existing.handle = rec.handle;
        existing.colorHex = rec.colorHex;
      }
    }
  }

  function setCourse(nextCourse: CourseSpec) {
    baseCourse = nextCourse;
    effectiveCourse = nextCourse;
    lastMutationSignature = '';
    evaluator = createCpuWorldEvaluator(effectiveCourse);
    for (const entry of racers.values()) {
      const spawnPos = getArenaSlotSpawnPosition(
        effectiveCourse.startPos,
        entry.slotIndex,
        config.marbleRadius,
      );
      entry.sim.setCourse(
        {
          ...effectiveCourse,
          startPos: spawnPos,
        },
        evaluator,
      );
    }
  }

  function stepFixed(
    dt: number,
    inputsByPlayerId: ReadonlyMap<string, InputCommand>,
    simTime: number,
  ) {
    const ordered = Array.from(racers.values()).sort(
      (a, b) => a.slotIndex - b.slotIndex,
    );

    const steppedStates: MarbleState[] = ordered.map((entry) => {
      const cmd = inputsByPlayerId.get(entry.playerId) ?? {
        moveXZ: [0, 0],
        jumpPressed: false,
        respawnPressed: false,
      };
      return entry.sim.stepFixed(dt, cmd, simTime);
    });

    const { states: resolvedStates, collisions } =
      resolveMarbleCollisions(steppedStates);

    const enrichedCollisions: MarbleCollisionEvent[] = collisions.map((c) => ({
      ...c,
      idA: ordered[c.indexA]?.playerId,
      idB: ordered[c.indexB]?.playerId,
    }));

    const marbles: ArenaMarbleSlot[] = ordered.map((entry, idx) => {
      const nextState = resolvedStates[idx];
      entry.sim.setState(nextState);
      return {
        playerId: entry.playerId,
        handle: entry.handle,
        slotIndex: entry.slotIndex,
        colorHex: entry.colorHex,
        state: nextState,
      };
    });

    return {
      marbles,
      collisions: enrichedCollisions,
    };
  }

  function getMarbles(): readonly ArenaMarbleSlot[] {
    return Array.from(racers.values())
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((entry) => ({
        playerId: entry.playerId,
        handle: entry.handle,
        slotIndex: entry.slotIndex,
        colorHex: entry.colorHex,
        state: entry.sim.getState(),
      }));
  }

  return {
    syncPlayersFromRoom,
    setCourse,
    stepFixed,
    getMarbles,
    getEvaluator: () => evaluator,
    getEffectiveCourse: () => effectiveCourse,
  };
}
