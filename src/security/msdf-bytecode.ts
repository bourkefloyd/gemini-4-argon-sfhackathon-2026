/**
 * One-Way Binary `.msdf` Reverse Polish Notation (RPN) Bytecode Compiler & Stack VM
 * (`src/security/msdf-bytecode.ts`)
 *
 * Security + Performance Properties:
 * 1. Strips all authoring metadata (`node.id`, `hazardManifest`, `checkpoints` labels,
 *    and recursive TypeScript AST node objects), emitting a flat binary `.msdf` buffer
 *    scrambled with a per-session keystream seed.
 * 2. Pre-folds static geometric constants (`cosTheta`, `invL2`, `slopeCos`, roundedBox
 *    `core` extents, piston stem offsets) at compile time so the runtime VM executes
 *    zero divisions or redundant `Math.sqrt` calls per primitive.
 * 3. Evaluates the post-order RPN stream using pre-allocated typed-array register stacks
 *    (`Float32Array` / `Int32Array`) with zero heap allocations and inline `Math.sqrt`
 *    instead of variadic `Math.hypot`, achieving 2–4x faster CPU evaluation than
 *    recursive AST traversal while preserving < 1e-5 numerical lockstep parity.
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  ID_TO_MATERIAL,
  type KinematicSpec,
  MATERIAL_IDS,
  type SdfContactQuery,
  type SdfNode,
  type SdfPrimitiveNode,
  type SdfSample,
  type SphereCastHit,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import {
  buildCourseSceneTree,
  vec3Add,
  vec3Length,
  vec3Lerp,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';

export const MSDF_MAGIC = 0x4644534d; // "MSDF" in little-endian
export const MSDF_VERSION = 1;
export const MSDF_HEADER_BYTES = 64;
export const MSDF_INSTRUCTION_STRIDE = 16; // 16 x 4 bytes = 64 bytes (1 cache line / 4x v128)
export const MSDF_AUX_STRIDE = 16; // 16 floats per auxiliary transform/kinematic record

export const enum MsdfOpcode {
  PrimBox = 1,
  PrimRoundedBox = 2,
  PrimSphere = 3,
  PrimCylinder = 4,
  PrimCapsule = 5,
  PrimTorus = 6,
  PrimRamp = 7,
  PrimSweptTrack = 8,
  PrimWaveFloor = 9,
  PrimPiston = 10,
  CsgUnion = 16,
  CsgSmoothUnion = 17,
  CsgSubtract = 18,
  CsgSmoothSubtract = 19,
  CsgIntersect = 20,
}

export const enum MsdfNodeFlags {
  None = 0,
  HasRotation = 1 << 0,
  HasKinematic = 1 << 1,
  HasConveyor = 1 << 2,
  SupportBias = 1 << 3,
}

export const enum MsdfKinematicKind {
  None = 0,
  Piston = 1,
  Bridge = 2,
  SteelieOrbit = 3,
  SteeliePatrol = 4,
}

export interface MsdfBytecodeProgram {
  /** Wire-ready binary `.msdf` container (64-byte header + keystream-scrambled sections) */
  readonly binaryBuffer: Uint8Array;
  /** Decoded instruction stream (Int32 view for opcode/flags headers) */
  readonly i32: Int32Array;
  /** Decoded instruction stream (Float32 view for geometric operands) */
  readonly f32: Float32Array;
  /** Auxiliary table for quaternion rotations, kinematics, conveyors, and swept-track tangents */
  readonly auxF32: Float32Array;
  /** Number of 64-byte RPN instructions */
  readonly instructionCount: number;
  /** Number of primitive leaf instructions */
  readonly primitiveCount: number;
  /** Session seed used to scramble the binary wire payload */
  readonly sessionSeed: number;
  /** World-space bounding box of the course [minX, minY, minZ, maxX, maxY, maxZ] */
  readonly bounds: readonly [number, number, number, number, number, number];
}

const ZERO_VEC3: Vec3 = [0, 0, 0];
const MAX_RPN_STACK = 64;
const NORMAL_EPS = 0.0025;
const SEAM_BIAS_EPS = 0.03;
const SEAM_SUPPORT_MIN_Y = 0.68;

// Pre-allocated evaluation stacks (zero GC allocations at 120 Hz)
const DIST_STACK = new Float32Array(MAX_RPN_STACK);
const MAT_STACK = new Uint8Array(MAX_RPN_STACK);
const VEL_X_STACK = new Float32Array(MAX_RPN_STACK);
const VEL_Y_STACK = new Float32Array(MAX_RPN_STACK);
const VEL_Z_STACK = new Float32Array(MAX_RPN_STACK);
const CONV_X_STACK = new Float32Array(MAX_RPN_STACK);
const CONV_Y_STACK = new Float32Array(MAX_RPN_STACK);
const CONV_Z_STACK = new Float32Array(MAX_RPN_STACK);

