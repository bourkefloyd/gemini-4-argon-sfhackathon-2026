/**
 * Lockstep GPU Shader Compiler (`src/rendering/shader-compiler.ts`)
 *
 * Compiles any declarative `CourseSpec` into both:
 *   1. GLSL ES 3.00 fragment raymarching shader (`compileCourseToGlsl`)
 *   2. WGSL WebGPU raymarching shader (`compileCourseToWgsl`)
 *
 * Every primitive, kinematic offset, and CSG operator matches `src/sdf/eval-cpu.ts`
 * with exact mathematical parity.
 */

import {
  type CourseSpec,
  type KinematicSpec,
  MATERIAL_IDS,
  type SdfCsgNode,
  type SdfNode,
  type SdfPrimitiveNode,
  type Vec3,
} from '../contracts';
import { buildCourseSceneTree } from '../sdf/eval-cpu';
import { getShatterShaderSnippet, getShockwaveShaderSnippet } from '../vfx';

function f(n: number): string {
  if (!Number.isFinite(n)) return '0.0';
  const s = n.toFixed(5);
  return s.includes('.') ? s : `${s}.0`;
}

function v3Glsl(v: Vec3): string {
  return `vec3(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`;
}

function v3Wgsl(v: Vec3): string {
  return `vec3<f32>(${f(v[0])}, ${f(v[1])}, ${f(v[2])})`;
}

function isCsgNode(node: SdfNode): node is SdfCsgNode {
  return (
    node.kind === 'union' ||
    node.kind === 'smoothUnion' ||
    node.kind === 'subtract' ||
    node.kind === 'smoothSubtract' ||
    node.kind === 'intersect'
  );
}

function compileKinematicOffsetGlsl(k?: KinematicSpec): string {
  if (!k) return 'vec3(0.0)';
  const twoPi = Math.PI * 2;
  const phase = k.phase ?? 0;
  const omega = twoPi * k.frequency;

  if (k.kind === 'piston') {
    const power = k.slamSharpness ?? 2.0;
    return `(${v3Glsl(k.axis)} * (${f(k.stroke)} * pow(max(0.0, 0.5 + 0.5 * sin(${f(omega)} * uTime + ${f(phase)})), ${f(power)})))`;
  }
  if (k.kind === 'bridge') {
    return `(${v3Glsl(k.axis)} * (${f(k.amplitude)} * sin(${f(omega)} * uTime + ${f(phase)})))`;
  }
  // steelie
  if (k.mode === 'orbit') {
    const rx = k.span[0];
    const ry = k.span[1];
    const rz = k.span[2] || k.span[0];
    const ang = `(${f(omega)} * uTime + ${f(phase)})`;
    return `vec3(${f(rx)} * cos(${ang}), ${f(ry)} * sin(2.0 * ${ang}), ${f(rz)} * sin(${ang}))`;
  }
  return `(${v3Glsl(k.span)} * sin(${f(omega)} * uTime + ${f(phase)}))`;
}

function compileKinematicOffsetWgsl(k?: KinematicSpec): string {
  if (!k) return 'vec3<f32>(0.0)';
  const twoPi = Math.PI * 2;
  const phase = k.phase ?? 0;
  const omega = twoPi * k.frequency;

  if (k.kind === 'piston') {
    const power = k.slamSharpness ?? 2.0;
    return `(${v3Wgsl(k.axis)} * (${f(k.stroke)} * pow(max(0.0, 0.5 + 0.5 * sin(${f(omega)} * u.time + ${f(phase)})), ${f(power)})))`;
  }
  if (k.kind === 'bridge') {
    return `(${v3Wgsl(k.axis)} * (${f(k.amplitude)} * sin(${f(omega)} * u.time + ${f(phase)})))`;
  }
  if (k.mode === 'orbit') {
    const rx = k.span[0];
    const ry = k.span[1];
    const rz = k.span[2] || k.span[0];
    const ang = `(${f(omega)} * u.time + ${f(phase)})`;
    return `vec3<f32>(${f(rx)} * cos(${ang}), ${f(ry)} * sin(2.0 * ${ang}), ${f(rz)} * sin(${ang}))`;
  }
  return `(${v3Wgsl(k.span)} * sin(${f(omega)} * u.time + ${f(phase)}))`;
}

function compilePrimitiveExprGlsl(node: SdfPrimitiveNode, localVar: string): string {
  switch (node.kind) {
    case 'box':
      return `sdBox(${localVar}, ${v3Glsl(node.halfExtents)})`;
    case 'roundedBox':
      return `sdRoundedBox(${localVar}, ${v3Glsl(node.halfExtents)}, ${f(node.radius)})`;
    case 'sphere':
      return `sdSphere(${localVar}, ${f(node.radius)})`;
    case 'cylinder':
      return `sdCylinder(${localVar}, ${f(node.radius)}, ${f(node.halfHeight)})`;
    case 'capsule':
      return `sdCapsule(${localVar}, ${v3Glsl(node.a)}, ${v3Glsl(node.b)}, ${f(node.radius)})`;
    case 'torus':
      return `sdTorus(${localVar}, ${f(node.majorRadius)}, ${f(node.minorRadius)})`;
    case 'ramp':
      return (node.axis === 'x' ? 'sdRampX' : 'sdRampZ') +
        `(${localVar}, ${f(node.halfLength)}, ${f(node.rise)}, ${f(node.halfWidth)}, ${f(node.thickness)}, ${f(node.railHeight ?? 0)}, ${f(node.railThickness ?? 0.28)})`;
    case 'sweptTrack':
      return `sdSweptTrack(${localVar}, ${v3Glsl(node.start)}, ${v3Glsl(node.end)}, ${f(node.halfWidth)}, ${f(node.thickness)}, ${f(node.railHeight ?? 0)}, ${f(node.railThickness ?? 0.28)})`;
    case 'waveFloor':
      return `sdWaveFloor(${localVar}, ${v3Glsl(node.halfExtents)}, ${f(node.waveAmplitude)}, ${f(node.waveFrequencyX)}, ${f(node.waveFrequencyZ)}, ${f(node.waveSpeed)}, uTime)`;
    case 'piston':
      return `sdPiston(${localVar}, ${v3Glsl(node.headHalfExtents)}, ${f(node.bevelRadius)})`;
  }
}

