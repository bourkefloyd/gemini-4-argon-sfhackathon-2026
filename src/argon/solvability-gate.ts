/**
 * Agent 3: Autonomous CPU SDF Solvability & Lockstep Shader Gate (`src/argon/solvability-gate.ts`)
 *
 * Validates every `CourseSpec` synthesized or mutated by Gemini 4 Argon (`gemini-4-argon`)
 * and the `gemini-3.8-flash` Hazard Specialist before presenting the human-in-the-loop
 * "Approve & Hot-Swap Course" button:
 *   1. Schema & finite-number validation (`validateCourseSpecSchema`)
 *   2. CPU SDF Kernel evaluation (`createCpuWorldEvaluator`) verifying grounded `startPos`,
 *      non-NaN tetrahedral normals, and solid `goalPos` support (with automatic spawn-height snap repair)
 *   3. Lockstep GPU Shader compilation (`compileCourseToGlsl` & `compileCourseToWgsl`)
 *   4. Simulated 120 Hz Bot Rollout (`createMarbleSimulation`) verifying the marble settles on
 *      the Start Pad and rolls along the course topology toward `goalPos`.
 */

import {
  DEFAULT_PHYSICS_CONFIG,
  MATERIAL_IDS,
  type CourseSpec,
  type SdfPrimitiveNode,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import { createMarbleSimulation } from '../physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../rendering';
import { createCpuWorldEvaluator } from '../sdf/eval-cpu';

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

function isFiniteVec3(v: unknown): v is Vec3 {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

function isValidMaterial(m: unknown): m is SurfaceMaterial {
  return typeof m === 'string' && Object.prototype.hasOwnProperty.call(MATERIAL_IDS, m);
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
      if (!node || typeof node !== 'object') {
        errors.push(`nodes[${idx}] must be an object.`);
        return;
      }
      if (!isFiniteVec3(node.center)) {
        errors.push(`nodes[${idx}] (${node.id ?? node.kind}) has invalid center Vec3.`);
      }
      if (!isValidMaterial(node.material)) {
        errors.push(`nodes[${idx}] (${node.id ?? node.kind}) has invalid material "${String(node.material)}".`);
      }
    });
  }

  if (!Array.isArray(c.hazards)) {
    errors.push('`hazards` must be an array.');
  } else {
    c.hazards.forEach((haz: SdfPrimitiveNode, idx: number) => {
      if (!isFiniteVec3(haz.center)) {
        errors.push(`hazards[${idx}] (${haz.id ?? haz.kind}) has invalid center Vec3.`);
      }
      if (!isValidMaterial(haz.material)) {
        errors.push(`hazards[${idx}] (${haz.id ?? haz.kind}) has invalid material "${String(haz.material)}".`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
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

  // If already resting cleanly on a valid floor surface
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

  // Scan vertically from startPos.y + 4.0 down to startPos.y - 6.0 to find the surface top
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
 * so the 120 Hz verification bot follows ramps, corners, and bridges toward `goalPos`.
 */
function buildCourseWaypoints(course: CourseSpec): Vec3[] {
  const waypoints: Vec3[] = [];
  for (const node of course.nodes) {
    if (node.material === 'acid') continue;
    if (node.kind === 'sweptTrack') {
      const mid: Vec3 = [
        node.center[0] + (node.start[0] + node.end[0]) * 0.5,
        node.center[1] + (node.start[1] + node.end[1]) * 0.5 + 0.6,
        node.center[2] + (node.start[2] + node.end[2]) * 0.5,
      ];
      waypoints.push(mid);
    } else {
      // Skip decorative guardrails/walls/pillars (tall or thin blocks)
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
 * Runs a fast 120 Hz physics simulation bot rollout on CPU to verify that:
 *   1. The marble settles cleanly on `startPos` with `grounded === true`
 *   2. Steering along the course nodes advances toward `goalPos` without NaN explosions
 */
function run120HzBotVerificationRollout(
  course: CourseSpec,
  maxSteps = 1440,
): BotRolloutReport {
  const evaluator = createCpuWorldEvaluator(course);
  const sim = createMarbleSimulation(course, evaluator);
  const dt = 1 / 120;

  // Phase 1: Settle on Start Pad for 30 frames (0.25s) with zero input
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

  const waypoints = buildCourseWaypoints(course);
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

    const dGoal = Math.hypot(
      cur.position[0] - course.goalPos[0],
      cur.position[2] - course.goalPos[2],
    );
    if (dGoal < minGoalDistance) {
      minGoalDistance = dGoal;
    }

    if (cur.status === 'goal' || dGoal <= course.goalRadius * 1.05) {
      reachedGoal = true;
      minGoalDistance = 0;
      break;
    }

    if (
      cur.status !== lastStatus &&
      (cur.status === 'fell' || cur.status === 'shattered' || cur.status === 'sunk')
    ) {
      deathsDuringRollout++;
    }
    lastStatus = cur.status;

    // Advance waypoint when close in XZ
    while (wpIdx < waypoints.length - 1) {
      const wp = waypoints[wpIdx];
      const distWp = Math.hypot(cur.position[0] - wp[0], cur.position[2] - wp[2]);
      if (distWp < 3.4) {
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

    // Moderate throttle when turning sharply so the bot stays on narrow catwalks
    const speed = Math.hypot(cur.velocity[0], cur.velocity[1], cur.velocity[2]);
    if (speed > peakSpeed) peakSpeed = speed;
    if (cur.contact.grounded) groundedFrames++;

    const throttle = speed > 14.5 ? 0.55 : 0.88;
    const jumpPressed =
      cur.contact.grounded &&
      step % 95 === 0 &&
      cur.surfaceMaterial === 'bounce';

    sim.stepFixed(
      dt,
      {
        moveXZ: [dirX * throttle, dirZ * throttle],
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

  const progressRatio =
    initialGoalDistance > 1e-3
      ? Math.min(
          1,
          Math.max(0, (initialGoalDistance - minGoalDistance) / initialGoalDistance),
        )
      : 1;

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

/**
 * Full Agent 3 Verification Gate: validates schema, grounded spawn, goal SDF support,
 * GLSL2/WGSL shader compilation, and 120 Hz bot rollout solvability.
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

  // 1. Check & repair grounded spawn position
  const spawnCheck = ensureGroundedSpawnPosition(candidateCourse);
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

  // 4. Run 120 Hz simulated bot rollout
  const botRollout = run120HzBotVerificationRollout(verifiedCourse, 1440);
  const goalReachable =
    goalSurfaceValid &&
    botRollout.settledOnStart &&
    (botRollout.reachedGoal || botRollout.progressRatio >= 0.22);

  if (botRollout.settledOnStart) {
    diagnostics.push(
      `120 Hz Bot settled cleanly on Start Pad (d=${spawnCheck.distance.toFixed(3)}m, mat=${spawnCheck.material}) and rolled ${Math.round(botRollout.progressRatio * 100)}% toward Goal (peak ${botRollout.peakSpeed.toFixed(1)} u/s).`,
    );
  } else {
    diagnostics.push('120 Hz Bot failed to settle on Start Pad within 30 frames.');
  }

  const passed =
    schemaCheck.valid &&
    spawnCheck.grounded &&
    goalReachable &&
    shaderCompilePassed;

  return {
    passed,
    schemaValid: schemaCheck.valid,
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
