/**
 * In-Game `[P] AI Bot Auto-Playtest` Toggle & Telemetry Recorder (`src/bot/telemetry-recorder.ts`)
 *
 * Provides:
 * 1. `TelemetryRecorder` (`createTelemetryRecorder`):
 *    Records 120 Hz physics + bot decision frames and produces structured
 *    `RunTelemetrySummary` JSON (top speed, slip ratio peaks, death coordinates,
 *    airtime, split times, and bottleneck segments) ready to feed straight into
 *    the Gemini 4 Argon 1M-Token Course Architect.
 * 2. `runHeadlessBotRollout`:
 *    Runs a course rollout at 1000+ Hz wall-clock speed (120 Hz physics dt) or
 *    10x fast-forward in the background.
 * 3. `createBotPlaytestController` & `installBotPlaytestGlobalBridge`:
 *    Clean controller module toggleable in-game via `[P]` or `window.__MARBLE_PLAYTEST__`
 *    so during the live hackathon demo an AI bot can race the course live at 60 FPS
 *    or run 10x fast-forward rollouts in the background.
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  type MarbleLifecycleStatus,
  type MarbleState,
  type PhysicsConfig,
  type SurfaceMaterial,
  type Vec3,
} from '../contracts';
import { createMarbleSimulation } from '../physics/marble-physics';
import { createCpuWorldEvaluator } from '../sdf/eval-cpu';
import {
  type AutonomousDriver,
  type BotDecisionTelemetry,
  type BotPlayStyle,
  type BotWaypoint,
  buildCourseWaypoints,
  createAutonomousDriver,
} from './autonomous-driver';

export interface TelemetryDeathEvent {
  readonly timeSec: number;
  readonly cause: 'fell' | 'sunk' | 'shattered';
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly surfaceMaterial: SurfaceMaterial;
  readonly segmentId: string;
}

export interface TelemetrySplitTime {
  readonly segmentId: string;
  readonly label: string;
  readonly splitTimeSec: number;
  readonly cumulativeTimeSec: number;
  readonly entrySpeed: number;
  readonly peakSpeed: number;
  readonly minSpeed: number;
  readonly deathsInSegment: number;
  readonly slipPeakInSegment: number;
}

export type BottleneckReason =
  | 'repeated-deaths'
  | 'high-slip-corner'
  | 'excessive-braking'
  | 'slow-traversal';

export interface TelemetryBottleneckSegment {
  readonly segmentId: string;
  readonly label: string;
  readonly severityScore: number;
  readonly reason: BottleneckReason;
  readonly timeSpentSec: number;
  readonly deaths: number;
  readonly peakSlipRatio: number;
  readonly centroid: Vec3;
}

export interface TelemetryTrajectoryPoint {
  readonly t: number;
  readonly pos: Vec3;
  readonly speed: number;
  readonly slipRatio: number;
  readonly status: MarbleLifecycleStatus;
}

export interface RunTelemetrySummary {
  readonly courseId: string;
  readonly courseName: string;
  readonly style: BotPlayStyle;
  readonly outcome: 'goal' | 'timeout' | 'in-progress';
  readonly reachedGoal: boolean;
  readonly durationSec: number;
  readonly parTimeSec: number;
  readonly timeRemainingSec: number;
  readonly framesSimulated: number;
  readonly simulationHz: number;
  readonly topSpeed: number;
  readonly topHorizontalSpeed: number;
  readonly averageSpeed: number;
  readonly slipRatioPeak: number;
  readonly highSlipEventsCount: number;
  readonly totalAirtimeSec: number;
  readonly longestJumpAirtimeSec: number;
  readonly jumpCount: number;
  readonly backspinBrakeCount: number;
  readonly backspinTimeSec: number;
  readonly deathCount: number;
  readonly deaths: readonly TelemetryDeathEvent[];
  readonly deathCoordinates: readonly Vec3[];
  readonly splitTimes: readonly TelemetrySplitTime[];
  readonly bottleneckSegments: readonly TelemetryBottleneckSegment[];
  readonly surfaceTimeBreakdownSec: Readonly<Partial<Record<SurfaceMaterial, number>>>;
  readonly trajectorySample: readonly TelemetryTrajectoryPoint[];
  readonly argonContextPromptBlock: string;
}

export interface TelemetryRecorder {
  recordStep(
    marble: MarbleState,
    input: InputCommand,
    dt: number,
    simTime: number,
    decision?: BotDecisionTelemetry | null,
  ): void;
  finalize(outcomeOverride?: 'goal' | 'timeout' | 'in-progress'): RunTelemetrySummary;
  reset(course?: CourseSpec, style?: BotPlayStyle): void;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}

/**
 * Compute normalized slip ratio between linear tangent velocity and desired/rolling velocity.
 */
