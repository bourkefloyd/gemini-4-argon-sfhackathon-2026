/**
 * 120 Hz Deterministic Ghost Marble Replay & Live Split Timer (`src/replay/ghost-replay.ts`)
 *
 * Features:
 * - Records compact 120 Hz trajectory frames (`position`, `orientation`, `time`, `speed`) on every run
 * - Float32Array compact binary packing (`encodeGhostFramesFloat32` / `decodeGhostFramesFloat32`)
 * - Automatically saves the player's Personal Best run per course (in-memory + `localStorage` when available)
 * - Generates a deterministic 120 Hz "Argon Pro Ghost" par line for every course (`synthesizeArgonProGhost`)
 *   so a translucentホロ/ghost marble rolls alongside the player immediately on Run 1
 * - Live `+/-` split timer comparing player progress against Personal Best (or Argon Pro Ghost)
 *   continuously along the trajectory and at course checkpoints / Goal finish
 */

import {
  type CourseSpec,
  DEFAULT_PHYSICS_CONFIG,
  type MarbleState,
  type Quat,
  type Vec3,
} from '../contracts';
import {
  quatMultiply,
  quatNormalize,
  quatSlerp,
  vec3Add,
  vec3Length,
  vec3Lerp,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';

export const GHOST_SAMPLE_RATE_HZ = 120;
export const GHOST_FIXED_DT = 1 / GHOST_SAMPLE_RATE_HZ;
export const MARBLE_GHOST_STORAGE_KEY = 'marble_madness_ghost_runs_v1';

export type GhostSourceKind = 'player_best' | 'argon_pro_par';

export interface GhostTrajectoryFrame {
  /** 120 Hz frame index (`0, 1, 2, ...`) */
  readonly tick: number;
  /** Elapsed run time in seconds */
  readonly time: number;
  /** World-space marble center `[x, y, z]` */
  readonly position: Vec3;
  /** Unit quaternion `[x, y, z, w]` for interior ghost marble shader veins */
  readonly orientation: Quat;
  /** Instantaneous speed `||v||` (units/sec) */
  readonly speed: number;
}

export interface GhostRunRecord {
  readonly id: string;
  readonly courseId: string;
  readonly label: string;
  readonly source: GhostSourceKind;
  readonly finishTimeSec: number;
  readonly completedGoal: boolean;
  readonly sampleRateHz: number;
  readonly frames: readonly GhostTrajectoryFrame[];
  /** Arrival timestamps (seconds) keyed by checkpoint id (plus `'goal'`) */
  readonly checkpointSplitsSec: Readonly<Record<string, number>>;
}

export interface GhostPlaybackPose {
  readonly active: boolean;
  readonly courseId: string;
  readonly source: GhostSourceKind;
  readonly label: string;
  readonly time: number;
  readonly finishTimeSec: number;
  readonly finished: boolean;
  readonly position: Vec3;
  readonly orientation: Quat;
  readonly velocity: Vec3;
  readonly speed: number;
  /** Translucentホロ/ghost RGBA tint for shader rendering */
  readonly holoColorRgba: readonly [number, number, number, number];
  /** Normalized progress `[0..1]` along the ghost's trajectory */
  readonly progressFraction: number;
}

export type SplitPaceStatus = 'ahead' | 'behind' | 'even';

export interface CheckpointSplitComparison {
  readonly checkpointId: string;
  readonly label: string;
  readonly playerTimeSec: number;
  readonly ghostTimeSec: number;
  /** `playerTimeSec - ghostTimeSec` (negative = ahead/faster, positive = behind/slower) */
  readonly deltaSec: number;
  readonly formattedDelta: string;
  readonly status: SplitPaceStatus;
}

export interface SplitDeltaSnapshot {
  readonly hasReferenceGhost: boolean;
  readonly referenceSource: GhostSourceKind;
  readonly referenceLabel: string;
  readonly referenceFinishTimeSec: number;
  readonly playerRunTimeSec: number;
  /**
   * Live continuous split delta in seconds (`t_player - t_ghost_at_same_progress`).
   * Negative (`-1.25`) means the player is `1.25s` ahead of the ghost's pace;
   * Positive (`+0.80`) means the player is `0.80s` behind the ghost's pace.
   */
  readonly deltaSec: number;
  /** Formatted HUD string with explicit sign, e.g. `"-1.25s"` or `"+0.80s"` */
  readonly formattedDelta: string;
  /** Pace classification (`'ahead'` | `'behind'` | `'even'`) */
  readonly status: SplitPaceStatus;
  /** Signed spatial lead in meters/units along the course (`> 0` ahead of ghost at current time) */
  readonly distanceLeadUnits: number;
  /** Most recently crossed checkpoint or goal split comparison */
  readonly activeCheckpointSplit: CheckpointSplitComparison | null;
  /** All checkpoint splits recorded during the current run */
  readonly checkpointSplits: readonly CheckpointSplitComparison[];
}

export interface RunCompletionSummary {
  readonly courseId: string;
  readonly finishTimeSec: number;
  readonly isNewPersonalBest: boolean;
  readonly previousPersonalBestSec: number | null;
  readonly deltaVsPersonalBestSec: number | null;
  readonly deltaVsArgonParSec: number;
  readonly savedRecord: GhostRunRecord;
}

/**
 * Format a split time delta in seconds into a signed arcade HUD string (`"-1.24s"`, `"+0.48s"`, `"-0.00s"`).
 */
export function formatSplitDelta(deltaSec: number): {
  formattedDelta: string;
  status: SplitPaceStatus;
} {
  if (!Number.isFinite(deltaSec) || Math.abs(deltaSec) < 0.015) {
    return {
      formattedDelta: '-0.00s',
      status: 'even',
    };
  }
  const sign = deltaSec < 0 ? '-' : '+';
  const absVal = Math.min(99.99, Math.abs(deltaSec));
  return {
    formattedDelta: `${sign}${absVal.toFixed(2)}s`,
    status: deltaSec < 0 ? 'ahead' : 'behind',
  };
}

/**
 * Pack 120 Hz `GhostTrajectoryFrame[]` into a compact `Float32Array` (`8` floats per frame:
 * `[time, px, py, pz, qx, qy, qz, qw]`).
 */
export function encodeGhostFramesFloat32(
  frames: readonly GhostTrajectoryFrame[],
): Float32Array {
  const out = new Float32Array(frames.length * 8);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const base = i * 8;
    out[base + 0] = f.time;
    out[base + 1] = f.position[0];
    out[base + 2] = f.position[1];
    out[base + 3] = f.position[2];
    out[base + 4] = f.orientation[0];
    out[base + 5] = f.orientation[1];
    out[base + 6] = f.orientation[2];
    out[base + 7] = f.orientation[3];
  }
  return out;
}