function compilePrimitiveExprWgsl(node: SdfPrimitiveNode, localVar: string): string {
  switch (node.kind) {
    case 'box':
      return `sdBox(${localVar}, ${v3Wgsl(node.halfExtents)})`;
    case 'roundedBox':
      return `sdRoundedBox(${localVar}, ${v3Wgsl(node.halfExtents)}, ${f(node.radius)})`;
    case 'sphere':
      return `sdSphere(${localVar}, ${f(node.radius)})`;
    case 'cylinder':
      return `sdCylinder(${localVar}, ${f(node.radius)}, ${f(node.halfHeight)})`;
    case 'capsule':
      return `sdCapsule(${localVar}, ${v3Wgsl(node.a)}, ${v3Wgsl(node.b)}, ${f(node.radius)})`;
    case 'torus':
      return `sdTorus(${localVar}, ${f(node.majorRadius)}, ${f(node.minorRadius)})`;
    case 'ramp':
      return (node.axis === 'x' ? 'sdRampX' : 'sdRampZ') +
        `(${localVar}, ${f(node.halfLength)}, ${f(node.rise)}, ${f(node.halfWidth)}, ${f(node.thickness)}, ${f(node.railHeight ?? 0)}, ${f(node.railThickness ?? 0.28)})`;
    case 'sweptTrack':
      return `sdSweptTrack(${localVar}, ${v3Wgsl(node.start)}, ${v3Wgsl(node.end)}, ${f(node.halfWidth)}, ${f(node.thickness)}, ${f(node.railHeight ?? 0)}, ${f(node.railThickness ?? 0.28)})`;
    case 'waveFloor':
      return `sdWaveFloor(${localVar}, ${v3Wgsl(node.halfExtents)}, ${f(node.waveAmplitude)}, ${f(node.waveFrequencyX)}, ${f(node.waveFrequencyZ)}, ${f(node.waveSpeed)}, u.time)`;
    case 'piston':
      return `sdPiston(${localVar}, ${v3Wgsl(node.headHalfExtents)}, ${f(node.bevelRadius)})`;
  }
}

function buildGlslNodeStatements(
  node: SdfNode,
  lines: string[],
  counter: { id: number },
): string {
  const idx = counter.id++;
  const resVar = `res_${idx}`;

  if (!isCsgNode(node)) {
    const pVar = `p_${idx}`;
    const centerExpr = node.kinematic
      ? `(${v3Glsl(node.center)} + ${compileKinematicOffsetGlsl(node.kinematic)})`
      : v3Glsl(node.center);
    if (node.rotation) {
      const q = node.rotation;
      lines.push(
        `  vec3 ${pVar} = rotateByQuatInverse(p - ${centerExpr}, vec4(${f(q[0])}, ${f(q[1])}, ${f(q[2])}, ${f(q[3])}));`,
      );
    } else {
      lines.push(`  vec3 ${pVar} = p - ${centerExpr};`);
    }
    const matId = f(MATERIAL_IDS[node.material]);
    const dExpr = compilePrimitiveExprGlsl(node, pVar);
    lines.push(`  vec2 ${resVar} = vec2(${dExpr}, ${matId});`);
    return resVar;
  }

  if (node.children.length === 0) {
    lines.push(`  vec2 ${resVar} = vec2(1000.0, 0.0);`);
    return resVar;
  }

  const firstChildVar = buildGlslNodeStatements(node.children[0], lines, counter);
  lines.push(`  vec2 ${resVar} = ${firstChildVar};`);
  const k = f(node.smoothRadius ?? 0.14);

  for (let i = 1; i < node.children.length; i++) {
    const childVar = buildGlslNodeStatements(node.children[i], lines, counter);
    if (node.kind === 'union') {
      lines.push(`  ${resVar} = opUnion(${resVar}, ${childVar});`);
    } else if (node.kind === 'smoothUnion') {
      lines.push(`  ${resVar} = opSmoothUnion(${resVar}, ${childVar}, ${k});`);
    } else if (node.kind === 'subtract') {
      lines.push(`  ${resVar} = opSubtract(${resVar}, ${childVar});`);
    } else if (node.kind === 'smoothSubtract') {
      lines.push(`  ${resVar} = opSmoothSubtract(${resVar}, ${childVar}, ${k});`);
    } else {
      lines.push(`  ${resVar} = opIntersect(${resVar}, ${childVar});`);
    }
  }

  return resVar;
}

/**
 * Compile a `CourseSpec` into a complete GLSL ES 3.00 fragment shader.
 */