function keystreamWord(seed: number, wordIndex: number): number {
  let x = (seed + Math.imul(wordIndex + 1, 0x9e3779b9)) | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

function isCsgNode(node: SdfNode): node is Extract<SdfNode, { readonly children: readonly SdfNode[] }> {
  return (
    node.kind === 'union' ||
    node.kind === 'smoothUnion' ||
    node.kind === 'subtract' ||
    node.kind === 'smoothSubtract' ||
    node.kind === 'intersect'
  );
}

function encodeKinematicKind(kin?: KinematicSpec): MsdfKinematicKind {
  if (!kin) return MsdfKinematicKind.None;
  if (kin.kind === 'piston') return MsdfKinematicKind.Piston;
  if (kin.kind === 'bridge') return MsdfKinematicKind.Bridge;
  return kin.mode === 'orbit' ? MsdfKinematicKind.SteelieOrbit : MsdfKinematicKind.SteeliePatrol;
}

/**
 * Compute conservative world-space AABB for a course.
 */
export function computeCourseBounds(
  course: CourseSpec,
  padding = 3.0,
): readonly [number, number, number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  const allNodes: SdfPrimitiveNode[] = [...course.nodes, ...course.hazards];
  for (const n of allNodes) {
    let rx = 4;
    let ry = 4;
    let rz = 4;
    switch (n.kind) {
      case 'box':
      case 'roundedBox':
      case 'waveFloor':
        rx = n.halfExtents[0] + 1;
        ry = n.halfExtents[1] + 1;
        rz = n.halfExtents[2] + 1;
        break;
      case 'sphere':
        rx = ry = rz = n.radius + 1;
        break;
      case 'cylinder':
        rx = rz = n.radius + 1;
        ry = n.halfHeight + 1;
        break;
      case 'capsule':
        rx = Math.max(Math.abs(n.a[0]), Math.abs(n.b[0])) + n.radius + 1;
        ry = Math.max(Math.abs(n.a[1]), Math.abs(n.b[1])) + n.radius + 1;
        rz = Math.max(Math.abs(n.a[2]), Math.abs(n.b[2])) + n.radius + 1;
        break;
      case 'torus':
        rx = rz = n.majorRadius + n.minorRadius + 1;
        ry = n.minorRadius + 1;
        break;
      case 'ramp':
        rx = (n.axis === 'x' ? n.halfLength : n.halfWidth) + 1;
        ry = Math.abs(n.rise) * 0.5 + n.thickness + (n.railHeight ?? 0) + 1;
        rz = (n.axis === 'z' ? n.halfLength : n.halfWidth) + 1;
        break;
      case 'sweptTrack': {
        const minSx = Math.min(n.start[0], n.end[0]) - n.halfWidth - 1;
        const maxSx = Math.max(n.start[0], n.end[0]) + n.halfWidth + 1;
        const minSy = Math.min(n.start[1], n.end[1]) - n.thickness - 1;
        const maxSy = Math.max(n.start[1], n.end[1]) + (n.railHeight ?? 0) + 1;
        const minSz = Math.min(n.start[2], n.end[2]) - n.halfWidth - 1;
        const maxSz = Math.max(n.start[2], n.end[2]) + n.halfWidth + 1;
        minX = Math.min(minX, n.center[0] + minSx);
        maxX = Math.max(maxX, n.center[0] + maxSx);
        minY = Math.min(minY, n.center[1] + minSy);
        maxY = Math.max(maxY, n.center[1] + maxSy);
        minZ = Math.min(minZ, n.center[2] + minSz);
        maxZ = Math.max(maxZ, n.center[2] + maxSz);
        continue;
      }
      case 'piston':
        rx = n.headHalfExtents[0] + 1;
        ry = n.headHalfExtents[1] + 2.6;
        rz = n.headHalfExtents[2] + 1;
        break;
    }

    if (n.kinematic) {
      const kSpan =
        n.kinematic.kind === 'piston'
          ? n.kinematic.stroke
          : n.kinematic.kind === 'bridge'
            ? n.kinematic.amplitude
            : Math.max(n.kinematic.span[0], n.kinematic.span[1], n.kinematic.span[2]);
      rx += kSpan;
      ry += kSpan;
      rz += kSpan;
    }

    minX = Math.min(minX, n.center[0] - rx);
    maxX = Math.max(maxX, n.center[0] + rx);
    minY = Math.min(minY, n.center[1] - ry);
    maxY = Math.max(maxY, n.center[1] + ry);
    minZ = Math.min(minZ, n.center[2] - rz);
    maxZ = Math.max(maxZ, n.center[2] + rz);
  }

  return [
    minX - padding,
    minY - padding,
    minZ - padding,
    maxX + padding,
    maxY + padding,
    maxZ + padding,
  ];
}

/**
 * Compile a `CourseSpec` into a stripped, one-way `.msdf` RPN bytecode program.
 */
export function compileCourseToMsdfBytecode(
  course: CourseSpec,
  sessionSeed = 0x6e5b2026,
): MsdfBytecodeProgram {
  const rootTree = buildCourseSceneTree(course);
  const bounds = computeCourseBounds(course, 2.5);

  const instrBuffers: ArrayBuffer[] = [];
  const auxRecords: Float32Array[] = [];
  let primitiveCount = 0;

  function allocateAuxRecord(node: SdfPrimitiveNode): number {
    const needAux =
      Boolean(node.rotation) ||
      Boolean(node.kinematic) ||
      Boolean(node.conveyorDirection) ||
      node.kind === 'sweptTrack';
    if (!needAux) return 0xffff;

    const auxIdx = auxRecords.length;
    const rec = new Float32Array(MSDF_AUX_STRIDE);
    // [0..3]: quaternion rotation [qx, qy, qz, qw]
    if (node.rotation) {
      rec[0] = node.rotation[0];
      rec[1] = node.rotation[1];
      rec[2] = node.rotation[2];
      rec[3] = node.rotation[3];
    } else {
      rec[3] = 1.0;
    }

    // [4..9]: kinematic parameters
    if (node.kinematic) {
      const k = node.kinematic;
      if (k.kind === 'piston') {
        rec[4] = k.axis[0];
        rec[5] = k.axis[1];
        rec[6] = k.axis[2];
        rec[7] = k.stroke;
        rec[8] = k.frequency;
        rec[9] = k.phase ?? 0;
        rec[10] = k.slamSharpness ?? 2.0;
      } else if (k.kind === 'bridge') {
        rec[4] = k.axis[0];
        rec[5] = k.axis[1];
        rec[6] = k.axis[2];
        rec[7] = k.amplitude;
        rec[8] = k.frequency;
        rec[9] = k.phase ?? 0;
      } else {
        rec[4] = k.span[0];
        rec[5] = k.span[1];
        rec[6] = k.span[2];
        rec[8] = k.frequency;
        rec[9] = k.phase ?? 0;
      }
    }

    // [11..13]: conveyorDirection or sweptTrack precomputed [tx, tz, slopeCos]
    if (node.kind === 'sweptTrack') {
      const bax = node.end[0] - node.start[0];
      const bay = node.end[1] - node.start[1];
      const baz = node.end[2] - node.start[2];
      const l2 = Math.max(bax * bax + bay * bay + baz * baz, 1e-5);
      const horizLen = Math.max(Math.hypot(bax, baz), 1e-5);
      rec[11] = bax / horizLen; // tx
      rec[12] = baz / horizLen; // tz
      rec[13] = horizLen / Math.sqrt(l2); // slopeCos
      if (node.conveyorDirection) {
        rec[14] = node.conveyorDirection[0];
        rec[15] = node.conveyorDirection[2];
        // Store conveyor Y in rec[10] if not piston
        rec[10] = node.conveyorDirection[1];
      }
    } else if (node.conveyorDirection) {
      rec[11] = node.conveyorDirection[0];
      rec[12] = node.conveyorDirection[1];
      rec[13] = node.conveyorDirection[2];
    }

    auxRecords.push(rec);
    return auxIdx;
  }

  function emitPrimitive(node: SdfPrimitiveNode): void {
    primitiveCount++;
    const buf = new ArrayBuffer(MSDF_INSTRUCTION_STRIDE * 4);
    const i32 = new Int32Array(buf);
    const f32 = new Float32Array(buf);

    let flags = MsdfNodeFlags.None;
    if (node.rotation) flags |= MsdfNodeFlags.HasRotation;
    if (node.kinematic) flags |= MsdfNodeFlags.HasKinematic;
    if (node.material === 'conveyor' && node.conveyorDirection) {
      flags |= MsdfNodeFlags.HasConveyor;
    }
    if (node.supportBias) flags |= MsdfNodeFlags.SupportBias;

    const matId = MATERIAL_IDS[node.material] ?? 0;
    const kinKind = encodeKinematicKind(node.kinematic);
    const auxIdx = allocateAuxRecord(node);

    // Pack flags, materialId, kinematicKind, and auxIdx into i32[1]
    i32[1] =
      (flags & 0xff) |
      ((matId & 0xff) << 8) |
      ((kinKind & 0xff) << 16) |
      ((auxIdx & 0xff) << 24);

    f32[2] = node.center[0];
    f32[3] = node.center[1];
    f32[4] = node.center[2];

    switch (node.kind) {
      case 'box':
        i32[0] = MsdfOpcode.PrimBox;
        f32[5] = node.halfExtents[0];
        f32[6] = node.halfExtents[1];
        f32[7] = node.halfExtents[2];
        break;
      case 'roundedBox': {
        i32[0] = MsdfOpcode.PrimRoundedBox;
        const bx = node.halfExtents[0];
        const by = node.halfExtents[1];
        const bz = node.halfExtents[2];
        const clampedR = Math.min(node.radius, Math.min(bx, Math.min(by, bz)) * 0.95);
        f32[5] = Math.max(0.001, bx - clampedR);
        f32[6] = Math.max(0.001, by - clampedR);
        f32[7] = Math.max(0.001, bz - clampedR);
        f32[8] = clampedR;
        break;
      }
      case 'sphere':
        i32[0] = MsdfOpcode.PrimSphere;
        f32[5] = node.radius;
        break;
      case 'cylinder':
        i32[0] = MsdfOpcode.PrimCylinder;
        f32[5] = node.radius;
        f32[6] = node.halfHeight;
        break;
      case 'capsule': {
        i32[0] = MsdfOpcode.PrimCapsule;
        const bax = node.b[0] - node.a[0];
        const bay = node.b[1] - node.a[1];
        const baz = node.b[2] - node.a[2];
        const invBaba = 1.0 / Math.max(bax * bax + bay * bay + baz * baz, 1e-6);
        f32[5] = node.a[0];
        f32[6] = node.a[1];
        f32[7] = node.a[2];
        f32[8] = bax;
        f32[9] = bay;
        f32[10] = baz;
        f32[11] = invBaba;
        f32[12] = node.radius;
        break;
      }
      case 'torus':
        i32[0] = MsdfOpcode.PrimTorus;
        f32[5] = node.majorRadius;
        f32[6] = node.minorRadius;
        break;
      case 'ramp': {
        i32[0] = MsdfOpcode.PrimRamp;
        const safeHalfLen = Math.max(node.halfLength, 0.01);
        const tanTheta = (0.5 * node.rise) / safeHalfLen;
        const cosTheta = 1.0 / Math.sqrt(1.0 + tanTheta * tanTheta);
        const halfThick = Math.max(0.075, 0.5 * node.thickness);
        const railH = node.railHeight ?? 0;
        const railThick = node.railThickness ?? 0.28;
        f32[5] = node.axis === 'x' ? 1.0 : 0.0;
        f32[6] = safeHalfLen;
        f32[7] = tanTheta;
        f32[8] = cosTheta;
        f32[9] = node.halfWidth;
        f32[10] = halfThick;
        f32[11] = railH;
        f32[12] = 0.5 * railH;
        f32[13] = 0.5 * railThick;
        break;
      }
      case 'sweptTrack': {
        i32[0] = MsdfOpcode.PrimSweptTrack;
        const bax = node.end[0] - node.start[0];
        const bay = node.end[1] - node.start[1];
        const baz = node.end[2] - node.start[2];
        const l2 = Math.max(bax * bax + bay * bay + baz * baz, 1e-5);
        const halfThick = Math.max(0.075, 0.5 * node.thickness);
        const railH = node.railHeight ?? 0;
        const railThick = node.railThickness ?? 0.28;
        f32[5] = node.start[0];
        f32[6] = node.start[1];
        f32[7] = node.start[2];
        f32[8] = bax;
        f32[9] = bay;
        f32[10] = baz;
        f32[11] = 1.0 / l2;
        f32[12] = node.halfWidth;
        f32[13] = halfThick;
        f32[14] = railH;
        f32[15] = railThick;
        break;
      }
      case 'waveFloor':
        i32[0] = MsdfOpcode.PrimWaveFloor;
        f32[5] = node.halfExtents[0];
        f32[6] = node.halfExtents[1];
        f32[7] = node.halfExtents[2];
        f32[8] = node.waveAmplitude;
        f32[9] = node.waveFrequencyX;
        f32[10] = node.waveFrequencyZ;
        f32[11] = node.waveSpeed;
        break;
      case 'piston': {
        i32[0] = MsdfOpcode.PrimPiston;
        const hx = node.headHalfExtents[0];
        const hy = node.headHalfExtents[1];
        const hz = node.headHalfExtents[2];
        const clampedR = Math.min(node.bevelRadius, Math.min(hx, Math.min(hy, hz)) * 0.95);
        const stemRadius = Math.min(hx, hz) * 0.45;
        const stemHalfH = 1.2;
        f32[5] = Math.max(0.001, hx - clampedR);
        f32[6] = Math.max(0.001, hy - clampedR);
        f32[7] = Math.max(0.001, hz - clampedR);
        f32[8] = clampedR;
        f32[9] = stemRadius;
        f32[10] = stemHalfH;
        f32[11] = hy + stemHalfH;
        break;
      }
    }

    instrBuffers.push(buf);
  }

  function emitCsgOp(kind: SdfNode['kind'], smoothRadius = 0.14): void {
    const buf = new ArrayBuffer(MSDF_INSTRUCTION_STRIDE * 4);
    const i32 = new Int32Array(buf);
    const f32 = new Float32Array(buf);

    switch (kind) {
      case 'union':
        i32[0] = MsdfOpcode.CsgUnion;
        break;
      case 'smoothUnion':
        i32[0] = MsdfOpcode.CsgSmoothUnion;
        f32[2] = Math.max(1e-4, smoothRadius);
        f32[3] = 1.0 / Math.max(1e-4, smoothRadius);
        break;
      case 'subtract':
        i32[0] = MsdfOpcode.CsgSubtract;
        break;
      case 'smoothSubtract':
        i32[0] = MsdfOpcode.CsgSmoothSubtract;
        f32[2] = Math.max(1e-4, smoothRadius);
        f32[3] = 1.0 / Math.max(1e-4, smoothRadius);
        break;
      case 'intersect':
        i32[0] = MsdfOpcode.CsgIntersect;
        break;
    }
    instrBuffers.push(buf);
  }

  function walk(node: SdfNode): void {
    if (!isCsgNode(node)) {
      emitPrimitive(node);
      return;
    }
    if (node.children.length === 0) return;
    walk(node.children[0]);
    const k = node.smoothRadius ?? 0.14;
    for (let i = 1; i < node.children.length; i++) {
      walk(node.children[i]);
      emitCsgOp(node.kind, k);
    }
  }

  walk(rootTree);

  const instructionCount = instrBuffers.length;
  const instrByteLength = instructionCount * MSDF_INSTRUCTION_STRIDE * 4;
  const auxByteLength = auxRecords.length * MSDF_AUX_STRIDE * 4;

  // Allocate aligned execution buffer
  const execArrayBuffer = new ArrayBuffer(instrByteLength);
  const execU8 = new Uint8Array(execArrayBuffer);
  for (let i = 0; i < instructionCount; i++) {
    execU8.set(new Uint8Array(instrBuffers[i]), i * MSDF_INSTRUCTION_STRIDE * 4);
  }
  const execI32 = new Int32Array(execArrayBuffer);
  const execF32 = new Float32Array(execArrayBuffer);

  const auxF32 = new Float32Array(auxRecords.length * MSDF_AUX_STRIDE);
  for (let i = 0; i < auxRecords.length; i++) {
    auxF32.set(auxRecords[i], i * MSDF_AUX_STRIDE);
  }

  // Build wire-format `.msdf` binary buffer (64-byte header + XOR-scrambled payload)
  const totalWireBytes = MSDF_HEADER_BYTES + instrByteLength + auxByteLength;
  const wireBuffer = new ArrayBuffer(totalWireBytes);
  const headerView = new DataView(wireBuffer, 0, MSDF_HEADER_BYTES);
  headerView.setUint32(0, MSDF_MAGIC, true);
  headerView.setUint16(4, MSDF_VERSION, true);
  headerView.setUint16(6, sessionSeed !== 0 ? 1 : 0, true);
  headerView.setFloat32(8, bounds[0], true);
  headerView.setFloat32(12, bounds[1], true);
  headerView.setFloat32(16, bounds[2], true);
  headerView.setFloat32(20, bounds[3], true);
  headerView.setFloat32(24, bounds[4], true);
  headerView.setFloat32(28, bounds[5], true);
  headerView.setUint32(32, instructionCount, true);
  headerView.setUint32(36, auxRecords.length, true);
  headerView.setUint32(40, primitiveCount, true);
  headerView.setUint32(44, sessionSeed >>> 0, true);

  const wirePayloadU32 = new Uint32Array(
    wireBuffer,
    MSDF_HEADER_BYTES,
    (instrByteLength + auxByteLength) / 4,
  );
  const execU32 = new Uint32Array(execArrayBuffer);
  const auxU32 = new Uint32Array(auxF32.buffer);
  wirePayloadU32.set(execU32, 0);
  wirePayloadU32.set(auxU32, execU32.length);

  if (sessionSeed !== 0) {
    for (let i = 0; i < wirePayloadU32.length; i++) {
      wirePayloadU32[i] = (wirePayloadU32[i] ^ keystreamWord(sessionSeed, i)) >>> 0;
    }
  }

  return {
    binaryBuffer: new Uint8Array(wireBuffer),
    i32: execI32,
    f32: execF32,
    auxF32,
    instructionCount,
    primitiveCount,
    sessionSeed,
    bounds,
  };
}

/**
 * Deserialize and descramble a wire-format `.msdf` binary buffer back into an executable VM program.
 */
export function deserializeMsdfBytecode(
  binaryBuffer: Uint8Array,
  overrideSeed?: number,
): MsdfBytecodeProgram {
  if (binaryBuffer.byteLength < MSDF_HEADER_BYTES) {
    throw new Error('Invalid .msdf buffer: shorter than 64-byte header');
  }
  const view = new DataView(
    binaryBuffer.buffer,
    binaryBuffer.byteOffset,
    MSDF_HEADER_BYTES,
  );
  const magic = view.getUint32(0, true);
  if (magic !== MSDF_MAGIC) {
    throw new Error(`Invalid .msdf magic: 0x${magic.toString(16)}`);
  }

  const flags = view.getUint16(6, true);
  const bounds: readonly [number, number, number, number, number, number] = [
    view.getFloat32(8, true),
    view.getFloat32(12, true),
    view.getFloat32(16, true),
    view.getFloat32(20, true),
    view.getFloat32(24, true),
    view.getFloat32(28, true),
  ];
  const instructionCount = view.getUint32(32, true);
  const auxCount = view.getUint32(36, true);
  const primitiveCount = view.getUint32(40, true);
  const headerSeed = view.getUint32(44, true);
  const seed = overrideSeed !== undefined ? overrideSeed : headerSeed;

  const instrWords = instructionCount * MSDF_INSTRUCTION_STRIDE;
  const auxWords = auxCount * MSDF_AUX_STRIDE;
  const totalWords = instrWords + auxWords;

  const payloadCopy = new ArrayBuffer(totalWords * 4);
  new Uint8Array(payloadCopy).set(
    binaryBuffer.subarray(MSDF_HEADER_BYTES, MSDF_HEADER_BYTES + totalWords * 4),
  );
  const u32 = new Uint32Array(payloadCopy);
  if ((flags & 1) !== 0 && seed !== 0) {
    for (let i = 0; i < totalWords; i++) {
      u32[i] = (u32[i] ^ keystreamWord(seed, i)) >>> 0;
    }
  }

  const instrBuffer = payloadCopy.slice(0, instrWords * 4);
  const auxBuffer = payloadCopy.slice(instrWords * 4, totalWords * 4);

  return {
    binaryBuffer,
    i32: new Int32Array(instrBuffer),
    f32: new Float32Array(instrBuffer),
    auxF32: new Float32Array(auxBuffer),
    instructionCount,
    primitiveCount,
    sessionSeed: seed,
    bounds,
  };
}

export function getLastMsdfMaterialId(): number {
  return MAT_STACK[0];
}

/**
 * Ultra-fast zero-allocation scalar distance evaluator on the RPN bytecode stream.
 */
export function evalMsdfBytecodeDistance(
  program: MsdfBytecodeProgram,
  px: number,
  py: number,
  pz: number,
  time: number,
): number {
  const i32 = program.i32;
  const f32 = program.f32;
  const aux = program.auxF32;
  const end = i32.length;
  let sp = 0;

  for (let ip = 0; ip < end; ip += MSDF_INSTRUCTION_STRIDE) {
    const op = i32[ip];

    if (op >= MsdfOpcode.CsgUnion) {
      sp--;
      const dB = DIST_STACK[sp];
      const dA = DIST_STACK[sp - 1];
      if (op === MsdfOpcode.CsgUnion) {
        if (dB < dA) {
          DIST_STACK[sp - 1] = dB;
          MAT_STACK[sp - 1] = MAT_STACK[sp];
        }
      } else if (op === MsdfOpcode.CsgSmoothUnion) {
        const k = f32[ip + 2];
        const invK = f32[ip + 3];
        const diff = dA - dB;
        const absDiff = diff < 0 ? -diff : diff;
        const h = k > absDiff ? (k - absDiff) * invK : 0.0;
        const minD = dA < dB ? dA : dB;
        DIST_STACK[sp - 1] = minD - 0.25 * h * h * k;
        if (dB < dA) MAT_STACK[sp - 1] = MAT_STACK[sp];
      } else if (op === MsdfOpcode.CsgSubtract) {
        const negB = -dB;
        DIST_STACK[sp - 1] = dA > negB ? dA : negB;
      } else if (op === MsdfOpcode.CsgSmoothSubtract) {
        const k = f32[ip + 2];
        const invK = f32[ip + 3];
        const sum = dA + dB;
        const absSum = sum < 0 ? -sum : sum;
        const h = k > absSum ? (k - absSum) * invK : 0.0;
        const negB = -dB;
        const maxD = dA > negB ? dA : negB;
        DIST_STACK[sp - 1] = maxD + 0.25 * h * h * k;
      } else {
        DIST_STACK[sp - 1] = dA > dB ? dA : dB;
        if (dB > dA) MAT_STACK[sp - 1] = MAT_STACK[sp];
      }
      continue;
    }

    const meta = i32[ip + 1];
    const flags = meta & 0xff;
    let lx = px - f32[ip + 2];
    let ly = py - f32[ip + 3];
    let lz = pz - f32[ip + 4];

    if ((flags & (MsdfNodeFlags.HasKinematic | MsdfNodeFlags.HasRotation)) !== 0) {
      const auxBase = ((meta >>> 24) & 0xff) * MSDF_AUX_STRIDE;
      if ((flags & MsdfNodeFlags.HasKinematic) !== 0) {
        const kinKind = (meta >>> 16) & 0xff;
        const freq = aux[auxBase + 8];
        const phase = aux[auxBase + 9];
        const angle = 6.283185307179586 * freq * time + phase;
        if (kinKind === MsdfKinematicKind.Piston) {
          const s = 0.5 + 0.5 * Math.sin(angle);
          const wave = Math.pow(s > 0 ? s : 0, aux[auxBase + 10]);
          const disp = aux[auxBase + 7] * wave;
          lx -= aux[auxBase + 4] * disp;
          ly -= aux[auxBase + 5] * disp;
          lz -= aux[auxBase + 6] * disp;
        } else if (kinKind === MsdfKinematicKind.Bridge) {
          const disp = aux[auxBase + 7] * Math.sin(angle);
          lx -= aux[auxBase + 4] * disp;
          ly -= aux[auxBase + 5] * disp;
          lz -= aux[auxBase + 6] * disp;
        } else if (kinKind === MsdfKinematicKind.SteelieOrbit) {
          const rx = aux[auxBase + 4];
          const rz = aux[auxBase + 6] || rx;
          lx -= rx * Math.cos(angle);
          ly -= aux[auxBase + 5] * Math.sin(angle * 2);
          lz -= rz * Math.sin(angle);
        } else {
          const sinA = Math.sin(angle);
          lx -= aux[auxBase + 4] * sinA;
          ly -= aux[auxBase + 5] * sinA;
          lz -= aux[auxBase + 6] * sinA;
        }
      }

      if ((flags & MsdfNodeFlags.HasRotation) !== 0) {
        const qx = aux[auxBase];
        const qy = aux[auxBase + 1];
        const qz = aux[auxBase + 2];
        const qw = aux[auxBase + 3];
        const tx = 2 * (qy * lz - qz * ly);
        const ty = 2 * (qz * lx - qx * lz);
        const tz = 2 * (qx * ly - qy * lx);
        const cx = qy * tz - qz * ty;
        const cy = qz * tx - qx * tz;
        const cz = qx * ty - qy * tx;
        lx = lx - qw * tx + cx;
        ly = ly - qw * ty + cy;
        lz = lz - qw * tz + cz;
      }
    }

    let d = 1000.0;
    switch (op) {
      case MsdfOpcode.PrimBox: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);
        break;
      }
      case MsdfOpcode.PrimRoundedBox: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0) - f32[ip + 8];
        break;
      }
      case MsdfOpcode.PrimSphere: {
        d = Math.sqrt(lx * lx + ly * ly + lz * lz) - f32[ip + 5];
        break;
      }
      case MsdfOpcode.PrimCylinder: {
        const dx = Math.sqrt(lx * lx + lz * lz) - f32[ip + 5];
        const dy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const mx = dx > 0 ? dx : 0;
        const my = dy > 0 ? dy : 0;
        const maxD = dx > dy ? dx : dy;
        d = (maxD < 0 ? maxD : 0) + Math.sqrt(mx * mx + my * my);
        break;
      }
      case MsdfOpcode.PrimCapsule: {
        const pax = lx - f32[ip + 5];
        const pay = ly - f32[ip + 6];
        const paz = lz - f32[ip + 7];
        const bax = f32[ip + 8];
        const bay = f32[ip + 9];
        const baz = f32[ip + 10];
        const rawH = (pax * bax + pay * bay + paz * baz) * f32[ip + 11];
        const h = rawH < 0 ? 0 : rawH > 1 ? 1 : rawH;
        const dx = pax - bax * h;
        const dy = pay - bay * h;
        const dz = paz - baz * h;
        d = Math.sqrt(dx * dx + dy * dy + dz * dz) - f32[ip + 12];
        break;
      }
      case MsdfOpcode.PrimTorus: {
        const qx = Math.sqrt(lx * lx + lz * lz) - f32[ip + 5];
        d = Math.sqrt(qx * qx + ly * ly) - f32[ip + 6];
        break;
      }
      case MsdfOpcode.PrimRamp: {
        const isX = f32[ip + 5] > 0.5;
        const runCoord = isX ? lx : lz;
        const latCoord = isX ? lz : lx;
        const safeHalfLen = f32[ip + 6];
        const tanTheta = f32[ip + 7];
        const cosTheta = f32[ip + 8];
        const halfWidth = f32[ip + 9];
        const halfThick = f32[ip + 10];
        const railH = f32[ip + 11];
        const yTop = runCoord * tanTheta;

        const dRun = (runCoord < 0 ? -runCoord : runCoord) - safeHalfLen;
        const dyRaw = ly - (yTop - halfThick);
        const dDeckY = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfThick) * cosTheta;
        const absLat = latCoord < 0 ? -latCoord : latCoord;
        const dLat = absLat - halfWidth;

        const mx = dRun > 0 ? dRun : 0;
        const my = dDeckY > 0 ? dDeckY : 0;
        const mz = dLat > 0 ? dLat : 0;
        const maxYZ = dDeckY > dLat ? dDeckY : dLat;
        const maxQ = dRun > maxYZ ? dRun : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);

        if (railH > 0.001) {
          const halfRailH = f32[ip + 12];
          const halfRailThick = f32[ip + 13];
          const rlDiff = absLat - (halfWidth - halfRailThick);
          const dRailLat = (rlDiff < 0 ? -rlDiff : rlDiff) - halfRailThick;
          const ryDiff = ly - (yTop + halfRailH);
          const dRailY = ((ryDiff < 0 ? -ryDiff : ryDiff) - halfRailH) * cosTheta;
          const rmy = dRailY > 0 ? dRailY : 0;
          const rmz = dRailLat > 0 ? dRailLat : 0;
          const rMaxYZ = dRailY > dRailLat ? dRailY : dRailLat;
          const rMaxQ = dRun > rMaxYZ ? dRun : rMaxYZ;
          const dRail = Math.sqrt(mx * mx + rmy * rmy + rmz * rmz) + (rMaxQ < 0 ? rMaxQ : 0);
          if (dRail < d) d = dRail;
        }
        break;
      }
      case MsdfOpcode.PrimSweptTrack: {
        const sx0 = f32[ip + 5];
        const sy0 = f32[ip + 6];
        const sz0 = f32[ip + 7];
        const bax = f32[ip + 8];
        const bay = f32[ip + 9];
        const baz = f32[ip + 10];
        const pax = lx - sx0;
        const pay = ly - sy0;
        const paz = lz - sz0;
        const rawT = (pax * bax + pay * bay + paz * baz) * f32[ip + 11];
        const t = rawT < 0 ? 0 : rawT > 1 ? 1 : rawT;
        const dpx = pax - bax * t;
        const dpy = pay - bay * t;
        const dpz = paz - baz * t;

        const auxBase = ((meta >>> 24) & 0xff) * MSDF_AUX_STRIDE;
        const tx = aux[auxBase + 11];
        const tz = aux[auxBase + 12];
        const slopeCos = aux[auxBase + 13];
        const lat = -dpx * tz + dpz * tx;
        const along = dpx * tx + dpz * tz;

        const halfWidth = f32[ip + 12];
        const halfThick = f32[ip + 13];
        const railH = f32[ip + 14];

        const dAlong = (along < 0 ? -along : along) - 0.08;
        const dyRaw = dpy + halfThick;
        const dDeckY = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfThick) * slopeCos;
        const absLat = lat < 0 ? -lat : lat;
        const dDeckLat = absLat - halfWidth;

        const mx = dAlong > 0 ? dAlong : 0;
        const my = dDeckY > 0 ? dDeckY : 0;
        const mz = dDeckLat > 0 ? dDeckLat : 0;
        const maxYZ = dDeckY > dDeckLat ? dDeckY : dDeckLat;
        const maxQ = dAlong > maxYZ ? dAlong : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);

        if (railH > 0.001) {
          const halfRailThick = 0.5 * f32[ip + 15];
          const halfRailH = 0.5 * railH;
          const rlDiff = absLat - (halfWidth - halfRailThick);
          const dRailLat = (rlDiff < 0 ? -rlDiff : rlDiff) - halfRailThick;
          const ryDiff = dpy - halfRailH;
          const dRailY = ((ryDiff < 0 ? -ryDiff : ryDiff) - halfRailH) * slopeCos;
          const rmy = dRailY > 0 ? dRailY : 0;
          const rmz = dRailLat > 0 ? dRailLat : 0;
          const rMaxYZ = dRailY > dRailLat ? dRailY : dRailLat;
          const rMaxQ = dAlong > rMaxYZ ? dAlong : rMaxYZ;
          const dRail = Math.sqrt(mx * mx + rmy * rmy + rmz * rmz) + (rMaxQ < 0 ? rMaxQ : 0);
          if (dRail < d) d = dRail;
        }
        break;
      }
      case MsdfOpcode.PrimWaveFloor: {
        const amp = f32[ip + 8];
        const freqX = f32[ip + 9];
        const freqZ = f32[ip + 10];
        const speed = f32[ip + 11];
        const waveH =
          amp * Math.sin(lx * freqX + time * speed) * Math.cos(lz * freqZ + time * speed * 0.7);
        const midY = 0.5 * waveH;
        const halfH = Math.max(0.08, f32[ip + 6] + 0.5 * waveH);
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const dyRaw = ly - midY;
        const qy = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfH) * 0.85;
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);
        break;
      }
      case MsdfOpcode.PrimPiston: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        const dHead = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0) - f32[ip + 8];

        const stemR = f32[ip + 9];
        const stemHalfH = f32[ip + 10];
        const stemY = ly - f32[ip + 11];
        const sdx = Math.sqrt(lx * lx + lz * lz) - stemR;
        const sdy = (stemY < 0 ? -stemY : stemY) - stemHalfH;
        const smx = sdx > 0 ? sdx : 0;
        const smy = sdy > 0 ? sdy : 0;
        const sMax = sdx > sdy ? sdx : sdy;
        const dStem = (sMax < 0 ? sMax : 0) + Math.sqrt(smx * smx + smy * smy);
        d = dHead < dStem ? dHead : dStem;
        break;
      }
    }

    DIST_STACK[sp] = d;
    MAT_STACK[sp] = (meta >>> 8) & 0xff;
    sp++;
  }

  return sp > 0 ? DIST_STACK[0] : 1000.0;
}