export function computeMarbleSlipRatio(
  marble: MarbleState,
  input: InputCommand,
): number {
  if (!marble.contact.grounded) return 0;
  const relVx = marble.velocity[0] - marble.contact.surfaceVelocity[0];
  const relVz = marble.velocity[2] - marble.contact.surfaceVelocity[2];
  const relSpeed = Math.hypot(relVx, relVz);

  const [inX, inZ] = input.moveXZ;
  const inMag = Math.hypot(inX, inZ);

  if (relSpeed < 0.25 && inMag < 0.05) {
    return 0;
  }

  // Slip between velocity direction and applied trackball spin direction (plus ice slide factor)
  let directionalSlip = 0;
  if (relSpeed > 0.3 && inMag > 0.08) {
    const vDirX = relVx / relSpeed;
    const vDirZ = relVz / relSpeed;
    const inDirX = inX / inMag;
    const inDirZ = inZ / inMag;
    const cosTheta = vDirX * inDirX + vDirZ * inDirZ;
    // 0 when aligned, up to 1.0 when perpendicular, up to 2.0 on full reverse backspin skid
    directionalSlip = Math.max(0, 1.0 - cosTheta) * inMag;
  }

  const matScale =
    marble.surfaceMaterial === 'ice'
      ? 1.55
      : marble.surfaceMaterial === 'sticky'
        ? 0.55
        : 1.0;

  return round3(Math.min(2.5, directionalSlip * matScale));
}

interface SegmentAccumulator {
  segmentId: string;
  label: string;
  centroid: Vec3;
  startTimeSec: number;
  timeSpentSec: number;
  entrySpeed: number | null;
  peakSpeed: number;
  minSpeed: number;
  deaths: number;
  peakSlipRatio: number;
  backspinTimeSec: number;
  completed: boolean;
  cumulativeTimeSec: number;
}

