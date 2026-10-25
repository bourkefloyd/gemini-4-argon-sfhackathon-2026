/**
 * Lockstep CPU SDF Evaluator (`src/sdf/eval-cpu.ts`)
 *
 * Implements exact CPU signed distance evaluation, kinematic transform & velocity
 * derivatives, tetrahedral + seam-biased surface normals, contact queries,
 * 12-step sphereCast CCD, and camera-to-marble line-of-sight occlusion detection.
 *
 * Every mathematical primitive and CSG operator here is mirrored 1:1 in
 * `src/rendering/shader-compiler.ts` (GLSL ES 3.00 & WGSL).
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  type FieldMutation,
  type KinematicSpec,
  MATERIAL_IDS,
  type PortalPair,
  type Quat,
  type SdfContactQuery,
  type SdfCsgNode,
  type SdfNode,
  type SdfPrimitiveNode,
  type SdfSample,
  type SphereCastHit,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import { applyPortalThroatCarveToDistance } from '../portals';
import { applyFieldMutationsToSample } from '../weapons';

const ZERO_VEC3: Vec3 = [0, 0, 0];
const SEAM_BIAS_EPS = 0.03;
const SEAM_SUPPORT_MIN_Y = 0.68;
const NORMAL_EPS = 0.0025;

export type { CpuWorldEvaluator };
export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vec3Normalize(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  if (len < 1e-8) return [0, 1, 0];
  return [a[0] / len, a[1] / len, a[2] / len];
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

export function quatNormalize(q: Quat): Quat {
  const len = Math.hypot(q[0], q[1], q[2], q[3]);
  if (len < 1e-8) return [0, 0, 0, 1];
  return [q[0] / len, q[1] / len, q[2] / len, q[3] / len];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let [bx, by, bz, bw] = b;
  let cosHalfTheta = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;
  if (cosHalfTheta < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
    cosHalfTheta = -cosHalfTheta;
  }
  if (cosHalfTheta >= 0.9995) {
    return quatNormalize([
      a[0] + (bx - a[0]) * t,
      a[1] + (by - a[1]) * t,
      a[2] + (bz - a[2]) * t,
      a[3] + (bw - a[3]) * t,
    ]);
  }
  const halfTheta = Math.acos(Math.min(1, Math.max(-1, cosHalfTheta)));
  const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
  return [
    a[0] * ratioA + bx * ratioB,
    a[1] * ratioA + by * ratioB,
    a[2] * ratioA + bz * ratioB,
    a[3] * ratioA + bw * ratioB,
  ];
}

/**
 * Rotate vector `d` by the inverse (conjugate) of unit quaternion `q = [qx, qy, qz, qw]`.
 * Matches the GPU shader function `rotateByQuatInverse(d, q)` identically.
 */
export function rotateByQuatInverse(d: Vec3, q?: Quat): Vec3 {
  if (!q) return d;
  const [qx, qy, qz, qw] = q;
  // t = 2 * cross(q.xyz, d)
  const tx = 2 * (qy * d[2] - qz * d[1]);
  const ty = 2 * (qz * d[0] - qx * d[2]);
  const tz = 2 * (qx * d[1] - qy * d[0]);
  // d - qw * t + cross(q.xyz, t)
  const cx = qy * tz - qz * ty;
  const cy = qz * tx - qx * tz;
  const cz = qx * ty - qy * tx;
  return [
    d[0] - qw * tx + cx,
    d[1] - qw * ty + cy,
    d[2] - qw * tz + cz,
  ];
}

/**
 * Evaluate time-driven kinematic displacement and instantaneous world velocity.
 * Mirrors the GPU shader's kinematic offset functions so moving pistons,
 * bridges, and patrolling Steelie spheres match between render and physics.
 */