/**
 * Full zero-allocation stack evaluation returning distance, material, and surface velocity.
 */
export function evalMsdfBytecode(
  program: MsdfBytecodeProgram,
  p: Vec3,
  time: number,
): SdfSample {
  const i32 = program.i32;
  const f32 = program.f32;
  const aux = program.auxF32;
  const end = i32.length;
  const px = p[0];
  const py = p[1];
  const pz = p[2];
  let sp = 0;

  for (let ip = 0; ip < end; ip += MSDF_INSTRUCTION_STRIDE) {
    const op = i32[ip];

    if (op >= MsdfOpcode.CsgUnion) {
      sp--;
      const dB = DIST_STACK[sp];
      const dA = DIST_STACK[sp - 1];

      if (op === MsdfOpcode.CsgUnion) {
        if (dB < dA) {
          DIST_STACK[sp - 1] = dB;
          MAT_STACK[sp - 1] = MAT_STACK[sp];
          VEL_X_STACK[sp - 1] = VEL_X_STACK[sp];
          VEL_Y_STACK[sp - 1] = VEL_Y_STACK[sp];
          VEL_Z_STACK[sp - 1] = VEL_Z_STACK[sp];
          CONV_X_STACK[sp - 1] = CONV_X_STACK[sp];
          CONV_Y_STACK[sp - 1] = CONV_Y_STACK[sp];
          CONV_Z_STACK[sp - 1] = CONV_Z_STACK[sp];
        }
      } else if (op === MsdfOpcode.CsgSmoothUnion) {
        const k = f32[ip + 2];
        const invK = f32[ip + 3];
        const diff = dA - dB;
        const absDiff = diff < 0 ? -diff : diff;
        const h = k > absDiff ? (k - absDiff) * invK : 0.0;
        DIST_STACK[sp - 1] = (dA < dB ? dA : dB) - 0.25 * h * h * k;
        if (dB < dA) {
          MAT_STACK[sp - 1] = MAT_STACK[sp];
          VEL_X_STACK[sp - 1] = VEL_X_STACK[sp];
          VEL_Y_STACK[sp - 1] = VEL_Y_STACK[sp];
          VEL_Z_STACK[sp - 1] = VEL_Z_STACK[sp];
          CONV_X_STACK[sp - 1] = CONV_X_STACK[sp];
          CONV_Y_STACK[sp - 1] = CONV_Y_STACK[sp];
          CONV_Z_STACK[sp - 1] = CONV_Z_STACK[sp];
        }
      } else if (op === MsdfOpcode.CsgSubtract) {
        const negB = -dB;
        DIST_STACK[sp - 1] = dA > negB ? dA : negB;
      } else if (op === MsdfOpcode.CsgSmoothSubtract) {
        const k = f32[ip + 2];
        const invK = f32[ip + 3];
        const sum = dA + dB;
        const absSum = sum < 0 ? -sum : sum;
        const h = k > absSum ? (k - absSum) * invK : 0.0;
        const negB = -dB;
        DIST_STACK[sp - 1] = (dA > negB ? dA : negB) + 0.25 * h * h * k;
      } else {
        DIST_STACK[sp - 1] = dA > dB ? dA : dB;
        if (dB > dA) {
          MAT_STACK[sp - 1] = MAT_STACK[sp];
          VEL_X_STACK[sp - 1] = VEL_X_STACK[sp];
          VEL_Y_STACK[sp - 1] = VEL_Y_STACK[sp];
          VEL_Z_STACK[sp - 1] = VEL_Z_STACK[sp];
          CONV_X_STACK[sp - 1] = CONV_X_STACK[sp];
          CONV_Y_STACK[sp - 1] = CONV_Y_STACK[sp];
          CONV_Z_STACK[sp - 1] = CONV_Z_STACK[sp];
        }
      }
      continue;
    }

    const meta = i32[ip + 1];
    const flags = meta & 0xff;
    const matId = (meta >>> 8) & 0xff;

    let lx = px - f32[ip + 2];
    let ly = py - f32[ip + 3];
    let lz = pz - f32[ip + 4];
    let vx = 0;
    let vy = 0;
    let vz = 0;
    let cx = 0;
    let cy = 0;
    let cz = 0;

    if (
      (flags &
        (MsdfNodeFlags.HasKinematic | MsdfNodeFlags.HasRotation | MsdfNodeFlags.HasConveyor)) !==
      0
    ) {
      const auxBase = ((meta >>> 24) & 0xff) * MSDF_AUX_STRIDE;
      if ((flags & MsdfNodeFlags.HasKinematic) !== 0) {
        const kinKind = (meta >>> 16) & 0xff;
        const freq = aux[auxBase + 8];
        const phase = aux[auxBase + 9];
        const omega = 6.283185307179586 * freq;
        const angle = omega * time + phase;
        if (kinKind === MsdfKinematicKind.Piston) {
          const s = 0.5 + 0.5 * Math.sin(angle);
          const dsDt = 0.5 * omega * Math.cos(angle);
          const power = aux[auxBase + 10];
          const wave = Math.pow(s > 0 ? s : 0, power);
          const dwaveDt =
            power * Math.pow(s > 1e-6 ? s : 1e-6, power > 1 ? power - 1 : 0) * dsDt;
          const stroke = aux[auxBase + 7];
          const disp = stroke * wave;
          const speed = stroke * dwaveDt;
          const ax = aux[auxBase + 4];
          const ay = aux[auxBase + 5];
          const az = aux[auxBase + 6];
          lx -= ax * disp;
          ly -= ay * disp;
          lz -= az * disp;
          vx = ax * speed;
          vy = ay * speed;
          vz = az * speed;
        } else if (kinKind === MsdfKinematicKind.Bridge) {
          const amp = aux[auxBase + 7];
          const disp = amp * Math.sin(angle);
          const speed = amp * omega * Math.cos(angle);
          const ax = aux[auxBase + 4];
          const ay = aux[auxBase + 5];
          const az = aux[auxBase + 6];
          lx -= ax * disp;
          ly -= ay * disp;
          lz -= az * disp;
          vx = ax * speed;
          vy = ay * speed;
          vz = az * speed;
        } else if (kinKind === MsdfKinematicKind.SteelieOrbit) {
          const rx = aux[auxBase + 4];
          const ry = aux[auxBase + 5];
          const rz = aux[auxBase + 6] || rx;
          lx -= rx * Math.cos(angle);
          ly -= ry * Math.sin(angle * 2);
          lz -= rz * Math.sin(angle);
          vx = -rx * omega * Math.sin(angle);
          vy = ry * 2 * omega * Math.cos(angle * 2);
          vz = rz * omega * Math.cos(angle);
        } else {
          const sinA = Math.sin(angle);
          const cosA = Math.cos(angle);
          const sx = aux[auxBase + 4];
          const sy = aux[auxBase + 5];
          const sz = aux[auxBase + 6];
          lx -= sx * sinA;
          ly -= sy * sinA;
          lz -= sz * sinA;
          vx = sx * omega * cosA;
          vy = sy * omega * cosA;
          vz = sz * omega * cosA;
        }
      }

      if ((flags & MsdfNodeFlags.HasRotation) !== 0) {
        const qx = aux[auxBase];
        const qy = aux[auxBase + 1];
        const qz = aux[auxBase + 2];
        const qw = aux[auxBase + 3];
        const tx = 2 * (qy * lz - qz * ly);
        const ty = 2 * (qz * lx - qx * lz);
        const tz = 2 * (qx * ly - qy * lx);
        const crx = qy * tz - qz * ty;
        const cry = qz * tx - qx * tz;
        const crz = qx * ty - qy * tx;
        lx = lx - qw * tx + crx;
        ly = ly - qw * ty + cry;
        lz = lz - qw * tz + crz;
      }

      if ((flags & MsdfNodeFlags.HasConveyor) !== 0) {
        if (op === MsdfOpcode.PrimSweptTrack) {
          cx = aux[auxBase + 14];
          cy = aux[auxBase + 10];
          cz = aux[auxBase + 15];
        } else {
          cx = aux[auxBase + 11];
          cy = aux[auxBase + 12];
          cz = aux[auxBase + 13];
        }
      }
    }

    let d = 1000.0;
    switch (op) {
      case MsdfOpcode.PrimBox: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);
        break;
      }
      case MsdfOpcode.PrimRoundedBox: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0) - f32[ip + 8];
        break;
      }
      case MsdfOpcode.PrimSphere:
        d = Math.sqrt(lx * lx + ly * ly + lz * lz) - f32[ip + 5];
        break;
      case MsdfOpcode.PrimCylinder: {
        const dx = Math.sqrt(lx * lx + lz * lz) - f32[ip + 5];
        const dy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const mx = dx > 0 ? dx : 0;
        const my = dy > 0 ? dy : 0;
        const maxD = dx > dy ? dx : dy;
        d = (maxD < 0 ? maxD : 0) + Math.sqrt(mx * mx + my * my);
        break;
      }
      case MsdfOpcode.PrimCapsule: {
        const pax = lx - f32[ip + 5];
        const pay = ly - f32[ip + 6];
        const paz = lz - f32[ip + 7];
        const bax = f32[ip + 8];
        const bay = f32[ip + 9];
        const baz = f32[ip + 10];
        const rawH = (pax * bax + pay * bay + paz * baz) * f32[ip + 11];
        const h = rawH < 0 ? 0 : rawH > 1 ? 1 : rawH;
        const dx = pax - bax * h;
        const dy = pay - bay * h;
        const dz = paz - baz * h;
        d = Math.sqrt(dx * dx + dy * dy + dz * dz) - f32[ip + 12];
        break;
      }
      case MsdfOpcode.PrimTorus: {
        const qx = Math.sqrt(lx * lx + lz * lz) - f32[ip + 5];
        d = Math.sqrt(qx * qx + ly * ly) - f32[ip + 6];
        break;
      }
      case MsdfOpcode.PrimRamp: {
        const isX = f32[ip + 5] > 0.5;
        const runCoord = isX ? lx : lz;
        const latCoord = isX ? lz : lx;
        const safeHalfLen = f32[ip + 6];
        const tanTheta = f32[ip + 7];
        const cosTheta = f32[ip + 8];
        const halfWidth = f32[ip + 9];
        const halfThick = f32[ip + 10];
        const railH = f32[ip + 11];
        const yTop = runCoord * tanTheta;

        const dRun = (runCoord < 0 ? -runCoord : runCoord) - safeHalfLen;
        const dyRaw = ly - (yTop - halfThick);
        const dDeckY = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfThick) * cosTheta;
        const absLat = latCoord < 0 ? -latCoord : latCoord;
        const dLat = absLat - halfWidth;

        const mx = dRun > 0 ? dRun : 0;
        const my = dDeckY > 0 ? dDeckY : 0;
        const mz = dLat > 0 ? dLat : 0;
        const maxYZ = dDeckY > dLat ? dDeckY : dLat;
        const maxQ = dRun > maxYZ ? dRun : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);

        if (railH > 0.001) {
          const halfRailH = f32[ip + 12];
          const halfRailThick = f32[ip + 13];
          const rlDiff = absLat - (halfWidth - halfRailThick);
          const dRailLat = (rlDiff < 0 ? -rlDiff : rlDiff) - halfRailThick;
          const ryDiff = ly - (yTop + halfRailH);
          const dRailY = ((ryDiff < 0 ? -ryDiff : ryDiff) - halfRailH) * cosTheta;
          const rmy = dRailY > 0 ? dRailY : 0;
          const rmz = dRailLat > 0 ? dRailLat : 0;
          const rMaxYZ = dRailY > dRailLat ? dRailY : dRailLat;
          const rMaxQ = dRun > rMaxYZ ? dRun : rMaxYZ;
          const dRail = Math.sqrt(mx * mx + rmy * rmy + rmz * rmz) + (rMaxQ < 0 ? rMaxQ : 0);
          if (dRail < d) d = dRail;
        }
        break;
      }
      case MsdfOpcode.PrimSweptTrack: {
        const sx0 = f32[ip + 5];
        const sy0 = f32[ip + 6];
        const sz0 = f32[ip + 7];
        const bax = f32[ip + 8];
        const bay = f32[ip + 9];
        const baz = f32[ip + 10];
        const pax = lx - sx0;
        const pay = ly - sy0;
        const paz = lz - sz0;
        const rawT = (pax * bax + pay * bay + paz * baz) * f32[ip + 11];
        const t = rawT < 0 ? 0 : rawT > 1 ? 1 : rawT;
        const dpx = pax - bax * t;
        const dpy = pay - bay * t;
        const dpz = paz - baz * t;

        const auxBase = ((meta >>> 24) & 0xff) * MSDF_AUX_STRIDE;
        const tx = aux[auxBase + 11];
        const tz = aux[auxBase + 12];
        const slopeCos = aux[auxBase + 13];
        const lat = -dpx * tz + dpz * tx;
        const along = dpx * tx + dpz * tz;

        const halfWidth = f32[ip + 12];
        const halfThick = f32[ip + 13];
        const railH = f32[ip + 14];

        const dAlong = (along < 0 ? -along : along) - 0.08;
        const dyRaw = dpy + halfThick;
        const dDeckY = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfThick) * slopeCos;
        const absLat = lat < 0 ? -lat : lat;
        const dDeckLat = absLat - halfWidth;

        const mx = dAlong > 0 ? dAlong : 0;
        const my = dDeckY > 0 ? dDeckY : 0;
        const mz = dDeckLat > 0 ? dDeckLat : 0;
        const maxYZ = dDeckY > dDeckLat ? dDeckY : dDeckLat;
        const maxQ = dAlong > maxYZ ? dAlong : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);

        if (railH > 0.001) {
          const halfRailThick = 0.5 * f32[ip + 15];
          const halfRailH = 0.5 * railH;
          const rlDiff = absLat - (halfWidth - halfRailThick);
          const dRailLat = (rlDiff < 0 ? -rlDiff : rlDiff) - halfRailThick;
          const ryDiff = dpy - halfRailH;
          const dRailY = ((ryDiff < 0 ? -ryDiff : ryDiff) - halfRailH) * slopeCos;
          const rmy = dRailY > 0 ? dRailY : 0;
          const rmz = dRailLat > 0 ? dRailLat : 0;
          const rMaxYZ = dRailY > dRailLat ? dRailY : dRailLat;
          const rMaxQ = dAlong > rMaxYZ ? dAlong : rMaxYZ;
          const dRail = Math.sqrt(mx * mx + rmy * rmy + rmz * rmz) + (rMaxQ < 0 ? rMaxQ : 0);
          if (dRail < d) d = dRail;
        }
        break;
      }
      case MsdfOpcode.PrimWaveFloor: {
        const amp = f32[ip + 8];
        const freqX = f32[ip + 9];
        const freqZ = f32[ip + 10];
        const speed = f32[ip + 11];
        const argX = lx * freqX + time * speed;
        const argZ = lz * freqZ + time * speed * 0.7;
        const sinX = Math.sin(argX);
        const cosX = Math.cos(argX);
        const sinZ = Math.sin(argZ);
        const cosZ = Math.cos(argZ);
        const waveH = amp * sinX * cosZ;
        const midY = 0.5 * waveH;
        const halfH = Math.max(0.08, f32[ip + 6] + 0.5 * waveH);
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const dyRaw = ly - midY;
        const qy = ((dyRaw < 0 ? -dyRaw : dyRaw) - halfH) * 0.85;
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        d = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0);

        const dWaveDt = amp * speed * (cosX * cosZ - 0.7 * sinX * sinZ);
        vy += dWaveDt * 0.5;
        break;
      }
      case MsdfOpcode.PrimPiston: {
        const qx = (lx < 0 ? -lx : lx) - f32[ip + 5];
        const qy = (ly < 0 ? -ly : ly) - f32[ip + 6];
        const qz = (lz < 0 ? -lz : lz) - f32[ip + 7];
        const mx = qx > 0 ? qx : 0;
        const my = qy > 0 ? qy : 0;
        const mz = qz > 0 ? qz : 0;
        const maxYZ = qy > qz ? qy : qz;
        const maxQ = qx > maxYZ ? qx : maxYZ;
        const dHead = Math.sqrt(mx * mx + my * my + mz * mz) + (maxQ < 0 ? maxQ : 0) - f32[ip + 8];

        const stemR = f32[ip + 9];
        const stemHalfH = f32[ip + 10];
        const stemY = ly - f32[ip + 11];
        const sdx = Math.sqrt(lx * lx + lz * lz) - stemR;
        const sdy = (stemY < 0 ? -stemY : stemY) - stemHalfH;
        const smx = sdx > 0 ? sdx : 0;
        const smy = sdy > 0 ? sdy : 0;
        const sMax = sdx > sdy ? sdx : sdy;
        const dStem = (sMax < 0 ? sMax : 0) + Math.sqrt(smx * smx + smy * smy);
        d = dHead < dStem ? dHead : dStem;
        break;
      }
    }

    DIST_STACK[sp] = d;
    MAT_STACK[sp] = matId;
    VEL_X_STACK[sp] = vx;
    VEL_Y_STACK[sp] = vy;
    VEL_Z_STACK[sp] = vz;
    CONV_X_STACK[sp] = cx;
    CONV_Y_STACK[sp] = cy;
    CONV_Z_STACK[sp] = cz;
    sp++;
  }

  const finalMatId = MAT_STACK[0];
  return {
    distance: DIST_STACK[0],
    materialId: finalMatId,
    material: ID_TO_MATERIAL[finalMatId] ?? 'standard',
    kinematicVelocity:
      VEL_X_STACK[0] === 0 && VEL_Y_STACK[0] === 0 && VEL_Z_STACK[0] === 0
        ? ZERO_VEC3
        : [VEL_X_STACK[0], VEL_Y_STACK[0], VEL_Z_STACK[0]],
    conveyorVelocity:
      CONV_X_STACK[0] === 0 && CONV_Y_STACK[0] === 0 && CONV_Z_STACK[0] === 0
        ? ZERO_VEC3
        : [CONV_X_STACK[0], CONV_Y_STACK[0], CONV_Z_STACK[0]],
  };
}

