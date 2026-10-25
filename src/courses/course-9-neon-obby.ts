/**
 * Course 9: NEON SKY OBBY (`src/courses/course-9-neon-obby.ts`)
 *
 * Roblox Obby-Style Precision Parkour Course with generous Stage Checkpoints
 * after every obstacle so respawning (`R` or falling) puts you right back at the
 * obstacle you were attempting:
 *   - Obby Stage 1 — The Rainbow Stepping-Stone Hop (`z = 0 -> -16.5`):
 *     Alternating staggered floating SDF stepping-stone pads (`roundedBox`) with an
 *     East Speedrun Rail for continuous rolling + hopping (`Space`).
 *   - Obby Stage 2 — The Sweeping "Kill-Brick" Spinner Bars (`z = -16.5 -> -32.5`):
 *     Reciprocating kinematic hazard spinner bars (`bridge` / `piston`) sweeping across
 *     a narrow skybridge that you time your hop over or weave around.
 *   - Obby Stage 3 — The Bounce-Pad Trampoline Staircase (`z = -32.5 -> -48.5`):
 *     Chain of 3 ascending high-restitution `bounce` trampoline pads + conveyor spine
 *     ascending skyward into a mid-air `smoothUnion` catch-funnel!
 *   - Obby Stage 4 — The Wave-Bridge & Conveyor Crosswind Beam (`z = -48.5 -> -62.0`):
 *     A narrow undulating `waveFloor` sky-beam flanked by alternating conveyor crosswind
 *     belts and a final `[Q]` Portal / `[F]` Crater shortcut to the Obby Winner Podium!
 */

import type { CourseSpec } from '../contracts';

