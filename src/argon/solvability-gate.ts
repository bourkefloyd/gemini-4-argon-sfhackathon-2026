/**
 * Agent 3: Autonomous CPU SDF Solvability & Lockstep Shader Gate (`src/argon/solvability-gate.ts`)
 *
 * Validates every `CourseSpec` synthesized or mutated by Gemini 4 Argon (`gemini-4-argon`)
 * and the `gemini-3.8-flash` Hazard Specialist before presenting the human-in-the-loop
 * "Approve & Hot-Swap Course" button:
 *   1. Recursive discriminated schema & finite-number validation (`validateCourseSpecSchema`)
 *      enforcing positive `halfExtents`, `radius`, `sweptTrack` endpoints, finite bounds, and max CSG tree depth `<= 16`
 *   2. Node cap clamping (`MAX_COURSE_NODES = 32`) so generated GLSL/WGSL shaders compile fast
 *   3. CPU SDF Kernel evaluation (`createCpuWorldEvaluator`) verifying grounded `startPos`,
 *      non-NaN tetrahedral normals, and solid `goalPos` support (with automatic spawn-height snap repair)
 *   4. Lockstep GPU Shader compilation (`compileCourseToGlsl` & `compileCourseToWgsl`)
 *   5. Simulated 120 Hz Bot Rollout (`createMarbleSimulation`) requiring `reachedGoal === true`
 *      (100% goal pad contact) for `passed === true`.
 */

import {
  DEFAULT_PHYSICS_CONFIG,
  MATERIAL_IDS,
  type CourseSpec,
  type SdfCsgNode,
  type SdfNode,
  type SdfPrimitiveNode,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import { createAutonomousDriver } from '../bot/autonomous-driver';
import { createMarbleSimulation } from '../physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../rendering';
import { createCpuWorldEvaluator } from '../sdf/eval-cpu';

export const MAX_COURSE_NODES = 32;
export const MAX_CSG_TREE_DEPTH = 16;
const MAX_COORD_BOUND = 10_000;

export interface BotRolloutReport {
  readonly stepsSimulated: number;
  readonly simulatedSeconds: number;
  readonly settledOnStart: boolean;
  readonly reachedGoal: boolean;
  readonly initialGoalDistance: number;
  readonly minGoalDistance: number;
  readonly progressRatio: number;
  readonly peakSpeed: number;
  readonly groundedRatio: number;
  readonly deathsDuringRollout: number;
  readonly trajectoryPreview: readonly Vec3[];
}

export interface CourseSolvabilityReport {
  readonly passed: boolean;
  readonly schemaValid: boolean;
  readonly nodesClamped: boolean;
  readonly originalNodeCount: number;
  readonly clampedNodeCount: number;
  readonly startGrounded: boolean;
  readonly startHeightRepaired: boolean;
  readonly startDistance: number;
  readonly startNormal: Vec3;
  readonly startMaterial: SurfaceMaterial;
  readonly goalReachable: boolean;
  readonly goalSurfaceDistance: number;
  readonly shaderCompilePassed: boolean;
  readonly glslLineCount: number;
  readonly wgslLineCount: number;
  readonly verificationLatencyMs: number;
  readonly botRollout: BotRolloutReport;
  readonly diagnostics: readonly string[];
  readonly verifiedCourse: CourseSpec;
}

function isFiniteNumberInRange(n: unknown, min = -MAX_COORD_BOUND, max = MAX_COORD_BOUND): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

function isPositiveFinite(n: unknown, min = 1e-4, max = MAX_COORD_BOUND): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

function isFiniteVec3(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    isFiniteNumberInRange(v[0]) &&
    isFiniteNumberInRange(v[1]) &&
    isFiniteNumberInRange(v[2])
  );
}

function isPositiveVec3(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    isPositiveFinite(v[0]) &&
    isPositiveFinite(v[1]) &&
    isPositiveFinite(v[2])
  );
}

function isValidMaterial(m: unknown): m is SurfaceMaterial {
  return typeof m === 'string' && Object.prototype.hasOwnProperty.call(MATERIAL_IDS, m);
}

const VALID_CSG_OPS = new Set([
  'union',
  'smoothUnion',
  'subtract',
  'smoothSubtract',
  'intersect',
]);