export function createTelemetryRecorder(
  initialCourse: CourseSpec,
  initialStyle: BotPlayStyle = 'tourist',
): TelemetryRecorder {
  let course = initialCourse;
  let style = initialStyle;
  let waypoints: BotWaypoint[] = buildCourseWaypoints(course, style);

  let elapsedSec = 0;
  let framesSimulated = 0;
  let topSpeed = 0;
  let topHorizontalSpeed = 0;
  let speedSum = 0;
  let slipRatioPeak = 0;
  let highSlipEventsCount = 0;
  let inHighSlipBurst = false;
  let totalAirtimeSec = 0;
  let currentAirtimeSec = 0;
  let longestJumpAirtimeSec = 0;
  let jumpCount = 0;
  let backspinBrakeCount = 0;
  let inBackspinBurst = false;
  let backspinTimeSec = 0;
  let prevStatus: MarbleLifecycleStatus = 'racing';
  let activeSegmentIdx = 0;

  let deaths: TelemetryDeathEvent[] = [];
  let surfaceTimes: Partial<Record<SurfaceMaterial, number>> = {};
  let trajectorySample: TelemetryTrajectoryPoint[] = [];
  let segments: SegmentAccumulator[] = [];

  function initSegments() {
    waypoints = buildCourseWaypoints(course, style);
    segments = waypoints.map((wp) => ({
      segmentId: wp.id,
      label: wp.label,
      centroid: wp.position,
      startTimeSec: 0,
      timeSpentSec: 0,
      entrySpeed: null,
      peakSpeed: 0,
      minSpeed: Infinity,
      deaths: 0,
      peakSlipRatio: 0,
      backspinTimeSec: 0,
      completed: false,
      cumulativeTimeSec: 0,
    }));
  }

  function reset(nextCourse?: CourseSpec, nextStyle?: BotPlayStyle) {
    if (nextCourse) course = nextCourse;
    if (nextStyle) style = nextStyle;
    elapsedSec = 0;
    framesSimulated = 0;
    topSpeed = 0;
    topHorizontalSpeed = 0;
    speedSum = 0;
    slipRatioPeak = 0;
    highSlipEventsCount = 0;
    inHighSlipBurst = false;
    totalAirtimeSec = 0;
    currentAirtimeSec = 0;
    longestJumpAirtimeSec = 0;
    jumpCount = 0;
    backspinBrakeCount = 0;
    inBackspinBurst = false;
    backspinTimeSec = 0;
    prevStatus = 'racing';
    activeSegmentIdx = 0;
    deaths = [];
    surfaceTimes = {};
    trajectorySample = [];
    initSegments();
  }

  initSegments();

  function recordStep(
    marble: MarbleState,
    input: InputCommand,
    dt: number,
    _simTime: number,
    decision?: BotDecisionTelemetry | null,
  ) {
    elapsedSec += dt;
    framesSimulated++;

    const effectiveVy =
      !marble.contact.grounded &&
      Math.abs(marble.position[1] - marble.prevPosition[1]) < 1e-4
        ? 0
        : marble.velocity[1];
    const speed = Math.hypot(
      marble.velocity[0],
      effectiveVy,
      marble.velocity[2],
    );
    const horizSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);

    if (speed > topSpeed) topSpeed = speed;
    if (horizSpeed > topHorizontalSpeed) topHorizontalSpeed = horizSpeed;
    speedSum += speed;

    // Track active segment from decision or nearest waypoint
    if (decision) {
      const nextIdx = Math.min(segments.length - 1, decision.activeWaypointIndex);
      if (nextIdx > activeSegmentIdx) {
        for (let i = activeSegmentIdx; i < nextIdx; i++) {
          if (!segments[i].completed) {
            segments[i].completed = true;
            segments[i].cumulativeTimeSec = elapsedSec;
          }
        }
        activeSegmentIdx = nextIdx;
      }
    }

    const seg = segments[activeSegmentIdx] ?? segments[segments.length - 1];
    if (seg) {
      seg.timeSpentSec += dt;
      if (seg.entrySpeed === null) seg.entrySpeed = speed;
      if (speed > seg.peakSpeed) seg.peakSpeed = speed;
      if (speed < seg.minSpeed) seg.minSpeed = speed;
    }

    // Slip ratio tracking
    const slipRatio = computeMarbleSlipRatio(marble, input);
    if (slipRatio > slipRatioPeak) slipRatioPeak = slipRatio;
    if (seg && slipRatio > seg.peakSlipRatio) seg.peakSlipRatio = slipRatio;

    if (slipRatio >= 0.85) {
      if (!inHighSlipBurst) {
        highSlipEventsCount++;
        inHighSlipBurst = true;
      }
    } else if (slipRatio < 0.45) {
      inHighSlipBurst = false;
    }

    // Airtime & jumps
    if (input.jumpPressed) {
      jumpCount++;
    }
    if (!marble.contact.grounded && marble.status === 'racing') {
      totalAirtimeSec += dt;
      currentAirtimeSec += dt;
      if (currentAirtimeSec > longestJumpAirtimeSec) {
        longestJumpAirtimeSec = currentAirtimeSec;
      }
    } else {
      currentAirtimeSec = 0;
    }

    // Backspin braking tracking
    const isBackspin = decision?.backspinApplied ?? false;
    if (isBackspin) {
      backspinTimeSec += dt;
      if (seg) seg.backspinTimeSec += dt;
      if (!inBackspinBurst) {
        backspinBrakeCount++;
        inBackspinBurst = true;
      }
    } else {
      inBackspinBurst = false;
    }

    // Surface material time breakdown
    if (marble.contact.grounded) {
      const mat = marble.surfaceMaterial;
      surfaceTimes[mat] = round3((surfaceTimes[mat] ?? 0) + dt);
    }

    // Death transitions ('fell' | 'sunk' | 'shattered')
    if (
      prevStatus === 'racing' &&
      (marble.status === 'fell' ||
        marble.status === 'sunk' ||
        marble.status === 'shattered')
    ) {
      const segId = seg?.segmentId ?? 'unknown';
      if (seg) seg.deaths++;
      deaths.push({
        timeSec: round3(elapsedSec),
        cause: marble.status,
        position: roundVec3(marble.position),
        velocity: roundVec3(marble.velocity),
        surfaceMaterial: marble.surfaceMaterial,
        segmentId: segId,
      });
    }

    if (marble.status === 'goal' && seg && !seg.completed) {
      seg.completed = true;
      seg.cumulativeTimeSec = elapsedSec;
    }

    prevStatus = marble.status;

    // Downsample trajectory every 15 frames (8 Hz at 120 Hz physics)
    if (framesSimulated === 1 || framesSimulated % 15 === 0 || marble.status !== 'racing') {
      if (trajectorySample.length < 240) {
        trajectorySample.push({
          t: round3(elapsedSec),
          pos: roundVec3(marble.position),
          speed: round3(speed),
          slipRatio,
          status: marble.status,
        });
      }
    }
  }

  function finalize(
    outcomeOverride?: 'goal' | 'timeout' | 'in-progress',
  ): RunTelemetrySummary {
    const outcome =
      outcomeOverride ??
      (prevStatus === 'goal' ? 'goal' : 'in-progress');
    const reachedGoal = outcome === 'goal';
    const simulationHz =
      elapsedSec > 1e-5 ? Math.round(framesSimulated / elapsedSec) : 120;

    const splitTimes: TelemetrySplitTime[] = segments
      .filter((s) => s.timeSpentSec > 0.01)
      .map((s) => ({
        segmentId: s.segmentId,
        label: s.label,
        splitTimeSec: round3(s.timeSpentSec),
        cumulativeTimeSec: round3(
          s.cumulativeTimeSec > 0 ? s.cumulativeTimeSec : elapsedSec,
        ),
        entrySpeed: round3(s.entrySpeed ?? 0),
        peakSpeed: round3(s.peakSpeed),
        minSpeed: round3(Number.isFinite(s.minSpeed) ? s.minSpeed : 0),
        deathsInSegment: s.deaths,
        slipPeakInSegment: round3(s.peakSlipRatio),
      }));

    // Rank bottleneck segments for the Argon 1M-Token Course Architect
    const bottleneckSegments: TelemetryBottleneckSegment[] = segments
      .filter((s) => s.timeSpentSec > 0.1)
      .map((s) => {
        const severityScore = round3(
          s.deaths * 5.0 +
            s.peakSlipRatio * 1.4 +
            s.backspinTimeSec * 2.2 +
            Math.max(0, s.timeSpentSec - 2.0) * 0.85,
        );
        let reason: BottleneckReason = 'slow-traversal';
        if (s.deaths > 0) {
          reason = 'repeated-deaths';
        } else if (s.peakSlipRatio >= 0.95) {
          reason = 'high-slip-corner';
        } else if (s.backspinTimeSec >= 0.35) {
          reason = 'excessive-braking';
        }
        return {
          segmentId: s.segmentId,
          label: s.label,
          severityScore,
          reason,
          timeSpentSec: round3(s.timeSpentSec),
          deaths: s.deaths,
          peakSlipRatio: round3(s.peakSlipRatio),
          centroid: roundVec3(s.centroid),
        };
      })
      .sort((a, b) => b.severityScore - a.severityScore)
      .slice(0, 4);

    const deathCoordinates = deaths.map((d) => d.position);
    const timeRemainingSec = round3(Math.max(0, course.parTimeSec - elapsedSec));
    const avgSpeed = framesSimulated > 0 ? round3(speedSum / framesSimulated) : 0;

    const summaryWithoutPrompt = {
      courseId: course.id,
      courseName: course.name,
      style,
      outcome,
      reachedGoal,
      durationSec: round3(elapsedSec),
      parTimeSec: course.parTimeSec,
      timeRemainingSec,
      framesSimulated,
      simulationHz,
      topSpeed: round3(topSpeed),
      topHorizontalSpeed: round3(topHorizontalSpeed),
      averageSpeed: avgSpeed,
      slipRatioPeak: round3(slipRatioPeak),
      highSlipEventsCount,
      totalAirtimeSec: round3(totalAirtimeSec),
      longestJumpAirtimeSec: round3(longestJumpAirtimeSec),
      jumpCount,
      backspinBrakeCount,
      backspinTimeSec: round3(backspinTimeSec),
      deathCount: deaths.length,
      deaths,
      deathCoordinates,
      splitTimes,
      bottleneckSegments,
      surfaceTimeBreakdownSec: surfaceTimes,
      trajectorySample,
    };

    const argonContextPromptBlock = [
      `### [ARGON 1M ARCHITECT TELEMETRY] ${course.name} (${course.id}) — Style: ${style.toUpperCase()}`,
      `- Outcome: ${outcome.toUpperCase()} in ${summaryWithoutPrompt.durationSec}s / ${course.parTimeSec}s par (${timeRemainingSec}s left)`,
      `- Speed: Top ${summaryWithoutPrompt.topSpeed} m/s | Avg ${avgSpeed} m/s | Peak Slip Ratio ${summaryWithoutPrompt.slipRatioPeak}`,
      `- Airtime: ${summaryWithoutPrompt.totalAirtimeSec}s (${jumpCount} hops) | Backspin Braking: ${summaryWithoutPrompt.backspinTimeSec}s (${backspinBrakeCount} events)`,
      `- Deaths (${deaths.length}): ${
        deathCoordinates.length > 0
          ? deathCoordinates.map((c) => `[${c.join(', ')}]`).join(', ')
          : 'None (Clean Run)'
      }`,
      `- Top Bottlenecks: ${
        bottleneckSegments
          .map(
            (b) =>
              `${b.label} (${b.reason}, severity=${b.severityScore}, time=${b.timeSpentSec}s, slip=${b.peakSlipRatio})`,
          )
          .join(' | ') || 'None'
      }`,
    ].join('\n');

    return {
      ...summaryWithoutPrompt,
      argonContextPromptBlock,
    };
  }

  return {
    recordStep,
    finalize,
    reset,
  };
}