export function evaluateKinematicMotion(
  kinematic: KinematicSpec | undefined,
  time: number,
): { offset: Vec3; velocity: Vec3 } {
  if (!kinematic) {
    return { offset: ZERO_VEC3, velocity: ZERO_VEC3 };
  }

  const twoPi = Math.PI * 2;

  if (kinematic.kind === 'piston') {
    const phase = kinematic.phase ?? 0;
    const omega = twoPi * kinematic.frequency;
    const angle = omega * time + phase;
    const s = 0.5 + 0.5 * Math.sin(angle);
    const dsDt = 0.5 * omega * Math.cos(angle);
    const power = kinematic.slamSharpness ?? 2.0;
    const wave = Math.pow(Math.max(0, s), power);
    const dwaveDt =
      power * Math.pow(Math.max(1e-6, s), Math.max(0, power - 1)) * dsDt;
    const disp = kinematic.stroke * wave;
    const speed = kinematic.stroke * dwaveDt;
    return {
      offset: vec3Scale(kinematic.axis, disp),
      velocity: vec3Scale(kinematic.axis, speed),
    };
  }

  if (kinematic.kind === 'bridge') {
    const phase = kinematic.phase ?? 0;
    const omega = twoPi * kinematic.frequency;
    const angle = omega * time + phase;
    const disp = kinematic.amplitude * Math.sin(angle);
    const speed = kinematic.amplitude * omega * Math.cos(angle);
    return {
      offset: vec3Scale(kinematic.axis, disp),
      velocity: vec3Scale(kinematic.axis, speed),
    };
  }

  // kinematic.kind === 'steelie'
  const phase = kinematic.phase ?? 0;
  const omega = twoPi * kinematic.frequency;
  const angle = omega * time + phase;
  if (kinematic.mode === 'orbit') {
    const rx = kinematic.span[0];
    const rz = kinematic.span[2] || kinematic.span[0];
    return {
      offset: [
        rx * Math.cos(angle),
        kinematic.span[1] * Math.sin(angle * 2),
        rz * Math.sin(angle),
      ],
      velocity: [
        -rx * omega * Math.sin(angle),
        kinematic.span[1] * 2 * omega * Math.cos(angle * 2),
        rz * omega * Math.cos(angle),
      ],
    };
  }

  // patrol mode
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  return {
    offset: vec3Scale(kinematic.span, sinA),
    velocity: vec3Scale(kinematic.span, omega * cosA),
  };
}

function sdBoxLocal(p: Vec3, b: Vec3): number {
  const qx = Math.abs(p[0]) - b[0];
  const qy = Math.abs(p[1]) - b[1];
  const qz = Math.abs(p[2]) - b[2];
  const outLen = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  const inDist = Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  return outLen + inDist;
}

function sdRoundedBoxLocal(p: Vec3, b: Vec3, r: number): number {
  const clampedR = Math.min(r, Math.min(b[0], Math.min(b[1], b[2])) * 0.95);
  const core: Vec3 = [
    Math.max(0.001, b[0] - clampedR),
    Math.max(0.001, b[1] - clampedR),
    Math.max(0.001, b[2] - clampedR),
  ];
  return sdBoxLocal(p, core) - clampedR;
}

function sdSphereLocal(p: Vec3, r: number): number {
  return Math.hypot(p[0], p[1], p[2]) - r;
}

function sdCylinderLocal(p: Vec3, radius: number, halfHeight: number): number {
  const dx = Math.hypot(p[0], p[2]) - radius;
  const dy = Math.abs(p[1]) - halfHeight;
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}

function sdCapsuleLocal(p: Vec3, a: Vec3, b: Vec3, r: number): number {
  const pax = p[0] - a[0];
  const pay = p[1] - a[1];
  const paz = p[2] - a[2];
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const baz = b[2] - a[2];
  const baba = Math.max(bax * bax + bay * bay + baz * baz, 1e-6);
  const papa = pax * bax + pay * bay + paz * baz;
  const h = Math.min(1, Math.max(0, papa / baba));
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}

function sdTorusLocal(p: Vec3, majorR: number, minorR: number): number {
  const qx = Math.hypot(p[0], p[2]) - majorR;
  const qy = p[1];
  return Math.hypot(qx, qy) - minorR;
}