/**
 * Unpack a compact `Float32Array` back into `GhostTrajectoryFrame[]`.
 */
export function decodeGhostFramesFloat32(packed: Float32Array): GhostTrajectoryFrame[] {
  const count = Math.floor(packed.length / 8);
  const frames: GhostTrajectoryFrame[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const base = i * 8;
    const time = packed[base + 0];
    const position: Vec3 = [packed[base + 1], packed[base + 2], packed[base + 3]];
    const orientation: Quat = quatNormalize([
      packed[base + 4],
      packed[base + 5],
      packed[base + 6],
      packed[base + 7],
    ]);
    let speed = 0;
    if (i > 0) {
      const prev = frames[i - 1];
      const dt = Math.max(1e-5, time - prev.time);
      speed = vec3Length(vec3Sub(position, prev.position)) / dt;
    }
    frames[i] = {
      tick: i,
      time,
      position,
      orientation,
      speed,
    };
  }
  return frames;
}

/**
 * Build waypoints for the pre-recorded "Argon Pro Ghost" par line on any course.
 */
function buildCourseParWaypoints(course: CourseSpec): Vec3[] {
  const R = DEFAULT_PHYSICS_CONFIG.marbleRadius;
  if (course.id === 'practice-race') {
    return [
      [...course.startPos],
      [0.0, 14.0 + R, -3.2],
      [0.0, 10.0 + R, -10.72],
      [2.8, 10.0 + R, -14.2],
      [8.5, 10.0 + R, -14.2],
      [14.5, 7.0 + R, -14.2],
      [17.4, 7.0 + R, -13.6],
      [30.0, 7.0 + R, -15.6],
      [30.0, 7.0 + R, -27.8],
      [30.0, 4.0 + R, -35.8],
      [32.2, 0.45 + R, -45.2],
      [32.4, 0.45 + R, -48.6],
      [...course.goalPos],
    ];
  }

  if (course.id === 'intermediate-madness') {
    return [
      [...course.startPos],
      [0.0, 10.8 + R, -3.2],
      [0.0, 6.8 + R, -11.2],
      [0.0, 6.8 + R, -15.0],
      [2.4, 6.8 + R, -19.0],
      [2.4, 3.8 + R, -25.8],
      [4.2, 3.8 + R, -26.8],
      [12.2, 3.8 + R, -26.8],
      [19.8, 3.8 + R, -26.8],
      [22.0, 2.65 + R, -32.0],
      [...course.goalPos],
    ];
  }

  // Generic fallback for any Argon Architect or custom course:
  // threads `startPos` -> `checkpoints` -> `goalPos`
  const points: Vec3[] = [[...course.startPos]];
  if (course.checkpoints && course.checkpoints.length > 0) {
    for (const cp of course.checkpoints) {
      points.push([...cp.position]);
    }
  } else {
    const mid: Vec3 = [
      (course.startPos[0] + course.goalPos[0]) * 0.5,
      (course.startPos[1] + course.goalPos[1]) * 0.5,
      (course.startPos[2] + course.goalPos[2]) * 0.5,
    ];
    points.push(mid);
  }
  points.push([...course.goalPos]);
  return points;
}

