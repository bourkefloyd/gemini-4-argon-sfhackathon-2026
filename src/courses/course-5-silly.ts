/**
 * Course 5: SILLY RACE (`src/courses/course-5-silly.ts`)
 *
 * Playful homage to Mark Cerny's whimsical uphill course:
 * - Starts in a low basin and climbs UPWARD to a high-altitude summit Goal Podium
 * - Conveyor escalators climbing upward against gravity
 * - Bouncy pinball bumper forests & spring pads
 * - High-friction sticky-wall catch banks
 * - Dueling Black Steelies patrolling the summit arena
 */

import type { CourseSpec } from '../contracts';

export const COURSE_5_SILLY_RACE: CourseSpec = {
  id: 'silly-race',
  index: 5,
  name: 'SILLY RACE',
  subtitle: 'UPHILL ESCALATORS // PINBALL BUMPER FOREST // DUELING STEELIES',
  difficulty: 'AERIAL',
  parTimeSec: 50,
  bonusTimeSec: 20,
  startPos: [0, 1.75, 0],
  goalPos: [0, 8.42, -45.2],
  goalRadius: 2.65,
  killPlaneY: -8.0,
  overviewCenter: [0, 5.0, -22.5],
  overviewRadius: 27.0,
  theme: {
    name: 'Cerny Whimsical Pop-Art',
    trackPrimary: [0.42, 0.14, 0.52],
    trackSecondary: [0.26, 0.08, 0.36],
    gridLineColor: [1.0, 0.92, 0.24],
    wallColor: [0.22, 0.06, 0.3],
    skyZenith: [0.05, 0.02, 0.12],
    skyHorizon: [0.28, 0.08, 0.36],
    abyssFogColor: [0.18, 0.05, 0.26],
    abyssFogDensity: 0.95,
    sunDirection: [0.46, 0.82, 0.34],
  },
  checkpoints: [
    {
      id: 'cp-bumper-forest',
      label: 'PINBALL BUMPER FOREST',
      position: [0, 5.35, -15.0],
      radius: 4.5,
    },
    {
      id: 'cp-dueling-summit',
      label: 'DUELING STEELIE SUMMIT',
      position: [0, 8.95, -37.2],
      radius: 4.5,
    },
  ],
  portals: [
    {
      id: 'silly-uphill-express-portal',
      posA: [3.2, 5.45, -22.2],
      normalA: [0.0, 0.34, 0.9404],
      upA: [0.0, 0.9404, -0.34],
      posB: [3.2, 9.35, -38.5],
      normalB: [-0.28, 0.65, -0.7065],
      upB: [-0.28, 0.7065, 0.65],
      radius: 1.55,
      activeA: true,
      activeB: true,
      flingBoost: 1.25,
    },
  ],
  hazardManifest: [
    {
      id: 'uphill-conveyor-escalators',
      label: 'Uphill Conveyor Escalators',
      kind: 'conveyor',
      description: 'High-thrust conveyor ramps that propel the marble upward from y=1.2m to y=8.4m.',
    },
    {
      id: 'pinball-bumper-forest',
      label: 'Pinball Bumper Forest',
      kind: 'bumper',
      description: 'Whimsical cluster of chrome-red arcade bumpers and bounce pads.',
    },
    {
      id: 'sticky-catch-banks',
      label: 'Sticky-Wall Catch Banks',
      kind: 'conveyor',
      description: 'High-friction amber honeycomb banks that catch wild pinball ricochets.',
    },
    {
      id: 'dueling-steelies',
      label: 'Dueling Summit Steelies',
      kind: 'steelie',
      description: 'Twin counter-moving Black Steelie marbles guarding the uphill Goal Podium.',
    },
  ],
  nodes: [
    // --- TIER 1: LOW BASIN START PAD (yTop = 1.2) ---
    {
      id: 'c5-start-basin',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 0.6, 0],
      halfExtents: [4.2, 0.6, 3.8],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c5-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 0.7, 0],
      radius: 2.2,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c5-start-back-guard',
      kind: 'roundedBox',
      material: 'sticky',
      center: [0, 1.65, 3.5],
      halfExtents: [4.2, 0.45, 0.35],
      radius: 0.08,
    },

    // --- ESCALATOR 1: UPHILL CONVEYOR ESCALATOR (-Z, yTop: 1.2 -> 4.8) ---
    {
      id: 'c5-uphill-escalator-1',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 3.0, -8.4],
      axis: 'z',
      halfLength: 5.0,
      rise: -3.6,
      halfWidth: 2.8,
      thickness: 1.0,
      railHeight: 0.85,
      railThickness: 0.35,
      conveyorDirection: [0, 2.8, -8.5],
      supportBias: true,
    },

    // --- TIER 2: PINBALL BUMPER FOREST & STICKY-WALL BANKS (yTop = 4.8) ---
    {
      id: 'c5-bumper-forest-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.2, -19.4],
      halfExtents: [6.0, 0.6, 6.4],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'c5-sticky-wall-west',
      kind: 'roundedBox',
      material: 'sticky',
      center: [-5.3, 5.1, -19.4],
      halfExtents: [0.7, 0.65, 5.8],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'c5-sticky-wall-east',
      kind: 'roundedBox',
      material: 'sticky',
      center: [5.3, 5.1, -19.4],
      halfExtents: [0.7, 0.65, 5.8],
      radius: 0.1,
      supportBias: true,
    },
    {
      id: 'c5-sticky-brake-strip',
      kind: 'roundedBox',
      material: 'sticky',
      center: [0, 4.21, -24.2],
      halfExtents: [3.2, 0.6, 1.0],
      radius: 0.08,
      supportBias: true,
    },
    {
      id: 'c5-forest-bounce-west',
      kind: 'cylinder',
      material: 'bounce',
      center: [-3.8, 4.32, -19.4],
      radius: 0.95,
      halfHeight: 0.5,
    },
    {
      id: 'c5-forest-bounce-east',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.8, 4.32, -19.4],
      radius: 0.95,
      halfHeight: 0.5,
    },

    // --- ESCALATOR 2: SECOND UPHILL CONVEYOR ESCALATOR (-Z, yTop: 4.8 -> 8.4) ---
    {
      id: 'c5-uphill-escalator-2',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 6.6, -30.4],
      axis: 'z',
      halfLength: 5.0,
      rise: -3.6,
      halfWidth: 2.8,
      thickness: 1.0,
      railHeight: 0.85,
      railThickness: 0.35,
      conveyorDirection: [0, 2.8, -8.5],
      supportBias: true,
    },

    // --- SPEEDRUN EXPRESS SKY-ESCALATOR SHORTCUT (EAST FLANK) ---
    {
      id: 'c5-express-uphill-shortcut',
      kind: 'sweptTrack',
      material: 'conveyor',
      center: [0, 0, 0],
      start: [3.6, 4.82, -24.8],
      end: [3.6, 8.42, -36.0],
      halfWidth: 1.45,
      thickness: 0.8,
      railHeight: 0.45,
      railThickness: 0.25,
      conveyorDirection: [0, 3.2, -9.5],
      supportBias: true,
    },

    // --- TIER 3: DUELING STEELIES SUMMIT ARENA & GOAL PODIUM (yTop = 8.4) ---
    {
      id: 'c5-summit-arena',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 7.8, -41.4],
      halfExtents: [5.6, 0.6, 6.4],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'c5-summit-back-guard',
      kind: 'roundedBox',
      material: 'sticky',
      center: [0, 8.85, -47.4],
      halfExtents: [5.2, 0.45, 0.35],
      radius: 0.08,
    },
    {
      id: 'c5-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 7.9, -45.2],
      radius: 2.65,
      halfHeight: 0.52,
      supportBias: true,
    },
  ],
  hazards: [
    // Pinball Bumper Forest
    {
      id: 'c5-pinball-bumper-1',
      kind: 'cylinder',
      material: 'bumper',
      center: [-2.0, 5.35, -17.2],
      radius: 0.56,
      halfHeight: 0.55,
    },
    {
      id: 'c5-pinball-bumper-2',
      kind: 'cylinder',
      material: 'bumper',
      center: [2.0, 5.35, -17.2],
      radius: 0.56,
      halfHeight: 0.55,
    },
    {
      id: 'c5-pinball-bumper-3',
      kind: 'cylinder',
      material: 'bumper',
      center: [-2.2, 5.35, -21.2],
      radius: 0.56,
      halfHeight: 0.55,
    },
    {
      id: 'c5-pinball-bumper-4',
      kind: 'cylinder',
      material: 'bumper',
      center: [2.2, 5.35, -21.2],
      radius: 0.56,
      halfHeight: 0.55,
    },
    {
      id: 'c5-pinball-bumper-5',
      kind: 'cylinder',
      material: 'bumper',
      center: [1.4, 5.35, -19.2],
      radius: 0.58,
      halfHeight: 0.55,
    },
    // Dueling Steelies on the Summit Arena
    {
      id: 'c5-duel-steelie-orbit',
      kind: 'sphere',
      material: 'bumper',
      center: [2.0, 9.05, -40.0],
      radius: 0.64,
      kinematic: {
        kind: 'steelie',
        mode: 'orbit',
        span: [1.8, 0.0, 1.4],
        frequency: 0.44,
        phase: 0.0,
      },
    },
    {
      id: 'c5-duel-steelie-patrol',
      kind: 'sphere',
      material: 'bumper',
      center: [-2.0, 9.05, -42.2],
      radius: 0.64,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [1.8, 0.0, 0.0],
        frequency: 0.5,
        phase: 1.57,
      },
    },
  ],
};
