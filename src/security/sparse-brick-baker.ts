/**
 * One-Way Geometric Compiler: Sparse SDF Brick Atlas Baker & O(1) Trilinear Sampler
 * (`src/security/sparse-brick-baker.ts`)
 *
 * Architecture:
 * - Compiles an arbitrary parametric `CourseSpec` CSG tree into a two-level
 *   Sparse SDF Brick Atlas suitable for WebGPU 3D textures (`r16uint` indirection +
 *   `r16snorm` / `rg16sint` physical bricks) and O(1) CPU trilinear queries:
 *     1. Coarse 3D Indirection Grid (`Uint16Array`, `gridX * gridY * gridZ`):
 *        - Macro-cells intersecting the surface narrow band store `brickIdx` (`0..0x7FFE`).
 *        - Empty-space / far-field macro-cells set high bit `0x8000` and pack a signed
 *          15-bit far-field distance (`0x8000 | (int15 & 0x7FFF)`), enabling 1-op empty
 *          space skipping without allocating physical bricks.
 *     2. Physical Narrow-Band Brick Atlas (`Int16Array` distances + `Uint8Array` materials):
 *        - Each allocated brick stores `10 x 10 x 10 = 1,000` texels (`8^3` logical cells +
 *          1-voxel border on all 6 faces) so 8-corner trilinear interpolation is C^0
 *          continuous across brick boundaries with zero neighbor-brick lookups.
 * - Eliminates all semantic CSG nodes, primitive parameters, and string identifiers
 *   (a lossy one-way geometric hash) while turning O(N) tree evaluation into O(1) lookup.
 */