/**
 * Evaluate a smooth Catmull-Rom / rounded polyline trajectory at normalized `u in [0, 1]`.
 */
function sampleSmoothPolyline(waypoints: readonly Vec3[], u: number): Vec3 {
  if (waypoints.length === 0) return [0, 0, 0];
  if (waypoints.length === 1) return waypoints[0];

  const clampedU = Math.max(0, Math.min(1, u));
  const segLengths: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const len = Math.max(1e-4, vec3Length(vec3Sub(waypoints[i + 1], waypoints[i])));
    segLengths.push(len);
    totalLen += len;
  }

  const targetDist = clampedU * totalLen;
  let acc = 0;
  let segIdx = 0;
  let localT = 0;

  for (let i = 0; i < segLengths.length; i++) {
    if (acc + segLengths[i] >= targetDist || i === segLengths.length - 1) {
      segIdx = i;
      localT = Math.max(0, Math.min(1, (targetDist - acc) / segLengths[i]));
      break;
    }
    acc += segLengths[i];
  }

  const p0 = waypoints[Math.max(0, segIdx - 1)];
  const p1 = waypoints[segIdx];
  const p2 = waypoints[Math.min(waypoints.length - 1, segIdx + 1)];
  const p3 = waypoints[Math.min(waypoints.length - 1, segIdx + 2)];

  // Blend linear segment with gentle Catmull-Rom corner rounding so ghost stays on track decks
  const linearPos = vec3Lerp(p1, p2, localT);
  const t2 = localT * localT;
  const t3 = t2 * localT;

  const crX =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * localT +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const crY =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * localT +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  const crZ =
    0.5 *
    (2 * p1[2] +
      (-p0[2] + p2[2]) * localT +
      (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 +
      (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3);

  return vec3Lerp(linearPos, [crX, crY, crZ], 0.32);
}

/**
 * Synthesize a deterministic 120 Hz "Argon Pro Ghost" par run for a given `CourseSpec`.
 */
export function synthesizeArgonProGhost(
  course: CourseSpec,
  targetFinishTimeSec?: number,
): GhostRunRecord {
  const waypoints = buildCourseParWaypoints(course);
  let totalPathLen = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalPathLen += vec3Length(vec3Sub(waypoints[i + 1], waypoints[i]));
  }

  // Competitive par speed (~8.5–10.5 u/s average), clamped to ~25–62% of course parTimeSec
  const computedTime = Math.max(
    6.0,
    Math.min(course.parTimeSec * 0.62, totalPathLen / 9.2),
  );
  const finishTimeSec =
    targetFinishTimeSec ?? Math.round(computedTime * 120) / 120;
  const totalTicks = Math.max(2, Math.round(finishTimeSec * GHOST_SAMPLE_RATE_HZ));
  const R = DEFAULT_PHYSICS_CONFIG.marbleRadius;

  const frames: GhostTrajectoryFrame[] = new Array(totalTicks + 1);
  let orientation: Quat = [0, 0, 0, 1];
  const checkpointSplitsSec: Record<string, number> = {};

  for (let tick = 0; tick <= totalTicks; tick++) {
    const time = tick * GHOST_FIXED_DT;
    const rawFrac = tick / totalTicks;
    // Smooth ease-in at start pad, brisk mid-course cruise, slight settle into goal pad
    const u =
      rawFrac < 0.08
        ? (rawFrac / 0.08) * (rawFrac / 0.08) * 0.04
        : 0.04 + ((rawFrac - 0.08) / 0.92) * 0.96;

    const position = sampleSmoothPolyline(waypoints, Math.min(1, u));
    let speed = 0;

    if (tick > 0) {
      const prev = frames[tick - 1];
      const disp = vec3Sub(position, prev.position);
      const vel = vec3Scale(disp, GHOST_SAMPLE_RATE_HZ);
      speed = vec3Length(vel);

      const omega: Vec3 = [vel[2] / R, 0, -vel[0] / R];
      const angSpeed = vec3Length(omega);
      if (angSpeed > 1e-4) {
        const axis = vec3Scale(omega, 1 / angSpeed);
        const halfAngle = 0.5 * angSpeed * GHOST_FIXED_DT;
        const sinHalf = Math.sin(halfAngle);
        const dq: Quat = [
          axis[0] * sinHalf,
          axis[1] * sinHalf,
          axis[2] * sinHalf,
          Math.cos(halfAngle),
        ];
        orientation = quatNormalize(quatMultiply(dq, orientation));
      }
    }

    frames[tick] = {
      tick,
      time,
      position,
      orientation,
      speed,
    };

    if (course.checkpoints) {
      for (const cp of course.checkpoints) {
        if (checkpointSplitsSec[cp.id] === undefined) {
          const dist = vec3Length(vec3Sub(position, cp.position));
          if (dist <= cp.radius) {
            checkpointSplitsSec[cp.id] = time;
          }
        }
      }
    }
  }

  checkpointSplitsSec.goal = finishTimeSec;

  return {
    id: `argon-pro-ghost-${course.id}`,
    courseId: course.id,
    label: 'ARGON PRO GHOST',
    source: 'argon_pro_par',
    finishTimeSec,
    completedGoal: true,
    sampleRateHz: GHOST_SAMPLE_RATE_HZ,
    frames,
    checkpointSplitsSec,
  };
}

