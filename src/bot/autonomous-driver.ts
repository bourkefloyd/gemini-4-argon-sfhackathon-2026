/**
 * 120 Hz SDF Look-Ahead Autonomous Driver (`src/bot/autonomous-driver.ts`)
 *
 * Steers the marble at 120 Hz like an expert trackball player using:
 * - Course waypoint/checkpoint look-ahead synthesized from `CourseSpec`
 * - 7-ray SDF fan probing (`-60°..+60°`) via `CpuWorldEvaluator` to avoid
 *   abyss drop-offs (`d > 0.4` below floor) and corrosive acid pools (`material === 'acid'`)
 * - Counter-spin braking (`backspin`) when approaching sharp turns or ledges at excessive speed
 * - Precision `jump` (`hop`) triggering over narrow gaps, acid moats, and onto bounce shortcuts
 * - Three distinct playstyles: `'tourist' | 'speedrunner' | 'chaos-explorer'`
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  MATERIAL_PROPERTIES,
  type MarbleState,
  type PhysicsConfig,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import { evaluateKinematicMotion } from '../sdf/eval-cpu';

export type BotPlayStyle = 'tourist' | 'speedrunner' | 'chaos-explorer';

export type BotJumpReason =
  | 'none'
  | 'narrow-gap'
  | 'acid-moat'
  | 'bounce-shortcut'
  | 'chaos-hop'
  | 'unstuck';

/**
 * The 7 canonical fan probe angles in degrees (`-60°..+60°`).
 */
export const FAN_PROBE_ANGLES_DEG: readonly number[] = [
  -60, -40, -20, 0, 20, 40, 60,
] as const;

export interface BotFanRayProbe {
  /** Angle offset in degrees relative to the target heading (`-60..+60`) */
  readonly angleDeg: number;
  /** World-space unit direction in XZ `[dx, dz]` */
  readonly directionXZ: readonly [number, number];
  /** Primary floor probe world point */
  readonly probePoint: Vec3;
  /** Signed distance to the nearest floor surface below the look-ahead point */
  readonly floorDistance: number;
  /** Signed distance to obstacles at marble waist height along the ray */
  readonly wallDistance: number;
  /** Surface material sampled below the look-ahead ray */
  readonly material: SurfaceMaterial;
  /** True when the floor drops away (`floorDistance > 0.4`) */
  readonly isAbyssDropOff: boolean;
  /** True when the probe detects `material === 'acid'` */
  readonly isAcidHazard: boolean;
  /** True when the probe detects `material === 'bounce'` */
  readonly isBouncePad: boolean;
  /** True when the probe detects a bumper/piston/steelie obstacle */
  readonly isBumperHazard: boolean;
  /** True when a near drop-off/acid moat has solid landing ground farther along the ray */
  readonly hasGapJumpLanding: boolean;
  /** Composite utility score used to pick the safest/fastest steering ray */
  readonly score: number;
}

export interface BotWaypoint {
  readonly id: string;
  readonly label: string;
  readonly position: Vec3;
  readonly captureRadius: number;
  readonly targetSpeed: number;
  readonly sharpTurnAhead: boolean;
  readonly turnAngleDeg: number;
  readonly jumpHint?: boolean;
  readonly jumpDirectionXZ?: readonly [number, number];
  readonly routeKind: 'main' | 'shortcut';
}

export interface BotDecisionTelemetry {
  readonly style: BotPlayStyle;
  readonly activeWaypointIndex: number;
  readonly activeWaypoint: BotWaypoint;
  readonly nextWaypoint: BotWaypoint | null;
  readonly desiredHeadingXZ: readonly [number, number];
  readonly chosenRayAngleDeg: number;
  readonly backspinApplied: boolean;
  readonly backspinStrength: number;
  readonly jumpTriggered: boolean;
  readonly jumpReason: BotJumpReason;
  readonly fanProbes: readonly BotFanRayProbe[];
  readonly commands: InputCommand;
}

export interface AutonomousDriverOptions {
  readonly style?: BotPlayStyle;
  readonly seed?: number;
  readonly physicsConfig?: PhysicsConfig;
  readonly customWaypoints?: readonly BotWaypoint[];
}