export function compileCourseToGlsl(course: CourseSpec): string {
  const rootTree = buildCourseSceneTree(course);
  const bodyLines: string[] = [];
  const counter = { id: 0 };
  const finalVar = buildGlslNodeStatements(rootTree, bodyLines, counter);
  const shatterSnippet = getShatterShaderSnippet().glsl;
  const shockwaveSnippet = getShockwaveShaderSnippet().glsl;

  return `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2 uResolution;
uniform float uTime;

uniform vec3 uCameraPos;
uniform vec3 uCameraForward;
uniform vec3 uCameraRight;
uniform vec3 uCameraUp;
uniform float uCameraTanHalfFov;

uniform vec3 uMarblePos;
uniform vec4 uMarbleQuat;
uniform float uMarbleRadius;
uniform int uMarbleStatus;
uniform float uMarbleStatusTimer;

uniform vec3 uMarbleBaseColor;
uniform vec3 uMarbleVeinColor;
uniform vec3 uMarbleGlowColor;
uniform float uMarbleIridescence;

uniform float uGlassStress;
uniform float uCrackVisibility;
uniform float uStressGlow;

uniform int uGhostActive;
uniform vec3 uGhostPos;
uniform vec4 uGhostQuat;
uniform vec4 uGhostColor;

uniform vec3 uGoalPos;
uniform float uGoalRadius;
uniform float uOcclusionStrength;

uniform vec3 uTrackPrimary;
uniform vec3 uTrackSecondary;
uniform vec3 uGridLineColor;
uniform vec3 uWallColor;
uniform vec3 uSkyZenith;
uniform vec3 uSkyHorizon;
uniform vec3 uAbyssFogColor;
uniform float uAbyssFogDensity;
uniform vec3 uSunDir;

${shatterSnippet}
${shockwaveSnippet}

vec3 rotateByQuatInverse(vec3 d, vec4 q) {
  vec3 t = 2.0 * cross(q.xyz, d);
  return d - q.w * t + cross(q.xyz, t);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdRoundedBox(vec3 p, vec3 b, float r) {
  float cr = min(r, min(b.x, min(b.y, b.z)) * 0.95);
  vec3 core = max(vec3(0.001), b - vec3(cr));
  return sdBox(p, core) - cr;
}

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdCylinder(vec3 p, float radius, float halfHeight) {
  vec2 d = vec2(length(p.xz) - radius, abs(p.y) - halfHeight);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdTorus(vec3 p, float majorR, float minorR) {
  vec2 q = vec2(length(p.xz) - majorR, p.y);
  return length(q) - minorR;
}

float sdRampX(vec3 p, float halfLen, float rise, float halfWidth, float thickness, float railH, float railThick) {
  float safeLen = max(halfLen, 0.01);
  float tanT = (0.5 * rise) / safeLen;
  float cosT = inversesqrt(1.0 + tanT * tanT);
  float yTop = (p.x / safeLen) * (0.5 * rise);
  float halfThick = max(0.075, 0.5 * thickness);

  float dRun = abs(p.x) - safeLen;
  float dDeckY = (abs(p.y - (yTop - halfThick)) - halfThick) * cosT;
  float dLat = abs(p.z) - halfWidth;
  vec3 q = vec3(dRun, dDeckY, dLat);
  float dDeck = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(p.z) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(p.y - (yTop + hrH)) - hrH) * cosT;
    vec3 qr = vec3(dRun, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

float sdRampZ(vec3 p, float halfLen, float rise, float halfWidth, float thickness, float railH, float railThick) {
  float safeLen = max(halfLen, 0.01);
  float tanT = (0.5 * rise) / safeLen;
  float cosT = inversesqrt(1.0 + tanT * tanT);
  float yTop = (p.z / safeLen) * (0.5 * rise);
  float halfThick = max(0.075, 0.5 * thickness);

  float dRun = abs(p.z) - safeLen;
  float dDeckY = (abs(p.y - (yTop - halfThick)) - halfThick) * cosT;
  float dLat = abs(p.x) - halfWidth;
  vec3 q = vec3(dRun, dDeckY, dLat);
  float dDeck = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(p.x) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(p.y - (yTop + hrH)) - hrH) * cosT;
    vec3 qr = vec3(dRun, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

float sdSweptTrack(vec3 p, vec3 a, vec3 b, float halfWidth, float thickness, float railH, float railThick) {
  vec3 ba = b - a;
  vec3 pa = p - a;
  float l2 = max(dot(ba, ba), 1e-5);
  float t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  vec3 spine = a + ba * t;
  vec3 dp = p - spine;

  float horizLen = max(length(ba.xz), 1e-5);
  vec2 tang = ba.xz / horizLen;
  vec2 norm = vec2(-tang.y, tang.x);

  float lat = dot(dp.xz, norm);
  float along = dot(dp.xz, tang);
  float slopeCos = horizLen * inversesqrt(l2);
  float halfThick = max(0.075, 0.5 * thickness);

  float dAlong = abs(along) - 0.08;
  float dDeckY = (abs(dp.y + halfThick) - halfThick) * slopeCos;
  float dDeckLat = abs(lat) - halfWidth;
  vec3 q = vec3(dAlong, dDeckY, dDeckLat);
  float dTrack = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);

  if (railH > 0.001) {
    float hrThick = 0.5 * railThick;
    float hrH = 0.5 * railH;
    float dRailLat = abs(abs(lat) - (halfWidth - hrThick)) - hrThick;
    float dRailY = (abs(dp.y - hrH) - hrH) * slopeCos;
    vec3 qr = vec3(dAlong, dRailY, dRailLat);
    float dRail = length(max(qr, 0.0)) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dTrack = min(dTrack, dRail);
  }
  return dTrack;
}

float sdWaveFloor(vec3 p, vec3 b, float amp, float freqX, float freqZ, float speed, float time) {
  float waveH = amp * sin(p.x * freqX + time * speed) * cos(p.z * freqZ + time * speed * 0.7);
  float midY = 0.5 * waveH;
  float halfH = max(0.08, b.y + 0.5 * waveH);
  vec3 q = vec3(abs(p.x) - b.x, (abs(p.y - midY) - halfH) * 0.85, abs(p.z) - b.z);
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdPiston(vec3 p, vec3 headB, float bevelR) {
  float dHead = sdRoundedBox(p, headB, bevelR);
  float stemR = min(headB.x, headB.z) * 0.45;
  float dStem = sdCylinder(p - vec3(0.0, headB.y + 1.2, 0.0), stemR, 1.2);
  return min(dHead, dStem);
}

vec2 opUnion(vec2 a, vec2 b) {
  return (a.x <= b.x) ? a : b;
}

vec2 opSmoothUnion(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.x - a.x) / max(k, 1e-4), 0.0, 1.0);
  float d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2(d, (a.x <= b.x) ? a.y : b.y);
}

vec2 opSubtract(vec2 a, vec2 b) {
  return vec2(max(a.x, -b.x), a.y);
}

vec2 opSmoothSubtract(vec2 a, vec2 b, float k) {
  float h = clamp(0.5 - 0.5 * (a.x + b.x) / max(k, 1e-4), 0.0, 1.0);
  float d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2(d, a.y);
}

vec2 opIntersect(vec2 a, vec2 b) {
  return (a.x >= b.x) ? a : b;
}

vec2 evalCourseWorldRaw(vec3 p) {
${bodyLines.join('\n')}
  return ${finalVar};
}

vec2 evalWorldSdf(vec3 p) {
  vec2 world = evalCourseWorldRaw(p);

  if (uOcclusionStrength > 0.001) {
    vec3 segEnd = uMarblePos;
    vec3 segStart = uCameraPos;
    float tunnelRadius = uMarbleRadius * 2.15 * uOcclusionStrength;
    float dTunnel = sdCapsule(p, segStart, segEnd, tunnelRadius);
    float k = 0.35;
    float h = clamp(0.5 - 0.5 * (world.x + dTunnel) / k, 0.0, 1.0);
    world.x = mix(world.x, -dTunnel, h) + k * h * (1.0 - h);
  }

  return world;
}

vec2 evalSceneSdf(vec3 p) {
  vec2 res = evalWorldSdf(p);

  // Player marble SDF (material ID = 100.0) vs Shattered Glass Shards (material ID = 102.0)
  if (uMarbleStatus == 2 && uShatterShardCount > 0) {
    vec2 dShards = evalShatterShardsSdf(p);
    if (dShards.x < res.x) {
      res = dShards;
    }
  } else {
    float effRadius = uMarbleRadius;
    if (uMarbleStatus == 3) {
      // Sinking into acid
      effRadius *= max(0.15, 1.0 - 0.65 * clamp(uMarbleStatusTimer, 0.0, 1.2));
    }
    vec3 mp = p - uMarblePos;
    float dMarble = length(mp) - effRadius;
    if (uMarbleStatus == 2) {
      // Shattered displacement fractures fallback
      float shard = sin(mp.x * 18.0 + uTime * 12.0) * cos(mp.y * 18.0) * sin(mp.z * 18.0);
      dMarble += shard * 0.08 * clamp(uMarbleStatusTimer * 2.0, 0.0, 1.0);
    }
    if (dMarble < res.x) {
      res = vec2(dMarble, 100.0);
    }
  }

  // 120 Hz Holographic Ghost Marble SDF (material ID = 103.0)
  if (uGhostActive == 1) {
    vec3 gpGhost = p - uGhostPos;
    // Only render ghost when not overlapping player marble core
    float distToPlayer = length(uGhostPos - uMarblePos);
    if (distToPlayer > 0.08) {
      float dGhost = length(gpGhost) - (uMarbleRadius * 0.96);
      if (dGhost < res.x) {
        res = vec2(dGhost, 103.0);
      }
    }
  }

  // Hovering holographic Goal Halo Torus above the Goal Pad (material ID = 101.0)
  vec3 gp = p - (uGoalPos + vec3(0.0, 1.35 + 0.18 * sin(uTime * 3.2), 0.0));
  float c = cos(uTime * 1.8);
  float s = sin(uTime * 1.8);
  vec3 gpRot = vec3(c * gp.x - s * gp.z, gp.y, s * gp.x + c * gp.z);
  float dGoalHalo = sdTorus(gpRot.xzy, uGoalRadius * 0.52, 0.11);
  if (dGoalHalo < res.x) {
    res = vec2(dGoalHalo, 101.0);
  }

  return res;
}

vec3 calcWorldNormal(vec3 p) {
  const float eps = 0.0022;
  vec2 e = vec2(1.0, -1.0) * 0.57735027;
  return normalize(
    e.xyy * evalSceneSdf(p + e.xyy * eps).x +
    e.yyx * evalSceneSdf(p + e.yyx * eps).x +
    e.yxy * evalSceneSdf(p + e.yxy * eps).x +
    e.xxx * evalSceneSdf(p + e.xxx * eps).x
  );
}

float calcSoftShadow(vec3 ro, vec3 rd) {
  float res = 1.0;
  float t = 0.06;
  for (int i = 0; i < 32; i++) {
    vec3 p = ro + rd * t;
    float h = min(evalCourseWorldRaw(p).x, length(p - uMarblePos) - uMarbleRadius);
    if (h < 0.001) return 0.08;
    res = min(res, 11.0 * h / t);
    t += clamp(h, 0.04, 0.9);
    if (t > 28.0) break;
  }
  return clamp(res, 0.08, 1.0);
}

float calcAmbientOcclusion(vec3 p, vec3 n) {
  float steps[7] = float[7](0.02, 0.045, 0.085, 0.15, 0.24, 0.36, 0.52);
  float weights[7] = float[7](0.22, 0.20, 0.17, 0.15, 0.11, 0.09, 0.06);
  float occ = 0.0;
  for (int i = 0; i < 7; i++) {
    float dist = steps[i];
    float d = evalCourseWorldRaw(p + n * dist).x;
    occ += max(0.0, dist - d - 0.01) / dist * weights[i];
  }
  float ao = clamp(1.0 - occ * 1.25, 0.32, 1.0);
  // Subtle underside darkening
  ao *= mix(0.75, 1.0, clamp(0.5 + 0.5 * n.y, 0.0, 1.0));
  return ao;
}

/**
 * Iconic Marble Madness anti-aliased isometric gridlines etched onto world X/Z & Y surfaces.
 * Uses screen-space partial derivatives (fwidth) so slopes, ramps, chutes, and vertical cliffs
 * remain crisp and free of aliasing at every camera zoom stop.
 */
vec3 shadeCourseSurface(vec3 p, vec3 n, vec3 V, float matId) {
  // 1. Isometric tile coordinates (1.0m minor grid, 2.0m major grid)
  vec2 xz = p.xz;
  vec2 fwXZ = max(fwidth(xz), vec2(0.001));
  vec2 grid1 = abs(fract(xz - 0.5) - 0.5) / fwXZ;
  float lineMinorXZ = 1.0 - smoothstep(0.0, 1.45, min(grid1.x, grid1.y));

  vec2 grid2 = abs(fract(xz * 0.5 - 0.5) - 0.5) / (fwXZ * 0.5);
  float lineMajorXZ = 1.0 - smoothstep(0.0, 1.65, min(grid2.x, grid2.y));

  // Elevation Y contour lines on steep walls and ramps
  float fwY = max(fwidth(p.y), 0.001);
  float gridY = abs(fract(p.y - 0.5) - 0.5) / fwY;
  float lineContourY = (1.0 - smoothstep(0.0, 1.4, gridY)) * smoothstep(0.92, 0.35, abs(n.y));

  float gridMask = clamp(max(lineMinorXZ * 0.65, max(lineMajorXZ * 0.95, lineContourY * 0.7)), 0.0, 1.0);

  // Classic Atari checkerboard tile alternation
  vec2 cell = floor(xz);
  float checker = mod(cell.x + cell.y, 2.0);
  bool isWall = abs(n.y) < 0.48;

  vec3 baseCol = mix(uTrackPrimary, uTrackSecondary, checker * 0.38);
  if (isWall) {
    baseCol = mix(uWallColor, uTrackPrimary * 0.55, 0.35);
  }

  // Slope indicator tint: subtly brighten downhill slope faces
  float slopeSteepness = clamp(1.0 - n.y, 0.0, 1.0);
  if (!isWall && slopeSteepness > 0.04) {
    float chevron = 0.5 + 0.5 * sin((p.x + p.z) * 6.28318);
    baseCol = mix(baseCol, uGridLineColor * 0.85, slopeSteepness * 0.35 * chevron);
  }

  vec3 gridCol = uGridLineColor;
  float roughness = 0.45;
  float emissive = 0.0;

  int m = int(round(matId));
  if (m == 1) {
    // ICE: Crystalline cyan-white specular surface
    baseCol = mix(vec3(0.55, 0.88, 1.0), vec3(0.76, 0.95, 1.0), checker * 0.5);
    gridCol = vec3(0.92, 0.99, 1.0);
    roughness = 0.08;
    float frost = 0.5 + 0.5 * sin(p.x * 9.0 + p.z * 7.0);
    baseCol += vec3(0.08, 0.14, 0.2) * frost;
  } else if (m == 2) {
    // STICKY: High-friction amber honeycomb
    baseCol = mix(vec3(0.78, 0.46, 0.08), vec3(0.58, 0.32, 0.05), checker);
    gridCol = vec3(1.0, 0.78, 0.22);
    roughness = 0.75;
  } else if (m == 3) {
    // BOUNCE PAD: High-energy magenta/orange spring pad with pulsing rings
    float ring = 0.5 + 0.5 * sin(length(fract(p.xz * 0.5) - 0.5) * 28.0 - uTime * 9.0);
    baseCol = mix(vec3(0.88, 0.14, 0.58), vec3(1.0, 0.55, 0.12), ring);
    gridCol = vec3(1.0, 0.92, 0.35);
    emissive = 0.42;
  } else if (m == 4) {
    // ACID POOL: Bubbling emissive toxic green hazard
    float bubble = sin(p.x * 5.5 + uTime * 3.4) * cos(p.z * 5.5 - uTime * 2.8);
    baseCol = mix(vec3(0.08, 0.65, 0.16), vec3(0.45, 1.0, 0.22), 0.5 + 0.5 * bubble);
    gridCol = vec3(0.68, 1.0, 0.35);
    emissive = 0.65;
  } else if (m == 5) {
    // GOAL PAD: Iconic high-contrast gold & emerald finish checkerboard
    vec2 fineCell = floor(p.xz * 2.0);
    float goalChecker = mod(fineCell.x + fineCell.y, 2.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 5.0);
    baseCol = mix(vec3(0.06, 0.78, 0.42), vec3(1.0, 0.84, 0.18), goalChecker);
    gridCol = mix(vec3(1.0, 0.95, 0.55), vec3(0.35, 1.0, 0.75), pulse);
    emissive = 0.45 + 0.2 * pulse;
  } else if (m == 6) {
    // START PAD: Arcade cyan/gold launch platform
    vec2 fineCell = floor(p.xz * 2.0);
    float startChecker = mod(fineCell.x + fineCell.y, 2.0);
    baseCol = mix(vec3(0.12, 0.55, 0.95), vec3(0.95, 0.78, 0.22), startChecker * 0.7);
    gridCol = vec3(0.55, 0.95, 1.0);
    emissive = 0.25;
  } else if (m == 7) {
    // BUMPER / PISTON: Chrome-red arcade kinetic hazard
    baseCol = mix(vec3(0.85, 0.16, 0.22), vec3(0.22, 0.25, 0.32), checker * 0.6);
    gridCol = vec3(1.0, 0.62, 0.18);
    roughness = 0.18;
    emissive = 0.22;
  } else if (m == 8) {
    // CONVEYOR BELT: Scrolling neon chevrons
    float chev = fract((p.x + abs(fract(p.z) - 0.5) * 1.2) * 1.5 - uTime * 2.4);
    float stripe = smoothstep(0.15, 0.25, chev) * (1.0 - smoothstep(0.55, 0.65, chev));
    baseCol = mix(vec3(0.16, 0.22, 0.34), vec3(0.15, 0.85, 0.95), stripe);
    gridCol = vec3(0.45, 0.95, 1.0);
    emissive = 0.2 * stripe;
  }

  vec3 surfaceCol = mix(baseCol, gridCol, gridMask);

  // Highlight the occlusion reveal cutout rim if close to the camera-to-marble ray
  if (uOcclusionStrength > 0.01) {
    float dTunnel = sdCapsule(p, uCameraPos, uMarblePos, uMarbleRadius * 2.15 * uOcclusionStrength);
    float rim = 1.0 - smoothstep(0.0, 0.18, abs(dTunnel));
    surfaceCol = mix(surfaceCol, vec3(0.35, 0.92, 1.0), rim * 0.75);
  }

  // Lighting: Sun diffuse + soft shadow + 7-tap SDF AO + hemisphere sky fill + specular
  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float shadow = calcSoftShadow(p + n * 0.03, L);
  float ao = calcAmbientOcclusion(p, n);

  float skyFill = 0.5 + 0.5 * n.y;
  vec3 ambient = mix(uAbyssFogColor * 0.45, uSkyHorizon * 0.85, skyFill) * ao;

  float specPower = mix(96.0, 12.0, roughness);
  float specStrength = mix(0.85, 0.15, roughness);
  float spec = pow(max(dot(n, H), 0.0), specPower) * specStrength * shadow;

  // Contact shadow directly under the player marble for crisp depth perception
  vec3 toMarble = p - uMarblePos;
  float horizDist = length(toMarble.xz);
  float vertDist = uMarblePos.y - p.y;
  if (vertDist > 0.0 && vertDist < 4.5 && n.y > 0.3) {
    float blob = exp(-horizDist * horizDist / (uMarbleRadius * uMarbleRadius * 1.45)) *
                 clamp(1.0 - vertDist / 4.5, 0.0, 1.0);
    shadow *= (1.0 - 0.62 * blob);
  }

  vec3 lit = surfaceCol * (ambient + vec3(1.05, 0.98, 0.90) * ndotl * shadow * 0.88) +
             vec3(1.0, 0.98, 0.95) * spec +
             surfaceCol * emissive;

  // Apply expanding neon cyan/magenta shockwave contour rings & cliff rim-danger pulse
  lit = applyShockwaveAndRimContours(p, gridMask, lit, uMarblePos);

  return lit;
}

/**
 * Refracting, iridescent subsurface-scattered player marble with internal veins
 * rotated in exact lockstep with the physics quaternion uMarbleQuat, plus
 * progressive Glass Stress internal fracture lines (uGlassStress / uCrackVisibility).
 */
vec3 shadePlayerMarble(vec3 p, vec3 n, vec3 V) {
  vec3 localPos = rotateByQuatInverse((p - uMarblePos) / max(uMarbleRadius, 0.01), uMarbleQuat);
  vec3 localView = rotateByQuatInverse(-V, uMarbleQuat);

  // Refracted internal ray sample for deep glass cat's-eye ribbons
  vec3 internalP = localPos + localView * 0.38;
  float swirl1 = sin(internalP.x * 6.2 + sin(internalP.y * 5.0 + internalP.z * 4.2) * 1.8);
  float swirl2 = cos(internalP.z * 7.5 - sin(internalP.x * 4.8 - internalP.y * 6.0) * 1.6);
  float ribbon = smoothstep(0.15, 0.88, 0.5 + 0.5 * (swirl1 * swirl2));
  float equatorBand = exp(-abs(localPos.y) * 5.5);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float ndotl = max(dot(n, L), 0.0);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 3.2);

  // Subsurface scattering translucency when backlit or side-lit
  vec3 backLightDir = normalize(L + n * 0.45);
  float sss = pow(clamp(dot(V, -backLightDir), 0.0, 1.0), 2.6) * 0.85 +
              pow(1.0 - ndotv, 2.0) * 0.35;

  // Iridescent thin-film spectral shift on rim
  vec3 iridescenceTint = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + ndotv * 1.4));

  vec3 coreCol = mix(uMarbleBaseColor, uMarbleVeinColor, clamp(ribbon * 0.75 + equatorBand * 0.45, 0.0, 1.0));
  coreCol += uMarbleGlowColor * sss * 0.65;
  coreCol = mix(coreCol, iridescenceTint, fresnel * uMarbleIridescence * 0.55);

  // Internal Glass Stress Fracture Veins (Voronoi / Crystalline Cleavage Planes)
  if (uCrackVisibility > 0.01 || uGlassStress > 0.05) {
    vec3 fp = internalP * 7.5;
    float p1 = abs(sin(fp.x * 1.7 + fp.y * 2.3 - fp.z * 1.3));
    float p2 = abs(cos(fp.y * 2.1 - fp.z * 1.9 + fp.x * 1.1));
    float p3 = abs(sin(fp.z * 2.5 + fp.x * 1.5 + fp.y * 0.9));
    float crackLine1 = 1.0 - smoothstep(0.0, 0.09 + 0.08 * uCrackVisibility, min(p1, min(p2, p3)));
    float crackLine2 = 1.0 - smoothstep(0.0, 0.06 * uCrackVisibility, abs(p1 - p2));
    float crackMask = clamp((crackLine1 * 0.75 + crackLine2 * 0.85) * uCrackVisibility, 0.0, 1.0);
    vec3 stressColor = mix(vec3(0.95, 0.98, 1.0), vec3(1.0, 0.38, 0.12), uStressGlow);
    coreCol = mix(coreCol, stressColor * 1.65, crackMask);
    coreCol += vec3(1.0, 0.28, 0.08) * uStressGlow * (0.35 + 0.65 * fresnel);
  }

  float specPrimary = pow(max(dot(n, H), 0.0), 128.0) * 1.35;
  vec3 H2 = normalize(normalize(vec3(-0.6, 0.8, -0.5)) + V);
  float specSecondary = pow(max(dot(n, H2), 0.0), 48.0) * 0.45;

  vec3 col = coreCol * (0.38 + 0.78 * ndotl) +
             vec3(1.0, 0.99, 0.96) * (specPrimary + specSecondary) +
             uMarbleVeinColor * fresnel * 0.45;

  if (uMarbleStatus == 2) {
    // Shattered flash
    col = mix(col, vec3(1.0, 0.45, 0.15), 0.65);
  } else if (uMarbleStatus == 3) {
    // Acid dissolve glow
    col = mix(col, vec3(0.45, 1.0, 0.2), 0.7);
  }

  return col;
}

/**
 * 120 Hz Holographic Ghost Marble (Personal Best Cyan or Argon Pro Par Violet/Gold)
 * with rotating internal scanline bands and translucent rim glow.
 */
vec3 shadeGhostMarble(vec3 p, vec3 n, vec3 V, vec3 ro) {
  vec3 localPos = rotateByQuatInverse((p - uGhostPos) / max(uMarbleRadius, 0.01), uGhostQuat);
  float ndotv = clamp(dot(n, V), 0.0, 1.0);
  float fresnel = pow(1.0 - ndotv, 2.2);

  // Rotating meridian & equator bands so 120 Hz ghost spin is clearly visible
  float meridian = smoothstep(0.72, 0.95, abs(sin(atan(localPos.z, localPos.x) * 4.0)));
  float equator = exp(-abs(localPos.y) * 7.0);
  float scanline = 0.55 + 0.45 * sin((p.y - uGhostPos.y) * 42.0 - uTime * 14.0);

  vec3 holoBase = uGhostColor.rgb;
  vec3 holoAccent = mix(vec3(1.0, 0.88, 0.32), vec3(0.35, 0.98, 1.0), 0.5);
  vec3 ghostGlow = mix(holoBase, holoAccent, clamp(meridian * 0.55 + equator * 0.65, 0.0, 1.0));

  // Sample underlying course surface below the ghost for genuine holographic translucency
  vec3 underPos = vec3(p.x, p.y - uMarbleRadius * 0.9, p.z);
  vec3 bgCol = shadeCourseSurface(underPos, vec3(0.0, 1.0, 0.0), V, 0.0);

  float alpha = clamp(uGhostColor.a * (0.35 + 0.65 * fresnel) * scanline + (meridian + equator) * 0.28, 0.22, 0.88);
  vec3 holoLit = ghostGlow * (0.75 + 0.95 * fresnel) * scanline + vec3(0.95, 1.0, 1.0) * pow(1.0 - ndotv, 5.0) * 0.9;
  return mix(bgCol, holoLit, alpha);
}

vec3 renderSkyAndAbyss(vec3 ro, vec3 rd) {
  float horizon = clamp(0.5 + 0.5 * rd.y, 0.0, 1.0);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(horizon, 0.75));

  // Distant synth-arcade abyss floor grid plane at y = -18.0
  if (rd.y < -0.01) {
    float tFloor = (-18.0 - ro.y) / rd.y;
    if (tFloor > 0.0 && tFloor < 180.0) {
      vec3 fp = ro + rd * tFloor;
      vec2 fw = max(fwidth(fp.xz * 0.25), vec2(0.002));
      vec2 g = abs(fract(fp.xz * 0.25 - 0.5) - 0.5) / fw;
      float line = 1.0 - smoothstep(0.0, 1.5, min(g.x, g.y));
      float fade = exp(-tFloor * 0.022);
      sky = mix(sky, uAbyssFogColor + uGridLineColor * line * 0.32, fade * 0.75);
    }
  }
  return sky;
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  vec3 ro = uCameraPos;
  vec3 rd = normalize(
    uCameraForward +
    ndc.x * aspect * uCameraTanHalfFov * uCameraRight +
    ndc.y * uCameraTanHalfFov * uCameraUp
  );

  float t = 0.1;
  float maxT = 165.0;
  vec2 hit = vec2(maxT, -1.0);
  float volumetricGlow = 0.0;

  for (int i = 0; i < 112; i++) {
    vec3 p = ro + rd * t;
    vec2 s = evalSceneSdf(p);

    // Accumulate subtle goal beacon glow
    float dGoalBeacon = length(p.xz - uGoalPos.xz) - uGoalRadius * 0.65;
    if (p.y > uGoalPos.y && p.y < uGoalPos.y + 4.5 && dGoalBeacon < 0.8) {
      volumetricGlow += exp(-max(dGoalBeacon, 0.0) * 3.5) * (1.0 - (p.y - uGoalPos.y) / 4.5) * 0.012;
    }

    if (s.x < 0.0018) {
      hit = vec2(t, s.y);
      break;
    }
    t += max(s.x * 0.9, 0.004);
    if (t >= maxT) break;
  }

  vec3 skyCol = renderSkyAndAbyss(ro, rd);
  vec3 color = skyCol;

  if (hit.y >= 0.0) {
    vec3 hitPos = ro + rd * hit.x;
    vec3 normal = calcWorldNormal(hitPos);
    vec3 V = -rd;

    if (hit.y > 102.5) {
      // 120 Hz Holographic Ghost Marble
      color = shadeGhostMarble(hitPos, normal, V, ro);
    } else if (hit.y > 101.5) {
      // Raymarched Faceted Glass Shatter Shards
      color = shadeShatterGlassShard(hitPos, normal, V, uMarbleBaseColor, uMarbleVeinColor, uSunDir);
    } else if (hit.y > 100.5) {
      // Hovering Goal Halo Torus
      float pulse = 0.5 + 0.5 * sin(uTime * 6.0);
      color = mix(vec3(0.2, 1.0, 0.72), vec3(1.0, 0.92, 0.28), pulse) * 1.45;
    } else if (hit.y > 99.5) {
      color = shadePlayerMarble(hitPos, normal, V);
    } else {
      color = shadeCourseSurface(hitPos, normal, V, hit.y);
    }

    // Volumetric abyss fog & distance atmospheric perspective
    float distFog = 1.0 - exp(-hit.x * 0.0065 * uAbyssFogDensity);
    float heightFog = clamp((-hitPos.y - 4.0) / 14.0, 0.0, 1.0) * 0.65;
    float fogFactor = clamp(max(distFog, heightFog), 0.0, 0.92);
    color = mix(color, mix(uAbyssFogColor, skyCol, 0.5), fogFactor);
  }

  color += vec3(0.25, 1.0, 0.72) * volumetricGlow;

  // ACES Filmic Tone Mapping + sRGB gamma
  vec3 x = color * 1.08;
  vec3 aces = clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  vec3 srgb = pow(aces, vec3(1.0 / 2.2));

  fragColor = vec4(srgb, 1.0);
}
`;
}