/**
 * Sample an interpolated `GhostPlaybackPose` (`vec3Lerp` + `quatSlerp`) from a `GhostRunRecord` at `runTimeSec`.
 */
export function sampleGhostPoseAtTime(
  record: GhostRunRecord,
  runTimeSec: number,
): GhostPlaybackPose {
  const frames = record.frames;
  const holoColorRgba: readonly [number, number, number, number] =
    record.source === 'player_best'
      ? [0.22, 0.96, 1.0, 0.52]
      : [0.9, 0.38, 1.0, 0.45];

  if (frames.length === 0) {
    return {
      active: false,
      courseId: record.courseId,
      source: record.source,
      label: record.label,
      time: 0,
      finishTimeSec: record.finishTimeSec,
      finished: true,
      position: [0, 0, 0],
      orientation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      speed: 0,
      holoColorRgba,
      progressFraction: 0,
    };
  }

  const clampedTime = Math.max(0, runTimeSec);
  const lastFrame = frames[frames.length - 1];

  if (clampedTime >= lastFrame.time || frames.length === 1) {
    return {
      active: true,
      courseId: record.courseId,
      source: record.source,
      label: record.label,
      time: lastFrame.time,
      finishTimeSec: record.finishTimeSec,
      finished: true,
      position: lastFrame.position,
      orientation: lastFrame.orientation,
      velocity: [0, 0, 0],
      speed: 0,
      holoColorRgba,
      progressFraction: 1.0,
    };
  }

  // Fast lookup for uniform 120 Hz frames with binary search refinement
  let idx0 = Math.min(
    frames.length - 2,
    Math.max(0, Math.floor(clampedTime * record.sampleRateHz)),
  );

  while (idx0 > 0 && frames[idx0].time > clampedTime) {
    idx0--;
  }
  while (idx0 < frames.length - 2 && frames[idx0 + 1].time <= clampedTime) {
    idx0++;
  }

  const f0 = frames[idx0];
  const f1 = frames[idx0 + 1];
  const span = Math.max(1e-6, f1.time - f0.time);
  const alpha = Math.max(0, Math.min(1, (clampedTime - f0.time) / span));

  const position = vec3Lerp(f0.position, f1.position, alpha);
  const orientation = quatSlerp(f0.orientation, f1.orientation, alpha);
  const velocity = vec3Scale(vec3Sub(f1.position, f0.position), 1 / span);
  const speed = f0.speed + (f1.speed - f0.speed) * alpha;
  const progressFraction = Math.max(
    0,
    Math.min(1, (idx0 + alpha) / Math.max(1, frames.length - 1)),
  );

  return {
    active: true,
    courseId: record.courseId,
    source: record.source,
    label: record.label,
    time: clampedTime,
    finishTimeSec: record.finishTimeSec,
    finished: false,
    position,
    orientation,
    velocity,
    speed,
    holoColorRgba,
    progressFraction,
  };
}

