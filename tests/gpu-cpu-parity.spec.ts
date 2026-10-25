import { describe, expect, it } from 'vitest';
import {
  type CourseSpec,
  MATERIAL_IDS,
  type Quat,
  type SdfPrimitiveNode,
  type Vec3,
} from '../src/contracts';
import { BUILT_IN_COURSES, COURSE_1_PRACTICE_RACE } from '../src/courses';
import { applyPortalThroatCarveToDistance } from '../src/portals';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import {
  analyticalJetNormal,
  createCpuWorldEvaluator,
  evalSceneJetCpu,
  evaluatePrimitiveNode,
  vec3Length,
  vec3Normalize,
  vec3Sub,
} from '../src/sdf/eval-cpu';
import {
  compileCourseToMsdfBytecode,
  evalMsdfBytecode,
} from '../src/security';

// ============================================================================
// Exact GLSL / WGSL Shader Math Intrinsic Runtime & Parser
// ============================================================================

type Vec2 = readonly [number, number];

function vec2(x: number, y = x): Vec2 {
  return [x, y];
}

function vec3(x: number, y = x, z = x): Vec3 {
  return [x, y, z];
}

function vec4(x: number, y: number, z: number, w: number): Quat {
  return [x, y, z, w];
}

function v3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function v3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function v3Scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function dot2(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function inversesqrt(x: number): number {
  return 1.0 / Math.sqrt(x);
}

/**
 * Exact GLSL/WGSL shader primitive & CSG functions mirroring `src/rendering/shader-compiler.ts`.
 */
export const glslIntrinsics = {
  rotateByQuatInverse(d: Vec3, q: Quat): Vec3 {
    const qxyz: Vec3 = [q[0], q[1], q[2]];
    const t = v3Scale(cross3(qxyz, d), 2.0);
    return v3Add(v3Sub(d, v3Scale(t, q[3])), cross3(qxyz, t));
  },

  sdBox(p: Vec3, b: Vec3): number {
    const qx = Math.abs(p[0]) - b[0];
    const qy = Math.abs(p[1]) - b[1];
    const qz = Math.abs(p[2]) - b[2];
    return (
      Math.hypot(Math.max(qx, 0.0), Math.max(qy, 0.0), Math.max(qz, 0.0)) +
      Math.min(Math.max(qx, Math.max(qy, qz)), 0.0)
    );
  },

  sdRoundedBox(p: Vec3, b: Vec3, r: number): number {
    const cr = Math.min(r, Math.min(b[0], Math.min(b[1], b[2])) * 0.95);
    const core: Vec3 = [
      Math.max(0.001, b[0] - cr),
      Math.max(0.001, b[1] - cr),
      Math.max(0.001, b[2] - cr),
    ];
    return glslIntrinsics.sdBox(p, core) - cr;
  },

  // Alias matching review specification `sdRoundBox`
  sdRoundBox(p: Vec3, b: Vec3, r: number): number {
    return glslIntrinsics.sdRoundedBox(p, b, r);
  },

  sdSphere(p: Vec3, r: number): number {
    return Math.hypot(p[0], p[1], p[2]) - r;
  },

  sdCylinder(p: Vec3, radius: number, halfHeight: number): number {
    const dx = Math.hypot(p[0], p[2]) - radius;
    const dy = Math.abs(p[1]) - halfHeight;
    return Math.min(Math.max(dx, dy), 0.0) + Math.hypot(Math.max(dx, 0.0), Math.max(dy, 0.0));
  },

  sdCapsule(p: Vec3, a: Vec3, b: Vec3, r: number): number {
    const pa = v3Sub(p, a);
    const ba = v3Sub(b, a);
    const h = clamp(dot3(pa, ba) / Math.max(dot3(ba, ba), 1e-6), 0.0, 1.0);
    return vec3Length(v3Sub(pa, v3Scale(ba, h))) - r;
  },

  sdTorus(p: Vec3, majorR: number, minorR: number): number {
    const qx = Math.hypot(p[0], p[2]) - majorR;
    const qy = p[1];
    return Math.hypot(qx, qy) - minorR;
  },

  sdRampX(
    p: Vec3,
    halfLen: number,
    rise: number,
    halfWidth: number,
    thickness: number,
    railH: number,
    railThick: number,
  ): number {
    const safeLen = Math.max(halfLen, 0.01);
    const tanT = (0.5 * rise) / safeLen;
    const cosT = inversesqrt(1.0 + tanT * tanT);
    const yTop = (p[0] / safeLen) * (0.5 * rise);
    const halfThick = Math.max(0.075, 0.5 * thickness);

    const dRun = Math.abs(p[0]) - safeLen;
    const dDeckY = (Math.abs(p[1] - (yTop - halfThick)) - halfThick) * cosT;
    const dLat = Math.abs(p[2]) - halfWidth;
    let dDeck =
      Math.hypot(Math.max(dRun, 0.0), Math.max(dDeckY, 0.0), Math.max(dLat, 0.0)) +
      Math.min(Math.max(dRun, Math.max(dDeckY, dLat)), 0.0);

    if (railH > 0.001) {
      const hrThick = 0.5 * railThick;
      const hrH = 0.5 * railH;
      const dRailLat = Math.abs(Math.abs(p[2]) - (halfWidth - hrThick)) - hrThick;
      const dRailY = (Math.abs(p[1] - (yTop + hrH)) - hrH) * cosT;
      const dRail =
        Math.hypot(Math.max(dRun, 0.0), Math.max(dRailY, 0.0), Math.max(dRailLat, 0.0)) +
        Math.min(Math.max(dRun, Math.max(dRailY, dRailLat)), 0.0);
      dDeck = Math.min(dDeck, dRail);
    }
    return dDeck;
  },

  sdRampZ(
    p: Vec3,
    halfLen: number,
    rise: number,
    halfWidth: number,
    thickness: number,
    railH: number,
    railThick: number,
  ): number {
    const safeLen = Math.max(halfLen, 0.01);
    const tanT = (0.5 * rise) / safeLen;
    const cosT = inversesqrt(1.0 + tanT * tanT);
    const yTop = (p[2] / safeLen) * (0.5 * rise);
    const halfThick = Math.max(0.075, 0.5 * thickness);

    const dRun = Math.abs(p[2]) - safeLen;
    const dDeckY = (Math.abs(p[1] - (yTop - halfThick)) - halfThick) * cosT;
    const dLat = Math.abs(p[0]) - halfWidth;
    let dDeck =
      Math.hypot(Math.max(dRun, 0.0), Math.max(dDeckY, 0.0), Math.max(dLat, 0.0)) +
      Math.min(Math.max(dRun, Math.max(dDeckY, dLat)), 0.0);

    if (railH > 0.001) {
      const hrThick = 0.5 * railThick;
      const hrH = 0.5 * railH;
      const dRailLat = Math.abs(Math.abs(p[0]) - (halfWidth - hrThick)) - hrThick;
      const dRailY = (Math.abs(p[1] - (yTop + hrH)) - hrH) * cosT;
      const dRail =
        Math.hypot(Math.max(dRun, 0.0), Math.max(dRailY, 0.0), Math.max(dRailLat, 0.0)) +
        Math.min(Math.max(dRun, Math.max(dRailY, dRailLat)), 0.0);
      dDeck = Math.min(dDeck, dRail);
    }
    return dDeck;
  },

  sdRamp(
    p: Vec3,
    axis: 'x' | 'z',
    halfLen: number,
    rise: number,
    halfWidth: number,
    thickness: number,
    railH = 0,
    railThick = 0.28,
  ): number {
    return axis === 'x'
      ? glslIntrinsics.sdRampX(p, halfLen, rise, halfWidth, thickness, railH, railThick)
      : glslIntrinsics.sdRampZ(p, halfLen, rise, halfWidth, thickness, railH, railThick);
  },

  sdSweptTrack(
    p: Vec3,
    a: Vec3,
    b: Vec3,
    halfWidth: number,
    thickness: number,
    railH: number,
    railThick: number,
  ): number {
    const ba = v3Sub(b, a);
    const pa = v3Sub(p, a);
    const l2 = Math.max(dot3(ba, ba), 1e-5);
    const t = clamp(dot3(pa, ba) / l2, 0.0, 1.0);
    const spine = v3Add(a, v3Scale(ba, t));
    const dp = v3Sub(p, spine);

    const horizLen = Math.max(Math.hypot(ba[0], ba[2]), 1e-5);
    const tang: Vec2 = [ba[0] / horizLen, ba[2] / horizLen];
    const norm: Vec2 = [-tang[1], tang[0]];

    const dpxz: Vec2 = [dp[0], dp[2]];
    const lat = dot2(dpxz, norm);
    const along = dot2(dpxz, tang);
    const slopeCos = horizLen * inversesqrt(l2);
    const halfThick = Math.max(0.075, 0.5 * thickness);

    const dAlong = Math.abs(along) - 0.08;
    const dDeckY = (Math.abs(dp[1] + halfThick) - halfThick) * slopeCos;
    const dDeckLat = Math.abs(lat) - halfWidth;
    let dTrack =
      Math.hypot(Math.max(dAlong, 0.0), Math.max(dDeckY, 0.0), Math.max(dDeckLat, 0.0)) +
      Math.min(Math.max(dAlong, Math.max(dDeckY, dDeckLat)), 0.0);

    if (railH > 0.001) {
      const hrThick = 0.5 * railThick;
      const hrH = 0.5 * railH;
      const dRailLat = Math.abs(Math.abs(lat) - (halfWidth - hrThick)) - hrThick;
      const dRailY = (Math.abs(dp[1] - hrH) - hrH) * slopeCos;
      const dRail =
        Math.hypot(Math.max(dAlong, 0.0), Math.max(dRailY, 0.0), Math.max(dRailLat, 0.0)) +
        Math.min(Math.max(dAlong, Math.max(dRailY, dRailLat)), 0.0);
      dTrack = Math.min(dTrack, dRail);
    }
    return dTrack;
  },

  sdWaveFloor(
    p: Vec3,
    b: Vec3,
    amp: number,
    freqX: number,
    freqZ: number,
    speed: number,
    time: number,
  ): number {
    const waveH =
      amp * Math.sin(p[0] * freqX + time * speed) * Math.cos(p[2] * freqZ + time * speed * 0.7);
    const midY = 0.5 * waveH;
    const halfH = Math.max(0.08, b[1] + 0.5 * waveH);
    const qx = Math.abs(p[0]) - b[0];
    const qy = (Math.abs(p[1] - midY) - halfH) * 0.85;
    const qz = Math.abs(p[2]) - b[2];
    return (
      Math.hypot(Math.max(qx, 0.0), Math.max(qy, 0.0), Math.max(qz, 0.0)) +
      Math.min(Math.max(qx, Math.max(qy, qz)), 0.0)
    );
  },

  sdPiston(p: Vec3, headB: Vec3, bevelR: number): number {
    const dHead = glslIntrinsics.sdRoundedBox(p, headB, bevelR);
    const stemR = Math.min(headB[0], headB[2]) * 0.45;
    const dStem = glslIntrinsics.sdCylinder(
      [p[0], p[1] - (headB[1] + 1.2), p[2]],
      stemR,
      1.2,
    );
    return Math.min(dHead, dStem);
  },

  opUnion(a: Vec2, b: Vec2): Vec2 {
    return a[0] <= b[0] ? a : b;
  },

  opSmoothUnion(a: Vec2, b: Vec2, k: number): Vec2 {
    const h = clamp(0.5 + 0.5 * (b[0] - a[0]) / Math.max(k, 1e-4), 0.0, 1.0);
    const d = mix(b[0], a[0], h) - k * h * (1.0 - h);
    return [d, a[0] <= b[0] ? a[1] : b[1]];
  },

  opSubtract(a: Vec2, b: Vec2): Vec2 {
    return [Math.max(a[0], -b[0]), a[1]];
  },

  opSmoothSubtract(a: Vec2, b: Vec2, k: number): Vec2 {
    const h = clamp(0.5 - 0.5 * (a[0] + b[0]) / Math.max(k, 1e-4), 0.0, 1.0);
    const d = mix(a[0], -b[0], h) + k * h * (1.0 - h);
    return [d, a[1]];
  },

  opIntersect(a: Vec2, b: Vec2): Vec2 {
    return a[0] >= b[0] ? a : b;
  },
};

/**
 * Parse the generated `evalCourseWorldRaw` function directly from `compileCourseToGlsl(course)`
 * or `compileCourseToWgsl(course)` and compile it into an executable JS function.
 *
 * This verifies the actual generated shader code (every node index, quaternion, kinematic
 * expression, primitive call, and CSG tree fold), not just string existence!
 */
function lowerCenterExpr(expr: string): string {
  const trimmed = expr.trim();
  // Case 1: `(vec3(cx, cy, cz) + (vec3(ax, ay, az) * <scalar>))`
  const scaleMatch = trimmed.match(
    /^\(vec3\(([^)]+)\) \+ \(vec3\(([^)]+)\) \* (.+)\)\)$/,
  );
  if (scaleMatch) {
    return `v3Add(vec3(${scaleMatch[1]}), v3Scale(vec3(${scaleMatch[2]}), (${scaleMatch[3]})))`;
  }
  // Case 2: `(vec3(cx, cy, cz) + vec3(<ox>, <oy>, <oz>))`
  const orbitMatch = trimmed.match(/^\(vec3\(([^)]+)\) \+ vec3\((.+)\)\)$/);
  if (orbitMatch) {
    return `v3Add(vec3(${orbitMatch[1]}), vec3(${orbitMatch[2]}))`;
  }
  return trimmed;
}

