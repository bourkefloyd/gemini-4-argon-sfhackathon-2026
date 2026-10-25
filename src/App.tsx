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
import { ALL_PLAYABLE_COURSES } from './courses';
import {
  createMarbleSimulation,
  createModeAwareWorldEvaluator,
  cycleEngineComparisonMode,
  type EngineComparisonMode,
} from './physics';
import {
  DEFAULT_PORTAL_FLING_BOOST,
  DEFAULT_PORTAL_RADIUS,
  getDefaultCoursePortals,
  placeSmartPortalBridge,
  type PortalAimPreview,
  type PortalEnd,
  raycastAndPlacePortal,
  raycastPortalAimPreview,
} from './portals';
import {
  benchmarkShaderPixelEvaluations,
  createRaymarchRenderer,
  INITIAL_DPR_CAP,
  type ShaderPixelEvaluationBenchmark,
} from './rendering';
import {
  ArcadeHud,
  ArchitectHookPanel,
  type LiveProfilerTelemetry,
  measureSdfRayCaliper,
  SDF_WIZARD_STEP_DURATION_SEC,
  SDF_WIZARD_TOTAL_DURATION_SEC,
  type SdfCaliperMeasurement,
  type SdfDebugVizMode,
  SdfDebugWizard,
} from './ui';
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
  createAutonomousDriver,
  createBotPlaytestController,
  type RunTelemetrySummary,
} from './bot';
import {
  appendFieldMutation,
  createInitialWeaponState,
  stepWeaponController,
  triggerWeaponAbility,
  type WeaponControllerState,
} from './weapons';
import {
  createMultiMarbleArenaSimulation,
  createPartyRoomClient,
  getArenaSlotSpawnPosition,
  MAX_PLAYERS,
  PLAYER_MARBLE_PALETTE,
  QrPartyHudModal,
  resolveMarbleCollisions,
} from './multiplayer';
import type { GridTileViewInput, OtherMarbleRenderInput } from './rendering';
import type { PlayerGridCellHudInfo, ViewportDisplayMode } from './ui/ArcadeHud';

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
  readonly portals: readonly PortalPair[];
  readonly portalAimPreview?: PortalAimPreview;
  readonly fieldMutations: readonly FieldMutation[];
  readonly bridgeExtruderRemainingSec: number;
  readonly viewMode?: ViewportDisplayMode;
  readonly focusedPlayerIndex?: number;
  readonly debugDrawerOpen?: boolean;
  readonly sdfWizardOpen?: boolean;
  readonly debugVizMode?: SdfDebugVizMode;
  readonly sdfWizardAutoTour?: boolean;
  readonly sdfWizardElapsedSec?: number;
  readonly sdfCaliper?: SdfCaliperMeasurement;
  readonly engineMode?: EngineComparisonMode;
  readonly gridCells?: readonly PlayerGridCellHudInfo[];
  readonly profiler?: LiveProfilerTelemetry;
}

export interface MarbleProfilerApi {
  getMetrics: () => LiveProfilerTelemetry;
  benchmarkPixelEvaluations: (
    course?: CourseSpec,
    gridWidth?: number,
    gridHeight?: number,
  ) => ShaderPixelEvaluationBenchmark;
  setAdaptiveScale: (scale: number) => LiveProfilerTelemetry;
}

export const HUD_SYNC_INTERVAL_SEC = 0.05; // 20 Hz (every 50 ms)
export const HUD_SYNC_HZ = 20;

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
  placeSmartPortalBridge: () => MarblePlaytestTelemetry;
  setPortals: (portals: readonly PortalPair[]) => MarblePlaytestTelemetry;
  getPortals: () => readonly PortalPair[];
  triggerWeapon: (
    ability: WeaponAbilityId,
    options?: { targetPosition?: Vec3; radius?: number },
  ) => MarblePlaytestTelemetry;
  getFieldMutations: () => readonly FieldMutation[];
  clearFieldMutations: () => MarblePlaytestTelemetry;
  setViewMode?: (mode: ViewportDisplayMode) => MarblePlaytestTelemetry;
  toggleViewMode?: () => MarblePlaytestTelemetry;
  setDebugDrawerOpen?: (open: boolean) => MarblePlaytestTelemetry;
  selectGridPlayer?: (slotIndex: number) => MarblePlaytestTelemetry;
  setEngineMode?: (mode: EngineComparisonMode) => MarblePlaytestTelemetry;
  cycleEngineMode?: () => MarblePlaytestTelemetry;
  getEngineMode?: () => EngineComparisonMode;
  getProfilerMetrics?: () => LiveProfilerTelemetry;
  setSdfWizardOpen?: (open: boolean) => MarblePlaytestTelemetry;
  toggleSdfWizard?: () => MarblePlaytestTelemetry;
  setDebugVizMode?: (mode: SdfDebugVizMode) => MarblePlaytestTelemetry;
  getDebugVizMode?: () => SdfDebugVizMode;
  measureCaliperAtNdc?: (ndcX: number, ndcY: number) => SdfCaliperMeasurement;
}

declare global {
  interface Window {
    __MARBLE_PLAYTEST__?: MarblePlaytestApi;
    __MARBLE_MADNESS_ARCHITECT__?: MarblePlaytestApi;
    __MARBLE_PROFILER__?: MarbleProfilerApi;
  }
}

class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('OverlayErrorBoundary caught error:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function useLazyRef<T>(init: () => T): React.MutableRefObject<T> {
  const ref = useRef<T | null>(null);
  if (ref.current === null) {
    ref.current = init();
  }
  return ref as React.MutableRefObject<T>;
}

