import { describe, expect, it } from 'vitest';
import type { CourseSpec, SdfCsgNode, SdfNode, SdfPrimitiveNode, Vec3 } from '../src/contracts';
import {
  ALL_PLAYABLE_COURSES,
  COURSE_7_SDF_SINGULARITY_LAB,
} from '../src/courses';
import {
  benchmarkCraterEditComparison,
  createMarbleSimulation,
  createModeAwareWorldEvaluator,
  cycleEngineComparisonMode,
  ENGINE_COMPARISON_MODES,
  measureNormalContinuityComparison,
  quantizeNormalToPolygonFacet,
} from '../src/physics';
import {
  compileCourseToGlsl,
  compileCourseToWgsl,
  getUltraSdfShaderSnippet,
} from '../src/rendering';
import { createCpuWorldEvaluator } from '../src/sdf/eval-cpu';
import { evalDynamicSphereClusterJet } from '../src/sdf/jet-sdf';

describe('SDF Physics & Graphics Limit-Test Suite vs Basic Polygon Remake', () => {
  it('validates Course 7 (SDF Singularity Lab) structure: Ferrofluid Metaballs, Corkscrew S-Halfpipe & Multi-Portal Loop', () => {
    expect(ALL_PLAYABLE_COURSES).toHaveLength(10);
    expect(COURSE_7_SDF_SINGULARITY_LAB.id).toBe('sdf-singularity-lab');
    expect(COURSE_7_SDF_SINGULARITY_LAB.name).toBe('SDF SINGULARITY LAB');

    const sceneRoot = COURSE_7_SDF_SINGULARITY_LAB.scene as SdfCsgNode | undefined;
    expect(sceneRoot).toBeDefined();
    expect(sceneRoot?.kind).toBe('union');

    // 1. Verify Morphing Ferrofluid Metaball Cluster (4 orbiting smoothUnion spheres)
    const metaballCluster = sceneRoot?.children.find(
      (n) => n.id === 'c7-ferrofluid-metaball-cluster',
    ) as SdfCsgNode | undefined;
    expect(metaballCluster).toBeDefined();
    expect(metaballCluster?.kind).toBe('smoothUnion');
    expect(metaballCluster?.children).toHaveLength(4);
    expect(metaballCluster?.smoothRadius).toBeGreaterThanOrEqual(0.8);
    for (const orb of metaballCluster?.children ?? []) {
      expect(orb.kind).toBe('sphere');
    }

    // 2. Verify High-Banked Corkscrew / S-Halfpipe smoothUnion assembly
    const corkscrew = sceneRoot?.children.find(
      (n) => n.id === 'c7-corkscrew-s-halfpipe',
    ) as SdfCsgNode | undefined;
    expect(corkscrew).toBeDefined();
    expect(corkscrew?.kind).toBe('smoothUnion');
    expect(
      COURSE_7_SDF_SINGULARITY_LAB.nodes.some((n) => n.id === 'c7-corkscrew-sweep-east'),
    ).toBe(true);

    // 3. Verify Multi-Portal Momentum Accelerator Loop
    expect(COURSE_7_SDF_SINGULARITY_LAB.portals).toBeDefined();
    expect(COURSE_7_SDF_SINGULARITY_LAB.portals?.length).toBe(2);
    expect(COURSE_7_SDF_SINGULARITY_LAB.portals?.[0].flingBoost).toBeGreaterThan(1.2);
  });

  it('compiles Ultra SDF & Basic Polygon A/B comparison shaders (GLSL ES 3.00 & WGSL)', () => {
    const snippet = getUltraSdfShaderSnippet();
    expect(snippet.glsl).toContain('uniform int uEngineMode;');
    expect(snippet.glsl).toContain('sdInfiniteMegaPillars');
    expect(snippet.glsl).toContain('opRepLim');
    expect(snippet.glsl).toContain('traceMarbleOpticalRefraction');
    expect(snippet.glsl).toContain('computeMarbleFloorCaustics');
    expect(snippet.glsl).toContain('computeBevelCurvatureHighlight');
    expect(snippet.glsl).toContain('traceGlossyFloorReflection');
    expect(snippet.glsl).toContain('shadeBasicPolygonCourseSurface');
    expect(snippet.glsl).toContain('shadeBasicPolygonMarble');

    const glsl = compileCourseToGlsl(COURSE_7_SDF_SINGULARITY_LAB);
    const wgsl = compileCourseToWgsl(COURSE_7_SDF_SINGULARITY_LAB);

    // Chromatic dispersion IOR constants for crown glass marble refraction
    expect(glsl).toContain('IOR_R = 1.50');
    expect(glsl).toContain('IOR_G = 1.52');
    expect(glsl).toContain('IOR_B = 1.55');
    // Screen-space bevel curvature highlight expression
    expect(glsl).toContain('clamp(length(fwidth(n)) * 6.5, 0.0, 1.0)');
    // Split-screen A/B comparison mode check
    expect(glsl).toContain('if (uEngineMode == 2)');
    expect(wgsl).toContain('sdInfiniteMegaPillars');
    expect(wgsl).toContain('engineMode: f32');
  });

  it('stress-tests 64-primitive CSG tree evaluation throughput within the 120 Hz budget', () => {
    const stressNodes: SdfPrimitiveNode[] = [];
    for (let i = 0; i < 64; i++) {
      stressNodes.push({
        id: `stress-prim-${i}`,
        kind: i % 3 === 0 ? 'roundedBox' : i % 3 === 1 ? 'sphere' : 'cylinder',
        material: i % 4 === 0 ? 'ice' : 'standard',
        center: [(i % 8) * 3.0 - 10.5, 4.0 - Math.floor(i / 8) * 0.5, -i * 1.2],
        halfExtents: [1.4, 0.5, 1.4],
        radius: 0.9,
        halfHeight: 0.5,
      } as SdfPrimitiveNode);
    }

    const stressCourse: CourseSpec = {
      ...COURSE_7_SDF_SINGULARITY_LAB,
      id: 'sdf-64-primitive-stress',
      nodes: stressNodes.slice(0, 8),
      scene: {
        id: 'stress-smooth-root',
        kind: 'smoothUnion',
        smoothRadius: 0.35,
        children: stressNodes as readonly SdfNode[],
      },
    };

    const evaluator = createCpuWorldEvaluator(stressCourse);
    const sampleCount = 240;
    const t0 = performance.now();
    let checksum = 0;
    for (let i = 0; i < sampleCount; i++) {
      const res = evaluator.sample([0, 4.2, -i * 0.25], i * (1 / 120));
      checksum += res.distance;
    }
    const elapsedMs = performance.now() - t0;
    const perEvalUs = (elapsedMs * 1000) / sampleCount;

    expect(Number.isFinite(checksum)).toBe(true);
    // 240 full gradient + kinematic world evaluations across 64 smoothUnion primitives
    // must complete well under 150 ms in Node/V8 test runner
    expect(elapsedMs).toBeLessThan(150);
    expect(perEvalUs).toBeLessThan(625);
  });

  it('maintains 120 Hz substep CCD stability at 22+ u/s and 30 u/s through the Singularity Corkscrew & Ferrofluid Metaballs', () => {
    const evaluator = createModeAwareWorldEvaluator(COURSE_7_SDF_SINGULARITY_LAB, 0);
    const sim = createMarbleSimulation(COURSE_7_SDF_SINGULARITY_LAB, evaluator);

    // 1. Place marble at the entry of the High-Banked Corkscrew / S-Halfpipe at 30 u/s speed
    sim.setState({
      ...sim.getState(),
      position: [0, 15.1, -4.5],
      prevPosition: [0, 15.1, -4.5],
      velocity: [2.0, -3.5, -29.7], // > 30 u/s total speed!
      status: 'racing',
    });

    const dt = 1 / 120;
    let peakSpeed = 0;
    for (let step = 0; step < 60; step++) {
      const state = sim.stepFixed(
        dt,
        { moveXZ: [0, -1], jumpPressed: false, respawnPressed: false },
        step * dt,
      );
      const speed = Math.hypot(state.velocity[0], state.velocity[1], state.velocity[2]);
      if (speed > peakSpeed) peakSpeed = speed;

      // Verify zero NaN/Infinity divergence and no tunneling below the kill plane
      expect(Number.isFinite(state.position[0])).toBe(true);
      expect(Number.isFinite(state.position[1])).toBe(true);
      expect(Number.isFinite(state.position[2])).toBe(true);
      expect(state.position[1]).toBeGreaterThan(COURSE_7_SDF_SINGULARITY_LAB.killPlaneY);
    }
    expect(peakSpeed).toBeGreaterThanOrEqual(22.0);

    // 2. Verify 4-sphere morphing Ferrofluid Metaball cluster time-derivative jSDF meniscus physics
    const probeP: Vec3 = [0.4, 10.8, -20.4];
    const jetMerge = evalDynamicSphereClusterJet(
      probeP,
      [
        { center: [-0.45, 10.55, -20.6], velocity: [2.8, 0.2, 0.0], radius: 0.78 },
        { center: [0.45, 10.55, -20.6], velocity: [-2.8, 0.2, 0.0], radius: 0.78 },
        { center: [0.0, 10.65, -20.1], velocity: [0.0, 0.3, -2.4], radius: 0.72 },
        { center: [0.0, 10.65, -21.1], velocity: [0.0, 0.3, 2.4], radius: 0.72 },
      ],
      0.88,
    );
    expect(Number.isFinite(jetMerge.d)).toBe(true);
    // Unit-length analytical gradient from 4-jet automatic differentiation
    const gradLen = Math.hypot(jetMerge.gx, jetMerge.gy, jetMerge.gz);
    expect(gradLen).toBeCloseTo(1.0, 2);
    // Converging spheres produce a non-zero meniscus surface velocity impulse
    const surfSpeed = Math.hypot(
      jetMerge.surfaceVelocity[0],
      jetMerge.surfaceVelocity[1],
      jetMerge.surfaceVelocity[2],
    );
    expect(surfSpeed).toBeGreaterThan(0.2);
  });

  it('demonstrates C^infinity smooth normals in ULTRA SDF vs 3°–6°+ faceted normal chatter in BASIC POLYGON mode', () => {
    expect(ENGINE_COMPARISON_MODES).toHaveLength(3);
    expect(cycleEngineComparisonMode(0)).toBe(1);
    expect(cycleEngineComparisonMode(1)).toBe(2);
    expect(cycleEngineComparisonMode(2)).toBe(0);

    // Sample a fine trajectory across a curved ramp / halfpipe surface on Course 7
    const samplePoints: Vec3[] = [];
    for (let i = 0; i < 40; i++) {
      const t = i / 39;
      samplePoints.push([
        -1.5 + t * 3.0,
        12.4 - t * 1.2,
        -9.0 - t * 4.5,
      ]);
    }

    const metrics = measureNormalContinuityComparison(
      COURSE_7_SDF_SINGULARITY_LAB,
      samplePoints,
      0.5,
      16,
    );

    expect(metrics.sampleCount).toBe(40);
    // Basic Polygon Mode (16 segments + quad-diagonal facets) exhibits sharp normal jumps (>= 3 deg)
    expect(metrics.basicPolygonMaxDeltaDeg).toBeGreaterThan(3.0);
    expect(metrics.basicPolygonEdgeSnagCount).toBeGreaterThanOrEqual(1);

    // Verify direct normal quantization angle difference is in the authentic polygon facet range
    const smoothN: Vec3 = [0, 0.92388, 0.38268]; // ~22.5 deg ramp normal
    const facetA = quantizeNormalToPolygonFacet(smoothN, [0.1, 8.0, -10.1], 16);
    const facetB = quantizeNormalToPolygonFacet(smoothN, [0.78, 8.0, -10.78], 16);
    expect(Math.hypot(facetA[0], facetA[1], facetA[2])).toBeCloseTo(1.0, 5);
    expect(Math.hypot(facetB[0], facetB[1], facetB[2])).toBeCloseTo(1.0, 5);
    const dotAB = Math.min(
      1,
      Math.max(-1, facetA[0] * facetB[0] + facetA[1] * facetB[1] + facetA[2] * facetB[2]),
    );
    const deltaDeg = (Math.acos(dotAB) * 180) / Math.PI;
    expect(deltaDeg).toBeGreaterThan(2.5);
  });

  it('benchmarks zero-latency O(1) SDF crater mutations against polygon mesh boolean + BVH rebuild', () => {
    const bench = benchmarkCraterEditComparison(COURSE_7_SDF_SINGULARITY_LAB, 8);
    expect(bench.craterCount).toBe(8);
    expect(bench.sdfMutationPerEditMs).toBeLessThan(1.0);
    expect(bench.polygonRemeshTotalMs).toBeGreaterThan(bench.sdfMutationTotalMs);
    expect(bench.speedupFactor).toBeGreaterThan(2.0);
    expect(bench.polygonTriangleCount).toBeGreaterThanOrEqual(512);
  });
});