function compileExtractedShaderEvaluator(
  shaderSource: string,
  lang: 'glsl' | 'wgsl',
): (p: Vec3, uTime: number) => Vec2 {
  const headerPattern =
    lang === 'glsl'
      ? /vec2 evalCourseWorldRaw\(vec3 p\) \{\n([\s\S]*?)\n\}/
      : /fn evalCourseWorldRaw\(p: vec3<f32>\) -> vec2<f32> \{\n([\s\S]*?)\n\}/;

  const match = shaderSource.match(headerPattern);
  if (!match) {
    throw new Error(`Failed to extract evalCourseWorldRaw from ${lang.toUpperCase()} shader`);
  }

  const rawLines = match[1].split('\n');
  const jsLines: string[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (line.includes('sdCourseBounds') || line.includes('dBounds')) continue;

    // Normalize WGSL syntax to GLSL-like tokens before lowering
    if (lang === 'wgsl') {
      line = line
        .replace(/vec3<f32>/g, 'vec3')
        .replace(/vec4<f32>/g, 'vec4')
        .replace(/vec2<f32>/g, 'vec2')
        .replace(/u\.time/g, 'uTime')
        .replace(/^let /, 'const ')
        .replace(/^var /, 'let ');
    } else {
      line = line.replace(/^vec3 /, 'const ').replace(/^vec2 /, 'let ');
    }

    // Handle `const p_N = rotateByQuatInverse(p - <centerExpr>, vec4(<q>));`
    const rotMatch = line.match(
      /^const (p_\d+) = rotateByQuatInverse\(p - (.+), vec4\(([^)]+)\)\);$/,
    );
    if (rotMatch) {
      const loweredCenter = lowerCenterExpr(rotMatch[2]);
      line = `const ${rotMatch[1]} = intr.rotateByQuatInverse(v3Sub(p, ${loweredCenter}), vec4(${rotMatch[3]}));`;
    } else {
      // Handle `const p_N = p - <centerExpr>;`
      const transMatch = line.match(/^const (p_\d+) = p - (.+);$/);
      if (transMatch) {
        const loweredCenter = lowerCenterExpr(transMatch[2]);
        line = `const ${transMatch[1]} = v3Sub(p, ${loweredCenter});`;
      }
    }

    // Prefix SDF primitive and CSG operator calls with `intr.`
    line = line.replace(
      /\b(sdBox|sdRoundedBox|sdSphere|sdCylinder|sdCapsule|sdTorus|sdRampX|sdRampZ|sdSweptTrack|sdWaveFloor|sdPiston|opUnion|opSmoothUnion|opSubtract|opSmoothSubtract|opIntersect)\(/g,
      'intr.$1(',
    );

    // Replace math functions with Math.*
    line = line
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\bpow\(/g, 'Math.pow(')
      .replace(/\bmax\(/g, 'Math.max(');

    jsLines.push(line);
  }

  const fnBody = jsLines.join('\n');
  const compiledFn = new Function(
    'p',
    'uTime',
    'intr',
    'vec2',
    'vec3',
    'vec4',
    'v3Add',
    'v3Sub',
    'v3Scale',
    fnBody,
  ) as (
    p: Vec3,
    uTime: number,
    intr: typeof glslIntrinsics,
    v2: typeof vec2,
    v3: typeof vec3,
    v4: typeof vec4,
    add: typeof v3Add,
    sub: typeof v3Sub,
    scale: typeof v3Scale,
  ) => Vec2;

  return (p: Vec3, uTime: number) =>
    compiledFn(p, uTime, glslIntrinsics, vec2, vec3, vec4, v3Add, v3Sub, v3Scale);
}

/**
 * Exact GPU shader `calcWorldNormal(vec3 p)` 4-tap tetrahedral normal.
 */
function calcGpuWorldNormal(
  evalDist: (p: Vec3) => number,
  p: Vec3,
  eps = 0.0022,
): Vec3 {
  const k = 0.57735027;
  const d0 = evalDist([p[0] + eps, p[1] - eps, p[2] - eps]);
  const d1 = evalDist([p[0] - eps, p[1] - eps, p[2] + eps]);
  const d2 = evalDist([p[0] - eps, p[1] + eps, p[2] - eps]);
  const d3 = evalDist([p[0] + eps, p[1] + eps, p[2] + eps]);
  return vec3Normalize([
    k * (d0 - d1 - d2 + d3),
    k * (-d0 - d1 + d2 + d3),
    k * (-d0 + d1 - d2 + d3),
  ]);
}

/**
 * Deterministic Mulberry32 PRNG for reproducible 500-point 3D parity sweeps.
 */
function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('True Numerical GPU-vs-CPU Distance & Surface-Normal Parity Suite', () => {
  it('verifies < 1e-6 primitive & CSG parity for sdBox, sdRoundBox, sdRamp, sdSweptTrack, sdWaveFloor, sdPiston, opSmoothUnion, and opSmoothSubtract', () => {
    const rng = createSeededRng(0x20266e5b);

    const primitives: SdfPrimitiveNode[] = [
      {
        id: 'prim-box',
        kind: 'box',
        material: 'standard',
        center: [0, 0, 0],
        halfExtents: [2.4, 0.8, 3.2],
      },
      {
        id: 'prim-round-box',
        kind: 'roundedBox',
        material: 'ice',
        center: [0, 0, 0],
        halfExtents: [2.5, 0.9, 2.5],
        radius: 0.18,
      },
      {
        id: 'prim-ramp-x',
        kind: 'ramp',
        material: 'standard',
        center: [0, 0, 0],
        axis: 'x',
        halfLength: 4.5,
        rise: -2.2,
        halfWidth: 2.0,
        thickness: 0.6,
        railHeight: 0.45,
        railThickness: 0.28,
      },
      {
        id: 'prim-ramp-z',
        kind: 'ramp',
        material: 'conveyor',
        center: [0, 0, 0],
        axis: 'z',
        halfLength: 5.0,
        rise: 2.8,
        halfWidth: 2.2,
        thickness: 0.65,
        railHeight: 0.5,
        railThickness: 0.3,
      },
      {
        id: 'prim-swept-track',
        kind: 'sweptTrack',
        material: 'standard',
        center: [0, 0, 0],
        start: [-3.5, 2.4, 4.0],
        end: [4.2, -1.2, -5.5],
        halfWidth: 1.8,
        thickness: 0.55,
        railHeight: 0.4,
        railThickness: 0.26,
      },
      {
        id: 'prim-wave-floor',
        kind: 'waveFloor',
        material: 'standard',
        center: [0, 0, 0],
        halfExtents: [4.0, 0.45, 6.0],
        waveAmplitude: 0.38,
        waveFrequencyX: 0.9,
        waveFrequencyZ: 0.75,
        waveSpeed: 2.6,
      },
      {
        id: 'prim-piston',
        kind: 'piston',
        material: 'bumper',
        center: [0, 0, 0],
        headHalfExtents: [1.1, 0.45, 1.1],
        bevelRadius: 0.12,
      },
    ];

    for (let i = 0; i < 100; i++) {
      const p: Vec3 = [
        (rng() * 2 - 1) * 6.0,
        (rng() * 2 - 1) * 4.0,
        (rng() * 2 - 1) * 6.0,
      ];
      const t = rng() * 3.0;

      for (const prim of primitives) {
        const cpuD = evaluatePrimitiveNode(prim, p, t).distance;
        const jetD = evalSceneJetCpu(prim, p, t).distance;

        let gpuD = 0;
        switch (prim.kind) {
          case 'box':
            gpuD = glslIntrinsics.sdBox(p, prim.halfExtents);
            break;
          case 'roundedBox':
            gpuD = glslIntrinsics.sdRoundBox(p, prim.halfExtents, prim.radius);
            break;
          case 'ramp':
            gpuD = glslIntrinsics.sdRamp(
              p,
              prim.axis,
              prim.halfLength,
              prim.rise,
              prim.halfWidth,
              prim.thickness,
              prim.railHeight ?? 0,
              prim.railThickness ?? 0.28,
            );
            break;
          case 'sweptTrack':
            gpuD = glslIntrinsics.sdSweptTrack(
              p,
              prim.start,
              prim.end,
              prim.halfWidth,
              prim.thickness,
              prim.railHeight ?? 0,
              prim.railThickness ?? 0.28,
            );
            break;
          case 'waveFloor':
            gpuD = glslIntrinsics.sdWaveFloor(
              p,
              prim.halfExtents,
              prim.waveAmplitude,
              prim.waveFrequencyX,
              prim.waveFrequencyZ,
              prim.waveSpeed,
              t,
            );
            break;
          case 'piston':
            gpuD = glslIntrinsics.sdPiston(p, prim.headHalfExtents, prim.bevelRadius);
            break;
        }

        expect(Math.abs(gpuD - cpuD)).toBeLessThan(1e-6);
        expect(Math.abs(jetD - cpuD)).toBeLessThan(1e-6);
      }

      // Verify opSmoothUnion & opSmoothSubtract exact equivalence with CPU combineSamples
      const dA = glslIntrinsics.sdBox(p, [2.0, 1.0, 2.0]);
      const dB = glslIntrinsics.sdSphere(p, 1.6);
      const k = 0.24;

      const gpuSmoothU = glslIntrinsics.opSmoothUnion([dA, 0], [dB, 1], k)[0];
      const hU = Math.max(k - Math.abs(dA - dB), 0) / k;
      const cpuSmoothU = Math.min(dA, dB) - 0.25 * hU * hU * k;
      expect(Math.abs(gpuSmoothU - cpuSmoothU)).toBeLessThan(1e-7);

      const gpuSmoothSub = glslIntrinsics.opSmoothSubtract([dA, 0], [dB, 1], k)[0];
      const hSub = Math.max(k - Math.abs(dA + dB), 0) / k;
      const cpuSmoothSub = Math.max(dA, -dB) + 0.25 * hSub * hSub * k;
      expect(Math.abs(gpuSmoothSub - cpuSmoothSub)).toBeLessThan(1e-7);
    }
  });

  it('evaluates compileCourseToGlsl, compileCourseToWgsl & evalMsdfBytecode vs createCpuWorldEvaluator across 500 random 3D coordinates + contact points across all 6 courses at multiple timestamps t (< 1e-4 parity)', () => {
    const rng = createSeededRng(0x6e5b1234);
    const timestamps = [0.0, 0.45, 1.25];

    const compiledCourses = BUILT_IN_COURSES.map((course: CourseSpec) => {
      const glslSource = compileCourseToGlsl(course);
      const wgslSource = compileCourseToWgsl(course);
      return {
        course,
        cpuEval: createCpuWorldEvaluator(course),
        glslEval: compileExtractedShaderEvaluator(glslSource, 'glsl'),
        wgslEval: compileExtractedShaderEvaluator(wgslSource, 'wgsl'),
        msdfProgram: compileCourseToMsdfBytecode(course, 0x6e5b2026),
      };
    });

    let totalRandomEvaluations = 0;
    let totalContactEvaluations = 0;
    let maxGlslCpuDiff = 0;
    let maxWgslCpuDiff = 0;
    let maxMsdfCpuDiff = 0;
    let maxJetCpuDiff = 0;
    let maxNormalDiff = 0;

    // 1. 500 random 3D coordinates distributed across all 6 courses and timestamps
    for (let sampleIdx = 0; sampleIdx < 500; sampleIdx++) {
      const entry = compiledCourses[sampleIdx % compiledCourses.length];
      const { course, cpuEval, glslEval, wgslEval, msdfProgram } = entry;
      const t = timestamps[sampleIdx % timestamps.length];

      // Sample both near course nodes and across the broader 3D bounding volume
      const allPrims = [...course.nodes, ...course.hazards];
      const anchor = allPrims[sampleIdx % allPrims.length].center;
      const p: Vec3 = [
        anchor[0] + (rng() * 2 - 1) * 12.0,
        anchor[1] + (rng() * 2 - 1) * 8.0,
        anchor[2] + (rng() * 2 - 1) * 12.0,
      ];

      const portals = course.portals ?? [];
      const cpuSample = cpuEval.sample(p, t);
      const glslRaw = glslEval(p, t);
      const wgslRaw = wgslEval(p, t);
      const msdfRaw = evalMsdfBytecode(msdfProgram, p, t);
      const jetRaw = evalSceneJetCpu(course, p, t);

      const glslDist = applyPortalThroatCarveToDistance(glslRaw[0], p, portals);
      const wgslDist = applyPortalThroatCarveToDistance(wgslRaw[0], p, portals);
      const msdfDist = applyPortalThroatCarveToDistance(msdfRaw.distance, p, portals);
      const jetDist = applyPortalThroatCarveToDistance(jetRaw.distance, p, portals);

      const diffGlsl = Math.abs(glslDist - cpuSample.distance);
      const diffWgsl = Math.abs(wgslDist - cpuSample.distance);
      const diffMsdf = Math.abs(msdfDist - cpuSample.distance);
      const diffJet = Math.abs(jetDist - cpuSample.distance);

      maxGlslCpuDiff = Math.max(maxGlslCpuDiff, diffGlsl);
      maxWgslCpuDiff = Math.max(maxWgslCpuDiff, diffWgsl);
      maxMsdfCpuDiff = Math.max(maxMsdfCpuDiff, diffMsdf);
      maxJetCpuDiff = Math.max(maxJetCpuDiff, diffJet);

      expect(diffGlsl).toBeLessThan(1e-4);
      expect(diffWgsl).toBeLessThan(1e-4);
      expect(diffMsdf).toBeLessThan(1e-4);
      expect(diffJet).toBeLessThan(1e-4);
      expect(Math.round(glslRaw[1])).toBe(MATERIAL_IDS[cpuSample.material]);
      expect(Math.round(wgslRaw[1])).toBe(MATERIAL_IDS[cpuSample.material]);

      totalRandomEvaluations++;
    }

    // 2. Surface contact points & spawn/checkpoint/goal locations across all 6 courses at multiple timestamps
    for (const entry of compiledCourses) {
      const { course, cpuEval, glslEval, wgslEval, msdfProgram } = entry;
      const portals = course.portals ?? [];

      const contactSeeds: Vec3[] = [
        course.startPos,
        course.goalPos,
        ...(course.checkpoints ?? []).map((cp) => cp.position),
        ...course.nodes.slice(0, 6).map(
          (n): Vec3 => [n.center[0] + 0.15, n.center[1] + 0.65, n.center[2] - 0.15],
        ),
      ];

      for (const t of timestamps) {
        for (const seedPt of contactSeeds) {
          const contact = cpuEval.queryContact(seedPt, 0.45, t);
          const jetContact = cpuEval.queryJetContact!(seedPt, 0.45, t);
          const cp = contact.contactPoint;

          const cpuD = cpuEval.distance(cp, t);
          const glslD = applyPortalThroatCarveToDistance(glslEval(cp, t)[0], cp, portals);
          const wgslD = applyPortalThroatCarveToDistance(wgslEval(cp, t)[0], cp, portals);
          const msdfD = applyPortalThroatCarveToDistance(
            evalMsdfBytecode(msdfProgram, cp, t).distance,
            cp,
            portals,
          );

          expect(Math.abs(glslD - cpuD)).toBeLessThan(1e-4);
          expect(Math.abs(wgslD - cpuD)).toBeLessThan(1e-4);
          expect(Math.abs(msdfD - cpuD)).toBeLessThan(1e-4);
          expect(Math.abs(jetContact.distance - contact.distance)).toBeLessThan(1e-4);

          // Compare GPU tetrahedral normal vs CPU tetrahedral normal at seedPt
          const gpuNormal = calcGpuWorldNormal(
            (pt) => applyPortalThroatCarveToDistance(glslEval(pt, t)[0], pt, portals),
            seedPt,
            0.0025,
          );
          const cpuTetraNormal = calcGpuWorldNormal(
            (pt) => cpuEval.distance(pt, t),
            seedPt,
            0.0025,
          );
          const normalErr = vec3Length(vec3Sub(gpuNormal, cpuTetraNormal));
          maxNormalDiff = Math.max(maxNormalDiff, normalErr);
          expect(normalErr).toBeLessThan(1e-4);

          totalContactEvaluations++;
        }
      }
    }

    expect(totalRandomEvaluations).toBe(500);
    expect(totalContactEvaluations).toBeGreaterThanOrEqual(150);

    console.info('[parity:gpu-vs-cpu]', {
      coursesVerified: compiledCourses.length,
      random3dPointsEvaluated: totalRandomEvaluations,
      contactPointsEvaluated: totalContactEvaluations,
      maxGlslCpuDiff: Number(maxGlslCpuDiff.toExponential(3)),
      maxWgslCpuDiff: Number(maxWgslCpuDiff.toExponential(3)),
      maxMsdfCpuDiff: Number(maxMsdfCpuDiff.toExponential(3)),
      maxJetCpuDiff: Number(maxJetCpuDiff.toExponential(3)),
      maxNormalDiff: Number(maxNormalDiff.toExponential(3)),
    });
  });

  it('verifies live jSDF analytical normals and kappa-March curvature-bounded over-relaxation in compiled shaders', () => {
    const glsl = compileCourseToGlsl(COURSE_1_PRACTICE_RACE);
    const wgsl = compileCourseToWgsl(COURSE_1_PRACTICE_RACE);

    // 1. Both GLSL and WGSL shaders must wire computeKappaOverRelaxation into the live raymarcher
    expect(glsl).toContain('float computeKappaOverRelaxation(float d, float prevD, float prevStep)');
    expect(glsl).toContain('float omegaKappa = computeKappaOverRelaxation(stepDist, prevRadius, prevStep);');
    expect(wgsl).toContain('fn computeKappaOverRelaxation(d: f32, prevD: f32, prevStep: f32) -> f32');

    // 2. Verify analyticalJetNormal matches CPU normal on flat & sloped course surfaces
    const startProbe: Vec3 = [
      COURSE_1_PRACTICE_RACE.startPos[0],
      COURSE_1_PRACTICE_RACE.startPos[1] + 0.25,
      COURSE_1_PRACTICE_RACE.startPos[2],
    ];
    const jetNorm = analyticalJetNormal(COURSE_1_PRACTICE_RACE, startProbe, 0);
    const cpuEval = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const cpuNorm = cpuEval.normal(startProbe, 0);
    expect(vec3Length(vec3Sub(jetNorm, cpuNorm))).toBeLessThan(1e-4);
  });
});
