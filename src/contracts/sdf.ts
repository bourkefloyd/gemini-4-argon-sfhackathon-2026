/**
 * Core SDF (Signed Distance Field) contracts for the Marble Madness remake.
 *
 * Every primitive, CSG operator, surface material, and kinematic transform
 * defined here is evaluated in strict lockstep by:
 *   1. CPU Physics & Raycast Evaluator (`src/sdf/eval-cpu.ts`)
 *   2. GPU Raymarching Shader Compiler (`src/rendering/shader-compiler.ts`)
 */

export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number]; // [x, y, z, w]

export type SdfPrimitiveKind =
  | 'box'
  | 'roundedBox'
  | 'sphere'
  | 'cylinder'
  | 'capsule'
  | 'torus'
  | 'ramp'
  | 'sweptTrack'
  | 'waveFloor'
  | 'piston';

export type SdfCsgOpKind =
  | 'union'
  | 'smoothUnion'
  | 'subtract'
  | 'smoothSubtract'
  | 'intersect';

export type SurfaceMaterial =
  | 'standard'
  | 'ice'
  | 'sticky'
  | 'bounce'
  | 'acid'
  | 'goal'
  | 'start'
  | 'bumper'
  | 'conveyor';

/**
 * Numeric material IDs shared between CPU evaluation and GPU shaders.
 */
export const MATERIAL_IDS: Record<SurfaceMaterial, number> = {
  standard: 0,
  ice: 1,
  sticky: 2,
  bounce: 3,
  acid: 4,
  goal: 5,
  start: 6,
  bumper: 7,
  conveyor: 8,
};

export const ID_TO_MATERIAL: Record<number, SurfaceMaterial> = {
  0: 'standard',
  1: 'ice',
  2: 'sticky',
  3: 'bounce',
  4: 'acid',
  5: 'goal',
  6: 'start',
  7: 'bumper',
  8: 'conveyor',
};

export interface SurfaceMaterialProps {
  readonly id: number;
  readonly name: SurfaceMaterial;
  readonly restitution: number;
  readonly friction: number;
  readonly slopeMultiplier: number;
  readonly bumperImpulse: number;
  readonly conveyorSpeed: number;
  readonly lethal?: 'acid';
  readonly isGoal?: boolean;
}

export const MATERIAL_PROPERTIES: Record<SurfaceMaterial, SurfaceMaterialProps> = {
  standard: {
    id: 0,
    name: 'standard',
    restitution: 0.22,
    friction: 1.85,
    slopeMultiplier: 1.0,
    bumperImpulse: 0,
    conveyorSpeed: 0,
  },
  ice: {
    id: 1,
    name: 'ice',
    restitution: 0.3,
    friction: 0.12,
    slopeMultiplier: 1.45,
    bumperImpulse: 0,
    conveyorSpeed: 0,
  },
  sticky: {
    id: 2,
    name: 'sticky',
    restitution: 0.0,
    friction: 7.5,
    slopeMultiplier: 0.45,
    bumperImpulse: 0,
    conveyorSpeed: 0,
  },
  bounce: {
    id: 3,
    name: 'bounce',
    restitution: 1.45,
    friction: 1.1,
    slopeMultiplier: 1.0,
    bumperImpulse: 0,
    conveyorSpeed: 0,
  },
  acid: {
    id: 4,
    name: 'acid',
    restitution: 0.0,
    friction: 4.0,
    slopeMultiplier: 1.0,
    bumperImpulse: 0,
    conveyorSpeed: 0,
    lethal: 'acid',
  },
  goal: {
    id: 5,
    name: 'goal',
    restitution: 0.05,
    friction: 3.6,
    slopeMultiplier: 0.3,
    bumperImpulse: 0,
    conveyorSpeed: 0,
    isGoal: true,
  },
  start: {
    id: 6,
    name: 'start',
    restitution: 0.15,
    friction: 2.2,
    slopeMultiplier: 0.8,
    bumperImpulse: 0,
    conveyorSpeed: 0,
  },
  bumper: {
    id: 7,
    name: 'bumper',
    restitution: 1.25,
    friction: 1.0,
    slopeMultiplier: 1.0,
    bumperImpulse: 14.0,
    conveyorSpeed: 0,
  },
  conveyor: {
    id: 8,
    name: 'conveyor',
    restitution: 0.2,
    friction: 1.6,
    slopeMultiplier: 1.0,
    bumperImpulse: 0,
    conveyorSpeed: 6.5,
  },
};