function sdRampLocal(
  p: Vec3,
  axis: 'x' | 'z',
  halfLength: number,
  rise: number,
  halfWidth: number,
  thickness: number,
  railHeight = 0,
  railThickness = 0.28,
): number {
  const runCoord = axis === 'x' ? p[0] : p[2];
  const latCoord = axis === 'x' ? p[2] : p[0];
  const safeHalfLen = Math.max(halfLength, 0.01);
  const tanTheta = (0.5 * rise) / safeHalfLen;
  const cosTheta = 1.0 / Math.sqrt(1.0 + tanTheta * tanTheta);
  const yTop = (runCoord / safeHalfLen) * (0.5 * rise);
  const halfThick = Math.max(0.075, 0.5 * thickness);

  const dRun = Math.abs(runCoord) - safeHalfLen;
  const dDeckY = (Math.abs(p[1] - (yTop - halfThick)) - halfThick) * cosTheta;
  const dLat = Math.abs(latCoord) - halfWidth;

  let dDeck =
    Math.hypot(Math.max(dRun, 0), Math.max(dDeckY, 0), Math.max(dLat, 0)) +
    Math.min(Math.max(dRun, Math.max(dDeckY, dLat)), 0);

  if (railHeight > 0.001) {
    const halfRailThick = 0.5 * railThickness;
    const halfRailH = 0.5 * railHeight;
    const dRailLat = Math.abs(Math.abs(latCoord) - (halfWidth - halfRailThick)) - halfRailThick;
    const dRailY = (Math.abs(p[1] - (yTop + halfRailH)) - halfRailH) * cosTheta;
    const dRail =
      Math.hypot(Math.max(dRun, 0), Math.max(dRailY, 0), Math.max(dRailLat, 0)) +
      Math.min(Math.max(dRun, Math.max(dRailY, dRailLat)), 0);
    dDeck = Math.min(dDeck, dRail);
  }

  return dDeck;
}

function sdSweptTrackLocal(
  p: Vec3,
  start: Vec3,
  end: Vec3,
  halfWidth: number,
  thickness: number,
  railHeight = 0,
  railThickness = 0.28,
): number {
  const bax = end[0] - start[0];
  const bay = end[1] - start[1];
  const baz = end[2] - start[2];
  const pax = p[0] - start[0];
  const pay = p[1] - start[1];
  const paz = p[2] - start[2];

  const l2 = Math.max(bax * bax + bay * bay + baz * baz, 1e-5);
  const t = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / l2));

  const sx = start[0] + bax * t;
  const sy = start[1] + bay * t;
  const sz = start[2] + baz * t;

  const dpx = p[0] - sx;
  const dpy = p[1] - sy;
  const dpz = p[2] - sz;

  const horizLen = Math.max(Math.hypot(bax, baz), 1e-5);
  const tx = bax / horizLen;
  const tz = baz / horizLen;
  const nx = -tz;
  const nz = tx;

  const lat = dpx * nx + dpz * nz;
  const along = dpx * tx + dpz * tz;
  const slopeCos = horizLen / Math.sqrt(l2);
  const halfThick = Math.max(0.075, 0.5 * thickness);

  const dAlong = Math.abs(along) - 0.08;
  const dDeckY = (Math.abs(dpy + halfThick) - halfThick) * slopeCos;
  const dDeckLat = Math.abs(lat) - halfWidth;

  let dTrack =
    Math.hypot(Math.max(dAlong, 0), Math.max(dDeckY, 0), Math.max(dDeckLat, 0)) +
    Math.min(Math.max(dAlong, Math.max(dDeckY, dDeckLat)), 0);

  if (railHeight > 0.001) {
    const halfRailThick = 0.5 * railThickness;
    const halfRailH = 0.5 * railHeight;
    const dRailLat = Math.abs(Math.abs(lat) - (halfWidth - halfRailThick)) - halfRailThick;
    const dRailY = (Math.abs(dpy - halfRailH) - halfRailH) * slopeCos;
    const dRail =
      Math.hypot(Math.max(dAlong, 0), Math.max(dRailY, 0), Math.max(dRailLat, 0)) +
      Math.min(Math.max(dAlong, Math.max(dRailY, dRailLat)), 0);
    dTrack = Math.min(dTrack, dRail);
  }

  return dTrack;
}