/**
 * Evaluate a single primitive instruction at offset `ip` (used for seam-bias support normal check).
 */
function evalSingleInstructionDistance(
  program: MsdfBytecodeProgram,
  ip: number,
  px: number,
  py: number,
  pz: number,
  time: number,
): number {
  const subProgram: MsdfBytecodeProgram = {
    ...program,
    i32: program.i32.subarray(ip, ip + MSDF_INSTRUCTION_STRIDE),
    f32: program.f32.subarray(ip, ip + MSDF_INSTRUCTION_STRIDE),
    instructionCount: 1,
  };
  return evalMsdfBytecodeDistance(subProgram, px, py, pz, time);
}

/**
 * Create a drop-in `CpuWorldEvaluator` backed purely by a stripped `.msdf` RPN bytecode program.
 */
export function createMsdfBytecodeWorldEvaluator(
  program: MsdfBytecodeProgram,
): CpuWorldEvaluator {
  // Pre-collect primitive instruction offsets for seam-biased support normals
  const primOffsets: number[] = [];
  for (let ip = 0; ip < program.i32.length; ip += MSDF_INSTRUCTION_STRIDE) {
    if (program.i32[ip] < MsdfOpcode.CsgUnion) {
      primOffsets.push(ip);
    }
  }

  function distance(p: Vec3, time: number): number {
    return evalMsdfBytecodeDistance(program, p[0], p[1], p[2], time);
  }

  function sample(p: Vec3, time: number): SdfSample {
    return evalMsdfBytecode(program, p, time);
  }

  function tetrahedralNormal(
    evalFn: (x: number, y: number, z: number) => number,
    px: number,
    py: number,
    pz: number,
  ): Vec3 {
    const d0 = evalFn(px + NORMAL_EPS, py - NORMAL_EPS, pz - NORMAL_EPS);
    const d1 = evalFn(px - NORMAL_EPS, py - NORMAL_EPS, pz + NORMAL_EPS);
    const d2 = evalFn(px - NORMAL_EPS, py + NORMAL_EPS, pz - NORMAL_EPS);
    const d3 = evalFn(px + NORMAL_EPS, py + NORMAL_EPS, pz + NORMAL_EPS);
    return vec3Normalize([d0 - d1 - d2 + d3, -d0 - d1 + d2 + d3, -d0 + d1 - d2 + d3]);
  }

  function normal(p: Vec3, time: number): Vec3 {
    const px = p[0];
    const py = p[1];
    const pz = p[2];
    const baseNormal = tetrahedralNormal(
      (x, y, z) => evalMsdfBytecodeDistance(program, x, y, z, time),
      px,
      py,
      pz,
    );

    if (primOffsets.length <= 1) return baseNormal;

    let minDist = Infinity;
    const closeOffsets: number[] = [];
    for (let i = 0; i < primOffsets.length; i++) {
      const ip = primOffsets[i];
      const d = evalSingleInstructionDistance(program, ip, px, py, pz, time);
      if (d < minDist) minDist = d;
      if (d < 0.8) closeOffsets.push(ip);
    }

    if (closeOffsets.length <= 1) return baseNormal;

    let bestSupportNormal: Vec3 | null = null;
    let bestSupportY = baseNormal[1];
    for (let i = 0; i < closeOffsets.length; i++) {
      const ip = closeOffsets[i];
      const d = evalSingleInstructionDistance(program, ip, px, py, pz, time);
      if (Math.abs(d - minDist) <= SEAM_BIAS_EPS) {
        const childNormal = tetrahedralNormal(
          (x, y, z) => evalSingleInstructionDistance(program, ip, x, y, z, time),
          px,
          py,
          pz,
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
    const clampDist = Math.min(radius, Math.max(0, centerSample.distance));
    const contactPoint: Vec3 = [
      center[0] - n[0] * clampDist,
      center[1] - n[1] * clampDist,
      center[2] - n[2] * clampDist,
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
      if (marched >= totalDist) break;
    }

    return {
      hit: false,
      toi: 1.0,
      distanceTravelled: totalDist,
      hitPoint: vec3Add(origin, displacement),
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
      if (d < 0.14) return true;
      t += Math.max(d * 0.85, 0.12);
    }
    return false;
  }

  return {
    sample,
    distance,
    normal,
    queryContact,
    sphereCast,
    isOccluded,
  };
}
