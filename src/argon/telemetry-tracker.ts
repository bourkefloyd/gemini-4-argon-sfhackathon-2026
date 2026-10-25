/**
 * 120 Hz Player Run Telemetry Recorder & Analyzer (`src/argon/telemetry-tracker.ts`)
 *
 * Captures and summarizes the player's live 120 Hz run history so Gemini 4 Argon
 * (`gemini-4-argon`, `thinking_level: "high"`) can diagnose exact failure coordinates,
 * slip/backspin brake spikes, speed distributions, and completion splits inside its
 * 1M-token context window.
 *
 * Honesty Pass: Never fabricates fake deaths or fake frames when no run has been recorded;
 * reports actual recorded frame & death counts (0 before play, real events during play).
 */

import type { CourseSpec, SurfaceMaterial, Vec3 } from '../contracts';

export interface TelemetryDeathEvent {
  readonly id: string;
  readonly courseId: string;
  readonly timestampSec: number;
  readonly cause: 'fell' | 'shattered' | 'sunk';
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly speed: number;
  readonly surfaceMaterial: SurfaceMaterial;
  readonly nearestNodeId: string;
}

export interface TelemetrySlipZone {
  readonly position: Vec3;
  readonly speed: number;
  readonly slipIntensity: number;
  readonly action: 'backspin-brake' | 'lateral-carve' | 'ice-drift' | 'rim-save';
  readonly surfaceMaterial: SurfaceMaterial;
}

export interface TelemetrySplitSample {
  readonly label: string;
  readonly timestampSec: number;
  readonly timeRemainingSec: number;
  readonly speed: number;
  readonly position: Vec3;
}

export type PlayerPlaystyleArchetype =
  | 'High-Speed Chute Daredevil'
  | 'Precision Catwalk Tactician'
  | 'Edge-Carving Rim-Saver'
  | 'Aggressive Trackball Brawler'
  | 'Awaiting Live Run Telemetry';

export interface PlayerRunTelemetrySummary {
  readonly courseId: string;
  readonly courseName: string;
  readonly sampleRateHz: 120;
  readonly totalFramesRecorded: number;
  readonly durationSec: number;
  readonly peakSpeed: number;
  readonly averageSpeed: number;
  readonly airborneRatio: number;
  readonly groundedRatio: number;
  readonly completionSplits: readonly TelemetrySplitSample[];
  readonly deathEvents: readonly TelemetryDeathEvent[];
  readonly slipBrakeHeatmap: readonly TelemetrySlipZone[];
  readonly speedProfileHistogram: readonly {
    readonly bucketLabel: string;
    readonly ratio: number;
  }[];
  readonly trajectoryPolyline: readonly Vec3[];
  readonly inferredArchetype: PlayerPlaystyleArchetype;
  readonly coachingDiagnosis: string;
  readonly isBaselineSample?: boolean;
}

function roundVec3(v: Vec3): Vec3 {
  return [
    Math.round(v[0] * 100) / 100,
    Math.round(v[1] * 100) / 100,
    Math.round(v[2] * 100) / 100,
  ];
}

function findNearestNodeId(course: CourseSpec, pos: Vec3): string {
  let bestId = course.nodes[0]?.id ?? 'course-root';
  let bestDist = Infinity;
  for (const node of [...course.nodes, ...course.hazards]) {
    const d = Math.hypot(
      pos[0] - node.center[0],
      pos[1] - node.center[1],
      pos[2] - node.center[2],
    );
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id ?? node.kind;
    }
  }
  return bestId;
}

/**
 * Honest zero-fabrication initial state when no live run frames have been recorded yet.
 */
export function buildEmptyLiveTelemetryForCourse(
  course: CourseSpec,
): PlayerRunTelemetrySummary {
  return {
    courseId: course.id,
    courseName: course.name,
    sampleRateHz: 120,
    totalFramesRecorded: 0,
    durationSec: 0,
    peakSpeed: 0,
    averageSpeed: 0,
    airborneRatio: 0,
    groundedRatio: 1,
    completionSplits: [],
    deathEvents: [],
    slipBrakeHeatmap: [],
    speedProfileHistogram: [
      { bucketLabel: '0–6 u/s (Creep / Precision)', ratio: 0 },
      { bucketLabel: '6–14 u/s (Tourist Cruise)', ratio: 0 },
      { bucketLabel: '14–20 u/s (Banked Carve)', ratio: 0 },
      { bucketLabel: '20–24+ u/s (Terminal Fling)', ratio: 0 },
    ],
    trajectoryPolyline: [roundVec3(course.startPos)],
    inferredArchetype: 'Awaiting Live Run Telemetry',
    coachingDiagnosis: `0 frames recorded on ${course.name} so far. Roll the marble to capture real 120 Hz velocity, slip, and death telemetry, or synthesize directly from course geometry.`,
    isBaselineSample: false,
  };
}

