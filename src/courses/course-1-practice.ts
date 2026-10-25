/**
 * Course 1: PRACTICE RACE (`src/courses/course-1-practice.ts`)
 *
 * Polished onboarding course inspired by the iconic 1984 Atari Marble Madness opening race:
 * - Wide isometric grid terraces with checkered launch pad
 * - Banked S-chute (downhill -Z chute sweeping through the mid-course plaza into a high-walled +X chute)
 * - Bumper plaza with arcade bumper pins & inner bounce-pad apex
 * - Tall occlusion archway (showcases the camera-to-marble X-Ray capsule cutout)
 * - Secret high-speed ramp shortcut that skips the lower hairpin across the abyss
 */

import type { CourseSpec } from '../contracts';

export const COURSE_1_PRACTICE_RACE: CourseSpec = {
  id: 'practice-race',
  index: 1,
  name: 'PRACTICE RACE',
  subtitle: 'ISOMETRIC TERRACES // BANKED S-CHUTE // OCCLUSION ARCHWAY',
  difficulty: 'PRACTICE',
  parTimeSec: 60,
  bonusTimeSec: 35,
  startPos: [0, 8.75, 0],
  goalPos: [24.6, 1.02, -35.2],
  goalRadius: 2.55,
  killPlaneY: -10.5,
  overviewCenter: [12.0, 3.5, -18.0],
  overviewRadius: 26.0,
  theme: {
    name: 'Atari Cobalt Isometric',
    trackPrimary: [0.13, 0.34, 0.68],
    trackSecondary: [0.09, 0.24, 0.52],
    gridLineColor: [0.42, 0.92, 1.0],
    wallColor: [0.08, 0.16, 0.36],
    skyZenith: [0.02, 0.04, 0.11],
    skyHorizon: [0.08, 0.18, 0.36],
    abyssFogColor: [0.04, 0.11, 0.26],
    abyssFogDensity: 1.0,
    sunDirection: [0.52, 0.78, 0.34],
  },
  checkpoints: [
    {
      id: 'cp-turn-plaza',
      label: 'BUMPER PLAZA',
      position: [3.2, 5.15, -16.8],
      radius: 4.2,
    },
    {
      id: 'cp-bridge-head',
      label: 'OCCLUSION ARCHWAY',
      position: [24.6, 1.55, -16.8],
      radius: 3.5,
    },
  ],
  portals: [
    {
      id: 'practice-chute-fling-portal',
      posA: [0.4, 5.42, -19.35],
      normalA: [0.0, 0.22, 0.9755],
      upA: [0.0, 0.9755, -0.22],
      posB: [27.05, 1.7, -19.85],
      normalB: [0.0, 0.36, -0.933],
      upB: [0.0, 0.933, 0.36],
      radius: 1.38,
      activeA: true,
      activeB: true,
      flingBoost: 1.0,
    },
  ],
  hazardManifest: [
    {
      id: 'banked-s-chute',
      label: 'Banked S-Chute',
      kind: 'conveyor',
      description: 'Fillet-smoothed CSG S-chute with raised containment rails and slope boost.',
    },
    {
      id: 'speedrun-sky-jump',
      label: 'Secret High-Speed Ramp Shortcut',
      kind: 'conveyor',
      description: 'Diagonal high-speed ramp & bounce kicker that skips the lower hairpin over the abyss.',
    },
    {
      id: 'plaza-bumpers',
      label: 'Bumper Plaza Pins',
      kind: 'bumper',
      description: 'High-restitution chrome-red pins guarding the apex of the mid-course plaza.',
    },
    {
      id: 'patrol-steelie-1',
      label: 'Patrolling Steelie',
      kind: 'steelie',
      description: 'Kinematic enemy sphere patrolling the Goal Podium entrance.',
    },
  ],
  nodes: [
    // --- TIER 1: WIDE ISOMETRIC START TERRACE & MONOLITH ---
    {
      id: 'start-podium-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 7.6, 0.2],
      halfExtents: [4.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'start-pad-inlay',
      kind: 'cylinder',
      material: 'start',
      center: [0, 7.7, 0],
      radius: 2.2,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'start-monolith-column',
      kind: 'box',
      material: 'standard',
      center: [0, 1.5, 0],
      halfExtents: [2.8, 5.6, 2.8],
    },
    {
      id: 'start-back-guardrail',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 8.65, 3.55],
      halfExtents: [4.2, 0.45, 0.35],
      radius: 0.08,
    },

    // --- RAMP 1: UPPER LEG OF BANKED S-CHUTE (-Z) ---
    // Connects z = -3.2 (yTop = 8.2) down to z = -13.6 (yTop = 4.6)
    {
      id: 'ramp-1-downhill',
      kind: 'ramp',
      material: 'standard',
      center: [0, 6.4, -8.4],
      axis: 'z',
      halfLength: 5.2,
      rise: 3.6,
      halfWidth: 3.0,
      thickness: 1.1,
      railHeight: 0.75,
      railThickness: 0.35,
      supportBias: true,
    },

    // --- TIER 2: MID-COURSE BUMPER PLAZA (S-CHUTE INFLECTION) ---
    {
      id: 'turn-1-plaza',
      kind: 'roundedBox',
      material: 'standard',
      center: [3.0, 4.0, -16.8],
      halfExtents: [6.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'turn-1-plaza-pillar',
      kind: 'box',
      material: 'standard',
      center: [3.2, -1.2, -16.8],
      halfExtents: [4.8, 4.6, 2.4],
    },
    {
      id: 'turn-1-south-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [2.0, 5.15, -20.05],
      halfExtents: [5.2, 0.55, 0.35],
      radius: 0.08,
    },
    {
      id: 'turn-1-west-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [-2.85, 5.15, -16.8],
      halfExtents: [0.35, 0.55, 3.6],
      radius: 0.08,
    },
    {
      id: 'turn-1-inside-bounce',
      kind: 'cylinder',
      material: 'bounce',
      center: [7.6, 4.12, -14.2],
      radius: 1.05,
      halfHeight: 0.5,
    },

    // --- RAMP 2: LOWER LEG OF BANKED S-CHUTE (+X) ---
    // Connects x = 9.2 (yTop = 4.6) down to x = 21.6 (yTop = 1.0)
    {
      id: 'ramp-2-banked-chute',
      kind: 'ramp',
      material: 'standard',
      center: [15.4, 2.8, -16.8],
      axis: 'x',
      halfLength: 6.2,
      rise: -3.6,
      halfWidth: 2.8,
      thickness: 1.1,
      railHeight: 1.05,
      railThickness: 0.38,
      supportBias: true,
    },

    // --- TIER 3: HAIRPIN TERRACE & OCCLUSION ARCHWAY ---
    {
      id: 'bridge-approach-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [24.6, 0.4, -16.8],
      halfExtents: [3.4, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'bridge-approach-east-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [27.65, 1.55, -16.8],
      halfExtents: [0.35, 0.55, 3.6],
      radius: 0.08,
    },
    // Tall isometric occlusion archway spanning the bridge entrance so rolling beneath it
    // showcases the camera-to-marble capsule cutout
    {
      id: 'occlusion-monolith-tower',
      kind: 'roundedBox',
      material: 'standard',
      center: [26.8, 3.4, -14.2],
      halfExtents: [1.3, 2.8, 1.1],
      radius: 0.12,
    },
    {
      id: 'occlusion-arch-west-pillar',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.4, 2.7, -20.6],
      halfExtents: [0.45, 1.9, 0.55],
      radius: 0.08,
    },
    {
      id: 'occlusion-arch-east-pillar',
      kind: 'roundedBox',
      material: 'standard',
      center: [26.8, 2.7, -20.6],
      halfExtents: [0.45, 1.9, 0.55],
      radius: 0.08,
    },
    {
      id: 'occlusion-arch-lintel',
      kind: 'roundedBox',
      material: 'standard',
      center: [24.6, 4.75, -20.6],
      halfExtents: [2.75, 0.55, 0.75],
      radius: 0.1,
    },

    // --- SECRET HIGH-SPEED RAMP SHORTCUT (SKIPS THE LOWER HAIRPIN) ---
    {
      id: 'speedrun-diagonal-chute',
      kind: 'sweptTrack',
      material: 'conveyor',
      center: [0, 0, 0],
      start: [8.4, 4.55, -19.4],
      end: [18.8, 1.15, -30.2],
      halfWidth: 1.45,
      thickness: 0.75,
      railHeight: 0.3,
      railThickness: 0.22,
      conveyorDirection: [5.5, -1.2, -5.5],
      supportBias: true,
    },
    {
      id: 'speedrun-kicker-pad',
      kind: 'cylinder',
      material: 'bounce',
      center: [19.6, 0.65, -31.0],
      radius: 1.2,
      halfHeight: 0.45,
    },

    // --- NARROW CATWALK BRIDGE OVER THE ABYSS (-Z) ---
    {
      id: 'narrow-abyss-bridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [24.6, 0.5, -25.6],
      halfExtents: [1.85, 0.5, 5.6],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'bridge-sticky-brake-strip',
      kind: 'roundedBox',
      material: 'sticky',
      center: [24.6, 0.5, -30.2],
      halfExtents: [1.65, 0.5, 0.9],
      radius: 0.06,
      supportBias: true,
    },

    // --- TIER 4: GOAL PODIUM ---
    {
      id: 'goal-podium-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [24.6, 0.4, -35.2],
      halfExtents: [4.8, 0.6, 4.6],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'goal-podium-pillar',
      kind: 'box',
      material: 'standard',
      center: [24.6, -4.5, -35.2],
      halfExtents: [3.6, 4.5, 3.6],
    },
    {
      id: 'goal-pad-disc',
      kind: 'cylinder',
      material: 'goal',
      center: [24.6, 0.5, -35.2],
      radius: 2.55,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    {
      id: 'turn-1-bumper-a',
      kind: 'cylinder',
      material: 'bumper',
      center: [0.8, 5.15, -16.8],
      radius: 0.58,
      halfHeight: 0.55,
    },
    {
      id: 'turn-1-bumper-b',
      kind: 'cylinder',
      material: 'bumper',
      center: [5.6, 5.15, -18.5],
      radius: 0.58,
      halfHeight: 0.55,
    },
    {
      id: 'goal-guard-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [24.6, 1.65, -32.2],
      radius: 0.62,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [2.8, 0, 0],
        frequency: 0.45,
        phase: 0,
      },
    },
  ],
};
