import { describe, expect, it } from 'vitest';
import type { PortalPair } from '../src/contracts';
import {
  BUILT_IN_COURSES,
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
} from '../src/courses';
import { createMarbleSimulation } from '../src/physics';
import {
  DEFAULT_PORTAL_COOLDOWN_SEC,
  DEFAULT_PORTAL_FLING_BOOST,
  DEFAULT_PORTAL_MIN_EXIT_SPEED,
  DEFAULT_PORTAL_RADIUS,
  computePortalBasis,
  evaluatePortalThroatCarve,
  getDefaultCoursePortals,
  placeSmartPortalBridge,
  raycastAndPlacePortal,
  raycastPortalAimPreview,
  tracePortalRayCpu,
  transformPointAcrossPortal,
  transformQuatAcrossPortal,
  transformVectorAcrossPortal,
} from '../src/portals';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import { createCpuWorldEvaluator, vec3Length } from '../src/sdf/eval-cpu';
import {
  appendFieldMutation,
  createInitialWeaponState,
  stepWeaponController,
  triggerWeaponAbility,
} from '../src/weapons';

describe('Stage 2 Worker 2 — Raymarched SDF Portals & Realtime CSG Level-Mutating Weapons', () => {
  it('transforms points, velocities, angular velocities, and quaternions across portals with 100% speed preservation', () => {
    // Portal A: flat on the floor (normal = +Y)
    const basisA = computePortalBasis([0, 1, 0], [0, 0, -1]);
    // Portal B: tilted 45 deg ramp facing -Z/+Y
    const invSqrt2 = Math.SQRT1_2;
    const basisB = computePortalBasis([0, invSqrt2, -invSqrt2], [0, invSqrt2, invSqrt2]);

    // Marble diving straight down into Portal A at 22.5 u/s
    const incomingVel = [0, -22.5, 0] as const;
    const incomingOmega = [14.0, 0, -6.5] as const;

    const exitVel = transformVectorAcrossPortal(incomingVel, basisA, basisB);
    const exitOmega = transformVectorAcrossPortal(incomingOmega, basisA, basisB);

    // 100% scalar speed ||v|| and spin ||omega|| preservation
    expect(vec3Length(exitVel)).toBeCloseTo(vec3Length(incomingVel), 5);
    expect(vec3Length(exitOmega)).toBeCloseTo(vec3Length(incomingOmega), 5);

    // Exiting along +normalB = [0, +0.7071, -0.7071] * 22.5
    expect(exitVel[1]).toBeCloseTo(22.5 * invSqrt2, 4);
    expect(exitVel[2]).toBeCloseTo(-22.5 * invSqrt2, 4);

    // Point & quaternion transform sanity check
    const pOut = transformPointAcrossPortal([0.2, 0.0, -0.3], [0, 0, 0], basisA, [10, 5, -20], basisB);
    expect(Number.isFinite(pOut[0]) && Number.isFinite(pOut[1]) && Number.isFinite(pOut[2])).toBe(true);

    const qOut = transformQuatAcrossPortal([0, 0, 0, 1], basisA, basisB);
    expect(Math.hypot(qOut[0], qOut[1], qOut[2], qOut[3])).toBeCloseTo(1.0, 5);
  });

  it('carves a CSG throat cylinder behind active portals and teleports a diving marble at 120 Hz ("Speedy marble goes in, speedy marble comes out")', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const invSqrt2 = Math.SQRT1_2;

    const flingPortalPair: PortalPair = {
      id: 'test-fling-pair',
      // Blue Portal A on the Start Podium floor at [0, 8.2, 0]
      posA: [0, 8.2, 0],
      normalA: [0, 1, 0],
      upA: [0, 0, -1],
      // Orange Portal B high above the Abyss Bridge tilted 45 deg toward the Goal Podium
      posB: [24.6, 4.0, -22.0],
      normalB: [0, invSqrt2, -invSqrt2],
      upB: [0, invSqrt2, invSqrt2],
      radius: 1.5,
      activeA: true,
      activeB: true,
      flingBoost: 1.0,
    };

    // Before adding portal throat: floor at [0, 7.9, 0] is solid (distance < 0)
    evaluator.setPortals?.([]);
    expect(evaluator.distance([0, 7.9, 0], 0)).toBeLessThan(0);

    // After activating portal pair: throat cylinder is carved out so [0, 7.9, 0] is open (distance > 0)
    evaluator.setPortals?.([flingPortalPair]);
    expect(evaluatePortalThroatCarve([0, 7.9, 0], [flingPortalPair])).toBeLessThan(0);
    expect(evaluator.distance([0, 7.9, 0], 0)).toBeGreaterThan(0.2);

    // Drop marble from above Blue Portal A with downward velocity -18 u/s
    const sim = createMarbleSimulation(COURSE_1_PRACTICE_RACE, evaluator);
    sim.setState({
      ...sim.getState(),
      position: [0, 8.65, 0],
      prevPosition: [0, 8.65, 0],
      velocity: [0, -18.0, 0],
      angularVelocity: [12.0, 0, 0],
      contact: {
        ...sim.getState().contact,
        grounded: false,
      },
    });

    let crossedAtStep = -1;
    for (let step = 0; step < 15; step++) {
      const s = sim.stepFixed(
        1 / 120,
        { moveXZ: [0, 0], jumpPressed: false, respawnPressed: false },
        (step + 1) / 120,
      );
      if ((s.portalCrossings ?? 0) > 0) {
        crossedAtStep = step;
        break;
      }
    }

    expect(crossedAtStep).toBeGreaterThanOrEqual(0);
    const afterFling = sim.getState();
    expect(afterFling.portalCrossings).toBe(1);
    // Teleported to Orange Portal B at [24.6, ~4.4, ~-22.4]
    expect(Math.hypot(afterFling.position[0] - 24.6, afterFling.position[2] - -22.0)).toBeLessThan(1.5);
    // High exit speed (> 18 u/s due to gravity before crossing) launched at 45 deg (+Y, -Z)
    expect(vec3Length(afterFling.velocity)).toBeGreaterThan(18.0);
    expect(afterFling.velocity[1]).toBeGreaterThan(12.0);
    expect(afterFling.velocity[2]).toBeLessThan(-12.0);
  });

  it('supports raymarched non-Euclidean portal ray hops (up to 2 hops) and player Portal Gun SDF raycasting ([Q] / [E])', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const portals = evaluator.getPortals?.() ?? [];
    expect(portals.length).toBeGreaterThan(0);

    // Fire a ray straight into Blue Portal A's aperture face along -normalA
    const pair0 = portals[0];
    const rayOrigin = [
      pair0.posA[0] + pair0.normalA[0] * 2.0,
      pair0.posA[1] + pair0.normalA[1] * 2.0,
      pair0.posA[2] + pair0.normalA[2] * 2.0,
    ] as const;
    const rayDir = [
      -pair0.normalA[0],
      -pair0.normalA[1],
      -pair0.normalA[2],
    ] as const;

    const trace = tracePortalRayCpu(rayOrigin, rayDir, portals, evaluator, 0, 2);
    expect(trace.portalHops).toBeGreaterThanOrEqual(1);
    expect(trace.traversedPairIds).toContain(pair0.id);

    // Test player Portal Gun placement ([Q] Blue Portal / [E] Orange Portal) onto Start Podium floor
    const relocatedBlue = raycastAndPlacePortal(
      'blue',
      pair0,
      [0, 9.5, 0],
      [0, -1, 0],
      evaluator,
      0,
    );
    expect(relocatedBlue.hitPos[1]).toBeCloseTo(8.24, 1);
    expect(relocatedBlue.hitNormal[1]).toBeGreaterThan(0.9);
  });

  it('evaluates all 4 Realtime CSG Weapons ([F] Matter Bomb, [V] Ferrofluid Bridge, [B] Tectonic Pop-Ramp, [N] Cryo Freeze) in lockstep', () => {
    const eval1 = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim1 = createMarbleSimulation(COURSE_1_PRACTICE_RACE, eval1);
    let wState = createInitialWeaponState();

    // 1. [F] CSG Matter Bomb / Crater Cannon (subtractSphere)
    const craterTarget = [0, 8.2, -1.5] as const;
    expect(eval1.distance(craterTarget, 0)).toBeLessThan(0.05);

    const bombRes = triggerWeaponAbility(
      'matterBomb',
      wState,
      sim1.getState(),
      [0, 0, -1],
      1.0,
      { targetPosition: craterTarget, radius: 1.8 },
    );
    wState = bombRes.weaponState;
    eval1.setFieldMutations?.(wState.mutations);

    // Point at craterTarget is now carved out into open air (distance > 1.2m)
    expect(eval1.distance(craterTarget, 1.0)).toBeGreaterThan(1.2);

    // 2. [V] Ferrofluid Bridge Extruder (unionCapsule trail over thin air for 3.5s)
    // Teleport marble to the cliff edge of Start Podium and drive off into the abyss (+X)
    sim1.setState({
      ...sim1.getState(),
      position: [3.5, 8.75, 0],
      prevPosition: [3.5, 8.75, 0],
      velocity: [9.0, 0, 0],
    });
    const bridgeStart = triggerWeaponAbility(
      'bridgeExtruder',
      wState,
      sim1.getState(),
      [1, 0, 0],
      2.0,
    );
    wState = bridgeStart.weaponState;
    eval1.setFieldMutations?.(wState.mutations);

    // Roll 60 frames (0.5s) off the cliff into thin air at x > 4.0..8.5 while extruding bridge
    for (let i = 0; i < 60; i++) {
      const t = 2.0 + (i + 1) / 120;
      const wStep = stepWeaponController(wState, sim1.getState(), [1, 0, 0], 1 / 120, t);
      wState = wStep.weaponState;
      eval1.setFieldMutations?.(wState.mutations);
      sim1.setState(wStep.marbleState);
      sim1.stepFixed(1 / 120, { moveXZ: [1, 0], jumpPressed: false, respawnPressed: false }, t);
    }

    const afterBridgeMarble = sim1.getState();
    // Marble drove well past the cliff edge (x > 6.5) over the abyss without falling!
    expect(afterBridgeMarble.position[0]).toBeGreaterThan(6.5);
    expect(afterBridgeMarble.position[1]).toBeGreaterThan(8.2);
    expect(wState.mutations.filter((m) => m.kind === 'unionCapsule').length).toBeGreaterThanOrEqual(2);

    // 3. [B] Tectonic Pop-Ramp (unionRamp wedge + upward impulse)
    const rampRes = triggerWeaponAbility(
      'popRamp',
      wState,
      sim1.getState(),
      [1, 0, 0],
      3.0,
    );
    wState = rampRes.weaponState;
    eval1.setFieldMutations?.(wState.mutations);
    expect(rampRes.marbleState.velocity[1]).toBeGreaterThan(11.0);
    expect(wState.mutations.some((m) => m.kind === 'unionRamp')).toBe(true);

    // 4. [N] Cryo Freeze Pulse (materialOverride sphere: lethal acid -> fast ice)
    const eval2 = createCpuWorldEvaluator(COURSE_2_INTERMEDIATE_MADNESS);
    const acidPoint = [21.0, 0.65, -32.2] as const;
    expect(eval2.sample(acidPoint, 0).material).toBe('acid');

    const cryoRes = triggerWeaponAbility(
      'cryoFreeze',
      createInitialWeaponState(),
      sim1.getState(),
      [0, 0, -1],
      4.0,
      { targetPosition: acidPoint, radius: 5.5 },
    );
    eval2.setFieldMutations?.(cryoRes.weaponState.mutations);
    expect(eval2.sample(acidPoint, 4.0).material).toBe('ice');

    // Verify ring buffer caps at MAX_FIELD_MUTATIONS = 16
    let ring: ReturnType<typeof appendFieldMutation> = [];
    for (let i = 0; i < 24; i++) {
      ring = appendFieldMutation(
        ring,
        {
          id: `m-${i}`,
          kind: 'subtractSphere',
          posA: [i, 0, 0],
          posB: [0, 0, 0],
          radius: 1.0,
          blendK: 0.25,
          material: 'standard',
          spawnTime: 0,
          ttl: 30,
        },
        1.0,
      );
    }
    expect(ring.length).toBe(16);
    expect(ring[0].id).toBe('m-8');
    expect(ring[15].id).toBe('m-23');
  });

  it('compiles GLSL ES 3.00 and WGSL shaders with uMutations ring buffer and non-Euclidean portal hop uniforms', () => {
    const glsl = compileCourseToGlsl(COURSE_1_PRACTICE_RACE);
    const wgsl = compileCourseToWgsl(COURSE_1_PRACTICE_RACE);

    expect(glsl).toContain('uMutationCount');
    expect(glsl).toContain('uMutationsPosA');
    expect(glsl).toContain('applyFieldMutations');
    expect(glsl).toContain('uPortalPairCount');
    expect(glsl).toContain('evalPortalApertures');
    expect(glsl).toContain('portalHops');
    expect(glsl).toContain('uPortalAimPos');
    expect(glsl).toContain('uPortalAimNormal');
    expect(glsl).toContain('vortexChevron');

    expect(wgsl).toContain('uMutationsPosA');
    expect(wgsl).toContain('fn applyFieldMutations');
    expect(wgsl).toContain('fn transformPortalRay');
  });

  it('spawns pre-placed always-on landmark portal pairs (getDefaultCoursePortals) on every course with r=1.55 and 1.25x fling boost', () => {
    for (const course of BUILT_IN_COURSES) {
      const portals = getDefaultCoursePortals(course);
      expect(portals.length).toBeGreaterThanOrEqual(1);
      const primary = portals[0];
      expect(primary.activeA).toBe(true);
      expect(primary.activeB).toBe(true);
      expect(primary.radius).toBeGreaterThanOrEqual(DEFAULT_PORTAL_RADIUS);
      expect(primary.flingBoost).toBeGreaterThanOrEqual(DEFAULT_PORTAL_FLING_BOOST);

      // CpuWorldEvaluator also auto-populates landmark portals
      const evaluator = createCpuWorldEvaluator(course);
      const evalPortals = evaluator.getPortals?.() ?? [];
      expect(evalPortals.length).toBeGreaterThanOrEqual(1);
      expect(evalPortals[0].radius).toBeGreaterThanOrEqual(1.55);
    }
  });

  it('supports 1-key Smart Portal Bridge ([Q]), live 3D cursor raycast aim preview ([E]), 2.5R Magnetic Capture Funnel, and guaranteed 14.5+ u/s fling', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim = createMarbleSimulation(COURSE_1_PRACTICE_RACE, evaluator);

    // 1. [Q] 1-Key Smart Portal Bridge places Blue Entry ~3.5m ahead facing the marble and Orange Exit on the next checkpoint angled toward goal
    const smartPair = placeSmartPortalBridge(
      sim.getState(),
      COURSE_1_PRACTICE_RACE,
      evaluator,
      [0, -1],
      0,
      evaluator.getPortals?.()[0],
    );
    expect(smartPair.activeA).toBe(true);
    expect(smartPair.activeB).toBe(true);
    expect(smartPair.radius).toBeCloseTo(DEFAULT_PORTAL_RADIUS, 3);
    expect(smartPair.flingBoost).toBeCloseTo(DEFAULT_PORTAL_FLING_BOOST, 3);
    // Blue Entry placed ~3.5m ahead along -Z from start [0, 8.75, 0]
    expect(smartPair.posA[2]).toBeLessThan(-2.0);
    // Orange Exit placed ahead near checkpoint 1 / next terrace and angled upward + toward goal
    expect(smartPair.posB[2]).toBeLessThan(-13.5);
    expect(smartPair.normalB[1]).toBeGreaterThan(0.5);

    // 2. Live 3D Cursor Raycast Aim Preview ([E] / Right-Click / Alt+Click)
    const preview = raycastPortalAimPreview(
      'orange',
      [0, 12.0, -2.0],
      [0, -1, 0],
      evaluator,
      0,
    );
    expect(preview.active).toBe(true);
    expect(preview.radius).toBeCloseTo(DEFAULT_PORTAL_RADIUS, 3);
    expect(preview.position[1]).toBeCloseTo(8.24, 1);
    expect(preview.normal[1]).toBeGreaterThan(0.9);

    // 3. Magnetic Capture Funnel (within 2.5R) & Guaranteed Minimum Exit Speed (14.5+ u/s even from a slow 2.0 u/s roll)
    const testPair: PortalPair = {
      id: 'funnel-and-min-speed-test',
      posA: [0, 8.75, -4.0],
      normalA: [0, 0, 1], // Facing +Z toward the marble at z = 0
      upA: [0, 1, 0],
      posB: [24.6, 5.0, -22.0],
      normalB: [0, Math.SQRT1_2, -Math.SQRT1_2],
      upB: [0, Math.SQRT1_2, Math.SQRT1_2],
      radius: DEFAULT_PORTAL_RADIUS,
      activeA: true,
      activeB: true,
      flingBoost: DEFAULT_PORTAL_FLING_BOOST,
    };
    evaluator.setPortals?.([testPair]);

    // Start marble off-center at x = +1.85 (outside 1.55R aperture, inside 2.5R = 3.875m magnetic funnel) rolling slowly at 2.5 u/s toward -Z
    sim.setState({
      ...sim.getState(),
      position: [1.85, 8.75, -1.6],
      prevPosition: [1.85, 8.75, -1.6],
      velocity: [0, 0, -2.5],
      portalCrossings: 0,
      portalCooldown: 0,
    });

    let crossed = false;
    for (let step = 0; step < 140; step++) {
      const s = sim.stepFixed(
        1 / 120,
        { moveXZ: [0, -0.4], jumpPressed: false, respawnPressed: false },
        (step + 1) / 120,
      );
      if ((s.portalCrossings ?? 0) > 0) {
        crossed = true;
        break;
      }
    }

    // Magnetic capture funnel pulled the off-center marble into the aperture and flung it out at >= 14.5 u/s!
    expect(crossed).toBe(true);
    const flungState = sim.getState();
    expect(vec3Length(flungState.velocity)).toBeGreaterThanOrEqual(DEFAULT_PORTAL_MIN_EXIT_SPEED - 0.5);
    expect(flungState.portalCooldown).toBeGreaterThanOrEqual(DEFAULT_PORTAL_COOLDOWN_SEC - 0.02);
  });
});