function buildWgslNodeStatements(
  node: SdfNode,
  lines: string[],
  counter: { id: number },
): string {
  const idx = counter.id++;
  const resVar = `res_${idx}`;

  if (!isCsgNode(node)) {
    const pVar = `p_${idx}`;
    const centerExpr = node.kinematic
      ? `(${v3Wgsl(node.center)} + ${compileKinematicOffsetWgsl(node.kinematic)})`
      : v3Wgsl(node.center);
    if (node.rotation) {
      const q = node.rotation;
      lines.push(
        `  let ${pVar} = rotateByQuatInverse(p - ${centerExpr}, vec4<f32>(${f(q[0])}, ${f(q[1])}, ${f(q[2])}, ${f(q[3])}));`,
      );
    } else {
      lines.push(`  let ${pVar} = p - ${centerExpr};`);
    }
    const matId = f(MATERIAL_IDS[node.material]);
    const dExpr = compilePrimitiveExprWgsl(node, pVar);
    lines.push(`  var ${resVar} = vec2<f32>(${dExpr}, ${matId});`);
    return resVar;
  }

  if (node.children.length === 0) {
    lines.push(`  var ${resVar} = vec2<f32>(1000.0, 0.0);`);
    return resVar;
  }

  const firstChildVar = buildWgslNodeStatements(node.children[0], lines, counter);
  lines.push(`  var ${resVar} = ${firstChildVar};`);
  const k = f(node.smoothRadius ?? 0.14);

  for (let i = 1; i < node.children.length; i++) {
    const childVar = buildWgslNodeStatements(node.children[i], lines, counter);
    if (node.kind === 'union') {
      lines.push(`  ${resVar} = opUnion(${resVar}, ${childVar});`);
    } else if (node.kind === 'smoothUnion') {
      lines.push(`  ${resVar} = opSmoothUnion(${resVar}, ${childVar}, ${k});`);
    } else if (node.kind === 'subtract') {
      lines.push(`  ${resVar} = opSubtract(${resVar}, ${childVar});`);
    } else if (node.kind === 'smoothSubtract') {
      lines.push(`  ${resVar} = opSmoothSubtract(${resVar}, ${childVar}, ${k});`);
    } else {
      lines.push(`  ${resVar} = opIntersect(${resVar}, ${childVar});`);
    }
  }

  return resVar;
}

