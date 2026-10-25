/**
 * Course 3: INTERMEDIATE MADNESS (`src/courses/course-3-intermediate.ts`)
 *
 * Mid-campaign skill test combining classic Marble Madness hazards:
 * - Ice slicks with patrolling & orbiting Black Steelie marbles
 * - Slamming industrial SDF pistons/hammers with velocity transfer
 * - Undulating sinusoidal wave floor that you can pump to jump an acid gap
 * - Tight catwalks & speedrun sky-rail shortcut leading to the Goal Podium
 */

import type { CourseSpec } from '../contracts';

export const COURSE_3_INTERMEDIATE_MADNESS: CourseSpec = {
  id: 'intermediate-madness',
  index: 3,
  name: 'INTERMEDIATE MADNESS',
  subtitle: 'ICE SLICK STEELIES // SLAMMING PISTONS // WAVE-PUMP ACID JUMP',
  difficulty: 'INTERMEDIATE',
  parTimeSec: 55,
  bonusTimeSec: 35,
  startPos: [0, 11.35, 0],
  goalPos: [22.0, 2.22, -38.0],
  goalRadius: 2.6,
  killPlaneY: -12.0,
  overviewCenter: [11.0, 5.0, -20.0],
  overviewRadius: 29.0,
  theme: {
    name: 'Cyber Emerald & Magma Grid',
    trackPrimary: [0.11, 0.28, 0.38],
    trackSecondary: [0.07, 0.19, 0.28],
    gridLineColor: [0.25, 0.98, 0.78],
    wallColor: [0.09, 0.14, 0.24],
    skyZenith: [0.03, 0.02, 0.09],
    skyHorizon: [0.12, 0.08, 0.26],
    abyssFogColor: [0.06, 0.16, 0.22],
    abyssFogDensity: 1.15,
    sunDirection: [0.48, 0.81, 0.33],
  },
  checkpoints: [
    {
      id: 'cp-ice-plaza',
      label: 'ICE SLICK PLAZA',
      position: [0, 7.35, -15.0],
      radius: 4.5,
    },
    {
      id: 'cp-wave-deck',
      label: 'UNDULATING WAVE DECK',
      position: [4.2, 4.35, -26.8],
      radius: 4.5,
    },
  ],
  hazardManifest: [
    {
      id: 'ice-slick-plaza',
      label: 'Crystalline Ice Slick & Steelies',
      kind: 'ice',
      description: 'Low-friction (0.12) ice deck patrolled by Black Steelie marbles.',
    },
    {
      id: 'sdf-piston-gauntlet',
      label: 'Slamming SDF Pistons',
      kind: 'piston',
      description: 'Time-driven industrial SDF hammers with analytical velocity impulse.',
    },
    {
      id: 'sinusoidal-wave-floor',
      label: 'Pumpable Wave Floor',
      kind: 'waveFloor',
      description: 'Undulating SDF floor slab you can pump to launch across the acid gap.',
    },
    {
      id: 'toxic-acid-moat',
      label: 'Acid Gap & Tight Catwalks',
      kind: 'acid',
      description: 'Corrosive acid moat crossed via wave-pump jump, tight catwalk, or moving bridge.',
    },
  ],
  nodes: [
    // --- TIER 1: LAUNCH PODIUM & CONVEYOR RAMP (yTop = 10.8) ---
    {
      id: 'c3-start-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 10.2, 0.2],
      halfExtents: [3.6, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c3-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 10.3, 0],
      radius: 2.1,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c3-conveyor-ramp',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 8.8, -7.2],
      axis: 'z',
      halfLength: 4.0,
      rise: 4.0,
      halfWidth: 2.6,
      thickness: 1.0,
      railHeight: 0.65,
      railThickness: 0.32,
      conveyorDirection: [0, -1.2, -5.5],
      supportBias: true,
    },

    // --- TIER 2: CRYSTALLINE ICE SLICK PLAZA (yTop = 6.8) ---
    {
      id: 'c3-ice-plaza',
      kind: 'roundedBox',
      material: 'ice',
      center: [0, 6.2, -15.0],
      halfExtents: [5.4, 0.6, 4.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c3-ice-plaza-south-lip',
      kind: 'roundedBox',
      material: 'standard',
      center: [-3.5, 7.1, -19.1],
      halfExtents: [1.9, 0.4, 0.35],
      radius: 0.08,
    },
    {
      id: 'c3-ice-plaza-east-curb',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.15, 7.1, -14.2],
      halfExtents: [0.3, 0.4, 3.2],
      radius: 0.08,
    },

    // --- TIER 3: SDF PISTON GAUNTLET CATWALK (-Z, yTop: 6.8 -> 3.8) ---
    {
      id: 'c3-piston-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [1.6, 5.3, -22.4],
      axis: 'z',
      halfLength: 3.4,
      rise: 3.0,
      halfWidth: 3.0,
      thickness: 1.0,
      railHeight: 0.55,
      railThickness: 0.3,
      supportBias: true,
    },
    {
      id: 'c3-piston-landing',
      kind: 'roundedBox',
      material: 'standard',
      center: [3.6, 3.2, -26.8],
      halfExtents: [4.2, 0.6, 3.0],
      radius: 0.12,
      supportBias: true,
    },

    // --- SPEEDRUN SHORTCUT: HIGH-RISK ICE-TO-WAVE SKY RAIL ---
    {
      id: 'c3-speedrun-sky-rail',
      kind: 'sweptTrack',
      material: 'conveyor',
      center: [0, 0, 0],
      start: [4.8, 6.75, -18.2],
      end: [11.8, 3.85, -24.2],
      halfWidth: 1.15,
      thickness: 0.65,
      railHeight: 0.0,
      conveyorDirection: [5.5, -1.6, -4.8],
      supportBias: true,
    },

    // --- TIER 4: SINUSOIDAL WAVE FLOOR (+X, yTop ~= 3.8) ---
    {
      id: 'c3-wave-floor',
      kind: 'waveFloor',
      material: 'standard',
      center: [12.2, 3.2, -26.8],
      halfExtents: [4.8, 0.6, 3.2],
      waveAmplitude: 0.42,
      waveFrequencyX: 0.95,
      waveFrequencyZ: 0.95,
      waveSpeed: 2.8,
      supportBias: true,
    },

    // --- TIER 5: ACID GAP, WAVE-PUMP BOUNCE LAUNCHER & TIGHT CATWALK ---
    {
      id: 'c3-acid-bridge-staging',
      kind: 'roundedBox',
      material: 'standard',
      center: [19.8, 3.2, -26.8],
      halfExtents: [3.2, 0.6, 3.2],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c3-bounce-shortcut',
      kind: 'cylinder',
      material: 'bounce',
      center: [18.8, 3.35, -29.2],
      radius: 1.15,
      halfHeight: 0.48,
    },
    // Tight catwalk descending across the acid gap (z = -29.6 to -34.0, yTop: 3.8 -> 2.2)
    {
      id: 'c3-tight-catwalk',
      kind: 'ramp',
      material: 'standard',
      center: [21.6, 3.0, -31.8],
      axis: 'z',
      halfLength: 2.4,
      rise: 1.6,
      halfWidth: 1.5,
      thickness: 0.85,
      railHeight: 0.0,
      supportBias: true,
    },
    // Bubbling Acid Moat below the gap
    {
      id: 'c3-acid-basin-floor',
      kind: 'roundedBox',
      material: 'acid',
      center: [20.5, 0.2, -32.2],
      halfExtents: [5.5, 0.45, 3.2],
      radius: 0.1,
    },

    // --- TIER 6: GOAL PODIUM (yTop = 2.2) ---
    {
      id: 'c3-goal-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.0, 1.6, -38.0],
      halfExtents: [4.8, 0.6, 4.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c3-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [22.0, 1.7, -38.0],
      radius: 2.6,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    // Bumper pins on the Ice Slick Plaza
    {
      id: 'c3-ice-bumper-left',
      kind: 'cylinder',
      material: 'bumper',
      center: [-2.4, 7.3, -14.2],
      radius: 0.6,
      halfHeight: 0.55,
    },
    {
      id: 'c3-ice-bumper-right',
      kind: 'cylinder',
      material: 'bumper',
      center: [3.6, 7.3, -13.6],
      radius: 0.6,
      halfHeight: 0.55,
    },
    // Patrolling & Orbiting Black Steelie spheres on the Ice Plaza
    {
      id: 'c3-ice-orbit-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [-1.4, 7.45, -14.5],
      radius: 0.65,
      kinematic: {
        kind: 'steelie',
        mode: 'orbit',
        span: [1.6, 0.0, 1.4],
        frequency: 0.38,
        phase: 0.5,
      },
    },
    {
      id: 'c3-ice-patrol-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [-2.0, 7.45, -17.6],
      radius: 0.62,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [1.8, 0.0, 0.0],
        frequency: 0.44,
        phase: 1.2,
      },
    },
    // Slamming Industrial SDF Pistons over the Ramp/Landing (staggered West/East)
    {
      id: 'c3-piston-1',
      kind: 'piston',
      material: 'bumper',
      center: [0.4, 8.5, -21.2],
      headHalfExtents: [0.85, 0.65, 0.75],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.75,
        frequency: 0.65,
        phase: 0.0,
        slamSharpness: 2.4,
      },
    },
    {
      id: 'c3-piston-2',
      kind: 'piston',
      material: 'bumper',
      center: [2.8, 7.2, -23.8],
      headHalfExtents: [0.85, 0.65, 0.75],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.75,
        frequency: 0.65,
        phase: 2.1,
        slamSharpness: 2.4,
      },
    },
    // Reciprocating Kinematic Bridge across the Acid Moat
    {
      id: 'c3-acid-moving-bridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [19.2, 2.5, -32.0],
      halfExtents: [1.65, 0.45, 2.4],
      radius: 0.1,
      supportBias: true,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 2.0,
        frequency: 0.32,
        phase: 0.0,
      },
    },
  ],
};

export const COURSE_2_INTERMEDIATE_MADNESS = COURSE_3_INTERMEDIATE_MADNESS;
