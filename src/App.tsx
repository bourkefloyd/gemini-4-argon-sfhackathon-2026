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
  FieldMutation,
  MarbleState,
  PortalPair,
  Vec3,
  WeaponAbilityId,
} from './contracts';
import { BUILT_IN_COURSES } from './courses';
import { createMarbleSimulation } from './physics';
import { type PortalEnd, raycastAndPlacePortal } from './portals';
import { createRaymarchRenderer } from './rendering';
import { createCpuWorldEvaluator } from './sdf/eval-cpu';
import { ArcadeHud, ArchitectHookPanel } from './ui';
import {
  createInitialWeaponState,
  stepWeaponController,
  triggerWeaponAbility,
  type WeaponControllerState,
} from './weapons';

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
  readonly portals: readonly PortalPair[];
  readonly fieldMutations: readonly FieldMutation[];
  readonly bridgeExtruderRemainingSec: number;
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
  firePortal: (end: PortalEnd, aimDir?: Vec3, origin?: Vec3) => MarblePlaytestTelemetry;
  setPortals: (portals: readonly PortalPair[]) => MarblePlaytestTelemetry;
  getPortals: () => readonly PortalPair[];
  triggerWeapon: (
    ability: WeaponAbilityId,
    options?: { targetPosition?: Vec3; radius?: number },
  ) => MarblePlaytestTelemetry;
  getFieldMutations: () => readonly FieldMutation[];
  clearFieldMutations: () => MarblePlaytestTelemetry;
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

  const [uiMarble, setUiMarble] = useState<MarbleState>(() => simRef.current.getState());
  const [uiCamera, setUiCamera] = useState<CameraState>(() => cameraRigRef.current.getState());
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
  const [uiPortals, setUiPortals] = useState<readonly PortalPair[]>(
    () => currentCourse.portals ?? [],
  );
  const [uiWeaponState, setUiWeaponState] = useState<WeaponControllerState>(
    createInitialWeaponState,
  );

  const timeRemainingRef = useRef<number>(currentCourse.parTimeSec);
  const scoreRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const simTimeRef = useRef<number>(0);
  const activeCourseRef = useRef<CourseSpec>(currentCourse);
  const coursesRef = useRef<readonly CourseSpec[]>(courses);
  const activeIdxRef = useRef<number>(activeCourseIndex);
  const goalAwardedRef = useRef<boolean>(false);
  const portalsRef = useRef<readonly PortalPair[]>(currentCourse.portals ?? []);
  const weaponStateRef = useRef<WeaponControllerState>(createInitialWeaponState());

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
      const initialPortals = nextCourse.portals ? [...nextCourse.portals] : [];
      const initialWeapons = createInitialWeaponState();
      portalsRef.current = initialPortals;
      weaponStateRef.current = initialWeapons;
      nextEval.setPortals?.(initialPortals);
      nextEval.setFieldMutations?.([]);

      evaluatorRef.current = nextEval;
      simRef.current.setCourse(nextCourse, nextEval);
      cameraRigRef.current.snapToCourse(nextCourse, nextCourse.startPos);

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
      setUiPortals(initialPortals);
      setUiWeaponState(initialWeapons);

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

    const firePortalInternal = (
      end: PortalEnd,
      pointerNdc?: readonly [number, number],
      explicitAimDir?: Vec3,
      explicitOrigin?: Vec3,
    ) => {
      const mState = simRef.current.getState();
      const cam = cameraRigRef.current.getState();
      const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);

      let origin: Vec3 = explicitOrigin ?? mState.position;
      let aimDir: Vec3 =
        explicitAimDir ??
        (Math.hypot(mState.velocity[0], mState.velocity[2]) > 0.75
          ? [mState.velocity[0], -0.25, mState.velocity[2]]
          : [fwdXZ[0], -0.25, fwdXZ[1]]);

      if (!explicitAimDir && !explicitOrigin && pointerNdc) {
        const aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
        const tanHalfFov = Math.tan((cam.fovDeg * Math.PI) / 360);
        const rx =
          cam.forward[0] +
          pointerNdc[0] * aspect * tanHalfFov * cam.right[0] +
          pointerNdc[1] * tanHalfFov * cam.up[0];
        const ry =
          cam.forward[1] +
          pointerNdc[0] * aspect * tanHalfFov * cam.right[1] +
          pointerNdc[1] * tanHalfFov * cam.up[1];
        const rz =
          cam.forward[2] +
          pointerNdc[0] * aspect * tanHalfFov * cam.right[2] +
          pointerNdc[1] * tanHalfFov * cam.up[2];
        origin = cam.position;
        aimDir = [rx, ry, rz];
      }

      const existing = portalsRef.current[0] ?? {
        id: 'player-portal-pair',
        posA: [mState.position[0], mState.position[1], mState.position[2] - 4],
        normalA: [0, 1, 0] as Vec3,
        upA: [0, 0, -1] as Vec3,
        posB: [mState.position[0] + 6, mState.position[1], mState.position[2] - 10],
        normalB: [0, 1, 0] as Vec3,
        upB: [0, 0, -1] as Vec3,
        radius: 1.38,
        activeA: true,
        activeB: true,
        flingBoost: 1.0,
      };

      const placed = raycastAndPlacePortal(
        end,
        existing,
        origin,
        aimDir,
        evaluatorRef.current,
        simTimeRef.current,
      );
      const nextPortals: readonly PortalPair[] = [
        placed.pair,
        ...portalsRef.current.slice(1),
      ];
      portalsRef.current = nextPortals;
      evaluatorRef.current.setPortals?.(nextPortals);
      setUiPortals(nextPortals);
    };

    const triggerWeaponInternal = (
      ability: WeaponAbilityId,
      options?: { targetPosition?: Vec3; radius?: number },
    ) => {
      const mState = simRef.current.getState();
      const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);
      const aimForward: Vec3 = [fwdXZ[0], 0, fwdXZ[1]];
      const result = triggerWeaponAbility(
        ability,
        weaponStateRef.current,
        mState,
        aimForward,
        simTimeRef.current,
        options,
      );
      weaponStateRef.current = result.weaponState;
      evaluatorRef.current.setFieldMutations?.(result.weaponState.mutations);
      simRef.current.setState(result.marbleState);
      setUiWeaponState(result.weaponState);
      setUiMarble(result.marbleState);
    };

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
      },
      onOrbitCameraYaw: (deltaDeg) => {
        cameraRigRef.current.adjustYaw(deltaDeg);
      },
      onToggleArchitectPanel: () => {
        setArchitectOpen((prev) => !prev);
      },
      onFirePortal: (end, pointerNdc) => {
        firePortalInternal(end, pointerNdc);
      },
      onTriggerWeapon: (ability) => {
        triggerWeaponInternal(ability);
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
        portals: portalsRef.current,
        fieldMutations: weaponStateRef.current.mutations,
        bridgeExtruderRemainingSec: weaponStateRef.current.bridgeExtruderRemainingSec,
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
        const moveXZ: readonly [number, number] = worldInputXZ ?? [0, 0];
        const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);
        const aimForward: Vec3 = [
          moveXZ[0] || fwdXZ[0],
          0,
          moveXZ[1] || fwdXZ[1],
        ];
        for (let i = 0; i < count; i++) {
          simTimeRef.current += dt;
          if (weaponStateRef.current.bridgeExtruderRemainingSec > 0) {
            const wStep = stepWeaponController(
              weaponStateRef.current,
              simRef.current.getState(),
              aimForward,
              dt,
              simTimeRef.current,
            );
            weaponStateRef.current = wStep.weaponState;
            evaluatorRef.current.setFieldMutations?.(wStep.weaponState.mutations);
            simRef.current.setState(wStep.marbleState);
          }
          const mState = simRef.current.stepFixed(
            dt,
            {
              moveXZ,
              jumpPressed: i === 0 ? jump : false,
              respawnPressed: false,
            },
            simTimeRef.current,
          );
          if (mState.status === 'racing') {
            timeRemainingRef.current = Math.max(0, timeRemainingRef.current - dt);
          }
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
        renderer.render({
          course: activeCourseRef.current,
          marble: mState,
          renderPosition: mState.position,
          renderOrientation: mState.orientation,
          camera: camState,
          time: simTimeRef.current,
          fieldMutations: weaponStateRef.current.mutations,
          portals: portalsRef.current,
        });
        setUiMarble(mState);
        setUiCamera(camState);
        setUiPortals(portalsRef.current);
        setUiWeaponState(weaponStateRef.current);
        setTimeRemainingSec(timeRemainingRef.current);
        return buildTelemetrySnapshot();
      },
      respawn: (atCheckpoint = true) => {
        simRef.current.respawn(atCheckpoint);
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
      firePortal: (end, aimDir, origin) => {
        firePortalInternal(end, undefined, aimDir, origin);
        return buildTelemetrySnapshot();
      },
      setPortals: (nextPortals) => {
        portalsRef.current = [...nextPortals];
        evaluatorRef.current.setPortals?.(portalsRef.current);
        setUiPortals(portalsRef.current);
        return buildTelemetrySnapshot();
      },
      getPortals: () => portalsRef.current,
      triggerWeapon: (ability, options) => {
        triggerWeaponInternal(ability, options);
        return buildTelemetrySnapshot();
      },
      getFieldMutations: () => weaponStateRef.current.mutations,
      clearFieldMutations: () => {
        weaponStateRef.current = createInitialWeaponState();
        evaluatorRef.current.setFieldMutations?.([]);
        setUiWeaponState(weaponStateRef.current);
        return buildTelemetrySnapshot();
      },
    };

    window.__MARBLE_PLAYTEST__ = playtestApi;
    window.__MARBLE_MADNESS_ARCHITECT__ = playtestApi;

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

      if (weaponStateRef.current.bridgeExtruderRemainingSec > 0) {
        const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);
        const wStep = stepWeaponController(
          weaponStateRef.current,
          simRef.current.getState(),
          [effectiveMoveXZ[0] || fwdXZ[0], 0, effectiveMoveXZ[1] || fwdXZ[1]],
          rawDt,
          simTimeRef.current,
        );
        weaponStateRef.current = wStep.weaponState;
        evaluatorRef.current.setFieldMutations?.(wStep.weaponState.mutations);
        simRef.current.setState(wStep.marbleState);
      }

      const { state: marbleState, renderPosition, renderOrientation } = simRef.current.update(
        rawDt,
        {
          moveXZ: effectiveMoveXZ,
          jumpPressed: effectiveJump,
          respawnPressed: sampled.respawnPressed,
        },
        simTimeRef.current,
      );

      const course = activeCourseRef.current;

      // Update countdown timer while racing
      if (marbleState.status === 'racing') {
        timeRemainingRef.current = Math.max(0, timeRemainingRef.current - rawDt);
        if (timeRemainingRef.current <= 0) {
          timeRemainingRef.current = course.parTimeSec;
          simRef.current.respawn(false);
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

      renderer.render({
        course,
        marble: marbleState,
        renderPosition,
        renderOrientation,
        camera: camState,
        time: simTimeRef.current,
        fieldMutations: weaponStateRef.current.mutations,
        portals: portalsRef.current,
      });

      uiSyncAccumulator += rawDt;
      if (uiSyncAccumulator >= 1 / 30) {
        uiSyncAccumulator = 0;
        setUiMarble(marbleState);
        setUiCamera(camState);
        setTimeRemainingSec(timeRemainingRef.current);
        setScore(scoreRef.current);
        setFps(fpsRef.current);
        setTrackball(sampled.telemetry);
        setUiPortals(portalsRef.current);
        setUiWeaponState(weaponStateRef.current);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
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
        architectOpen={architectOpen}
        portals={uiPortals}
        fieldMutations={uiWeaponState.mutations}
        bridgeExtruderRemainingSec={uiWeaponState.bridgeExtruderRemainingSec}
        lastActivatedAbility={uiWeaponState.lastActivatedAbility}
        onSelectCourse={handleSelectCourse}
        onCycleCameraZoom={() => {
          cameraRigRef.current.cycleZoomStop();
        }}
        onCycleMarblePreset={() => {
          simRef.current.cycleMarblePreset();
        }}
        onRespawn={() => {
          simRef.current.respawn(true);
        }}
        onNextCourseWithBonus={handleNextCourseWithBonus}
        onToggleArchitect={() => setArchitectOpen((prev) => !prev)}
        onFirePortal={(end) => {
          window.__MARBLE_PLAYTEST__?.firePortal(end);
        }}
        onTriggerWeapon={(ability) => {
          window.__MARBLE_PLAYTEST__?.triggerWeapon(ability);
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