export interface HeadlessRolloutOptions {
  readonly style?: BotPlayStyle;
  readonly maxDurationSec?: number;
  readonly seed?: number;
  readonly physicsConfig?: PhysicsConfig;
  readonly evaluator?: CpuWorldEvaluator;
}

export interface HeadlessRolloutResult {
  readonly summary: RunTelemetrySummary;
  readonly finalState: MarbleState;
  readonly wallClockMs: number;
  readonly effectiveHz: number;
}

/**
 * Run a deterministic 120 Hz physics + autonomous bot rollout in Node or background JS
 * at 1000+ Hz wall-clock execution speed.
 */
export function runHeadlessBotRollout(
  course: CourseSpec,
  options: HeadlessRolloutOptions = {},
): HeadlessRolloutResult {
  const style = options.style ?? 'tourist';
  const config = options.physicsConfig ?? DEFAULT_PHYSICS_CONFIG;
  const maxDurationSec = options.maxDurationSec ?? course.parTimeSec;
  const maxSteps = Math.ceil(maxDurationSec / config.fixedDt);

  const evaluator = options.evaluator ?? createCpuWorldEvaluator(course);
  const sim = createMarbleSimulation(course, evaluator, config);
  const driver = createAutonomousDriver(course, evaluator, {
    style,
    seed: options.seed,
    physicsConfig: config,
  });
  const recorder = createTelemetryRecorder(course, style);

  const t0 = performance.now();
  let simTime = 0;

  for (let step = 0; step < maxSteps; step++) {
    const currentMarble = sim.getState();
    if (currentMarble.status === 'goal') {
      break;
    }

    const decision = driver.stepDecision(currentMarble, simTime, config.fixedDt);
    simTime += config.fixedDt;
    const nextMarble = sim.stepFixed(config.fixedDt, decision.commands, simTime);
    recorder.recordStep(
      nextMarble,
      decision.commands,
      config.fixedDt,
      simTime,
      decision,
    );

    if (nextMarble.status === 'goal') {
      break;
    }
  }

  const wallClockMs = Math.max(0.05, performance.now() - t0);
  const finalState = sim.getState();
  const outcome = finalState.status === 'goal' ? 'goal' : 'timeout';
  const summary = recorder.finalize(outcome);
  const effectiveHz = Math.round((summary.framesSimulated / wallClockMs) * 1000);

  return {
    summary,
    finalState,
    wallClockMs: round3(wallClockMs),
    effectiveHz,
  };
}