export const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [courses, setCourses] = useState<readonly CourseSpec[]>(ALL_PLAYABLE_COURSES);
  const [activeCourseIndex, setActiveCourseIndex] = useState<number>(0);
  const currentCourse = courses[activeCourseIndex] ?? courses[0];

  const evaluatorRef = useLazyRef(() => createModeAwareWorldEvaluator(currentCourse, 0));
  const simRef = useLazyRef(() => createMarbleSimulation(currentCourse, evaluatorRef.current));
  const cameraRigRef = useLazyRef(() =>
    createIsometricCameraRig(currentCourse, currentCourse.startPos),
  );
  const rendererRef = useRef<ReturnType<typeof createRaymarchRenderer> | null>(null);
  const sensoryRef = useLazyRef(() => createArcadeSensorySession(currentCourse));
  const shatterSimRef = useLazyRef(() => createShatterSimulator());
  const shockwaveMgrRef = useLazyRef(() => createShockwaveManager());
  const botControllerRef = useRef<BotPlaytestController | null>(null);
  const partyClientRef = useLazyRef(() =>
    createPartyRoomClient({ roomCode: 'ARGON', enableNetwork: false }),
  );
  const multiMarbleSimRef = useLazyRef(() => createMultiMarbleArenaSimulation(currentCourse));
  const aiRivalsRef = useLazyRef(() => {
    const styles: readonly BotPlayStyle[] = [
      'speedrunner',
      'tourist',
      'chaos-explorer',
      'speedrunner',
      'tourist',
    ];
    const defaultHandles = ['MAYA', 'DAN', 'ALEX', 'ZOE', 'KAI'];
    return styles.map((style, idx) => {
      const slotIndex = idx + 1; // Slots 1..5 (P2..P6)
      const spawnPos = getArenaSlotSpawnPosition(currentCourse.startPos, slotIndex);
      const slotCourse: CourseSpec = { ...currentCourse, startPos: spawnPos };
      const sim = createMarbleSimulation(slotCourse, evaluatorRef.current);
      sim.setState({
        ...sim.getState(),
        position: spawnPos,
        prevPosition: spawnPos,
        respawnPos: spawnPos,
        marblePresetIndex: slotIndex % 4,
      });
      const driver = createAutonomousDriver(slotCourse, evaluatorRef.current, { style });
      return {
        slotIndex,
        defaultHandle: defaultHandles[idx] ?? `BOT${slotIndex + 1}`,
        sim,
        driver,
      };
    });
  });
  const tileCameraRigsRef = useLazyRef(() =>
    Array.from({ length: MAX_PLAYERS }, () =>
      createIsometricCameraRig(currentCourse, currentCourse.startPos),
    ),
  );

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
  const [partyOpen, setPartyOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewportDisplayMode>('fullscreen');
  const [focusedPlayerIndex, setFocusedPlayerIndex] = useState<number>(0);
  const [debugDrawerOpen, setDebugDrawerOpen] = useState<boolean>(false);
  const [sdfWizardOpen, setSdfWizardOpen] = useState<boolean>(false);
  const [debugVizMode, setDebugVizMode] = useState<SdfDebugVizMode>(0);
  const [sdfWizardAutoTour, setSdfWizardAutoTour] = useState<boolean>(true);
  const [sdfWizardElapsedSec, setSdfWizardElapsedSec] = useState<number>(0);
  const [uiSdfCaliper, setUiSdfCaliper] = useState<SdfCaliperMeasurement>(() =>
    measureSdfRayCaliper(
      [0, 0],
      cameraRigRef.current.getState(),
      currentCourse,
      simRef.current.getState(),
      evaluatorRef.current,
      0,
    ),
  );
  const [engineMode, setEngineMode] = useState<EngineComparisonMode>(0);
  const [uiGridCells, setUiGridCells] = useState<readonly PlayerGridCellHudInfo[]>([]);
  const [partyRoomCode, setPartyRoomCode] = useState<string>('ARGON');
  const [partyConnectedCount, setPartyConnectedCount] = useState<number>(1);
  const [crowdSeedPrompt, setCrowdSeedPrompt] = useState<string | null>(null);
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
    () => getDefaultCoursePortals(currentCourse),
  );
  const [uiWeaponState, setUiWeaponState] = useState<WeaponControllerState>(
    createInitialWeaponState,
  );
  const [uiProfiler, setUiProfiler] = useState<LiveProfilerTelemetry>(() => ({
    fps: 60,
    frameTimeMs: 16.67,
    emaFrameMs: 16.67,
    gpuPassMs: 2.4,
    gpuTimerQueryAvailable: false,
    physicsStepMs: 0.45,
    effectiveDpr: INITIAL_DPR_CAP,
    adaptiveScale: 1.0,
    initialDprCap: INITIAL_DPR_CAP,
    renderResolution: [1280, 720],
    hudSyncHz: HUD_SYNC_HZ,
    pixelEvalBenchmark: benchmarkShaderPixelEvaluations(currentCourse, 12, 8),
  }));

  const timeRemainingRef = useRef<number>(currentCourse.parTimeSec);
  const runElapsedRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const scoreAccumulatorRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const physicsStepMsRef = useRef<number>(0.45);
  const pixelEvalCacheRef = useRef<Map<string, ShaderPixelEvaluationBenchmark>>(new Map());
  const simTimeRef = useRef<number>(0);
  const activeCourseRef = useRef<CourseSpec>(currentCourse);
  const coursesRef = useRef<readonly CourseSpec[]>(courses);
  const activeIdxRef = useRef<number>(activeCourseIndex);
  const goalAwardedRef = useRef<boolean>(false);
  const prevMarbleRef = useRef<MarbleState>(simRef.current.getState());
  const portalsRef = useRef<readonly PortalPair[]>(getDefaultCoursePortals(currentCourse));
  const portalAimPreviewRef = useRef<PortalAimPreview | undefined>(undefined);
  const weaponStateRef = useRef<WeaponControllerState>(createInitialWeaponState());
  const seenPartyMutationIdsRef = useRef<Set<string>>(new Set());
  const architectOpenRef = useRef<boolean>(false);
  const partyOpenRef = useRef<boolean>(false);
  const viewModeRef = useRef<ViewportDisplayMode>('fullscreen');
  const focusedPlayerIdxRef = useRef<number>(0);
  const debugDrawerOpenRef = useRef<boolean>(false);
  const sdfWizardOpenRef = useRef<boolean>(false);
  const debugVizModeRef = useRef<SdfDebugVizMode>(0);
  const sdfWizardAutoTourRef = useRef<boolean>(true);
  const sdfWizardElapsedRef = useRef<number>(0);
  const sdfWizardDemoCsgFiredRef = useRef<boolean>(false);
  const cursorNdcRef = useRef<readonly [number, number]>([0, 0]);
  const engineModeRef = useRef<EngineComparisonMode>(0);
  const gridCellsRef = useRef<readonly PlayerGridCellHudInfo[]>([]);

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
  architectOpenRef.current = architectOpen;
  partyOpenRef.current = partyOpen;

  const activateCourse = useCallback(
    (nextCourse: CourseSpec, nextIndex: number, carryOverBonusSec: number | null) => {
      const nextEval = createModeAwareWorldEvaluator(nextCourse, engineModeRef.current);
      const initialPortals = [...getDefaultCoursePortals(nextCourse)];
      const initialWeapons = createInitialWeaponState();
      portalsRef.current = initialPortals;
      portalAimPreviewRef.current = undefined;
      weaponStateRef.current = initialWeapons;
      seenPartyMutationIdsRef.current.clear();
      nextEval.setPortals?.(initialPortals);
      nextEval.setFieldMutations?.([]);

      evaluatorRef.current = nextEval;
      simRef.current.setCourse(nextCourse, nextEval);
      cameraRigRef.current.snapToCourse(nextCourse, nextCourse.startPos);
      sensoryRef.current.setCourse(nextCourse);
      shatterSimRef.current.reset();
      shockwaveMgrRef.current.clear();
      multiMarbleSimRef.current.setCourse(nextCourse);
      for (const rival of aiRivalsRef.current) {
        const spawnPos = getArenaSlotSpawnPosition(nextCourse.startPos, rival.slotIndex);
        const slotCourse: CourseSpec = { ...nextCourse, startPos: spawnPos };
        rival.sim.setCourse(slotCourse, nextEval);
        rival.sim.setState({
          ...rival.sim.getState(),
          position: spawnPos,
          prevPosition: spawnPos,
          respawnPos: spawnPos,
          marblePresetIndex: rival.slotIndex % 4,
        });
        rival.driver.reset(slotCourse, nextEval);
      }
      for (const rig of tileCameraRigsRef.current) {
        rig.snapToCourse(nextCourse, nextCourse.startPos);
      }
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
      const prev = coursesRef.current;
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
      setCourses(nextList);
      activateCourse(nextList[targetIdx], targetIdx, null);
    },
    [activateCourse],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createRaymarchRenderer(canvas, activeCourseRef.current);
    rendererRef.current = renderer;
    setCompiledShaders(renderer.getCompiledShaders());

    const computeCameraCursorRay = (pointerNdc: readonly [number, number]): { origin: Vec3; aimDir: Vec3 } => {
      const cam = cameraRigRef.current.getState();
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
      return { origin: cam.position, aimDir: [rx, ry, rz] };
    };

    const firePortalInternal = (
      end: PortalEnd,
      pointerNdc?: readonly [number, number],
      explicitAimDir?: Vec3,
      explicitOrigin?: Vec3,
    ) => {
      const mState = simRef.current.getState();
      const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);

      // 1-Key "Smart Portal Bridge" (`[Q]`): when firing Blue without an explicit ray,
      // automatically place Blue Entry 3.5m ahead on the track (facing the marble!)
      // and Orange Exit on the next elevated terrace / checkpoint ahead (angled toward the goal!)
      if (end === 'blue' && !explicitAimDir && !explicitOrigin) {
        const smartPair = placeSmartPortalBridge(
          mState,
          activeCourseRef.current,
          evaluatorRef.current,
          fwdXZ,
          simTimeRef.current,
          portalsRef.current[0],
        );
        const nextPortals: readonly PortalPair[] = [
          smartPair,
          ...portalsRef.current.slice(1),
        ];
        portalsRef.current = nextPortals;
        evaluatorRef.current.setPortals?.(nextPortals);
        setUiPortals(nextPortals);
        return;
      }

      let origin: Vec3 = explicitOrigin ?? mState.position;
      let aimDir: Vec3 =
        explicitAimDir ??
        (Math.hypot(mState.velocity[0], mState.velocity[2]) > 0.75
          ? [mState.velocity[0], -0.25, mState.velocity[2]]
          : [fwdXZ[0], -0.25, fwdXZ[1]]);

      if (!explicitAimDir && !explicitOrigin && pointerNdc) {
        const ray = computeCameraCursorRay(pointerNdc);
        origin = ray.origin;
        aimDir = ray.aimDir;
      }

      const existing = portalsRef.current[0] ?? {
        id: 'player-portal-pair',
        posA: [mState.position[0], mState.position[1], mState.position[2] - 3.5],
        normalA: [0, 0.38, 0.92] as Vec3,
        upA: [0, 0.92, -0.38] as Vec3,
        posB: [mState.position[0] + 6, mState.position[1], mState.position[2] - 10],
        normalB: [0, 0.7071, -0.7071] as Vec3,
        upB: [0, 0.7071, 0.7071] as Vec3,
        radius: DEFAULT_PORTAL_RADIUS,
        activeA: true,
        activeB: true,
        flingBoost: DEFAULT_PORTAL_FLING_BOOST,
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

    const toggleViewModeInternal = () => {
      const next: ViewportDisplayMode =
        viewModeRef.current === 'fullscreen' ? 'grid' : 'fullscreen';
      viewModeRef.current = next;
      setViewMode(next);
    };

    const toggleDebugDrawerInternal = () => {
      const next = !debugDrawerOpenRef.current;
      debugDrawerOpenRef.current = next;
      setDebugDrawerOpen(next);
    };

    const computeCaliperSnapshot = (
      ndc: readonly [number, number] = cursorNdcRef.current,
    ): SdfCaliperMeasurement => {
      const aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
      return measureSdfRayCaliper(
        ndc,
        cameraRigRef.current.getState(),
        activeCourseRef.current,
        simRef.current.getState(),
        evaluatorRef.current,
        simTimeRef.current,
        aspect,
      );
    };

    const setSdfWizardOpenInternal = (open: boolean) => {
      sdfWizardOpenRef.current = open;
      setSdfWizardOpen(open);
      if (open) {
        const nextMode: SdfDebugVizMode =
          debugVizModeRef.current === 0 ? 1 : debugVizModeRef.current;
        debugVizModeRef.current = nextMode;
        setDebugVizMode(nextMode);
        sdfWizardAutoTourRef.current = true;
        setSdfWizardAutoTour(true);
        sdfWizardElapsedRef.current = (nextMode - 1) * SDF_WIZARD_STEP_DURATION_SEC;
        setSdfWizardElapsedSec(sdfWizardElapsedRef.current);
        sdfWizardDemoCsgFiredRef.current = false;
        setUiSdfCaliper(computeCaliperSnapshot());
      } else {
        debugVizModeRef.current = 0;
        setDebugVizMode(0);
        sdfWizardAutoTourRef.current = false;
        setSdfWizardAutoTour(false);
      }
    };

    const toggleSdfWizardInternal = () => {
      setSdfWizardOpenInternal(!sdfWizardOpenRef.current);
    };

    const setDebugVizModeInternal = (mode: SdfDebugVizMode, pauseAutoTour = true) => {
      const clamped = Math.max(0, Math.min(5, Math.floor(mode))) as SdfDebugVizMode;
      debugVizModeRef.current = clamped;
      setDebugVizMode(clamped);
      if (clamped > 0 && !sdfWizardOpenRef.current) {
        sdfWizardOpenRef.current = true;
        setSdfWizardOpen(true);
      } else if (clamped === 0 && sdfWizardOpenRef.current) {
        sdfWizardOpenRef.current = false;
        setSdfWizardOpen(false);
      }
      if (pauseAutoTour) {
        sdfWizardAutoTourRef.current = false;
        setSdfWizardAutoTour(false);
      }
      if (clamped > 0) {
        sdfWizardElapsedRef.current = (clamped - 1) * SDF_WIZARD_STEP_DURATION_SEC;
        setSdfWizardElapsedSec(sdfWizardElapsedRef.current);
      }
      setUiSdfCaliper(computeCaliperSnapshot());
    };

    const setEngineModeInternal = (nextMode: EngineComparisonMode) => {
      const valid: EngineComparisonMode =
        nextMode === 1 ? 1 : nextMode === 2 ? 2 : 0;
      engineModeRef.current = valid;
      evaluatorRef.current.setEngineMode(valid);
      setEngineMode(valid);
    };

    const cycleEngineModeInternal = () => {
      const next = cycleEngineComparisonMode(engineModeRef.current);
      setEngineModeInternal(next);
    };

    const selectGridPlayerInternal = (slotIndex: number) => {
      const clamped = Math.max(0, Math.min(MAX_PLAYERS - 1, Math.floor(slotIndex)));
      focusedPlayerIdxRef.current = clamped;
      setFocusedPlayerIndex(clamped);
      viewModeRef.current = 'fullscreen';
      setViewMode('fullscreen');
    };

    const stepMultiplayerAndBuildGrid = (
      stepDt: number,
      course: CourseSpec,
      p1Marble: MarbleState,
      p1Pos: Vec3,
      p1Quat: readonly [number, number, number, number],
      cam0: CameraState,
    ) => {
      const partySnap = partyClientRef.current.getSnapshot();
      const currentRoomCode = partySnap.roomCode || 'ARGON';

      if (partySnap.activeMutations && partySnap.activeMutations.length > 0) {
        let updatedMutations = weaponStateRef.current.mutations;
        let addedAny = false;
        for (const pm of partySnap.activeMutations) {
          if (!seenPartyMutationIdsRef.current.has(pm.id)) {
            seenPartyMutationIdsRef.current.add(pm.id);
            addedAny = true;
            const fieldKind: FieldMutation['kind'] =
              pm.kind === 'craterMortar'
                ? 'subtractSphere'
                : pm.kind === 'rescueBridge'
                  ? 'unionCapsule'
                  : pm.kind === 'tectonicRamp'
                    ? 'unionRamp'
                    : 'materialOverride';
            const fieldMut: FieldMutation = {
              id: pm.id,
              kind: fieldKind,
              posA: pm.position,
              posB:
                pm.kind === 'tectonicRamp'
                  ? [0, 1.85, -1]
                  : pm.secondaryPos ?? [pm.position[0], pm.position[1], pm.position[2] - 2.2],
              radius: pm.radius,
              blendK: pm.blendK,
              material: pm.material,
              spawnTime: simTimeRef.current,
              ttl: Math.max(4.0, (pm.expiresAtMs - pm.createdAtMs) / 1000 || 12.0),
            };
            updatedMutations = appendFieldMutation(
              updatedMutations,
              fieldMut,
              simTimeRef.current,
            );
          }
        }
        if (addedAny) {
          weaponStateRef.current = {
            ...weaponStateRef.current,
            mutations: updatedMutations,
          };
          evaluatorRef.current.setFieldMutations?.(updatedMutations);
        }
      }

      multiMarbleSimRef.current.syncPlayersFromRoom(partySnap);
      const partyRacerSource = partySnap.roomPlayers ?? partySnap.players;
      const partyInputs = new Map<
        string,
        { moveXZ: readonly [number, number]; jumpPressed: boolean; respawnPressed: boolean }
      >();
      for (const p of partyRacerSource) {
        if (p.role === 'racer') {
          partyInputs.set(p.playerId, {
            moveXZ: p.input.moveXZ,
            jumpPressed: p.input.jumpPressed,
            respawnPressed: false,
          });
        }
      }
      const partyStep = multiMarbleSimRef.current.stepFixed(
        stepDt,
        partyInputs,
        simTimeRef.current,
      );
      const partyBySlot = new Map<number, (typeof partyStep.marbles)[number]>();
      for (const m of partyStep.marbles) {
        partyBySlot.set(m.slotIndex, m);
      }

      // Step autonomous AI rivals for any open slots 1..5 so 6-player split-screen always has 6 live marbles
      const rivalOutputs = aiRivalsRef.current.map((rival) => {
        const cur = rival.sim.getState();
        if (cur.status !== 'racing' && cur.statusTimer > 1.1) {
          const spawnPos = getArenaSlotSpawnPosition(course.startPos, rival.slotIndex);
          rival.sim.setState({
            ...cur,
            position: spawnPos,
            prevPosition: spawnPos,
            velocity: [0, 0, 0],
            status: 'racing',
            statusTimer: 0,
          });
          rival.driver.reset({ ...course, startPos: spawnPos }, evaluatorRef.current);
        }
        const dec = rival.driver.stepDecision(
          rival.sim.getState(),
          simTimeRef.current,
          stepDt,
        );
        const out = rival.sim.update(stepDt, dec.commands, simTimeRef.current);
        return {
          slotIndex: rival.slotIndex,
          defaultHandle: rival.defaultHandle,
          sim: rival.sim,
          state: out.state,
          renderPosition: out.renderPosition,
          renderOrientation: out.renderOrientation,
        };
      });

      // Assemble all 6 player slots (P1..P6)
      const slotEntries = PLAYER_MARBLE_PALETTE.map((palette, slotIdx) => {
        const partySlot = partyBySlot.get(slotIdx);
        if (slotIdx === 0) {
          return {
            slotIndex: 0,
            palette,
            handle: partySlot ? partySlot.handle.toUpperCase() : 'YOU',
            isHuman: true,
            marble: p1Marble,
            renderPosition: p1Pos,
            renderOrientation: p1Quat,
          };
        }
        const rival = rivalOutputs[slotIdx - 1];
        const useParty = Boolean(partySlot);
        const mState = useParty ? partySlot!.state : rival.state;
        const rPos = useParty ? partySlot!.state.position : rival.renderPosition;
        const rQuat = useParty ? partySlot!.state.orientation : rival.renderOrientation;
        return {
          slotIndex: slotIdx,
          palette,
          handle: useParty ? partySlot!.handle.toUpperCase() : rival.defaultHandle,
          isHuman: Boolean(partySlot),
          marble: mState,
          renderPosition: rPos,
          renderOrientation: rQuat,
        };
      });

      // Resolve pairwise 3D marble-marble bumper collisions across all 6 active marbles
      const collisionResolved = resolveMarbleCollisions(slotEntries.map((s) => s.marble));
      for (let i = 1; i < slotEntries.length; i++) {
        const updated = collisionResolved.states[i];
        slotEntries[i].marble = updated;
        slotEntries[i].renderPosition = updated.position;
        if (!partyBySlot.has(i)) {
          aiRivalsRef.current[i - 1]?.sim.setState(updated);
        }
      }

      const rigs = tileCameraRigsRef.current;
      rigs[0].setZoomStop(cameraRigRef.current.getState().zoomStopIndex);
      const cameras: CameraState[] = [cam0];
      for (let i = 1; i < MAX_PLAYERS; i++) {
        rigs[i].setZoomStop('isometric');
        cameras.push(
          rigs[i].update(
            stepDt,
            course,
            slotEntries[i].marble,
            slotEntries[i].renderPosition,
            evaluatorRef.current,
            simTimeRef.current,
          ),
        );
      }

      const dpr = renderer.getProfilerMetrics().effectiveDpr || INITIAL_DPR_CAP;
      const fullW = Math.max(3, Math.floor((canvas.clientWidth || window.innerWidth) * dpr));
      const fullH = Math.max(2, Math.floor((canvas.clientHeight || window.innerHeight) * dpr));

      // Dynamic 3×2 grid (6 tiles: 3 columns × 2 rows) for 5–6 marbles, or 2×2 for 1–4
      const activeCount = slotEntries.length;
      const cols = activeCount > 4 ? 3 : 2;
      const rows = 2;
      const colW = Math.floor(fullW / cols);
      const rowH = Math.floor(fullH / rows);

      const tileDefs: readonly GridTileViewInput[] = slotEntries.map((entry, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols); // 0 = top row, 1 = bottom row
        const vx = col * colW;
        const vw = col === cols - 1 ? fullW - vx : colW;
        // WebGL2 viewport y=0 is bottom row; top row (row=0) has y = rowH
        const vy = row === 0 ? rowH : 0;
        const vh = row === 0 ? fullH - rowH : rowH;

        const otherMarbles: OtherMarbleRenderInput[] = slotEntries
          .filter((other) => other.slotIndex !== idx)
          .map((other) => ({
            position: other.renderPosition,
            radius: other.marble.radius,
            color: other.palette.rgb,
            slotIndex: other.slotIndex,
          }));

        return {
          tileIndex: idx,
          viewport: { x: vx, y: vy, width: vw, height: vh },
          camera: cameras[idx],
          marble: entry.marble,
          renderPosition: entry.renderPosition,
          renderOrientation: entry.renderOrientation,
          marbleColor: entry.palette.rgb,
          otherMarbles,
          ghostActive: false,
        };
      });

      const nextGridCells: readonly PlayerGridCellHudInfo[] = slotEntries.map((entry) => {
        const speed = Math.hypot(
          entry.marble.velocity[0],
          entry.marble.velocity[1],
          entry.marble.velocity[2],
        );
        return {
          slotIndex: entry.slotIndex,
          badgeTitle: `${entry.palette.slotId} @${entry.handle}`,
          subtitle: entry.palette.marbleTitle,
          speedUps: speed,
          roomCode: currentRoomCode,
          accentColor: entry.palette.hex,
          status: entry.marble.status,
          isHuman: entry.isHuman,
        };
      });
      gridCellsRef.current = nextGridCells;

      return {
        tileDefs,
        nextGridCells,
        currentRoomCode,
        connectedCount: Math.max(1, partyBySlot.size || 1),
      };
    };

    const inputCtrl = createArcadeInputController(window, {
      onSelectCourse: (idx) => {
        if (sdfWizardOpenRef.current && idx >= 0 && idx < 5) {
          setDebugVizModeInternal((idx + 1) as SdfDebugVizMode, true);
          return;
        }
        if (viewModeRef.current === 'grid' && idx >= 0 && idx < MAX_PLAYERS) {
          selectGridPlayerInternal(idx);
          return;
        }
        handleSelectCourse(idx);
      },
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
        for (const rig of tileCameraRigsRef.current) {
          rig.adjustYaw(deltaDeg);
        }
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
      onFirePortal: (end, pointerNdc) => {
        firePortalInternal(end, pointerNdc);
      },
      onPointerHoverNdc: (pointerNdc, altKey) => {
        cursorNdcRef.current = pointerNdc;
        if (sdfWizardOpenRef.current) {
          setUiSdfCaliper(computeCaliperSnapshot(pointerNdc));
        }
        if (!altKey) {
          portalAimPreviewRef.current = undefined;
          return;
        }
        const ray = computeCameraCursorRay(pointerNdc);
        portalAimPreviewRef.current = raycastPortalAimPreview(
          'orange',
          ray.origin,
          ray.aimDir,
          evaluatorRef.current,
          simTimeRef.current,
        );
      },
      onTriggerWeapon: (ability) => {
        triggerWeaponInternal(ability);
      },
      onToggleParty: () => {
        setPartyOpen((prev) => !prev);
      },
      onToggleViewMode: () => {
        toggleViewModeInternal();
      },
      onToggleDebugDrawer: () => {
        toggleDebugDrawerInternal();
      },
      onToggleSdfWizard: () => {
        toggleSdfWizardInternal();
      },
      onCycleEngineMode: () => {
        cycleEngineModeInternal();
      },
    });

    const getCoursePixelBenchmark = (course: CourseSpec): ShaderPixelEvaluationBenchmark => {
      const cached = pixelEvalCacheRef.current.get(course.id);
      if (cached) return cached;
      const computed = benchmarkShaderPixelEvaluations(course, 12, 8);
      pixelEvalCacheRef.current.set(course.id, computed);
      return computed;
    };

    const buildProfilerSnapshot = (): LiveProfilerTelemetry => {
      const rMetrics = renderer.getProfilerMetrics();
      const course = activeCourseRef.current;
      return {
        fps: Number(fpsRef.current.toFixed(1)),
        frameTimeMs: rMetrics.frameTimeMs,
        emaFrameMs: rMetrics.emaFrameMs,
        gpuPassMs: rMetrics.gpuPassMs,
        gpuTimerQueryAvailable: rMetrics.gpuTimerQueryAvailable,
        physicsStepMs: Number(physicsStepMsRef.current.toFixed(2)),
        effectiveDpr: rMetrics.effectiveDpr,
        adaptiveScale: rMetrics.adaptiveScale,
        initialDprCap: rMetrics.initialDprCap,
        renderResolution: rMetrics.renderResolution,
        hudSyncHz: HUD_SYNC_HZ,
        pixelEvalBenchmark: getCoursePixelBenchmark(course),
      };
    };

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
        portals: portalsRef.current,
        portalAimPreview: portalAimPreviewRef.current,
        fieldMutations: weaponStateRef.current.mutations,
        bridgeExtruderRemainingSec: weaponStateRef.current.bridgeExtruderRemainingSec,
        viewMode: viewModeRef.current,
        focusedPlayerIndex: focusedPlayerIdxRef.current,
        debugDrawerOpen: debugDrawerOpenRef.current,
        sdfWizardOpen: sdfWizardOpenRef.current,
        debugVizMode: debugVizModeRef.current,
        sdfWizardAutoTour: sdfWizardAutoTourRef.current,
        sdfWizardElapsedSec: sdfWizardElapsedRef.current,
        sdfCaliper: sdfWizardOpenRef.current ? computeCaliperSnapshot() : undefined,
        engineMode: engineModeRef.current,
        gridCells: gridCellsRef.current,
        profiler: buildProfilerSnapshot(),
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
        const fwdXZ = cameraRigRef.current.projectInputToWorldXZ(0, 1);
        const aimForward: Vec3 = [
          baseMoveXZ[0] || fwdXZ[0],
          0,
          baseMoveXZ[1] || fwdXZ[1],
        ];
        let latestSensory = sensoryRef.current.getSnapshot(
          simRef.current.getState(),
          runElapsedRef.current,
        );
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
        const gridOut = stepMultiplayerAndBuildGrid(
          (count * dt) || 1 / 60,
          activeCourseRef.current,
          mState,
          mState.position,
          mState.orientation,
          camState,
        );
        const focusedTile = gridOut.tileDefs[focusedPlayerIdxRef.current] ?? gridOut.tileDefs[0];
        const shockUniforms = shockwaveMgrRef.current.packUniforms();
        renderer.render({
          course: activeCourseRef.current,
          marble: viewModeRef.current === 'fullscreen' ? focusedTile.marble : mState,
          renderPosition: viewModeRef.current === 'fullscreen' ? focusedTile.renderPosition : mState.position,
          renderOrientation: viewModeRef.current === 'fullscreen' ? focusedTile.renderOrientation : mState.orientation,
          marbleColor: focusedTile.marbleColor,
          otherMarbles: focusedTile.otherMarbles,
          camera: viewModeRef.current === 'fullscreen' ? focusedTile.camera : camState,
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
          fieldMutations: weaponStateRef.current.mutations,
          portals: portalsRef.current,
          portalAimPreview: portalAimPreviewRef.current,
          engineMode: engineModeRef.current,
          debugVizMode: debugVizModeRef.current,
          gridTiles: viewModeRef.current === 'grid' ? gridOut.tileDefs : undefined,
        });
        setUiMarble(mState);
        setUiCamera(camState);
        setUiFeel(latestSensory.feel);
        setUiGhostSplit(latestSensory.split);
        setUiSynth(latestSensory.synth);
        setUiPortals(portalsRef.current);
        setUiWeaponState(weaponStateRef.current);
        setTimeRemainingSec(timeRemainingRef.current);
        setUiGridCells(gridOut.nextGridCells);
        setPartyRoomCode(gridOut.currentRoomCode);
        setPartyConnectedCount(gridOut.connectedCount);
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
      firePortal: (end, aimDir, origin) => {
        firePortalInternal(end, undefined, aimDir, origin);
        return buildTelemetrySnapshot();
      },
      placeSmartPortalBridge: () => {
        firePortalInternal('blue');
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
      setViewMode: (mode) => {
        viewModeRef.current = mode;
        setViewMode(mode);
        return buildTelemetrySnapshot();
      },
      toggleViewMode: () => {
        toggleViewModeInternal();
        return buildTelemetrySnapshot();
      },
      setDebugDrawerOpen: (open) => {
        debugDrawerOpenRef.current = open;
        setDebugDrawerOpen(open);
        return buildTelemetrySnapshot();
      },
      setSdfWizardOpen: (open) => {
        setSdfWizardOpenInternal(open);
        return buildTelemetrySnapshot();
      },
      toggleSdfWizard: () => {
        toggleSdfWizardInternal();
        return buildTelemetrySnapshot();
      },
      setDebugVizMode: (mode) => {
        setDebugVizModeInternal(mode, true);
        return buildTelemetrySnapshot();
      },
      getDebugVizMode: () => debugVizModeRef.current,
      measureCaliperAtNdc: (ndcX, ndcY) => {
        const nextNdc: readonly [number, number] = [
          Math.max(-1, Math.min(1, ndcX)),
          Math.max(-1, Math.min(1, ndcY)),
        ];
        cursorNdcRef.current = nextNdc;
        const snap = computeCaliperSnapshot(nextNdc);
        setUiSdfCaliper(snap);
        return snap;
      },
      selectGridPlayer: (slotIndex) => {
        selectGridPlayerInternal(slotIndex);
        return buildTelemetrySnapshot();
      },
      setEngineMode: (mode) => {
        setEngineModeInternal(mode);
        return buildTelemetrySnapshot();
      },
      cycleEngineMode: () => {
        cycleEngineModeInternal();
        return buildTelemetrySnapshot();
      },
      getEngineMode: () => engineModeRef.current,
      getProfilerMetrics: buildProfilerSnapshot,
    };

    const profilerApi: MarbleProfilerApi = {
      getMetrics: buildProfilerSnapshot,
      benchmarkPixelEvaluations: (
        targetCourse = activeCourseRef.current,
        gridWidth = 12,
        gridHeight = 8,
      ) => benchmarkShaderPixelEvaluations(targetCourse, gridWidth, gridHeight),
      setAdaptiveScale: (scale: number) => {
        renderer.setAdaptiveScale(scale);
        const snap = buildProfilerSnapshot();
        setUiProfiler(snap);
        return snap;
      },
    };

    window.__MARBLE_PLAYTEST__ = playtestApi;
    window.__MARBLE_MADNESS_ARCHITECT__ = playtestApi;
    window.__MARBLE_PROFILER__ = profilerApi;

    const botController = createBotPlaytestController(() => window.__MARBLE_PLAYTEST__, {
      initialStyle: 'tourist',
      attachKeyboardShortcut: true,
    });
    botControllerRef.current = botController;
    window.__MARBLE_BOT__ = botController;

    let rafId = 0;
    let lastTimeMs = performance.now();
    let uiSyncAccumulator = 0;
    let lastSyncedCourseIdx = activeIdxRef.current;
    let lastSyncedArchitectOpen = architectOpenRef.current;
    let lastSyncedPartyOpen = partyOpenRef.current;
    let lastSyncedDebugOpen = debugDrawerOpenRef.current;
    let lastSyncedWizardOpen = sdfWizardOpenRef.current;
    let lastSyncedDebugVizMode = debugVizModeRef.current;
    let lastSyncedViewMode = viewModeRef.current;

    const tick = (nowMs: number) => {
      try {
        const physicsStartMs = performance.now();
        const rawDt = Math.max(0.001, Math.min(0.08, (nowMs - lastTimeMs) / 1000));
        lastTimeMs = nowMs;
        simTimeRef.current += rawDt;

        if (sdfWizardOpenRef.current && sdfWizardAutoTourRef.current) {
          const nextElapsed =
            (sdfWizardElapsedRef.current + rawDt) % SDF_WIZARD_TOTAL_DURATION_SEC;
          sdfWizardElapsedRef.current = nextElapsed;
          const nextStep = (Math.min(
            5,
            Math.max(1, Math.floor(nextElapsed / SDF_WIZARD_STEP_DURATION_SEC) + 1),
          ) as SdfDebugVizMode);
          if (nextStep !== debugVizModeRef.current) {
            debugVizModeRef.current = nextStep;
            setDebugVizMode(nextStep);
            if (nextStep === 4 && !sdfWizardDemoCsgFiredRef.current) {
              sdfWizardDemoCsgFiredRef.current = true;
              triggerWeaponInternal('matterBomb');
              firePortalInternal('blue');
            }
          }
        }

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

        // Update countdown timer while racing (pause solo timer when Architect or Party drawer is open)
        if (marbleState.status === 'racing') {
          if (prevMarble.status !== 'racing') {
            runElapsedRef.current = 0;
          }
          const timerPaused = architectOpenRef.current || partyOpenRef.current;
          if (!timerPaused) {
            runElapsedRef.current += rawDt;
            timeRemainingRef.current = Math.max(0, timeRemainingRef.current - rawDt);
            if (timeRemainingRef.current <= 0) {
              timeRemainingRef.current = course.parTimeSec;
              runElapsedRef.current = 0;
              simRef.current.respawn(false);
              sensoryRef.current.onRespawn(course, simRef.current.getState());
            }
          }
          const speed = Math.hypot(marbleState.velocity[0], marbleState.velocity[2]);
          if (speed > 2.5) {
            scoreAccumulatorRef.current += speed * rawDt * 12;
            scoreRef.current = Math.floor(scoreAccumulatorRef.current);
          }
        } else if (marbleState.status === 'goal' && !goalAwardedRef.current) {
          goalAwardedRef.current = true;
          scoreAccumulatorRef.current += 2500 + Math.round(timeRemainingRef.current * 100);
          scoreRef.current = Math.floor(scoreAccumulatorRef.current);
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

        const {
          tileDefs,
          nextGridCells,
          currentRoomCode,
          connectedCount,
        } = stepMultiplayerAndBuildGrid(
          rawDt,
          course,
          marbleState,
          renderPosition,
          renderOrientation,
          camState,
        );

        const focusedTile = tileDefs[focusedPlayerIdxRef.current] ?? tileDefs[0];

        const rawPhysStepMs = Math.max(0.05, performance.now() - physicsStartMs);
        physicsStepMsRef.current = physicsStepMsRef.current * 0.85 + rawPhysStepMs * 0.15;

        renderer.render({
          course,
          marble: viewModeRef.current === 'fullscreen' ? focusedTile.marble : marbleState,
          renderPosition: viewModeRef.current === 'fullscreen' ? focusedTile.renderPosition : renderPosition,
          renderOrientation: viewModeRef.current === 'fullscreen' ? focusedTile.renderOrientation : renderOrientation,
          marbleColor: focusedTile.marbleColor,
          otherMarbles: focusedTile.otherMarbles,
          camera: viewModeRef.current === 'fullscreen' ? focusedTile.camera : camState,
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
          fieldMutations: weaponStateRef.current.mutations,
          portals: portalsRef.current,
          portalAimPreview: portalAimPreviewRef.current,
          engineMode: engineModeRef.current,
          debugVizMode: debugVizModeRef.current,
          gridTiles: viewModeRef.current === 'grid' ? tileDefs : undefined,
        });

        // Throttle React HUD state updates to 20 Hz (every 50 ms), or flush immediately
        // when lifecycle status, course selection, or modal/drawer state changes.
        uiSyncAccumulator += rawDt;
        const immediateStateChange =
          marbleState.status !== prevMarble.status ||
          activeIdxRef.current !== lastSyncedCourseIdx ||
          architectOpenRef.current !== lastSyncedArchitectOpen ||
          partyOpenRef.current !== lastSyncedPartyOpen ||
          debugDrawerOpenRef.current !== lastSyncedDebugOpen ||
          sdfWizardOpenRef.current !== lastSyncedWizardOpen ||
          debugVizModeRef.current !== lastSyncedDebugVizMode ||
          viewModeRef.current !== lastSyncedViewMode;

        if (uiSyncAccumulator >= HUD_SYNC_INTERVAL_SEC || immediateStateChange) {
          uiSyncAccumulator = 0;
          lastSyncedCourseIdx = activeIdxRef.current;
          lastSyncedArchitectOpen = architectOpenRef.current;
          lastSyncedPartyOpen = partyOpenRef.current;
          lastSyncedDebugOpen = debugDrawerOpenRef.current;
          lastSyncedWizardOpen = sdfWizardOpenRef.current;
          lastSyncedDebugVizMode = debugVizModeRef.current;
          lastSyncedViewMode = viewModeRef.current;

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
          setUiPortals(portalsRef.current);
          setUiWeaponState(weaponStateRef.current);
          setUiGridCells(nextGridCells);
          setPartyRoomCode(currentRoomCode);
          setPartyConnectedCount(connectedCount);
          setUiProfiler(buildProfilerSnapshot());
          if (sdfWizardOpenRef.current) {
            setSdfWizardElapsedSec(sdfWizardElapsedRef.current);
            setUiSdfCaliper(computeCaliperSnapshot());
          }
        }
      } catch (err) {
        console.error('Frame tick error:', err);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      botController.dispose();
      botControllerRef.current = null;
      delete window.__MARBLE_PROFILER__;
      inputCtrl.dispose();
      renderer.dispose();
    };
  }, [handleApplyCustomCourse, handleSelectCourse]);

  return (
    <main className={`app-viewport ${viewMode === 'grid' ? 'app-viewport-split-grid' : ''}`}>
      <canvas
        ref={canvasRef}
        className="sdf-raymarch-canvas"
        aria-label="Marble Madness SDF Raymarched Viewport"
      />

      <OverlayErrorBoundary>
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
          partyOpen={partyOpen}
          partyRoomCode={partyRoomCode}
          partyConnectedCount={partyConnectedCount}
          viewMode={viewMode}
          focusedPlayerIndex={focusedPlayerIndex}
          debugDrawerOpen={debugDrawerOpen}
          sdfWizardOpen={sdfWizardOpen}
          engineMode={engineMode}
          gridCells={uiGridCells}
          portals={uiPortals}
          fieldMutations={uiWeaponState.mutations}
          bridgeExtruderRemainingSec={uiWeaponState.bridgeExtruderRemainingSec}
          lastActivatedAbility={uiWeaponState.lastActivatedAbility}
          profilerMetrics={uiProfiler}
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
          onFirePortal={(end) => {
            window.__MARBLE_PLAYTEST__?.firePortal(end);
          }}
          onTriggerWeapon={(ability) => {
            window.__MARBLE_PLAYTEST__?.triggerWeapon(ability);
          }}
          onToggleParty={() => setPartyOpen((prev) => !prev)}
          onToggleViewMode={() => {
            window.__MARBLE_PLAYTEST__?.toggleViewMode?.();
          }}
          onToggleDebugDrawer={() => {
            const next = !debugDrawerOpenRef.current;
            debugDrawerOpenRef.current = next;
            setDebugDrawerOpen(next);
          }}
          onToggleSdfWizard={() => {
            window.__MARBLE_PLAYTEST__?.toggleSdfWizard?.();
          }}
          onCycleEngineMode={() => {
            window.__MARBLE_PLAYTEST__?.cycleEngineMode?.();
          }}
          onSelectGridPlayer={(slotIndex) => {
            window.__MARBLE_PLAYTEST__?.selectGridPlayer?.(slotIndex);
          }}
          onClearSavedGhosts={() => {
            sensoryRef.current.replayManager.clearPersonalBests();
            setUiGhostSplit(
              sensoryRef.current.replayManager.getSplitSnapshot(
                simRef.current.getState(),
                runElapsedRef.current,
              ),
            );
          }}
        />

        <SdfDebugWizard
          isOpen={sdfWizardOpen}
          activeMode={debugVizMode}
          autoTourPlaying={sdfWizardAutoTour}
          autoTourElapsedSec={sdfWizardElapsedSec}
          caliper={uiSdfCaliper}
          onSelectMode={(mode) => {
            window.__MARBLE_PLAYTEST__?.setDebugVizMode?.(mode);
          }}
          onToggleAutoTour={() => {
            const next = !sdfWizardAutoTourRef.current;
            sdfWizardAutoTourRef.current = next;
            setSdfWizardAutoTour(next);
            if (next && debugVizModeRef.current === 0) {
              debugVizModeRef.current = 1;
              setDebugVizMode(1);
              sdfWizardElapsedRef.current = 0;
              setSdfWizardElapsedSec(0);
            }
          }}
          onRestartAutoTour={() => {
            debugVizModeRef.current = 1;
            setDebugVizMode(1);
            sdfWizardAutoTourRef.current = true;
            setSdfWizardAutoTour(true);
            sdfWizardElapsedRef.current = 0;
            setSdfWizardElapsedSec(0);
            sdfWizardDemoCsgFiredRef.current = false;
          }}
          onTriggerDemoCsgPulse={() => {
            window.__MARBLE_PLAYTEST__?.triggerWeapon('matterBomb');
            window.__MARBLE_PLAYTEST__?.firePortal('blue');
          }}
          onClose={() => {
            window.__MARBLE_PLAYTEST__?.setSdfWizardOpen?.(false);
          }}
        />

        <ArchitectHookPanel
          isOpen={architectOpen}
          onClose={() => setArchitectOpen(false)}
          currentCourse={currentCourse}
          compiledShaders={compiledShaders}
          onApplyCustomCourse={handleApplyCustomCourse}
          seedPrompt={crowdSeedPrompt}
        />

        <QrPartyHudModal
          isOpen={partyOpen}
          onClose={() => setPartyOpen(false)}
          client={partyClientRef.current}
          roomCode={partyRoomCode}
          onSynthesizeCrowdTwist={(combinedPrompt) => {
            setCrowdSeedPrompt(combinedPrompt);
            setPartyOpen(false);
            setArchitectOpen(true);
          }}
        />
      </OverlayErrorBoundary>
    </main>
  );
};