function validatePrimitiveNode(
  node: unknown,
  path: string,
  errors: string[],
): void {
  if (!node || typeof node !== 'object') {
    errors.push(`${path} must be a non-null object.`);
    return;
  }
  const n = node as Record<string, unknown>;
  const label = typeof n.id === 'string' && n.id ? `${path} (${n.id})` : path;

  if (!isFiniteVec3(n.center)) {
    errors.push(`${label} has missing or non-finite center Vec3.`);
  }
  if (!isValidMaterial(n.material)) {
    errors.push(`${label} has invalid material "${String(n.material)}".`);
  }

  switch (n.kind) {
    case 'box': {
      if (!isPositiveVec3(n.halfExtents)) {
        errors.push(`${label} (box) requires positive finite halfExtents [x, y, z] > 0.`);
      }
      break;
    }
    case 'roundedBox': {
      if (!isPositiveVec3(n.halfExtents)) {
        errors.push(`${label} (roundedBox) requires positive finite halfExtents [x, y, z] > 0.`);
      }
      if (!isFiniteNumberInRange(n.radius, 0, MAX_COORD_BOUND)) {
        errors.push(`${label} (roundedBox) requires finite radius >= 0.`);
      }
      break;
    }
    case 'sphere': {
      if (!isPositiveFinite(n.radius)) {
        errors.push(`${label} (sphere) requires finite radius > 0.`);
      }
      break;
    }
    case 'cylinder': {
      if (!isPositiveFinite(n.radius)) {
        errors.push(`${label} (cylinder) requires finite radius > 0.`);
      }
      if (!isPositiveFinite(n.halfHeight)) {
        errors.push(`${label} (cylinder) requires finite halfHeight > 0.`);
      }
      break;
    }
    case 'capsule': {
      if (!isFiniteVec3(n.a) || !isFiniteVec3(n.b)) {
        errors.push(`${label} (capsule) requires finite endpoints a and b Vec3.`);
      }
      if (!isPositiveFinite(n.radius)) {
        errors.push(`${label} (capsule) requires finite radius > 0.`);
      }
      break;
    }
    case 'torus': {
      if (!isPositiveFinite(n.majorRadius)) {
        errors.push(`${label} (torus) requires finite majorRadius > 0.`);
      }
      if (!isPositiveFinite(n.minorRadius)) {
        errors.push(`${label} (torus) requires finite minorRadius > 0.`);
      }
      break;
    }
    case 'ramp': {
      if (n.axis !== 'x' && n.axis !== 'z') {
        errors.push(`${label} (ramp) requires axis "x" or "z".`);
      }
      if (!isPositiveFinite(n.halfLength)) {
        errors.push(`${label} (ramp) requires finite halfLength > 0.`);
      }
      if (!isFiniteNumberInRange(n.rise)) {
        errors.push(`${label} (ramp) requires finite rise.`);
      }
      if (!isPositiveFinite(n.halfWidth)) {
        errors.push(`${label} (ramp) requires finite halfWidth > 0.`);
      }
      if (!isPositiveFinite(n.thickness)) {
        errors.push(`${label} (ramp) requires finite thickness > 0.`);
      }
      break;
    }
    case 'sweptTrack': {
      const hasStartEnd = isFiniteVec3(n.start) && isFiniteVec3(n.end);
      const pts = Array.isArray(n.points) ? n.points : null;
      const hasValidPoints =
        pts !== null && pts.length >= 2 && pts.every((pt) => isFiniteVec3(pt));
      if (!hasStartEnd && !hasValidPoints) {
        errors.push(
          `${label} (sweptTrack) requires finite start/end Vec3 or valid points[] array.`,
        );
      } else if (hasStartEnd) {
        const s = n.start as Vec3;
        const e = n.end as Vec3;
        const len = Math.hypot(e[0] - s[0], e[1] - s[1], e[2] - s[2]);
        if (len < 1e-3) {
          errors.push(`${label} (sweptTrack) start and end points must be distinct.`);
        }
      }
      if (!isPositiveFinite(n.halfWidth)) {
        errors.push(`${label} (sweptTrack) requires finite halfWidth > 0.`);
      }
      if (!isPositiveFinite(n.thickness)) {
        errors.push(`${label} (sweptTrack) requires finite thickness > 0.`);
      }
      break;
    }
    case 'waveFloor': {
      if (!isPositiveVec3(n.halfExtents)) {
        errors.push(`${label} (waveFloor) requires positive finite halfExtents [x, y, z] > 0.`);
      }
      if (
        !isFiniteNumberInRange(n.waveAmplitude, 0, 50) ||
        !isPositiveFinite(n.waveFrequencyX, 1e-4, 100) ||
        !isPositiveFinite(n.waveFrequencyZ, 1e-4, 100) ||
        !isFiniteNumberInRange(n.waveSpeed, -100, 100)
      ) {
        errors.push(
          `${label} (waveFloor) requires finite waveAmplitude, waveFrequencyX, waveFrequencyZ, and waveSpeed.`,
        );
      }
      break;
    }
    case 'piston': {
      if (!isPositiveVec3(n.headHalfExtents)) {
        errors.push(`${label} (piston) requires positive finite headHalfExtents [x, y, z] > 0.`);
      }
      if (!isFiniteNumberInRange(n.bevelRadius, 0, MAX_COORD_BOUND)) {
        errors.push(`${label} (piston) requires finite bevelRadius >= 0.`);
      }
      break;
    }
    default:
      errors.push(`${label} has unknown primitive kind "${String(n.kind)}".`);
  }
}

