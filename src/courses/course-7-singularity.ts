/**
 * Course 7: SDF SINGULARITY LAB (`src/courses/course-7-singularity.ts`)
 *
 * Showcase limit-test course pushing the mathematical, visual, and 120 Hz physics limits
 * of analytical Raymarched SDFs vs traditional polygon meshes:
 *   1. Morphing Ferrofluid Metaball Cluster: 4 counter-orbiting `smoothUnion` spheres
 *      (`smoothRadius = 0.88`) that continuously merge and split, testing 120 Hz `jSDF`
 *      meniscus launch physics and dynamic curvature highlights.
 *   2. High-Banked Corkscrew / S-Halfpipe: Smoothly blended (`smoothUnion`) high-G banked
 *      chutes testing C^infinity wall-riding at 22+ u/s without polygon facet chatter.
 *   3. Multi-Portal Momentum Accelerator Loop: Non-Euclidean SDF portal pairs that preserve
 *      and amplify momentum across spatial discontinuities.
 */

import type { CourseSpec } from '../contracts';

export const COURSE_7_SDF_SINGULARITY_LAB: CourseSpec = {
  id: 'sdf-singularity-lab',
  index: 7,
  name: 'SDF SINGULARITY LAB',
  subtitle: 'FERROFLUID METABALLS // HIGH-G S-HALFPIPE // MULTI-PORTAL ACCELERATOR',
  difficulty: 'ULTIMATE',
  parTimeSec: 58,
  bonusTimeSec: 22,
  startPos: [0, 16.55, 0],
  goalPos: [0, 4.22, -52.0],
  goalRadius: 2.85,
  killPlaneY: -15.0,
  overviewCenter: [0, 9.2, -26.0],
  overviewRadius: 32.0,
  theme: {
    name: 'Obsidian Gold Cathedral',
    trackPrimary: [0.09, 0.12, 0.22],
    trackSecondary: [0.05, 0.07, 0.14],
    gridLineColor: [1.0, 0.82, 0.28],
    wallColor: [0.14, 0.18, 0.32],
    skyZenith: [0.01, 0.02, 0.06],
    skyHorizon: [0.08, 0.16, 0.32],
    abyssFogColor: [0.04, 0.09, 0.20],
    abyssFogDensity: 0.95,
    sunDirection: [0.54, 0.78, 0.31],
  },
  checkpoints: [
    {
      id: 'cp-ferrofluid-arena',
      label: 'FERROFLUID METABALL PLAZA',
      position: [0, 10.75, -20.0],
      radius: 4.8,
    },
    {
      id: 'cp-portal-accelerator',
      label: 'PORTAL ACCELERATOR DECK',
      position: [0, 6.75, -36.5],
      radius: 4.8,
    },
  ],
  portals: [
    {
      id: 'singularity-accelerator-loop-1',
      posA: [0, 7.35, -31.8],
      normalA: [0, 0, 1],
      upA: [0, 1, 0],
      posB: [0, 7.65, -36.2],
      normalB: [0, 0, -1],
      upB: [0, 1, 0],
      radius: 1.55,
      flingBoost: 1.35,
      activeA: true,
      activeB: true,
    },
    {
      id: 'singularity-accelerator-loop-2',
      posA: [-3.4, 7.15, -39.5],
      normalA: [1, 0, 0],
      upA: [0, 1, 0],
      posB: [0, 5.45, -44.2],
      normalB: [0, 0, -1],
      upB: [0, 1, 0],
      radius: 1.45,
      flingBoost: 1.25,
      activeA: true,
      activeB: true,
    },
  ],
  hazardManifest: [
    {
      id: 'ferrofluid-metaball-cluster',
      label: 'Morphing Ferrofluid Metaball Cluster',
      kind: 'steelie',
      description:
        '4 counter-orbiting smoothUnion spheres (k = 0.88) that continuously merge and split, testing 120 Hz jSDF meniscus launch physics.',
    },
    {
      id: 'high-g-corkscrew-halfpipe',
      label: 'High-Banked Corkscrew / S-Halfpipe',
      kind: 'conveyor',
      description:
        'C^infinity smooth-blended S-curve halfpipe engineered for 22+ u/s high-G wall-riding without polygon facet chatter.',
    },
    {
      id: 'multi-portal-accelerator',
      label: 'Multi-Portal Momentum Accelerator Loop',
      kind: 'bumper',
      description:
        'Dual non-Euclidean SDF portal pairs that bend rays and amplify marble velocity by 1.35x across the chasm.',
    },
  ],
  nodes: [
    // --- TIER 1: SINGULARITY APEX LAUNCH DECK (yTop = 16.0) ---
    {
      id: 'c7-start-podium',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 15.4, 0],
      halfExtents: [4.2, 0.6, 4.0],
      radius: 0.18,
      supportBias: true,
    },
    {
      id: 'c7-start-pad',
      kind: 'cylinder',
      material: 'start',
      center: [0, 15.5, 0],
      radius: 2.35,
      halfHeight: 0.5,
      supportBias: true,
    },
    {
      id: 'c7-start-arch-torus',
      kind: 'torus',
      material: 'standard',
      center: [0, 17.8, -2.8],
      majorRadius: 3.4,
      minorRadius: 0.28,
    },

    // --- SECTION 1: HIGH-BANKED CORKSCREW / S-HALFPIPE (z = -3.6 to -15.6, yTop: 16.0 -> 10.2) ---
    {
      id: 'c7-halfpipe-drop-entry',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 14.3, -6.2],
      axis: 'z',
      halfLength: 3.4,
      rise: 3.4,
      halfWidth: 3.2,
      thickness: 1.1,
      railHeight: 1.25,
      railThickness: 0.42,
      conveyorDirection: [1.8, -2.5, -9.5],
      supportBias: true,
    },
    {
      id: 'c7-corkscrew-sweep-east',
      kind: 'sweptTrack',
      material: 'ice',
      center: [0, 0, 0],
      start: [0.6, 12.6, -8.8],
      end: [2.2, 11.4, -12.2],
      halfWidth: 3.1,
      thickness: 1.1,
      railHeight: 1.35,
      railThickness: 0.45,
      supportBias: true,
    },
    {
      id: 'c7-corkscrew-sweep-west',
      kind: 'sweptTrack',
      material: 'conveyor',
      center: [0, 0, 0],
      start: [1.8, 11.4, -11.8],
      end: [0.0, 10.2, -16.0],
      halfWidth: 3.2,
      thickness: 1.1,
      railHeight: 1.35,
      railThickness: 0.45,
      conveyorDirection: [-1.6, -1.8, -10.5],
      supportBias: true,
    },

    // --- TIER 2: MORPHING FERROFLUID METABALL ARENA (yTop = 10.2, z = -16.0 to -25.2) ---
    {
      id: 'c7-ferrofluid-arena-deck',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 9.6, -20.6],
      halfExtents: [5.4, 0.6, 5.2],
      radius: 0.22,
      supportBias: true,
    },

    // --- SECTION 2: MULTI-PORTAL MOMENTUM ACCELERATOR LOOP (z = -25.2 to -44.5, yTop: 10.2 -> 6.2 -> 4.2) ---
    {
      id: 'c7-accelerator-chute',
      kind: 'ramp',
      material: 'conveyor',
      center: [0, 8.2, -29.2],
      axis: 'z',
      halfLength: 4.4,
      rise: 4.0,
      halfWidth: 2.8,
      thickness: 1.0,
      railHeight: 0.95,
      railThickness: 0.35,
      conveyorDirection: [0, -2.2, -9.2],
      supportBias: true,
    },
    {
      id: 'c7-portal-plaza-deck',
      kind: 'roundedBox',
      material: 'ice',
      center: [0, 5.6, -37.2],
      halfExtents: [4.8, 0.6, 4.4],
      radius: 0.18,
      supportBias: true,
    },
    {
      id: 'c7-final-glide-ramp',
      kind: 'ramp',
      material: 'standard',
      center: [0, 5.2, -44.6],
      axis: 'z',
      halfLength: 3.8,
      rise: 2.0,
      halfWidth: 3.0,
      thickness: 1.0,
      railHeight: 0.85,
      railThickness: 0.32,
      supportBias: true,
    },

    // --- TIER 3: SINGULARITY GOAL HORIZON PODIUM (yTop = 4.2, z = -52.0) ---
    {
      id: 'c7-goal-podium-base',
      kind: 'roundedBox',
      material: 'standard',
      center: [0, 3.6, -52.0],
      halfExtents: [5.4, 0.6, 4.8],
      radius: 0.22,
      supportBias: true,
    },
    {
      id: 'c7-goal-pad',
      kind: 'cylinder',
      material: 'goal',
      center: [0, 3.7, -52.0],
      radius: 2.85,
      halfHeight: 0.52,
      supportBias: true,
    },
    {
      id: 'c7-singularity-halo-outer',
      kind: 'torus',
      material: 'standard',
      center: [0, 7.2, -55.0],
      majorRadius: 4.2,
      minorRadius: 0.35,
    },
  ],
  scene: {
    id: 'c7-singularity-csg-scene',
    kind: 'union',
    children: [
      // 1. High-Banked Corkscrew / S-Halfpipe C^infinity smoothUnion banking walls & transitions
      {
        id: 'c7-corkscrew-s-halfpipe',
        kind: 'smoothUnion',
        smoothRadius: 0.48,
        children: [
          {
            id: 'c7-corkscrew-bank-wall-east',
            kind: 'capsule',
            material: 'ice',
            center: [0, 0, 0],
            a: [3.2, 13.4, -8.6],
            b: [4.5, 12.0, -12.4],
            radius: 0.85,
          },
          {
            id: 'c7-corkscrew-bank-fillet-east',
            kind: 'roundedBox',
            material: 'ice',
            center: [2.8, 12.0, -10.5],
            halfExtents: [0.95, 0.55, 2.2],
            radius: 0.24,
            supportBias: true,
          },
          {
            id: 'c7-corkscrew-bank-wall-west',
            kind: 'capsule',
            material: 'standard',
            center: [0, 0, 0],
            a: [-3.1, 12.2, -11.8],
            b: [-3.2, 11.1, -16.0],
            radius: 0.85,
          },
          {
            id: 'c7-corkscrew-bank-fillet-west',
            kind: 'roundedBox',
            material: 'conveyor',
            center: [-2.4, 10.9, -13.9],
            halfExtents: [0.95, 0.55, 2.2],
            radius: 0.24,
            conveyorDirection: [-0.8, -1.2, -9.5],
            supportBias: true,
          },
        ],
      },
      // 2. Morphing Ferrofluid Metaball Cluster: 4 orbiting smoothUnion spheres (k = 0.88)
      // that merge and split continuously on the arena deck, testing 120 Hz jSDF meniscus physics!
      {
        id: 'c7-ferrofluid-metaball-cluster',
        kind: 'smoothUnion',
        smoothRadius: 0.88,
        children: [
          {
            id: 'c7-metaball-orb-1',
            kind: 'sphere',
            material: 'bumper',
            center: [0, 10.55, -20.6],
            radius: 0.78,
            kinematic: {
              kind: 'steelie',
              mode: 'orbit',
              span: [1.65, 0.22, 1.35],
              frequency: 0.42,
              phase: 0.0,
            },
          },
          {
            id: 'c7-metaball-orb-2',
            kind: 'sphere',
            material: 'bumper',
            center: [0, 10.55, -20.6],
            radius: 0.78,
            kinematic: {
              kind: 'steelie',
              mode: 'orbit',
              span: [1.65, 0.22, 1.35],
              frequency: 0.42,
              phase: 1.57079,
            },
          },
          {
            id: 'c7-metaball-orb-3',
            kind: 'sphere',
            material: 'bounce',
            center: [0, 10.65, -20.6],
            radius: 0.72,
            kinematic: {
              kind: 'steelie',
              mode: 'orbit',
              span: [1.15, 0.28, 1.85],
              frequency: 0.56,
              phase: 3.14159,
            },
          },
          {
            id: 'c7-metaball-orb-4',
            kind: 'sphere',
            material: 'bounce',
            center: [0, 10.65, -20.6],
            radius: 0.72,
            kinematic: {
              kind: 'steelie',
              mode: 'patrol',
              span: [2.1, 0.18, 0.0],
              frequency: 0.64,
              phase: 0.785,
            },
          },
        ],
      },
      // 3. Goal Chalice Podium smoothSubtract sculptural arch
      {
        id: 'c7-goal-chalice-podium',
        kind: 'smoothSubtract',
        smoothRadius: 0.32,
        children: [
          {
            id: 'c7-goal-chalice-pedestal',
            kind: 'roundedBox',
            material: 'standard',
            center: [-4.2, 4.4, -52.0],
            halfExtents: [1.1, 0.8, 2.2],
            radius: 0.22,
          },
          {
            id: 'c7-goal-moat-ring-west',
            kind: 'sphere',
            material: 'standard',
            center: [-4.2, 5.1, -52.0],
            radius: 0.75,
          },
        ],
      },
    ],
  },
  hazards: [
    // High-speed kinetic piston guarding the Accelerator Chute entry
    {
      id: 'c7-singularity-piston',
      kind: 'piston',
      material: 'bumper',
      center: [0, 12.8, -24.2],
      headHalfExtents: [1.2, 0.65, 0.85],
      bevelRadius: 0.14,
      kinematic: {
        kind: 'piston',
        axis: [0, -1, 0],
        stroke: 1.75,
        frequency: 0.68,
        phase: 0.5,
        slamSharpness: 2.2,
      },
    },
  ],
};