export interface AutonomousDriver {
  getStyle(): BotPlayStyle;
  setStyle(style: BotPlayStyle): void;
  getWaypoints(): readonly BotWaypoint[];
  getActiveWaypointIndex(): number;
  getLastDecision(): BotDecisionTelemetry | null;
  reset(nextCourse?: CourseSpec, nextEvaluator?: CpuWorldEvaluator): void;
  computeInput(marble: MarbleState, simTime: number, dt?: number): InputCommand;
  stepDecision(marble: MarbleState, simTime: number, dt?: number): BotDecisionTelemetry;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function normalizeXZ(x: number, z: number): readonly [number, number] {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return [0, -1];
  return [x / len, z / len];
}

function rotateXZ(dir: readonly [number, number], angleDeg: number): readonly [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [dir[0] * c - dir[1] * s, dir[0] * s + dir[1] * c];
}

/**
 * Deterministic xorshift32 PRNG for reproducible `'chaos-explorer'` perturbations.
 */
function createSeededRng(seed: number): () => number {
  let state = (seed | 0) || 0x6d2b79f5;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

interface RawWaypointNode {
  id: string;
  label: string;
  position: Vec3;
  captureRadius: number;
  targetSpeed?: number;
  jumpHint?: boolean;
  jumpDirectionXZ?: readonly [number, number];
  routeKind?: 'main' | 'shortcut';
}

function finalizeWaypointChain(
  rawNodes: readonly RawWaypointNode[],
  style: BotPlayStyle,
): BotWaypoint[] {
  const speedScale =
    style === 'speedrunner' ? 1.22 : style === 'chaos-explorer' ? 1.1 : 0.96;

  return rawNodes.map((node, idx) => {
    const prev = idx > 0 ? rawNodes[idx - 1] : null;
    const next = idx + 1 < rawNodes.length ? rawNodes[idx + 1] : null;

    let turnAngleDeg = 0;
    if (prev && next) {
      const inVec = normalizeXZ(
        node.position[0] - prev.position[0],
        node.position[2] - prev.position[2],
      );
      const outVec = normalizeXZ(
        next.position[0] - node.position[0],
        next.position[2] - node.position[2],
      );
      const dot = clamp(inVec[0] * outVec[0] + inVec[1] * outVec[1], -1, 1);
      turnAngleDeg = Math.round((Math.acos(dot) * 180) / Math.PI);
    }

    const sharpTurnAhead = turnAngleDeg >= 36;
    const baseSpeed =
      node.targetSpeed ??
      (sharpTurnAhead
        ? turnAngleDeg >= 72
          ? 6.4
          : 8.6
        : 14.5);

    return {
      id: node.id,
      label: node.label,
      position: node.position,
      captureRadius: node.captureRadius,
      targetSpeed: baseSpeed * speedScale,
      sharpTurnAhead,
      turnAngleDeg,
      jumpHint: node.jumpHint,
      jumpDirectionXZ: node.jumpDirectionXZ,
      routeKind: node.routeKind ?? 'main',
    };
  });
}

/**
 * Synthesize high-precision waypoints for a `CourseSpec`.
 * Uses tailored racing lines on built-in courses and automatic primitive topology
 * extraction on arbitrary/Argon-generated courses.
 */
export function buildCourseWaypoints(
  course: CourseSpec,
  style: BotPlayStyle = 'tourist',
): BotWaypoint[] {
  if (course.id === 'practice-race') {
    const raw: RawWaypointNode[] = [
      {
        id: 'wp-start-lip',
        label: 'Start Podium South Lip',
        position: [0, 8.2, -2.6],
        captureRadius: 1.8,
        targetSpeed: 11.5,
      },
      {
        id: 'wp-ramp1-mid',
        label: 'Ramp 1 Downhill Chute',
        position: [0, 6.4, -8.4],
        captureRadius: 2.1,
        targetSpeed: 13.0,
      },
      {
        id: 'wp-ramp1-exit',
        label: 'Turn 1 Entry Brake Zone',
        position: [0.3, 4.6, -14.2],
        captureRadius: 2.0,
        targetSpeed: 7.2,
      },
      {
        id: 'wp-turn1-apex',
        label: 'Mid-Course Plaza Apex',
        position: [4.2, 4.6, -15.8],
        captureRadius: 2.1,
        targetSpeed: 8.5,
      },
      {
        id: 'wp-ramp2-entry',
        label: 'Banked Chute Entry',
        position: [9.4, 4.6, -16.8],
        captureRadius: 2.0,
        targetSpeed: 12.5,
      },
      {
        id: 'wp-ramp2-mid',
        label: 'Banked Chute Mid',
        position: [15.4, 2.8, -16.8],
        captureRadius: 2.2,
        targetSpeed: 13.5,
      },
      {
        id: 'wp-bridge-head-brake',
        label: 'Abyss Bridge Approach Turn',
        position: [23.6, 1.0, -16.8],
        captureRadius: 2.0,
        targetSpeed: 5.6,
      },
      {
        id: 'wp-bridge-entry',
        label: 'Narrow Abyss Bridge North',
        position: [24.6, 1.0, -20.6],
        captureRadius: 1.45,
        targetSpeed: 8.2,
      },
      {
        id: 'wp-bridge-mid',
        label: 'Narrow Abyss Bridge Span',
        position: [24.6, 1.0, -25.8],
        captureRadius: 1.45,
        targetSpeed: 9.8,
      },
      {
        id: 'wp-bridge-exit',
        label: 'Sticky Brake & Podium Entry',
        position: [24.6, 1.0, -30.4],
        captureRadius: 1.65,
        targetSpeed: 9.2,
      },
      {
        id: 'wp-goal',
        label: 'Practice Race Goal Pad',
        position: [...course.goalPos],
        captureRadius: course.goalRadius,
        targetSpeed: 10.5,
      },
    ];
    return finalizeWaypointChain(raw, style);
  }

  if (course.id === 'intermediate-madness') {
    const raw: RawWaypointNode[] = [
      {
        id: 'c2-wp-start-lip',
        label: 'Conveyor Ramp Entry',
        position: [0, 10.8, -2.8],
        captureRadius: 1.8,
        targetSpeed: 11.5,
      },
      {
        id: 'c2-wp-conveyor-exit',
        label: 'Ice Slick Plaza North',
        position: [1.4, 6.8, -11.4],
        captureRadius: 2.2,
        targetSpeed: 8.5,
      },
      {
        id: 'c2-wp-ice-east-corridor',
        label: 'Ice Plaza Safe East Corridor',
        position: [3.9, 6.8, -15.2],
        captureRadius: 2.0,
        targetSpeed: 7.4,
      },
      {
        id: 'c2-wp-piston-east-entry',
        label: 'Piston Gauntlet East Lane Entry',
        position: [3.8, 6.8, -18.8],
        captureRadius: 1.85,
        targetSpeed: 7.2,
      },
      {
        id: 'c2-wp-piston-east-chute',
        label: 'Piston Gauntlet Brake Zone',
        position: [3.8, 4.9, -23.2],
        captureRadius: 2.1,
        targetSpeed: 5.2,
      },
      {
        id: 'c2-wp-piston-landing',
        label: 'Piston Landing Turn',
        position: [6.8, 3.8, -26.2],
        captureRadius: 2.2,
        targetSpeed: 7.5,
      },
      {
        id: 'c2-wp-wave-west',
        label: 'Wave Floor West',
        position: [11.2, 3.8, -26.6],
        captureRadius: 2.2,
        targetSpeed: 10.2,
      },
      {
        id: 'c2-wp-wave-east',
        label: 'Wave Floor East',
        position: [15.4, 3.8, -26.0],
        captureRadius: 2.1,
        targetSpeed: 9.2,
      },
      {
        id: 'c2-wp-acid-runup',
        label: 'Acid Moat North Run-Up',
        position: [21.4, 3.8, -24.8],
        captureRadius: 1.75,
        targetSpeed: 5.5,
      },
      {
        id: 'c2-wp-acid-jump-lip',
        label: 'Acid Moat Launch Lip',
        position: [21.8, 3.8, -29.2],
        captureRadius: 1.15,
        targetSpeed: 13.5,
        jumpHint: true,
        jumpDirectionXZ: [0.04, -1.0],
        routeKind: style === 'speedrunner' ? 'shortcut' : 'main',
      },
      {
        id: 'c2-wp-goal-landing',
        label: 'Goal Podium North Deck',
        position: [22.0, 2.2, -35.2],
        captureRadius: 2.3,
        targetSpeed: 9.5,
      },
      {
        id: 'c2-wp-goal',
        label: 'Intermediate Madness Goal Pad',
        position: [...course.goalPos],
        captureRadius: course.goalRadius,
        targetSpeed: 10.0,
      },
    ];
    return finalizeWaypointChain(raw, style);
  }

  // General procedural waypoint synthesis from `course.nodes` + `course.checkpoints` + `course.goalPos`
  const synthesized: RawWaypointNode[] = [];

  for (let i = 0; i < course.nodes.length; i++) {
    const node = course.nodes[i];
    if (node.material === 'acid' || node.material === 'bumper') continue;

    if (node.kind === 'ramp') {
      const halfL = node.halfLength * 0.78;
      if (node.axis === 'z') {
        const dirZ = node.rise >= 0 ? -1 : 1;
        synthesized.push({
          id: `${node.id ?? `ramp-${i}`}-entry`,
          label: `${node.id ?? 'Ramp'} Entry`,
          position: [
            node.center[0],
            node.center[1] + Math.abs(node.rise) * 0.45,
            node.center[2] - dirZ * halfL,
          ],
          captureRadius: Math.max(1.5, node.halfWidth * 0.65),
          targetSpeed: 9.0,
        });
        synthesized.push({
          id: `${node.id ?? `ramp-${i}`}-exit`,
          label: `${node.id ?? 'Ramp'} Exit`,
          position: [
            node.center[0],
            node.center[1] - Math.abs(node.rise) * 0.45,
            node.center[2] + dirZ * halfL,
          ],
          captureRadius: Math.max(1.5, node.halfWidth * 0.65),
          targetSpeed: 7.5,
        });
      } else {
        const dirX = node.rise >= 0 ? -1 : 1;
        synthesized.push({
          id: `${node.id ?? `ramp-${i}`}-entry`,
          label: `${node.id ?? 'Ramp'} Entry`,
          position: [
            node.center[0] - dirX * halfL,
            node.center[1] + Math.abs(node.rise) * 0.45,
            node.center[2],
          ],
          captureRadius: Math.max(1.5, node.halfWidth * 0.65),
          targetSpeed: 9.0,
        });
        synthesized.push({
          id: `${node.id ?? `ramp-${i}`}-exit`,
          label: `${node.id ?? 'Ramp'} Exit`,
          position: [
            node.center[0] + dirX * halfL,
            node.center[1] - Math.abs(node.rise) * 0.45,
            node.center[2],
          ],
          captureRadius: Math.max(1.5, node.halfWidth * 0.65),
          targetSpeed: 7.5,
        });
      }
    } else if (node.kind === 'sweptTrack') {
      synthesized.push({
        id: `${node.id ?? `swept-${i}`}-start`,
        label: `${node.id ?? 'Track'} Start`,
        position: [
          node.center[0] + node.start[0],
          node.center[1] + node.start[1],
          node.center[2] + node.start[2],
        ],
        captureRadius: Math.max(1.4, node.halfWidth * 0.75),
        targetSpeed: 10.5,
      });
      synthesized.push({
        id: `${node.id ?? `swept-${i}`}-end`,
        label: `${node.id ?? 'Track'} End`,
        position: [
          node.center[0] + node.end[0],
          node.center[1] + node.end[1],
          node.center[2] + node.end[2],
        ],
        captureRadius: Math.max(1.4, node.halfWidth * 0.75),
        targetSpeed: 9.0,
      });
    } else if (
      node.kind === 'roundedBox' ||
      node.kind === 'box' ||
      node.kind === 'waveFloor'
    ) {
      const hx = node.halfExtents[0];
      const hy = node.halfExtents[1];
      const hz = node.halfExtents[2];
      // Skip thin walls or deep structural pillars
      if (Math.min(hx, hz) < 0.75 || hy > 2.2) continue;
      const distFromStart = Math.hypot(
        node.center[0] - course.startPos[0],
        node.center[2] - course.startPos[2],
      );
      if (distFromStart < 1.2) continue;

      synthesized.push({
        id: node.id ?? `deck-${i}`,
        label: node.id ?? `Deck ${i + 1}`,
        position: [node.center[0], node.center[1] + hy, node.center[2]],
        captureRadius: clamp(Math.min(hx, hz) * 0.55, 1.5, 2.5),
        targetSpeed: node.material === 'ice' ? 7.2 : 9.5,
      });
    }
  }

  synthesized.push({
    id: `${course.id}-goal`,
    label: `${course.name} Goal Pad`,
    position: [...course.goalPos],
    captureRadius: course.goalRadius,
    targetSpeed: 10.0,
  });

  return finalizeWaypointChain(synthesized, style);
}

/**
 * Create a 120 Hz SDF Look-Ahead Autonomous Driver for a `CourseSpec`.
 */
export function createAutonomousDriver(
  initialCourse: CourseSpec,
  initialEvaluator: CpuWorldEvaluator,
  options: AutonomousDriverOptions = {},
): AutonomousDriver {
  let course = initialCourse;
  let evaluator = initialEvaluator;
  let style: BotPlayStyle = options.style ?? 'tourist';
  const physicsConfig = options.physicsConfig ?? DEFAULT_PHYSICS_CONFIG;
  const rng = createSeededRng(options.seed ?? 1337);

  let waypoints: BotWaypoint[] = options.customWaypoints
    ? [...options.customWaypoints]
    : buildCourseWaypoints(course, style);
  let activeWaypointIndex = 0;
  let lastDecision: BotDecisionTelemetry | null = null;
  let stuckTimer = 0;
  let lastProgressPos: Vec3 = [...course.startPos];
  let lastStatus: MarbleState['status'] = 'racing';

  function reset(nextCourse?: CourseSpec, nextEvaluator?: CpuWorldEvaluator) {
    if (nextCourse) course = nextCourse;
    if (nextEvaluator) evaluator = nextEvaluator;
    waypoints = options.customWaypoints
      ? [...options.customWaypoints]
      : buildCourseWaypoints(course, style);
    activeWaypointIndex = 0;
    lastDecision = null;
    stuckTimer = 0;
    lastProgressPos = [...course.startPos];
    lastStatus = 'racing';
  }

  function findNearestWaypointIndex(pos: Vec3): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const d = Math.hypot(
        pos[0] - wp.position[0],
        (pos[1] - wp.position[1]) * 1.4,
        pos[2] - wp.position[2],
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  function syncWaypointToPosition(pos: Vec3) {
    // Handle teleports or large jumps ahead by snapping to the closest forward waypoint
    const activeWp = waypoints[activeWaypointIndex];
    if (activeWp) {
      const distActive = Math.hypot(
        pos[0] - activeWp.position[0],
        pos[2] - activeWp.position[2],
      );
      if (distActive > 18.0) {
        const nearestIdx = findNearestWaypointIndex(pos);
        const nearestWp = waypoints[nearestIdx];
        const distNearest = Math.hypot(
          pos[0] - nearestWp.position[0],
          pos[2] - nearestWp.position[2],
        );
        if (nearestIdx > activeWaypointIndex && distNearest < 3.6) {
          activeWaypointIndex = nearestIdx;
        }
      }
    }

    // Advance through captured waypoints
    while (activeWaypointIndex < waypoints.length - 1) {
      const wp = waypoints[activeWaypointIndex];
      const dXZ = Math.hypot(pos[0] - wp.position[0], pos[2] - wp.position[2]);
      const dY = Math.abs(pos[1] - wp.position[1]);
      if (dXZ <= wp.captureRadius && dY <= 3.5) {
        activeWaypointIndex++;
      } else {
        break;
      }
    }
  }

  /**
   * Probe the SDF ahead along 7 fan rays (`-60°..+60°`) around `desiredHeadingXZ`.
   */
  function probeFanRays(
    marble: MarbleState,
    desiredHeadingXZ: readonly [number, number],
    simTime: number,
  ): readonly BotFanRayProbe[] {
    const pos = marble.position;
    const r = marble.radius;
    const horizSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);
    const lookDist = clamp(1.55 + horizSpeed * 0.16, 1.65, 3.6);
    const n = marble.contact.normal;

    return FAN_PROBE_ANGLES_DEG.map((angleDeg) => {
      const dirXZ = rotateXZ(desiredHeadingXZ, angleDeg);
      const [dx, dz] = dirXZ;

      // Project local slope along ray direction so downhill ramps are not mistaken for abyss drops
      const slopeTan =
        marble.contact.grounded && n[1] > 0.42
          ? clamp(-(n[0] * dx + n[2] * dz) / n[1], -0.85, 0.55)
          : -0.25;

      const px = pos[0] + dx * lookDist;
      const pz = pos[2] + dz * lookDist;
      const expectedFloorY = pos[1] - r + slopeTan * lookDist;

      // Sample at expected floor height and along a continuous downhill ramp envelope (-0.65m, -1.25m)
      const sAtExpected = evaluator.sample([px, expectedFloorY, pz], simTime);
      const sRampMid = evaluator.sample([px, expectedFloorY - 0.65, pz], simTime);
      const sRampSteep = evaluator.sample([px, expectedFloorY - 1.25, pz], simTime);

      const midPx = pos[0] + dx * (lookDist * 0.55);
      const midPz = pos[2] + dz * (lookDist * 0.55);
      const sMidExpected = evaluator.sample(
        [midPx, pos[1] - r + slopeTan * lookDist * 0.55, midPz],
        simTime,
      );

      let bestFloorSample =
        sAtExpected.distance <= sRampMid.distance ? sAtExpected : sRampMid;
      if (
        sRampSteep.distance < bestFloorSample.distance &&
        sRampSteep.material !== 'acid'
      ) {
        bestFloorSample = sRampSteep;
      }
      const floorDistance = bestFloorSample.distance;

      // Deep basin check for acid moats below ledges
      const sDeepBasin = evaluator.sample([px, expectedFloorY - 2.8, pz], simTime);
      const sMidDeepBasin = evaluator.sample(
        [midPx, expectedFloorY - 2.8, midPz],
        simTime,
      );

      // Waist-level obstacle / bumper / wall check
      const sWall = evaluator.sample([midPx, pos[1] + 0.12, midPz], simTime);

      const isAbyssDropOff = floorDistance > 0.4;
      const isAcidHazard =
        bestFloorSample.material === 'acid' ||
        sMidExpected.material === 'acid' ||
        (Math.min(sAtExpected.distance, sRampMid.distance) > 0.4 &&
          ((sDeepBasin.material === 'acid' && sDeepBasin.distance < 1.8) ||
            (sMidDeepBasin.material === 'acid' && sMidDeepBasin.distance < 1.8)));
      const isBouncePad =
        bestFloorSample.material === 'bounce' || sMidExpected.material === 'bounce';
      const isBumperHazard =
        (sWall.distance < r * 1.15 && sWall.material === 'bumper') ||
        bestFloorSample.material === 'bumper';

      // Check if there is a jumpable landing platform farther along this ray (e.g. across an acid moat or narrow gap)
      let hasGapJumpLanding = false;
      if (isAbyssDropOff || isAcidHazard) {
        for (const jumpDist of [4.8, 6.4, 8.2]) {
          const jx = pos[0] + dx * jumpDist;
          const jz = pos[2] + dz * jumpDist;
          for (const dropY of [0.0, -1.0, -1.65, -2.2]) {
            const sLand = evaluator.sample([jx, pos[1] - r + dropY, jz], simTime);
            if (
              sLand.distance <= 0.38 &&
              sLand.material !== 'acid' &&
              sLand.material !== 'bumper'
            ) {
              hasGapJumpLanding = true;
              break;
            }
          }
          if (hasGapJumpLanding) break;
        }
      }

      // Compute ray utility score based on active BotPlayStyle
      const alignPenalty =
        (Math.abs(angleDeg) / 60) * (style === 'speedrunner' ? 0.52 : 0.62);
      let score = 1.0 - alignPenalty;

      if (isAbyssDropOff) {
        if (hasGapJumpLanding && Math.abs(angleDeg) <= 20) {
          score -= style === 'tourist' ? 0.35 : 0.1;
        } else {
          score -= style === 'chaos-explorer' ? 1.35 : 2.8;
        }
      } else {
        score += clamp(0.4 - floorDistance, -0.2, 0.35);
      }

      if (isAcidHazard) {
        if (hasGapJumpLanding && Math.abs(angleDeg) <= 20) {
          score -= 0.15;
        } else {
          score -= style === 'chaos-explorer' ? 1.4 : 3.2;
        }
      }

      if (isBumperHazard) {
        score -= style === 'chaos-explorer' ? 0.25 : 1.65;
      }

      if (sWall.distance < r * 0.85) {
        score -= 1.25;
      }

      if (isBouncePad) {
        score += style === 'speedrunner' ? 0.45 : style === 'tourist' ? -0.25 : 0.3;
      }

      if (bestFloorSample.material === 'conveyor') {
        score += style === 'speedrunner' ? 0.35 : 0.15;
      }

      return {
        angleDeg,
        directionXZ: dirXZ,
        probePoint: [px, expectedFloorY, pz],
        floorDistance,
        wallDistance: sWall.distance,
        material: isAcidHazard ? 'acid' : bestFloorSample.material,
        isAbyssDropOff,
        isAcidHazard,
        isBouncePad,
        isBumperHazard,
        hasGapJumpLanding,
        score,
      };
    });
  }

  function stepDecision(
    marble: MarbleState,
    simTime: number,
    dt = physicsConfig.fixedDt,
  ): BotDecisionTelemetry {
    // Detect respawn transition and re-anchor waypoint index
    if (lastStatus !== 'racing' && marble.status === 'racing') {
      activeWaypointIndex = findNearestWaypointIndex(marble.position);
      stuckTimer = 0;
      lastProgressPos = [...marble.position];
    }
    lastStatus = marble.status;

    syncWaypointToPosition(marble.position);

    const activeWaypoint =
      waypoints[activeWaypointIndex] ?? waypoints[waypoints.length - 1];
    const nextWaypoint =
      activeWaypointIndex + 1 < waypoints.length
        ? waypoints[activeWaypointIndex + 1]
        : null;

    const pos = marble.position;
    const vel = marble.velocity;
    const horizSpeed = Math.hypot(vel[0], vel[2]);

    // Check progress for unstuck recovery
    const movedSinceProgress = Math.hypot(
      pos[0] - lastProgressPos[0],
      pos[2] - lastProgressPos[2],
    );
    if (movedSinceProgress > 0.65 || marble.status !== 'racing') {
      lastProgressPos = [...pos];
      stuckTimer = 0;
    } else {
      stuckTimer += dt;
    }

    // Desired heading toward active waypoint
    const toWpX = activeWaypoint.position[0] - pos[0];
    const toWpZ = activeWaypoint.position[2] - pos[2];
    const distToWp = Math.hypot(toWpX, toWpZ);
    let desiredHeadingXZ = normalizeXZ(toWpX, toWpZ);

    if (
      nextWaypoint &&
      distToWp < activeWaypoint.captureRadius * 1.35 &&
      !activeWaypoint.jumpHint
    ) {
      const toNext = normalizeXZ(
        nextWaypoint.position[0] - pos[0],
        nextWaypoint.position[2] - pos[2],
      );
      const blend = clamp(
        1.0 - distToWp / (activeWaypoint.captureRadius * 1.35),
        0,
        0.4,
      );
      desiredHeadingXZ = normalizeXZ(
        desiredHeadingXZ[0] * (1 - blend) + toNext[0] * blend,
        desiredHeadingXZ[1] * (1 - blend) + toNext[1] * blend,
      );
    }

    // 1. Evaluate 7-ray SDF fan probe (-60°..+60°)
    const fanProbes = probeFanRays(marble, desiredHeadingXZ, simTime);
    const centerProbe = fanProbes[3]; // 0° ray

    let chosenProbe = centerProbe;
    const centerHasHazard =
      (centerProbe.isAbyssDropOff &&
        !centerProbe.hasGapJumpLanding &&
        !activeWaypoint.jumpHint) ||
      (centerProbe.isAcidHazard &&
        !centerProbe.hasGapJumpLanding &&
        !activeWaypoint.jumpHint) ||
      centerProbe.isBumperHazard ||
      centerProbe.wallDistance < marble.radius * 0.85;

    if (centerHasHazard || style === 'chaos-explorer') {
      for (const probe of fanProbes) {
        if (probe.score > chosenProbe.score + 0.08) {
          chosenProbe = probe;
        }
      }
    }

    let steerDirXZ = chosenProbe.directionXZ;

    // Dynamic kinematic hazard avoidance (Steelies & slamming Pistons)
    for (const hazard of course.hazards) {
      if (!hazard.kinematic) continue;
      const { offset } = evaluateKinematicMotion(hazard.kinematic, simTime);
      const hx = hazard.center[0] + offset[0];
      const hy = hazard.center[1] + offset[1];
      const hz = hazard.center[2] + offset[2];

      const dxH = pos[0] - hx;
      const dzH = pos[2] - hz;
      const distXZ = Math.hypot(dxH, dzH);

      if (hazard.kinematic.kind === 'steelie' && distXZ < 3.4 && distXZ > 0.05) {
        const awayX = dxH / distXZ;
        const awayZ = dzH / distXZ;
        const evadeWeight =
          clamp((3.4 - distXZ) / 3.4, 0, 0.85) *
          (style === 'chaos-explorer' ? 0.25 : 1.0);
        steerDirXZ = normalizeXZ(
          steerDirXZ[0] + awayX * evadeWeight,
          steerDirXZ[1] + awayZ * evadeWeight,
        );
      } else if (hazard.kinematic.kind === 'piston' && distXZ < 3.2) {
        const headBottomY =
          hy - (hazard.kind === 'piston' ? hazard.headHalfExtents[1] : 0.65);
        if (headBottomY < pos[1] + 0.95 && style !== 'chaos-explorer') {
          const lateralOffset = pos[0] >= hx ? 1.0 : -1.0;
          steerDirXZ = normalizeXZ(
            steerDirXZ[0] + lateralOffset * 0.42,
            steerDirXZ[1],
          );
        }
      }
    }

    // Chaos-explorer edge/hazard stress-testing weave
    if (style === 'chaos-explorer') {
      const chaosWave =
        Math.sin(simTime * 5.2) * 0.34 + (rng() - 0.5) * 0.16;
      const perpX = -steerDirXZ[1];
      const perpZ = steerDirXZ[0];
      steerDirXZ = normalizeXZ(
        steerDirXZ[0] + perpX * chaosWave,
        steerDirXZ[1] + perpZ * chaosWave,
      );
    }

    // 2. Velocity decomposition & counter-spin backspin braking
    const surfVx = marble.contact.grounded ? marble.contact.surfaceVelocity[0] : 0;
    const surfVz = marble.contact.grounded ? marble.contact.surfaceVelocity[2] : 0;
    const relVx = vel[0] - surfVx;
    const relVz = vel[2] - surfVz;
    const relSpeed = Math.hypot(relVx, relVz);

    const forwardSpeed = relVx * steerDirXZ[0] + relVz * steerDirXZ[1];
    const lateralVelX = relVx - forwardSpeed * steerDirXZ[0];
    const lateralVelZ = relVz - forwardSpeed * steerDirXZ[1];

    const matProps =
      MATERIAL_PROPERTIES[marble.surfaceMaterial] ?? MATERIAL_PROPERTIES.standard;
    const isLowFriction = matProps.friction < 0.5;

    let effectiveTargetSpeed = activeWaypoint.targetSpeed;
    if (
      nextWaypoint &&
      activeWaypoint.sharpTurnAhead &&
      distToWp < (isLowFriction ? 5.8 : 4.2)
    ) {
      effectiveTargetSpeed = Math.min(
        effectiveTargetSpeed,
        isLowFriction ? 5.6 : 6.4,
      );
    }
    if (
      centerProbe.isAbyssDropOff &&
      !centerProbe.hasGapJumpLanding &&
      !activeWaypoint.jumpHint
    ) {
      effectiveTargetSpeed = Math.min(effectiveTargetSpeed, 4.5);
    }

    let backspinApplied = false;
    let backspinStrength = 0;
    let cmdX = 0;
    let cmdZ = 0;

    const speedExcess = relSpeed - effectiveTargetSpeed;
    const approachingSharpTurnTooFast =
      (activeWaypoint.sharpTurnAhead &&
        distToWp < (isLowFriction ? 5.8 : 4.4) &&
        speedExcess > 0.65) ||
      (centerProbe.isAbyssDropOff &&
        !centerProbe.hasGapJumpLanding &&
        !activeWaypoint.jumpHint &&
        relSpeed > 5.0);

    if (approachingSharpTurnTooFast && relSpeed > 0.5) {
      backspinApplied = true;
      backspinStrength = clamp(0.45 + speedExcess * 0.16, 0.45, 1.0);
      const brakeDirX = -relVx / relSpeed;
      const brakeDirZ = -relVz / relSpeed;
      cmdX =
        brakeDirX * backspinStrength +
        steerDirXZ[0] * (1 - backspinStrength * 0.55);
      cmdZ =
        brakeDirZ * backspinStrength +
        steerDirXZ[1] * (1 - backspinStrength * 0.55);
    } else {
      const lateralDampGain = isLowFriction ? 0.34 : 0.24;
      const speedGain =
        forwardSpeed < effectiveTargetSpeed
          ? 1.0
          : clamp(
              1.0 - (forwardSpeed - effectiveTargetSpeed) * 0.22,
              0.15,
              1.0,
            );

      cmdX = steerDirXZ[0] * speedGain - lateralVelX * lateralDampGain;
      cmdZ = steerDirXZ[1] * speedGain - lateralVelZ * lateralDampGain;
    }

    const cmdMag = Math.hypot(cmdX, cmdZ);
    if (cmdMag > 1.0) {
      cmdX /= cmdMag;
      cmdZ /= cmdMag;
    }

    // 3. Jump (`hop`) decision over narrow gaps, acid moats, or bounce shortcuts
    let jumpTriggered = false;
    let jumpReason: BotJumpReason = 'none';
    const canJump =
      (marble.contact.grounded || marble.coyoteTimer > 0.01) &&
      marble.jumpCooldown <= 0.01;

    if (canJump) {
      if (
        activeWaypoint.jumpHint &&
        distToWp <= activeWaypoint.captureRadius * 1.15 &&
        horizSpeed >= 6.8
      ) {
        jumpTriggered = true;
        jumpReason = centerProbe.isAcidHazard ? 'acid-moat' : 'narrow-gap';
        if (activeWaypoint.jumpDirectionXZ) {
          cmdX = activeWaypoint.jumpDirectionXZ[0];
          cmdZ = activeWaypoint.jumpDirectionXZ[1];
        }
      } else if (
        centerProbe.isAcidHazard &&
        centerProbe.hasGapJumpLanding &&
        horizSpeed >= 6.5
      ) {
        jumpTriggered = true;
        jumpReason = 'acid-moat';
      } else if (
        centerProbe.isAbyssDropOff &&
        centerProbe.hasGapJumpLanding &&
        horizSpeed >= 6.8
      ) {
        jumpTriggered = true;
        jumpReason = 'narrow-gap';
      } else if (
        style === 'speedrunner' &&
        (marble.surfaceMaterial === 'bounce' || centerProbe.isBouncePad) &&
        horizSpeed >= 5.0
      ) {
        jumpTriggered = true;
        jumpReason = 'bounce-shortcut';
      } else if (
        style === 'chaos-explorer' &&
        horizSpeed > 6.5 &&
        (marble.contact.normal[1] < 0.985 ||
          centerProbe.isAbyssDropOff ||
          centerProbe.isAcidHazard) &&
        Math.sin(simTime * 7.5) > 0.94
      ) {
        jumpTriggered = true;
        jumpReason = 'chaos-hop';
      } else if (
        stuckTimer > 1.25 &&
        (marble.contact.normal[1] < 0.985 ||
          centerProbe.isAbyssDropOff ||
          centerProbe.isAcidHazard)
      ) {
        jumpTriggered = true;
        jumpReason = 'unstuck';
        cmdX = desiredHeadingXZ[0];
        cmdZ = desiredHeadingXZ[1];
        stuckTimer = 0;
      }
    }

    const commands: InputCommand = {
      moveXZ: [cmdX, cmdZ],
      jumpPressed: jumpTriggered,
      respawnPressed: false,
    };

    const telemetry: BotDecisionTelemetry = {
      style,
      activeWaypointIndex,
      activeWaypoint,
      nextWaypoint,
      desiredHeadingXZ,
      chosenRayAngleDeg: chosenProbe.angleDeg,
      backspinApplied,
      backspinStrength,
      jumpTriggered,
      jumpReason,
      fanProbes,
      commands,
    };

    lastDecision = telemetry;
    return telemetry;
  }

  function computeInput(
    marble: MarbleState,
    simTime: number,
    dt = physicsConfig.fixedDt,
  ): InputCommand {
    return stepDecision(marble, simTime, dt).commands;
  }

  return {
    getStyle: () => style,
    setStyle: (nextStyle: BotPlayStyle) => {
      style = nextStyle;
      waypoints = options.customWaypoints
        ? [...options.customWaypoints]
        : buildCourseWaypoints(course, style);
      activeWaypointIndex = Math.min(activeWaypointIndex, waypoints.length - 1);
    },
    getWaypoints: () => waypoints,
    getActiveWaypointIndex: () => activeWaypointIndex,
    getLastDecision: () => lastDecision,
    reset,
    computeInput,
    stepDecision,
  };
}