function sdWaveFloorLocal(
  p: Vec3,
  halfExtents: Vec3,
  waveAmplitude: number,
  waveFrequencyX: number,
  waveFrequencyZ: number,
  waveSpeed: number,
  time: number,
): number {
  const waveH =
    waveAmplitude *
    Math.sin(p[0] * waveFrequencyX + time * waveSpeed) *
    Math.cos(p[2] * waveFrequencyZ + time * waveSpeed * 0.7);
  const midY = 0.5 * waveH;
  const halfH = Math.max(0.08, halfExtents[1] + 0.5 * waveH);
  const qx = Math.abs(p[0]) - halfExtents[0];
  const qy = (Math.abs(p[1] - midY) - halfH) * 0.85;
  const qz = Math.abs(p[2]) - halfExtents[2];
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
    Math.min(Math.max(qx, Math.max(qy, qz)), 0)
  );
}

function sdPistonLocal(p: Vec3, headHalfExtents: Vec3, bevelRadius: number): number {
  const dHead = sdRoundedBoxLocal(p, headHalfExtents, bevelRadius);
  const stemRadius = Math.min(headHalfExtents[0], headHalfExtents[2]) * 0.45;
  const stemHalfH = 1.2;
  const dStem = sdCylinderLocal(
    [p[0], p[1] - (headHalfExtents[1] + stemHalfH), p[2]],
    stemRadius,
    stemHalfH,
  );
  return Math.min(dHead, dStem);
}

/**
 * Evaluate a single primitive node at world point `p` and simulation time `time`.
 */
