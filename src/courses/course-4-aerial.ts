/**
 * Course 4: AERIAL CATWALKS (`src/courses/course-4-aerial.ts`)
 *
 * High-altitude precision & acrobatics over the volumetric abyss:
 * - High-altitude suspended narrow ridges with soaring architectural monoliths
 * - Bounce-pad island hops across huge chasms
 * - Conveyor accelerators propelling the marble across skybridges
 * - Daring banked half-pipe jump shortcut vaulting straight to the Goal Spire
 */

import type { CourseSpec } from '../contracts';

export const COURSE_4_AERIAL_CATWALKS: CourseSpec = {
  id: 'aerial-catwalks',
  index: 4,
  name: 'AERIAL CATWALKS',
  subtitle: 'SUSPENDED RIDGES // BOUNCE ISLAND HOPS // HALF-PIPE SHORTCUT',
  difficulty: 'AERIAL',
  parTimeSec: 50,
  bonusTimeSec: 30,
  startPos: [0, 14.55, 0],
  goalPos: [19.2, 3.62, -39.2],
  goalRadius: 2.6,
  killPlaneY: -12.0,
  overviewCenter: [7.5, 8.0, -22.0],
  overviewRadius: 29.0,
  theme: {
    name: 'Stratosphere Sunset & Sky Gold',
    trackPrimary: [0.16, 0.32, 0.58],
    trackSecondary: [0.1, 0.21, 0.42],
    gridLineColor: [1.0, 0.82, 0.28],
    wallColor: [0.11, 0.15, 0.32],
    skyZenith: [0.04, 0.02, 0.14],
    skyHorizon: [0.36, 0.14, 0.3],
    abyssFogColor: [0.16, 0.07, 0.22],
    abyssFogDensity: 1.05,
    sunDirection: [0.58, 0.74, 0.34],
  },
  checkpoints: [
    {
      id: 'cp-sky-island-1',
      label: 'AERIAL BOUNCE HUB',
      position: [0, 10.55, -25.2],
      radius: 4.2,
    },
    {
      id: 'cp-sky-island-2',
      label: 'LOWER CATWALK JUNCTION',
      position: [1.5, 7.35, -39.2],
      radius: 4.2,
    },
  ],
  hazardManifest: [
    {
      id: 'suspended-narrow-ridges',
      label: 'Suspended Narrow Ridges',
      kind: 'conveyor',
      description: 'High-altitude unrailed ridges requiring precision trackball feathering.',
    },
    {
      id: 'bounce-island-hops',
      label: 'Bounce-Pad Island Hops',
      kind: 'bumper',
      description: 'Spring-loaded aerial stepping islands spanning deep stratosphere chasms.',
    },
    {
      id: 'conveyor-accelerators',
      label: 'Conveyor Sky Accelerators',
      kind: 'conveyor',
      description: 'High-velocity belt strips boosting the marble across long aerial spans.',
    },
    {
      id: 'banked-halfpipe-shortcut',
      label: 'Daring Banked Half-Pipe Shortcut',
      kind: 'conveyor',
      description: 'High-walled diagonal half-pipe chute & bounce kicker skipping the lower catwalks.',
    },
  ],
  nodes: [
    // --- TIER 1: CLOUD SPIRE LAUNCH PODIUM (yTop = 14.0) ---
    {
      id: 'c4-start-spire-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 13.4, 0],
      halfExtents: [3.6, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c4-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 13.5, 0],
      radius: 2.1,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c4-start-spire-pillar',
      kind: 'box',
      material: 'standard',
      center: [0, 4.0, 0],
      halfExtents: [2.4, 8.8, 2.4],
    },

    // --- SECTION 1: STEEP AERIAL DROP & SUSPENDED NARROW RIDGE (-Z, yTop: 14.0 -> 10.0) ---
    {
      id: 'c4-drop-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [0, 12.0, -7.4],
      axis: 'z',
      halfLength: 4.4,
      rise: 4.0,
      halfWidth: 2.4,
      thickness: 1.0,
      railHeight: 0.65,
      railThickness: 0.32,
      supportBias: true,
    },
    {
      id: 'c4-suspended-ridge-1',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, -16.8],
      halfExtents: [1.65, 0.6, 5.4],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'c4-ridge-conveyor-boost',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [0, 9.42, -19.0],
      halfExtents: [1.35, 0.6, 2.6],
      radius: 0.08,
      conveyorDirection: [0, 0, -7.2],
      supportBias: true,
    },

    // --- TIER 2: SKY ISLAND 1 — BOUNCE-PAD ISLAND HOP HUB (yTop = 10.0) ---
    {
      id: 'c4-sky-island-1',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, -25.2],
      halfExtents: [4.2, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c4-island-1-pillar',
      kind: 'box',
      material: 'standard',
      center: [0, 1.0, -25.2],
      halfExtents: [2.6, 7.8, 2.2],
    },
    {
      id: 'c4-island-1-bounce-launcher',
      kind: 'cylinder',
      material: 'bounce',
      center: [-2.0, 9.52, -27.2],
      radius: 1.2,
      halfHeight: 0.5,
    },

    // --- SECTION 2: BOUNCE-PAD ISLAND HOPS & CONVEYOR ACCELERATOR SPAN (yTop: 10.0 -> 6.8) ---
    {
      id: 'c4-bounce-hop-island-a',
      kind: 'roundedBox',
      material: 'bounce',
      center: [-2.4, 7.8, -32.2],
      halfExtents: [2.1, 0.55, 2.1],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c4-conveyor-accelerator-span',
      kind: 'ramp',
      material: 'conveyor',
      center: [1.2, 8.4, -32.2],
      axis: 'z',
      halfLength: 4.0,
      rise: 3.2,
      halfWidth: 1.8,
      thickness: 0.85,
      railHeight: 0.35,
      railThickness: 0.25,
      conveyorDirection: [0, -1.6, -7.5],
      supportBias: true,
    },

    // --- TIER 3: SKY ISLAND 2 & HALF-PIPE SHORTCUT (yTop = 6.8) ---
    {
      id: 'c4-sky-island-2',
      kind: 'roundedBox',
      material: 'standard',
      center: [3.2, 6.2, -39.2],
      halfExtents: [4.8, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c4-island-2-south-guard',
      kind: 'roundedBox',
      material: 'standard',
      center: [3.2, 7.25, -42.3],
      halfExtents: [4.6, 0.45, 0.3],
      radius: 0.08,
    },

    // --- DARING BANKED HALF-PIPE JUMP SHORTCUT ---
    // Launches from Sky Island 1 diagonally across the chasm to the Goal Podium
    {
      id: 'c4-banked-halfpipe-shortcut',
      kind: 'sweptTrack',
      material: 'conveyor',
      center: [0, 0, 0],
      start: [3.4, 9.95, -26.4],
      end: [14.2, 4.15, -36.8],
      halfWidth: 1.55,
      thickness: 0.85,
      railHeight: 1.2,
      railThickness: 0.35,
      conveyorDirection: [6.2, -2.2, -6.2],
      supportBias: true,
    },
    {
      id: 'c4-halfpipe-jump-kicker',
      kind: 'cylinder',
      material: 'bounce',
      center: [15.0, 3.55, -37.6],
      radius: 1.25,
      halfHeight: 0.5,
    },

    // --- SECTION 3: FINAL SUSPENDED CATWALK RIDGE (+X, yTop: 6.8 -> 3.6) ---
    {
      id: 'c4-final-catwalk-ridge',
      kind: 'ramp',
      material: 'standard',
      center: [11.6, 5.2, -39.2],
      axis: 'x',
      halfLength: 4.0,
      rise: -3.2,
      halfWidth: 1.85,
      thickness: 0.9,
      railHeight: 0.4,
      railThickness: 0.26,
      supportBias: true,
    },

    // --- TIER 4: AERIAL GOAL SPIRE (yTop = 3.6) ---
    {
      id: 'c4-goal-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [19.2, 3.0, -39.2],
      halfExtents: [4.4, 0.6, 4.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c4-goal-spire-pillar',
      kind: 'box',
      material: 'standard',
      center: [19.2, -3.5, -39.2],
      halfExtents: [3.0, 6.0, 3.0],
    },
    {
      id: 'c4-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [19.2, 3.1, -39.2],
      radius: 2.6,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    {
      id: 'c4-island-1-bumper',
      kind: 'cylinder',
      material: 'bumper',
      center: [1.8, 10.55, -24.2],
      radius: 0.58,
      halfHeight: 0.55,
    },
    {
      id: 'c4-island-2-patrol-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [5.4, 7.45, -39.2],
      radius: 0.62,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [0.0, 0.0, 2.2],
        frequency: 0.46,
        phase: 0.4,
      },
    },
    {
      id: 'c4-catwalk-hammer',
      kind: 'piston',
      material: 'bumper',
      center: [11.6, 7.9, -39.2],
      headHalfExtents: [0.85, 0.6, 0.9],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.55,
        frequency: 0.6,
        phase: 1.2,
        slamSharpness: 2.2,
      },
    },
  ],
};