/**
 * Compile a `CourseSpec` into a WGSL WebGPU shader module with 1:1 parity
 * to `compileCourseToGlsl` and `src/sdf/eval-cpu.ts`.
 */
export function compileCourseToWgsl(course: CourseSpec): string {
  const rootTree = buildCourseSceneTree(course);
  const bodyLines: string[] = [];
  const counter = { id: 0 };
  const finalVar = buildWgslNodeStatements(rootTree, bodyLines, counter);
  const shatterWgsl = getShatterShaderSnippet().wgsl;
  const shockwaveWgsl = getShockwaveShaderSnippet().wgsl;

  return `// WGSL Lockstep Raymarching Shader for course: ${course.id}
struct Uniforms {
  resolution: vec2<f32>,
  time: f32,
  occlusionStrength: f32,
  cameraPos: vec3<f32>,
  cameraTanHalfFov: f32,
  cameraForward: vec3<f32>,
  marbleRadius: f32,
  cameraRight: vec3<f32>,
  goalRadius: f32,
  cameraUp: vec3<f32>,
  abyssFogDensity: f32,
  marblePos: vec3<f32>,
  marbleStatus: f32,
  marbleQuat: vec4<f32>,
  goalPos: vec3<f32>,
  marbleIridescence: f32,
  glassStress: f32,
  crackVisibility: f32,
  stressGlow: f32,
  ghostActive: f32,
  ghostPos: vec3<f32>,
  padGhost: f32,
  ghostQuat: vec4<f32>,
  ghostColor: vec4<f32>,
  trackPrimary: vec3<f32>,
  pad0: f32,
  trackSecondary: vec3<f32>,
  pad1: f32,
  gridLineColor: vec3<f32>,
  pad2: f32,
  wallColor: vec3<f32>,
  pad3: f32,
  sunDir: vec3<f32>,
  pad4: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

${shatterWgsl}
${shockwaveWgsl}

fn rotateByQuatInverse(d: vec3<f32>, q: vec4<f32>) -> vec3<f32> {
  let t = 2.0 * cross(q.xyz, d);
  return d - q.w * t + cross(q.xyz, t);
}

fn sdBox(p: vec3<f32>, b: vec3<f32>) -> f32 {
  let q = abs(p) - b;
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdRoundedBox(p: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let cr = min(r, min(b.x, min(b.y, b.z)) * 0.95);
  let core = max(vec3<f32>(0.001), b - vec3<f32>(cr));
  return sdBox(p, core) - cr;
}

fn sdSphere(p: vec3<f32>, r: f32) -> f32 {
  return length(p) - r;
}

fn sdCylinder(p: vec3<f32>, radius: f32, halfHeight: f32) -> f32 {
  let d = vec2<f32>(length(p.xz) - radius, abs(p.y) - halfHeight);
  return min(max(d.x, d.y), 0.0) + length(max(d, vec2<f32>(0.0)));
}

fn sdCapsule(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, r: f32) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

fn sdTorus(p: vec3<f32>, majorR: f32, minorR: f32) -> f32 {
  let q = vec2<f32>(length(p.xz) - majorR, p.y);
  return length(q) - minorR;
}

fn sdRampX(p: vec3<f32>, halfLen: f32, rise: f32, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let safeLen = max(halfLen, 0.01);
  let tanT = (0.5 * rise) / safeLen;
  let cosT = inverseSqrt(1.0 + tanT * tanT);
  let yTop = (p.x / safeLen) * (0.5 * rise);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(p.x) - safeLen, (abs(p.y - (yTop - halfThick)) - halfThick) * cosT, abs(p.z) - halfWidth);
  var dDeck = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(p.x) - safeLen, (abs(p.y - (yTop + hrH)) - hrH) * cosT, abs(abs(p.z) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

fn sdRampZ(p: vec3<f32>, halfLen: f32, rise: f32, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let safeLen = max(halfLen, 0.01);
  let tanT = (0.5 * rise) / safeLen;
  let cosT = inverseSqrt(1.0 + tanT * tanT);
  let yTop = (p.z / safeLen) * (0.5 * rise);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(p.z) - safeLen, (abs(p.y - (yTop - halfThick)) - halfThick) * cosT, abs(p.x) - halfWidth);
  var dDeck = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(p.z) - safeLen, (abs(p.y - (yTop + hrH)) - hrH) * cosT, abs(abs(p.x) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dDeck = min(dDeck, dRail);
  }
  return dDeck;
}

fn sdSweptTrack(p: vec3<f32>, a: vec3<f32>, b: vec3<f32>, halfWidth: f32, thickness: f32, railH: f32, railThick: f32) -> f32 {
  let ba = b - a;
  let pa = p - a;
  let l2 = max(dot(ba, ba), 1e-5);
  let t = clamp(dot(pa, ba) / l2, 0.0, 1.0);
  let spine = a + ba * t;
  let dp = p - spine;
  let horizLen = max(length(ba.xz), 1e-5);
  let tang = ba.xz / horizLen;
  let norm = vec2<f32>(-tang.y, tang.x);
  let lat = dot(dp.xz, norm);
  let along = dot(dp.xz, tang);
  let slopeCos = horizLen * inverseSqrt(l2);
  let halfThick = max(0.075, 0.5 * thickness);
  let q = vec3<f32>(abs(along) - 0.08, (abs(dp.y + halfThick) - halfThick) * slopeCos, abs(lat) - halfWidth);
  var dTrack = length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
  if (railH > 0.001) {
    let hrThick = 0.5 * railThick;
    let hrH = 0.5 * railH;
    let qr = vec3<f32>(abs(along) - 0.08, (abs(dp.y - hrH) - hrH) * slopeCos, abs(abs(lat) - (halfWidth - hrThick)) - hrThick);
    let dRail = length(max(qr, vec3<f32>(0.0))) + min(max(qr.x, max(qr.y, qr.z)), 0.0);
    dTrack = min(dTrack, dRail);
  }
  return dTrack;
}

fn sdWaveFloor(p: vec3<f32>, b: vec3<f32>, amp: f32, freqX: f32, freqZ: f32, speed: f32, time: f32) -> f32 {
  let waveH = amp * sin(p.x * freqX + time * speed) * cos(p.z * freqZ + time * speed * 0.7);
  let midY = 0.5 * waveH;
  let halfH = max(0.08, b.y + 0.5 * waveH);
  let q = vec3<f32>(abs(p.x) - b.x, (abs(p.y - midY) - halfH) * 0.85, abs(p.z) - b.z);
  return length(max(q, vec3<f32>(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0);
}

fn sdPiston(p: vec3<f32>, headB: vec3<f32>, bevelR: f32) -> f32 {
  let dHead = sdRoundedBox(p, headB, bevelR);
  let stemR = min(headB.x, headB.z) * 0.45;
  let dStem = sdCylinder(p - vec3<f32>(0.0, headB.y + 1.2, 0.0), stemR, 1.2);
  return min(dHead, dStem);
}

fn opUnion(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return select(b, a, a.x <= b.x);
}

fn opSmoothUnion(a: vec2<f32>, b: vec2<f32>, k: f32) -> vec2<f32> {
  let h = clamp(0.5 + 0.5 * (b.x - a.x) / max(k, 1e-4), 0.0, 1.0);
  let d = mix(b.x, a.x, h) - k * h * (1.0 - h);
  return vec2<f32>(d, select(b.y, a.y, a.x <= b.x));
}

fn opSubtract(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(max(a.x, -b.x), a.y);
}

fn opSmoothSubtract(a: vec2<f32>, b: vec2<f32>, k: f32) -> vec2<f32> {
  let h = clamp(0.5 - 0.5 * (a.x + b.x) / max(k, 1e-4), 0.0, 1.0);
  let d = mix(a.x, -b.x, h) + k * h * (1.0 - h);
  return vec2<f32>(d, a.y);
}

fn opIntersect(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return select(b, a, a.x >= b.x);
}

fn evalCourseWorldRaw(p: vec3<f32>) -> vec2<f32> {
${bodyLines.join('\n')}
  return ${finalVar};
}
`;
}
