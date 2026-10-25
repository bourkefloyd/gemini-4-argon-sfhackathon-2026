/**
 * Unified Arcade Sensory & Replay Session (`src/feel/sensory-session.ts`)
 *
 * Bridges:
 * - `TactileFeelTracker` (`src/feel/tactile-feel.ts`) — slip ratio, backspin brake, glass stress `[0..1]`, rim-catch assist
 * - `GhostReplayManager` (`src/replay/ghost-replay.ts`) — 120 Hz ghost recording, Argon Pro Ghost par line, live `+/-` split timer
 * - `Ym2151ArcadeSynth` (`src/audio/ym2151-synth.ts`) — continuous FM rolling resonance, skid chirp, rim pulse, SFX & Hal Canon theme
 */

import {
  createYm2151ArcadeSynth,
  type Ym2151ArcadeSynth,
  type Ym2151SynthState,
} from '../audio';
import type {
  CameraState,
  CourseSpec,
  CpuWorldEvaluator,
  InputCommand,
  MarbleState,
} from '../contracts';
import {
  createGhostReplayManager,
  type GhostPlaybackPose,
  type GhostReplayManager,
  type SplitDeltaSnapshot,
} from '../replay';
import {
  createTactileFeelTracker,
  type TactileFeelState,
  type TactileFeelTracker,
} from './tactile-feel';

export interface SensoryFrameSnapshot {
  readonly feel: TactileFeelState;
  readonly ghostPose: GhostPlaybackPose;
  readonly split: SplitDeltaSnapshot;
  readonly synth: Ym2151SynthState;
}

export interface ArcadeSensorySession {
  readonly feelTracker: TactileFeelTracker;
  readonly replayManager: GhostReplayManager;
  readonly synth: Ym2151ArcadeSynth;
  setCourse(course: CourseSpec, marble?: MarbleState): void;
  onRespawn(course: CourseSpec, marble?: MarbleState): void;
  step(params: {
    dt: number;
    marble: MarbleState;
    input: InputCommand;
    evaluator?: CpuWorldEvaluator | null;
    camera?: CameraState;
    simTimeSec: number;
    runTimeSec: number;
    timeRemainingSec: number;
  }): SensoryFrameSnapshot;
  getSnapshot(marble: MarbleState, runTimeSec?: number): SensoryFrameSnapshot;
  dispose(): void;
}

export function createArcadeSensorySession(
  initialCourse: CourseSpec,
  options?: {
    initialMuted?: boolean;
    initialVolume?: number;
  },
): ArcadeSensorySession {
  let currentCourse = initialCourse;
  const feelTracker = createTactileFeelTracker();
  const replayManager = createGhostReplayManager(initialCourse);
  const synth = createYm2151ArcadeSynth(options);

  function setCourse(course: CourseSpec, marble?: MarbleState): void {
    currentCourse = course;
    feelTracker.reset(marble);
    replayManager.startRun(course);
  }

  function onRespawn(course: CourseSpec, marble?: MarbleState): void {
    currentCourse = course;
    feelTracker.reset(marble);
    replayManager.startRun(course);
    synth.triggerRespawnSweep();
  }

  function step(params: {
    dt: number;
    marble: MarbleState;
    input: InputCommand;
    evaluator?: CpuWorldEvaluator | null;
    camera?: CameraState;
    simTimeSec: number;
    runTimeSec: number;
    timeRemainingSec: number;
  }): SensoryFrameSnapshot {
    const feel = feelTracker.step(
      params.dt,
      params.marble,
      params.input,
      params.evaluator,
      params.simTimeSec,
    );

    if (params.marble.status === 'racing' || params.marble.status === 'goal') {
      replayManager.recordFrame(params.marble, params.runTimeSec);
    }

    const ghostPose = replayManager.sampleGhostPose(params.runTimeSec);
    const split = replayManager.getSplitSnapshot(params.marble, params.runTimeSec);

    const synthState = synth.update({
      dt: params.dt,
      marble: params.marble,
      feel,
      camera: params.camera,
      timeRemainingSec: params.timeRemainingSec,
      courseIndex: currentCourse.index,
    });

    return {
      feel,
      ghostPose,
      split,
      synth: synthState,
    };
  }

  function getSnapshot(marble: MarbleState, runTimeSec = replayManager.getCurrentRunTimeSec()): SensoryFrameSnapshot {
    return {
      feel: feelTracker.getState(),
      ghostPose: replayManager.sampleGhostPose(runTimeSec),
      split: replayManager.getSplitSnapshot(marble, runTimeSec),
      synth: synth.getState(),
    };
  }

  function dispose(): void {
    synth.dispose();
  }

  return {
    feelTracker,
    replayManager,
    synth,
    setCourse,
    onRespawn,
    step,
    getSnapshot,
    dispose,
  };
}
