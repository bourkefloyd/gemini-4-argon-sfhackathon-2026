/**
 * Course 10: SAHARA DUNE SURGE (`src/courses/course-10-sahara-dunes.ts`)
 *
 * Desert Sand Dunes Surf Variant ("Sahara Dune Surge"):
 *   - Zone 1 — Sun-Baked Barchan Ripples (`z = 0 -> -15.4`):
 *     Roll down from the Desert Caravan Outpost onto golden wind-swept `waveFloor`
 *     sand ripples to build speed down the slip-face of each dune crest.
 *   - Zone 2 — Quicksand Trough & Trade-Wind Jetstream (`z = -15.4 -> -31.6`):
 *     Shifting golden dune swells with soft high-drag `sticky` quicksand troughs and
 *     desert headwind conveyors in the basin, flanked by a fast West Trade-Wind
 *     Jetstream (`conveyor`) and East Oasis Bounce Geysers (`bounce`).
 *   - Zone 3 — Eroded Sandstone Hoodoos & Desert Mirage Portal (`z = -31.6 -> -49.2`):
 *     Towering golden mega-dune `waveFloor` swells weaving between carved SDF Sandstone
 *     Pillars, patrolling Dust-Devil Steelies, and a Desert Mirage Portal (`Blue -> Orange`).
 *   - Zone 4 — The Singing Mega-Dune Ramp & Oasis Goal Sanctuary (`z = -49.2 -> -61.2`):
 *     A sweeping golden dune launch ramp into the Oasis Sanctuary Goal Podium crowned by
 *     a floating Desert Sun Obelisk!
 */

import type { CourseSpec } from '../contracts';