/**
 * Generates a reference sample 120 Hz telemetry trace for a given `CourseSpec`
 * (used by unit tests and explicitly labeled sample coaching benchmarks).
 */
export function buildDefaultTelemetryForCourse(
  course: CourseSpec,
): PlayerRunTelemetrySummary {
  const start = course.startPos;
  const goal = course.goalPos;
  const midX = (start[0] + goal[0]) * 0.5;
  const midY = (start[1] + goal[1]) * 0.5;
  const midZ = (start[2] + goal[2]) * 0.5;

  const deathEvents: TelemetryDeathEvent[] = [
    {
      id: `${course.id}-death-1`,
      courseId: course.id,
      timestampSec: 8.4,
      cause: 'fell',
      position: roundVec3([midX + 1.8, midY - 0.6, midZ + 2.4]),
      velocity: [11.4, -9.8, -14.2],
      speed: 20.68,
      surfaceMaterial: 'standard',
      nearestNodeId: findNearestNodeId(course, [midX + 1.8, midY - 0.6, midZ + 2.4]),
    },
    {
      id: `${course.id}-death-2`,
      courseId: course.id,
      timestampSec: 16.9,
      cause: 'shattered',
      position: roundVec3([goal[0] - 2.4, goal[1] + 0.4, goal[2] + 6.8]),
      velocity: [6.2, -32.4, -12.1],
      speed: 35.14,
      surfaceMaterial: 'standard',
      nearestNodeId: findNearestNodeId(course, [goal[0] - 2.4, goal[1] + 0.4, goal[2] + 6.8]),
    },
    {
      id: `${course.id}-death-3`,
      courseId: course.id,
      timestampSec: 23.1,
      cause:
        course.hazards.some((h) => h.material === 'acid') ||
        course.nodes.some((n) => n.material === 'acid')
          ? 'sunk'
          : 'fell',
      position: roundVec3([goal[0] - 1.1, goal[1] - 0.8, goal[2] + 4.2]),
      velocity: [14.8, -6.5, -16.4],
      speed: 23.02,
      surfaceMaterial: 'ice',
      nearestNodeId: findNearestNodeId(course, [goal[0] - 1.1, goal[1] - 0.8, goal[2] + 4.2]),
    },
  ];

  const slipBrakeHeatmap: TelemetrySlipZone[] = [
    {
      position: roundVec3([start[0] + 0.4, start[1] - 2.1, start[2] - 9.2]),
      speed: 18.4,
      slipIntensity: 0.82,
      action: 'lateral-carve',
      surfaceMaterial: 'standard',
    },
    {
      position: roundVec3([midX + 1.2, midY + 0.2, midZ + 1.5]),
      speed: 21.2,
      slipIntensity: 0.94,
      action: 'backspin-brake',
      surfaceMaterial: 'ice',
    },
    {
      position: roundVec3([goal[0] - 0.8, goal[1] + 0.5, goal[2] + 5.6]),
      speed: 16.7,
      slipIntensity: 0.88,
      action: 'rim-save',
      surfaceMaterial: 'standard',
    },
  ];

  const completionSplits: TelemetrySplitSample[] = [
    {
      label: 'Launch Chute Exit',
      timestampSec: 4.2,
      timeRemainingSec: Math.max(10, course.parTimeSec - 4.2),
      speed: 17.6,
      position: roundVec3([start[0], start[1] - 2.4, start[2] - 10.5]),
    },
    {
      label: 'Mid-Course Hazard Apex',
      timestampSec: 12.8,
      timeRemainingSec: Math.max(10, course.parTimeSec - 12.8),
      speed: 19.8,
      position: roundVec3([midX, midY, midZ]),
    },
    {
      label: 'Final Catwalk Approach',
      timestampSec: 26.4,
      timeRemainingSec: Math.max(5, course.parTimeSec - 26.4),
      speed: 15.2,
      position: roundVec3([goal[0], goal[1] + 0.6, goal[2] + 4.5]),
    },
  ];

  const trajectoryPolyline: Vec3[] = [
    roundVec3(start),
    roundVec3([start[0], start[1] - 1.8, start[2] - 7.5]),
    roundVec3([midX * 0.5, midY + 1.2, midZ * 0.7]),
    roundVec3([midX, midY, midZ]),
    roundVec3([goal[0] * 0.85, goal[1] + 1.1, goal[2] * 0.82]),
    roundVec3([goal[0], goal[1] + 0.55, goal[2]]),
  ];

  return {
    courseId: course.id,
    courseName: course.name,
    sampleRateHz: 120,
    totalFramesRecorded: 3420,
    durationSec: 28.5,
    peakSpeed: 23.4,
    averageSpeed: 14.8,
    airborneRatio: 0.24,
    groundedRatio: 0.76,
    completionSplits,
    deathEvents,
    slipBrakeHeatmap,
    speedProfileHistogram: [
      { bucketLabel: '0–6 u/s (Creep / Precision)', ratio: 0.14 },
      { bucketLabel: '6–14 u/s (Tourist Cruise)', ratio: 0.36 },
      { bucketLabel: '14–20 u/s (Banked Carve)', ratio: 0.32 },
      { bucketLabel: '20–24+ u/s (Terminal Fling)', ratio: 0.18 },
    ],
    trajectoryPolyline,
    inferredArchetype: 'High-Speed Chute Daredevil',
    coachingDiagnosis: `Player carries high entry speed (20.7–23.4 u/s) out of steep chutes on ${course.name}, triggering late backspin-brake skids and overshooting unrailed turn apexes near ${deathEvents[0].nearestNodeId} and ${deathEvents[1].nearestNodeId}. Recommend sculpting smooth-unioned outer catch-berms (railHeight >= 1.05m), inserting a high-friction sticky brake strip before the final abyss catwalk, and phase-locking piston hazards to reward a 19 u/s speedrun line.`,
    isBaselineSample: true,
  };
}

