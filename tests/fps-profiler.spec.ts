import { describe, expect, it } from 'vitest';
import {
  ALL_PLAYABLE_COURSES,
  COURSE_1_PRACTICE_RACE,
  COURSE_6_ULTIMATE_ARGON_CORE,
  COURSE_7_SDF_SINGULARITY_LAB,
} from '../src/courses';
import {
  benchmarkShaderPixelEvaluations,
  compileCourseToGlsl,
  compileCourseToWgsl,
  computeCourseBoundingBox,
  evaluateCourseBoundsDistance,
  GOVERNOR_DOWN_THRESHOLD_MS,
  GOVERNOR_UP_THRESHOLD_MS,
  INITIAL_DPR_CAP,
  MIN_ADAPTIVE_SCALE,
  MAX_ADAPTIVE_SCALE,
  stepAutoGovernorScale,
} from '../src/rendering';
import { HUD_SYNC_HZ, HUD_SYNC_INTERVAL_SEC } from '../src/App';

describe('60+ FPS Shader & Frame-Time Profiler Optimization Pass', () => {
  it('reduces per-pixel SDF primitive evaluations by > 60% across playable courses', () => {
    for (const course of ALL_PLAYABLE_COURSES) {
      const bench = benchmarkShaderPixelEvaluations(course, 16, 12);

      expect(bench.courseId).toBe(course.id);
      expect(bench.totalPixelsSampled).toBe(16 * 12);
      expect(bench.legacyPrimitiveEvalsPerPixel).toBeGreaterThan(1000);
      expect(bench.optimizedPrimitiveEvalsPerPixel).toBeLessThan(
        bench.legacyPrimitiveEvalsPerPixel * 0.4,
      );
      expect(bench.primitiveEvalReductionPercent).toBeGreaterThan(60);
      expect(bench.aabbFastSkipRate).toBeGreaterThan(0.25);
    }
  });

  it('computes tight course AABB bounds with 4m padding and O(1) sdCourseBounds fast skip', () => {
    const bounds = computeCourseBoundingBox(COURSE_1_PRACTICE_RACE, 4.0);

    // Course 1 spans from start near z=0 down toward z=-90
    expect(bounds.halfExtents[0]).toBeGreaterThan(6);
    expect(bounds.halfExtents[1]).toBeGreaterThan(4);
    expect(bounds.halfExtents[2]).toBeGreaterThan(25);

    // Inside course start pad -> inside AABB (negative signed distance)
    const distAtStart = evaluateCourseBoundsDistance(COURSE_1_PRACTICE_RACE.startPos, bounds);
    expect(distAtStart).toBeLessThan(0);

    // Far sky / abyss ray sample -> > 1.5m outside AABB triggers O(1) early out
    const distInFarSky = evaluateCourseBoundsDistance([85, 60, 45], bounds);
    expect(distInFarSky).toBeGreaterThan(1.5);
  });

  it('emits all 60+ FPS GLSL & WGSL shader fast-path optimizations', () => {
    const glsl = compileCourseToGlsl(COURSE_7_SDF_SINGULARITY_LAB);
    const wgsl = compileCourseToWgsl(COURSE_6_ULTIMATE_ARGON_CORE);

    // 1. Course Bounding-Box Fast Skip (`sdCourseBounds`)
    expect(glsl).toContain('float sdCourseBounds(vec3 p)');
    expect(glsl).toContain('if (dBounds > 1.5) return vec2(dBounds, 0.0);');
    expect(wgsl).toContain('fn sdCourseBounds(p: vec3<f32>) -> f32');
    expect(wgsl).toContain('if (dBounds > 1.5) { return vec2<f32>(dBounds, 0.0); }');

    // 2. Fast Shadow & AO Evaluators (`evalShadowScene`) with 10 shadow steps & 4 AO taps
    expect(glsl).toContain('float evalShadowScene(vec3 p)');
    expect(glsl).toContain('for (int i = 0; i < 10; i++)');
    expect(glsl).toContain('t += clamp(h, 0.08, 1.8);');
    expect(glsl).toContain('const float steps[4] = float[4](0.025, 0.08, 0.20, 0.44);');

    // 3. Analytical / 5-Step Local Glossy Reflection with 3-tap forward-difference normal
    expect(glsl).toContain('if (reflStrength <= 0.12 || hitT >= 45.0) return vec3(0.0);');
    expect(glsl).toContain('const int MAX_REFL_STEPS = 5;');
    expect(glsl).toContain('vec3 calcFastReflectedNormal(vec3 p, float centerDist)');

    // 4. Cathedral megastructure gated behind background misses or far abyss rays
    expect(glsl).toContain('if (length(p.xz) <= 22.0 && p.y >= -1.5)');

    // 5. Portal 3D aim ring gated by `uPortalAimPos.w > 0.5`
    expect(glsl).toContain('if (uPortalAimPos.w <= 0.5 || uPortalAimNormal.w < 0.5) return 1000.0;');
    expect(glsl).toContain('if (uPortalAimPos.w > 0.5 && uPortalAimNormal.w > 0.5)');
  });

  it('caps default Retina DPR at 1.35 and tunes the 60 FPS Auto-Governor between 0.75 and 1.0', () => {
    expect(INITIAL_DPR_CAP).toBe(1.35);
    expect(MIN_ADAPTIVE_SCALE).toBe(0.75);
    expect(MAX_ADAPTIVE_SCALE).toBe(1.0);
    expect(GOVERNOR_DOWN_THRESHOLD_MS).toBe(17.2);
    expect(GOVERNOR_UP_THRESHOLD_MS).toBe(11.5);

    // When emaFrameMs > 17.2 ms (< 58 FPS), step adaptiveScale down toward 0.75
    let scale = 1.0;
    for (let i = 0; i < 20; i++) {
      scale = stepAutoGovernorScale(scale, 24.5);
    }
    expect(scale).toBe(0.75);

    // When emaFrameMs is within the 60 FPS deadband (e.g. 15.8 ms), hold steady
    expect(stepAutoGovernorScale(0.88, 15.8)).toBe(0.88);

    // When emaFrameMs < 11.5 ms (> 85 FPS), step adaptiveScale up toward 1.0
    for (let i = 0; i < 30; i++) {
      scale = stepAutoGovernorScale(scale, 9.2);
    }
    expect(scale).toBe(1.0);
  });

  it('throttles React HUD state sync to 20 Hz (every 50 ms)', () => {
    expect(HUD_SYNC_HZ).toBe(20);
    expect(HUD_SYNC_INTERVAL_SEC).toBe(0.05);
  });
});
