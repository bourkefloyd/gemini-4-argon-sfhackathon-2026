import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PHYSICS_CONFIG,
  type CourseSpec,
  type Vec3,
} from '../src/contracts';
import {
  BUILT_IN_COURSES,
  CLASSIC_COURSES,
  COURSE_1_PRACTICE_RACE,
  COURSE_1_RAMP_GAUNTLET,
  COURSE_2_BEGINNER_CHUTES,
  COURSE_3_INTERMEDIATE_MADNESS,
  COURSE_4_AERIAL_CATWALKS,
  COURSE_5_SILLY_RACE,
  COURSE_6_ULTIMATE_ARGON_CORE,
  COURSE_8_RIPTIDE_SURF,
  COURSE_9_NEON_OBBY,
  COURSE_10_SAHARA_DUNES,
} from '../src/courses';
import { runHeadlessBotRollout } from '../src/bot';
import { createMarbleSimulation } from '../src/physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import { createCpuWorldEvaluator } from '../src/sdf/eval-cpu';
import { createInitialWeaponState, triggerWeaponAbility } from '../src/weapons';

/**
 * Helper: Drive the 120 Hz marble physics simulation along a sequence of world-space
 * waypoints using a proportional-derivative trackball steering controller.
 */
function driveMarbleAlongWaypoints(
  course: CourseSpec,
  startPosition: Vec3,
  waypoints: readonly { target: Vec3; captureRadius?: number; jumpAtDist?: number }[],
  maxFrames = 2400,
) {
  const evaluator = createCpuWorldEvaluator(course);
  const sim = createMarbleSimulation(course, evaluator);

  sim.setState({
    ...sim.getState(),
    position: [...startPosition],
    prevPosition: [...startPosition],
    respawnPos: [...startPosition],
    velocity: [0, 0, 0],
    status: 'racing',
    statusTimer: 0,
  });

  let wpIndex = 0;
  const dt = DEFAULT_PHYSICS_CONFIG.fixedDt;

  for (let frame = 0; frame < maxFrames; frame++) {
    const state = sim.getState();
    if (state.status === 'goal') {
      return { reachedGoal: true, frames: frame, finalState: state };
    }
    if (state.status !== 'racing') {
      return { reachedGoal: false, frames: frame, finalState: state };
    }

    const wp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
    const dx = wp.target[0] - state.position[0];
    const dz = wp.target[2] - state.position[2];
    const distXZ = Math.hypot(dx, dz);

    const captureR = wp.captureRadius ?? 2.4;
    if (distXZ <= captureR && wpIndex < waypoints.length - 1) {
      wpIndex++;
    }

    const activeWp = waypoints[Math.min(wpIndex, waypoints.length - 1)];
    const toX = activeWp.target[0] - state.position[0];
    const toZ = activeWp.target[2] - state.position[2];
    const toLen = Math.max(Math.hypot(toX, toZ), 1e-5);
    const dirX = toX / toLen;
    const dirZ = toZ / toLen;

    // Desired horizontal velocity toward waypoint with damping of lateral drift
    const desiredSpeed = toLen > 5.0 ? 11.5 : Math.max(4.5, toLen * 2.2);
    const errVx = dirX * desiredSpeed - state.velocity[0] * 0.55;
    const errVz = dirZ * desiredSpeed - state.velocity[2] * 0.55;
    const errMag = Math.hypot(errVx, errVz);
    const moveXZ: readonly [number, number] =
      errMag > 1e-4
        ? [
            Math.max(-1, Math.min(1, errVx / Math.max(1, errMag))),
            Math.max(-1, Math.min(1, errVz / Math.max(1, errMag))),
          ]
        : [dirX, dirZ];

    const shouldJump =
      activeWp.jumpAtDist !== undefined &&
      toLen <= activeWp.jumpAtDist &&
      state.contact.grounded;

    sim.stepFixed(
      dt,
      {
        moveXZ,
        jumpPressed: shouldJump,
        respawnPressed: false,
      },
      frame * dt,
    );
  }

  return {
    reachedGoal: sim.getState().status === 'goal',
    frames: maxFrames,
    finalState: sim.getState(),
  };
}

