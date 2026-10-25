/**
 * Marble Madness SDF Remake — Main Playtest Application (`src/App.tsx`)
 *
 * Connects:
 * - Declarative `CourseSpec` catalog (`src/courses/`)
 * - Lockstep CPU SDF Evaluator (`src/sdf/eval-cpu.ts`)
 * - Lockstep GPU WebGL2/WGSL Fullscreen Raymarcher (`src/rendering/`)
 * - 120 Hz Fixed-Step Arcade Marble Physics (`src/physics/`)
 * - Isometric-Follow Camera & Virtual Trackball Input (`src/camera/`)
 * - Retro-Futuristic Arcade HUD & Gemini 4 Argon 1M Course Architect Hook (`src/ui/`)
 * - Automated Playtest & Telemetry Bridge (`window.__MARBLE_PLAYTEST__` & `window.__MARBLE_MADNESS_ARCHITECT__`)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createArcadeInputController,
  createIsometricCameraRig,
  type TrackballUiTelemetry,
} from './camera';
import type {
  CameraState,
  CameraZoomStopId,
  CourseSpec,
  MarbleState,
  Vec3,
} from './contracts';
import { BUILT_IN_COURSES } from './courses';
import { createMarbleSimulation } from './physics';
import { createRaymarchRenderer } from './rendering';
import { createCpuWorldEvaluator } from './sdf/eval-cpu';
import { ArcadeHud, ArchitectHookPanel } from './ui';
import {
  createArcadeSensorySession,
  type TactileFeelState,
} from './feel';
import type { GhostPlaybackPose, SplitDeltaSnapshot } from './replay';
import type { Ym2151SynthState } from './audio';
import { createShatterSimulator, createShockwaveManager } from './vfx';
import {
  type BotPlayStyle,
  type BotPlaytestController,
  createBotPlaytestController,
  type RunTelemetrySummary,
} from './bot';

export interface MarblePlaytestTelemetry {
  readonly courseId: string;
  readonly courseIndex: number;
  readonly courseName: string;
  readonly course: CourseSpec;
  readonly marble: MarbleState;
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly speed: number;
  readonly horizSpeed: number;
  readonly slopeDeg: number;
  readonly status: MarbleState['status'];
  readonly surfaceMaterial: MarbleState['surfaceMaterial'];
  readonly grounded: boolean;
  readonly distanceToGoal: number;
  readonly startPos: Vec3;
  readonly goalPos: Vec3;
  readonly goalRadius: number;
  readonly timeRemainingSec: number;
  readonly score: number;
  readonly fps: number;
  readonly camera: CameraState;
  readonly feel?: TactileFeelState;
  readonly ghostPose?: GhostPlaybackPose;
  readonly ghostSplit?: SplitDeltaSnapshot;
  readonly synth?: Ym2151SynthState;
  readonly botEnabled?: boolean;
  readonly botStyle?: BotPlayStyle;
  readonly botLatestSummary?: RunTelemetrySummary | null;
}

export interface MarblePlaytestApi {
  getState: () => MarblePlaytestTelemetry;
  getTelemetry: () => MarblePlaytestTelemetry;
  selectCourse: (indexOrId: number | string) => MarblePlaytestTelemetry;
  setInput: (right: number, up: number, jump?: boolean) => void;
  setWorldInputXZ: (worldX: number, worldZ: number, jump?: boolean) => void;
  pulseInput: (right: number, up: number, jump?: boolean) => void;
  clearInput: () => void;
  stepFrames: (
    frames?: number,
    worldInputXZ?: readonly [number, number],
    jump?: boolean,
  ) => MarblePlaytestTelemetry;
  respawn: (atCheckpoint?: boolean) => MarblePlaytestTelemetry;
  teleportMarble: (
    position: Vec3,
    velocity?: Vec3,
  ) => MarblePlaytestTelemetry;
  cycleCameraZoom: () => CameraState;
  setCameraZoom: (stopIndexOrId: number | CameraZoomStopId) => CameraState;
  loadCourseSpec: (spec: CourseSpec) => MarblePlaytestTelemetry;
  getCompiledShaders: () => { glsl: string; wgsl: string; backend: string };
}

declare global {
  interface Window {
    __MARBLE_PLAYTEST__?: MarblePlaytestApi;
    __MARBLE_MADNESS_ARCHITECT__?: MarblePlaytestApi;
  }
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [courses, setCourses] = useState<readonly CourseSpec[]>(BUILT_IN_COURSES);
  const [activeCourseIndex, setActiveCourseIndex] = useState<number>(0);
  const currentCourse = courses[activeCourseIndex] ?? courses[0];

  const evaluatorRef = useRef(createCpuWorldEvaluator(currentCourse));
  const simRef = useRef(createMarbleSimulation(currentCourse, evaluatorRef.current));
  const cameraRigRef = useRef(
    createIsometricCameraRig(currentCourse, currentCourse.startPos),
  );
  const rendererRef = useRef<ReturnType<typeof createRaymarchRenderer> | null>(null);
  const sensoryRef = useRef(createArcadeSensorySession(currentCourse));
  const shatterSimRef = useRef(createShatterSimulator());
  const shockwaveMgrRef = useRef(createShockwaveManager());
  const botControllerRef = useRef<BotPlaytestController | null>(null);

  const [uiMarble, setUiMarble] = useState<MarbleState>(() => simRef.current.getState());
  const [uiCamera, setUiCamera] = useState<CameraState>(() => cameraRigRef.current.getState());
  const [uiFeel, setUiFeel] = useState<TactileFeelState>(() =>
    sensoryRef.current.feelTracker.getState(),
  );
  const [uiGhostSplit, setUiGhostSplit] = useState<SplitDeltaSnapshot>(() =>
    sensoryRef.current.replayManager.getSplitSnapshot(simRef.current.getState(), 0),
  );
  const [uiSynth, setUiSynth] = useState<Ym2151SynthState>(() =>
    sensoryRef.current.synth.getState(),
  );
  const [botEnabled, setBotEnabled] = useState<boolean>(false);
  const [botStyle, setBotStyle] = useState<BotPlayStyle>('tourist');
  const [timeRemainingSec, setTimeRemainingSec] = useState<number>(currentCourse.parTimeSec);
  const [score, setScore] = useState<number>(0);
  const [bonusBannerSec, setBonusBannerSec] = useState<number | null>(null);
  const [fps, setFps] = useState<number>(60);
  const [architectOpen, setArchitectOpen] = useState<boolean>(false);
  const [compiledShaders, setCompiledShaders] = useState<{
    glsl: string;
    wgsl: string;
    backend: string;
  }>({ glsl: '', wgsl: '', backend: 'webgl2' });
  const [trackball, setTrackball] = useState<TrackballUiTelemetry>({
    active: false,
    vector: [0, 0],
    keyVector: [0, 0],
  });

  const timeRemainingRef = useRef<number>(currentCourse.parTimeSec);
  const runElapsedRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const simTimeRef = useRef<number>(0);
  const activeCourseRef = useRef<CourseSpec>(currentCourse);
  const coursesRef = useRef<readonly CourseSpec[]>(courses);
  const activeIdxRef = useRef<number>(activeCourseIndex);
  const goalAwardedRef = useRef<boolean>(false);
  const prevMarbleRef = useRef<MarbleState>(simRef.current.getState());

  // Programmatic bot override state for `window.__MARBLE_PLAYTEST__`
  const botOverrideRef = useRef<{
    mode: 'none' | 'screen' | 'world';
    vec: readonly [number, number];
    jumpQueued: boolean;
  }>({
    mode: 'none',
    vec: [0, 0],
    jumpQueued: false,
  });

  coursesRef.current = courses;
  activeIdxRef.current = activeCourseIndex;
  activeCourseRef.current = currentCourse;

  const activateCourse = useCallback(
    (nextCourse: CourseSpec, nextIndex: number, carryOverBonusSec: number | null) => {
      const nextEval = createCpuWorldEvaluator(nextCourse);
      evaluatorRef.current = nextEval;
      simRef.current.setCourse(nextCourse, nextEval);
      cameraRigRef.current.snapToCourse(nextCourse, nextCourse.startPos);
      sensoryRef.current.setCourse(nextCourse);
      shatterSimRef.current.reset();
      shockwaveMgrRef.current.clear();
      runElapsedRef.current = 0;
      prevMarbleRef.current = simRef.current.getState();

      if (rendererRef.current) {
        rendererRef.current.setCourse(nextCourse);
        setCompiledShaders(rendererRef.current.getCompiledShaders());
      }

      const nextTime =
        carryOverBonusSec !== null
          ? Math.min(199, Math.max(15, timeRemainingRef.current) + carryOverBonusSec)
          : nextCourse.parTimeSec;

      timeRemainingRef.current = nextTime;
      goalAwardedRef.current = false;
      activeCourseRef.current = nextCourse;
      activeIdxRef.current = nextIndex;

      setActiveCourseIndex(nextIndex);
      setTimeRemainingSec(nextTime);
      setUiMarble(simRef.current.getState());
      setUiCamera(cameraRigRef.current.getState());
      setUiFeel(sensoryRef.current.feelTracker.getState());
      setUiGhostSplit(
        sensoryRef.current.replayManager.getSplitSnapshot(simRef.current.getState(), 0),
      );

      if (carryOverBonusSec !== null) {
        setBonusBannerSec(carryOverBonusSec);
        window.setTimeout(() => {
          setBonusBannerSec(null);
        }, 3600);
      } else {
        setBonusBannerSec(null);
      }
    },
    [],
  );

  const handleSelectCourse = useCallback(
    (indexOrId: number | string) => {
      const list = coursesRef.current;
      let targetIdx = 0;
      if (typeof indexOrId === 'string') {
        const byId = list.findIndex(
          (c) => c.id === indexOrId || c.name.toLowerCase() === indexOrId.toLowerCase(),
        );
        targetIdx = byId >= 0 ? byId : 0;
      } else {
        targetIdx = ((indexOrId % list.length) + list.length) % list.length;
      }
      const target = list[targetIdx];
      if (!target) return;
      activateCourse(target, targetIdx, null);
    },
    [activateCourse],
  );

  const handleNextCourseWithBonus = useCallback(() => {
    const list = coursesRef.current;
    const nextIdx = (activeIdxRef.current + 1) % list.length;
    const nextCourse = list[nextIdx];
    if (!nextCourse) return;
    activateCourse(nextCourse, nextIdx, nextCourse.bonusTimeSec);
  }, [activateCourse]);

  const handleApplyCustomCourse = useCallback(
    (customSpec: CourseSpec) => {
      setCourses((prev) => {
        const existingIdx = prev.findIndex((c) => c.id === customSpec.id);
        let nextList: CourseSpec[];
        let targetIdx: number;
        if (existingIdx >= 0) {
          nextList = prev.map((c, i) => (i === existingIdx ? customSpec : c));
          targetIdx = existingIdx;
        } else {
          nextList = [...prev, { ...customSpec, index: prev.length + 1 }];
          targetIdx = nextList.length - 1;
        }
        coursesRef.current = nextList;
        activateCourse(nextList[targetIdx], targetIdx, null);
        return nextList;
      });
    },
    [activateCourse],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createRaymarchRenderer(canvas, activeCourseRef.current);
    rendererRef.current = renderer;
    setCompiledShaders(renderer.getCompiledShaders());

    const inputCtrl = createArcadeInputController(window, {
      onSelectCourse: (idx) => handleSelectCourse(idx),
      onCycleCameraZoom: () => {
        cameraRigRef.current.cycleZoomStop();
      },
      onCycleMarblePreset: () => {
        simRef.current.cycleMarblePreset();
      },
      onRespawn: () => {
        simRef.current.respawn(true);
        sensoryRef.current.onRespawn(activeCourseRef.current, simRef.current.getState());
        runElapsedRef.current = 0;
      },
      onOrbitCameraYaw: (deltaDeg) => {
        cameraRigRef.current.adjustYaw(deltaDeg);
      },
      onToggleArchitectPanel: () => {
        setArchitectOpen((prev) => !prev);
      },
      onToggleAudioMute: () => {
        sensoryRef.current.synth.resume();
        sensoryRef.current.synth.toggleMute();
        setUiSynth(sensoryRef.current.synth.getState());
      },
      onUserGesture: () => {
        sensoryRef.current.synth.resume();
      },
    });

    const buildTelemetrySnapshot = (): MarblePlaytestTelemetry => {
      const course = activeCourseRef.current;
      const marble = simRef.current.getState();
      const camera = cameraRigRef.current.getState();
      const horizSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);
      const speed = Math.hypot(marble.velocity[0], marble.velocity[1], marble.velocity[2]);
      const ny = Math.min(1, Math.max(-1, marble.contact.normal[1]));
      const slopeDeg = marble.contact.grounded
        ? Math.round((Math.acos(ny) * 180) / Math.PI)
        : 0;
      const distanceToGoal = Math.hypot(
        marble.position[0] - course.goalPos[0],
        marble.position[2] - course.goalPos[2],
      );

      return {
        courseId: course.id,
        courseIndex: activeIdxRef.current,
        courseName: course.name,
        course,
        marble,
        position: marble.position,
        velocity: marble.velocity,
        speed,
        horizSpeed,
        slopeDeg,
        status: marble.status,
        surfaceMaterial: marble.surfaceMaterial,
        grounded: marble.contact.grounded,
        distanceToGoal,
        startPos: course.startPos,
        goalPos: course.goalPos,
        goalRadius: course.goalRadius,
        timeRemainingSec: timeRemainingRef.current,
        score: scoreRef.current,
        fps: Math.round(fpsRef.current),
        camera,
        feel: sensoryRef.current.feelTracker.getState(),
        ghostPose: sensoryRef.current.replayManager.sampleGhostPose(runElapsedRef.current),
        ghostSplit: sensoryRef.current.replayManager.getSplitSnapshot(
          marble,
          runElapsedRef.current,
        ),
        synth: sensoryRef.current.synth.getState(),
        botEnabled: botControllerRef.current?.isEnabled() ?? false,
        botStyle: botControllerRef.current?.getStyle() ?? 'tourist',
        botLatestSummary: botControllerRef.current?.getLatestSummary() ?? null,
      };
    };

    const playtestApi: MarblePlaytestApi = {
      getState: buildTelemetrySnapshot,
      getTelemetry: buildTelemetrySnapshot,
      selectCourse: (indexOrId) => {
        handleSelectCourse(indexOrId);
        return buildTelemetrySnapshot();
      },
      setInput: (right, up, jump = false) => {
        botOverrideRef.current = {
          mode: 'screen',
          vec: [Math.max(-1, Math.min(1, right)), Math.max(-1, Math.min(1, up))],
          jumpQueued: jump,
        };
      },
      setWorldInputXZ: (worldX, worldZ, jump = false) => {
        const mag = Math.hypot(worldX, worldZ);
        const nx = mag > 1 ? worldX / mag : worldX;
        const nz = mag > 1 ? worldZ / mag : worldZ;
        botOverrideRef.current = {
          mode: 'world',
          vec: [nx, nz],
          jumpQueued: jump,
        };
      },
      pulseInput: (right, up, jump = false) => {
        inputCtrl.triggerVirtualPulse(right, up, jump);
      },
      clearInput: () => {
        botOverrideRef.current = {
          mode: 'none',
          vec: [0, 0],
          jumpQueued: false,
        };
      },
      stepFrames: (frames = 1, worldInputXZ, jump = false) => {
        const count = Math.max(1, Math.min(2400, Math.floor(frames)));
        const dt = 1 / 120;
        const baseMoveXZ: readonly [number, number] = worldInputXZ ?? [0, 0];
        let latestSensory = sensoryRef.current.getSnapshot(
          simRef.current.getState(),
          runElapsedRef.current,
        );
        for (let i = 0; i < count; i++) {
          simTimeRef.current += dt;
          const prevM = simRef.current.getState();
          const currentFeel = sensoryRef.current.feelTracker.getState();
          const assistedMoveXZ = currentFeel.rim.rimSaveActive
            ? currentFeel.rim.assistedMoveXZ
            : baseMoveXZ;
          const mState = simRef.current.stepFixed(
            dt,
            {
              moveXZ: assistedMoveXZ,
              jumpPressed: i === 0 ? jump : false,
              respawnPressed: false,
            },
            simTimeRef.current,
          );
          if (mState.status === 'racing') {
            timeRemainingRef.current = Math.max(0, timeRemainingRef.current - dt);
            runElapsedRef.current += dt;
          }
          latestSensory = sensoryRef.current.step({
            dt,
            marble: mState,
            input: {
              moveXZ: baseMoveXZ,
              jumpPressed: i === 0 ? jump : false,
              respawnPressed: false,
            },
            evaluator: evaluatorRef.current,
            camera: cameraRigRef.current.getState(),
            simTimeSec: simTimeRef.current,
            runTimeSec: runElapsedRef.current,
            timeRemainingSec: timeRemainingRef.current,
          });
          shatterSimRef.current.syncWithMarbleState(
            mState,
            evaluatorRef.current,
            dt,
            simTimeRef.current,
          );
          shockwaveMgrRef.current.detectMarbleEvents(prevM, mState, simTimeRef.current);
          shockwaveMgrRef.current.updateRimDanger(
            mState,
            evaluatorRef.current,
            simTimeRef.current,
          );
          shockwaveMgrRef.current.step(dt, simTimeRef.current);
          prevMarbleRef.current = mState;
        }
        const mState = simRef.current.getState();
        const camState = cameraRigRef.current.update(
          (count * dt) || 1 / 60,
          activeCourseRef.current,
          mState,
          mState.position,
          evaluatorRef.current,
          simTimeRef.current,
        );
        const shockUniforms = shockwaveMgrRef.current.packUniforms();
        renderer.render({
          course: activeCourseRef.current,
          marble: mState,
          renderPosition: mState.position,
          renderOrientation: mState.orientation,
          camera: camState,
          time: simTimeRef.current,
          glassStress: latestSensory.feel.stress.glassStress,
          crackVisibility: latestSensory.feel.stress.crackVisibility,
          stressGlow: latestSensory.feel.stress.stressGlowIntensity,
          ghostActive: latestSensory.ghostPose.active,
          ghostPos: latestSensory.ghostPose.position,
          ghostQuat: latestSensory.ghostPose.orientation,
          ghostColor: [
            latestSensory.ghostPose.holoColorRgba[0],
            latestSensory.ghostPose.holoColorRgba[1],
            latestSensory.ghostPose.holoColorRgba[2],
          ],
          shatterShards: shatterSimRef.current.packUniforms(),
          shatterShardCount: shatterSimRef.current.getState().active
            ? shatterSimRef.current.getState().shards.length
            : 0,
          shockwaveRings: shockUniforms.uShockwaveRings,
          shockwaveParams: shockUniforms.uShockwaveParams,
          rimDanger: shockUniforms.uRimDanger,
        });
        setUiMarble(mState);
        setUiCamera(camState);
        setUiFeel(latestSensory.feel);
        setUiGhostSplit(latestSensory.split);
        setUiSynth(latestSensory.synth);
        setTimeRemainingSec(timeRemainingRef.current);
        return buildTelemetrySnapshot();
      },
      respawn: (atCheckpoint = true) => {
        simRef.current.respawn(atCheckpoint);
        sensoryRef.current.onRespawn(activeCourseRef.current, simRef.current.getState());
        runElapsedRef.current = 0;
        return buildTelemetrySnapshot();
      },
      teleportMarble: (position, velocity = [0, 0, 0]) => {
        const cur = simRef.current.getState();
        simRef.current.setState({
          ...cur,
          position: [...position],
          prevPosition: [...position],
          velocity: [...velocity],
          status: 'racing',
          statusTimer: 0,
        });
        return buildTelemetrySnapshot();
      },
      cycleCameraZoom: () => {
        cameraRigRef.current.cycleZoomStop();
        return cameraRigRef.current.getState();
      },
      setCameraZoom: (stopIndexOrId) => {
        cameraRigRef.current.setZoomStop(stopIndexOrId);
        return cameraRigRef.current.getState();
      },
      loadCourseSpec: (spec) => {
        handleApplyCustomCourse(spec);
        return buildTelemetrySnapshot();
      },
      getCompiledShaders: () => renderer.getCompiledShaders(),
    };

    window.__MARBLE_PLAYTEST__ = playtestApi;
    window.__MARBLE_MADNESS_ARCHITECT__ = playtestApi;

    const botController = createBotPlaytestController(() => window.__MARBLE_PLAYTEST__, {
      initialStyle: 'tourist',
      attachKeyboardShortcut: true,
    });
    botControllerRef.current = botController;
    window.__MARBLE_BOT__ = botController;

    let rafId = 0;
    let lastTimeMs = performance.now();
    let uiSyncAccumulator = 0;

    const tick = (nowMs: number) => {
      const rawDt = Math.max(0.001, Math.min(0.08, (nowMs - lastTimeMs) / 1000));
      lastTimeMs = nowMs;
      simTimeRef.current += rawDt;

      const instFps = 1.0 / rawDt;
      fpsRef.current = fpsRef.current * 0.92 + instFps * 0.08;

      const sampled = inputCtrl.sampleInput(rawDt, (r, u) =>
        cameraRigRef.current.projectInputToWorldXZ(r, u),
      );

      let effectiveMoveXZ = sampled.moveXZ;
      let effectiveJump = sampled.jumpPressed;
      if (botOverrideRef.current.mode === 'screen') {
        effectiveMoveXZ = cameraRigRef.current.projectInputToWorldXZ(
          botOverrideRef.current.vec[0],
          botOverrideRef.current.vec[1],
        );
        if (botOverrideRef.current.jumpQueued) {
          effectiveJump = true;
          botOverrideRef.current.jumpQueued = false;
        }
      } else if (botOverrideRef.current.mode === 'world') {
        effectiveMoveXZ = botOverrideRef.current.vec;
        if (botOverrideRef.current.jumpQueued) {
          effectiveJump = true;
          botOverrideRef.current.jumpQueued = false;
        }
      }

      // Apply Rim-Catch Assist torque boost from previous feel step when teetering on cliff rims
      const prevFeel = sensoryRef.current.feelTracker.getState();
      const rimAssistedMoveXZ = prevFeel.rim.rimSaveActive
        ? prevFeel.rim.assistedMoveXZ
        : effectiveMoveXZ;

      const prevMarble = prevMarbleRef.current;
      const { state: marbleState, renderPosition, renderOrientation } = simRef.current.update(
        rawDt,
        {
          moveXZ: rimAssistedMoveXZ,
          jumpPressed: effectiveJump,
          respawnPressed: sampled.respawnPressed,
        },
        simTimeRef.current,
      );

      const course = activeCourseRef.current;

      // Update countdown timer while racing
      if (marbleState.status === 'racing') {
        if (prevMarble.status !== 'racing') {
          runElapsedRef.current = 0;
        }
        runElapsedRef.current += rawDt;
        timeRemainingRef.current = Math.max(0, timeRemainingRef.current - rawDt);
        if (timeRemainingRef.current <= 0) {
          timeRemainingRef.current = course.parTimeSec;
          runElapsedRef.current = 0;
          simRef.current.respawn(false);
          sensoryRef.current.onRespawn(course, simRef.current.getState());
        }
        const speed = Math.hypot(marbleState.velocity[0], marbleState.velocity[2]);
        if (speed > 2.5) {
          scoreRef.current += Math.floor(speed * rawDt * 12);
        }
      } else if (marbleState.status === 'goal' && !goalAwardedRef.current) {
        goalAwardedRef.current = true;
        scoreRef.current += 2500 + Math.round(timeRemainingRef.current * 100);
      }

      const camState = cameraRigRef.current.update(
        rawDt,
        course,
        marbleState,
        renderPosition,
        evaluatorRef.current,
        simTimeRef.current,
      );

      const sensoryStep = sensoryRef.current.step({
        dt: rawDt,
        marble: marbleState,
        input: {
          moveXZ: effectiveMoveXZ,
          jumpPressed: effectiveJump,
          respawnPressed: sampled.respawnPressed,
        },
        evaluator: evaluatorRef.current,
        camera: camState,
        simTimeSec: simTimeRef.current,
        runTimeSec: runElapsedRef.current,
        timeRemainingSec: timeRemainingRef.current,
      });

      shatterSimRef.current.syncWithMarbleState(
        marbleState,
        evaluatorRef.current,
        rawDt,
        simTimeRef.current,
      );
      shockwaveMgrRef.current.detectMarbleEvents(
        prevMarble,
        marbleState,
        simTimeRef.current,
      );
      shockwaveMgrRef.current.updateRimDanger(
        marbleState,
        evaluatorRef.current,
        simTimeRef.current,
      );
      shockwaveMgrRef.current.step(rawDt, simTimeRef.current);
      prevMarbleRef.current = marbleState;

      const shockUniforms = shockwaveMgrRef.current.packUniforms();
      renderer.render({
        course,
        marble: marbleState,
        renderPosition,
        renderOrientation,
        camera: camState,
        time: simTimeRef.current,
        glassStress: sensoryStep.feel.stress.glassStress,
        crackVisibility: sensoryStep.feel.stress.crackVisibility,
        stressGlow: sensoryStep.feel.stress.stressGlowIntensity,
        ghostActive: sensoryStep.ghostPose.active,
        ghostPos: sensoryStep.ghostPose.position,
        ghostQuat: sensoryStep.ghostPose.orientation,
        ghostColor: [
          sensoryStep.ghostPose.holoColorRgba[0],
          sensoryStep.ghostPose.holoColorRgba[1],
          sensoryStep.ghostPose.holoColorRgba[2],
        ],
        shatterShards: shatterSimRef.current.packUniforms(),
        shatterShardCount: shatterSimRef.current.getState().active
          ? shatterSimRef.current.getState().shards.length
          : 0,
        shockwaveRings: shockUniforms.uShockwaveRings,
        shockwaveParams: shockUniforms.uShockwaveParams,
        rimDanger: shockUniforms.uRimDanger,
      });

      uiSyncAccumulator += rawDt;
      if (uiSyncAccumulator >= 1 / 30) {
        uiSyncAccumulator = 0;
        setUiMarble(marbleState);
        setUiCamera(camState);
        setUiFeel(sensoryStep.feel);
        setUiGhostSplit(sensoryStep.split);
        setUiSynth(sensoryStep.synth);
        setBotEnabled(botController.isEnabled());
        setBotStyle(botController.getStyle());
        setTimeRemainingSec(timeRemainingRef.current);
        setScore(scoreRef.current);
        setFps(fpsRef.current);
        setTrackball(sampled.telemetry);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      botController.dispose();
      botControllerRef.current = null;
      inputCtrl.dispose();
      renderer.dispose();
    };
  }, [handleApplyCustomCourse, handleSelectCourse]);

  return (
    <main className="app-viewport">
      <canvas
        ref={canvasRef}
        className="sdf-raymarch-canvas"
        aria-label="Marble Madness SDF Raymarched Viewport"
      />

      <ArcadeHud
        courses={courses}
        activeCourseIndex={activeCourseIndex}
        currentCourse={currentCourse}
        marble={uiMarble}
        camera={uiCamera}
        timeRemainingSec={timeRemainingSec}
        score={score}
        bonusBannerSec={bonusBannerSec}
        fps={fps}
        trackball={trackball}
        feel={uiFeel}
        ghostSplit={uiGhostSplit}
        synthTelemetry={uiSynth}
        botEnabled={botEnabled}
        botStyle={botStyle}
        architectOpen={architectOpen}
        onSelectCourse={handleSelectCourse}
        onCycleCameraZoom={() => {
          cameraRigRef.current.cycleZoomStop();
        }}
        onCycleMarblePreset={() => {
          simRef.current.cycleMarblePreset();
        }}
        onRespawn={() => {
          simRef.current.respawn(true);
          sensoryRef.current.onRespawn(activeCourseRef.current, simRef.current.getState());
          runElapsedRef.current = 0;
        }}
        onNextCourseWithBonus={handleNextCourseWithBonus}
        onToggleArchitect={() => setArchitectOpen((prev) => !prev)}
        onToggleAudioMute={() => {
          sensoryRef.current.synth.resume();
          sensoryRef.current.synth.toggleMute();
          setUiSynth(sensoryRef.current.synth.getState());
        }}
        onToggleBotPlaytest={() => {
          const ctrl = botControllerRef.current;
          if (!ctrl) return;
          const next = ctrl.toggle();
          setBotEnabled(next);
          setBotStyle(ctrl.getStyle());
        }}
      />

      <ArchitectHookPanel
        isOpen={architectOpen}
        onClose={() => setArchitectOpen(false)}
        currentCourse={currentCourse}
        compiledShaders={compiledShaders}
        onApplyCustomCourse={handleApplyCustomCourse}
      />
    </main>
  );
};