/**
 * Compute live `+/-` split delta between the player's current position/time and a reference `GhostRunRecord`.
 */
export function computeLiveSplitDelta(
  record: GhostRunRecord,
  course: CourseSpec,
  playerPosition: Vec3,
  playerRunTimeSec: number,
  checkpointSplits: readonly CheckpointSplitComparison[] = [],
): SplitDeltaSnapshot {
  const frames = record.frames;
  if (frames.length === 0) {
    return {
      hasReferenceGhost: false,
      referenceSource: record.source,
      referenceLabel: record.label,
      referenceFinishTimeSec: record.finishTimeSec,
      playerRunTimeSec,
      deltaSec: 0,
      formattedDelta: '-0.00s',
      status: 'even',
      distanceLeadUnits: 0,
      activeCheckpointSplit: null,
      checkpointSplits,
    };
  }

  // 1. Find the ghost trajectory frame that matches the player's spatial progress along the course.
  // Combine 3D proximity to the ghost path and remaining distance-to-goal so off-line shortcuts
  // (like speedrun sky-chutes) still produce accurate split deltas!
  const goalPos = course.goalPos;
  const startGoalDist = Math.max(1.0, vec3Length(vec3Sub(course.startPos, goalPos)));
  const playerDistToGoal = vec3Length(vec3Sub(playerPosition, goalPos));

  let bestFrameIdx = 0;
  let bestScore = Infinity;

  // Stride by 2 at 120 Hz for fast scan, then refine +/- 2 frames around the winner
  const stride = frames.length > 240 ? 2 : 1;
  for (let i = 0; i < frames.length; i += stride) {
    const gf = frames[i];
    const directDist = vec3Length(vec3Sub(playerPosition, gf.position));
    const ghostDistToGoal = vec3Length(vec3Sub(gf.position, goalPos));
    const goalProgressDiff = Math.abs(playerDistToGoal - ghostDistToGoal);

    // Weighted metric: favors exact path match when on the tourist line, falls back to goal progress on shortcuts
    const score = Math.min(directDist, goalProgressDiff * 0.85 + directDist * 0.25);
    if (score < bestScore) {
      bestScore = score;
      bestFrameIdx = i;
    }
  }

  const refineStart = Math.max(0, bestFrameIdx - 2);
  const refineEnd = Math.min(frames.length - 1, bestFrameIdx + 2);
  for (let i = refineStart; i <= refineEnd; i++) {
    const gf = frames[i];
    const directDist = vec3Length(vec3Sub(playerPosition, gf.position));
    const ghostDistToGoal = vec3Length(vec3Sub(gf.position, goalPos));
    const goalProgressDiff = Math.abs(playerDistToGoal - ghostDistToGoal);
    const score = Math.min(directDist, goalProgressDiff * 0.85 + directDist * 0.25);
    if (score < bestScore) {
      bestScore = score;
      bestFrameIdx = i;
    }
  }

  // Sub-frame projection between `bestFrameIdx` and its neighbor
  let matchedGhostTime = frames[bestFrameIdx].time;
  if (bestFrameIdx < frames.length - 1) {
    const fA = frames[bestFrameIdx];
    const fB = frames[bestFrameIdx + 1];
    const seg = vec3Sub(fB.position, fA.position);
    const segLenSq = seg[0] * seg[0] + seg[1] * seg[1] + seg[2] * seg[2];
    if (segLenSq > 1e-6) {
      const rel = vec3Sub(playerPosition, fA.position);
      const proj = (rel[0] * seg[0] + rel[1] * seg[1] + rel[2] * seg[2]) / segLenSq;
      const clampedProj = Math.max(0, Math.min(1, proj));
      matchedGhostTime = fA.time + (fB.time - fA.time) * clampedProj;
    }
  }

  const rawDeltaSec =
    playerRunTimeSec <= 1e-4 && bestFrameIdx === 0
      ? 0
      : playerRunTimeSec - matchedGhostTime;

  // Compute spatial distance lead at current `playerRunTimeSec`
  const ghostNow = sampleGhostPoseAtTime(record, playerRunTimeSec);
  const ghostNowDistToGoal = vec3Length(vec3Sub(ghostNow.position, goalPos));
  const distanceLeadUnits = Math.max(
    -startGoalDist,
    Math.min(startGoalDist, ghostNowDistToGoal - playerDistToGoal),
  );

  const activeCheckpointSplit =
    checkpointSplits.length > 0 ? checkpointSplits[checkpointSplits.length - 1] : null;

  const { formattedDelta, status } = formatSplitDelta(rawDeltaSec);

  return {
    hasReferenceGhost: true,
    referenceSource: record.source,
    referenceLabel: record.label,
    referenceFinishTimeSec: record.finishTimeSec,
    playerRunTimeSec,
    deltaSec: rawDeltaSec,
    formattedDelta,
    status,
    distanceLeadUnits,
    activeCheckpointSplit,
    checkpointSplits,
  };
}

