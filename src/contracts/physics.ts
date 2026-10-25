/**
 * Physics, Marble State, Input, and Camera contracts.
 */

import type { Quat, SurfaceMaterial, Vec3 } from './sdf';

export type MarbleLifecycleStatus =
  | 'racing'
  | 'goal'
  | 'shattered'
  | 'sunk'
  | 'fell';

export interface MarbleContactState {
  readonly grounded: boolean;
  readonly normal: Vec3;
  readonly distance: number;
  readonly contactPoint: Vec3;
  readonly surfaceVelocity: Vec3;
  readonly impactSpeed: number;
  readonly wallContact: boolean;
}

export interface MarbleState {
  /** World-space center position of the marble */
  readonly position: Vec3;
  /** Previous physics step position (for 120 Hz render interpolation) */
  readonly prevPosition: Vec3;
  /** World-space linear velocity (units/sec) */
  readonly velocity: Vec3;
  /** World-space angular velocity vector (rad/sec) */
  readonly angularVelocity: Vec3;
  /** Unit quaternion `[x, y, z, w]` tracking cumulative rolling rotation for internal shader veins */
  readonly orientation: Quat;
  /** Previous physics step orientation (for 120 Hz slerp interpolation) */
  readonly prevOrientation: Quat;
  /** Radius of the marble sphere */
  readonly radius: number;
  /** Most recent surface contact details */
  readonly contact: MarbleContactState;
  /** Active surface material underneath or last touched by the marble */
  readonly surfaceMaterial: SurfaceMaterial;
  /** Current lifecycle state */
  readonly status: MarbleLifecycleStatus;
  /** Seconds spent in current non-racing status (for shatter/sink/respawn animations) */
  readonly statusTimer: number;
  /** Continuous time spent airborne (seconds) */
  readonly airTime: number;
  /** Peak vertical speed or height delta before impact (for high-fall shatter detection) */
  readonly peakFallSpeed: number;
  /** Coyote time grace timer allowing hops shortly after leaving a ledge */
  readonly coyoteTimer: number;
  /** Buffered jump input timer */
  readonly jumpBufferTimer: number;
  /** Cooldown before next jump impulse */
  readonly jumpCooldown: number;
  /** Active checkpoint respawn position */
  readonly respawnPos: Vec3;
  /** Selected visual marble shader preset index */
  readonly marblePresetIndex: number;
}

export interface MarbleVisualPreset {
  readonly id: string;
  readonly name: string;
  readonly baseColor: Vec3;
  readonly veinColor: Vec3;
  readonly coreGlowColor: Vec3;
  readonly iridescence: number;
  readonly subsurfaceStrength: number;
}

export const MARBLE_VISUAL_PRESETS: readonly MarbleVisualPreset[] = [
  {
    id: 'cobalt-arcade',
    name: 'Cobalt Arcade',
    baseColor: [0.08, 0.42, 0.96],
    veinColor: [0.35, 0.92, 1.0],
    coreGlowColor: [0.18, 0.65, 1.0],
    iridescence: 0.75,
    subsurfaceStrength: 0.85,
  },
  {
    id: 'crimson-flare',
    name: 'Crimson Flare',
    baseColor: [0.92, 0.12, 0.24],
    veinColor: [1.0, 0.78, 0.22],
    coreGlowColor: [1.0, 0.35, 0.15],
    iridescence: 0.65,
    subsurfaceStrength: 0.9,
  },
  {
    id: 'jade-matrix',
    name: 'Jade Matrix',
    baseColor: [0.06, 0.68, 0.44],
    veinColor: [0.58, 1.0, 0.76],
    coreGlowColor: [0.15, 0.95, 0.55],
    iridescence: 0.7,
    subsurfaceStrength: 0.88,
  },
  {
    id: 'hyper-gold',
    name: 'Hyper Gold',
    baseColor: [0.88, 0.58, 0.08],
    veinColor: [1.0, 0.96, 0.65],
    coreGlowColor: [1.0, 0.72, 0.18],
    iridescence: 0.9,
    subsurfaceStrength: 0.8,
  },
];

export interface PhysicsConfig {
  /** Fixed simulation timestep (`1 / 120` seconds) */
  readonly fixedDt: number;
  /** Max substeps per render frame to prevent spiral of death */
  readonly maxSubSteps: number;
  /** Marble sphere radius */
  readonly marbleRadius: number;
  /** Downward gravitational acceleration */
  readonly gravity: number;
  /** Player input roll acceleration on ground */
  readonly rollAcceleration: number;
  /** Multiplier on input acceleration while airborne */
  readonly airControl: number;
  /** Maximum horizontal ground speed before boost surfaces */
  readonly maxHorizontalSpeed: number;
  /** Downhill slope acceleration boost factor */
  readonly slopeBoost: number;
  /** Upward hop/jump velocity impulse */
  readonly jumpImpulse: number;
  /** Coyote time window in seconds */
  readonly coyoteTime: number;
  /** Jump input buffer window in seconds */
  readonly jumpBufferTime: number;
  /** Minimum normal Y component to count as support ground rather than wall (`0.38`) */
  readonly groundNormalThreshold: number;
  /** Downward impact speed threshold that shatters the marble on hard surfaces */
  readonly shatterImpactSpeed: number;
  /** Duration of shatter/sink/fell penalty before auto-respawn (seconds) */
  readonly respawnDelaySec: number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  fixedDt: 1 / 120,
  maxSubSteps: 8,
  marbleRadius: 0.55,
  gravity: 35.0,
  rollAcceleration: 34.0,
  airControl: 0.38,
  maxHorizontalSpeed: 23.5,
  slopeBoost: 18.0,
  jumpImpulse: 11.4,
  coyoteTime: 0.13,
  jumpBufferTime: 0.13,
  groundNormalThreshold: 0.38,
  shatterImpactSpeed: 31.0,
  respawnDelaySec: 1.25,
};

export interface InputCommand {
  /** World-projected XZ roll acceleration direction `[-1..1, -1..1]` */
  readonly moveXZ: readonly [number, number];
  /** True on frames when jump is pressed or buffered */
  readonly jumpPressed: boolean;
  /** True when manual respawn (`R`) is triggered */
  readonly respawnPressed: boolean;
}

export type CameraZoomStopId = 'isometric' | 'close' | 'overview';

export interface CameraZoomStopProfile {
  readonly id: CameraZoomStopId;
  readonly label: string;
  readonly distance: number;
  /** Pitch angle above horizon in degrees */
  readonly pitchDeg: number;
  /** Vertical field of view in degrees */
  readonly fovDeg: number;
  /** Velocity look-ahead multiplier */
  readonly lookAhead: number;
  /** 0 = follow marble, 1 = anchor to course overview center */
  readonly overviewBlend: number;
}

export interface CameraState {
  readonly position: Vec3;
  readonly target: Vec3;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
  readonly fovDeg: number;
  readonly yawDeg: number;
  readonly pitchDeg: number;
  readonly distance: number;
  readonly zoomStopIndex: number;
  readonly zoomStopId: CameraZoomStopId;
  readonly zoomStopLabel: string;
  /** Smoothly ramped [0..1] strength of the camera-to-marble occlusion reveal capsule cutout */
  readonly occlusionCutoutStrength: number;
}