describe('Classic & Expansion Campaign Courses — SDF Integrity, Shaders & 120 Hz Physical Solvability', () => {
  it('registers all 6 classic courses plus Riptide Surf Break, Neon Sky Obby, and Sahara Dune Surge with signature mechanics', () => {
    expect(CLASSIC_COURSES).toHaveLength(6);
    expect(BUILT_IN_COURSES).toHaveLength(9);

    // Course 1: Marble Ramp Gauntlet — 4-Stage Progressive Mechanics Ramp Track (parTimeSec: 60)
    expect(COURSE_1_PRACTICE_RACE.index).toBe(1);
    expect(COURSE_1_RAMP_GAUNTLET).toBe(COURSE_1_PRACTICE_RACE);
    expect(COURSE_1_PRACTICE_RACE.parTimeSec).toBe(60);
    expect(COURSE_1_PRACTICE_RACE.subtitle).toContain(
      'Stage 1: Steep Ramp & Backspin -> Stage 2: Portal Fling Gap -> Stage 3: Wave & Pistons -> Stage 4: Ice, Steelie & Goal',
    );
    expect(COURSE_1_PRACTICE_RACE.startPos[1]).toBeCloseTo(14.57, 2);
    expect(COURSE_1_PRACTICE_RACE.goalPos[1]).toBeCloseTo(1.02, 2);
    expect(COURSE_1_PRACTICE_RACE.portals?.length).toBeGreaterThanOrEqual(1);
    expect(COURSE_1_PRACTICE_RACE.nodes.some((n) => n.kind === 'waveFloor')).toBe(true);
    expect(COURSE_1_PRACTICE_RACE.nodes.some((n) => n.material === 'ice')).toBe(true);
    expect(COURSE_1_PRACTICE_RACE.nodes.some((n) => n.id === 'stage4-destructible-barrier')).toBe(true);
    expect(COURSE_1_PRACTICE_RACE.nodes.some((n) => n.id?.includes('occlusion-arch'))).toBe(true);
    expect(COURSE_1_PRACTICE_RACE.nodes.some((n) => n.id?.includes('speedrun'))).toBe(true);
    expect(COURSE_1_PRACTICE_RACE.hazards.filter((h) => h.kind === 'piston').length).toBe(2);
    expect(COURSE_1_PRACTICE_RACE.hazards.some((h) => h.kinematic?.kind === 'steelie')).toBe(true);

    // Course 2: Beginner Chutes (parTimeSec: 65, +65s bonus)
    expect(COURSE_2_BEGINNER_CHUTES.index).toBe(2);
    expect(COURSE_2_BEGINNER_CHUTES.parTimeSec).toBe(65);
    expect(COURSE_2_BEGINNER_CHUTES.bonusTimeSec).toBe(65);
    expect(COURSE_2_BEGINNER_CHUTES.nodes.some((n) => n.id?.includes('safe-guarded-chute'))).toBe(true);
    expect(COURSE_2_BEGINNER_CHUTES.nodes.some((n) => n.id?.includes('turbo-banked-chute'))).toBe(true);
    expect(COURSE_2_BEGINNER_CHUTES.nodes.some((n) => n.kind === 'waveFloor')).toBe(true);
    expect(COURSE_2_BEGINNER_CHUTES.hazards.some((h) => h.kinematic?.kind === 'bridge')).toBe(true);

    // Course 3: Intermediate Madness (parTimeSec: 55, +35s bonus)
    expect(COURSE_3_INTERMEDIATE_MADNESS.index).toBe(3);
    expect(COURSE_3_INTERMEDIATE_MADNESS.parTimeSec).toBe(55);
    expect(COURSE_3_INTERMEDIATE_MADNESS.bonusTimeSec).toBe(35);
    expect(COURSE_3_INTERMEDIATE_MADNESS.nodes.some((n) => n.material === 'ice')).toBe(true);
    expect(COURSE_3_INTERMEDIATE_MADNESS.hazards.some((h) => h.kind === 'piston')).toBe(true);
    expect(COURSE_3_INTERMEDIATE_MADNESS.nodes.some((n) => n.kind === 'waveFloor')).toBe(true);
    expect(COURSE_3_INTERMEDIATE_MADNESS.nodes.some((n) => n.material === 'acid')).toBe(true);

    // Course 4: Aerial Catwalks (parTimeSec: 50, +30s bonus)
    expect(COURSE_4_AERIAL_CATWALKS.index).toBe(4);
    expect(COURSE_4_AERIAL_CATWALKS.parTimeSec).toBe(50);
    expect(COURSE_4_AERIAL_CATWALKS.bonusTimeSec).toBe(30);
    expect(COURSE_4_AERIAL_CATWALKS.nodes.some((n) => n.material === 'bounce')).toBe(true);
    expect(COURSE_4_AERIAL_CATWALKS.nodes.some((n) => n.material === 'conveyor')).toBe(true);
    expect(COURSE_4_AERIAL_CATWALKS.nodes.some((n) => n.id?.includes('halfpipe-shortcut'))).toBe(true);

    // Course 5: Silly Race (parTimeSec: 50, +20s bonus, uphill climb!)
    expect(COURSE_5_SILLY_RACE.index).toBe(5);
    expect(COURSE_5_SILLY_RACE.parTimeSec).toBe(50);
    expect(COURSE_5_SILLY_RACE.bonusTimeSec).toBe(20);
    expect(COURSE_5_SILLY_RACE.goalPos[1]).toBeGreaterThan(COURSE_5_SILLY_RACE.startPos[1] + 5.0);
    expect(COURSE_5_SILLY_RACE.nodes.some((n) => n.material === 'sticky')).toBe(true);
    expect(
      COURSE_5_SILLY_RACE.hazards.filter((h) => h.kinematic?.kind === 'steelie').length,
    ).toBeGreaterThanOrEqual(2);

    // Course 6: Ultimate Argon Core (parTimeSec: 60, +20s bonus)
    expect(COURSE_6_ULTIMATE_ARGON_CORE.index).toBe(6);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.parTimeSec).toBe(60);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.bonusTimeSec).toBe(20);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.hazards.some((h) => h.kind === 'piston')).toBe(true);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.hazards.some((h) => h.kinematic?.kind === 'bridge')).toBe(true);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.nodes.some((n) => n.material === 'ice')).toBe(true);
    expect(COURSE_6_ULTIMATE_ARGON_CORE.nodes.some((n) => n.material === 'acid')).toBe(true);

    // Course 8: Riptide Surf Break — All-Waves Beach Shorebreak & Outer Reef Surf Gauntlet
    expect(COURSE_8_RIPTIDE_SURF.index).toBe(8);
    expect(COURSE_8_RIPTIDE_SURF.id).toBe('riptide-surf-break');
    expect(COURSE_8_RIPTIDE_SURF.nodes.filter((n) => n.kind === 'waveFloor').length).toBeGreaterThanOrEqual(4);
    expect(COURSE_8_RIPTIDE_SURF.nodes.some((n) => n.id === 'riptide-zone2-undertow-current')).toBe(true);
    expect(COURSE_8_RIPTIDE_SURF.nodes.some((n) => n.id === 'riptide-zone2-west-rip-channel')).toBe(true);
    expect(COURSE_8_RIPTIDE_SURF.nodes.some((n) => n.material === 'bounce')).toBe(true);
    expect(COURSE_8_RIPTIDE_SURF.portals?.length).toBeGreaterThanOrEqual(1);

    // Course 9: Neon Sky Obby — Roblox Obby-Style Precision Parkour Course
    expect(COURSE_9_NEON_OBBY.index).toBe(9);
    expect(COURSE_9_NEON_OBBY.id).toBe('neon-sky-obby');
    expect(COURSE_9_NEON_OBBY.checkpoints?.length).toBe(3);
    expect(COURSE_9_NEON_OBBY.hazards.some((h) => h.kinematic?.kind === 'bridge')).toBe(true);
    expect(COURSE_9_NEON_OBBY.nodes.filter((n) => n.material === 'bounce').length).toBeGreaterThanOrEqual(3);
    expect(COURSE_9_NEON_OBBY.nodes.some((n) => n.kind === 'waveFloor')).toBe(true);

    // Course 10: Sahara Dune Surge — Desert Sand Dunes Surf Variant
    expect(COURSE_10_SAHARA_DUNES.index).toBe(10);
    expect(COURSE_10_SAHARA_DUNES.id).toBe('sahara-dune-surge');
    expect(COURSE_10_SAHARA_DUNES.nodes.filter((n) => n.kind === 'waveFloor').length).toBeGreaterThanOrEqual(4);
    expect(COURSE_10_SAHARA_DUNES.nodes.some((n) => n.material === 'sticky')).toBe(true);
    expect(COURSE_10_SAHARA_DUNES.nodes.some((n) => n.id === 'sahara-zone2-west-tradewind-jetstream')).toBe(true);
  });

  it.each(BUILT_IN_COURSES.map((c) => [c.index, c.name, c] as const))(
    'Course %i (%s): startPos and every checkpoint spawn cleanly on solid ground without falling or penetrating',
    (_idx, _name, course) => {
      const evaluator = createCpuWorldEvaluator(course);
      const radius = DEFAULT_PHYSICS_CONFIG.marbleRadius;

      const spawnLocations: { label: string; pos: Vec3 }[] = [
        { label: 'startPos', pos: course.startPos },
        ...(course.checkpoints ?? []).map((cp) => ({
          label: `checkpoint:${cp.id}`,
          pos: cp.position,
        })),
      ];

      for (const loc of spawnLocations) {
        // 1. Verify static SDF clearance & upward support normal at t = 0
        const d0 = evaluator.distance(loc.pos, 0);
        const n0 = evaluator.normal(loc.pos, 0);
        expect(
          d0,
          `${course.id} ${loc.label} signed distance (${d0.toFixed(3)}) should match marble radius (${radius})`,
        ).toBeGreaterThanOrEqual(radius - 0.06);
        expect(
          d0,
          `${course.id} ${loc.label} signed distance (${d0.toFixed(3)}) should not float high in the air`,
        ).toBeLessThanOrEqual(radius + 0.08);
        expect(
          n0[1],
          `${course.id} ${loc.label} normal Y (${n0[1].toFixed(3)}) should point upward`,
        ).toBeGreaterThan(0.85);

        // 2. Step 120 Hz physics for 60 frames (0.5s) from rest and verify grounded stability
        const sim = createMarbleSimulation(course, evaluator);
        sim.setState({
          ...sim.getState(),
          position: [...loc.pos],
          prevPosition: [...loc.pos],
          respawnPos: [...loc.pos],
          velocity: [0, 0, 0],
          status: 'racing',
          statusTimer: 0,
        });

        for (let frame = 0; frame < 60; frame++) {
          sim.stepFixed(
            1 / 120,
            { moveXZ: [0, 0], jumpPressed: false, respawnPressed: false },
            frame / 120,
          );
        }

        const settled = sim.getState();
        expect(settled.status, `${course.id} ${loc.label} should stay in 'racing' status`).toBe(
          'racing',
        );
        expect(settled.contact.grounded, `${course.id} ${loc.label} should remain grounded`).toBe(
          true,
        );
        expect(
          Math.abs(settled.position[1] - loc.pos[1]),
          `${course.id} ${loc.label} should not drop or pop vertically`,
        ).toBeLessThan(0.08);
      }
    },
  );

  it.each(BUILT_IN_COURSES.map((c) => [c.index, c.name, c] as const))(
    'Course %i (%s): compiles cleanly to both GLSL2 (compileCourseToGlsl) and WGSL (compileCourseToWgsl)',
    (_idx, _name, course) => {
      const glsl = compileCourseToGlsl(course);
      const wgsl = compileCourseToWgsl(course);

      expect(glsl).toContain('#version 300 es');
      expect(glsl).toContain('vec2 evalCourseWorldRaw(vec3 p)');
      expect(glsl).toContain('vec3 shadeCourseSurface');
      expect(glsl).toContain('vec3 shadePlayerMarble');
      expect(glsl).not.toContain('NaN');
      expect(glsl).not.toContain('undefined');

      expect(wgsl).toContain(`// WGSL Lockstep Raymarching Shader for course: ${course.id}`);
      expect(wgsl).toContain('struct Uniforms');
      expect(wgsl).toContain('fn evalCourseWorldRaw(p: vec3<f32>) -> vec2<f32>');
      expect(wgsl).not.toContain('NaN');
      expect(wgsl).not.toContain('undefined');
    },
  );

  it('verifies goalPos is physically reachable and triggers status === "goal" on all 6 courses', () => {
    // Course 1: Marble Ramp Gauntlet (Stage 1 Steep 28° Ramp -> Stage 2 Side-Catwalk -> Stage 3 Wave & Pistons -> Stage 4 Ice, Steelie & S-Slalom to Goal)
    const run1 = driveMarbleAlongWaypoints(
      COURSE_1_PRACTICE_RACE,
      COURSE_1_PRACTICE_RACE.startPos,
      [
        { target: [0, 12.0, -7.0], captureRadius: 2.2 },
        { target: [0.4, 10.55, -14.2], captureRadius: 2.2 },
        { target: [7.2, 10.55, -14.8], captureRadius: 2.2 },
        { target: [16.8, 7.55, -16.8], captureRadius: 1.8 },
        { target: [22.0, 7.55, -16.8], captureRadius: 1.6 },
        { target: [29.8, 7.55, -16.4], captureRadius: 2.2 },
        { target: [30.0, 7.55, -23.4], captureRadius: 2.2 },
        { target: [30.0, 5.5, -31.0], captureRadius: 2.2 },
        { target: [31.2, 4.55, -36.2], captureRadius: 2.2 },
        { target: [32.4, 1.0, -45.2], captureRadius: 2.0 },
        { target: [32.6, 1.0, -48.6], captureRadius: 1.85 },
        { target: COURSE_1_PRACTICE_RACE.goalPos, captureRadius: 2.0 },
      ],
      3000,
    );
    expect(run1.reachedGoal).toBe(true);
    expect(run1.finalState.status).toBe('goal');

    // Course 1 Portal Fling + [F] Crater Bomb CSG Breach Route:
    // Roll down Stage 2 Drop Ramp straight into the Blue Portal, fling out of the 40° Orange Portal
    // across the 12m abyss onto Terrace 3, and blast through the Stage 4 Destructible Barrier with [F] Crater Bomb!
    const eval1Portal = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim1Portal = createMarbleSimulation(COURSE_1_PRACTICE_RACE, eval1Portal);
    sim1Portal.setState({
      ...sim1Portal.getState(),
      position: [8.8, 10.55, -13.6],
      prevPosition: [8.8, 10.55, -13.6],
      velocity: [7.5, 0, 0],
      status: 'racing',
    });
    for (let f = 0; f < 140; f++) {
      sim1Portal.stepFixed(
        1 / 120,
        { moveXZ: [1, 0], jumpPressed: false, respawnPressed: false },
        f / 120,
      );
    }
    const afterPortalFling = sim1Portal.getState();
    expect(afterPortalFling.portalCrossings ?? 0).toBeGreaterThanOrEqual(1);
    expect(afterPortalFling.position[0]).toBeGreaterThan(25.5); // Landed across the 12m chasm on Terrace 3!
    expect(afterPortalFling.status).toBe('racing');

    // Verify Stage 4 thin destructible CSG barrier blocks center at [29.1, 0.95, -48.6] before [F] Matter Bomb,
    // and is carved open after [F] Matter Bomb so the marble rolls straight through to Goal!
    expect(eval1Portal.distance([29.1, 0.95, -48.6], 1.5)).toBeLessThan(0);
    const bombRes = triggerWeaponAbility(
      'matterBomb',
      createInitialWeaponState(),
      afterPortalFling,
      [0, 0, -1],
      1.5,
      { targetPosition: [29.1, 0.95, -48.6], radius: 2.2 },
    );
    eval1Portal.setFieldMutations?.(bombRes.weaponState.mutations);
    expect(eval1Portal.distance([29.1, 0.95, -48.6], 1.5)).toBeGreaterThan(0.8);

    // Course 2: Beginner Chutes (start -> safe chute -> confluence -> west bridge spine -> wave floor -> goal)
    const run2 = driveMarbleAlongWaypoints(COURSE_2_BEGINNER_CHUTES, COURSE_2_BEGINNER_CHUTES.startPos, [
      { target: [-2.4, 10.55, -3.5], captureRadius: 1.8 },
      { target: [-2.4, 6.15, -16.8], captureRadius: 2.2 },
      { target: [-1.5, 6.15, -19.6], captureRadius: 2.0 },
      { target: [-1.5, 6.15, -26.0], captureRadius: 1.8 },
      { target: [0, 6.15, -31.2], captureRadius: 2.2 },
      { target: [0, 6.15, -38.0], captureRadius: 2.2 },
      { target: COURSE_2_BEGINNER_CHUTES.goalPos, captureRadius: 2.0 },
    ]);
    expect(run2.reachedGoal).toBe(true);
    expect(run2.finalState.status).toBe('goal');

    // Course 3: Intermediate Madness (full run from startPos across ice plaza, piston ramp, wave floor & tight catwalk to goal)
    const run3 = driveMarbleAlongWaypoints(
      COURSE_3_INTERMEDIATE_MADNESS,
      COURSE_3_INTERMEDIATE_MADNESS.startPos,
      [
        { target: [1.2, 7.35, -13.0], captureRadius: 2.2 },
        { target: [1.6, 7.35, -18.5], captureRadius: 2.0 },
        { target: [2.2, 4.35, -26.8], captureRadius: 2.4 },
        { target: [12.2, 4.35, -26.8], captureRadius: 2.2 },
        { target: [21.2, 4.35, -27.2], captureRadius: 1.8 },
        { target: [21.6, 3.5, -31.8], captureRadius: 1.6 },
        { target: COURSE_3_INTERMEDIATE_MADNESS.goalPos, captureRadius: 2.0 },
      ],
    );
    expect(run3.reachedGoal).toBe(true);
    expect(run3.finalState.status).toBe('goal');

    // Course 4: Aerial Catwalks (start -> suspended ridge -> island 1 -> conveyor span -> island 2 -> catwalk -> goal)
    const run4 = driveMarbleAlongWaypoints(COURSE_4_AERIAL_CATWALKS, COURSE_4_AERIAL_CATWALKS.startPos, [
      { target: [0, 10.55, -12.0], captureRadius: 2.0 },
      { target: [0, 10.55, -25.2], captureRadius: 2.2 },
      { target: [1.2, 10.55, -28.0], captureRadius: 1.6 },
      { target: [1.2, 7.35, -36.5], captureRadius: 2.0 },
      { target: [5.5, 7.35, -39.2], captureRadius: 2.0 },
      { target: [11.6, 5.8, -39.2], captureRadius: 2.0 },
      { target: COURSE_4_AERIAL_CATWALKS.goalPos, captureRadius: 2.0 },
    ]);
    expect(run4.reachedGoal).toBe(true);
    expect(run4.finalState.status).toBe('goal');

    // Course 5: Silly Race (uphill from low start -> escalator 1 -> bumper forest -> escalator 2 -> summit goal)
    const run5 = driveMarbleAlongWaypoints(COURSE_5_SILLY_RACE, COURSE_5_SILLY_RACE.startPos, [
      { target: [-0.4, 1.75, -3.5], captureRadius: 1.8 },
      { target: [-0.6, 5.35, -14.2], captureRadius: 2.0 },
      { target: [-0.6, 5.35, -25.0], captureRadius: 2.0 },
      { target: [-0.4, 8.95, -36.2], captureRadius: 2.0 },
      { target: COURSE_5_SILLY_RACE.goalPos, captureRadius: 2.0 },
    ]);
    expect(run5.reachedGoal).toBe(true);
    expect(run5.finalState.status).toBe('goal');

    // Course 6: Ultimate Argon Core (full run from startPos down banked chute, piston deck, east split, wave surge & final leap to goal)
    const run6 = driveMarbleAlongWaypoints(
      COURSE_6_ULTIMATE_ARGON_CORE,
      COURSE_6_ULTIMATE_ARGON_CORE.startPos,
      [
        { target: [0, 10.75, -15.0], captureRadius: 2.2 },
        { target: [2.6, 10.75, -25.8], captureRadius: 1.8 },
        { target: [2.8, 6.75, -39.0], captureRadius: 2.0 },
        { target: [0, 6.75, -42.0], captureRadius: 2.0 },
        { target: [0, 6.75, -47.0], captureRadius: 2.0 },
        { target: [0, 4.5, -52.5], captureRadius: 2.0 },
        { target: COURSE_6_ULTIMATE_ARGON_CORE.goalPos, captureRadius: 2.0 },
      ],
    );
    expect(run6.reachedGoal).toBe(true);
    expect(run6.finalState.status).toBe('goal');

    // Course 8: Riptide Surf Break (Beach Boardwalk -> Ankle-Biter Swells -> West Rip Channel -> Pier Pilings -> Outer Reef Bomb -> Lighthouse Goal)
    const run8 = driveMarbleAlongWaypoints(
      COURSE_8_RIPTIDE_SURF,
      COURSE_8_RIPTIDE_SURF.startPos,
      [
        { target: [0, 6.8, -5.8], captureRadius: 2.2 },
        { target: [-1.4, 6.15, -11.5], captureRadius: 2.2 },
        { target: [-3.6, 6.15, -16.8], captureRadius: 2.0 },
        { target: [-3.6, 6.15, -28.6], captureRadius: 2.2 },
        { target: [0, 6.15, -32.2], captureRadius: 2.2 },
        { target: [0, 6.15, -40.4], captureRadius: 2.2 },
        { target: [0, 6.15, -49.2], captureRadius: 2.2 },
        { target: COURSE_8_RIPTIDE_SURF.goalPos, captureRadius: 2.2 },
      ],
      3000,
    );
    expect(run8.reachedGoal).toBe(true);
    expect(run8.finalState.status).toBe('goal');

    // Course 9: Neon Sky Obby (Start -> Rainbow Stepping Stones -> Spinner Bridge -> Trampoline Staircase -> Crosswind Wave Beam -> Obby Winner Podium)
    const run9 = driveMarbleAlongWaypoints(
      COURSE_9_NEON_OBBY,
      COURSE_9_NEON_OBBY.startPos,
      [
        { target: [0, 10.55, -16.5], captureRadius: 2.2 },
        { target: [1.2, 10.55, -21.8], captureRadius: 2.2 },
        { target: [-1.2, 10.55, -27.2], captureRadius: 2.2 },
        { target: [-0.6, 10.55, -32.8], captureRadius: 2.2 },
        { target: [-0.6, 13.55, -48.5], captureRadius: 2.4 },
        { target: COURSE_9_NEON_OBBY.goalPos, captureRadius: 2.2 },
      ],
      3000,
    );
    expect(run9.reachedGoal).toBe(true);
    expect(run9.finalState.status).toBe('goal');

    // Course 10: Sahara Dune Surge (Caravan Outpost -> Barchan Sand Ripples -> Trade-Wind Jetstream -> Sandstone Hoodoos -> Mega-Dune Oasis Goal)
    const run10 = driveMarbleAlongWaypoints(
      COURSE_10_SAHARA_DUNES,
      COURSE_10_SAHARA_DUNES.startPos,
      [
        { target: [0, 6.8, -5.8], captureRadius: 2.2 },
        { target: [-1.4, 6.15, -11.5], captureRadius: 2.2 },
        { target: [-3.6, 6.15, -16.8], captureRadius: 2.0 },
        { target: [-3.6, 6.15, -28.6], captureRadius: 2.2 },
        { target: [0, 6.15, -32.2], captureRadius: 2.2 },
        { target: [0, 6.15, -40.4], captureRadius: 2.2 },
        { target: [0, 6.15, -49.2], captureRadius: 2.2 },
        { target: COURSE_10_SAHARA_DUNES.goalPos, captureRadius: 2.2 },
      ],
      3000,
    );
    expect(run10.reachedGoal).toBe(true);
    expect(run10.finalState.status).toBe('goal');
  });

  it('verifies risk/reward speedrun shortcuts and split paths across the campaign', () => {
    // Course 2 East Narrow High-Banked Turbo Chute accelerates faster than the West Safe Chute
    const eval2 = createCpuWorldEvaluator(COURSE_2_BEGINNER_CHUTES);
    const simSafe = createMarbleSimulation(COURSE_2_BEGINNER_CHUTES, eval2);
    const simTurbo = createMarbleSimulation(COURSE_2_BEGINNER_CHUTES, eval2);

    simSafe.setState({
      ...simSafe.getState(),
      position: [-2.4, 10.55, -3.5],
      prevPosition: [-2.4, 10.55, -3.5],
    });
    simTurbo.setState({
      ...simTurbo.getState(),
      position: [2.8, 10.55, -3.5],
      prevPosition: [2.8, 10.55, -3.5],
    });

    for (let i = 0; i < 65; i++) {
      const t = i / 120;
      simSafe.stepFixed(1 / 120, { moveXZ: [0, -1], jumpPressed: false, respawnPressed: false }, t);
      simTurbo.stepFixed(1 / 120, { moveXZ: [0, -1], jumpPressed: false, respawnPressed: false }, t);
    }

    // Turbo chute has conveyor boost, so it travels further along -Z in the same 65 frames
    expect(simTurbo.getState().position[2]).toBeLessThan(simSafe.getState().position[2] - 1.5);

    // Course 6 West Ice Split Path reaches the Convergence Plaza cleanly
    const run6IceSplit = driveMarbleAlongWaypoints(
      COURSE_6_ULTIMATE_ARGON_CORE,
      [-2.8, 10.75, -26.4],
      [
        { target: [-2.8, 6.75, -39.0], captureRadius: 2.0 },
        { target: [0, 6.75, -42.0], captureRadius: 2.0 },
        { target: [0, 6.75, -47.0], captureRadius: 2.0 },
        { target: [0, 4.5, -52.5], captureRadius: 2.0 },
        { target: COURSE_6_ULTIMATE_ARGON_CORE.goalPos, captureRadius: 2.0 },
      ],
    );
    expect(run6IceSplit.reachedGoal).toBe(true);
    expect(run6IceSplit.finalState.status).toBe('goal');
  });

  it('reaches status === "goal" on all 6 campaign courses in both tourist and speedrunner bot rollouts (12/12 passing)', () => {
    for (const course of BUILT_IN_COURSES) {
      for (const style of ['tourist', 'speedrunner'] as const) {
        const rollout = runHeadlessBotRollout(course, {
          style,
          maxDurationSec: course.parTimeSec,
          seed: 2026,
        });
        expect(
          rollout.summary.reachedGoal,
          `Course ${course.index} (${course.id}) [${style}] should reach goal (outcome: ${rollout.summary.outcome})`,
        ).toBe(true);
        expect(rollout.finalState.status).toBe('goal');
      }
    }
  });
});
