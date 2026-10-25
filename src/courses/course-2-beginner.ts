/**
 * Course 2: BEGINNER CHUTES (`src/courses/course-2-beginner.ts`)
 *
 * Introduces split risk/reward routing and dynamic surface mechanics:
 * - Twin parallel chutes from the upper terrace:
 *   - West Safe Guarded Chute (wide deck, tall containment rails)
 *   - East Narrow High-Banked Turbo Chute (conveyor boost + bounce jump kicker)
 * - First moving bridge over a bubbling caustic acid trench
 * - Gentle sinusoidal wave floor leading to the Goal Podium
 */

import type { CourseSpec } from '../contracts';

export const COURSE_2_BEGINNER_CHUTES: CourseSpec = {
  id: 'beginner-chutes',
  index: 2,
  name: 'BEGINNER CHUTES',
  subtitle: 'TWIN PARALLEL CHUTES // MOVING ACID BRIDGE // GENTLE WAVE FLOOR',
  difficulty: 'PRACTICE',
  parTimeSec: 65,
  bonusTimeSec: 65,
  startPos: [0, 10.55, 0],
  goalPos: [0, 3.22, -48.2],
  goalRadius: 2.6,
  killPlaneY: -10.0,
  overviewCenter: [0, 5.5, -24.0],
  overviewRadius: 28.0,
  theme: {
    name: 'Arcade Teal & Coral',
    trackPrimary: [0.12, 0.42, 0.52],
    trackSecondary: [0.08, 0.28, 0.38],
    gridLineColor: [0.38, 1.0, 0.86],
    wallColor: [0.07, 0.18, 0.26],
    skyZenith: [0.02, 0.05, 0.1],
    skyHorizon: [0.08, 0.22, 0.32],
    abyssFogColor: [0.04, 0.15, 0.22],
    abyssFogDensity: 1.0,
    sunDirection: [0.5, 0.8, 0.33],
  },
  checkpoints: [
    {
      id: 'cp-chute-confluence',
      label: 'CHUTE CONFLUENCE PLAZA',
      position: [-1.5, 6.15, -19.6],
      radius: 4.5,
    },
    {
      id: 'cp-wave-terrace',
      label: 'WAVE FLOOR APPROACH',
      position: [0, 6.15, -31.2],
      radius: 4.2,
    },
  ],
  portals: [
    {
      id: 'beginner-acid-vault-portal',
      posA: [2.8, 6.2, -18.5],
      normalA: [0.0, 0.34, 0.9404],
      upA: [0.0, 0.9404, -0.34],
      posB: [2.5, 6.55, -31.8],
      normalB: [-0.15, 0.691, -0.7071],
      upB: [-0.15, 0.7071, 0.691],
      radius: 1.55,
      activeA: true,
      activeB: true,
      flingBoost: 1.25,
    },
  ],
  hazardManifest: [
    {
      id: 'twin-parallel-chutes',
      label: 'Twin Parallel Chutes',
      kind: 'conveyor',
      description: 'Choose between the West Safe Guarded Chute or East Narrow High-Banked Turbo Chute.',
    },
    {
      id: 'acid-trench-bridge',
      label: 'Moving Bridge & Acid Trench',
      kind: 'bridge',
      description: 'Reciprocating kinematic bridge spanning the first corrosive green acid trench.',
    },
    {
      id: 'gentle-wave-floor',
      label: 'Gentle Wave Floor',
      kind: 'waveFloor',
      description: 'Rhythmic sinusoidal floor swell teaching wave timing before the Goal Podium.',
    },
    {
      id: 'beginner-steelie',
      label: 'Terrace Steelie Sentinel',
      kind: 'steelie',
      description: 'Patrolling Black Steelie guarding the final approach ramp.',
    },
  ],
  nodes: [
    // --- TIER 1: UPPER SPLIT TERRACE (yTop = 10.0) ---
    {
      id: 'c2b-start-terrace',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, 0],
      halfExtents: [5.4, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2b-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 9.5, 0],
      radius: 2.2,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c2b-start-back-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 10.45, 3.35],
      halfExtents: [5.4, 0.45, 0.3],
      radius: 0.08,
    },
    {
      id: 'c2b-chute-splitter-wedge',
      kind: 'roundedBox',
      material: 'standard',
      center: [0.3, 10.45, -3.2],
      halfExtents: [0.45, 0.45, 0.65],
      radius: 0.1,
    },

    // --- TWIN PARALLEL CHUTE A (WEST): SAFE GUARDED CHUTE ---
    // Connects z = -3.4 (yTop = 10.0) down to z = -16.6 (yTop = 5.6)
    {
      id: 'c2b-safe-guarded-chute',
      kind: 'ramp',
      material: 'standard',
      center: [-2.4, 7.8, -10.0],
      axis: 'z',
      halfLength: 6.6,
      rise: 4.4,
      halfWidth: 2.35,
      thickness: 1.1,
      railHeight: 0.95,
      railThickness: 0.36,
      supportBias: true,
    },

    // --- TWIN PARALLEL CHUTE B (EAST): NARROW HIGH-BANKED TURBO CHUTE ---
    // High-speed conveyor boost chute with tall banked side walls
    {
      id: 'c2b-turbo-banked-chute',
      kind: 'ramp',
      material: 'conveyor',
      center: [2.8, 7.8, -10.0],
      axis: 'z',
      halfLength: 6.6,
      rise: 4.4,
      halfWidth: 1.55,
      thickness: 1.0,
      railHeight: 1.15,
      railThickness: 0.32,
      conveyorDirection: [0, -1.8, -7.2],
      supportBias: true,
    },

    // --- TIER 2: CONFLUENCE PLAZA (yTop = 5.6) ---
    {
      id: 'c2b-confluence-plaza',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -19.6],
      halfExtents: [5.4, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2b-turbo-vault-bounce',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.2, 5.12, -21.8],
      radius: 1.15,
      halfHeight: 0.5,
    },

    // --- TIER 3: ACID TRENCH & BRIDGE SPAN (z = -22.8 to -29.2, yTop = 5.6) ---
    {
      id: 'c2b-acid-trench-basin',
      kind: 'roundedBox',
      material: 'acid',
      center: [0, 2.8, -26.0],
      halfExtents: [5.8, 0.45, 3.2],
      radius: 0.1,
    },
    {
      id: 'c2b-west-bridge-spine',
      kind: 'roundedBox',
      material: 'standard',
      center: [-1.5, 5.0, -26.0],
      halfExtents: [2.15, 0.6, 3.4],
      radius: 0.1,
      supportBias: true,
    },

    // --- TIER 4: WAVE APPROACH TERRACE & GENTLE WAVE FLOOR (yTop = 5.6) ---
    {
      id: 'c2b-wave-approach-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -31.2],
      halfExtents: [4.8, 0.6, 2.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2b-gentle-wave-floor',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -36.8],
      halfExtents: [4.2, 0.6, 3.6],
      waveAmplitude: 0.24,
      waveFrequencyX: 0.75,
      waveFrequencyZ: 0.85,
      waveSpeed: 2.2,
      supportBias: true,
    },

    // --- FINAL RAMP TO GOAL PODIUM (z = -40.0 to -44.8, yTop: 5.6 -> 3.2) ---
    {
      id: 'c2b-final-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [0, 4.4, -42.4],
      axis: 'z',
      halfLength: 2.6,
      rise: 2.4,
      halfWidth: 3.4,
      thickness: 1.0,
      railHeight: 0.7,
      railThickness: 0.32,
      supportBias: true,
    },

    // --- TIER 5: GOAL PODIUM (yTop = 3.2) ---
    {
      id: 'c2b-goal-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 2.6, -48.2],
      halfExtents: [4.8, 0.6, 4.0],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c2b-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 2.7, -48.2],
      radius: 2.6,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    // First Moving Bridge oscillating across the Acid Trench
    {
      id: 'c2b-moving-acid-bridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [1.5, 5.0, -26.0],
      halfExtents: [2.1, 0.6, 3.2],
      radius: 0.1,
      supportBias: true,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 1.8,
        frequency: 0.35,
        phase: 0,
      },
    },
    {
      id: 'c2b-plaza-bumper',
      kind: 'cylinder',
      material: 'bumper',
      center: [0.6, 6.15, -19.2],
      radius: 0.58,
      halfHeight: 0.55,
    },
    {
      id: 'c2b-goal-patrol-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [0, 3.85, -45.6],
      radius: 0.62,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [2.8, 0, 0],
        frequency: 0.42,
        phase: 0.8,
      },
    },
  ],
};