/**
 * Minimal host interface compatible with `window.__MARBLE_PLAYTEST__` in `src/App.tsx`.
 */
export interface PlaytestWindowHost {
  getState: () => {
    readonly course: CourseSpec;
    readonly marble: MarbleState;
    readonly status: MarbleLifecycleStatus;
  };
  setWorldInputXZ: (worldX: number, worldZ: number, jump?: boolean) => void;
  clearInput: () => void;
  stepFrames: (
    frames?: number,
    worldInputXZ?: readonly [number, number],
    jump?: boolean,
  ) => {
    readonly course: CourseSpec;
    readonly marble: MarbleState;
    readonly status: MarbleLifecycleStatus;
  };
  respawn?: (atCheckpoint?: boolean) => unknown;
}

export interface BotPlaytestController {
  isEnabled(): boolean;
  getStyle(): BotPlayStyle;
  setStyle(style: BotPlayStyle): void;
  cycleStyle(): BotPlayStyle;
  toggle(style?: BotPlayStyle): boolean;
  setEnabled(enabled: boolean, style?: BotPlayStyle): void;
  getSpeedMultiplier(): number;
  setSpeedMultiplier(multiplier: 1 | 10): void;
  stepLiveFrame(dtSec?: number): BotDecisionTelemetry | null;
  runFastForwardRollout(
    options?: {
      style?: BotPlayStyle;
      speedMultiplier?: number;
      maxDurationSec?: number;
      applyToLiveViewport?: boolean;
    },
  ): RunTelemetrySummary;
  getLatestSummary(): RunTelemetrySummary | null;
  getTelemetryHistory(): readonly RunTelemetrySummary[];
  dispose(): void;
}

