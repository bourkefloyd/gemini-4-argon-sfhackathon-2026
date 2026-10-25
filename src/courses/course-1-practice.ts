/**
 * Course 1: MARBLE RAMP GAUNTLET (`src/courses/course-1-practice.ts`)
 *
 * Flagship Progressive Mechanics Ramp Track inspired by classic 1984 Atari Marble Madness
 * steep descending zig-zag ramp & chute courses. Each terrace progressively introduces
 * one signature mechanic before testing them together in the finale:
 *
 * - Stage 1 (Terrace 1, y = 14 -> 10) — Pure Steep Isometric Ramp & Banked Hairpin:
 *     Wide starting podium dropping into a steep 28° grid-etched ramp where the player
 *     immediately feels gravity acceleration, banked wall carving, and Backspin Braking
 *     before a 90° cliff turn.
 * - Stage 2 (Terrace 2, y = 10 -> 7) — The Portal Fling Chasm (Introduces SDF Portals):
 *     A steep vertical-drop ramp leads straight into a pre-placed Blue Portal on the lip
 *     of a 12m chasm; rolling into it flings the marble at high speed out of a 40° tilted
 *     Orange Portal across the abyss onto Terrace 3 (with a narrow side-catwalk for manual
 *     jumps or [V] Bridge Extruder).
 * - Stage 3 (Terrace 3, y = 7 -> 4) — Living SDF Wave Floor & Rhythmic Pistons (Introduces Kinematic SDFs):
 *     A traveling sinusoidal Wave Floor where pumping the wave crest launches you past
 *     2 rhythmic slamming SDF Pistons/Hammers.
 * - Stage 4 (Terrace 4, y = 4 -> 0) — Ice Slick, Black Steelie & Destructible CSG Barrier to Goal:
 *     Low-friction Ice Chute patrolled by a Black Steelie leading to a thin destructible
 *     CSG wall / acid trench right before the Goal Podium — solvable by carving through
 *     with [F] Crater Bomb, vaulting the bounce pad, or threading the tight S-slalom!
 */

import type { CourseSpec } from '../contracts';

