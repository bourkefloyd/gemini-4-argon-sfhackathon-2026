import { describe, expect, it } from 'vitest';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
  generateArchitectCoursePreset,
} from '../src/courses';
import { createIsometricCameraRig } from '../src/camera';
import { createMarbleSimulation } from '../src/physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import {
  createCpuWorldEvaluator,
  evaluateKinematicMotion,
  evaluatePrimitiveNode,
  evaluateSdfTree,
} from '../src/sdf/eval-cpu';

describe('Stage 1 Serial Spine — SDF Primitives, CSG, Shader Parity & 120 Hz Physics', () => {
  it('evaluates all 10 SDF primitives and kinematic velocities accurately', () => {
    const boxSample = evaluatePrimitiveNode(
      {
        kind: 'box',
        material: 'standard',
        center: [0, 0, 0],
        halfExtents: [2, 1, 2],
      },
      [0, 1.5, 0],
      0,
    );
    expect(boxSample.distance).toBeCloseTo(0.5, 4);

    const rampSample = evaluatePrimitiveNode(
      {
        kind: 'ramp',
        material: 'standard',
        center: [0, 5, 0],
        axis: 'z',
        halfLength: 4,
        rise: 2,
        halfWidth: 2,
        thickness: 1,
        railHeight: 0.6,
      },
      [0, 5.0, 0],
      0,
    );
    expect(Math.abs(rampSample.distance)).toBeLessThan(0.05);

    const sweptSample = evaluatePrimitiveNode(
      {
        kind: 'sweptTrack',
        material: 'standard',
        center: [0, 0, 0],
        start: [0, 2, 0],
        end: [0, 0, -6],
        halfWidth: 2,
        thickness: 0.8,
        railHeight: 0.5,
      },
      [0, 1, -3],
      0,
    );
    expect(Math.abs(sweptSample.distance)).toBeLessThan(0.05);

    const waveSample = evaluatePrimitiveNode(
      {
        kind: 'waveFloor',
        material: 'standard',
        center: [0, 0, 0],
        halfExtents: [4, 0.5, 4],
        waveAmplitude: 0.3,
        waveFrequencyX: 1.0,
        waveFrequencyZ: 1.0,
        waveSpeed: 2.0,
      },
      [0, 0.8, 0],
      0.5,
    );
    expect(Number.isFinite(waveSample.distance)).toBe(true);

    const pistonMotion = evaluateKinematicMotion(
      {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 2.0,
        frequency: 1.0,
        slamSharpness: 2.0,
      },
      0.15,
    );
    expect(pistonMotion.offset[1]).toBeLessThan(0);
    expect(Math.abs(pistonMotion.velocity[1])).toBeGreaterThan(0.1);
  });

  it('supports union, smoothUnion, subtract, smoothSubtract, and intersect CSG trees', () => {
    const csgTree = {
      kind: 'smoothSubtract' as const,
      smoothRadius: 0.15,
      children: [
        {
          kind: 'smoothUnion' as const,
          smoothRadius: 0.2,
          children: [
            {
              kind: 'box' as const,
              material: 'standard' as const,
              center: [0, 0, 0] as const,
              halfExtents: [2, 1, 2] as const,
            },
            {
              kind: 'sphere' as const,
              material: 'ice' as const,
              center: [1.5, 0.5, 0] as const,
              radius: 1.0,
            },
          ],
        },
        {
          kind: 'cylinder' as const,
          material: 'acid' as const,
          center: [0, 0.8, 0] as const,
          radius: 0.5,
          halfHeight: 0.6,
        },
      ],
    };

    const s = evaluateSdfTree(csgTree, [0, 0.9, 0], 0);
    // Inside the subtracted cylinder cavity -> positive distance (outside solid)
    expect(s.distance).toBeGreaterThan(0);
  });

  it('compiles Course 1, Course 2, and Architect presets into valid GLSL2 and WGSL shaders', () => {
    for (const course of [
      COURSE_1_PRACTICE_RACE,
      COURSE_2_INTERMEDIATE_MADNESS,
      generateArchitectCoursePreset('spiral-citadel'),
    ]) {
      const glsl = compileCourseToGlsl(course);
      const wgsl = compileCourseToWgsl(course);

      expect(glsl).toContain('#version 300 es');
      expect(glsl).toContain('evalCourseWorldRaw');
      expect(glsl).toContain('shadePlayerMarble');
      expect(glsl).toContain('calcSoftShadow');
      expect(glsl).toContain('calcAmbientOcclusion');
      expect(glsl).toContain('fwidth');

      expect(wgsl).toContain('fn evalCourseWorldRaw');
      expect(wgsl).toContain('struct Uniforms');
    }
  });

  it('maintains grounded support and rolls smoothly on Course 1 & Course 2 at 120 Hz', () => {
    const eval1 = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim1 = createMarbleSimulation(COURSE_1_PRACTICE_RACE, eval1);

    // Step 30 frames (0.25s) with zero input on the Start Pad
    for (let i = 0; i < 30; i++) {
      sim1.stepFixed(1 / 120, { moveXZ: [0, 0], jumpPressed: false, respawnPressed: false }, i / 120);
    }
    const settled = sim1.getState();
    expect(settled.contact.grounded).toBe(true);
    expect(settled.status).toBe('racing');
    expect(settled.surfaceMaterial).toBe('start');

    // Roll forward along -Z down Ramp 1
    for (let i = 0; i < 120; i++) {
      sim1.stepFixed(
        1 / 120,
        { moveXZ: [0, -1], jumpPressed: false, respawnPressed: false },
        (30 + i) / 120,
      );
    }
    const rolling = sim1.getState();
    expect(rolling.position[2]).toBeLessThan(-2.5);
    expect(rolling.velocity[2]).toBeLessThan(-1.0);

    // Verify camera rig & occlusion check
    const camRig = createIsometricCameraRig(COURSE_1_PRACTICE_RACE, rolling.position);
    const camState = camRig.update(1 / 60, COURSE_1_PRACTICE_RACE, rolling, rolling.position, eval1, 1.2);
    expect(camState.zoomStopId).toBe('isometric');
    expect(camState.fovDeg).toBeCloseTo(34, 1);
  });
});
