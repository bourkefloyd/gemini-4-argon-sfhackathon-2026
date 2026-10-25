/**
 * Course 8: RIPTIDE SURF BREAK (`src/courses/course-8-riptide-surf.ts`)
 *
 * All-Waves Beach Shorebreak & Outer Reef Surf Gauntlet:
 *   - Zone 1 — The Sandy Shoreline & Ankle-Biter Foam (`z = 0 -> -14`):
 *     Rolling down the beach boardwalk into the shallow swash zone with gentle `0.35m`
 *     rolling waves to learn Wave Pumping (accelerating down the backside of a wave crest).
 *   - Zone 2 — The Shorebreak Impact Zone & Undertow (`z = -14 -> -30`):
 *     Heavy `0.75m` oncoming shorebreak swells + an undertow conveyor current pushing toward
 *     the beach — with a West Sandbar Rip-Current Channel (fast conveyor current flowing out
 *     to sea!) and East Bounce-Kelp Buoys that let you vault over the breaking whitewater.
 *   - Zone 3 — Double-Overhead Rolling Swell Sets & Pier Pilings (`z = -30 -> -48`):
 *     Continuous rolling ocean wave floors weaving between SDF pier pilings and sweeping foam
 *     Steelies, plus a Tube Barrel Portal (`Blue -> Orange`) inside the curl of the wave.
 *   - Zone 4 — The Outer Reef Bomb & Goal Buoy (`z = -48 -> -64`):
 *     A massive outer-reef wave ramp that launches your marble onto the Outer Reef Lighthouse
 *     Goal Podium.
 */

import type { CourseSpec } from '../contracts';

