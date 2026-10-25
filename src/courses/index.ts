import type { CourseSpec } from '../contracts';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_1_RAMP_GAUNTLET,
} from './course-1-practice';
import { COURSE_2_BEGINNER_CHUTES } from './course-2-beginner';
import {
  COURSE_2_INTERMEDIATE_MADNESS,
  COURSE_3_INTERMEDIATE_MADNESS,
} from './course-3-intermediate';
import { COURSE_4_AERIAL_CATWALKS } from './course-4-aerial';
import { COURSE_5_SILLY_RACE } from './course-5-silly';
import { COURSE_6_ULTIMATE_ARGON_CORE } from './course-6-ultimate';
import { COURSE_7_SDF_SINGULARITY_LAB } from './course-7-singularity';
import { COURSE_8_RIPTIDE_SURF } from './course-8-riptide-surf';
import { COURSE_9_NEON_OBBY } from './course-9-neon-obby';
import { COURSE_10_SAHARA_DUNES } from './course-10-sahara-dunes';

export {
  COURSE_1_PRACTICE_RACE,
  COURSE_1_RAMP_GAUNTLET,
  COURSE_2_BEGINNER_CHUTES,
  COURSE_2_INTERMEDIATE_MADNESS,
  COURSE_3_INTERMEDIATE_MADNESS,
  COURSE_4_AERIAL_CATWALKS,
  COURSE_5_SILLY_RACE,
  COURSE_6_ULTIMATE_ARGON_CORE,
  COURSE_7_SDF_SINGULARITY_LAB,
  COURSE_8_RIPTIDE_SURF,
  COURSE_9_NEON_OBBY,
  COURSE_10_SAHARA_DUNES,
};

export const CLASSIC_COURSES: readonly CourseSpec[] = [
  COURSE_1_PRACTICE_RACE,
  COURSE_2_BEGINNER_CHUTES,
  COURSE_3_INTERMEDIATE_MADNESS,
  COURSE_4_AERIAL_CATWALKS,
  COURSE_5_SILLY_RACE,
  COURSE_6_ULTIMATE_ARGON_CORE,
];

export const BUILT_IN_COURSES: readonly CourseSpec[] = [
  ...CLASSIC_COURSES,
  COURSE_8_RIPTIDE_SURF,
  COURSE_9_NEON_OBBY,
  COURSE_10_SAHARA_DUNES,
];

export const ALL_PLAYABLE_COURSES: readonly CourseSpec[] = [
  ...CLASSIC_COURSES,
  COURSE_7_SDF_SINGULARITY_LAB,
  COURSE_8_RIPTIDE_SURF,
  COURSE_9_NEON_OBBY,
  COURSE_10_SAHARA_DUNES,
];

/**
 * Procedurally synthesize a custom `CourseSpec` for the Gemini 4 Argon 1M-Token
 * Course Architect hook panel (or validate an externally supplied `CourseSpec` JSON).
 */
export function generateArchitectCoursePreset(
  presetKind: 'spiral-citadel' | 'hyper-chute' | 'piston-reactor',
): CourseSpec {
  if (presetKind === 'spiral-citadel') {
    return {
      id: 'argon-spiral-citadel',
      index: 7,
      name: 'ARGON SPIRAL CITADEL',
      subtitle: 'AI ARCHITECT // 4-TIER HELIX // DUAL STEELIE ORBIT',
      difficulty: 'ARCHITECT',
      parTimeSec: 80,
      bonusTimeSec: 50,
      startPos: [0, 12.75, 0],
      goalPos: [0, 1.87, -28.0],
      goalRadius: 2.7,
      killPlaneY: -12.0,
      overviewCenter: [4.0, 5.0, -14.0],
      overviewRadius: 25.0,
      theme: {
        name: 'Argon Violet Synth',
        trackPrimary: [0.24, 0.14, 0.56],
        trackSecondary: [0.15, 0.09, 0.38],
        gridLineColor: [0.95, 0.38, 1.0],
        wallColor: [0.12, 0.06, 0.25],
        skyZenith: [0.03, 0.01, 0.08],
        skyHorizon: [0.18, 0.06, 0.32],
        abyssFogColor: [0.12, 0.04, 0.24],
        abyssFogDensity: 1.05,
        sunDirection: [0.55, 0.76, 0.34],
      },
      hazardManifest: [
        {
          id: 'helix-ice-turn',
          label: 'Helix Ice Banking',
          kind: 'ice',
          description: 'High-altitude ice corner requiring counter-steer drift.',
        },
        {
          id: 'citadel-pistons',
          label: 'Synchronized SDF Hammers',
          kind: 'piston',
          description: 'Alternating vertical SDF pistons guarding the lower bridge.',
        },
      ],
      nodes: [
        {
          id: 'sp-start',
          kind: 'roundedBox',
          material: 'start',
          center: [0, 11.6, 0],
          halfExtents: [3.5, 0.6, 3.5],
          radius: 0.14,
          supportBias: true,
        },
        {
          id: 'sp-ramp-1',
          kind: 'ramp',
          material: 'standard',
          center: [0, 9.8, -8.0],
          axis: 'z',
          halfLength: 4.8,
          rise: 4.8,
          halfWidth: 2.8,
          thickness: 1.0,
          railHeight: 0.8,
          supportBias: true,
        },
        {
          id: 'sp-ice-corner',
          kind: 'roundedBox',
          material: 'ice',
          center: [4.5, 6.8, -15.5],
          halfExtents: [5.5, 0.6, 3.5],
          radius: 0.14,
          supportBias: true,
        },
        {
          id: 'sp-ramp-2',
          kind: 'ramp',
          material: 'standard',
          center: [8.0, 4.6, -21.5],
          axis: 'z',
          halfLength: 3.8,
          rise: 5.6,
          halfWidth: 2.6,
          thickness: 1.0,
          railHeight: 0.85,
          supportBias: true,
        },
        {
          id: 'sp-wave-bridge',
          kind: 'waveFloor',
          material: 'standard',
          center: [4.0, 1.2, -28.0],
          halfExtents: [6.8, 0.6, 3.6],
          waveAmplitude: 0.35,
          waveFrequencyX: 0.85,
          waveFrequencyZ: 0.85,
          waveSpeed: 3.0,
          supportBias: true,
        },
        {
          id: 'sp-goal-pad',
          kind: 'cylinder',
          material: 'goal',
          center: [0, 1.35, -28.0],
          radius: 2.6,
          halfHeight: 0.52,
          supportBias: true,
        },
      ],
      hazards: [
        {
          id: 'sp-piston-a',
          kind: 'piston',
          material: 'bumper',
          center: [4.5, 3.8, -28.0],
          headHalfExtents: [1.0, 0.6, 0.9],
          bevelRadius: 0.12,
          kinematic: {
            kind: 'piston',
            axis: [0, -1, 0],
            stroke: 1.7,
            frequency: 0.7,
            phase: 0,
          },
        },
      ],
    };
  }

  if (presetKind === 'hyper-chute') {
    return COURSE_4_AERIAL_CATWALKS;
  }

  return COURSE_6_ULTIMATE_ARGON_CORE;
}