export interface GhostReplayManager {
  /** Start or reset the 120 Hz recording buffer for a new run on `course` */
  startRun(course: CourseSpec): void;
  /** Record a single 120 Hz frame for the active run and update checkpoint splits */
  recordFrame(marble: MarbleState, runTimeSec?: number): GhostTrajectoryFrame;
  /** Finalize the run on Goal capture; saves as Personal Best if faster than existing best */
  completeRun(finishTimeSec?: number): RunCompletionSummary;
  /** Return the active run's recorded frames so far */
  getCurrentRunFrames(): readonly GhostTrajectoryFrame[];
  /** Return the active run's elapsed time in seconds */
  getCurrentRunTimeSec(): number;
  /** Return the reference ghost (`player_best` if saved for this course, else `argon_pro_par`) */
  getReferenceGhost(course?: CourseSpec, preferSource?: GhostSourceKind): GhostRunRecord;
  /** Return the Personal Best ghost for `courseId` if one has been recorded */
  getPersonalBestGhost(courseId: string): GhostRunRecord | null;
  /** Return the pre-recorded 120 Hz Argon Pro Ghost par run for `course` */
  getArgonProGhost(course?: CourseSpec): GhostRunRecord;
  /** Explicitly load or overwrite a Personal Best ghost record */
  setPersonalBestGhost(record: GhostRunRecord): void;
  /** Sample the interpolated translucent ghost pose at `runTimeSec` */
  sampleGhostPose(runTimeSec?: number, preferSource?: GhostSourceKind): GhostPlaybackPose;
  /** Sample both Personal Best and Argon Pro ghosts simultaneously if both exist */
  sampleAllActiveGhosts(runTimeSec?: number): readonly GhostPlaybackPose[];
  /** Compute live `+/-` split delta for the HUD */
  getSplitSnapshot(marble: MarbleState, runTimeSec?: number, preferSource?: GhostSourceKind): SplitDeltaSnapshot;
  /** Clear stored Personal Best runs */
  clearPersonalBests(): void;
}

interface SerializedGhostRecord {
  id: string;
  courseId: string;
  label: string;
  source: GhostSourceKind;
  finishTimeSec: number;
  completedGoal: boolean;
  sampleRateHz: number;
  packedFloats: number[];
  checkpointSplitsSec: Record<string, number>;
}

function loadPersonalBestsFromStorage(): Map<string, GhostRunRecord> {
  const map = new Map<string, GhostRunRecord>();
  try {
    if (typeof window === 'undefined' || !window.localStorage) return map;
    const raw = window.localStorage.getItem(MARBLE_GHOST_STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as Record<string, SerializedGhostRecord>;
    for (const [courseId, item] of Object.entries(parsed)) {
      if (item && Array.isArray(item.packedFloats)) {
        const frames = decodeGhostFramesFloat32(new Float32Array(item.packedFloats));
        map.set(courseId, {
          id: item.id,
          courseId: item.courseId,
          label: item.label,
          source: item.source,
          finishTimeSec: item.finishTimeSec,
          completedGoal: item.completedGoal,
          sampleRateHz: item.sampleRateHz || GHOST_SAMPLE_RATE_HZ,
          frames,
          checkpointSplitsSec: item.checkpointSplitsSec ?? {},
        });
      }
    }
  } catch {
    // Ignore storage read errors in restricted / headless contexts
  }
  return map;
}

function savePersonalBestsToStorage(map: Map<string, GhostRunRecord>): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const serialized: Record<string, SerializedGhostRecord> = {};
    for (const [courseId, rec] of map.entries()) {
      // Downsample only if an abnormally long run (> 180s) is stored to respect localStorage quota
      const packed = encodeGhostFramesFloat32(rec.frames);
      serialized[courseId] = {
        id: rec.id,
        courseId: rec.courseId,
        label: rec.label,
        source: rec.source,
        finishTimeSec: rec.finishTimeSec,
        completedGoal: rec.completedGoal,
        sampleRateHz: rec.sampleRateHz,
        packedFloats: Array.from(packed),
        checkpointSplitsSec: { ...rec.checkpointSplitsSec },
      };
    }
    window.localStorage.setItem(MARBLE_GHOST_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore storage quota / security errors
  }
}