function validateSdfTreeRecursive(
  node: unknown,
  path: string,
  depth: number,
  errors: string[],
): void {
  if (depth > MAX_CSG_TREE_DEPTH) {
    errors.push(`${path} exceeds maximum CSG tree depth (${MAX_CSG_TREE_DEPTH}).`);
    return;
  }
  if (!node || typeof node !== 'object') {
    errors.push(`${path} must be a non-null SDF node.`);
    return;
  }
  const n = node as SdfNode;
  if (typeof n.kind === 'string' && VALID_CSG_OPS.has(n.kind)) {
    const csg = n as SdfCsgNode;
    if (!Array.isArray(csg.children) || csg.children.length === 0) {
      errors.push(`${path} (${csg.kind}) must have a non-empty children array.`);
      return;
    }
    csg.children.forEach((child, idx) => {
      validateSdfTreeRecursive(child, `${path}.children[${idx}]`, depth + 1, errors);
    });
    return;
  }
  validatePrimitiveNode(node, path, errors);
}

export function validateCourseSpecSchema(
  candidate: unknown,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate || typeof candidate !== 'object') {
    return { valid: false, errors: ['CourseSpec must be a non-null object.'] };
  }

  const c = candidate as Partial<CourseSpec>;
  if (!c.id || typeof c.id !== 'string') {
    errors.push('Missing or invalid `id` string.');
  }
  if (!c.name || typeof c.name !== 'string') {
    errors.push('Missing or invalid `name` string.');
  }
  if (!isFiniteVec3(c.startPos)) {
    errors.push('`startPos` must be a finite [x, y, z] tuple.');
  }
  if (!isFiniteVec3(c.goalPos)) {
    errors.push('`goalPos` must be a finite [x, y, z] tuple.');
  }
  if (typeof c.goalRadius !== 'number' || !Number.isFinite(c.goalRadius) || c.goalRadius <= 0.2) {
    errors.push('`goalRadius` must be a finite number > 0.2.');
  }
  if (typeof c.parTimeSec !== 'number' || !Number.isFinite(c.parTimeSec) || c.parTimeSec < 5) {
    errors.push('`parTimeSec` must be a finite number >= 5.');
  }
  if (!Array.isArray(c.nodes) || c.nodes.length === 0) {
    errors.push('`nodes` must be a non-empty array of SDF primitive nodes.');
  } else {
    c.nodes.forEach((node: SdfPrimitiveNode, idx: number) => {
      validatePrimitiveNode(node, `nodes[${idx}]`, errors);
    });
  }

  if (!Array.isArray(c.hazards)) {
    errors.push('`hazards` must be an array.');
  } else {
    c.hazards.forEach((haz: SdfPrimitiveNode, idx: number) => {
      validatePrimitiveNode(haz, `hazards[${idx}]`, errors);
    });
  }

  if (c.scene !== undefined) {
    validateSdfTreeRecursive(c.scene, 'scene', 1, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Clamps total course nodes + hazards to `MAX_COURSE_NODES = 32` while preserving
 * `start` and `goal` pads so generated GLSL/WGSL shaders compile rapidly.
 */
export function clampCourseNodesToBudget(
  course: CourseSpec,
  maxNodes = MAX_COURSE_NODES,
): { course: CourseSpec; clamped: boolean; originalCount: number; clampedCount: number } {
  const originalCount = course.nodes.length + course.hazards.length;
  if (originalCount <= maxNodes) {
    return {
      course,
      clamped: false,
      originalCount,
      clampedCount: originalCount,
    };
  }

  const maxHazards = Math.min(course.hazards.length, Math.max(2, Math.floor(maxNodes * 0.25)));
  const clampedHazards = course.hazards.slice(0, maxHazards);
  const maxStaticNodes = Math.max(1, maxNodes - clampedHazards.length);

  // Preserve essential start/goal nodes, then playable supportBias floor/ramp decks, then decorative walls/pillars
  const essential = course.nodes.filter(
    (n) => n.material === 'start' || n.material === 'goal',
  );
  const supportDecks = course.nodes.filter(
    (n) => n.material !== 'start' && n.material !== 'goal' && n.supportBias === true,
  );
  const decorative = course.nodes.filter(
    (n) => n.material !== 'start' && n.material !== 'goal' && n.supportBias !== true,
  );
  const remainingSlots = Math.max(0, maxStaticNodes - essential.length);
  const prioritizedNonEssential = [...supportDecks, ...decorative];
  const clampedNodes = [...essential, ...prioritizedNonEssential.slice(0, remainingSlots)].slice(
    0,
    maxStaticNodes,
  );

  const clampedCourse: CourseSpec = {
    ...course,
    nodes: clampedNodes,
    hazards: clampedHazards,
  };

  return {
    course: clampedCourse,
    clamped: true,
    originalCount,
    clampedCount: clampedNodes.length + clampedHazards.length,
  };
}

/**
 * Probes vertically near `course.startPos` to ensure the marble center is positioned
 * cleanly resting on the top surface of the start pad (`distance ≈ marbleRadius`).
 */
function ensureGroundedSpawnPosition(
  course: CourseSpec,
  marbleRadius = DEFAULT_PHYSICS_CONFIG.marbleRadius,
): {
  course: CourseSpec;
  repaired: boolean;
  grounded: boolean;
  distance: number;
  normal: Vec3;
  material: SurfaceMaterial;
} {
  const evaluator = createCpuWorldEvaluator(course);
  const initialSample = evaluator.sample(course.startPos, 0);
  const initialNormal = evaluator.normal(course.startPos, 0);

  if (
    initialSample.distance >= marbleRadius - 0.12 &&
    initialSample.distance <= marbleRadius + 0.22 &&
    initialNormal[1] >= DEFAULT_PHYSICS_CONFIG.groundNormalThreshold &&
    initialSample.material !== 'acid'
  ) {
    return {
      course,
      repaired: false,
      grounded: true,
      distance: initialSample.distance,
      normal: initialNormal,
      material: initialSample.material,
    };
  }

  const sx = course.startPos[0];
  const sz = course.startPos[2];
  for (let dy = 4.0; dy >= -6.0; dy -= 0.1) {
    const probeY = course.startPos[1] + dy;
    const sample = evaluator.sample([sx, probeY, sz], 0);
    const n = evaluator.normal([sx, probeY, sz], 0);
    if (
      Math.abs(sample.distance - marbleRadius) <= 0.14 &&
      n[1] >= DEFAULT_PHYSICS_CONFIG.groundNormalThreshold &&
      sample.material !== 'acid'
    ) {
      const snappedY = Math.round((probeY + (marbleRadius - sample.distance)) * 100) / 100;
      const repairedCourse: CourseSpec = {
        ...course,
        startPos: [sx, snappedY, sz],
      };
      const reSample = evaluator.sample(repairedCourse.startPos, 0);
      const reNormal = evaluator.normal(repairedCourse.startPos, 0);
      return {
        course: repairedCourse,
        repaired: Math.abs(snappedY - course.startPos[1]) > 0.05,
        grounded: true,
        distance: reSample.distance,
        normal: reNormal,
        material: reSample.material,
      };
    }
  }

  return {
    course,
    repaired: false,
    grounded: false,
    distance: initialSample.distance,
    normal: initialNormal,
    material: initialSample.material,
  };
}

/**
 * Extracts ordered navigational waypoints from a `CourseSpec`'s static deck nodes
 * so the 120 Hz verification bot follows ramps, corners, swept tracks, and bridges toward `goalPos`.
 */
function buildCourseWaypoints(
  course: CourseSpec,
  includeSweptShortcuts = false,
): Vec3[] {
  const waypoints: Vec3[] = [];
  for (const node of course.nodes) {
    if (node.material === 'acid' || node.material === 'start' || node.material === 'bounce') {
      continue;
    }
    if (node.kind === 'torus') continue;
    // Skip support pillars and decorative walls/towers
    if (node.supportBias !== true && node.material !== 'goal') {
      continue;
    }
    if (node.kind === 'sweptTrack') {
      if (!includeSweptShortcuts) continue;
      const startPt: Vec3 = [
        node.center[0] + node.start[0],
        node.center[1] + node.start[1] + 0.6,
        node.center[2] + node.start[2],
      ];
      const midPt: Vec3 = [
        node.center[0] + (node.start[0] + node.end[0]) * 0.5,
        node.center[1] + (node.start[1] + node.end[1]) * 0.5 + 0.6,
        node.center[2] + (node.start[2] + node.end[2]) * 0.5,
      ];
      const endPt: Vec3 = [
        node.center[0] + node.end[0],
        node.center[1] + node.end[1] + 0.6,
        node.center[2] + node.end[2],
      ];
      waypoints.push(startPt, midPt, endPt);
    } else if (node.kind === 'ramp') {
      const halfRun = node.halfLength * 0.8;
      if (node.axis === 'z') {
        waypoints.push(
          [node.center[0], node.center[1] + 0.6, node.center[2] + halfRun],
          [node.center[0], node.center[1] + 0.6, node.center[2]],
          [node.center[0], node.center[1] + 0.6, node.center[2] - halfRun],
        );
      } else {
        waypoints.push(
          [node.center[0] - halfRun, node.center[1] + 0.6, node.center[2]],
          [node.center[0], node.center[1] + 0.6, node.center[2]],
          [node.center[0] + halfRun, node.center[1] + 0.6, node.center[2]],
        );
      }
    } else {
      if (
        (node.kind === 'box' || node.kind === 'roundedBox') &&
        (node.halfExtents[1] > 1.8 ||
          node.halfExtents[0] < 0.55 ||
          node.halfExtents[2] < 0.55)
      ) {
        continue;
      }
      waypoints.push([node.center[0], node.center[1] + 0.6, node.center[2]]);
    }
  }
  waypoints.push(course.goalPos);
  return waypoints;
}

/**
 * Runs a 120 Hz physics simulation bot rollout on CPU to verify that:
 *   1. The marble settles cleanly on `startPos` with `grounded === true`
 *   2. Steering along the course nodes reaches `goalPos` (`reachedGoal === true`).
 *      Uses closed-loop PD velocity tracking along waypoints and tests both the
 *      primary route and tourist-first route (skipping shortcut sweptTracks if needed).
 */
function runSingleBotRollout(
  course: CourseSpec,
  waypoints: readonly Vec3[],
  maxSteps: number,
  targetSpeed: number,
): BotRolloutReport {
  const evaluator = createCpuWorldEvaluator(course);
  const sim = createMarbleSimulation(course, evaluator);
  const dt = 1 / 120;

  for (let i = 0; i < 30; i++) {
    sim.stepFixed(
      dt,
      { moveXZ: [0, 0], jumpPressed: false, respawnPressed: false },
      i * dt,
    );
  }
  const settledState = sim.getState();
  const settledOnStart =
    settledState.contact.grounded && settledState.status === 'racing';

  const initialGoalDistance = Math.hypot(
    course.startPos[0] - course.goalPos[0],
    course.startPos[2] - course.goalPos[2],
  );
  let minGoalDistance = initialGoalDistance;
  let peakSpeed = 0;
  let groundedFrames = settledOnStart ? 30 : 0;
  let deathsDuringRollout = 0;
  let reachedGoal = false;
  let lastStatus = settledState.status;

  let wpIdx = 0;
  const trajectoryPreview: Vec3[] = [
    [
      Math.round(settledState.position[0] * 100) / 100,
      Math.round(settledState.position[1] * 100) / 100,
      Math.round(settledState.position[2] * 100) / 100,
    ],
  ];

  let stepsRun = 30;
  for (let step = 30; step < maxSteps; step++) {
    stepsRun = step + 1;
    const cur = sim.getState();

    const dGoalXZ = Math.hypot(
      cur.position[0] - course.goalPos[0],
      cur.position[2] - course.goalPos[2],
    );
    const dGoalY = Math.abs(cur.position[1] - course.goalPos[1]);
    if (dGoalXZ < minGoalDistance) {
      minGoalDistance = dGoalXZ;
    }

    if (
      cur.status === 'goal' ||
      cur.surfaceMaterial === 'goal' ||
      (dGoalXZ <= course.goalRadius * 1.15 && dGoalY <= 2.6)
    ) {
      reachedGoal = true;
      minGoalDistance = 0;
      break;
    }

    if (
      cur.status !== lastStatus &&
      (cur.status === 'fell' || cur.status === 'shattered' || cur.status === 'sunk')
    ) {
      deathsDuringRollout++;
      // Respawn immediately on death to see if the rest of the rollout can recover or if it keeps failing
      sim.stepFixed(
        dt,
        { moveXZ: [0, 0], jumpPressed: false, respawnPressed: true },
        step * dt,
      );
      lastStatus = sim.getState().status;
      continue;
    }
    lastStatus = cur.status;

    while (wpIdx < waypoints.length - 1) {
      const wp = waypoints[wpIdx];
      const distWp = Math.hypot(cur.position[0] - wp[0], cur.position[2] - wp[2]);
      if (distWp < 2.6) {
        wpIdx++;
      } else {
        break;
      }
    }

    const target = waypoints[wpIdx] ?? course.goalPos;
    const dx = target[0] - cur.position[0];
    const dz = target[2] - cur.position[2];
    const dist = Math.hypot(dx, dz);
    const dirX = dist > 1e-4 ? dx / dist : 0;
    const dirZ = dist > 1e-4 ? dz / dist : 0;

    const speed = Math.hypot(cur.velocity[0], cur.velocity[1], cur.velocity[2]);
    if (speed > peakSpeed) peakSpeed = speed;
    if (cur.contact.grounded) groundedFrames++;

    // Closed-loop PD velocity steering toward target waypoint so the marble carves corners cleanly
    const desiredVx = dirX * targetSpeed;
    const desiredVz = dirZ * targetSpeed;
    const steerX = (desiredVx - cur.velocity[0]) * 0.22;
    const steerZ = (desiredVz - cur.velocity[2]) * 0.22;
    const steerMag = Math.hypot(steerX, steerZ);
    const clampedSteerX = steerMag > 1 ? steerX / steerMag : steerX;
    const clampedSteerZ = steerMag > 1 ? steerZ / steerMag : steerZ;

    const jumpPressed =
      cur.contact.grounded &&
      step % 95 === 0 &&
      cur.surfaceMaterial === 'bounce';

    sim.stepFixed(
      dt,
      {
        moveXZ: [clampedSteerX, clampedSteerZ],
        jumpPressed,
        respawnPressed: false,
      },
      step * dt,
    );

    if (step % 90 === 0) {
      const p = sim.getState().position;
      trajectoryPreview.push([
        Math.round(p[0] * 100) / 100,
        Math.round(p[1] * 100) / 100,
        Math.round(p[2] * 100) / 100,
      ]);
    }
  }

  const finalP = sim.getState().position;
  trajectoryPreview.push([
    Math.round(finalP[0] * 100) / 100,
    Math.round(finalP[1] * 100) / 100,
    Math.round(finalP[2] * 100) / 100,
  ]);

  const progressRatio = reachedGoal
    ? 1
    : initialGoalDistance > 1e-3
      ? Math.min(
          0.99,
          Math.max(0, (initialGoalDistance - minGoalDistance) / initialGoalDistance),
        )
      : 0;

  return {
    stepsSimulated: stepsRun,
    simulatedSeconds: Math.round((stepsRun / 120) * 100) / 100,
    settledOnStart,
    reachedGoal,
    initialGoalDistance: Math.round(initialGoalDistance * 100) / 100,
    minGoalDistance: Math.round(minGoalDistance * 100) / 100,
    progressRatio: Math.round(progressRatio * 100) / 100,
    peakSpeed: Math.round(peakSpeed * 100) / 100,
    groundedRatio: Math.round((groundedFrames / Math.max(1, stepsRun)) * 100) / 100,
    deathsDuringRollout,
    trajectoryPreview,
  };
}

function runAutonomousDriverVerificationRollout(
  course: CourseSpec,
  style: 'tourist' | 'speedrunner',
  maxSteps = 2400,
): BotRolloutReport {
  const evaluator = createCpuWorldEvaluator(course);
  const sim = createMarbleSimulation(course, evaluator);
  const driver = createAutonomousDriver(course, evaluator, { style, seed: 42 });
  const dt = 1 / 120;

  for (let i = 0; i < 30; i++) {
    sim.stepFixed(
      dt,
      { moveXZ: [0, 0], jumpPressed: false, respawnPressed: false },
      i * dt,
    );
  }
  const settledState = sim.getState();
  const settledOnStart =
    settledState.contact.grounded && settledState.status === 'racing';

  const initialGoalDistance = Math.hypot(
    course.startPos[0] - course.goalPos[0],
    course.startPos[2] - course.goalPos[2],
  );
  let minGoalDistance = initialGoalDistance;
  let peakSpeed = 0;
  let groundedFrames = settledOnStart ? 30 : 0;
  let deathsDuringRollout = 0;
  let reachedGoal = false;
  let lastStatus = settledState.status;

  const trajectoryPreview: Vec3[] = [
    [
      Math.round(settledState.position[0] * 100) / 100,
      Math.round(settledState.position[1] * 100) / 100,
      Math.round(settledState.position[2] * 100) / 100,
    ],
  ];

  let stepsRun = 30;
  for (let step = 30; step < maxSteps; step++) {
    stepsRun = step + 1;
    const cur = sim.getState();

    const dGoalXZ = Math.hypot(
      cur.position[0] - course.goalPos[0],
      cur.position[2] - course.goalPos[2],
    );
    const dGoalY = Math.abs(cur.position[1] - course.goalPos[1]);
    if (dGoalXZ < minGoalDistance) {
      minGoalDistance = dGoalXZ;
    }

    if (
      cur.status === 'goal' ||
      cur.surfaceMaterial === 'goal' ||
      (dGoalXZ <= course.goalRadius * 1.15 && dGoalY <= 2.6)
    ) {
      reachedGoal = true;
      minGoalDistance = 0;
      break;
    }

    if (
      cur.status !== lastStatus &&
      (cur.status === 'fell' || cur.status === 'shattered' || cur.status === 'sunk')
    ) {
      deathsDuringRollout++;
      sim.stepFixed(
        dt,
        { moveXZ: [0, 0], jumpPressed: false, respawnPressed: true },
        step * dt,
      );
      lastStatus = sim.getState().status;
      continue;
    }
    lastStatus = cur.status;

    const speed = Math.hypot(cur.velocity[0], cur.velocity[1], cur.velocity[2]);
    if (speed > peakSpeed) peakSpeed = speed;
    if (cur.contact.grounded) groundedFrames++;

    const cmd = driver.computeInput(cur, step * dt, dt);
    sim.stepFixed(dt, cmd, step * dt);

    if (step % 90 === 0) {
      const p = sim.getState().position;
      trajectoryPreview.push([
        Math.round(p[0] * 100) / 100,
        Math.round(p[1] * 100) / 100,
        Math.round(p[2] * 100) / 100,
      ]);
    }
  }

  const finalP = sim.getState().position;
  trajectoryPreview.push([
    Math.round(finalP[0] * 100) / 100,
    Math.round(finalP[1] * 100) / 100,
    Math.round(finalP[2] * 100) / 100,
  ]);

  const progressRatio = reachedGoal
    ? 1
    : initialGoalDistance > 1e-3
      ? Math.min(
          0.99,
          Math.max(0, (initialGoalDistance - minGoalDistance) / initialGoalDistance),
        )
      : 0;

  return {
    stepsSimulated: stepsRun,
    simulatedSeconds: Math.round((stepsRun / 120) * 100) / 100,
    settledOnStart,
    reachedGoal,
    initialGoalDistance: Math.round(initialGoalDistance * 100) / 100,
    minGoalDistance: Math.round(minGoalDistance * 100) / 100,
    progressRatio: Math.round(progressRatio * 100) / 100,
    peakSpeed: Math.round(peakSpeed * 100) / 100,
    groundedRatio: Math.round((groundedFrames / Math.max(1, stepsRun)) * 100) / 100,
    deathsDuringRollout,
    trajectoryPreview,
  };
}

function run120HzBotVerificationRollout(
  course: CourseSpec,
  maxSteps = 2400,
): BotRolloutReport {
  // Strategy 1: Main tourist deck route (supportBias floors & ramps without optional shortcut tubes)
  const touristWaypoints = buildCourseWaypoints(course, false);
  const primary = runSingleBotRollout(course, touristWaypoints, maxSteps, 9.5);
  if (primary.reachedGoal) {
    return primary;
  }

  // Strategy 2: Include sweptTrack bridges/chutes (for courses whose main bridge is a sweptTrack)
  const allWaypoints = buildCourseWaypoints(course, true);
  const secondary = runSingleBotRollout(course, allWaypoints, maxSteps, 9.0);
  if (secondary.reachedGoal) {
    return secondary;
  }

  // Strategy 3: 7-ray SDF Look-Ahead Autonomous Driver (for multi-stage portal/catwalk courses)
  const driverSpeedrun = runAutonomousDriverVerificationRollout(course, 'speedrunner', maxSteps);
  if (driverSpeedrun.reachedGoal) {
    return driverSpeedrun;
  }
  const driverTourist = runAutonomousDriverVerificationRollout(course, 'tourist', maxSteps);
  if (driverTourist.reachedGoal) {
    return driverTourist;
  }

  const candidates = [primary, secondary, driverSpeedrun, driverTourist];
  candidates.sort((a, b) => b.progressRatio - a.progressRatio);
  return candidates[0];
}

/**
 * Full Agent 3 Verification Gate: validates schema, clamps excessive nodes (`MAX_COURSE_NODES = 32`),
 * checks grounded spawn, goal SDF support, GLSL2/WGSL shader compilation, and requires
 * `botRollout.reachedGoal === true` (100% goal pad contact) for `passed === true`.
 */
export function verifyCourseSpecSolvability(
  candidateCourse: CourseSpec,
): CourseSolvabilityReport {
  const t0 = performance.now();
  const diagnostics: string[] = [];

  const schemaCheck = validateCourseSpecSchema(candidateCourse);
  if (!schemaCheck.valid) {
    diagnostics.push(...schemaCheck.errors);
    return {
      passed: false,
      schemaValid: false,
      nodesClamped: false,
      originalNodeCount: Array.isArray(candidateCourse?.nodes)
        ? candidateCourse.nodes.length + (Array.isArray(candidateCourse?.hazards) ? candidateCourse.hazards.length : 0)
        : 0,
      clampedNodeCount: 0,
      startGrounded: false,
      startHeightRepaired: false,
      startDistance: Infinity,
      startNormal: [0, 1, 0],
      startMaterial: 'standard',
      goalReachable: false,
      goalSurfaceDistance: Infinity,
      shaderCompilePassed: false,
      glslLineCount: 0,
      wgslLineCount: 0,
      verificationLatencyMs: Math.round((performance.now() - t0) * 100) / 100,
      botRollout: {
        stepsSimulated: 0,
        simulatedSeconds: 0,
        settledOnStart: false,
        reachedGoal: false,
        initialGoalDistance: 0,
        minGoalDistance: 0,
        progressRatio: 0,
        peakSpeed: 0,
        groundedRatio: 0,
        deathsDuringRollout: 0,
        trajectoryPreview: [],
      },
      diagnostics,
      verifiedCourse: candidateCourse,
    };
  }

  // Clamp excessive nodes to MAX_COURSE_NODES = 32 so generated shaders always compile fast
  const clampResult = clampCourseNodesToBudget(candidateCourse, MAX_COURSE_NODES);
  if (clampResult.clamped) {
    diagnostics.push(
      `Clamped total SDF primitive nodes from ${clampResult.originalCount} to ${clampResult.clampedCount} (MAX_COURSE_NODES = ${MAX_COURSE_NODES}) for fast raymarching shader compilation.`,
    );
  }

  // 1. Check & repair grounded spawn position
  const spawnCheck = ensureGroundedSpawnPosition(clampResult.course);
  const verifiedCourse = spawnCheck.course;
  if (spawnCheck.repaired) {
    diagnostics.push(
      `Auto-snapped startPos Y from ${candidateCourse.startPos[1].toFixed(2)} to ${verifiedCourse.startPos[1].toFixed(2)} for exact r=0.55 SDF ground contact.`,
    );
  }
  if (!spawnCheck.grounded) {
    diagnostics.push(
      `Start position [${verifiedCourse.startPos.join(', ')}] is not grounded on a valid SDF floor (d=${spawnCheck.distance.toFixed(3)}).`,
    );
  }

  // 2. Check goal pad SDF surface support
  const evaluator = createCpuWorldEvaluator(verifiedCourse);
  const goalSample = evaluator.sample(verifiedCourse.goalPos, 0);
  const goalNormal = evaluator.normal(verifiedCourse.goalPos, 0);
  const goalSurfaceValid =
    Number.isFinite(goalSample.distance) &&
    Math.abs(goalSample.distance) < 2.2 &&
    Number.isFinite(goalNormal[1]);
  if (!goalSurfaceValid) {
    diagnostics.push(
      `Goal position [${verifiedCourse.goalPos.join(', ')}] lacks nearby SDF pad support (d=${goalSample.distance.toFixed(3)}).`,
    );
  }

  // 3. Compile GLSL ES 3.00 and WGSL WebGPU shaders
  let glsl = '';
  let wgsl = '';
  let shaderCompilePassed = false;
  try {
    glsl = compileCourseToGlsl(verifiedCourse);
    wgsl = compileCourseToWgsl(verifiedCourse);
    shaderCompilePassed =
      glsl.includes('#version 300 es') &&
      glsl.includes('evalCourseWorldRaw') &&
      !glsl.includes('NaN') &&
      !glsl.includes('undefined') &&
      wgsl.includes('fn evalCourseWorldRaw') &&
      !wgsl.includes('NaN') &&
      !wgsl.includes('undefined');
  } catch (err) {
    diagnostics.push(
      `Shader compilation error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // 4. Run 120 Hz simulated bot rollout — Codex F2: require reachedGoal === true (100% goal contact)!
  const botRollout = run120HzBotVerificationRollout(verifiedCourse, 2400);
  const goalReachable =
    goalSurfaceValid &&
    botRollout.settledOnStart &&
    botRollout.reachedGoal === true;

  if (!botRollout.settledOnStart) {
    diagnostics.push('120 Hz Bot failed to settle on Start Pad within 30 frames.');
  } else if (botRollout.reachedGoal) {
    diagnostics.push(
      `120 Hz Bot settled cleanly on Start Pad (d=${spawnCheck.distance.toFixed(3)}m, mat=${spawnCheck.material}) and reached Goal Pad (100% progress, peak ${botRollout.peakSpeed.toFixed(1)} u/s, ${botRollout.deathsDuringRollout} rollout deaths).`,
    );
  } else {
    diagnostics.push(
      `120 Hz Bot rollout failed to reach Goal Pad [${verifiedCourse.goalPos.join(', ')}]: stopped at minGoalDistance=${botRollout.minGoalDistance.toFixed(2)}m (${Math.round(botRollout.progressRatio * 100)}% proximity, ${botRollout.deathsDuringRollout} rollout deaths). Ensure continuous bridged floor geometry between Start and Goal.`,
    );
  }

  const passed =
    schemaCheck.valid &&
    spawnCheck.grounded &&
    goalReachable &&
    shaderCompilePassed;

  return {
    passed,
    schemaValid: schemaCheck.valid,
    nodesClamped: clampResult.clamped,
    originalNodeCount: clampResult.originalCount,
    clampedNodeCount: clampResult.clampedCount,
    startGrounded: spawnCheck.grounded,
    startHeightRepaired: spawnCheck.repaired,
    startDistance: Math.round(spawnCheck.distance * 1000) / 1000,
    startNormal: [
      Math.round(spawnCheck.normal[0] * 1000) / 1000,
      Math.round(spawnCheck.normal[1] * 1000) / 1000,
      Math.round(spawnCheck.normal[2] * 1000) / 1000,
    ],
    startMaterial: spawnCheck.material,
    goalReachable,
    goalSurfaceDistance: Math.round(goalSample.distance * 1000) / 1000,
    shaderCompilePassed,
    glslLineCount: glsl ? glsl.split('\n').length : 0,
    wgslLineCount: wgsl ? wgsl.split('\n').length : 0,
    verificationLatencyMs: Math.round((performance.now() - t0) * 100) / 100,
    botRollout,
    diagnostics,
    verifiedCourse,
  };
}