/**
 * Time-driven kinematic motion hooks evaluated identically on CPU and GPU.
 *
 * - `piston`: asymmetric slam-and-retract or smooth harmonic oscillation along `axis`
 * - `bridge`: smooth reciprocating platform translation between `center` and `center + axis * amplitude`
 * - `steelie`: patrolling enemy Steelie sphere along a circular or figure-8/linear path
 */
export type KinematicSpec =
  | {
      readonly kind: 'piston';
      /** Unit axis of motion in world space, e.g. [0, -1, 0] for a vertical smasher or [1, 0, 0] for a side ram */
      readonly axis: Vec3;
      /** Maximum displacement amplitude along `axis` */
      readonly stroke: number;
      /** Cycle frequency in Hz */
      readonly frequency: number;
      /** Phase offset in radians */
      readonly phase?: number;
      /** Steepness of the slam wave (1 = pure sine, >1 = rapid slam + pause) */
      readonly slamSharpness?: number;
    }
  | {
      readonly kind: 'bridge';
      /** Translation direction vector (unit) */
      readonly axis: Vec3;
      /** Half-travel amplitude */
      readonly amplitude: number;
      /** Cycle frequency in Hz */
      readonly frequency: number;
      /** Phase offset in radians */
      readonly phase?: number;
    }
  | {
      readonly kind: 'steelie';
      /** Patrol mode: 'orbit' (circle in XZ) or 'patrol' (back-and-forth line) */
      readonly mode: 'orbit' | 'patrol';
      /** Radius (for orbit) or half-span vector (for patrol) */
      readonly span: Vec3;
      /** Angular or cycle frequency in Hz */
      readonly frequency: number;
      /** Phase offset in radians */
      readonly phase?: number;
    };

export interface SdfNodeBase {
  readonly id?: string;
  readonly material: SurfaceMaterial;
  readonly center: Vec3;
  readonly rotation?: Quat;
  readonly kinematic?: KinematicSpec;
  /** Optional conveyor flow vector in world space when material === 'conveyor' */
  readonly conveyorDirection?: Vec3;
  /** Whether this node is a solid floor/track eligible for seam-bias support */
  readonly supportBias?: boolean;
}

export interface BoxPrimitive extends SdfNodeBase {
  readonly kind: 'box';
  readonly halfExtents: Vec3;
}

export interface RoundedBoxPrimitive extends SdfNodeBase {
  readonly kind: 'roundedBox';
  readonly halfExtents: Vec3;
  readonly radius: number;
}

export interface SpherePrimitive extends SdfNodeBase {
  readonly kind: 'sphere';
  readonly radius: number;
}

export interface CylinderPrimitive extends SdfNodeBase {
  readonly kind: 'cylinder';
  readonly radius: number;
  readonly halfHeight: number;
}

export interface CapsulePrimitive extends SdfNodeBase {
  readonly kind: 'capsule';
  /** Start point relative to `center` */
  readonly a: Vec3;
  /** End point relative to `center` */
  readonly b: Vec3;
  readonly radius: number;
}

export interface TorusPrimitive extends SdfNodeBase {
  readonly kind: 'torus';
  readonly majorRadius: number;
  readonly minorRadius: number;
}

/**
 * Axial wedge/chute ramp with guaranteed minimum lip thickness (`minLipThickness`)
 * so ramps never degenerate into zero-thickness knife edges.
 */