export const COURSE_8_RIPTIDE_SURF: CourseSpec = {
  id: 'riptide-surf-break',
  index: 8,
  name: 'RIPTIDE SURF BREAK',
  subtitle:
    'Zone 1: Ankle-Biter Swash -> Zone 2: Shorebreak Undertow & Rip Channel -> Zone 3: Pier Pilings & Barrel Portal -> Zone 4: Outer Reef Bomb',
  difficulty: 'INTERMEDIATE',
  parTimeSec: 65,
  bonusTimeSec: 30,
  startPos: [0, 8.55, 0],
  goalPos: [0, 4.02, -61.2],
  goalRadius: 2.85,
  killPlaneY: -12.0,
  overviewCenter: [0, 5.8, -30.5],
  overviewRadius: 36.0,
  theme: {
    name: 'Pacific Riptide Turquoise',
    trackPrimary: [0.06, 0.36, 0.48],
    trackSecondary: [0.03, 0.22, 0.34],
    gridLineColor: [0.42, 0.96, 1.0],
    wallColor: [0.16, 0.28, 0.36],
    skyZenith: [0.02, 0.08, 0.18],
    skyHorizon: [0.14, 0.42, 0.56],
    abyssFogColor: [0.05, 0.22, 0.32],
    abyssFogDensity: 0.92,
    sunDirection: [0.48, 0.82, 0.31],
  },
  checkpoints: [
    {
      id: 'cp-sandbar-channel',
      label: 'SANDBAR RIP CHANNEL',
      position: [0, 6.15, -15.4],
      radius: 4.2,
    },
    {
      id: 'cp-pier-pilings',
      label: 'PIER PILINGS LINEUP',
      position: [0, 6.15, -31.6],
      radius: 4.2,
    },
    {
      id: 'cp-outer-reef-lineup',
      label: 'OUTER REEF BOMB LINEUP',
      position: [0, 6.15, -49.2],
      radius: 4.2,
    },
  ],
  portals: [
    {
      id: 'riptide-tube-barrel-portal',
      posA: [3.6, 6.2, -35.5],
      normalA: [0, 0, 1],
      upA: [0, 1, 0],
      posB: [2.8, 6.3, -49.6],
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
      id: 'ankle-biter-wave-pumping',
      label: 'Ankle-Biter Swash Swells',
      kind: 'waveFloor',
      description: 'Gentle 0.35m oncoming shoreline swells that teach wave pumping and crest timing.',
    },
    {
      id: 'shorebreak-undertow-current',
      label: 'Shorebreak Whitewater Undertow',
      kind: 'conveyor',
      description: 'Heavy 0.75m breaking swells paired with an oncoming beachward undertow current.',
    },
    {
      id: 'west-sandbar-rip-channel',
      label: 'West Sandbar Rip-Current Channel',
      kind: 'conveyor',
      description: 'Fast seaward rip current along the west sandbar that bypasses the shorebreak.',
    },
    {
      id: 'bounce-kelp-buoys',
      label: 'Bounce-Kelp Surf Buoys',
      kind: 'bumper',
      description: 'High-restitution kelp buoys on the east flank that vault over breaking whitewater.',
    },
    {
      id: 'pier-pilings-foam-steelies',
      label: 'Pier Pilings & Foam Steelies',
      kind: 'steelie',
      description: 'Weathered SDF pier pilings and sweeping whitewater foam Steelies in the double-overhead swell zone.',
    },
  ],
  nodes: [
    // =========================================================================
    // ZONE 1: THE SANDY SHORELINE & ANKLE-BITER FOAM (z = 0 -> -15.4)
    // =========================================================================
    {
      id: 'riptide-start-boardwalk',
      kind: 'roundedBox',
      material: 'start',
      center: [0, 7.4, 0],
      halfExtents: [4.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'riptide-zone1-shore-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [0, 6.8, -5.8],
      axis: 'z',
      halfLength: 2.8,
      rise: 2.4,
      halfWidth: 4.0,
      thickness: 1.0,
      railHeight: 0.65,
      supportBias: true,
    },
    {
      id: 'riptide-zone1-swash-subfloor',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.92, -11.0],
      halfExtents: [5.0, 0.55, 3.2],
      radius: 0.12,
      supportBias: true,
    },
    {
      id: 'riptide-zone1-ankle-biter-waves',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -11.0],
      halfExtents: [4.8, 0.6, 2.4],
      waveAmplitude: 0.35,
      waveFrequencyX: 0.35,
      waveFrequencyZ: 0.95,
      waveSpeed: -3.2,
      supportBias: true,
    },
    {
      id: 'riptide-zone1-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.1, 6.0, -11.0],
      halfExtents: [0.3, 0.9, 3.4],
      radius: 0.08,
    },
    {
      id: 'riptide-zone1-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.1, 6.0, -11.0],
      halfExtents: [0.3, 0.9, 3.4],
      radius: 0.08,
    },
    // Flat Checkpoint 1 Terrace: Sandbar Rip Channel Entry (yTop = 5.60)
    {
      id: 'riptide-zone1-sandbar-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -15.4],
      halfExtents: [5.4, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 2: THE SHOREBREAK IMPACT ZONE & UNDERTOW (z = -17 -> -31.6)
    // =========================================================================
    {
      id: 'riptide-zone2-sub-sandbar',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.95, -23.5],
      halfExtents: [5.4, 0.55, 6.6],
      radius: 0.12,
      supportBias: true,
    },
    // Center Shorebreak Impact Zone: Heavy 0.75m oncoming waves + beachward undertow current
    {
      id: 'riptide-zone2-shorebreak-waves',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -23.5],
      halfExtents: [2.2, 0.6, 5.2],
      waveAmplitude: 0.75,
      waveFrequencyX: 0.32,
      waveFrequencyZ: 0.88,
      waveSpeed: -3.8,
      supportBias: true,
    },
    {
      id: 'riptide-zone2-undertow-current',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [0, 4.98, -23.5],
      halfExtents: [2.1, 0.58, 5.0],
      radius: 0.10,
      conveyorDirection: [0, 0, 2.2],
      supportBias: true,
    },
    // West Sandbar Rip-Current Channel: Fast seaward conveyor flowing out to sea (-Z)!
    {
      id: 'riptide-zone2-west-rip-channel',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [-3.7, 5.02, -23.5],
      halfExtents: [1.5, 0.6, 6.4],
      radius: 0.12,
      conveyorDirection: [0, 0, -6.4],
      supportBias: true,
    },
    // East Bounce-Kelp Buoys: Vault over the shorebreak whitewater!
    {
      id: 'riptide-zone2-kelp-buoy-1',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.6, 5.1, -20.8],
      radius: 1.35,
      halfHeight: 0.58,
      supportBias: true,
    },
    {
      id: 'riptide-zone2-kelp-buoy-2',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.6, 5.1, -26.2],
      radius: 1.35,
      halfHeight: 0.58,
      supportBias: true,
    },
    {
      id: 'riptide-zone2-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.5, 6.0, -23.5],
      halfExtents: [0.3, 1.0, 6.8],
      radius: 0.08,
    },
    {
      id: 'riptide-zone2-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.5, 6.0, -23.5],
      halfExtents: [0.3, 1.0, 6.8],
      radius: 0.08,
    },
    // Flat Checkpoint 2 Terrace: Pier Pilings Lineup Deck (yTop = 5.60)
    {
      id: 'riptide-zone2-midbreak-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -31.6],
      halfExtents: [5.4, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 3: DOUBLE-OVERHEAD ROLLING SWELL SETS & PIER PILINGS (z = -33 -> -49.2)
    // =========================================================================
    {
      id: 'riptide-zone3-reef-base',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.95, -40.4],
      halfExtents: [5.2, 0.55, 7.2],
      radius: 0.12,
      supportBias: true,
    },
    {
      id: 'riptide-zone3-double-overhead-swells',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -40.4],
      halfExtents: [5.0, 0.6, 6.0],
      waveAmplitude: 0.45,
      waveFrequencyX: 0.38,
      waveFrequencyZ: 0.85,
      waveSpeed: -3.4,
      supportBias: true,
    },
    // SDF Pier Pilings & Overhead Pier Crossbeam Arch
    {
      id: 'riptide-pier-piling-west-1',
      kind: 'cylinder',
      material: 'standard',
      center: [-3.2, 6.8, -37.2],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'riptide-pier-piling-east-1',
      kind: 'cylinder',
      material: 'standard',
      center: [3.2, 6.8, -37.2],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'riptide-pier-piling-west-2',
      kind: 'cylinder',
      material: 'standard',
      center: [-3.2, 6.8, -43.6],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'riptide-pier-piling-east-2',
      kind: 'cylinder',
      material: 'standard',
      center: [3.2, 6.8, -43.6],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'riptide-pier-arch-lintel',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 8.8, -40.4],
      halfExtents: [5.2, 0.38, 0.65],
      radius: 0.10,
    },
    {
      id: 'riptide-zone3-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.4, 6.0, -40.4],
      halfExtents: [0.3, 1.0, 7.2],
      radius: 0.08,
    },
    {
      id: 'riptide-zone3-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.4, 6.0, -40.4],
      halfExtents: [0.3, 1.0, 7.2],
      radius: 0.08,
    },
    // Flat Checkpoint 3 Terrace: Outer Reef Bomb Lineup (yTop = 5.60)
    {
      id: 'riptide-zone3-outer-reef-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -49.2],
      halfExtents: [5.2, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 4: THE OUTER REEF BOMB & LIGHTHOUSE GOAL PODIUM (z = -51 -> -64)
    // =========================================================================
    {
      id: 'riptide-zone4-reef-bomb-ramp',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 4.8, -54.5],
      axis: 'z',
      halfLength: 4.0,
      rise: 1.6,
      halfWidth: 4.2,
      thickness: 1.0,
      railHeight: 0.75,
      conveyorDirection: [0, 0, -5.8],
      supportBias: true,
    },
    {
      id: 'riptide-zone4-bomb-crest-wave',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 3.35, -58.0],
      halfExtents: [4.2, 0.55, 1.8],
      waveAmplitude: 0.22,
      waveFrequencyX: 0.30,
      waveFrequencyZ: 0.85,
      waveSpeed: -3.5,
      supportBias: true,
    },
    {
      id: 'riptide-goal-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 3.4, -61.2],
      halfExtents: [5.0, 0.6, 3.6],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'riptide-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 3.52, -61.2],
      radius: 2.9,
      halfHeight: 0.50,
      supportBias: true,
    },
    {
      id: 'riptide-lighthouse-tower',
      kind: 'cylinder',
      material: 'standard',
      center: [0, 6.2, -64.2],
      radius: 0.85,
      halfHeight: 2.4,
    },
    {
      id: 'riptide-lighthouse-beacon',
      kind: 'torus',
      material: 'goal',
      center: [0, 8.8, -64.2],
      majorRadius: 1.25,
      minorRadius: 0.24,
    },
  ],
  hazards: [
    // Sweeping whitewater foam Steelies in the Pier Pilings swell zone
    {
      id: 'riptide-foam-steelie-1',
      kind: 'sphere',
      material: 'bumper',
      center: [-2.1, 6.25, -39.0],
      radius: 0.55,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [1.1, 0, 0],
        frequency: 0.48,
        phase: 0,
      },
    },
    {
      id: 'riptide-foam-steelie-2',
      kind: 'sphere',
      material: 'bumper',
      center: [2.1, 6.25, -42.0],
      radius: 0.55,
      kinematic: {
        kind: 'steelie',
        mode: 'patrol',
        span: [1.1, 0, 0],
        frequency: 0.48,
        phase: 3.14159,
      },
    },
  ],
};