export const COURSE_1_PRACTICE_RACE: CourseSpec = {
  id: 'practice-race',
  index: 1,
  name: 'MARBLE RAMP GAUNTLET',
  subtitle:
    'Stage 1: Steep Ramp & Backspin -> Stage 2: Portal Fling Gap -> Stage 3: Wave & Pistons -> Stage 4: Ice, Steelie & Goal',
  difficulty: 'PRACTICE',
  parTimeSec: 60,
  bonusTimeSec: 35,
  startPos: [0, 14.57, 0],
  goalPos: [30.0, 1.02, -52.6],
  goalRadius: 2.65,
  killPlaneY: -10.5,
  overviewCenter: [15.0, 7.2, -26.0],
  overviewRadius: 34.0,
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
      id: 'cp-stage-1-hairpin',
      label: 'STAGE 1: STEEP RAMP & BACKSPIN',
      position: [2.4, 10.55, -14.2],
      radius: 3.8,
    },
    {
      id: 'cp-stage-2-portal-landing',
      label: 'STAGE 2: PORTAL FLING GAP',
      position: [30.0, 7.55, -15.6],
      radius: 3.8,
    },
    {
      id: 'cp-stage-3-wave-pistons',
      label: 'STAGE 3: WAVE & PISTONS',
      position: [30.0, 4.55, -35.8],
      radius: 3.5,
    },
  ],
  portals: [
    {
      id: 'stage2-chasm-fling-portal',
      // Blue Portal on the Terrace 2 chasm lip facing -X up the steep drop ramp
      posA: [17.4, 7.62, -13.6],
      normalA: [-1.0, 0.0, 0.0],
      upA: [0.0, 1.0, 0.0],
      // Orange Portal tilted at 40° (cos 40° = 0.7660, sin 40° = 0.6428) flinging across the 12m abyss onto Terrace 3
      posB: [21.5, 7.85, -13.6],
      normalB: [0.766, 0.6428, 0.0],
      upB: [-0.6428, 0.766, 0.0],
      radius: 1.55,
      activeA: true,
      activeB: true,
      flingBoost: 1.25,
    },
  ],
  hazardManifest: [
    {
      id: 'stage1-steep-ramp-backspin',
      label: 'Stage 1: Steep Ramp & Backspin',
      kind: 'conveyor',
      description:
        'Steep 28° isometric ramp (y = 14 -> 10) teaching gravity acceleration, banked wall carving, and Backspin Braking into a 90° cliff turn.',
    },
    {
      id: 'stage2-portal-fling-gap',
      label: 'Stage 2: Portal Fling Gap',
      kind: 'bridge',
      description:
        'Vertical-drop chute into a pre-placed Blue Portal that flings the marble out of a 40° tilted Orange Portal across a 12m abyss onto Terrace 3 (plus a narrow side-catwalk bypass).',
    },
    {
      id: 'stage3-wave-and-pistons',
      label: 'Stage 3: Wave & Pistons',
      kind: 'piston',
      description:
        'Traveling sinusoidal SDF Wave Floor (y = 7 -> 4) where pumping the wave crest launches you past 2 rhythmic slamming SDF Pistons.',
    },
    {
      id: 'stage4-ice-steelie-goal',
      label: 'Stage 4: Ice, Steelie & Goal',
      kind: 'ice',
      description:
        'Low-friction Ice Chute (y = 4 -> 0) patrolled by a Black Steelie leading to a destructible CSG barrier & acid trench solvable via [F] Crater Bomb, bounce vault, or tight S-slalom.',
    },
  ],
  nodes: [
    // =========================================================================
    // STAGE 1 (TERRACE 1, y = 14 -> 10): PURE STEEP 28° RAMP & BANKED HAIRPIN
    // =========================================================================
    {
      id: 'start-podium-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 13.4, 0.2],
      halfExtents: [4.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'start-pad-inlay',
      kind: 'cylinder',
      material: 'start',
      center: [0, 13.52, 0],
      radius: 2.2,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'start-back-guardrail',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 14.5, 3.55],
      halfExtents: [4.2, 0.5, 0.35],
      radius: 0.08,
    },
    // Mid-tower architectural colonnade deck (yTop = 8.2) & base monolith column
    {
      id: 'start-colonnade-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 7.6, 0.2],
      halfExtents: [4.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'start-monolith-column',
      kind: 'box',
      material: 'standard',
      center: [0, 1.5, 0],
      halfExtents: [2.8, 5.6, 2.8],
    },

    // Steep 28° Isometric Ramp: drops y = 14.0 (z = -3.2) -> y = 10.0 (z = -10.72), arctan(4.0 / 7.52) = 28.0°
    {
      id: 'stage1-steep-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [0, 12.0, -6.96],
      axis: 'z',
      halfLength: 3.76,
      rise: 4.0,
      halfWidth: 3.1,
      thickness: 1.1,
      railHeight: 0.95,
      railThickness: 0.36,
      supportBias: true,
    },

    // Terrace 1 Banked Hairpin & 90° Cliff Turn (yTop = 10.0)
    {
      id: 'stage1-banked-hairpin-plaza',
      kind: 'roundedBox',
      material: 'standard',
      center: [2.8, 9.4, -14.2],
      halfExtents: [6.0, 0.6, 3.8],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'stage1-hairpin-pillar',
      kind: 'box',
      material: 'standard',
      center: [2.8, 3.6, -14.2],
      halfExtents: [4.6, 5.2, 2.6],
    },
    {
      id: 'stage1-hairpin-south-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [2.8, 10.65, -17.65],
      halfExtents: [6.0, 0.65, 0.35],
      radius: 0.08,
    },
    {
      id: 'stage1-hairpin-west-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [-2.85, 10.65, -14.2],
      halfExtents: [0.35, 0.65, 3.8],
      radius: 0.08,
    },
    {
      id: 'stage1-hairpin-carve-bank',
      kind: 'roundedBox',
      material: 'standard',
      center: [-1.7, 10.4, -16.6],
      halfExtents: [1.4, 0.4, 1.2],
      radius: 0.25,
      supportBias: true,
    },

    // =========================================================================
    // STAGE 2 (TERRACE 2, y = 10 -> 7): PORTAL FLING CHASM & SIDE-CATWALK
    // =========================================================================
    // Steep Drop Chute (+X): drops y = 10.0 (x = 8.5) -> y = 7.0 (x = 14.5)
    {
      id: 'stage2-drop-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [11.5, 8.5, -14.2],
      axis: 'x',
      halfLength: 3.0,
      rise: -3.0,
      halfWidth: 3.4,
      thickness: 1.1,
      railHeight: 0.95,
      railThickness: 0.36,
      supportBias: true,
    },
    // Terrace 2 Chasm Lip Deck (yTop = 7.0, x = 14.2 .. 18.0) before the 12m Abyss
    {
      id: 'stage2-chasm-lip-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [16.1, 6.4, -14.6],
      halfExtents: [1.9, 0.6, 3.8],
      radius: 0.12,
      supportBias: true,
    },
    // Floating Orange Portal 40° Launch Pediment at the edge of the 12m chasm
    {
      id: 'stage2-orange-portal-pediment',
      kind: 'roundedBox',
      material: 'standard',
      center: [20.9, 7.1, -13.6],
      halfExtents: [0.7, 0.8, 1.7],
      radius: 0.12,
    },
    // Narrow Side-Catwalk across the abyss for manual jump / [V] Bridge Extruder / speedrun bypass
    {
      id: 'stage2-speedrun-side-catwalk',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.0, 6.5, -16.8],
      halfExtents: [4.6, 0.5, 1.45],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'stage2-catwalk-south-rail',
      kind: 'roundedBox',
      material: 'standard',
      center: [22.0, 7.35, -18.05],
      halfExtents: [4.6, 0.35, 0.2],
      radius: 0.05,
    },

    // =========================================================================
    // STAGE 3 (TERRACE 3, y = 7 -> 4): LIVING SDF WAVE FLOOR & RHYTHMIC PISTONS
    // =========================================================================
    // Terrace 3 Portal Landing & Catwalk Convergence Deck (yTop = 7.0, x = 25.8 .. 34.2)
    {
      id: 'stage3-landing-terrace',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 6.4, -15.3],
      halfExtents: [4.2, 0.6, 3.9],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'stage3-east-backstop-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [33.85, 7.85, -15.3],
      halfExtents: [0.35, 0.85, 3.9],
      radius: 0.08,
    },
    {
      id: 'stage3-north-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 7.65, -11.75],
      halfExtents: [4.2, 0.65, 0.35],
      radius: 0.08,
    },
    // Traveling Sinusoidal SDF Wave Floor (z = -18.8 -> -28.0, yTop ~ 7.0)
    {
      id: 'stage3-wave-floor',
      kind: 'waveFloor',
      material: 'standard',
      center: [30.0, 6.4, -23.4],
      halfExtents: [3.8, 0.6, 4.6],
      waveAmplitude: 0.22,
      waveFrequencyX: 0.7,
      waveFrequencyZ: 0.85,
      waveSpeed: 2.8,
      supportBias: true,
    },
    {
      id: 'stage3-wave-subdeck',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 6.28, -23.4],
      halfExtents: [3.8, 0.55, 4.6],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'stage3-wave-west-rail',
      kind: 'roundedBox',
      material: 'standard',
      center: [26.45, 7.55, -23.4],
      halfExtents: [0.25, 0.55, 4.6],
      radius: 0.06,
    },
    {
      id: 'stage3-wave-east-rail',
      kind: 'roundedBox',
      material: 'standard',
      center: [33.55, 7.55, -23.4],
      halfExtents: [0.25, 0.55, 4.6],
      radius: 0.06,
    },
    // Lower architectural under-bridge plinth (yTop = 1.0, 6m below Stage 3 Wave Floor)
    {
      id: 'narrow-abyss-bridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [24.6, 0.5, -25.6],
      halfExtents: [1.85, 0.5, 2.8],
      radius: 0.1,
      supportBias: true,
    },
    // Stage 3 Descent Ramp: drops y = 7.0 (z = -27.8) -> y = 4.0 (z = -34.2)
    {
      id: 'stage3-descent-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [30.0, 5.5, -31.0],
      axis: 'z',
      halfLength: 3.2,
      rise: 3.0,
      halfWidth: 3.6,
      thickness: 1.1,
      railHeight: 0.9,
      railThickness: 0.35,
      supportBias: true,
    },

    // =========================================================================
    // STAGE 4 (TERRACE 4, y = 4 -> 0): ICE SLICK, BLACK STEELIE & CSG BARRIER
    // =========================================================================
    // Terrace 4 Entry Checkpoint Deck (yTop = 4.0, z = -34.0 .. -37.8)
    {
      id: 'stage4-terrace-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 3.4, -35.8],
      halfExtents: [3.8, 0.6, 2.0],
      radius: 0.12,
      supportBias: true,
    },
    // Low-Friction Ice Chute: drops y = 4.0 (z = -37.6) -> y = 0.45 (z = -45.2)
    {
      id: 'stage4-ice-chute',
      kind: 'ramp',
      material: 'ice',
      center: [30.0, 2.225, -41.4],
      axis: 'z',
      halfLength: 3.8,
      rise: 3.55,
      halfWidth: 3.8,
      thickness: 1.1,
      railHeight: 0.95,
      railThickness: 0.36,
      supportBias: true,
    },
    // Finale Arena & Goal Podium Deck (yTop = 0.45, z = -45.0 .. -56.4, x = 25.0 .. 35.0)
    {
      id: 'goal-podium-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, -0.15, -50.7],
      halfExtents: [5.0, 0.6, 5.7],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'goal-podium-pillar',
      kind: 'box',
      material: 'standard',
      center: [30.0, -5.0, -50.7],
      halfExtents: [3.8, 4.4, 4.5],
    },
    {
      id: 'stage4-west-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [25.35, 1.05, -50.7],
      halfExtents: [0.35, 0.6, 5.7],
      radius: 0.08,
    },
    {
      id: 'stage4-east-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [34.65, 1.05, -50.7],
      halfExtents: [0.35, 0.6, 5.7],
      radius: 0.08,
    },
    {
      id: 'stage4-south-backstop-wall',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 1.1, -56.05],
      halfExtents: [5.0, 0.65, 0.35],
      radius: 0.08,
    },
    // Thin Destructible CSG Barrier Wall right before the Goal Podium (solvable via [F] Crater Bomb)
    {
      id: 'stage4-destructible-barrier',
      kind: 'roundedBox',
      material: 'standard',
      center: [29.1, 0.95, -48.6],
      halfExtents: [1.7, 0.55, 0.35],
      radius: 0.06,
    },
    // West Bounce Pad & Acid Trench (solvable by vaulting the bounce pad or [N] Cryo Freeze)
    {
      id: 'stage4-vault-bounce-pad',
      kind: 'cylinder',
      material: 'bounce',
      center: [26.4, -0.04, -47.1],
      radius: 0.95,
      halfHeight: 0.52,
      supportBias: true,
    },
    {
      id: 'stage4-acid-trench',
      kind: 'box',
      material: 'acid',
      center: [26.4, -0.09, -48.6],
      halfExtents: [0.8, 0.55, 0.35],
    },
    // Tall Isometric Occlusion Archway framing the Goal Podium entrance (showcases X-Ray capsule cutout)
    {
      id: 'occlusion-arch-west-pillar',
      kind: 'roundedBox',
      material: 'standard',
      center: [27.2, 2.25, -50.4],
      halfExtents: [0.42, 1.8, 0.5],
      radius: 0.08,
    },
    {
      id: 'occlusion-arch-east-pillar',
      kind: 'roundedBox',
      material: 'standard',
      center: [32.8, 2.25, -50.4],
      halfExtents: [0.42, 1.8, 0.5],
      radius: 0.08,
    },
    {
      id: 'occlusion-arch-lintel',
      kind: 'roundedBox',
      material: 'standard',
      center: [30.0, 4.2, -50.4],
      halfExtents: [3.2, 0.55, 0.7],
      radius: 0.1,
    },
    // Goal Podium Checkered Disc
    {
      id: 'goal-pad-disc',
      kind: 'cylinder',
      material: 'goal',
      center: [30.0, -0.05, -52.6],
      radius: 2.65,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    // Stage 3: 2 Rhythmic Slamming SDF Pistons/Hammers across the Living Wave Floor
    {
      id: 'stage3-piston-1',
      kind: 'piston',
      material: 'bumper',
      center: [28.3, 9.5, -21.8],
      headHalfExtents: [0.95, 0.55, 0.85],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.55,
        frequency: 0.68,
        phase: 0,
        slamSharpness: 2.2,
      },
    },
    {
      id: 'stage3-piston-2',
      kind: 'piston',
      material: 'bumper',
      center: [31.7, 9.5, -25.0],
      headHalfExtents: [0.95, 0.55, 0.85],
      bevelRadius: 0.12,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.55,
        frequency: 0.68,
        phase: 3.14159,
        slamSharpness: 2.2,
      },
    },
    // Stage 4: Patrolling Black Steelie guarding the bottom of the Ice Chute
    {
      id: 'stage4-patrol-steelie',
      kind: 'sphere',
      material: 'bumper',
      center: [29.2, 1.15, -46.2],
      radius: 0.62,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [2.2, 0, 0],
        frequency: 0.42,
        phase: 1.5,
      },
    },
  ],
};

export const COURSE_1_RAMP_GAUNTLET = COURSE_1_PRACTICE_RACE;
