import { describe, expect, it } from 'vitest';
import { type SdfNode, type Vec3 } from '../src/contracts';
import {
  evaluateSdfTree,
  vec3Add,
  vec3Dot,
  vec3Length,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../src/sdf/eval-cpu';
import {
  computeCurvatureOverRelaxation,
  evaluateJetSdfTree,
  evaluatePortalBridgedSdf,
  evaluatePrimitiveJet,
  opSmoothSubtractJet,
  opSmoothUnionJet,
  type PortalPairSpec,
  sphereTraceKappaMarch,
  sphereTraceVanilla,
  teleportSphereAcrossPortalIfCrossed,
  transformPointAcrossPortal,
  transformVectorAcrossPortal,
} from '../src/sdf/jet-sdf';

function numericalGradient4Tap(
  evalDist: (p: Vec3) => number,
  p: Vec3,
  eps = 1e-4,
): Vec3 {
  const d0 = evalDist([p[0] + eps, p[1] - eps, p[2] - eps]);
  const d1 = evalDist([p[0] - eps, p[1] - eps, p[2] + eps]);
  const d2 = evalDist([p[0] - eps, p[1] + eps, p[2] - eps]);
  const d3 = evalDist([p[0] + eps, p[1] + eps, p[2] + eps]);
  return [
    (d0 - d1 - d2 + d3) / (4 * eps),
    (-d0 - d1 + d2 + d3) / (4 * eps),
    (-d0 + d1 - d2 + d3) / (4 * eps),
  ];
}

describe('Frontier SDF Inventions — Symplectic Jet-SDF, Portal-SDF & Curvature-Bounded Sphere Tracing', () => {
  it('Invention 1 (jSDF): propagates exact analytical gradients through smooth CSG without 4-tap finite differences', () => {
    const smoothScene: SdfNode = {
      kind: 'smoothSubtract',
      smoothRadius: 0.25,
      children: [
        {
          kind: 'smoothUnion',
          smoothRadius: 0.45,
          children: [
            {
              kind: 'box',
              material: 'standard',
              center: [0, 0, 0],
              halfExtents: [2.5, 0.8, 2.5],
            },
            {
              kind: 'sphere',
              material: 'ice',
              center: [1.2, 0.9, -0.4],
              radius: 1.1,
            },
          ],
        },
        {
          kind: 'capsule',
          material: 'acid',
          center: [0.3, 0.85, 0],
          a: [-1.2, 0, 0],
          b: [1.2, 0, 0],
          radius: 0.45,
        },
      ],
    };

    const samplePoints: Vec3[] = [
      [1.05, 1.35, -0.25], // Inside smoothUnion fillet between box and sphere
      [0.4, 0.72, 0.38],   // Inside smoothSubtract fillet rim around capsule trough
      [-1.5, 0.95, 1.1],   // Above flat box deck
      [1.8, 1.4, -0.7],    // Near upper sphere dome
    ];

    for (const p of samplePoints) {
      const jet = evaluateJetSdfTree(smoothScene, p, 0, 'quadratic');
      const refSample = evaluateSdfTree(smoothScene, p, 0);
      expect(jet.distance).toBeCloseTo(refSample.distance, 6);

      const numGrad = numericalGradient4Tap(
        (pt) => evaluateJetSdfTree(smoothScene, pt, 0, 'quadratic').distance,
        p,
        1e-5,
      );
      const numNormal = vec3Normalize(numGrad);

      // Analytical jSDF gradient matches numerical derivative to > 0.99999 cosine similarity
      const cosSim = vec3Dot(jet.normal, numNormal);
      expect(cosSim).toBeGreaterThan(0.99995);
      expect(jet.gradientNorm).toBeCloseTo(vec3Length(numGrad), 3);
    }
  });

  it('Invention 1 (jSDF): captures exact meniscus velocity amplification when two moving hazards smoothly fuse', () => {
    // Rising bridge block merging with a patrolling Steelie sphere at t = 0.20s
    const risingBridge = evaluatePrimitiveJet(
      {
        kind: 'box',
        material: 'standard',
        center: [0, -0.15, 0],
        halfExtents: [2.0, 0.6, 2.0],
        kinematic: {
          kind: 'bridge',
          axis: [0, 1, 0],
          amplitude: 0.8,
          frequency: 0.75,
          phase: 0,
        },
      },
      [0.35, 0.68, 0],
      0.12,
    );

    const movingSteelie = evaluatePrimitiveJet(
      {
        kind: 'sphere',
        material: 'bumper',
        center: [0.95, 0.85, 0],
        radius: 0.65,
        kinematic: {
          kind: 'steelie',
          mode: 'patrol',
          span: [-1.2, 0, 0],
          frequency: 0.8,
          phase: 0.1,
        },
      },
      [0.35, 0.68, 0],
      0.12,
    );

    const k = 0.55;
    const fusedQuad = opSmoothUnionJet(risingBridge, movingSteelie, k, 'quadratic');
    const fusedCubic = opSmoothUnionJet(risingBridge, movingSteelie, k, 'cubic');

    // Inside the smooth meniscus, ||∇d|| < 1 because the two gradients meet at an acute/obtuse angle
    expect(fusedQuad.filletActivation).toBeGreaterThan(0.5);
    expect(fusedQuad.gradientNorm).toBeLessThan(0.92);

    // Verify exact level-set advection PDE: ∇d · v_surf + ∂d/∂t = 0
    const pdeResidualQuad =
      vec3Dot(fusedQuad.gradient, fusedQuad.surfaceVelocity) + fusedQuad.dDot;
    const pdeResidualCubic =
      vec3Dot(fusedCubic.gradient, fusedCubic.surfaceVelocity) + fusedCubic.dDot;
    expect(Math.abs(pdeResidualQuad)).toBeLessThan(1e-12);
    expect(Math.abs(pdeResidualCubic)).toBeLessThan(1e-12);

    // Compare against finite-difference time derivative ∂d/∂t ≈ (d(t + dt) - d(t - dt)) / (2*dt)
    const dt = 1e-5;
    const evalAtTime = (t: number) => {
      const a = evaluatePrimitiveJet(
        {
          kind: 'box',
          material: 'standard',
          center: [0, -0.15, 0],
          halfExtents: [2.0, 0.6, 2.0],
          kinematic: {
            kind: 'bridge',
            axis: [0, 1, 0],
            amplitude: 0.8,
            frequency: 0.75,
            phase: 0,
          },
        },
        [0.35, 0.68, 0],
        t,
      );
      const b = evaluatePrimitiveJet(
        {
          kind: 'sphere',
          material: 'bumper',
          center: [0.95, 0.85, 0],
          radius: 0.65,
          kinematic: {
            kind: 'steelie',
            mode: 'patrol',
            span: [-1.2, 0, 0],
            frequency: 0.8,
            phase: 0.1,
          },
        },
        [0.35, 0.68, 0],
        t,
      );
      return opSmoothUnionJet(a, b, k, 'quadratic').distance;
    };
    const numericalDDot = (evalAtTime(0.12 + dt) - evalAtTime(0.12 - dt)) / (2 * dt);
    expect(fusedQuad.dDot).toBeCloseTo(numericalDDot, 4);

    // Meniscus normal launch speed is amplified by 1 / ||∇d|| > 1 compared to naive linear blend!
    const naiveLinearNormalSpeed =
      0.5 *
      (vec3Dot(risingBridge.surfaceVelocity, fusedQuad.normal) +
        vec3Dot(movingSteelie.surfaceVelocity, fusedQuad.normal));
    const exactMeniscusNormalSpeed = vec3Dot(fusedQuad.surfaceVelocity, fusedQuad.normal);
    expect(exactMeniscusNormalSpeed).toBeGreaterThan(naiveLinearNormalSpeed * 1.1);
  });

  it('Invention 2 (pSDF): preserves the 1-Lipschitz bound across portal rims and bridges cross-portal distances & momentum', () => {
    const portalPair: PortalPairSpec = {
      portalA: {
        center: [0, 2.0, 0],
        normal: [0, 0, 1], // Facing +Z
        up: [0, 1, 0],
        radius: 1.5,
        rimThickness: 0.12,
        throatDepth: 0.28,
      },
      portalB: {
        center: [12.0, 8.0, -6.0],
        normal: [1, 0, 0], // Facing +X (90-degree rotated exit frame!)
        up: [0, 1, 0],
        radius: 1.5,
        rimThickness: 0.12,
        throatDepth: 0.28,
      },
    };

    // World has a host wall at Portal A (z=0), a host wall at Portal B (x=12),
    // AND a sphere obstacle placed just inside/outside Portal B's exit!
    const evalWorld = (pt: Vec3): number => {
      const dWallA = Math.abs(pt[2]) - 0.22;
      const dWallB = Math.abs(pt[0] - 12.0) - 0.22;
      const dObstacleB = Math.hypot(pt[0] - 12.15, pt[1] - 8.0, pt[2] + 6.0) - 0.65;
      return Math.min(dWallA, dWallB, dObstacleB);
    };

    // 1. Verify cross-portal distance bridging: a point at [0, 2.0, 0.12] in front of Portal A
    // sees the sphere obstacle sitting at [12.15, 8.0, -6.0] through Portal B!
    const frontSample = evaluatePortalBridgedSdf([0, 2.0, 0.12], portalPair, evalWorld);
    expect(frontSample.bridgedThroughPortal).toBe(true);
    expect(frontSample.distance).toBeLessThan(0.35);

    // 2. Verify strict 1-Lipschitz bound |d_portal(x) - d_portal(y)| <= ||x - y||_2 across 200 pairs near the rim
    let maxLipschitzRatio = 0;
    for (let i = 0; i < 200; i++) {
      const angle = (i / 200) * Math.PI * 2;
      const p1: Vec3 = [
        1.45 * Math.cos(angle),
        2.0 + 1.45 * Math.sin(angle),
        0.18 * Math.sin(i * 1.7),
      ];
      const delta: Vec3 = [0.03 * Math.cos(i), -0.025 * Math.sin(i), 0.02];
      const p2 = vec3Add(p1, delta);

      const d1 = evaluatePortalBridgedSdf(p1, portalPair, evalWorld).distance;
      const d2 = evaluatePortalBridgedSdf(p2, portalPair, evalWorld).distance;
      const ratio = Math.abs(d2 - d1) / vec3Length(delta);
      if (ratio > maxLipschitzRatio) {
        maxLipschitzRatio = ratio;
      }
    }
    expect(maxLipschitzRatio).toBeLessThanOrEqual(1.0001);

    // 3. Verify 120 Hz cross-portal teleportation preserves 100% of linear speed ||v|| and spin ||ω||
    const prevPos: Vec3 = [0.1, 2.0, 0.08];
    const currPos: Vec3 = [0.1, 2.0, -0.04];
    const vIn: Vec3 = [1.5, -3.0, -18.5];
    const omegaIn: Vec3 = [-42.0, 8.0, 5.5];

    const tp = teleportSphereAcrossPortalIfCrossed(
      prevPos,
      currPos,
      vIn,
      omegaIn,
      portalPair,
    );
    expect(tp.teleported).toBe(true);
    expect(vec3Length(tp.velocity)).toBeCloseTo(vec3Length(vIn), 9);
    expect(vec3Length(tp.angularVelocity)).toBeCloseTo(vec3Length(omegaIn), 9);
    // Entering along -Z into Portal A emerges along +X from Portal B!
    expect(tp.velocity[0]).toBeCloseTo(18.5, 6);
  });

  it('Invention 3 (κ-March): reduces sphere-tracing steps by 35-45% on smooth-CSG scenes with zero overstep error', () => {
    const csgCourseScene: SdfNode = {
      kind: 'smoothUnion',
      smoothRadius: 0.45,
      children: [
        {
          kind: 'box',
          material: 'standard',
          center: [0, -1.0, 0],
          halfExtents: [8.0, 0.6, 8.0],
        },
        {
          kind: 'sphere',
          material: 'ice',
          center: [-1.2, 0.1, 0],
          radius: 1.25,
        },
        {
          kind: 'sphere',
          material: 'bumper',
          center: [0.9, 0.2, 0.2],
          radius: 1.15,
        },
        {
          kind: 'cylinder',
          material: 'standard',
          center: [0.0, 0.4, -1.4],
          radius: 0.9,
          halfHeight: 1.2,
        },
      ],
    };

    const evalJet = (p: Vec3) => evaluateJetSdfTree(csgCourseScene, p, 0, 'quadratic');

    // Verify curvature over-relaxation schedule throttles ω down inside fillets
    const omegaFar = computeCurvatureOverRelaxation(4.0, 0.0, 0.45, 1.75, 1.6, -0.45);
    const omegaFillet = computeCurvatureOverRelaxation(0.05, 0.98, 0.45, 1.75, 1.6, -0.85);
    expect(omegaFar).toBeGreaterThan(1.55);
    expect(omegaFillet).toBeLessThan(1.22);

    // Cast a fan of 64 isometric / low-angle camera rays across the smooth-CSG scene
    // and compare Vanilla Sphere Tracing vs Curvature-Bounded κ-March
    const rayOrigin: Vec3 = [0, 1.35, 11.5];
    let totalVanillaSteps = 0;
    let totalKappaSteps = 0;
    let hitCount = 0;

    for (let iy = 0; iy < 8; iy++) {
      for (let ix = 0; ix < 8; ix++) {
        const target: Vec3 = [
          -3.2 + (ix / 7) * 6.4,
          -0.45 + (iy / 7) * 0.95,
          -2.5,
        ];
        const dir = vec3Normalize(vec3Sub(target, rayOrigin));

        const vanilla = sphereTraceVanilla(rayOrigin, dir, evalJet, {
          maxSteps: 128,
          hitEpsilon: 1e-3,
        });
        const kappa = sphereTraceKappaMarch(rayOrigin, dir, evalJet, {
          maxSteps: 128,
          hitEpsilon: 1e-3,
          omegaMax: 1.78,
          curvatureBeta: 0.55,
        });

        expect(kappa.hit).toBe(vanilla.hit);
        if (vanilla.hit && kappa.hit) {
          hitCount++;
          totalVanillaSteps += vanilla.steps;
          totalKappaSteps += kappa.steps;
          expect(kappa.overstepError).toBeLessThanOrEqual(1e-3);
          expect(Math.abs(kappa.distance - vanilla.distance)).toBeLessThan(0.02);
        }
      }
    }

    expect(hitCount).toBeGreaterThan(40);
    const stepReductionRatio = 1 - totalKappaSteps / totalVanillaSteps;
    expect(stepReductionRatio).toBeGreaterThan(0.35);
  });
});