export const COURSE_9_NEON_OBBY: CourseSpec = {
  id: 'neon-sky-obby',
  index: 9,
  name: 'NEON SKY OBBY',
  subtitle:
    'Stage 1: Rainbow Stepping Stones -> Stage 2: Kill-Brick Spinners -> Stage 3: Trampoline Staircase -> Stage 4: Crosswind Wave Beam',
  difficulty: 'INTERMEDIATE',
  parTimeSec: 65,
  bonusTimeSec: 30,
  startPos: [0, 10.55, 0],
  goalPos: [0, 13.02, -62.0],
  goalRadius: 2.85,
  killPlaneY: -10.0,
  overviewCenter: [0, 11.5, -31.0],
  overviewRadius: 36.0,
  theme: {
    name: 'Roblox Neon Sky Parkour',
    trackPrimary: [0.22, 0.16, 0.48],
    trackSecondary: [0.12, 0.08, 0.30],
    gridLineColor: [1.0, 0.36, 0.86],
    wallColor: [0.28, 0.18, 0.56],
    skyZenith: [0.05, 0.02, 0.14],
    skyHorizon: [0.28, 0.12, 0.46],
    abyssFogColor: [0.18, 0.06, 0.34],
    abyssFogDensity: 0.88,
    sunDirection: [0.52, 0.79, 0.32],
  },
  checkpoints: [
    {
      id: 'cp-obby-stage-2',
      label: 'OBBY STAGE 2: KILL-BRICK SPINNERS',
      position: [0, 10.55, -16.5],
      radius: 4.2,
    },
    {
      id: 'cp-obby-stage-3',
      label: 'OBBY STAGE 3: TRAMPOLINE STAIRCASE',
      position: [0, 10.55, -32.5],
      radius: 4.2,
    },
    {
      id: 'cp-obby-stage-4',
      label: 'OBBY STAGE 4: CROSSWIND WAVE BEAM',
      position: [0, 13.55, -48.5],
      radius: 4.4,
    },
  ],
  portals: [
    {
      id: 'obby-stage4-winner-portal',
      posA: [3.2, 14.2, -50.5],
      normalA: [0, 0, 1],
      upA: [0, 1, 0],
      posB: [2.6, 13.8, -59.5],
      normalB: [-0.38, 0, -0.92],
      upB: [0, 1, 0],
      radius: 1.65,
      flingBoost: 1.35,
      activeA: true,
      activeB: true,
    },
  ],
  hazardManifest: [
    {
      id: 'obby-rainbow-stepping-stones',
      label: 'Rainbow Stepping-Stone Pads & Speedrun Rail',
      kind: 'conveyor',
      description: 'Alternating floating SDF stepping-stone pads with an East Speedrun Conveyor Rail.',
    },
    {
      id: 'obby-kill-brick-spinners',
      label: 'Sweeping Kill-Brick Spinner Bars',
      kind: 'bridge',
      description: 'Reciprocating kinematic spinner bars sweeping across the Stage 2 skybridge.',
    },
    {
      id: 'obby-trampoline-staircase',
      label: '3-Pad Bounce Trampoline Staircase',
      kind: 'bumper',
      description: 'Three ascending high-restitution bounce pads launching into a smoothUnion catch-funnel.',
    },
    {
      id: 'obby-crosswind-wave-beam',
      label: 'Undulating Wave-Bridge & Crosswind Belts',
      kind: 'waveFloor',
      description: 'Narrow sky-high waveFloor beam flanked by alternating conveyor crosswind belts.',
    },
  ],
  scene: {
    id: 'obby-catch-funnel-smooth-assembly',
    kind: 'smoothUnion',
    smoothRadius: 0.42,
    children: [
      {
        id: 'obby-catch-funnel-bowl',
        kind: 'cylinder',
        material: 'standard',
        center: [0, 12.4, -46.2],
        radius: 3.8,
        halfHeight: 0.6,
        supportBias: true,
      },
      {
        id: 'obby-catch-funnel-west-wing',
        kind: 'roundedBox',
        material: 'sticky',
        center: [-3.6, 13.4, -46.2],
        halfExtents: [0.45, 0.65, 2.2],
        radius: 0.14,
      },
      {
        id: 'obby-catch-funnel-east-wing',
        kind: 'roundedBox',
        material: 'sticky',
        center: [3.6, 13.4, -46.2],
        halfExtents: [0.45, 0.65, 2.2],
        radius: 0.14,
      },
    ],
  },
  nodes: [
    // =========================================================================
    // OBBY STAGE 1: THE RAINBOW STEPPING-STONE HOP (z = 0 -> -16.5)
    // =========================================================================
    {
      id: 'obby-start-pad',
      kind: 'roundedBox',
      material: 'start',
      center: [0, 9.4, 0],
      halfExtents: [4.2, 0.6, 3.4],
      radius: 0.14,
      supportBias: true,
    },
    // Center-West Staggered Stepping-Stone Pads
    {
      id: 'obby-stone-1',
      kind: 'roundedBox',
      material: 'standard',
      center: [-0.4, 9.4, -5.0],
      halfExtents: [2.4, 0.6, 1.8],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'obby-stone-2',
      kind: 'roundedBox',
      material: 'standard',
      center: [0.4, 9.4, -8.2],
      halfExtents: [2.4, 0.6, 1.8],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'obby-stone-3',
      kind: 'roundedBox',
      material: 'standard',
      center: [-0.4, 9.4, -11.4],
      halfExtents: [2.4, 0.6, 1.8],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'obby-stone-4',
      kind: 'roundedBox',
      material: 'standard',
      center: [0.2, 9.4, -14.2],
      halfExtents: [2.6, 0.6, 1.6],
      radius: 0.14,
      supportBias: true,
    },
    // East Side Speedrun Rail for continuous high-speed rolling + hopping
    {
      id: 'obby-stage1-speedrun-rail',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [2.8, 9.42, -9.8],
      halfExtents: [1.25, 0.6, 6.8],
      radius: 0.12,
      conveyorDirection: [0, 0, -5.5],
      supportBias: true,
    },
    // West Floating Bonus Hop Pads
    {
      id: 'obby-stage1-west-hop-1',
      kind: 'cylinder',
      material: 'bounce',
      center: [-3.2, 9.45, -6.6],
      radius: 1.15,
      halfHeight: 0.55,
      supportBias: true,
    },
    {
      id: 'obby-stage1-west-hop-2',
      kind: 'cylinder',
      material: 'bounce',
      center: [-3.2, 9.45, -12.6],
      radius: 1.15,
      halfHeight: 0.55,
      supportBias: true,
    },
    // Stage 1 -> Stage 2 Checkpoint Pad (yTop = 10.0)
    {
      id: 'obby-cp1-pad',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, -16.5],
      halfExtents: [4.6, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // OBBY STAGE 2: THE SWEEPING "KILL-BRICK" SPINNER BARS (z = -16.5 -> -32.5)
    // =========================================================================
    {
      id: 'obby-stage2-skybridge',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, -24.5],
      halfExtents: [3.8, 0.6, 6.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'obby-stage2-curb-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-3.9, 10.25, -24.5],
      halfExtents: [0.25, 0.45, 6.2],
      radius: 0.08,
    },
    {
      id: 'obby-stage2-curb-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [3.9, 10.25, -24.5],
      halfExtents: [0.25, 0.45, 6.2],
      radius: 0.08,
    },
    // Stage 2 -> Stage 3 Checkpoint Pad (yTop = 10.0)
    {
      id: 'obby-cp2-pad',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.4, -32.5],
      halfExtents: [4.6, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // OBBY STAGE 3: THE BOUNCE-PAD TRAMPOLINE STAIRCASE (z = -32.5 -> -48.5)
    // =========================================================================
    // Continuous Uphill Conveyor Staircase Spine (yTop: 10.0 -> 13.0)
    {
      id: 'obby-stage3-staircase-ramp',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 11.5, -39.5],
      axis: 'z',
      halfLength: 5.6,
      rise: -3.0,
      halfWidth: 3.6,
      thickness: 1.0,
      railHeight: 0.75,
      conveyorDirection: [0, 2.8, -8.8],
      supportBias: true,
    },
    // Chain of 3 Ascending High-Restitution Bounce Trampoline Pads!
    {
      id: 'obby-trampoline-1',
      kind: 'cylinder',
      material: 'bounce',
      center: [2.1, 10.02, -36.0],
      radius: 1.25,
      halfHeight: 0.55,
      supportBias: true,
    },
    {
      id: 'obby-trampoline-2',
      kind: 'cylinder',
      material: 'bounce',
      center: [2.1, 10.99, -39.5],
      radius: 1.25,
      halfHeight: 0.55,
      supportBias: true,
    },
    {
      id: 'obby-trampoline-3',
      kind: 'cylinder',
      material: 'bounce',
      center: [2.1, 11.96, -43.0],
      radius: 1.25,
      halfHeight: 0.55,
      supportBias: true,
    },
    // Stage 3 -> Stage 4 Checkpoint Pad (yTop = 13.0)
    {
      id: 'obby-cp3-pad',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 12.4, -48.5],
      halfExtents: [4.6, 0.6, 2.4],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // OBBY STAGE 4: WAVE-BRIDGE & CONVEYOR CROSSWIND BEAM (z = -48.5 -> -62.0)
    // =========================================================================
    {
      id: 'obby-stage4-sub-beam',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 12.35, -55.0],
      halfExtents: [4.2, 0.55, 5.2],
      radius: 0.12,
      supportBias: true,
    },
    {
      id: 'obby-stage4-wave-beam',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 12.4, -55.0],
      halfExtents: [2.4, 0.6, 4.2],
      waveAmplitude: 0.28,
      waveFrequencyX: 0.45,
      waveFrequencyZ: 0.90,
      waveSpeed: 3.0,
      supportBias: true,
    },
    // Alternating Conveyor Crosswind Belts flanking the Wave-Bridge
    {
      id: 'obby-stage4-crosswind-belt-1',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [-2.8, 12.42, -53.0],
      halfExtents: [1.2, 0.58, 2.2],
      radius: 0.10,
      conveyorDirection: [1.8, 0, -5.2],
      supportBias: true,
    },
    {
      id: 'obby-stage4-crosswind-belt-2',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [2.8, 12.42, -57.0],
      halfExtents: [1.2, 0.58, 2.2],
      radius: 0.10,
      conveyorDirection: [-1.8, 0, -5.2],
      supportBias: true,
    },
    {
      id: 'obby-stage4-curb-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-4.3, 13.3, -55.0],
      halfExtents: [0.28, 0.65, 5.2],
      radius: 0.08,
    },
    {
      id: 'obby-stage4-curb-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [4.3, 13.3, -55.0],
      halfExtents: [0.28, 0.65, 5.2],
      radius: 0.08,
    },
    // Destructible [F] Crater Bomb Obby Gate on the far-west lane (center lane stays open!)
    {
      id: 'obby-stage4-crater-wall',
      kind: 'box',
      material: 'standard',
      center: [-2.8, 13.5, -58.6],
      halfExtents: [1.1, 0.6, 0.32],
    },
    // Obby Winner Podium & Crown Torus Trophy (yTop = 13.0)
    {
      id: 'obby-winner-podium-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 12.4, -62.0],
      halfExtents: [4.8, 0.6, 3.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'obby-winner-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 12.52, -62.0],
      radius: 2.9,
      halfHeight: 0.50,
      supportBias: true,
    },
    {
      id: 'obby-winner-crown-torus',
      kind: 'torus',
      material: 'goal',
      center: [0, 16.0, -64.4],
      majorRadius: 1.6,
      minorRadius: 0.28,
    },
  ],
  hazards: [
    // Obby Stage 2: Sweeping "Kill-Brick" Spinner Bars
    {
      id: 'obby-spinner-bar-1',
      kind: 'roundedBox',
      material: 'bumper',
      center: [-2.0, 10.55, -21.8],
      halfExtents: [1.05, 0.36, 0.36],
      radius: 0.10,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 0.95,
        frequency: 0.52,
        phase: 0,
      },
    },
    {
      id: 'obby-spinner-bar-2',
      kind: 'roundedBox',
      material: 'bumper',
      center: [2.0, 10.55, -27.2],
      halfExtents: [1.05, 0.36, 0.36],
      radius: 0.10,
      kinematic: {
        kind: 'bridge',
        axis: [1, 0, 0],
        amplitude: 0.95,
        frequency: 0.52,
        phase: 3.14159,
      },
    },
  ],
};
