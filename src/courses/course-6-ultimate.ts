/**
 * Course 6: ULTIMATE ARGON CORE (`src/courses/course-6-ultimate.ts`)
 *
 * The grand finale gauntlet combining every signature mechanic in lockstep CPU/GPU SDF:
 * - High-speed banked opening chute from the Argon Core apex
 * - Rhythmic industrial SDF piston battery
 * - Ice / Acid split paths (West Crystalline Ice Chute vs East Acid Reactor Core)
 * - Dual reciprocating moving bridges & wave surge deck
 * - Dramatic final leap across the reactor chasm to the Goal Podium framed by a Torus Halo
 */

import type { CourseSpec } from '../contracts';

export const COURSE_6_ULTIMATE_ARGON_CORE: CourseSpec = {
  id: 'ultimate-argon-core',
  index: 6,
  name: 'ULTIMATE ARGON CORE',
  subtitle: 'BANKED CHUTES // RHYTHMIC PISTONS // ICE-ACID SPLIT // FINAL LEAP',
  difficulty: 'ULTIMATE',
  parTimeSec: 60,
  bonusTimeSec: 20,
  startPos: [0, 15.55, 0],
  goalPos: [0, 3.22, -59.2],
  goalRadius: 2.75,
  killPlaneY: -14.0,
  overviewCenter: [0, 8.0, -30.0],
  overviewRadius: 34.0,
  theme: {
    name: 'Argon Quantum Core',
    trackPrimary: [0.14, 0.1, 0.34],
    trackSecondary: [0.08, 0.05, 0.22],
    gridLineColor: [0.35, 0.96, 1.0],
    wallColor: [0.22, 0.08, 0.38],
    skyZenith: [0.01, 0.01, 0.05],
    skyHorizon: [0.16, 0.04, 0.28],
    abyssFogColor: [0.1, 0.03, 0.2],
    abyssFogDensity: 1.15,
    sunDirection: [0.52, 0.78, 0.34],
  },
  checkpoints: [
    {
      id: 'cp-piston-gauntlet',
      label: 'PISTON REACTOR DECK',
      position: [0, 10.75, -16.0],
      radius: 4.5,
    },
    {
      id: 'cp-reactor-bridge',
      label: 'CONVERGENCE BRIDGE HEAD',
      position: [0, 6.75, -41.4],
      radius: 4.5,
    },
  ],
  hazardManifest: [
    {
      id: 'high-speed-banked-chute',
      label: 'High-Speed Banked Chutes',
      kind: 'conveyor',
      description: 'Steep turbo-boosted banked chutes descending from the 15.5m Argon Spire.',
    },
    {
      id: 'rhythmic-piston-battery',
      label: 'Rhythmic SDF Piston Battery',
      kind: 'piston',
      description: 'Three phase-staggered industrial SDF smashers guarding the upper reactor deck.',
    },
    {
      id: 'ice-acid-split-paths',
      label: 'Ice / Acid Split Paths',
      kind: 'ice',
      description: 'Forked descent: West low-friction Ice Chute vs East Acid Core rim.',
    },
    {
      id: 'moving-bridges-final-leap',
      label: 'Moving Bridges & Final Leap',
      kind: 'bridge',
      description: 'Counter-oscillating bridges and a conveyor-boosted final leap to the Goal Podium.',
    },
  ],
  nodes: [
    // --- TIER 1: ARGON CORE APEX PODIUM (yTop = 15.0) ---
    {
      id: 'c6-start-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 14.4, 0],
      halfExtents: [3.8, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c6-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 14.5, 0],
      radius: 2.2,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c6-apex-pillar',
      kind: 'box',
      material: 'standard',
      center: [0, 4.5, 0],
      halfExtents: [2.6, 9.2, 2.6],
    },

    // --- SECTION 1: HIGH-SPEED BANKED CHUTE (-Z, yTop: 15.0 -> 10.2) ---
    {
      id: 'c6-opening-banked-chute',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 12.6, -8.8],
      axis: 'z',
      halfLength: 5.6,
      rise: 4.8,
      halfWidth: 2.8,
      thickness: 1.1,
      railHeight: 1.1,
      railThickness: 0.36,
      conveyorDirection: [0, -2.0, -6.8],
      supportBias: true,
    },

    // --- TIER 2: RHYTHMIC PISTON GAUNTLET DECK (yTop = 10.2) ---
    {
      id: 'c6-piston-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.6, -20.4],
      halfExtents: [4.2, 0.6, 6.4],
      radius: 0.14,
      supportBias: true,
    },

    // --- SECTION 2: ICE / ACID SPLIT PATHS (-Z, z = -26.4 to -38.4, yTop: 10.2 -> 6.2) ---
    // West Path: High-speed Ice Chute
    {
      id: 'c6-ice-split-ramp',
      kind: 'ramp',
      material: 'ice',
      center: [-2.8, 8.2, -32.4],
      axis: 'z',
      halfLength: 6.0,
      rise: 4.0,
      halfWidth: 2.0,
      thickness: 1.0,
      railHeight: 0.65,
      railThickness: 0.3,
      supportBias: true,
    },
    // East Path: Standard Track bordering the Acid Reactor Core
    {
      id: 'c6-east-split-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [2.8, 8.2, -32.4],
      axis: 'z',
      halfLength: 6.0,
      rise: 4.0,
      halfWidth: 2.0,
      thickness: 1.0,
      railHeight: 0.75,
      railThickness: 0.3,
      supportBias: true,
    },
    // Central Acid Reactor Core trench between the split paths
    {
      id: 'c6-acid-core-pool',
      kind: 'roundedBox',
      material: 'acid',
      center: [0, 6.8, -32.4],
      halfExtents: [0.95, 0.45, 4.6],
      radius: 0.08,
    },

    // --- TIER 3: CONVERGENCE PLAZA & WAVE SURGE DECK (yTop = 6.2) ---
    {
      id: 'c6-convergence-plaza',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.6, -41.4],
      halfExtents: [5.4, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c6-wave-reactor-pad',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.6, -46.8],
      halfExtents: [3.2, 0.6, 2.4],
      waveAmplitude: 0.24,
      waveFrequencyX: 0.9,
      waveFrequencyZ: 0.9,
      waveSpeed: 2.8,
      supportBias: true,
    },

    // --- SECTION 3: DRAMATIC FINAL LEAP TO GOAL PODIUM (z = -48.8 to -55.6, yTop: 6.2 -> 3.2) ---
    {
      id: 'c6-final-leap-ramp',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 4.7, -52.2],
      axis: 'z',
      halfLength: 3.6,
      rise: 3.0,
      halfWidth: 2.2,
      thickness: 0.95,
      railHeight: 0.55,
      railThickness: 0.28,
      conveyorDirection: [0, -1.5, -8.5],
      supportBias: true,
    },
    {
      id: 'c6-final-leap-kicker',
      kind: 'cylinder',
      material: 'bounce',
      center: [-2.6, 4.85, -51.8],
      radius: 1.15,
      halfHeight: 0.48,
    },

    // --- TIER 4: ULTIMATE ARGON CORE GOAL PODIUM (yTop = 3.2) ---
    {
      id: 'c6-goal-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 2.6, -59.2],
      halfExtents: [5.2, 0.6, 4.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c6-goal-podium-pillar',
      kind: 'box',
      material: 'standard',
      center: [0, -4.0, -59.2],
      halfExtents: [3.8, 6.0, 3.4],
    },
    {
      id: 'c6-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 2.7, -59.2],
      radius: 2.75,
      halfHeight: 0.52,
      supportBias: true,
    },
    {
      id: 'c6-argon-core-arch-torus',
      kind: 'torus',
      material: 'standard',
      center: [0, 6.4, -62.4],
      majorRadius: 3.8,
      minorRadius: 0.34,
    },
  ],
  hazards: [
    // Rhythmic SDF Piston Battery
    {
      id: 'c6-piston-1',
      kind: 'piston',
      material: 'bumper',
      center: [-1.4, 13.0, -19.2],
      headHalfExtents: [1.1, 0.65, 0.8],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.85,
        frequency: 0.72,
        phase: 0.0,
        slamSharpness: 2.4,
      },
    },
    {
      id: 'c6-piston-2',
      kind: 'piston',
      material: 'bumper',
      center: [1.4, 13.0, -21.6],
      headHalfExtents: [1.1, 0.65, 0.8],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.85,
        frequency: 0.72,
        phase: 1.57,
        slamSharpness: 2.4,
      },
    },
    {
      id: 'c6-piston-3',
      kind: 'piston',
      material: 'bumper',
      center: [-1.4, 13.0, -24.0],
      headHalfExtents: [1.1, 0.65, 0.8],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.85,
        frequency: 0.72,
        phase: 3.14,
        slamSharpness: 2.4,
      },
    },
    // Moving Bridges flanking the Final Leap
    {
      id: 'c6-moving-bridge-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-2.4, 5.6, -49.0],
      halfExtents: [1.7, 0.55, 2.4],
      radius: 0.1,
      supportBias: true,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 1.6,
        frequency: 0.36,
        phase: 0.0,
      },
    },
    {
      id: 'c6-moving-bridge-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [2.4, 5.6, -49.0],
      halfExtents: [1.7, 0.55, 2.4],
      radius: 0.1,
      supportBias: true,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 1.6,
        frequency: 0.36,
        phase: 3.14,
      },
    },
    // Patrolling Steelie on the Convergence Plaza
    {
      id: 'c6-convergence-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [0, 6.85, -41.4],
      radius: 0.64,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [3.2, 0.0, 0.0],
        frequency: 0.48,
        phase: 0.6,
      },
    },
  ],
};
