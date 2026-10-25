/**
 * Course 2: INTERMEDIATE MADNESS (`src/courses/course-2-intermediate.ts`)
 *
 * Features all classic Marble Madness mid-game hazards in lockstep CPU/GPU SDF:
 * - Conveyor belt launch chute
 * - Low-friction Ice Slick plaza with orbiting Steelie sentinel & arcade bumper pins
 * - Industrial SDF Piston/Hammer gauntlet (time-driven slam wave with velocity transfer)
 * - Live undulating sinusoidal Wave Floor (`waveFloor` primitive)
 * - Bubbling Acid Pool hazard (`material: 'acid'`) with moving kinematic bridge & bounce shortcut
 * - Tight final catwalk to the elevated Goal Podium
 */

import type { CourseSpec } from '../contracts';

export const COURSE_2_INTERMEDIATE_MADNESS: CourseSpec = {
  id: 'intermediate-madness',
  index: 2,
  name: 'INTERMEDIATE MADNESS',
  subtitle: 'ICE SLICKS // SDF PISTONS // WAVE FLOOR // ACID MOAT',
  difficulty: 'INTERMEDIATE',
  parTimeSec: 75,
  bonusTimeSec: 45,
  startPos: [0, 11.38, 0],
  goalPos: [22.0, 2.28, -38.0],
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
      position: [0, 7.6, -13.5],
      radius: 4.5,
    },
    {
      id: 'cp-wave-deck',
      label: 'UNDULATING WAVE DECK',
      position: [11.0, 4.8, -26.0],
      radius: 4.5,
    },
  ],
  hazardManifest: [
    {
      id: 'ice-slick-plaza',
      label: 'Crystalline Ice Slick',
      kind: 'ice',
      description: 'Ultra-low friction (0.12) ice deck guarded by an orbiting Steelie sphere.',
    },
    {
      id: 'sdf-piston-gauntlet',
      label: 'SDF Slamming Pistons',
      kind: 'piston',
      description: 'Three time-driven industrial SDF hammers with analytical velocity impulse.',
    },
    {
      id: 'sinusoidal-wave-floor',
      label: 'Sinusoidal Wave Floor',
      kind: 'waveFloor',
      description: 'Live time-undulating SDF floor slab that heaves the marble vertically.',
    },
    {
      id: 'toxic-acid-moat',
      label: 'Acid Hazard & Moving Bridge',
      kind: 'acid',
      description: 'Lethal caustic acid basin crossed via reciprocating bridge or bounce pad.',
    },
  ],
  nodes: [
    // --- TIER 1: LAUNCH PODIUM & CONVEYOR RAMP ---
    {
      id: 'c2-start-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 10.2, 0.2],
      halfExtents: [3.6, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 10.32, 0],
      radius: 2.1,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c2-conveyor-ramp',
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

    // --- TIER 2: CRYSTALLINE ICE SLICK PLAZA ---
    {
      id: 'c2-ice-plaza',
      kind: 'roundedBox',
      material: 'ice',
      center: [0, 6.2, -15.0],
      halfExtents: [5.4, 0.6, 4.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2-ice-plaza-south-lip',
      kind: 'roundedBox',
      material: 'standard',
      center: [-2.4, 7.1, -19.1],
      halfExtents: [3.0, 0.4, 0.35],
      radius: 0.08,
    },

    // --- TIER 3: SDF PISTON GAUNTLET CATWALK (-Z) ---
    {
      id: 'c2-piston-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [2.4, 5.3, -22.4],
      axis: 'z',
      halfLength: 3.4,
      rise: 3.0,
      halfWidth: 2.5,
      thickness: 1.0,
      railHeight: 0.5,
      railThickness: 0.3,
      supportBias: true,
    },
    {
      id: 'c2-piston-landing',
      kind: 'roundedBox',
      material: 'standard',
      center: [4.2, 3.2, -26.8],
      halfExtents: [3.4, 0.6, 2.6],
      radius: 0.12,
      supportBias: true,
    },

    // --- SPEEDRUN SHORTCUT: HIGH-RISK ICE-TO-WAVE SKY RAIL ---
    // Skilled players who drift the eastern rim of the Ice Slick Plaza can thread
    // this narrow railless conveyor sky-beam directly onto the Wave Floor, skipping the Pistons!
    {
      id: 'c2-speedrun-sky-rail',
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

    // --- TIER 4: SINUSOIDAL WAVE FLOOR (+X) ---
    {
      id: 'c2-wave-floor',
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

    // --- TIER 5: ACID BASIN & BOUNCE LAUNCHER ---
    {
      id: 'c2-acid-bridge-staging',
      kind: 'roundedBox',
      material: 'standard',
      center: [19.8, 3.2, -26.8],
      halfExtents: [3.2, 0.6, 3.2],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c2-bounce-shortcut',
      kind: 'cylinder',
      material: 'bounce',
      center: [18.5, 3.35, -28.8],
      radius: 1.1,
      halfHeight: 0.48,
    },
    // Bubbling Acid Moat below the gap between z = -29.8 and z = -34.5
    {
      id: 'c2-acid-basin-floor',
      kind: 'roundedBox',
      material: 'acid',
      center: [21.0, 0.2, -32.2],
      halfExtents: [5.5, 0.45, 3.2],
      radius: 0.1,
    },

    // --- TIER 6: FINAL CATWALK & GOAL PODIUM ---
    {
      id: 'c2-goal-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.0, 1.6, -38.0],
      halfExtents: [4.8, 0.6, 4.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c2-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [22.0, 1.75, -38.0],
      radius: 2.6,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    // Bumper pins on the Ice Slick Plaza
    {
      id: 'c2-ice-bumper-left',
      kind: 'cylinder',
      material: 'bumper',
      center: [-2.2, 7.3, -14.2],
      radius: 0.6,
      halfHeight: 0.55,
    },
    {
      id: 'c2-ice-bumper-right',
      kind: 'cylinder',
      material: 'bumper',
      center: [2.4, 7.3, -16.0],
      radius: 0.6,
      halfHeight: 0.55,
    },
    // Orbiting Steelie sphere on the Ice Plaza
    {
      id: 'c2-ice-orbit-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [0, 7.45, -15.0],
      radius: 0.65,
      kinematic: {
        kind: 'steelie',
        mode: 'orbit',
        span: [2.2, 0.0, 1.8],
        frequency: 0.38,
        phase: 0.5,
      },
    },
    // Slamming Industrial SDF Pistons over the Ramp/Landing
    {
      id: 'c2-piston-1',
      kind: 'piston',
      material: 'bumper',
      center: [2.4, 8.2, -21.2],
      headHalfExtents: [1.1, 0.65, 0.75],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.85,
        frequency: 0.65,
        phase: 0.0,
        slamSharpness: 2.4,
      },
    },
    {
      id: 'c2-piston-2',
      kind: 'piston',
      material: 'bumper',
      center: [2.4, 6.9, -23.8],
      headHalfExtents: [1.1, 0.65, 0.75],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.85,
        frequency: 0.65,
        phase: 2.1,
        slamSharpness: 2.4,
      },
    },
    // Reciprocating Kinematic Bridge across the Acid Moat
    {
      id: 'c2-acid-moving-bridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.0, 2.2, -32.0],
      halfExtents: [1.65, 0.45, 2.4],
      radius: 0.1,
      supportBias: true,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 2.4,
        frequency: 0.32,
        phase: 0.0,
      },
    },
  ],
};