export interface LiveTelemetryTracker {
  recordSnapshot: (
    course: CourseSpec,
    position: Vec3,
    velocity: Vec3,
    status: 'racing' | 'goal' | 'shattered' | 'sunk' | 'fell',
    surfaceMaterial: SurfaceMaterial,
    grounded: boolean,
    timeRemainingSec: number,
  ) => void;
  getSummary: (course: CourseSpec) => PlayerRunTelemetrySummary;
  reset: () => void;
}

export function createLiveTelemetryTracker(): LiveTelemetryTracker {
  let framesRecorded = 0;
  let groundedFrames = 0;
  let speedSum = 0;
  let peakSpeed = 0;
  let lastStatus: string = 'racing';
  let bucketCounts = [0, 0, 0, 0];
  const deaths: TelemetryDeathEvent[] = [];
  const slips: TelemetrySlipZone[] = [];
  const splits: TelemetrySplitSample[] = [];
  const trajectory: Vec3[] = [];

  function reset() {
    framesRecorded = 0;
    groundedFrames = 0;
    speedSum = 0;
    peakSpeed = 0;
    lastStatus = 'racing';
    bucketCounts = [0, 0, 0, 0];
    deaths.length = 0;
    slips.length = 0;
    splits.length = 0;
    trajectory.length = 0;
  }

  function recordSnapshot(
    course: CourseSpec,
    position: Vec3,
    velocity: Vec3,
    status: 'racing' | 'goal' | 'shattered' | 'sunk' | 'fell',
    surfaceMaterial: SurfaceMaterial,
    grounded: boolean,
    timeRemainingSec: number,
  ) {
    framesRecorded += 1;
    if (grounded) groundedFrames += 1;

    const speed = Math.hypot(velocity[0], velocity[1], velocity[2]);
    speedSum += speed;
    if (speed > peakSpeed) peakSpeed = speed;

    if (speed < 6) bucketCounts[0]++;
    else if (speed < 14) bucketCounts[1]++;
    else if (speed < 20) bucketCounts[2]++;
    else bucketCounts[3]++;

    if (trajectory.length === 0 || framesRecorded % 48 === 0) {
      trajectory.push(roundVec3(position));
      if (trajectory.length > 32) trajectory.shift();
    }

    if (speed > 16.5 && (surfaceMaterial === 'ice' || !grounded)) {
      if (slips.length < 8) {
        slips.push({
          position: roundVec3(position),
          speed: Math.round(speed * 100) / 100,
          slipIntensity: Math.min(1, Math.round((speed / 23.5) * 100) / 100),
          action: surfaceMaterial === 'ice' ? 'ice-drift' : 'rim-save',
          surfaceMaterial,
        });
      }
    }

    if (
      status !== lastStatus &&
      (status === 'fell' || status === 'shattered' || status === 'sunk')
    ) {
      deaths.push({
        id: `${course.id}-live-death-${deaths.length + 1}`,
        courseId: course.id,
        timestampSec: Math.round((framesRecorded / 120) * 10) / 10,
        cause: status,
        position: roundVec3(position),
        velocity: roundVec3(velocity),
        speed: Math.round(speed * 100) / 100,
        surfaceMaterial,
        nearestNodeId: findNearestNodeId(course, position),
      });
    } else if (status !== lastStatus && status === 'goal') {
      splits.push({
        label: 'Goal Pad Reached',
        timestampSec: Math.round((framesRecorded / 120) * 10) / 10,
        timeRemainingSec: Math.round(timeRemainingSec * 10) / 10,
        speed: Math.round(speed * 100) / 100,
        position: roundVec3(position),
      });
    }

    lastStatus = status;
  }

  function getSummary(course: CourseSpec): PlayerRunTelemetrySummary {
    if (framesRecorded === 0) {
      return buildEmptyLiveTelemetryForCourse(course);
    }

    const totalBuckets = Math.max(
      1,
      bucketCounts[0] + bucketCounts[1] + bucketCounts[2] + bucketCounts[3],
    );
    const avgSpeed = Math.round((speedSum / framesRecorded) * 100) / 100;
    const groundedRatio = Math.round((groundedFrames / framesRecorded) * 100) / 100;

    const archetype: PlayerPlaystyleArchetype =
      peakSpeed >= 19.5
        ? 'High-Speed Chute Daredevil'
        : groundedRatio >= 0.88
          ? 'Precision Catwalk Tactician'
          : 'Edge-Carving Rim-Saver';

    const diagnosis =
      deaths.length > 0
        ? `Recorded ${framesRecorded} live frames (${deaths.length} real death(s) near ${deaths[0].nearestNodeId}, peak ${peakSpeed.toFixed(1)} u/s). Recommend sculpting catch-berms and sticky brake zones near [${deaths[0].position.join(', ')}].`
        : `Recorded ${framesRecorded} live frames on ${course.name} with 0 deaths (peak ${peakSpeed.toFixed(1)} u/s, avg ${avgSpeed.toFixed(1)} u/s, ${archetype}).`;

    return {
      courseId: course.id,
      courseName: course.name,
      sampleRateHz: 120,
      totalFramesRecorded: framesRecorded,
      durationSec: Math.round((framesRecorded / 120) * 10) / 10,
      peakSpeed: Math.round(peakSpeed * 100) / 100,
      averageSpeed: avgSpeed,
      airborneRatio: Math.round((1 - groundedRatio) * 100) / 100,
      groundedRatio,
      completionSplits: [...splits],
      deathEvents: [...deaths],
      slipBrakeHeatmap: [...slips],
      speedProfileHistogram: [
        {
          bucketLabel: '0–6 u/s (Creep / Precision)',
          ratio: Math.round((bucketCounts[0] / totalBuckets) * 100) / 100,
        },
        {
          bucketLabel: '6–14 u/s (Tourist Cruise)',
          ratio: Math.round((bucketCounts[1] / totalBuckets) * 100) / 100,
        },
        {
          bucketLabel: '14–20 u/s (Banked Carve)',
          ratio: Math.round((bucketCounts[2] / totalBuckets) * 100) / 100,
        },
        {
          bucketLabel: '20–24+ u/s (Terminal Fling)',
          ratio: Math.round((bucketCounts[3] / totalBuckets) * 100) / 100,
        },
      ],
      trajectoryPolyline:
        trajectory.length > 0 ? [...trajectory] : [roundVec3(course.startPos)],
      inferredArchetype: archetype,
      coachingDiagnosis: diagnosis,
      isBaselineSample: false,
    };
  }

  return {
    recordSnapshot,
    getSummary,
    reset,
  };
}