export function evaluatePrimitiveNode(
  node: SdfPrimitiveNode,
  p: Vec3,
  time: number,
): SdfSample {
  const { offset, velocity } = evaluateKinematicMotion(node.kinematic, time);
  const animatedCenter = vec3Add(node.center, offset);
  const localP = rotateByQuatInverse(vec3Sub(p, animatedCenter), node.rotation);

  let d = Infinity;
  switch (node.kind) {
    case 'box':
      d = sdBoxLocal(localP, node.halfExtents);
      break;
    case 'roundedBox':
      d = sdRoundedBoxLocal(localP, node.halfExtents, node.radius);
      break;
    case 'sphere':
      d = sdSphereLocal(localP, node.radius);
      break;
    case 'cylinder':
      d = sdCylinderLocal(localP, node.radius, node.halfHeight);
      break;
    case 'capsule':
      d = sdCapsuleLocal(localP, node.a, node.b, node.radius);
      break;
    case 'torus':
      d = sdTorusLocal(localP, node.majorRadius, node.minorRadius);
      break;
    case 'ramp':
      d = sdRampLocal(
        localP,
        node.axis,
        node.halfLength,
        node.rise,
        node.halfWidth,
        node.thickness,
        node.railHeight ?? 0,
        node.railThickness ?? 0.28,
      );
      break;
    case 'sweptTrack':
      d = sdSweptTrackLocal(
        localP,
        node.start,
        node.end,
        node.halfWidth,
        node.thickness,
        node.railHeight ?? 0,
        node.railThickness ?? 0.28,
      );
      break;
    case 'waveFloor':
      d = sdWaveFloorLocal(
        localP,
        node.halfExtents,
        node.waveAmplitude,
        node.waveFrequencyX,
        node.waveFrequencyZ,
        node.waveSpeed,
        time,
      );
      break;
    case 'piston':
      d = sdPistonLocal(localP, node.headHalfExtents, node.bevelRadius);
      break;
  }

  let conveyorVelocity = ZERO_VEC3;
  if (node.material === 'conveyor' && node.conveyorDirection) {
    conveyorVelocity = node.conveyorDirection;
  }

  // Add subtle vertical surface velocity for waveFloor so the undulating floor pushes the marble!
  let kinematicVelocity = velocity;
  if (node.kind === 'waveFloor') {
    const dWaveDt =
      node.waveAmplitude *
      node.waveSpeed *
      (Math.cos(localP[0] * node.waveFrequencyX + time * node.waveSpeed) *
        Math.cos(localP[2] * node.waveFrequencyZ + time * node.waveSpeed * 0.7) -
        0.7 *
          Math.sin(localP[0] * node.waveFrequencyX + time * node.waveSpeed) *
          Math.sin(localP[2] * node.waveFrequencyZ + time * node.waveSpeed * 0.7));
    kinematicVelocity = [velocity[0], velocity[1] + dWaveDt * 0.5, velocity[2]];
  }

  return {
    distance: d,
    material: node.material,
    materialId: MATERIAL_IDS[node.material],
    nodeId: node.id,
    kinematicVelocity,
    conveyorVelocity,
  };
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

function combineSamples(
  op: SdfCsgNode['kind'],
  a: SdfSample,
  b: SdfSample,
  smoothRadius = 0.15,
): SdfSample {
  if (op === 'union') {
    return a.distance <= b.distance ? a : b;
  }
  if (op === 'smoothUnion') {
    const k = Math.max(1e-4, smoothRadius);
    const h = Math.max(k - Math.abs(a.distance - b.distance), 0) / k;
    const d = Math.min(a.distance, b.distance) - 0.25 * h * h * k;
    const winner = a.distance <= b.distance ? a : b;
    return { ...winner, distance: d };
  }
  if (op === 'subtract') {
    const d = Math.max(a.distance, -b.distance);
    return { ...a, distance: d };
  }
  if (op === 'smoothSubtract') {
    const k = Math.max(1e-4, smoothRadius);
    const h = Math.max(k - Math.abs(a.distance + b.distance), 0) / k;
    const d = Math.max(a.distance, -b.distance) + 0.25 * h * h * k;
    return { ...a, distance: d };
  }
  // intersect
  const d = Math.max(a.distance, b.distance);
  const winner = a.distance >= b.distance ? a : b;
  return { ...winner, distance: d };
}

export function evaluateSdfTree(node: SdfNode, p: Vec3, time: number): SdfSample {
  if (!isCsgNode(node)) {
    return evaluatePrimitiveNode(node, p, time);
  }
  if (node.children.length === 0) {
    return {
      distance: 1000,
      material: 'standard',
      materialId: 0,
      kinematicVelocity: ZERO_VEC3,
      conveyorVelocity: ZERO_VEC3,
    };
  }
  let acc = evaluateSdfTree(node.children[0], p, time);
  const k = node.smoothRadius ?? 0.14;
  for (let i = 1; i < node.children.length; i++) {
    const next = evaluateSdfTree(node.children[i], p, time);
    acc = combineSamples(node.kind, acc, next, k);
  }
  return acc;
}

/**
 * Normalize a `CourseSpec` into a single canonical root `SdfNode` tree,
 * combining `course.scene` (if provided), `course.nodes`, and `course.hazards`.
 */
export function buildCourseSceneTree(course: CourseSpec): SdfNode {
  const children: SdfNode[] = [];
  if (course.scene) {
    children.push(course.scene);
  }

  const smoothTrackNodes: SdfPrimitiveNode[] = [];
  const crispFeatureNodes: SdfPrimitiveNode[] = [];

  for (const n of course.nodes) {
    if (n.supportBias && n.material === 'standard' && !n.kinematic) {
      smoothTrackNodes.push(n);
    } else {
      crispFeatureNodes.push(n);
    }
  }

  if (smoothTrackNodes.length > 1) {
    children.push({
      id: `${course.id}-smooth-track`,
      kind: 'smoothUnion',
      smoothRadius: 0.14,
      children: smoothTrackNodes,
    });
  } else {
    for (const n of smoothTrackNodes) {
      children.push(n);
    }
  }

  for (const n of crispFeatureNodes) {
    children.push(n);
  }
  for (const h of course.hazards) {
    children.push(h);
  }
  return {
    id: `${course.id}-root`,
    kind: 'union',
    children,
  };
}

/**
 * Tetrahedral 4-tap finite-difference gradient normal for an arbitrary SDF function.
 */
function tetrahedralNormalFromFn(
  evalDist: (pt: Vec3) => number,
  p: Vec3,
  eps = NORMAL_EPS,
): Vec3 {
  // Tetrahedron vertices: k0=(1,-1,-1), k1=(-1,-1,1), k2=(-1,1,-1), k3=(1,1,1)
  const d0 = evalDist([p[0] + eps, p[1] - eps, p[2] - eps]);
  const d1 = evalDist([p[0] - eps, p[1] - eps, p[2] + eps]);
  const d2 = evalDist([p[0] - eps, p[1] + eps, p[2] - eps]);
  const d3 = evalDist([p[0] + eps, p[1] + eps, p[2] + eps]);

  const nx = d0 - d1 - d2 + d3;
  const ny = -d0 - d1 + d2 + d3;
  const nz = -d0 + d1 - d2 + d3;
  return vec3Normalize([nx, ny, nz]);
}

/**
 * Create the canonical CPU World Evaluator (`CpuWorldEvaluator`) for a `CourseSpec`.
 */
export function createCpuWorldEvaluator(course: CourseSpec): CpuWorldEvaluator {
  const rootTree = buildCourseSceneTree(course);
  const flatPrimitives: SdfPrimitiveNode[] = [...course.nodes, ...course.hazards];
  let fieldMutations: readonly FieldMutation[] = [];
  let portals: readonly PortalPair[] = course.portals ? [...course.portals] : [];

  function sample(p: Vec3, time: number): SdfSample {
    let s = evaluateSdfTree(rootTree, p, time);
    if (fieldMutations.length > 0) {
      s = applyFieldMutationsToSample(s, p, fieldMutations, time);
    }
    if (portals.length > 0) {
      const carved = applyPortalThroatCarveToDistance(s.distance, p, portals);
      if (carved !== s.distance) {
        s = {
          ...s,
          distance: carved,
        };
      }
    }
    return s;
  }

  function distance(p: Vec3, time: number): number {
    return sample(p, time).distance;
  }

  /**
   * Seam-biased normal estimation:
   * Evaluates the tetrahedral gradient on the composite world SDF, and when two
   * unioned primitives are within `SEAM_BIAS_EPS` of the closest surface distance,
   * biases toward the child with stronger upward support (`ny >= 0.68`) so the marble
   * rolls smoothly across modular track joints without snagging.
   */
  function normal(p: Vec3, time: number): Vec3 {
    const baseNormal = tetrahedralNormalFromFn((pt) => distance(pt, time), p, NORMAL_EPS);
    if (flatPrimitives.length <= 1) {
      return baseNormal;
    }

    let minDist = Infinity;
    const closePrimitives: SdfPrimitiveNode[] = [];
    for (let i = 0; i < flatPrimitives.length; i++) {
      const prim = flatPrimitives[i];
      const d = evaluatePrimitiveNode(prim, p, time).distance;
      if (d < minDist) {
        minDist = d;
      }
      if (d < 0.8) {
        closePrimitives.push(prim);
      }
    }

    if (closePrimitives.length <= 1) {
      return baseNormal;
    }

    let bestSupportNormal: Vec3 | null = null;
    let bestSupportY = baseNormal[1];

    for (let i = 0; i < closePrimitives.length; i++) {
      const prim = closePrimitives[i];
      const d = evaluatePrimitiveNode(prim, p, time).distance;
      if (Math.abs(d - minDist) <= SEAM_BIAS_EPS) {
        const childNormal = tetrahedralNormalFromFn(
          (pt) => evaluatePrimitiveNode(prim, pt, time).distance,
          p,
          NORMAL_EPS,
        );
        if (childNormal[1] >= SEAM_SUPPORT_MIN_Y && childNormal[1] > bestSupportY + 0.02) {
          bestSupportY = childNormal[1];
          bestSupportNormal = childNormal;
        }
      }
    }

    if (bestSupportNormal) {
      return vec3Normalize(vec3Lerp(baseNormal, bestSupportNormal, 0.78));
    }

    return baseNormal;
  }

  function queryContact(center: Vec3, radius: number, time: number): SdfContactQuery {
    const centerSample = sample(center, time);
    const n = normal(center, time);
    const contactPoint: Vec3 = [
      center[0] - n[0] * Math.min(radius, Math.max(0, centerSample.distance)),
      center[1] - n[1] * Math.min(radius, Math.max(0, centerSample.distance)),
      center[2] - n[2] * Math.min(radius, Math.max(0, centerSample.distance)),
    ];
    const contactSample = sample(contactPoint, time);
    const surfaceVelocity = vec3Add(
      contactSample.kinematicVelocity,
      contactSample.conveyorVelocity,
    );

    return {
      distance: centerSample.distance,
      normal: n,
      material: contactSample.material,
      materialId: contactSample.materialId,
      contactPoint,
      surfaceVelocity,
    };
  }

  function sphereCast(
    origin: Vec3,
    radius: number,
    displacement: Vec3,
    time: number,
    maxSteps = 12,
  ): SphereCastHit {
    const totalDist = vec3Length(displacement);
    if (totalDist < 1e-6) {
      return {
        hit: false,
        toi: 1.0,
        distanceTravelled: 0,
        hitPoint: origin,
        normal: [0, 1, 0],
        material: 'standard',
      };
    }

    const dir = vec3Scale(displacement, 1 / totalDist);
    const skin = 0.002;
    let marched = 0;

    for (let step = 0; step < maxSteps; step++) {
      const pos = vec3Add(origin, vec3Scale(dir, marched));
      const s = sample(pos, time);
      const margin = s.distance - radius;
      if (margin <= skin) {
        const hitNormal = normal(pos, time);
        const toi = Math.max(0, Math.min(1, marched / totalDist));
        return {
          hit: true,
          toi,
          distanceTravelled: marched,
          hitPoint: vec3Sub(pos, vec3Scale(hitNormal, radius)),
          normal: hitNormal,
          material: s.material,
        };
      }
      marched += Math.max(margin * 0.92, 0.004);
      if (marched >= totalDist) {
        break;
      }
    }

    const endPos = vec3Add(origin, displacement);
    return {
      hit: false,
      toi: 1.0,
      distanceTravelled: totalDist,
      hitPoint: endPos,
      normal: [0, 1, 0],
      material: 'standard',
    };
  }

  function isOccluded(
    cameraPos: Vec3,
    marblePos: Vec3,
    marbleRadius: number,
    time: number,
  ): boolean {
    const toMarble = vec3Sub(marblePos, cameraPos);
    const totalDist = vec3Length(toMarble);
    if (totalDist <= marbleRadius * 2.5) return false;

    const dir = vec3Scale(toMarble, 1 / totalDist);
    let t = 1.2;
    const maxT = totalDist - marbleRadius * 1.65;

    for (let i = 0; i < 36 && t < maxT; i++) {
      const p = vec3Add(cameraPos, vec3Scale(dir, t));
      const d = distance(p, time);
      if (d < 0.14) {
        return true;
      }
      t += Math.max(d * 0.85, 0.12);
    }
    return false;
  }

  function setFieldMutations(mutations: readonly FieldMutation[]) {
    fieldMutations = mutations;
  }

  function getFieldMutations(): readonly FieldMutation[] {
    return fieldMutations;
  }

  function setPortals(nextPortals: readonly PortalPair[]) {
    portals = nextPortals;
  }

  function getPortals(): readonly PortalPair[] {
    return portals;
  }

  return {
    sample,
    distance,
    normal,
    queryContact,
    sphereCast,
    isOccluded,
    setFieldMutations,
    getFieldMutations,
    setPortals,
    getPortals,
  };
}