declare global {
  interface Window {
    __MARBLE_BOT__?: BotPlaytestController;
  }
}

/**
 * Create an in-game `[P] AI Bot Auto-Playtest` controller that binds to
 * `window.__MARBLE_PLAYTEST__` (or a supplied `PlaytestWindowHost`), drives
 * the marble live at 60 FPS (or 10x fast-forward), and records `RunTelemetrySummary` JSON.
 */
export function createBotPlaytestController(
  hostGetter: () => PlaytestWindowHost | undefined = () =>
    typeof window !== 'undefined'
      ? (window as unknown as { __MARBLE_PLAYTEST__?: PlaytestWindowHost })
          .__MARBLE_PLAYTEST__
      : undefined,
  options: {
    initialStyle?: BotPlayStyle;
    attachKeyboardShortcut?: boolean;
  } = {},
): BotPlaytestController {
  let enabled = false;
  let style: BotPlayStyle = options.initialStyle ?? 'tourist';
  let speedMultiplier: 1 | 10 = 1;
  let activeCourseId = '';
  let evaluator: CpuWorldEvaluator | null = null;
  let driver: AutonomousDriver | null = null;
  let recorder: TelemetryRecorder | null = null;
  let simTime = 0;
  let rafId = 0;
  let lastFrameMs = 0;
  let latestSummary: RunTelemetrySummary | null = null;
  const history: RunTelemetrySummary[] = [];

  function ensureCourseDriver(course: CourseSpec) {
    if (!evaluator || !driver || !recorder || activeCourseId !== course.id) {
      activeCourseId = course.id;
      evaluator = createCpuWorldEvaluator(course);
      driver = createAutonomousDriver(course, evaluator, { style });
      recorder = createTelemetryRecorder(course, style);
      simTime = 0;
    }
  }

  function stepLiveFrame(dtSec = 1 / 60): BotDecisionTelemetry | null {
    const host = hostGetter();
    if (!host) return null;

    const snap = host.getState();
    ensureCourseDriver(snap.course);
    if (!driver || !recorder) return null;

    if (snap.status === 'goal') {
      if (!latestSummary || latestSummary.courseId !== snap.course.id) {
        const summary = recorder.finalize('goal');
        latestSummary = summary;
        history.push(summary);
      }
      host.clearInput();
      return driver.getLastDecision();
    }

    if (speedMultiplier === 10) {
      // 10x fast-forward live viewport rollout (20 fixed 120Hz steps per 60FPS render frame)
      let lastDec: BotDecisionTelemetry | null = null;
      for (let i = 0; i < 20; i++) {
        const curSnap = host.getState();
        if (curSnap.status === 'goal') break;
        const dec = driver.stepDecision(curSnap.marble, simTime, 1 / 120);
        lastDec = dec;
        simTime += 1 / 120;
        const afterSnap = host.stepFrames(
          1,
          dec.commands.moveXZ,
          dec.commands.jumpPressed,
        );
        recorder.recordStep(
          afterSnap.marble,
          dec.commands,
          1 / 120,
          simTime,
          dec,
        );
      }
      return lastDec;
    }

    // Standard 1x 60 FPS live arcade attract / auto-playtest mode
    simTime += dtSec;
    const decision = driver.stepDecision(snap.marble, simTime, dtSec);
    host.setWorldInputXZ(
      decision.commands.moveXZ[0],
      decision.commands.moveXZ[1],
      decision.commands.jumpPressed,
    );
    recorder.recordStep(
      snap.marble,
      decision.commands,
      dtSec,
      simTime,
      decision,
    );
    return decision;
  }

  function scheduleLoop() {
    if (typeof window === 'undefined' || rafId !== 0) return;
    lastFrameMs = performance.now();
    const loop = (nowMs: number) => {
      if (!enabled) {
        rafId = 0;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.004, (nowMs - lastFrameMs) / 1000));
      lastFrameMs = nowMs;
      stepLiveFrame(dt);
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (typeof window !== 'undefined' && rafId !== 0) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    const host = hostGetter();
    host?.clearInput();
  }

  function setEnabled(nextEnabled: boolean, nextStyle?: BotPlayStyle) {
    if (nextStyle && nextStyle !== style) {
      style = nextStyle;
      driver?.setStyle(style);
    }
    enabled = nextEnabled;
    if (enabled) {
      const host = hostGetter();
      if (host) {
        const snap = host.getState();
        ensureCourseDriver(snap.course);
        driver?.reset(snap.course, evaluator ?? undefined);
        recorder?.reset(snap.course, style);
      }
      scheduleLoop();
    } else {
      if (recorder) {
        const summary = recorder.finalize();
        latestSummary = summary;
        history.push(summary);
      }
      stopLoop();
    }
  }

  function toggle(nextStyle?: BotPlayStyle): boolean {
    setEnabled(!enabled, nextStyle);
    return enabled;
  }

  function cycleStyle(): BotPlayStyle {
    const order: readonly BotPlayStyle[] = [
      'tourist',
      'speedrunner',
      'chaos-explorer',
    ];
    const nextIdx = (order.indexOf(style) + 1) % order.length;
    style = order[nextIdx];
    driver?.setStyle(style);
    return style;
  }

  function runFastForwardRollout(
    rolloutOpts: {
      style?: BotPlayStyle;
      speedMultiplier?: number;
      maxDurationSec?: number;
      applyToLiveViewport?: boolean;
    } = {},
  ): RunTelemetrySummary {
    const targetStyle = rolloutOpts.style ?? style;
    const host = hostGetter();

    if (host && rolloutOpts.applyToLiveViewport) {
      const snap = host.getState();
      ensureCourseDriver(snap.course);
      if (driver && recorder && evaluator) {
        driver.setStyle(targetStyle);
        driver.reset(snap.course, evaluator);
        recorder.reset(snap.course, targetStyle);
        const maxSteps = Math.ceil(
          (rolloutOpts.maxDurationSec ?? snap.course.parTimeSec) * 120,
        );
        for (let step = 0; step < maxSteps; step++) {
          const cur = host.getState();
          if (cur.status === 'goal') break;
          const dec = driver.stepDecision(cur.marble, step / 120, 1 / 120);
          const next = host.stepFrames(
            1,
            dec.commands.moveXZ,
            dec.commands.jumpPressed,
          );
          recorder.recordStep(
            next.marble,
            dec.commands,
            1 / 120,
            (step + 1) / 120,
            dec,
          );
          if (next.status === 'goal') break;
        }
        const finalSnap = host.getState();
        const summary = recorder.finalize(
          finalSnap.status === 'goal' ? 'goal' : 'timeout',
        );
        latestSummary = summary;
        history.push(summary);
        return summary;
      }
    }

    const activeCourse = host?.getState().course;
    if (!activeCourse) {
      throw new Error(
        'Cannot run fast-forward rollout without an active CourseSpec or PlaytestWindowHost.',
      );
    }

    const result = runHeadlessBotRollout(activeCourse, {
      style: targetStyle,
      maxDurationSec: rolloutOpts.maxDurationSec ?? activeCourse.parTimeSec,
    });
    latestSummary = result.summary;
    history.push(result.summary);
    return result.summary;
  }

  function onKeyDown(ev: KeyboardEvent) {
    const target = ev.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target.isContentEditable
      ) {
        return;
      }
    }
    if (ev.code === 'KeyP') {
      ev.preventDefault();
      if (ev.shiftKey) {
        cycleStyle();
        if (!enabled) {
          setEnabled(true);
        }
      } else {
        toggle();
      }
    }
  }

  if (
    typeof window !== 'undefined' &&
    (options.attachKeyboardShortcut ?? true)
  ) {
    window.addEventListener('keydown', onKeyDown);
  }

  function dispose() {
    stopLoop();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown);
    }
  }

  return {
    isEnabled: () => enabled,
    getStyle: () => style,
    setStyle: (nextStyle: BotPlayStyle) => {
      style = nextStyle;
      driver?.setStyle(style);
    },
    cycleStyle,
    toggle,
    setEnabled,
    getSpeedMultiplier: () => speedMultiplier,
    setSpeedMultiplier: (mult: 1 | 10) => {
      speedMultiplier = mult;
    },
    stepLiveFrame,
    runFastForwardRollout,
    getLatestSummary: () => latestSummary,
    getTelemetryHistory: () => history,
    dispose,
  };
}

/**
 * Install the AI Bot Auto-Playtest controller onto `window.__MARBLE_BOT__`
 * and attach `[P]` hotkey support in browser environments.
 */
export function installBotPlaytestGlobalBridge(
  initialStyle: BotPlayStyle = 'tourist',
): BotPlaytestController {
  if (typeof window !== 'undefined' && window.__MARBLE_BOT__) {
    return window.__MARBLE_BOT__;
  }
  const controller = createBotPlaytestController(undefined, {
    initialStyle,
    attachKeyboardShortcut: true,
  });
  if (typeof window !== 'undefined') {
    window.__MARBLE_BOT__ = controller;
  }
  return controller;
}
