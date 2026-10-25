/**
 * Declarative Course Specification (`CourseSpec`) contract.
 *
 * Designed so parallel subagents and the Gemini 4 Argon 1M-token Course Architect
 * can author new levels purely as declarative data/modules without touching
 * rendering or physics engine internals.
 */

import type { SdfNode, SdfPrimitiveNode, Vec3 } from './sdf';

export interface CourseThemePalette {
  readonly name: string;
  /** Primary track fill RGB [0..1] */
  readonly trackPrimary: Vec3;
  /** Secondary checkerboard / tier accent RGB [0..1] */
  readonly trackSecondary: Vec3;
  /** High-contrast isometric gridline color RGB [0..1] */
  readonly gridLineColor: Vec3;
  /** Wall / cliffside face tint RGB [0..1] */
  readonly wallColor: Vec3;
  /** Deep abyss background zenith RGB [0..1] */
  readonly skyZenith: Vec3;
  /** Deep abyss background horizon RGB [0..1] */
  readonly skyHorizon: Vec3;
  /** Volumetric abyss fog color RGB [0..1] */
  readonly abyssFogColor: Vec3;
  /** Volumetric abyss fog density multiplier */
  readonly abyssFogDensity: number;
  /** Directional sun light direction (normalized world vector toward light) */
  readonly sunDirection: Vec3;
}

export interface CourseHazardSummary {
  readonly id: string;
  readonly label: string;
  readonly kind: 'piston' | 'ice' | 'waveFloor' | 'acid' | 'bumper' | 'steelie' | 'bridge' | 'conveyor';
  readonly description: string;
}

export interface CourseCheckpoint {
  readonly id: string;
  readonly label: string;
  readonly position: Vec3;
  readonly radius: number;
}

export interface CourseSpec {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly subtitle: string;
  readonly difficulty: 'PRACTICE' | 'INTERMEDIATE' | 'AERIAL' | 'ULTIMATE' | 'ARCHITECT';
  /** Base countdown timer on fresh start (seconds) */
  readonly parTimeSec: number;
  /** Bonus seconds added when transitioning from the previous course */
  readonly bonusTimeSec: number;
  /** World-space spawn position for the player marble center */
  readonly startPos: Vec3;
  /** World-space goal pad center */
  readonly goalPos: Vec3;
  /** Capture radius on the goal pad */
  readonly goalRadius: number;
  /** Y threshold below which the marble is declared out-of-bounds (`'fell'`) */
  readonly killPlaneY: number;
  /** Bounding box center used by the Tactical Overview camera stop */
  readonly overviewCenter: Vec3;
  /** Bounding radius used by the Tactical Overview camera stop */
  readonly overviewRadius: number;
  /** Visual theme & gridline palette */
  readonly theme: CourseThemePalette;
  /**
   * Declarative flat list of static and kinematic SDF primitive nodes.
   * Automatically unioned into the course CSG tree unless `scene` is explicitly supplied.
   */
  readonly nodes: readonly SdfPrimitiveNode[];
  /**
   * Optional explicit CSG tree (supports `union`, `smoothUnion`, `subtract`, `smoothSubtract`, `intersect`).
   * If omitted, `nodes` + `hazards` are unioned automatically.
   */
  readonly scene?: SdfNode;
  /**
   * Optional declarative list of dynamic/hazard primitive nodes (pistons, bridges, steelies, bumpers, acid pools)
   * unioned with the course geometry.
   */
  readonly hazards: readonly SdfPrimitiveNode[];
  /** Human-readable hazard callouts displayed in the Arcade HUD & Course Architect inspector */
  readonly hazardManifest: readonly CourseHazardSummary[];
  /** Optional intermediate respawn checkpoints */
  readonly checkpoints?: readonly CourseCheckpoint[];
}