export const COURSE_10_SAHARA_DUNES: CourseSpec = {
  id: 'sahara-dune-surge',
  index: 10,
  name: 'SAHARA DUNE SURGE',
  subtitle:
    'Zone 1: Barchan Sand Ripples -> Zone 2: Quicksand Basin & Trade-Wind Jetstream -> Zone 3: Sandstone Hoodoos & Mirage Portal -> Zone 4: Mega-Dune Oasis',
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
    name: 'Sahara Sunset Terracotta & Gold',
    trackPrimary: [0.68, 0.44, 0.16],
    trackSecondary: [0.46, 0.26, 0.08],
    gridLineColor: [1.0, 0.84, 0.32],
    wallColor: [0.54, 0.28, 0.14],
    skyZenith: [0.16, 0.06, 0.08],
    skyHorizon: [0.76, 0.38, 0.14],
    abyssFogColor: [0.48, 0.24, 0.10],
    abyssFogDensity: 0.92,
    sunDirection: [0.58, 0.74, 0.34],
  },
  checkpoints: [
    {
      id: 'cp-sahara-tradewind',
      label: 'TRADE-WIND DUNE RIDGE',
      position: [0, 6.15, -15.4],
      radius: 4.2,
    },
    {
      id: 'cp-sahara-hoodoos',
      label: 'SANDSTONE HOODOO CANYON',
      position: [0, 6.15, -31.6],
      radius: 4.2,
    },
    {
      id: 'cp-sahara-megadune',
      label: 'MEGA-DUNE CREST LINEUP',
      position: [0, 6.15, -49.2],
      radius: 4.2,
    },
  ],
  portals: [
    {
      id: 'sahara-mirage-portal',
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
      id: 'barchan-sand-ripples',
      label: 'Wind-Swept Barchan Sand Dunes',
      kind: 'waveFloor',
      description: 'Rolling golden sand dune crests that reward pumping down the slip-face.',
    },
    {
      id: 'quicksand-sticky-troughs',
      label: 'Soft Quicksand Troughs & Desert Headwind',
      kind: 'conveyor',
      description: 'High-drag sticky quicksand pockets paired with oncoming desert wind currents.',
    },
    {
      id: 'west-tradewind-jetstream',
      label: 'West Hard-Packed Trade-Wind Jetstream',
      kind: 'conveyor',
      description: 'Fast tailwind slipstream along the hard-packed western dune ridge.',
    },
    {
      id: 'oasis-bounce-geysers',
      label: 'East Oasis Updraft Geysers',
      kind: 'bumper',
      description: 'Spring-fed oasis bounce pads that launch your marble across the quicksand basin.',
    },
    {
      id: 'sandstone-hoodoos-dust-devils',
      label: 'Sandstone Hoodoos & Dust-Devil Steelies',
      kind: 'steelie',
      description: 'Carved red-rock sandstone pillars and swirling Dust-Devil Steelies.',
    },
  ],
  nodes: [
    // =========================================================================
    // ZONE 1: CARAVAN OUTPOST & BARCHAN SAND RIPPLES (z = 0 -> -15.4)
    // =========================================================================
    {
      id: 'sahara-start-outpost',
      kind: 'roundedBox',
      material: 'start',
      center: [0, 7.4, 0],
      halfExtents: [4.2, 0.6, 3.6],
      radius: 0.14,
      supportBias: true,
    },
    {
      id: 'sahara-zone1-dune-drop',
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
      id: 'sahara-zone1-bedrock',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.92, -11.0],
      halfExtents: [5.0, 0.55, 3.2],
      radius: 0.12,
      supportBias: true,
    },
    {
      id: 'sahara-zone1-barchan-waves',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -11.0],
      halfExtents: [4.8, 0.6, 2.4],
      waveAmplitude: 0.36,
      waveFrequencyX: 0.34,
      waveFrequencyZ: 0.92,
      waveSpeed: -3.0,
      supportBias: true,
    },
    {
      id: 'sahara-zone1-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.1, 6.0, -11.0],
      halfExtents: [0.3, 0.9, 3.4],
      radius: 0.08,
    },
    {
      id: 'sahara-zone1-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.1, 6.0, -11.0],
      halfExtents: [0.3, 0.9, 3.4],
      radius: 0.08,
    },
    // Flat Checkpoint 1 Terrace: Trade-Wind Dune Ridge (yTop = 5.60)
    {
      id: 'sahara-zone1-ridge-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -15.4],
      halfExtents: [5.4, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 2: QUICKSAND BASIN & TRADE-WIND JETSTREAM (z = -17 -> -31.6)
    // =========================================================================
    {
      id: 'sahara-zone2-sub-bedrock',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.95, -23.5],
      halfExtents: [5.4, 0.55, 6.6],
      radius: 0.12,
      supportBias: true,
    },
    // Center Shifting Dune Swells + Soft Sticky Quicksand Troughs
    {
      id: 'sahara-zone2-dune-swells',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -23.5],
      halfExtents: [2.2, 0.6, 5.2],
      waveAmplitude: 0.72,
      waveFrequencyX: 0.30,
      waveFrequencyZ: 0.86,
      waveSpeed: -3.5,
      supportBias: true,
    },
    {
      id: 'sahara-zone2-quicksand-trough-1',
      kind: 'roundedBox',
      material: 'sticky',
      center: [0, 4.99, -20.5],
      halfExtents: [1.8, 0.58, 1.6],
      radius: 0.10,
      supportBias: true,
    },
    {
      id: 'sahara-zone2-quicksand-trough-2',
      kind: 'roundedBox',
      material: 'sticky',
      center: [0, 4.99, -26.5],
      halfExtents: [1.8, 0.58, 1.6],
      radius: 0.10,
      supportBias: true,
    },
    // West Hard-Packed Trade-Wind Jetstream: Fast tailwind out across the dunes!
    {
      id: 'sahara-zone2-west-tradewind-jetstream',
      kind: 'roundedBox',
      material: 'conveyor',
      center: [-3.7, 5.02, -23.5],
      halfExtents: [1.5, 0.6, 6.4],
      radius: 0.12,
      conveyorDirection: [0, 0, -6.5],
      supportBias: true,
    },
    // East Oasis Updraft Bounce Geysers
    {
      id: 'sahara-zone2-oasis-geyser-1',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.6, 5.1, -20.8],
      radius: 1.35,
      halfHeight: 0.58,
      supportBias: true,
    },
    {
      id: 'sahara-zone2-oasis-geyser-2',
      kind: 'cylinder',
      material: 'bounce',
      center: [3.6, 5.1, -26.2],
      radius: 1.35,
      halfHeight: 0.58,
      supportBias: true,
    },
    {
      id: 'sahara-zone2-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.5, 6.0, -23.5],
      halfExtents: [0.3, 1.0, 6.8],
      radius: 0.08,
    },
    {
      id: 'sahara-zone2-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.5, 6.0, -23.5],
      halfExtents: [0.3, 1.0, 6.8],
      radius: 0.08,
    },
    // Flat Checkpoint 2 Terrace: Sandstone Hoodoo Canyon (yTop = 5.60)
    {
      id: 'sahara-zone2-canyon-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -31.6],
      halfExtents: [5.4, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 3: SANDSTONE HOODOOS & DESERT MIRAGE PORTAL (z = -33 -> -49.2)
    // =========================================================================
    {
      id: 'sahara-zone3-canyon-base',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 4.95, -40.4],
      halfExtents: [5.2, 0.55, 7.2],
      radius: 0.12,
      supportBias: true,
    },
    {
      id: 'sahara-zone3-rolling-erg-dunes',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 5.0, -40.4],
      halfExtents: [5.0, 0.6, 6.0],
      waveAmplitude: 0.44,
      waveFrequencyX: 0.36,
      waveFrequencyZ: 0.84,
      waveSpeed: -3.2,
      supportBias: true,
    },
    // Carved SDF Sandstone Hoodoo Pillars & Natural Desert Arch
    {
      id: 'sahara-hoodoo-west-1',
      kind: 'cylinder',
      material: 'standard',
      center: [-3.2, 6.8, -37.2],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'sahara-hoodoo-east-1',
      kind: 'cylinder',
      material: 'standard',
      center: [3.2, 6.8, -37.2],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'sahara-hoodoo-west-2',
      kind: 'cylinder',
      material: 'standard',
      center: [-3.2, 6.8, -43.6],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'sahara-hoodoo-east-2',
      kind: 'cylinder',
      material: 'standard',
      center: [3.2, 6.8, -43.6],
      radius: 0.50,
      halfHeight: 1.8,
    },
    {
      id: 'sahara-sandstone-arch',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 8.8, -40.4],
      halfExtents: [5.2, 0.40, 0.68],
      radius: 0.12,
    },
    {
      id: 'sahara-zone3-wall-west',
      kind: 'roundedBox',
      material: 'standard',
      center: [-5.4, 6.0, -40.4],
      halfExtents: [0.3, 1.0, 7.2],
      radius: 0.08,
    },
    {
      id: 'sahara-zone3-wall-east',
      kind: 'roundedBox',
      material: 'standard',
      center: [5.4, 6.0, -40.4],
      halfExtents: [0.3, 1.0, 7.2],
      radius: 0.08,
    },
    // Flat Checkpoint 3 Terrace: Mega-Dune Crest Lineup (yTop = 5.60)
    {
      id: 'sahara-zone3-megadune-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 5.0, -49.2],
      halfExtents: [5.2, 0.6, 2.2],
      radius: 0.14,
      supportBias: true,
    },

    // =========================================================================
    // ZONE 4: SINGING MEGA-DUNE RAMP & OASIS GOAL SANCTUARY (z = -51 -> -64)
    // =========================================================================
    {
      id: 'sahara-zone4-megadune-ramp',
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
      id: 'sahara-zone4-slipface-wave',
      kind: 'waveFloor',
      material: 'standard',
      center: [0, 3.35, -58.0],
      halfExtents: [4.2, 0.55, 1.8],
      waveAmplitude: 0.22,
      waveFrequencyX: 0.30,
      waveFrequencyZ: 0.85,
      waveSpeed: -3.4,
      supportBias: true,
    },
    {
      id: 'sahara-oasis-goal-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 3.4, -61.2],
      halfExtents: [5.0, 0.6, 3.6],
      radius: 0.16,
      supportBias: true,
    },
    {
      id: 'sahara-oasis-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 3.52, -61.2],
      radius: 2.9,
      halfHeight: 0.50,
      supportBias: true,
    },
    {
      id: 'sahara-sun-obelisk',
      kind: 'cylinder',
      material: 'standard',
      center: [0, 6.2, -64.2],
      radius: 0.85,
      halfHeight: 2.4,
    },
    {
      id: 'sahara-sun-halo',
      kind: 'torus',
      material: 'goal',
      center: [0, 8.8, -64.2],
      majorRadius: 1.25,
      minorRadius: 0.24,
    },
  ],
  hazards: [
    // Swirling Dust-Devil Steelies in the Sandstone Hoodoo Canyon
    {
      id: 'sahara-dust-devil-steelie-1',
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
      id: 'sahara-dust-devil-steelie-2',
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