export interface RampPrimitive extends SdfNodeBase {
  readonly kind: 'ramp';
  /** Run axis in local space ('x' or 'z') */
  readonly axis: 'x' | 'z';
  /** Half-length along the run axis */
  readonly halfLength: number;
  /** Total rise (or drop if negative) from -halfLength to +halfLength */
  readonly rise: number;
  /** Half-width perpendicular to the run axis in XZ */
  readonly halfWidth: number;
  /** Slab thickness perpendicular to vertical */
  readonly thickness: number;
  /** Optional raised side rails height (0 = flat ramp, >0 = banked chute walls) */
  readonly railHeight?: number;
  readonly railThickness?: number;
}

/**
 * Swept track segment connecting local point `start` to `end` with flat-top deck width,
 * vertical slab thickness, and optional raised side rails.
 */
export interface SweptTrackPrimitive extends SdfNodeBase {
  readonly kind: 'sweptTrack';
  readonly start: Vec3;
  readonly end: Vec3;
  readonly halfWidth: number;
  readonly thickness: number;
  readonly railHeight?: number;
  readonly railThickness?: number;
}

/**
 * Classic Marble Madness sinusoidal wave floor (`waveFloor`) whose top surface
 * undulates continuously in space and time.
 */
export interface WaveFloorPrimitive extends SdfNodeBase {
  readonly kind: 'waveFloor';
  readonly halfExtents: Vec3;
  readonly waveAmplitude: number;
  readonly waveFrequencyX: number;
  readonly waveFrequencyZ: number;
  readonly waveSpeed: number;
}

/**
 * Heavy industrial SDF piston/hammer block with beveled head and stem.
 */
export interface PistonPrimitive extends SdfNodeBase {
  readonly kind: 'piston';
  readonly headHalfExtents: Vec3;
  readonly bevelRadius: number;
}

export type SdfPrimitiveNode =
  | BoxPrimitive
  | RoundedBoxPrimitive
  | SpherePrimitive
  | CylinderPrimitive
  | CapsulePrimitive
  | TorusPrimitive
  | RampPrimitive
  | SweptTrackPrimitive
  | WaveFloorPrimitive
  | PistonPrimitive;

export interface SdfCsgNode {
  readonly id?: string;
  readonly kind: SdfCsgOpKind;
  readonly smoothRadius?: number;
  readonly children: readonly SdfNode[];
}

export type SdfNode = SdfPrimitiveNode | SdfCsgNode;

export interface SdfSample {
  readonly distance: number;
  readonly material: SurfaceMaterial;
  readonly materialId: number;
  readonly nodeId?: string;
  readonly kinematicVelocity: Vec3;
  readonly conveyorVelocity: Vec3;
}

export interface SdfContactQuery {
  readonly distance: number;
  readonly normal: Vec3;
  readonly material: SurfaceMaterial;
  readonly materialId: number;
  readonly contactPoint: Vec3;
  readonly surfaceVelocity: Vec3;
}

export interface SphereCastHit {
  readonly hit: boolean;
  readonly toi: number; // fraction [0..1] of displacement
  readonly distanceTravelled: number;
  readonly hitPoint: Vec3;
  readonly normal: Vec3;
  readonly material: SurfaceMaterial;
}

export interface CpuWorldEvaluator {
  /** Evaluate signed distance, material, and surface velocity at world point `p` and simulation time `time` */
  sample(p: Vec3, time: number): SdfSample;
  /** Fast signed distance query at world point `p` and simulation time `time` */
  distance(p: Vec3, time: number): number;
  /** Compute seam-biased surface normal at `p` and simulation time `time` */
  normal(p: Vec3, time: number): Vec3;
  /** Full contact evaluation for a sphere of `radius` centered at `center` */
  queryContact(center: Vec3, radius: number, time: number): SdfContactQuery;
  /** Continuous Collision Detection (CCD) 12-step sphere-cast along `displacement` */
  sphereCast(origin: Vec3, radius: number, displacement: Vec3, time: number, maxSteps?: number): SphereCastHit;
  /** Check if the line-of-sight from `cameraPos` to `marblePos` is occluded by world geometry */
  isOccluded(cameraPos: Vec3, marblePos: Vec3, marbleRadius: number, time: number): boolean;
}
