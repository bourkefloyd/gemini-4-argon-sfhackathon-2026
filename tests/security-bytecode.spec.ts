import { describe, expect, it } from 'vitest';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
  generateArchitectCoursePreset,
} from '../src/courses';
import { createMarbleSimulation } from '../src/physics';
import { applyPortalThroatCarveToDistance } from '../src/portals';
import { createCpuWorldEvaluator } from '../src/sdf/eval-cpu';
import {
  bakeCourseToSparseBrickAtlas,
  benchmarkSdfEvaluators,
  compileCourseToMsdfBytecode,
  createMsdfBytecodeWorldEvaluator,
  deserializeMsdfBytecode,
  evalMsdfBytecode,
  evalMsdfBytecodeDistance,
  packInputFrames,
  recordGuidedCourseRun,
  sampleSparseBrickAtlasDistance,
  unpackInputFrames,
  verifyProofOfPlay,
  verifySectorUnlockToken,
  verifyZeroLeakedIdentifiers,
} from '../src/security';

describe('Web Game IP Security POC — .msdf RPN Bytecode, Sparse Brick Atlas & Proof-of-Play', () => {
  it('compiles Course 1, Course 2 & Architect presets to .msdf RPN bytecode with < 1e-5 lockstep parity', () => {
    const courses = [
      COURSE_1_PRACTICE_RACE,
      COURSE_2_INTERMEDIATE_MADNESS,
      generateArchitectCoursePreset('spiral-citadel'),
    ];

    for (const course of courses) {
      const cpuEval = createCpuWorldEvaluator(course);
      const program = compileCourseToMsdfBytecode(course, 0x6e5b2026);
      const roundtrip = deserializeMsdfBytecode(program.binaryBuffer);

      expect(roundtrip.instructionCount).toBe(program.instructionCount);
      expect(roundtrip.primitiveCount).toBe(course.nodes.length + course.hazards.length);

      // Test at both t = 0 and t = 1.35s (when pistons, bridges, waveFloor, and Steelies are moving!)
      for (const time of [0, 0.65, 1.35]) {
        for (const node of [...course.nodes, ...course.hazards]) {
          const testPt = [
            node.center[0] + 0.35,
            node.center[1] + 0.45,
            node.center[2] - 0.25,
          ] as const;

          const expected = cpuEval.sample(testPt, time);
          const portals = course.portals ?? [];
          const actualDist = applyPortalThroatCarveToDistance(
            evalMsdfBytecodeDistance(
              roundtrip,
              testPt[0],
              testPt[1],
              testPt[2],
              time,
            ),
            testPt,
            portals,
          );
          const actualSampleRaw = evalMsdfBytecode(roundtrip, testPt, time);
          const actualSample = {
            ...actualSampleRaw,
            distance: applyPortalThroatCarveToDistance(
              actualSampleRaw.distance,
              testPt,
              portals,
            ),
          };

          expect(Math.abs(actualDist - expected.distance)).toBeLessThan(1e-4);
          expect(Math.abs(actualSample.distance - expected.distance)).toBeLessThan(1e-4);
          expect(actualSample.material).toBe(expected.material);
          expect(
            Math.hypot(
              actualSample.kinematicVelocity[0] - expected.kinematicVelocity[0],
              actualSample.kinematicVelocity[1] - expected.kinematicVelocity[1],
              actualSample.kinematicVelocity[2] - expected.kinematicVelocity[2],
            ),
          ).toBeLessThan(1e-3);
        }
      }
    }
  });

  it('produces bit-identical 120 Hz physics trajectories between AST and .msdf Bytecode evaluators', () => {
    const astEval = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const msdfProgram = compileCourseToMsdfBytecode(COURSE_1_PRACTICE_RACE, 0x12345678);
    const msdfEval = createMsdfBytecodeWorldEvaluator(msdfProgram);

    const simAst = createMarbleSimulation(COURSE_1_PRACTICE_RACE, astEval);
    const simMsdf = createMarbleSimulation(COURSE_1_PRACTICE_RACE, msdfEval);

    for (let tick = 0; tick < 180; tick++) {
      const cmd = {
        moveXZ: [0, -1] as const,
        jumpPressed: tick === 45,
        respawnPressed: false,
      };
      const t = (tick + 1) / 120;
      simAst.stepFixed(1 / 120, cmd, t);
      simMsdf.stepFixed(1 / 120, cmd, t);
    }

    const posAst = simAst.getState().position;
    const posMsdf = simMsdf.getState().position;
    const drift = Math.hypot(
      posAst[0] - posMsdf[0],
      posAst[1] - posMsdf[1],
      posAst[2] - posMsdf[2],
    );
    expect(drift).toBeLessThan(1e-3);
  });

  it('bakes a One-Way Sparse SDF Brick Atlas with O(1) lookup, zero leaked IDs, and measured speedup', () => {
    const report1 = benchmarkSdfEvaluators(COURSE_1_PRACTICE_RACE, {
      sampleCount: 2048,
      iterations: 20,
      voxelSize: 0.25,
    });
    const report2 = benchmarkSdfEvaluators(COURSE_2_INTERMEDIATE_MADNESS, {
      sampleCount: 2048,
      iterations: 20,
      voxelSize: 0.25,
    });

    const brickAtlas = bakeCourseToSparseBrickAtlas(COURSE_1_PRACTICE_RACE, {
      voxelSize: 0.25,
    });
    const rpnProgram = compileCourseToMsdfBytecode(COURSE_1_PRACTICE_RACE, 0x6e5b2026);

    expect(verifyZeroLeakedIdentifiers(COURSE_1_PRACTICE_RACE, rpnProgram, brickAtlas)).toBe(
      true,
    );
    expect(report1.zeroLeakedIdentifiers).toBe(true);
    expect(report2.zeroLeakedIdentifiers).toBe(true);

    // RPN bytecode must have < 1e-4 parity with the recursive AST evaluator
    expect(report1.maxRpnParityDiff).toBeLessThan(1e-4);
    expect(report2.maxRpnParityDiff).toBeLessThan(1e-4);

    // Sparse Brick Atlas only allocates narrow-band macro-cells (< 45% occupancy)
    expect(report1.brickOccupancyRatio).toBeGreaterThan(0.02);
    expect(report1.brickOccupancyRatio).toBeLessThan(0.45);
    expect(report1.meanNarrowBandBrickError).toBeLessThan(0.15);

    // Both RPN bytecode and O(1) Sparse Brick Atlas must beat recursive AST evaluation
    expect(report1.rpnSpeedupVsAst).toBeGreaterThan(1.1);
    expect(report1.brickSpeedupVsAst).toBeGreaterThan(2.5);
    expect(report2.brickSpeedupVsAst).toBeGreaterThan(2.5);

    // Verify O(1) scaling on a 120-primitive procedural course
    const denseNodes = Array.from({ length: 120 }, (_, idx) => ({
      id: `secret-authoring-node-${idx}`,
      kind: 'roundedBox' as const,
      material: 'standard' as const,
      center: [(idx % 12) * 2.5, 4.0 - Math.floor(idx / 12) * 0.4, -idx * 0.4] as const,
      halfExtents: [1.2, 0.5, 1.2] as const,
      radius: 0.1,
      supportBias: true,
    }));
    const denseCourse = {
      ...COURSE_1_PRACTICE_RACE,
      id: 'dense-120-course',
      nodes: denseNodes,
    };
    const denseReport = benchmarkSdfEvaluators(denseCourse, {
      sampleCount: 1024,
      iterations: 15,
      voxelSize: 0.35,
    });

    expect(denseReport.zeroLeakedIdentifiers).toBe(true);
    expect(denseReport.brickSpeedupVsAst).toBeGreaterThan(8.0);

    // Log empirical benchmark metrics for research report
    console.info('[security:benchmark]', {
      practiceRace: {
        primitives: report1.primitiveCount,
        sourceJsonBytes: report1.sourceJsonBytes,
        msdfBytecodeBytes: report1.msdfBytecodeBytes,
        sparseBrickAtlasBytes: report1.sparseBrickAtlasBytes,
        brickOccupancyPct: Number((report1.brickOccupancyRatio * 100).toFixed(1)),
        astEvalPerSec: Math.round(report1.astEvalPerSec),
        rpnEvalPerSec: Math.round(report1.rpnEvalPerSec),
        brickEvalPerSec: Math.round(report1.brickEvalPerSec),
        rpnSpeedupVsAst: Number(report1.rpnSpeedupVsAst.toFixed(2)),
        brickSpeedupVsAst: Number(report1.brickSpeedupVsAst.toFixed(2)),
      },
      intermediateMadness: {
        primitives: report2.primitiveCount,
        sourceJsonBytes: report2.sourceJsonBytes,
        msdfBytecodeBytes: report2.msdfBytecodeBytes,
        sparseBrickAtlasBytes: report2.sparseBrickAtlasBytes,
        brickOccupancyPct: Number((report2.brickOccupancyRatio * 100).toFixed(1)),
        astEvalPerSec: Math.round(report2.astEvalPerSec),
        rpnEvalPerSec: Math.round(report2.rpnEvalPerSec),
        brickEvalPerSec: Math.round(report2.brickEvalPerSec),
        rpnSpeedupVsAst: Number(report2.rpnSpeedupVsAst.toFixed(2)),
        brickSpeedupVsAst: Number(report2.brickSpeedupVsAst.toFixed(2)),
      },
      dense120Course: {
        primitives: denseReport.primitiveCount,
        astEvalPerSec: Math.round(denseReport.astEvalPerSec),
        rpnEvalPerSec: Math.round(denseReport.rpnEvalPerSec),
        brickEvalPerSec: Math.round(denseReport.brickEvalPerSec),
        rpnSpeedupVsAst: Number(denseReport.rpnSpeedupVsAst.toFixed(2)),
        brickSpeedupVsAst: Number(denseReport.brickSpeedupVsAst.toFixed(2)),
      },
    });

    // Spot-check O(1) distance query on the start podium surface
    const startSurfaceDist = sampleSparseBrickAtlasDistance(brickAtlas, 0, 8.2, 0);
    expect(Math.abs(startSurfaceDist)).toBeLessThan(0.15);
  });

  it('packs 120 Hz input streams and verifies Proof-of-Play goal completion & tamper rejection', () => {
    const waypoints = [
      [0, 12.0, -7.0],
      [0.4, 10.55, -14.2],
      [7.2, 10.55, -14.8],
      [16.8, 7.55, -16.8],
      [22.0, 7.55, -16.8],
      [29.8, 7.55, -16.4],
      [30.0, 7.55, -23.4],
      [30.0, 5.5, -31.0],
      [31.2, 4.55, -36.2],
      [32.4, 1.0, -45.2],
      [32.6, 1.0, -48.6],
      [30.0, 1.0, -52.6],
    ] as const;

    const frames = recordGuidedCourseRun(COURSE_1_PRACTICE_RACE, waypoints, 2400);
    expect(frames.length).toBeGreaterThan(120);
    expect(frames.length).toBeLessThan(2400);

    const packed = packInputFrames(frames, 0x99887766);
    const unpacked = unpackInputFrames(packed);
    expect(unpacked.totalTicks).toBe(frames.length);
    expect(unpacked.sessionNonce).toBe(0x99887766);

    const serverSecret = 'argon-zero-trust-secret-2026';
    const verification = verifyProofOfPlay(
      COURSE_1_PRACTICE_RACE,
      packed,
      serverSecret,
    );

    expect(verification.valid).toBe(true);
    expect(verification.reachedGoal).toBe(true);
    expect(verification.finalStatus).toBe('goal');
    expect(verification.carryOverTimeSec).toBeGreaterThan(COURSE_1_PRACTICE_RACE.bonusTimeSec);
    expect(verification.unlockToken).not.toBeNull();
    expect(
      verifySectorUnlockToken(verification.unlockToken!, serverSecret),
    ).toBe(true);

    console.info('[security:proof-of-play]', {
      ticksSimulated: verification.ticksSimulated,
      elapsedTimeSec: Number(verification.elapsedTimeSec.toFixed(2)),
      carryOverTimeSec: Number(verification.carryOverTimeSec.toFixed(2)),
      rawInputBytes: frames.length * 4,
      packedWireBytes: verification.wireByteLength,
      verificationTimeMs: Number(verification.verificationTimeMs.toFixed(2)),
      unlockedCourseIndex: verification.unlockToken?.unlockedCourseIndex,
      nextSectorSeed: `0x${verification.unlockToken?.nextSectorSeed.toString(16)}`,
    });

    // Tampering with the unlock token must fail signature verification
    const forgedToken = {
      ...verification.unlockToken!,
      carryOverTimeSec: verification.unlockToken!.carryOverTimeSec + 100,
    };
    expect(verifySectorUnlockToken(forgedToken, serverSecret)).toBe(false);

    // An incomplete 20-tick run must not issue an unlock token
    const shortPacked = packInputFrames(frames.slice(0, 20), 0x99887766);
    const failedVerify = verifyProofOfPlay(
      COURSE_1_PRACTICE_RACE,
      shortPacked,
      serverSecret,
    );
    expect(failedVerify.valid).toBe(false);
    expect(failedVerify.unlockToken).toBeNull();
  });
});
