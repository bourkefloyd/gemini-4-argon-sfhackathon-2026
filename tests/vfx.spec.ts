import { describe, expect, it } from 'vitest';
import { COURSE_1_PRACTICE_RACE } from '../src/courses';
import { createInitialMarbleState } from '../src/physics';
import { createCpuWorldEvaluator, vec3Length, vec3Sub } from '../src/sdf/eval-cpu';
import {
  MAX_SHATTER_SHARDS,
  MAX_SHOCKWAVE_RINGS,
  MIN_SHATTER_SHARDS,
  createShatterSimulator,
  createShockwaveManager,
  evalShatterClusterSdfCpu,
  evalVortexSurfaceHeightLocal,
  evaluateMarbleMuncherPose,
  evaluateMuncherInteraction,
  evaluateRimDanger,
  evaluateVortexDynamics,
  getExoticHazardsShaderSnippet,
  getShatterShaderSnippet,
  getShockwaveShaderSnippet,
  sdMarbleMuncher,
  sdVortexFunnel,
} from '../src/vfx';

describe('Stage 2 Worker 6 — Raymarched Glass Shatter, Shockwave Contours & Exotic SDF Hazards', () => {
  it('simulates 8–12 ballistic glass shards bouncing on the CPU SDF floor for 1.2s and packs uShatterShards', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const shatterSim = createShatterSimulator({
      shardCount: 10,
      ballisticDurationSec: 1.2,
      sweepDurationSec: 0.55,
    });

    const initialMarble = createInitialMarbleState(COURSE_1_PRACTICE_RACE);
    const shatteredMarble = {
      ...initialMarble,
      position: [0, 8.6, 0] as const,
      velocity: [2.0, -34.0, -3.5] as const,
      status: 'shattered' as const,
      respawnPos: [0, 8.55, 0] as const,
      contact: {
        ...initialMarble.contact,
        grounded: true,
        normal: [0, 1, 0] as const,
        impactSpeed: 34.0,
      },
    };

    // Transition into 'shattered' triggers shard burst
    const burstState = shatterSim.syncWithMarbleState(shatteredMarble, evaluator, 0, 0);
    expect(burstState.active).toBe(true);
    expect(burstState.phase).toBe('ballistic');
    expect(burstState.shards.length).toBeGreaterThanOrEqual(MIN_SHATTER_SHARDS);
    expect(burstState.shards.length).toBeLessThanOrEqual(MAX_SHATTER_SHARDS);
    expect(burstState.shards.length).toBe(10);

    // Step 1.15s (within the 1.2s ballistic bounce window) at 60 Hz
    const dt = 1 / 60;
    let current = burstState;
    for (let step = 0; step < 69; step++) {
      current = shatterSim.step(dt, evaluator, step * dt);
    }

    expect(current.phase).toBe('ballistic');
    expect(current.elapsedSec).toBeCloseTo(1.15, 2);
    expect(current.whiskBroom.active).toBe(false);

    // Verify shards bounced against the Course 1 start platform SDF floor
    const totalBounces = current.shards.reduce((acc, s) => acc + s.bounceCount, 0);
    expect(totalBounces).toBeGreaterThan(0);

    // Verify uShatterShards uniform packing (12 * vec4 = 48 floats)
    const packed = shatterSim.packUniforms();
    expect(packed.length).toBe(MAX_SHATTER_SHARDS * 4);
    for (let i = 0; i < 10; i++) {
      expect(packed[i * 4 + 3]).toBeGreaterThan(0.05);
    }
    // Unused slots 10 & 11 have radius 0
    expect(packed[10 * 4 + 3]).toBe(0);
    expect(packed[11 * 4 + 3]).toBe(0);

    // Verify CPU shard cluster SDF evaluation is negative at a shard center
    const s0 = current.shards[0];
    expect(evalShatterClusterSdfCpu(s0.position, current.shards)).toBeLessThan(0);

    // Verify GLSL2 & WGSL shader snippet generation
    const snippet = getShatterShaderSnippet();
    expect(snippet.uniformName).toBe('uShatterShards');
    expect(snippet.maxShards).toBe(12);
    expect(snippet.glsl).toContain('uniform vec4 uShatterShards[MAX_SHATTER_SHARDS]');
    expect(snippet.glsl).toContain('evalShatterShardsSdf');
    expect(snippet.glsl).toContain('shadeShatterGlassShard');
    expect(snippet.wgsl).toContain('fn evalShatterShardsSdf');
    expect(snippet.wgsl).toContain('fn shadeShatterGlassShard');
  });

  it('sweeps and converges scattered shards back to checkpoint respawnPos via Whisk-Broom reassembly after 1.2s', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const shatterSim = createShatterSimulator({
      shardCount: 10,
      ballisticDurationSec: 1.2,
      sweepDurationSec: 0.55,
    });

    const checkpointSpawn = [-2.5, 8.55, -4.0] as const;
    shatterSim.trigger({
      position: [0, 8.6, 0],
      velocity: [1.5, -32.0, -2.0],
      radius: 0.55,
      respawnPos: checkpointSpawn,
      impactNormal: [0, 1, 0],
      impactSpeed: 32.0,
    });

    // Advance exactly 1.2s to finish ballistic scatter
    for (let i = 0; i < 72; i++) {
      shatterSim.step(1 / 60, evaluator, i / 60);
    }

    // Advance 0.25s into the whisk-broom sweep phase (elapsed = 1.45s)
    const midSweep = shatterSim.step(0.25, evaluator, 1.2);
    expect(midSweep.phase).toBe('whisk_sweep');
    expect(midSweep.whiskBroom.active).toBe(true);
    expect(midSweep.whiskBroom.progress).toBeGreaterThan(0.35);
    expect(midSweep.whiskBroom.progress).toBeLessThan(0.65);

    const midSpread = midSweep.shards.reduce(
      (sum, s) => sum + vec3Length(vec3Sub(s.position, checkpointSpawn)),
      0,
    );

    // Advance another 0.2s (elapsed = 1.65s, near end of sweep)
    const lateSweep = shatterSim.step(0.2, evaluator, 1.45);
    const lateSpread = lateSweep.shards.reduce(
      (sum, s) => sum + vec3Length(vec3Sub(s.position, checkpointSpawn)),
      0,
    );
    expect(lateSpread).toBeLessThan(midSpread);

    // Advance past totalDurationSec (1.75s) -> complete convergence at checkpointSpawn
    const completed = shatterSim.step(0.15, evaluator, 1.65);
    expect(completed.phase).toBe('complete');
    expect(completed.active).toBe(false);
    for (const shard of completed.shards) {
      const distToSpawn = vec3Length(vec3Sub(shard.position, checkpointSpawn));
      expect(distToSpawn).toBeLessThan(1e-3);
    }
  });

  it('tracks up to 4 expanding SDF shockwave rings, decays intensity, and evaluates Rim-Danger pulse', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const manager = createShockwaveManager();

    const r1 = manager.trigger({ kind: 'hard_landing', center: [0, 8.0, 0] });
    const r2 = manager.trigger({ kind: 'bumper_hit', center: [2, 8.0, -3] });
    const r3 = manager.trigger({ kind: 'portal_exit', center: [-2, 6.0, -8] });
    const r4 = manager.trigger({ kind: 'crater_blast', center: [0, 5.0, -12] });

    expect(manager.getActiveRings().length).toBe(MAX_SHOCKWAVE_RINGS);
    expect([r1.slotIndex, r2.slotIndex, r3.slotIndex, r4.slotIndex].sort()).toEqual([0, 1, 2, 3]);

    // Step 0.25s and verify radius expansion & monotonic intensity decay
    const initialR1Radius = r1.currentRadius;
    const initialR1Intensity = r1.intensity;
    manager.step(0.25);

    const updatedR1 = manager.getRings()[r1.slotIndex];
    expect(updatedR1.currentRadius).toBeGreaterThan(initialR1Radius);
    expect(updatedR1.intensity).toBeLessThan(initialR1Intensity);
    expect(updatedR1.intensity).toBeGreaterThan(0);

    // Sample contour illumination right on the expanding wavefront of ring 1
    const sampleOnWavefront = manager.evaluateAtPoint([
      updatedR1.center[0] + updatedR1.currentRadius,
      updatedR1.center[1],
      updatedR1.center[2],
    ]);
    expect(sampleOnWavefront.totalIntensity).toBeGreaterThan(0.2);
    expect(sampleOnWavefront.gridLineBoost).toBeGreaterThan(1.4);

    // Triggering a 5th ring evicts the lowest-intensity slot while keeping max 4 rings
    manager.trigger({ kind: 'crater_blast', center: [1, 8.0, 1], intensity: 1.5 });
    expect(manager.getActiveRings().length).toBe(MAX_SHOCKWAVE_RINGS);

    // Step past all ring durations -> all rings decay to 0 and deactivate
    manager.step(2.0);
    expect(manager.getActiveRings().length).toBe(0);

    // Verify Rim-Danger Pulse: safe at platform center vs. high danger at unrailed cliff lip
    const baseMarble = createInitialMarbleState(COURSE_1_PRACTICE_RACE);
    const safeDanger = evaluateRimDanger(baseMarble, evaluator, 0.5);
    expect(safeDanger.rimProximity).toBe(0);
    expect(safeDanger.inDangerZone).toBe(false);

    // Course 1 start platform has halfExtents [4.5, 0.6, 4.5] centered at [0, 7.4, 0] -> edge at x = 4.5
    const cliffEdgeMarble = {
      ...baseMarble,
      position: [4.35, 8.55, 0] as const,
      velocity: [5.0, 0, 0] as const,
    };
    const edgeDanger = manager.updateRimDanger(cliffEdgeMarble, evaluator, 0.5);
    expect(edgeDanger.rimProximity).toBeGreaterThan(0.4);
    expect(edgeDanger.inDangerZone).toBe(true);
    expect(edgeDanger.cliffDirection[0]).toBeGreaterThan(0.7);

    const uniforms = manager.packUniforms();
    expect(uniforms.uShockwaveRings.length).toBe(16);
    expect(uniforms.uShockwaveParams.length).toBe(16);
    expect(uniforms.uRimDanger[0]).toBeCloseTo(edgeDanger.rimProximity, 4);

    const shaderSnippet = getShockwaveShaderSnippet();
    expect(shaderSnippet.glsl).toContain('applyShockwaveAndRimContours');
    expect(shaderSnippet.wgsl).toContain('fn applyShockwaveAndRimContours');
  });

  it('evaluates Suction Vortex Funnel (sdVortexFunnel) SDF and centripetal pull vs. rim-orbit sling physics', () => {
    const vortexParams = {
      center: [0, 0, 0] as const,
      outerRadius: 3.0,
      throatRadius: 0.5,
      depth: 2.0,
      wallThickness: 0.44,
      logCurvature: 6.0,
      suctionStrength: 18.0,
      rimOrbitSpeedThreshold: 8.5,
      rimSlingBoost: 7.0,
    };

    // 1. Logarithmic funnel profile height checks
    const hRim = evalVortexSurfaceHeightLocal(3.0, 3.0, 0.5, 2.0, 6.0);
    const hMid = evalVortexSurfaceHeightLocal(1.75, 3.0, 0.5, 2.0, 6.0);
    const hThroat = evalVortexSurfaceHeightLocal(0.5, 3.0, 0.5, 2.0, 6.0);
    expect(hRim).toBeCloseTo(0, 5);
    expect(hMid).toBeLessThan(-0.2);
    expect(hMid).toBeGreaterThan(-1.8);
    expect(hThroat).toBeCloseTo(-2.0, 5);

    // 2. Signed distance checks on sdVortexFunnel
    const dInsideWall = sdVortexFunnel([1.75, hMid - 0.22, 0], vortexParams);
    const dOnSurface = sdVortexFunnel([1.75, hMid, 0], vortexParams);
    const dHighAbove = sdVortexFunnel([1.75, 1.5, 0], vortexParams);
    expect(dInsideWall).toBeLessThan(0);
    expect(Math.abs(dOnSurface)).toBeLessThan(0.05);
    expect(dHighAbove).toBeGreaterThan(1.0);

    // 3. Low-speed marble in vortex gets pulled centripetally inward toward center
    const slowDyn = evaluateVortexDynamics(
      [2.2, 0, 0],
      [0, 0, 2.0], // tangential speed = 2.0 < 8.5 threshold
      vortexParams,
      1 / 60,
    );
    expect(slowDyn.inVortexZone).toBe(true);
    expect(slowDyn.isRimOrbiting).toBe(false);
    expect(slowDyn.acceleration[0]).toBeLessThan(-5.0); // Pulled inward (-X) toward center [0,0,0]

    // 4. High-speed tangential marble orbits the rim and slings out faster
    const fastInitialVel = [0, 0, 11.5] as const;
    const fastDyn = evaluateVortexDynamics(
      [2.5, 0, 0],
      fastInitialVel, // tangential speed = 11.5 >= 8.5 threshold
      vortexParams,
      1 / 60,
    );
    expect(fastDyn.inVortexZone).toBe(true);
    expect(fastDyn.isRimOrbiting).toBe(true);
    expect(vec3Length(fastDyn.nextVelocity)).toBeGreaterThan(vec3Length(fastInitialVel));
  });

  it('evaluates animated CSG Marble Muncher (sdMarbleMuncher) chomp cycle, patrol lunge, and interactions', () => {
    const muncherParams = {
      center: [0, 1.0, 0] as const,
      radius: 0.9,
      chompFrequency: 2.0,
      maxMouthAngleRad: 0.68,
      patrolSpan: [3.0, 0, 0] as const,
      patrolFrequency: 0.5,
      lungeHopHeight: 0.45,
      facingDir: [1, 0, 0] as const,
    };

    // At t = 0.125s (2.0 Hz * 0.125 = 0.25 cycle -> sin(pi/2) = 1.0 -> mouth wide open!)
    const openTime = 0.125;
    const openPose = evaluateMarbleMuncherPose(openTime, muncherParams);
    expect(openPose.mouthOpenRatio).toBeGreaterThan(0.95);

    // At t = 0.375s (2.0 Hz * 0.375 = 0.75 cycle -> sin(3pi/2) = -1.0 -> mouth snapped shut!)
    const closedTime = 0.375;
    const closedPose = evaluateMarbleMuncherPose(closedTime, muncherParams);
    expect(closedPose.mouthOpenRatio).toBeLessThan(0.02);

    // Verify patrol movement between t = 0 and t = 0.5s
    expect(Math.abs(openPose.position[0] - closedPose.position[0])).toBeGreaterThan(0.1);

    // Point inside the front mouth cavity (+X relative to muncher center)
    const frontMouthPointOpen = [
      openPose.position[0] + 0.55,
      openPose.position[1],
      openPose.position[2],
    ] as const;
    const frontMouthPointClosed = [
      closedPose.position[0] + 0.55,
      closedPose.position[1],
      closedPose.position[2],
    ] as const;

    const dMouthWhenOpen = sdMarbleMuncher(frontMouthPointOpen, openTime, muncherParams);
    const dMouthWhenClosed = sdMarbleMuncher(frontMouthPointClosed, closedTime, muncherParams);

    // Inside subtracted mouth cavity when open -> positive SDF (> 0)
    expect(dMouthWhenOpen).toBeGreaterThan(0.05);
    // Inside solid sphere jaw when snapped shut -> negative SDF (< 0)
    expect(dMouthWhenClosed).toBeLessThan(-0.15);

    // Rear of body is always solid (< 0)
    const rearPoint = [
      openPose.position[0] - 0.5,
      openPose.position[1],
      openPose.position[2],
    ] as const;
    expect(sdMarbleMuncher(rearPoint, openTime, muncherParams)).toBeLessThan(-0.2);

    // Verify chomp vs. top-down squash interaction
    const chompCheck = evaluateMuncherInteraction(
      [openPose.position[0] + 1.1, openPose.position[1], openPose.position[2]],
      [-2.0, 0, 0],
      0.55,
      openTime,
      muncherParams,
    );
    expect(chompCheck.chomped).toBe(true);
    expect(chompCheck.squashedMuncher).toBe(false);

    const squashCheck = evaluateMuncherInteraction(
      [openPose.position[0], openPose.position[1] + 1.25, openPose.position[2]],
      [0, -8.0, 0],
      0.55,
      openTime,
      muncherParams,
    );
    expect(squashCheck.squashedMuncher).toBe(true);
    expect(squashCheck.chomped).toBe(false);

    const hazardShader = getExoticHazardsShaderSnippet();
    expect(hazardShader.glsl).toContain('float sdVortexFunnel');
    expect(hazardShader.glsl).toContain('float sdMarbleMuncher');
    expect(hazardShader.wgsl).toContain('fn sdVortexFunnel');
    expect(hazardShader.wgsl).toContain('fn sdMarbleMuncher');
  });
});