import {
  type CourseSpec,
  ID_TO_MATERIAL,
  type SdfNode,
  type SdfSample,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import {
  type MsdfBytecodeProgram,
  compileCourseToMsdfBytecode,
  computeCourseBounds,
  evalMsdfBytecodeDistance,
  getLastMsdfMaterialId,
} from './msdf-bytecode';
import { buildCourseSceneTree, createCpuWorldEvaluator, evaluateSdfTree } from '../sdf/eval-cpu';

export const BRICK_LOGICAL_DIM = 8; // 8x8x8 logical cells per brick
export const BRICK_PHYSICAL_DIM = 10; // 10x10x10 physical texels (includes +1 border on each side)
export const BRICK_TEXEL_COUNT = 1000; // 10 * 10 * 10
export const FAR_FIELD_FLAG = 0x8000;

export interface SparseBrickAtlasConfig {
  /** World-space size of a single voxel (default: `0.25` units -> 2.0m macro-bricks) */
  readonly voxelSize?: number;
  /** Narrow-band distance range around surfaces to allocate physical bricks (default: `2.4` units) */
  readonly narrowBandHalfWidth?: number;
  /** Simulation time snapshot at which to bake static/base geometry (default: `0.0`) */
  readonly bakeTime?: number;
  /** Optional explicit world bounds [minX, minY, minZ, maxX, maxY, maxZ] */
  readonly bounds?: readonly [number, number, number, number, number, number];
}

export interface SparseBrickAtlas {
  /** World-space minimum corner [minX, minY, minZ] */
  readonly origin: Vec3;
  /** World-space maximum corner [maxX, maxY, maxZ] */
  readonly maxBounds: Vec3;
  /** Voxel edge length in world units */
  readonly voxelSize: number;
  /** Reciprocal of voxelSize (`1 / voxelSize`) */
  readonly invVoxelSize: number;
  /** World-space edge length of one 8x8x8 logical brick (`8 * voxelSize`) */
  readonly brickWorldSize: number;
  /** Reciprocal of brickWorldSize (`1 / brickWorldSize`) */
  readonly invBrickWorldSize: number;
  /** Dimensions of the coarse 3D indirection grid [nx, ny, nz] */
  readonly gridDims: readonly [number, number, number];
  /** Coarse 3D indirection grid (`r16uint` layout: `bx + nx * (by + ny * bz)`) */
  readonly indirectionGrid: Uint16Array;
  /** Packed Int16 signed distances for allocated 10^3 bricks (`activeBrickCount * 1000`) */
  readonly brickDistances: Int16Array;
  /** Packed Uint8 material IDs for allocated 10^3 bricks (`activeBrickCount * 1000`) */
  readonly brickMaterials: Uint8Array;
  /** Scale factor mapping Int16 `[-32767..32767]` to world distance */
  readonly distanceScale: number;
  /** Scale factor mapping signed 15-bit far-field entries `[-16383..16383]` to world distance */
  readonly farFieldScale: number;
  /** Number of allocated narrow-band 10^3 bricks */
  readonly activeBrickCount: number;
  /** Total macro-cells in the indirection grid (`nx * ny * nz`) */
  readonly totalMacroCells: number;
  /** Fraction of macro-cells that required physical brick allocation (`activeBrickCount / totalMacroCells`) */
  readonly occupancyRatio: number;
  /** Total memory footprint of the binary atlas in bytes */
  readonly totalByteLength: number;
}

export interface SdfBenchmarkReport {
  readonly courseId: string;
  readonly primitiveCount: number;
  readonly queryCount: number;
  readonly astTotalMs: number;
  readonly rpnTotalMs: number;
  readonly brickTotalMs: number;
  readonly astEvalPerSec: number;
  readonly rpnEvalPerSec: number;
  readonly brickEvalPerSec: number;
  readonly rpnSpeedupVsAst: number;
  readonly brickSpeedupVsAst: number;
  readonly brickSpeedupVsRpn: number;
  readonly maxRpnParityDiff: number;
  readonly meanNarrowBandBrickError: number;
  readonly sourceJsonBytes: number;
  readonly msdfBytecodeBytes: number;
  readonly sparseBrickAtlasBytes: number;
  readonly brickOccupancyRatio: number;
  readonly activeBrickCount: number;
  readonly totalMacroCells: number;
  readonly zeroLeakedIdentifiers: boolean;
}

const ZERO_VEC3: Vec3 = [0, 0, 0];

function packSignedInt15(val: number): number {
  const clamped = val < -16383 ? -16383 : val > 16383 ? 16383 : val | 0;
  return FAR_FIELD_FLAG | (clamped & 0x7fff);
}

/**
 * Bake a `CourseSpec` into a one-way quantized `Int16` Sparse SDF Brick Atlas.
 */
export function bakeCourseToSparseBrickAtlas(
  course: CourseSpec,
  config: SparseBrickAtlasConfig = {},
): SparseBrickAtlas {
  const voxelSize = config.voxelSize ?? 0.25;
  const invVoxelSize = 1.0 / voxelSize;
  const brickWorldSize = BRICK_LOGICAL_DIM * voxelSize;
  const invBrickWorldSize = 1.0 / brickWorldSize;
  const narrowBandHalfWidth = config.narrowBandHalfWidth ?? Math.max(1.1, brickWorldSize * 0.65);
  const bakeTime = config.bakeTime ?? 0.0;

  // Compile to RPN bytecode first so baking uses the fast zero-allocation evaluator
  const rpnProgram = compileCourseToMsdfBytecode(course, 0);
  const rawBounds = config.bounds ?? computeCourseBounds(course, 2.0);

  const minX = rawBounds[0];
  const minY = rawBounds[1];
  const minZ = rawBounds[2];
  const spanX = Math.max(brickWorldSize, rawBounds[3] - minX);
  const spanY = Math.max(brickWorldSize, rawBounds[4] - minY);
  const spanZ = Math.max(brickWorldSize, rawBounds[5] - minZ);

  const nx = Math.ceil(spanX * invBrickWorldSize);
  const ny = Math.ceil(spanY * invBrickWorldSize);
  const nz = Math.ceil(spanZ * invBrickWorldSize);
  const totalMacroCells = nx * ny * nz;

  const maxX = minX + nx * brickWorldSize;
  const maxY = minY + ny * brickWorldSize;
  const maxZ = minZ + nz * brickWorldSize;

  // Maximum representable distance inside a narrow-band brick (includes brick diagonal margin)
  const brickHalfDiag = 0.5 * Math.sqrt(3) * (BRICK_PHYSICAL_DIM * voxelSize);
  const maxBrickDist = narrowBandHalfWidth + brickHalfDiag;
  const distanceScale = maxBrickDist / 32767.0;
  const invDistanceScale = 32767.0 / maxBrickDist;

  const maxFarDist = Math.max(spanX, spanY, spanZ);
  const farFieldScale = maxFarDist / 16383.0;
  const invFarFieldScale = 16383.0 / maxFarDist;

  const indirectionGrid = new Uint16Array(totalMacroCells);
  const activeMacroIndices: number[] = [];
  const activeBrickCoords: number[] = [];

  // Pass 1: Classify macro-cells into narrow-band bricks vs. far-field empty-space cells
  const cullThreshold = narrowBandHalfWidth + 0.5 * Math.sqrt(3) * brickWorldSize;
  for (let bz = 0; bz < nz; bz++) {
    const cz = minZ + (bz + 0.5) * brickWorldSize;
    for (let by = 0; by < ny; by++) {
      const cy = minY + (by + 0.5) * brickWorldSize;
      for (let bx = 0; bx < nx; bx++) {
        const cx = minX + (bx + 0.5) * brickWorldSize;
        const cellIdx = bx + nx * (by + ny * bz);
        const centerDist = evalMsdfBytecodeDistance(rpnProgram, cx, cy, cz, bakeTime);

        if (Math.abs(centerDist) <= cullThreshold && activeMacroIndices.length < 0x7ffe) {
          const brickIdx = activeMacroIndices.length;
          indirectionGrid[cellIdx] = brickIdx;
          activeMacroIndices.push(cellIdx);
          activeBrickCoords.push(bx, by, bz);
        } else {
          const qFar = Math.round(centerDist * invFarFieldScale);
          indirectionGrid[cellIdx] = packSignedInt15(qFar);
        }
      }
    }
  }

  // Pass 2: Bake 10x10x10 physical texels for each active narrow-band brick
  const activeBrickCount = activeMacroIndices.length;
  const brickDistances = new Int16Array(activeBrickCount * BRICK_TEXEL_COUNT);
  const brickMaterials = new Uint8Array(activeBrickCount * BRICK_TEXEL_COUNT);

  for (let b = 0; b < activeBrickCount; b++) {
    const bx = activeBrickCoords[b * 3];
    const by = activeBrickCoords[b * 3 + 1];
    const bz = activeBrickCoords[b * 3 + 2];

    const brickOriginX = minX + bx * brickWorldSize;
    const brickOriginY = minY + by * brickWorldSize;
    const brickOriginZ = minZ + bz * brickWorldSize;
    const brickBaseOffset = b * BRICK_TEXEL_COUNT;

    // Texel i in [0..9] maps to brickOrigin + (i - 1) * voxelSize
    for (let iz = 0; iz < BRICK_PHYSICAL_DIM; iz++) {
      const wz = brickOriginZ + (iz - 1) * voxelSize;
      const zOffset = brickBaseOffset + iz * 100;
      for (let iy = 0; iy < BRICK_PHYSICAL_DIM; iy++) {
        const wy = brickOriginY + (iy - 1) * voxelSize;
        const yzOffset = zOffset + iy * 10;
        for (let ix = 0; ix < BRICK_PHYSICAL_DIM; ix++) {
          const wx = brickOriginX + (ix - 1) * voxelSize;
          const dist = evalMsdfBytecodeDistance(rpnProgram, wx, wy, wz, bakeTime);
          const qDist = Math.round(dist * invDistanceScale);
          brickDistances[yzOffset + ix] =
            qDist < -32767 ? -32767 : qDist > 32767 ? 32767 : qDist;
          brickMaterials[yzOffset + ix] = getLastMsdfMaterialId();
        }
      }
    }
  }

  const totalByteLength =
    indirectionGrid.byteLength + brickDistances.byteLength + brickMaterials.byteLength;

  return {
    origin: [minX, minY, minZ],
    maxBounds: [maxX, maxY, maxZ],
    voxelSize,
    invVoxelSize,
    brickWorldSize,
    invBrickWorldSize,
    gridDims: [nx, ny, nz],
    indirectionGrid,
    brickDistances,
    brickMaterials,
    distanceScale,
    farFieldScale,
    activeBrickCount,
    totalMacroCells,
    occupancyRatio: totalMacroCells > 0 ? activeBrickCount / totalMacroCells : 0,
    totalByteLength,
  };
}

/**
 * O(1) hardware-equivalent trilinear distance lookup into the Sparse SDF Brick Atlas.
 *
 * - Far-field macro-cells return in 1 array lookup (empty-space skipping).
 * - Narrow-band macro-cells perform an 8-corner trilinear interpolation inside the
 *   10x10x10 padded brick with zero branch divergence or neighbor-brick lookups.
 */
export function sampleSparseBrickAtlasDistance(
  atlas: SparseBrickAtlas,
  px: number,
  py: number,
  pz: number,
): number {
  const nx = atlas.gridDims[0];
  const ny = atlas.gridDims[1];
  const nz = atlas.gridDims[2];

  const relX = px - atlas.origin[0];
  const relY = py - atlas.origin[1];
  const relZ = pz - atlas.origin[2];

  const ux = relX * atlas.invBrickWorldSize;
  const uy = relY * atlas.invBrickWorldSize;
  const uz = relZ * atlas.invBrickWorldSize;

  const bx = ux < 0 ? 0 : ux >= nx ? nx - 1 : ux | 0;
  const by = uy < 0 ? 0 : uy >= ny ? ny - 1 : uy | 0;
  const bz = uz < 0 ? 0 : uz >= nz ? nz - 1 : uz | 0;

  const entry = atlas.indirectionGrid[bx + nx * (by + ny * bz)];
  if ((entry & FAR_FIELD_FLAG) !== 0) {
    // Sign-extend 15-bit integer
    const signed15 = (entry << 17) >> 17;
    return signed15 * atlas.farFieldScale;
  }

  // Local coordinate inside the 10x10x10 padded brick: [1.0 .. 9.0]
  const lx = (ux - bx) * 8.0 + 1.0;
  const ly = (uy - by) * 8.0 + 1.0;
  const lz = (uz - bz) * 8.0 + 1.0;

  const clampedX = lx < 0 ? 0 : lx > 8.999 ? 8.999 : lx;
  const clampedY = ly < 0 ? 0 : ly > 8.999 ? 8.999 : ly;
  const clampedZ = lz < 0 ? 0 : lz > 8.999 ? 8.999 : lz;

  const ix = clampedX | 0;
  const iy = clampedY | 0;
  const iz = clampedZ | 0;

  const fx = clampedX - ix;
  const fy = clampedY - iy;
  const fz = clampedZ - iz;
  const omx = 1.0 - fx;
  const omy = 1.0 - fy;
  const omz = 1.0 - fz;

  const base = entry * 1000 + iz * 100 + iy * 10 + ix;
  const dists = atlas.brickDistances;

  const c00 = dists[base] * omx + dists[base + 1] * fx;
  const c10 = dists[base + 10] * omx + dists[base + 11] * fx;
  const c01 = dists[base + 100] * omx + dists[base + 101] * fx;
  const c11 = dists[base + 110] * omx + dists[base + 111] * fx;

  const c0 = c00 * omy + c10 * fy;
  const c1 = c01 * omy + c11 * fy;

  return (c0 * omz + c1 * fz) * atlas.distanceScale;
}

/**
 * O(1) trilinear distance + material lookup from the Sparse SDF Brick Atlas.
 */
export function sampleSparseBrickAtlas(
  atlas: SparseBrickAtlas,
  p: Vec3,
): SdfSample {
  const d = sampleSparseBrickAtlasDistance(atlas, p[0], p[1], p[2]);
  const nx = atlas.gridDims[0];
  const ny = atlas.gridDims[1];
  const nz = atlas.gridDims[2];

  const ux = (p[0] - atlas.origin[0]) * atlas.invBrickWorldSize;
  const uy = (p[1] - atlas.origin[1]) * atlas.invBrickWorldSize;
  const uz = (p[2] - atlas.origin[2]) * atlas.invBrickWorldSize;

  const bx = ux < 0 ? 0 : ux >= nx ? nx - 1 : ux | 0;
  const by = uy < 0 ? 0 : uy >= ny ? ny - 1 : uy | 0;
  const bz = uz < 0 ? 0 : uz >= nz ? nz - 1 : uz | 0;

  const entry = atlas.indirectionGrid[bx + nx * (by + ny * bz)];
  let matId = 0;
  if ((entry & FAR_FIELD_FLAG) === 0) {
    const ix = Math.min(9, Math.max(0, Math.round((ux - bx) * 8.0 + 1.0)));
    const iy = Math.min(9, Math.max(0, Math.round((uy - by) * 8.0 + 1.0)));
    const iz = Math.min(9, Math.max(0, Math.round((uz - bz) * 8.0 + 1.0)));
    matId = atlas.brickMaterials[entry * 1000 + iz * 100 + iy * 10 + ix];
  }

  const material: SurfaceMaterial = ID_TO_MATERIAL[matId] ?? 'standard';
  return {
    distance: d,
    material,
    materialId: matId,
    kinematicVelocity: ZERO_VEC3,
    conveyorVelocity: ZERO_VEC3,
  };
}

/**
 * Audit binary buffers to verify that zero semantic node IDs or labels from `CourseSpec`
 * survive in either the `.msdf` bytecode or the Sparse SDF Brick Atlas.
 */
export function verifyZeroLeakedIdentifiers(
  course: CourseSpec,
  rpnProgram: MsdfBytecodeProgram,
  brickAtlas: SparseBrickAtlas,
): boolean {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const rpnText = decoder.decode(rpnProgram.binaryBuffer);
  const indirectionText = decoder.decode(
    new Uint8Array(
      brickAtlas.indirectionGrid.buffer,
      brickAtlas.indirectionGrid.byteOffset,
      brickAtlas.indirectionGrid.byteLength,
    ),
  );
  const brickDistText = decoder.decode(
    new Uint8Array(
      brickAtlas.brickDistances.buffer,
      brickAtlas.brickDistances.byteOffset,
      brickAtlas.brickDistances.byteLength,
    ),
  );

  const sensitiveStrings: string[] = [course.id, course.name];
  for (const n of course.nodes) {
    if (n.id && n.id.length >= 4) sensitiveStrings.push(n.id);
  }
  for (const h of course.hazards) {
    if (h.id && h.id.length >= 4) sensitiveStrings.push(h.id);
  }

  for (const token of sensitiveStrings) {
    if (
      rpnText.includes(token) ||
      indirectionText.includes(token) ||
      brickDistText.includes(token)
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Benchmark evaluation throughput and numerical parity across:
 *   1. Baseline O(N) recursive AST (`evaluateSdfTree`)
 *   2. Flat `.msdf` RPN Bytecode VM (`evalMsdfBytecodeDistance`)
 *   3. O(1) Sparse SDF Brick Atlas (`sampleSparseBrickAtlasDistance`)
 */
export function benchmarkSdfEvaluators(
  course: CourseSpec,
  options: {
    sampleCount?: number;
    iterations?: number;
    voxelSize?: number;
  } = {},
): SdfBenchmarkReport {
  const sampleCount = options.sampleCount ?? 2048;
  const iterations = options.iterations ?? 25;
  const voxelSize = options.voxelSize ?? 0.25;

  const rootTree: SdfNode = buildCourseSceneTree(course);
  const astEvaluator = createCpuWorldEvaluator(course);
  const rpnProgram = compileCourseToMsdfBytecode(course, 0x6e5b2026);
  const brickAtlas = bakeCourseToSparseBrickAtlas(course, {
    voxelSize,
    bakeTime: 0,
  });

  // Generate deterministic 3D query points sampling both near-surface track points and course bounds
  const pointsX = new Float32Array(sampleCount);
  const pointsY = new Float32Array(sampleCount);
  const pointsZ = new Float32Array(sampleCount);
  const allNodes = [...course.nodes, ...course.hazards];

  for (let i = 0; i < sampleCount; i++) {
    const anchor = allNodes[i % allNodes.length].center;
    // Golden-ratio quasi-random offsets around track nodes
    const u = ((i * 0.6180339887) % 1) * 2 - 1;
    const v = ((i * 0.3819660112) % 1) * 2 - 1;
    const w = ((i * 0.7548776662) % 1) * 2 - 1;
    pointsX[i] = anchor[0] + u * 2.2;
    pointsY[i] = anchor[1] + v * 1.4;
    pointsZ[i] = anchor[2] + w * 2.2;
  }

  // Verify numerical parity between AST, RPN Bytecode, and Sparse Brick Atlas
  let maxRpnParityDiff = 0;
  let narrowBandErrorSum = 0;
  let narrowBandCount = 0;

  for (let i = 0; i < sampleCount; i++) {
    const p: Vec3 = [pointsX[i], pointsY[i], pointsZ[i]];
    const dAst = astEvaluator.distance(p, 0);
    const dRpn = evalMsdfBytecodeDistance(rpnProgram, p[0], p[1], p[2], 0);
    const dBrick = sampleSparseBrickAtlasDistance(brickAtlas, p[0], p[1], p[2]);

    const rpnDiff = Math.abs(dAst - dRpn);
    if (rpnDiff > maxRpnParityDiff) {
      maxRpnParityDiff = rpnDiff;
    }

    if (Math.abs(dAst) <= 1.5) {
      narrowBandErrorSum += Math.abs(dAst - dBrick);
      narrowBandCount++;
    }
  }

  const meanNarrowBandBrickError =
    narrowBandCount > 0 ? narrowBandErrorSum / narrowBandCount : 0;

  // Warmup JIT
  let sink = 0;
  for (let i = 0; i < 256; i++) {
    const idx = i % sampleCount;
    sink += evaluateSdfTree(rootTree, [pointsX[idx], pointsY[idx], pointsZ[idx]], 0).distance;
    sink += evalMsdfBytecodeDistance(rpnProgram, pointsX[idx], pointsY[idx], pointsZ[idx], 0);
    sink += sampleSparseBrickAtlasDistance(brickAtlas, pointsX[idx], pointsY[idx], pointsZ[idx]);
  }

  const totalQueries = sampleCount * iterations;

  // 1. Time O(N) AST Evaluator
  const t0Ast = performance.now();
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < sampleCount; i++) {
      sink += evaluateSdfTree(rootTree, [pointsX[i], pointsY[i], pointsZ[i]], 0).distance;
    }
  }
  const astTotalMs = Math.max(0.01, performance.now() - t0Ast);

  // 2. Time Flat .msdf RPN Bytecode Evaluator
  const t0Rpn = performance.now();
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < sampleCount; i++) {
      sink += evalMsdfBytecodeDistance(rpnProgram, pointsX[i], pointsY[i], pointsZ[i], 0);
    }
  }
  const rpnTotalMs = Math.max(0.01, performance.now() - t0Rpn);

  // 3. Time O(1) Sparse SDF Brick Atlas Trilinear Lookup
  const t0Brick = performance.now();
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < sampleCount; i++) {
      sink += sampleSparseBrickAtlasDistance(brickAtlas, pointsX[i], pointsY[i], pointsZ[i]);
    }
  }
  const brickTotalMs = Math.max(0.01, performance.now() - t0Brick);

  // Prevent dead-code elimination of `sink`
  if (!Number.isFinite(sink)) {
    throw new Error('NaN encountered during benchmark');
  }

  const astEvalPerSec = (totalQueries / astTotalMs) * 1000;
  const rpnEvalPerSec = (totalQueries / rpnTotalMs) * 1000;
  const brickEvalPerSec = (totalQueries / brickTotalMs) * 1000;

  const sourceJsonBytes = new TextEncoder().encode(JSON.stringify(course)).byteLength;

  return {
    courseId: course.id,
    primitiveCount: rpnProgram.primitiveCount,
    queryCount: totalQueries,
    astTotalMs,
    rpnTotalMs,
    brickTotalMs,
    astEvalPerSec,
    rpnEvalPerSec,
    brickEvalPerSec,
    rpnSpeedupVsAst: astTotalMs / rpnTotalMs,
    brickSpeedupVsAst: astTotalMs / brickTotalMs,
    brickSpeedupVsRpn: rpnTotalMs / brickTotalMs,
    maxRpnParityDiff,
    meanNarrowBandBrickError,
    sourceJsonBytes,
    msdfBytecodeBytes: rpnProgram.binaryBuffer.byteLength,
    sparseBrickAtlasBytes: brickAtlas.totalByteLength,
    brickOccupancyRatio: brickAtlas.occupancyRatio,
    activeBrickCount: brickAtlas.activeBrickCount,
    totalMacroCells: brickAtlas.totalMacroCells,
    zeroLeakedIdentifiers: verifyZeroLeakedIdentifiers(course, rpnProgram, brickAtlas),
  };
}