export function createGhostReplayManager(initialCourse: CourseSpec): GhostReplayManager {
  let activeCourse = initialCourse;
  const personalBests = loadPersonalBestsFromStorage();
  const argonParCache = new Map<string, GhostRunRecord>();

  let currentFrames: GhostTrajectoryFrame[] = [];
  let currentCheckpointTimes: Record<string, number> = {};
  let currentCheckpointComparisons: CheckpointSplitComparison[] = [];
  let currentRunTimeSec = 0;
  let runCompleted = false;

  function getArgonProGhost(course: CourseSpec = activeCourse): GhostRunRecord {
    const cached = argonParCache.get(course.id);
    if (cached) return cached;
    const synthesized = synthesizeArgonProGhost(course);
    argonParCache.set(course.id, synthesized);
    return synthesized;
  }

  function getPersonalBestGhost(courseId: string): GhostRunRecord | null {
    return personalBests.get(courseId) ?? null;
  }

  function getReferenceGhost(
    course: CourseSpec = activeCourse,
    preferSource?: GhostSourceKind,
  ): GhostRunRecord {
    const pb = personalBests.get(course.id);
    const par = getArgonProGhost(course);
    if (preferSource === 'argon_pro_par') return par;
    if (preferSource === 'player_best' && pb) return pb;
    return pb ?? par;
  }

  function startRun(course: CourseSpec = activeCourse): void {
    activeCourse = course;
    getArgonProGhost(course);
    currentFrames = [];
    currentCheckpointTimes = {};
    currentCheckpointComparisons = [];
    currentRunTimeSec = 0;
    runCompleted = false;
  }

  function recordFrame(marble: MarbleState, explicitRunTimeSec?: number): GhostTrajectoryFrame {
    const tick = currentFrames.length;
    const time =
      explicitRunTimeSec !== undefined ? explicitRunTimeSec : tick * GHOST_FIXED_DT;
    currentRunTimeSec = time;

    const frame: GhostTrajectoryFrame = {
      tick,
      time,
      position: [marble.position[0], marble.position[1], marble.position[2]],
      orientation: [
        marble.orientation[0],
        marble.orientation[1],
        marble.orientation[2],
        marble.orientation[3],
      ],
      speed: vec3Length(marble.velocity),
    };

    currentFrames.push(frame);

    // Check intermediate course checkpoints
    if (activeCourse.checkpoints) {
      const refGhost = getReferenceGhost(activeCourse);
      for (const cp of activeCourse.checkpoints) {
        if (currentCheckpointTimes[cp.id] === undefined) {
          const d = vec3Length(vec3Sub(marble.position, cp.position));
          if (d <= cp.radius) {
            currentCheckpointTimes[cp.id] = time;
            const ghostCpTime = refGhost.checkpointSplitsSec[cp.id];
            if (ghostCpTime !== undefined) {
              const deltaSec = time - ghostCpTime;
              const { formattedDelta, status } = formatSplitDelta(deltaSec);
              currentCheckpointComparisons.push({
                checkpointId: cp.id,
                label: cp.label,
                playerTimeSec: time,
                ghostTimeSec: ghostCpTime,
                deltaSec,
                formattedDelta,
                status,
              });
            }
          }
        }
      }
    }

    if (marble.status === 'goal' && !runCompleted) {
      completeRun(time);
    }

    return frame;
  }

  function completeRun(explicitFinishTimeSec?: number): RunCompletionSummary {
    runCompleted = true;
    const finishTimeSec =
      explicitFinishTimeSec !== undefined
        ? explicitFinishTimeSec
        : currentFrames.length > 0
          ? currentFrames[currentFrames.length - 1].time
          : currentRunTimeSec;

    currentCheckpointTimes.goal = finishTimeSec;

    const refGhost = getReferenceGhost(activeCourse);
    const ghostGoalTime = refGhost.checkpointSplitsSec.goal ?? refGhost.finishTimeSec;
    const goalDelta = finishTimeSec - ghostGoalTime;
    const { formattedDelta, status } = formatSplitDelta(goalDelta);

    if (!currentCheckpointComparisons.some((c) => c.checkpointId === 'goal')) {
      currentCheckpointComparisons.push({
        checkpointId: 'goal',
        label: 'GOAL FINISH',
        playerTimeSec: finishTimeSec,
        ghostTimeSec: ghostGoalTime,
        deltaSec: goalDelta,
        formattedDelta,
        status,
      });
    }

    const candidateRecord: GhostRunRecord = {
      id: `pb-${activeCourse.id}-${Date.now()}`,
      courseId: activeCourse.id,
      label: 'PERSONAL BEST GHOST',
      source: 'player_best',
      finishTimeSec,
      completedGoal: true,
      sampleRateHz: GHOST_SAMPLE_RATE_HZ,
      frames: [...currentFrames],
      checkpointSplitsSec: { ...currentCheckpointTimes },
    };

    const existingPb = personalBests.get(activeCourse.id) ?? null;
    const previousPersonalBestSec = existingPb ? existingPb.finishTimeSec : null;
    const deltaVsPersonalBestSec =
      previousPersonalBestSec !== null ? finishTimeSec - previousPersonalBestSec : null;

    const isNewPersonalBest =
      existingPb === null || finishTimeSec < existingPb.finishTimeSec - 1e-4;

    if (isNewPersonalBest && currentFrames.length > 0) {
      personalBests.set(activeCourse.id, candidateRecord);
      savePersonalBestsToStorage(personalBests);
    }

    const argonPar = getArgonProGhost(activeCourse);
    const deltaVsArgonParSec = finishTimeSec - argonPar.finishTimeSec;

    return {
      courseId: activeCourse.id,
      finishTimeSec,
      isNewPersonalBest,
      previousPersonalBestSec,
      deltaVsPersonalBestSec,
      deltaVsArgonParSec,
      savedRecord: isNewPersonalBest ? candidateRecord : (existingPb ?? candidateRecord),
    };
  }

  function setPersonalBestGhost(record: GhostRunRecord): void {
    personalBests.set(record.courseId, record);
    savePersonalBestsToStorage(personalBests);
  }

  function sampleGhostPose(
    runTimeSec = currentRunTimeSec,
    preferSource?: GhostSourceKind,
  ): GhostPlaybackPose {
    const ref = getReferenceGhost(activeCourse, preferSource);
    return sampleGhostPoseAtTime(ref, runTimeSec);
  }

  function sampleAllActiveGhosts(runTimeSec = currentRunTimeSec): readonly GhostPlaybackPose[] {
    const poses: GhostPlaybackPose[] = [];
    const pb = personalBests.get(activeCourse.id);
    if (pb) {
      poses.push(sampleGhostPoseAtTime(pb, runTimeSec));
    }
    const par = getArgonProGhost(activeCourse);
    poses.push(sampleGhostPoseAtTime(par, runTimeSec));
    return poses;
  }

  function getSplitSnapshot(
    marble: MarbleState,
    runTimeSec = currentRunTimeSec,
    preferSource?: GhostSourceKind,
  ): SplitDeltaSnapshot {
    const ref = getReferenceGhost(activeCourse, preferSource);
    return computeLiveSplitDelta(
      ref,
      activeCourse,
      marble.position,
      runTimeSec,
      currentCheckpointComparisons,
    );
  }

  function clearPersonalBests(): void {
    personalBests.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(MARBLE_GHOST_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }

  // Initialize first course
  startRun(initialCourse);

  return {
    startRun,
    recordFrame,
    completeRun,
    getCurrentRunFrames: () => currentFrames,
    getCurrentRunTimeSec: () => currentRunTimeSec,
    getReferenceGhost,
    getPersonalBestGhost,
    getArgonProGhost,
    setPersonalBestGhost,
    sampleGhostPose,
    sampleAllActiveGhosts,
    getSplitSnapshot,
    clearPersonalBests,
  };
}

export { vec3Add };
