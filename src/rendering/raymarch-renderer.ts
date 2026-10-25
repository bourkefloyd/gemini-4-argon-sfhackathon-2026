/**
 * Fullscreen SDF Raymarching Renderer (`src/rendering/raymarch-renderer.ts`)
 *
 * Uses WebGL2 fullscreen quad fragment raymarching (with lockstep GLSL ES 3.00 and WGSL
 * shader compilation from `CourseSpec`) so it runs at 60 FPS in both standard browsers
 * and headless/headed Chromium with zero black-screen fallbacks.
 */

import {
  type CameraState,
  type CourseSpec,
  FIELD_MUTATION_KIND_CODES,
  type FieldMutation,
  MARBLE_VISUAL_PRESETS,
  MATERIAL_IDS,
  MAX_FIELD_MUTATIONS,
  MAX_PORTAL_PAIRS,
  type MarbleLifecycleStatus,
  type MarbleState,
  type PortalPair,
} from '../contracts';
import { createCpuWorldEvaluator } from '../sdf/eval-cpu';
import { compileCourseToGlsl, compileCourseToWgsl } from './shader-compiler';

const VERTEX_SHADER_GLSL = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle covering [-1, 1] NDC
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const STATUS_TO_INT: Record<MarbleLifecycleStatus, number> = {
  racing: 0,
  goal: 1,
  shattered: 2,
  sunk: 3,
  fell: 4,
};

/**
 * Default initial Retina devicePixelRatio cap (1.35× looks razor-sharp with our
 * analytical subpixel sphere/edge anti-aliasing while shading 2.2× fewer pixels than DPR 2.0).
 */
export const INITIAL_DPR_CAP = 1.35;
export const MIN_ADAPTIVE_SCALE = 0.75;
export const MAX_ADAPTIVE_SCALE = 1.0;
export const GOVERNOR_DOWN_THRESHOLD_MS = 17.2; // < 58 FPS
export const GOVERNOR_UP_THRESHOLD_MS = 11.5;   // > 85 FPS

/**
 * Smoothly steps `adaptiveScale` in [0.75, 1.0] based on rolling `emaFrameMs`:
 * - If `emaFrameMs > 17.2 ms` (< 58 FPS), smoothly step `adaptiveScale` down toward `0.75`.
 * - If `emaFrameMs < 11.5 ms` (> 85 FPS), smoothly step `adaptiveScale` up toward `1.0`.
 */
export function stepAutoGovernorScale(
  currentScale: number,
  emaFrameMs: number,
  stepDownDelta = 0.025,
  stepUpDelta = 0.015,
): number {
  const clamped = Math.max(MIN_ADAPTIVE_SCALE, Math.min(MAX_ADAPTIVE_SCALE, currentScale));
  if (emaFrameMs > GOVERNOR_DOWN_THRESHOLD_MS) {
    return Number(Math.max(MIN_ADAPTIVE_SCALE, clamped - stepDownDelta).toFixed(4));
  }
  if (emaFrameMs < GOVERNOR_UP_THRESHOLD_MS) {
    return Number(Math.min(MAX_ADAPTIVE_SCALE, clamped + stepUpDelta).toFixed(4));
  }
  return clamped;
}

export interface RendererProfilerMetrics {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly emaFrameMs: number;
  readonly gpuPassMs: number;
  readonly gpuTimerQueryAvailable: boolean;
  readonly initialDprCap: number;
  readonly adaptiveScale: number;
  readonly effectiveDpr: number;
  readonly renderResolution: readonly [number, number];
}

export interface OtherMarbleRenderInput {
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly color: readonly [number, number, number];
  readonly slotIndex?: number;
}

export interface GridTileViewInput {
  readonly tileIndex: number;
  readonly viewport: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly camera: CameraState;
  readonly marble: MarbleState;
  readonly renderPosition: readonly [number, number, number];
  readonly renderOrientation: readonly [number, number, number, number];
  readonly marbleColor?: readonly [number, number, number];
  readonly otherMarbles?: readonly OtherMarbleRenderInput[];
  readonly ghostActive?: boolean;
  readonly ghostPos?: readonly [number, number, number];
  readonly ghostQuat?: readonly [number, number, number, number];
  readonly ghostColor?: readonly [number, number, number];
}

export interface RenderFrameInput {
  readonly course: CourseSpec;
  readonly marble: MarbleState;
  readonly renderPosition: readonly [number, number, number];
  readonly renderOrientation: readonly [number, number, number, number];
  readonly marbleColor?: readonly [number, number, number];
  readonly otherMarbles?: readonly OtherMarbleRenderInput[];
  readonly camera: CameraState;
  readonly time: number;
  readonly glassStress?: number;
  readonly crackVisibility?: number;
  readonly stressGlow?: number;
  readonly ghostActive?: boolean;
  readonly ghostPos?: readonly [number, number, number];
  readonly ghostQuat?: readonly [number, number, number, number];
  readonly ghostColor?: readonly [number, number, number];
  readonly shatterShards?: Float32Array;
  readonly shatterShardCount?: number;
  readonly shockwaveRings?: Float32Array;
  readonly shockwaveParams?: Float32Array;
  readonly rimDanger?: Float32Array;
  readonly fieldMutations?: readonly FieldMutation[];
  readonly portals?: readonly PortalPair[];
  readonly portalAimPreview?: {
    readonly active: boolean;
    readonly end: 'blue' | 'orange';
    readonly position: readonly [number, number, number];
    readonly normal: readonly [number, number, number];
    readonly radius: number;
  };
  /** Live Engine Comparison Mode: 0 = ULTRA SDF, 1 = BASIC POLYGON, 2 = SPLIT-SCREEN A/B */
  readonly engineMode?: number;
  /** 20-Second SDF X-Ray & Measurement Wizard Mode: 0 = Off, 1..5 = Wizard Steps */
  readonly debugVizMode?: number;
  /** Optional multi-POV grid tiles; when provided with length > 0, renders each tile with WebGL2 scissor + viewport */
  readonly gridTiles?: readonly GridTileViewInput[];
}

export interface RaymarchRenderer {
  setCourse(course: CourseSpec): void;
  render(frame: RenderFrameInput): void;
  getCompiledShaders(): { glsl: string; wgsl: string; backend: string };
  getProfilerMetrics(): RendererProfilerMetrics;
  setAdaptiveScale(scale: number): void;
  dispose(): void;
}

interface UniformLocations {
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uCameraPos: WebGLUniformLocation | null;
  uCameraForward: WebGLUniformLocation | null;
  uCameraRight: WebGLUniformLocation | null;
  uCameraUp: WebGLUniformLocation | null;
  uCameraTanHalfFov: WebGLUniformLocation | null;
  uMarblePos: WebGLUniformLocation | null;
  uMarbleQuat: WebGLUniformLocation | null;
  uMarbleRadius: WebGLUniformLocation | null;
  uMarbleStatus: WebGLUniformLocation | null;
  uMarbleStatusTimer: WebGLUniformLocation | null;
  uMarbleBaseColor: WebGLUniformLocation | null;
  uMarbleVeinColor: WebGLUniformLocation | null;
  uMarbleGlowColor: WebGLUniformLocation | null;
  uMarbleIridescence: WebGLUniformLocation | null;
  uGoalPos: WebGLUniformLocation | null;
  uGoalRadius: WebGLUniformLocation | null;
  uOcclusionStrength: WebGLUniformLocation | null;
  uTrackPrimary: WebGLUniformLocation | null;
  uTrackSecondary: WebGLUniformLocation | null;
  uGridLineColor: WebGLUniformLocation | null;
  uWallColor: WebGLUniformLocation | null;
  uSkyZenith: WebGLUniformLocation | null;
  uSkyHorizon: WebGLUniformLocation | null;
  uAbyssFogColor: WebGLUniformLocation | null;
  uAbyssFogDensity: WebGLUniformLocation | null;
  uSunDir: WebGLUniformLocation | null;
  uGlassStress: WebGLUniformLocation | null;
  uCrackVisibility: WebGLUniformLocation | null;
  uStressGlow: WebGLUniformLocation | null;
  uGhostActive: WebGLUniformLocation | null;
  uGhostPos: WebGLUniformLocation | null;
  uGhostQuat: WebGLUniformLocation | null;
  uGhostColor: WebGLUniformLocation | null;
  uOtherMarbleCount: WebGLUniformLocation | null;
  uOtherMarblePosRad: WebGLUniformLocation | null;
  uOtherMarbleColor: WebGLUniformLocation | null;
  uShatterShards: WebGLUniformLocation | null;
  uShatterShardCount: WebGLUniformLocation | null;
  uShockwaveRings: WebGLUniformLocation | null;
  uShockwaveParams: WebGLUniformLocation | null;
  uRimDanger: WebGLUniformLocation | null;
  uMutationCount: WebGLUniformLocation | null;
  uMutationsPosA: WebGLUniformLocation | null;
  uMutationsPosB: WebGLUniformLocation | null;
  uMutationsMeta: WebGLUniformLocation | null;
  uPortalPairCount: WebGLUniformLocation | null;
  uPortalPosA: WebGLUniformLocation | null;
  uPortalNormalA: WebGLUniformLocation | null;
  uPortalUpA: WebGLUniformLocation | null;
  uPortalPosB: WebGLUniformLocation | null;
  uPortalNormalB: WebGLUniformLocation | null;
  uPortalUpB: WebGLUniformLocation | null;
  uPortalAimPos: WebGLUniformLocation | null;
  uPortalAimNormal: WebGLUniformLocation | null;
  uEngineMode: WebGLUniformLocation | null;
  uDebugVizMode: WebGLUniformLocation | null;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('Failed to allocate WebGLShader');
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string,
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const prog = gl.createProgram();
  if (!prog) {
    throw new Error('Failed to allocate WebGLProgram');
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || 'Unknown program link error';
    gl.deleteProgram(prog);
    throw new Error(`Program link failed:\n${info}`);
  }
  return prog;
}

export function createRaymarchRenderer(
  canvas: HTMLCanvasElement,
  initialCourse: CourseSpec,
): RaymarchRenderer {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });

  let currentCourse = initialCourse;
  let currentGlsl = compileCourseToGlsl(initialCourse);
  let currentWgsl = compileCourseToWgsl(initialCourse);
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let locations: UniformLocations | null = null;
  let fallbackEvaluator = createCpuWorldEvaluator(initialCourse);
  let contextLost = false;
  let lastFrameTimeMs = 16.6;
  let emaFrameMs = 16.6;
  let lastRenderTimeMs = typeof performance !== 'undefined' ? performance.now() : 0;
  let adaptiveScale = 1.0;
  let effectiveDpr = INITIAL_DPR_CAP;
  let gpuPassMs = 2.4;

  // WebGL2 EXT_disjoint_timer_query_webgl2 support for hardware GPU pass timing
  const timerExt = gl
    ? (gl.getExtension('EXT_disjoint_timer_query_webgl2') as {
        readonly TIME_ELAPSED_EXT: number;
        readonly GPU_DISJOINT_EXT: number;
      } | null)
    : null;
  const pendingQueries: WebGLQuery[] = [];

  // Pre-allocated uniform upload buffers (zero GC allocation per frame)
  const mutPosAData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
  const mutPosBData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
  const mutMetaData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
  const portalPosAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
  const portalNormalAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
  const portalUpAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
  const portalPosBData = new Float32Array(MAX_PORTAL_PAIRS * 4);
  const portalNormalBData = new Float32Array(MAX_PORTAL_PAIRS * 4);
  const portalUpBData = new Float32Array(MAX_PORTAL_PAIRS * 4);

  function queryUniforms(glCtx: WebGL2RenderingContext, prog: WebGLProgram): UniformLocations {
    const u = (name: string) => glCtx.getUniformLocation(prog, name);
    return {
      uResolution: u('uResolution'),
      uTime: u('uTime'),
      uCameraPos: u('uCameraPos'),
      uCameraForward: u('uCameraForward'),
      uCameraRight: u('uCameraRight'),
      uCameraUp: u('uCameraUp'),
      uCameraTanHalfFov: u('uCameraTanHalfFov'),
      uMarblePos: u('uMarblePos'),
      uMarbleQuat: u('uMarbleQuat'),
      uMarbleRadius: u('uMarbleRadius'),
      uMarbleStatus: u('uMarbleStatus'),
      uMarbleStatusTimer: u('uMarbleStatusTimer'),
      uMarbleBaseColor: u('uMarbleBaseColor'),
      uMarbleVeinColor: u('uMarbleVeinColor'),
      uMarbleGlowColor: u('uMarbleGlowColor'),
      uMarbleIridescence: u('uMarbleIridescence'),
      uGoalPos: u('uGoalPos'),
      uGoalRadius: u('uGoalRadius'),
      uOcclusionStrength: u('uOcclusionStrength'),
      uTrackPrimary: u('uTrackPrimary'),
      uTrackSecondary: u('uTrackSecondary'),
      uGridLineColor: u('uGridLineColor'),
      uWallColor: u('uWallColor'),
      uSkyZenith: u('uSkyZenith'),
      uSkyHorizon: u('uSkyHorizon'),
      uAbyssFogColor: u('uAbyssFogColor'),
      uAbyssFogDensity: u('uAbyssFogDensity'),
      uSunDir: u('uSunDir'),
      uGlassStress: u('uGlassStress'),
      uCrackVisibility: u('uCrackVisibility'),
      uStressGlow: u('uStressGlow'),
      uGhostActive: u('uGhostActive'),
      uGhostPos: u('uGhostPos'),
      uGhostQuat: u('uGhostQuat'),
      uGhostColor: u('uGhostColor'),
      uOtherMarbleCount: u('uOtherMarbleCount'),
      uOtherMarblePosRad: u('uOtherMarblePosRad[0]'),
      uOtherMarbleColor: u('uOtherMarbleColor[0]'),
      uShatterShards: u('uShatterShards'),
      uShatterShardCount: u('uShatterShardCount'),
      uShockwaveRings: u('uShockwaveRings'),
      uShockwaveParams: u('uShockwaveParams'),
      uRimDanger: u('uRimDanger'),
      uMutationCount: u('uMutationCount'),
      uMutationsPosA: u('uMutationsPosA[0]'),
      uMutationsPosB: u('uMutationsPosB[0]'),
      uMutationsMeta: u('uMutationsMeta[0]'),
      uPortalPairCount: u('uPortalPairCount'),
      uPortalPosA: u('uPortalPosA[0]'),
      uPortalNormalA: u('uPortalNormalA[0]'),
      uPortalUpA: u('uPortalUpA[0]'),
      uPortalPosB: u('uPortalPosB[0]'),
      uPortalNormalB: u('uPortalNormalB[0]'),
      uPortalUpB: u('uPortalUpB[0]'),
      uPortalAimPos: u('uPortalAimPos'),
      uPortalAimNormal: u('uPortalAimNormal'),
      uEngineMode: u('uEngineMode'),
      uDebugVizMode: u('uDebugVizMode'),
    };
  }

  function rebuildGpuProgram(course: CourseSpec) {
    let nextGlsl = currentGlsl;
    let nextWgsl = currentWgsl;
    try {
      nextGlsl = compileCourseToGlsl(course);
      nextWgsl = compileCourseToWgsl(course);
      fallbackEvaluator = createCpuWorldEvaluator(course);
    } catch (compileErr) {
      console.error('[RaymarchRenderer] Course SDF compilation failed; keeping active shader:', compileErr);
      return;
    }

    if (!gl || contextLost) {
      currentCourse = course;
      currentGlsl = nextGlsl;
      currentWgsl = nextWgsl;
      return;
    }

    try {
      // Compile & link new WebGL program BEFORE deleting the existing valid program
      const nextProgram = createProgram(gl, VERTEX_SHADER_GLSL, nextGlsl);
      const nextLocations = queryUniforms(gl, nextProgram);
      if (program) {
        gl.deleteProgram(program);
      }
      program = nextProgram;
      locations = nextLocations;
      currentCourse = course;
      currentGlsl = nextGlsl;
      currentWgsl = nextWgsl;
      if (!vao) {
        vao = gl.createVertexArray();
      }
    } catch (err) {
      console.error('[RaymarchRenderer] Hot-swap shader link failed; keeping previous glProgram active:', err);
    }
  }

  const handleContextLost = (ev: Event) => {
    ev.preventDefault();
    contextLost = true;
    program = null;
    vao = null;
    locations = null;
  };

  const handleContextRestored = () => {
    contextLost = false;
    rebuildGpuProgram(currentCourse);
  };

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  rebuildGpuProgram(initialCourse);

  function setCourse(course: CourseSpec) {
    if (course.id === currentCourse.id && course === currentCourse) return;
    rebuildGpuProgram(course);
  }

  function render(frame: RenderFrameInput) {
    if (frame.course !== currentCourse) {
      rebuildGpuProgram(frame.course);
    }

    const nowMs = typeof performance !== 'undefined' ? performance.now() : lastRenderTimeMs + 16.6;
    const dtMs = Math.max(1, Math.min(100, nowMs - lastRenderTimeMs));
    lastRenderTimeMs = nowMs;
    lastFrameTimeMs = dtMs;
    emaFrameMs = emaFrameMs * 0.9 + dtMs * 0.1;
    adaptiveScale = stepAutoGovernorScale(adaptiveScale, emaFrameMs);

    const baseDpr = Math.min(window.devicePixelRatio || 1, INITIAL_DPR_CAP);
    effectiveDpr = Math.max(0.65, Number((baseDpr * adaptiveScale).toFixed(3)));
    const displayWidth = Math.max(1, Math.floor((canvas.clientWidth || window.innerWidth) * effectiveDpr));
    const displayHeight = Math.max(1, Math.floor((canvas.clientHeight || window.innerHeight) * effectiveDpr));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    if (!gl || contextLost || !program || !locations) {
      renderCpuFallback(canvas, frame);
      return;
    }

    // Poll completed non-blocking GPU timer queries from previous frames
    if (timerExt && pendingQueries.length > 0) {
      const oldest = pendingQueries[0];
      const available = gl.getQueryParameter(oldest, gl.QUERY_RESULT_AVAILABLE);
      const disjoint = gl.getParameter(timerExt.GPU_DISJOINT_EXT);
      if (available) {
        pendingQueries.shift();
        if (!disjoint) {
          const elapsedNs = Number(gl.getQueryParameter(oldest, gl.QUERY_RESULT));
          if (Number.isFinite(elapsedNs) && elapsedNs > 0) {
            gpuPassMs = gpuPassMs * 0.85 + (elapsedNs / 1e6) * 0.15;
          }
        }
        gl.deleteQuery(oldest);
      }
    }

    const cpuPassStartMs = typeof performance !== 'undefined' ? performance.now() : 0;
    let activeQuery: WebGLQuery | null = null;
    if (timerExt && pendingQueries.length < 3) {
      activeQuery = gl.createQuery();
      if (activeQuery) {
        gl.beginQuery(timerExt.TIME_ELAPSED_EXT, activeQuery);
      }
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    const { camera, marble, renderPosition, renderOrientation, time, course } = frame;
    const theme = course.theme;
    const preset =
      MARBLE_VISUAL_PRESETS[marble.marblePresetIndex % MARBLE_VISUAL_PRESETS.length] ??
      MARBLE_VISUAL_PRESETS[0];
    const tanHalfFov = Math.tan((camera.fovDeg * Math.PI) / 360);

    gl.uniform2f(locations.uResolution, canvas.width, canvas.height);
    gl.uniform1f(locations.uTime, time);

    gl.uniform3f(locations.uCameraPos, camera.position[0], camera.position[1], camera.position[2]);
    gl.uniform3f(locations.uCameraForward, camera.forward[0], camera.forward[1], camera.forward[2]);
    gl.uniform3f(locations.uCameraRight, camera.right[0], camera.right[1], camera.right[2]);
    gl.uniform3f(locations.uCameraUp, camera.up[0], camera.up[1], camera.up[2]);
    gl.uniform1f(locations.uCameraTanHalfFov, tanHalfFov);

    gl.uniform3f(locations.uMarblePos, renderPosition[0], renderPosition[1], renderPosition[2]);
    gl.uniform4f(
      locations.uMarbleQuat,
      renderOrientation[0],
      renderOrientation[1],
      renderOrientation[2],
      renderOrientation[3],
    );
    gl.uniform1f(locations.uMarbleRadius, marble.radius);
    gl.uniform1i(locations.uMarbleStatus, STATUS_TO_INT[marble.status] ?? 0);
    gl.uniform1f(locations.uMarbleStatusTimer, marble.statusTimer);

    const fBaseCol = frame.marbleColor ?? preset.baseColor;
    const fVeinCol = frame.marbleColor
      ? [
          Math.min(1, fBaseCol[0] * 0.55 + 0.45),
          Math.min(1, fBaseCol[1] * 0.55 + 0.45),
          Math.min(1, fBaseCol[2] * 0.55 + 0.45),
        ]
      : preset.veinColor;
    const fGlowCol = frame.marbleColor ?? preset.coreGlowColor;
    gl.uniform3f(locations.uMarbleBaseColor, fBaseCol[0], fBaseCol[1], fBaseCol[2]);
    gl.uniform3f(locations.uMarbleVeinColor, fVeinCol[0], fVeinCol[1], fVeinCol[2]);
    gl.uniform3f(locations.uMarbleGlowColor, fGlowCol[0], fGlowCol[1], fGlowCol[2]);
    gl.uniform1f(locations.uMarbleIridescence, preset.iridescence);

    gl.uniform3f(locations.uGoalPos, course.goalPos[0], course.goalPos[1], course.goalPos[2]);
    gl.uniform1f(locations.uGoalRadius, course.goalRadius);
    gl.uniform1f(locations.uOcclusionStrength, camera.occlusionCutoutStrength);

    gl.uniform3f(locations.uTrackPrimary, theme.trackPrimary[0], theme.trackPrimary[1], theme.trackPrimary[2]);
    gl.uniform3f(locations.uTrackSecondary, theme.trackSecondary[0], theme.trackSecondary[1], theme.trackSecondary[2]);
    gl.uniform3f(locations.uGridLineColor, theme.gridLineColor[0], theme.gridLineColor[1], theme.gridLineColor[2]);
    gl.uniform3f(locations.uWallColor, theme.wallColor[0], theme.wallColor[1], theme.wallColor[2]);
    gl.uniform3f(locations.uSkyZenith, theme.skyZenith[0], theme.skyZenith[1], theme.skyZenith[2]);
    gl.uniform3f(locations.uSkyHorizon, theme.skyHorizon[0], theme.skyHorizon[1], theme.skyHorizon[2]);
    gl.uniform3f(locations.uAbyssFogColor, theme.abyssFogColor[0], theme.abyssFogColor[1], theme.abyssFogColor[2]);
    gl.uniform1f(locations.uAbyssFogDensity, theme.abyssFogDensity);
    gl.uniform3f(locations.uSunDir, theme.sunDirection[0], theme.sunDirection[1], theme.sunDirection[2]);

    gl.uniform1f(locations.uGlassStress, frame.glassStress ?? 0);
    gl.uniform1f(locations.uCrackVisibility, frame.crackVisibility ?? 0);
    gl.uniform1f(locations.uStressGlow, frame.stressGlow ?? 0);
    gl.uniform1i(locations.uEngineMode, frame.engineMode ?? 0);
    gl.uniform1i(locations.uDebugVizMode, frame.debugVizMode ?? 0);

    gl.uniform1i(locations.uGhostActive, frame.ghostActive ? 1 : 0);
    const gPos = frame.ghostPos ?? [0, -100, 0];
    const gQuat = frame.ghostQuat ?? [0, 0, 0, 1];
    const gCol = frame.ghostColor ?? [0.22, 0.94, 1.0];
    gl.uniform3f(locations.uGhostPos, gPos[0], gPos[1], gPos[2]);
    gl.uniform4f(locations.uGhostQuat, gQuat[0], gQuat[1], gQuat[2], gQuat[3]);
    gl.uniform3f(locations.uGhostColor, gCol[0], gCol[1], gCol[2]);

    const uploadOtherMarbles = (others: readonly OtherMarbleRenderInput[] | undefined) => {
      const list = others ?? [];
      const count = Math.min(6, list.length);
      const posRadData = new Float32Array(6 * 4);
      const colData = new Float32Array(6 * 4);
      for (let i = 0; i < 6; i++) {
        const base = i * 4;
        if (i < count) {
          const om = list[i];
          posRadData[base + 0] = om.position[0];
          posRadData[base + 1] = om.position[1];
          posRadData[base + 2] = om.position[2];
          posRadData[base + 3] = om.radius;
          colData[base + 0] = om.color[0];
          colData[base + 1] = om.color[1];
          colData[base + 2] = om.color[2];
          colData[base + 3] = om.slotIndex ?? i;
        } else {
          posRadData[base + 0] = 0;
          posRadData[base + 1] = -1000;
          posRadData[base + 2] = 0;
          posRadData[base + 3] = 0;
        }
      }
      gl.uniform1i(locations!.uOtherMarbleCount, count);
      if (locations!.uOtherMarblePosRad) {
        gl.uniform4fv(locations!.uOtherMarblePosRad, posRadData);
      }
      if (locations!.uOtherMarbleColor) {
        gl.uniform4fv(locations!.uOtherMarbleColor, colData);
      }
    };
    uploadOtherMarbles(frame.otherMarbles);

    gl.uniform1i(locations.uShatterShardCount, frame.shatterShardCount ?? 0);
    if (frame.shatterShards && locations.uShatterShards) {
      gl.uniform4fv(locations.uShatterShards, frame.shatterShards);
    }

    if (frame.shockwaveRings && locations.uShockwaveRings) {
      gl.uniform4fv(locations.uShockwaveRings, frame.shockwaveRings);
    }
    if (frame.shockwaveParams && locations.uShockwaveParams) {
      gl.uniform4fv(locations.uShockwaveParams, frame.shockwaveParams);
    }
    if (frame.rimDanger && locations.uRimDanger) {
      gl.uniform4fv(locations.uRimDanger, frame.rimDanger);
    } else if (locations.uRimDanger) {
      gl.uniform4f(locations.uRimDanger, 0, 0, 0, 0);
    }

    // Upload Realtime CSG FieldMutation Ring Buffer (MAX_FIELD_MUTATIONS = 16)
    const mutations = frame.fieldMutations ?? [];
    const mutCount = Math.min(mutations.length, MAX_FIELD_MUTATIONS);
    mutPosAData.fill(0);
    mutPosBData.fill(0);
    mutMetaData.fill(0);
    for (let i = 0; i < mutCount; i++) {
      const m = mutations[i];
      const base = i * 4;
      mutPosAData[base + 0] = m.posA[0];
      mutPosAData[base + 1] = m.posA[1];
      mutPosAData[base + 2] = m.posA[2];
      mutPosAData[base + 3] = m.radius;

      mutPosBData[base + 0] = m.posB[0];
      mutPosBData[base + 1] = m.posB[1];
      mutPosBData[base + 2] = m.posB[2];
      mutPosBData[base + 3] = m.blendK;

      mutMetaData[base + 0] = FIELD_MUTATION_KIND_CODES[m.kind] ?? 1;
      mutMetaData[base + 1] = MATERIAL_IDS[m.material] ?? 0;
      mutMetaData[base + 2] = m.spawnTime;
      mutMetaData[base + 3] = m.ttl;
    }
    gl.uniform1i(locations.uMutationCount, mutCount);
    gl.uniform4fv(locations.uMutationsPosA, mutPosAData);
    gl.uniform4fv(locations.uMutationsPosB, mutPosBData);
    gl.uniform4fv(locations.uMutationsMeta, mutMetaData);

    // Upload Non-Euclidean SDF Portal Pairs (MAX_PORTAL_PAIRS = 2)
    const portals = frame.portals ?? course.portals ?? [];
    const portalCount = Math.min(portals.length, MAX_PORTAL_PAIRS);
    portalPosAData.fill(0);
    portalNormalAData.fill(0);
    portalUpAData.fill(0);
    portalPosBData.fill(0);
    portalNormalBData.fill(0);
    portalUpBData.fill(0);
    for (let i = 0; i < portalCount; i++) {
      const p = portals[i];
      const base = i * 4;
      portalPosAData[base + 0] = p.posA[0];
      portalPosAData[base + 1] = p.posA[1];
      portalPosAData[base + 2] = p.posA[2];
      portalPosAData[base + 3] = p.radius;

      portalNormalAData[base + 0] = p.normalA[0];
      portalNormalAData[base + 1] = p.normalA[1];
      portalNormalAData[base + 2] = p.normalA[2];
      portalNormalAData[base + 3] = (p.activeA ?? true) ? 1.0 : 0.0;

      portalUpAData[base + 0] = p.upA[0];
      portalUpAData[base + 1] = p.upA[1];
      portalUpAData[base + 2] = p.upA[2];
      portalUpAData[base + 3] = p.flingBoost ?? 1.0;

      portalPosBData[base + 0] = p.posB[0];
      portalPosBData[base + 1] = p.posB[1];
      portalPosBData[base + 2] = p.posB[2];
      portalPosBData[base + 3] = p.radius;

      portalNormalBData[base + 0] = p.normalB[0];
      portalNormalBData[base + 1] = p.normalB[1];
      portalNormalBData[base + 2] = p.normalB[2];
      portalNormalBData[base + 3] = (p.activeB ?? true) ? 1.0 : 0.0;

      portalUpBData[base + 0] = p.upB[0];
      portalUpBData[base + 1] = p.upB[1];
      portalUpBData[base + 2] = p.upB[2];
      portalUpBData[base + 3] = 0.0;
    }
    gl.uniform1i(locations.uPortalPairCount, portalCount);
    gl.uniform4fv(locations.uPortalPosA, portalPosAData);
    gl.uniform4fv(locations.uPortalNormalA, portalNormalAData);
    gl.uniform4fv(locations.uPortalUpA, portalUpAData);
    gl.uniform4fv(locations.uPortalPosB, portalPosBData);
    gl.uniform4fv(locations.uPortalNormalB, portalNormalBData);
    gl.uniform4fv(locations.uPortalUpB, portalUpBData);

    const aim = frame.portalAimPreview;
    if (aim && aim.active) {
      gl.uniform4f(
        locations.uPortalAimPos,
        aim.position[0],
        aim.position[1],
        aim.position[2],
        aim.radius,
      );
      gl.uniform4f(
        locations.uPortalAimNormal,
        aim.normal[0],
        aim.normal[1],
        aim.normal[2],
        aim.end === 'blue' ? 2.0 : 1.0,
      );
    } else {
      gl.uniform4f(locations.uPortalAimPos, 0, -100, 0, 0);
      gl.uniform4f(locations.uPortalAimNormal, 0, 1, 0, 0);
    }

    const gridTiles = frame.gridTiles;
    if (gridTiles && gridTiles.length > 0) {
      gl.enable(gl.SCISSOR_TEST);
      for (const tile of gridTiles) {
        const vx = Math.max(0, Math.floor(tile.viewport.x));
        const vy = Math.max(0, Math.floor(tile.viewport.y));
        const vw = Math.max(1, Math.floor(tile.viewport.width));
        const vh = Math.max(1, Math.floor(tile.viewport.height));

        gl.viewport(vx, vy, vw, vh);
        gl.scissor(vx, vy, vw, vh);

        const tileCam = tile.camera;
        const tileMarble = tile.marble;
        const tilePreset =
          MARBLE_VISUAL_PRESETS[tileMarble.marblePresetIndex % MARBLE_VISUAL_PRESETS.length] ??
          MARBLE_VISUAL_PRESETS[0];
        const tileTanHalfFov = Math.tan((tileCam.fovDeg * Math.PI) / 360);

        gl.uniform2f(locations.uResolution, vw, vh);
        gl.uniform3f(locations.uCameraPos, tileCam.position[0], tileCam.position[1], tileCam.position[2]);
        gl.uniform3f(locations.uCameraForward, tileCam.forward[0], tileCam.forward[1], tileCam.forward[2]);
        gl.uniform3f(locations.uCameraRight, tileCam.right[0], tileCam.right[1], tileCam.right[2]);
        gl.uniform3f(locations.uCameraUp, tileCam.up[0], tileCam.up[1], tileCam.up[2]);
        gl.uniform1f(locations.uCameraTanHalfFov, tileTanHalfFov);
        gl.uniform1f(locations.uOcclusionStrength, tileCam.occlusionCutoutStrength);

        gl.uniform3f(
          locations.uMarblePos,
          tile.renderPosition[0],
          tile.renderPosition[1],
          tile.renderPosition[2],
        );
        gl.uniform4f(
          locations.uMarbleQuat,
          tile.renderOrientation[0],
          tile.renderOrientation[1],
          tile.renderOrientation[2],
          tile.renderOrientation[3],
        );
        gl.uniform1f(locations.uMarbleRadius, tileMarble.radius);
        gl.uniform1i(locations.uMarbleStatus, STATUS_TO_INT[tileMarble.status] ?? 0);
        gl.uniform1f(locations.uMarbleStatusTimer, tileMarble.statusTimer);

        const tBaseCol = tile.marbleColor ?? tilePreset.baseColor;
        const tVeinCol = tile.marbleColor
          ? [
              Math.min(1, tBaseCol[0] * 0.55 + 0.45),
              Math.min(1, tBaseCol[1] * 0.55 + 0.45),
              Math.min(1, tBaseCol[2] * 0.55 + 0.45),
            ]
          : tilePreset.veinColor;
        const tGlowCol = tile.marbleColor ?? tilePreset.coreGlowColor;
        gl.uniform3f(locations.uMarbleBaseColor, tBaseCol[0], tBaseCol[1], tBaseCol[2]);
        gl.uniform3f(locations.uMarbleVeinColor, tVeinCol[0], tVeinCol[1], tVeinCol[2]);
        gl.uniform3f(locations.uMarbleGlowColor, tGlowCol[0], tGlowCol[1], tGlowCol[2]);
        gl.uniform1f(locations.uMarbleIridescence, tilePreset.iridescence);

        const tGhostActive = tile.ghostActive ?? frame.ghostActive ?? false;
        const tGhostPos = tile.ghostPos ?? gPos;
        const tGhostQuat = tile.ghostQuat ?? gQuat;
        const tGhostCol = tile.ghostColor ?? gCol;
        gl.uniform1i(locations.uGhostActive, tGhostActive ? 1 : 0);
        gl.uniform3f(locations.uGhostPos, tGhostPos[0], tGhostPos[1], tGhostPos[2]);
        gl.uniform4f(locations.uGhostQuat, tGhostQuat[0], tGhostQuat[1], tGhostQuat[2], tGhostQuat[3]);
        gl.uniform3f(locations.uGhostColor, tGhostCol[0], tGhostCol[1], tGhostCol[2]);

        uploadOtherMarbles(tile.otherMarbles ?? frame.otherMarbles);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.disable(gl.SCISSOR_TEST);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    if (timerExt && activeQuery) {
      gl.endQuery(timerExt.TIME_ELAPSED_EXT);
      pendingQueries.push(activeQuery);
    } else if (typeof performance !== 'undefined') {
      const cpuDrawElapsed = Math.max(0.05, performance.now() - cpuPassStartMs);
      gpuPassMs = gpuPassMs * 0.85 + cpuDrawElapsed * 0.15;
    }
  }

  let offscreenCanvas: HTMLCanvasElement | null = null;

  function renderCpuFallback(targetCanvas: HTMLCanvasElement, frame: RenderFrameInput) {
    const ctx2d = targetCanvas.getContext('2d');
    if (!ctx2d) return;
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    const rw = Math.min(320, Math.max(160, Math.floor(w * 0.32)));
    const rh = Math.min(200, Math.max(100, Math.floor(h * 0.32)));

    if (!offscreenCanvas && typeof document !== 'undefined') {
      offscreenCanvas = document.createElement('canvas');
    }
    if (!offscreenCanvas) return;
    if (offscreenCanvas.width !== rw || offscreenCanvas.height !== rh) {
      offscreenCanvas.width = rw;
      offscreenCanvas.height = rh;
    }
    const octx = offscreenCanvas.getContext('2d');
    if (!octx) return;

    const imgData = octx.createImageData(rw, rh);
    const data = imgData.data;
    const { camera, marble, renderPosition, time, course } = frame;
    const theme = course.theme;
    const sunLen = Math.hypot(theme.sunDirection[0], theme.sunDirection[1], theme.sunDirection[2]) || 1;
    const sunDir: readonly [number, number, number] = [
      theme.sunDirection[0] / sunLen,
      theme.sunDirection[1] / sunLen,
      theme.sunDirection[2] / sunLen,
    ];
    const tanHalfFov = Math.tan((camera.fovDeg * Math.PI) / 360);
    const aspect = rw / Math.max(1, rh);
    const preset =
      MARBLE_VISUAL_PRESETS[marble.marblePresetIndex % MARBLE_VISUAL_PRESETS.length] ??
      MARBLE_VISUAL_PRESETS[0];

    let ptr = 0;
    for (let py = 0; py < rh; py++) {
      const ndcY = 1.0 - ((py + 0.5) / rh) * 2.0;
      for (let px = 0; px < rw; px++) {
        const ndcX = (((px + 0.5) / rw) * 2.0 - 1.0) * aspect;
        let rdx =
          camera.forward[0] +
          camera.right[0] * ndcX * tanHalfFov +
          camera.up[0] * ndcY * tanHalfFov;
        let rdy =
          camera.forward[1] +
          camera.right[1] * ndcX * tanHalfFov +
          camera.up[1] * ndcY * tanHalfFov;
        let rdz =
          camera.forward[2] +
          camera.right[2] * ndcX * tanHalfFov +
          camera.up[2] * ndcY * tanHalfFov;
        const invLen = 1.0 / Math.hypot(rdx, rdy, rdz);
        rdx *= invLen;
        rdy *= invLen;
        rdz *= invLen;

        // Analytic ray-sphere test for the player marble
        const ocX = camera.position[0] - renderPosition[0];
        const ocY = camera.position[1] - renderPosition[1];
        const ocZ = camera.position[2] - renderPosition[2];
        const b = ocX * rdx + ocY * rdy + ocZ * rdz;
        const c = ocX * ocX + ocY * ocY + ocZ * ocZ - marble.radius * marble.radius;
        const disc = b * b - c;
        const marbleT = disc > 0 ? -b - Math.sqrt(disc) : -1;

        // Raymarch course SDF
        let t = 0.2;
        let hit = false;
        let mat: string = 'standard';
        for (let step = 0; step < 44; step++) {
          const sx = camera.position[0] + rdx * t;
          const sy = camera.position[1] + rdy * t;
          const sz = camera.position[2] + rdz * t;
          const s = fallbackEvaluator.sample([sx, sy, sz], time);
          if (s.distance < 0.035) {
            hit = true;
            mat = s.material;
            break;
          }
          t += Math.max(0.05, s.distance * 0.92);
          if (t > 85.0) break;
        }

        let r = 0;
        let g = 0;
        let bCol = 0;

        if (marbleT > 0.1 && (!hit || marbleT < t)) {
          const hx = camera.position[0] + rdx * marbleT;
          const hy = camera.position[1] + rdy * marbleT;
          const hz = camera.position[2] + rdz * marbleT;
          const nx = (hx - renderPosition[0]) / marble.radius;
          const ny = (hy - renderPosition[1]) / marble.radius;
          const nz = (hz - renderPosition[2]) / marble.radius;
          const diff = Math.max(0.18, nx * sunDir[0] + ny * sunDir[1] + nz * sunDir[2]);
          const fres = Math.pow(1.0 - Math.max(0, -(nx * rdx + ny * rdy + nz * rdz)), 2.5);
          r = preset.baseColor[0] * diff + preset.coreGlowColor[0] * fres * 0.75 + 0.22 * Math.pow(diff, 6);
          g = preset.baseColor[1] * diff + preset.coreGlowColor[1] * fres * 0.75 + 0.22 * Math.pow(diff, 6);
          bCol = preset.baseColor[2] * diff + preset.coreGlowColor[2] * fres * 0.75 + 0.22 * Math.pow(diff, 6);
        } else if (hit) {
          const hx = camera.position[0] + rdx * t;
          const hy = camera.position[1] + rdy * t;
          const hz = camera.position[2] + rdz * t;
          const n = fallbackEvaluator.normal([hx, hy, hz], time);
          const diff = Math.max(0.22, n[0] * sunDir[0] + n[1] * sunDir[1] + n[2] * sunDir[2]);

          let baseR = theme.trackPrimary[0];
          let baseG = theme.trackPrimary[1];
          let baseB = theme.trackPrimary[2];
          const checker = (Math.floor(hx * 0.85) + Math.floor(hz * 0.85)) & 1;
          if (checker) {
            baseR = theme.trackSecondary[0];
            baseG = theme.trackSecondary[1];
            baseB = theme.trackSecondary[2];
          }
          if (mat === 'conveyor') {
            const stripe = Math.sin(hz * 3.5 + time * 8.0) > 0 ? 1.25 : 0.85;
            baseR = Math.min(1, baseR * 0.6 + 0.12 * stripe);
            baseG = Math.min(1, baseG * 0.8 + 0.48 * stripe);
            baseB = Math.min(1, baseB * 0.9 + 0.56 * stripe);
          } else if (mat === 'bounce') {
            baseR = 0.98;
            baseG = 0.32;
            baseB = 0.76;
          } else if (mat === 'bumper') {
            baseR = 1.0;
            baseG = 0.26;
            baseB = 0.22;
          } else if (mat === 'sticky') {
            baseR = 0.92;
            baseG = 0.66;
            baseB = 0.16;
          } else if (mat === 'goal') {
            baseR = checker ? 0.98 : 0.15;
            baseG = checker ? 0.86 : 0.95;
            baseB = checker ? 0.22 : 0.58;
          } else if (mat === 'start') {
            baseR = 0.22;
            baseG = 0.88;
            baseB = 0.62;
          }

          const gx = Math.abs(hx - Math.round(hx));
          const gz = Math.abs(hz - Math.round(hz));
          const gridMask = gx < 0.045 || gz < 0.045 ? 0.45 : 0.0;

          r = baseR * diff * (1 - gridMask) + theme.gridLineColor[0] * gridMask;
          g = baseG * diff * (1 - gridMask) + theme.gridLineColor[1] * gridMask;
          bCol = baseB * diff * (1 - gridMask) + theme.gridLineColor[2] * gridMask;

          const fog = Math.min(0.78, t / 75.0);
          r = r * (1 - fog) + theme.abyssFogColor[0] * fog;
          g = g * (1 - fog) + theme.abyssFogColor[1] * fog;
          bCol = bCol * (1 - fog) + theme.abyssFogColor[2] * fog;
        } else {
          const skyT = Math.max(0, Math.min(1, rdy * 0.65 + 0.35));
          r = theme.skyHorizon[0] * (1 - skyT) + theme.skyZenith[0] * skyT;
          g = theme.skyHorizon[1] * (1 - skyT) + theme.skyZenith[1] * skyT;
          bCol = theme.skyHorizon[2] * (1 - skyT) + theme.skyZenith[2] * skyT;
        }

        data[ptr++] = Math.min(255, Math.max(0, Math.round(Math.pow(r, 0.85) * 255)));
        data[ptr++] = Math.min(255, Math.max(0, Math.round(Math.pow(g, 0.85) * 255)));
        data[ptr++] = Math.min(255, Math.max(0, Math.round(Math.pow(bCol, 0.85) * 255)));
        data[ptr++] = 255;
      }
    }

    octx.putImageData(imgData, 0, 0);
    ctx2d.imageSmoothingEnabled = true;
    ctx2d.drawImage(offscreenCanvas, 0, 0, w, h);
  }

  function getCompiledShaders() {
    return {
      glsl: currentGlsl,
      wgsl: currentWgsl,
      backend: gl ? 'webgl2-lockstep-wgsl' : 'cpu-fallback',
    };
  }

  function getProfilerMetrics(): RendererProfilerMetrics {
    const safeEma = Math.max(1.0, emaFrameMs);
    return {
      fps: Number((1000.0 / safeEma).toFixed(1)),
      frameTimeMs: Number(lastFrameTimeMs.toFixed(2)),
      emaFrameMs: Number(emaFrameMs.toFixed(2)),
      gpuPassMs: Number(gpuPassMs.toFixed(2)),
      gpuTimerQueryAvailable: Boolean(timerExt),
      initialDprCap: INITIAL_DPR_CAP,
      adaptiveScale: Number(adaptiveScale.toFixed(3)),
      effectiveDpr: Number(effectiveDpr.toFixed(3)),
      renderResolution: [canvas.width || 1, canvas.height || 1],
    };
  }

  function setAdaptiveScale(scale: number) {
    adaptiveScale = Math.max(MIN_ADAPTIVE_SCALE, Math.min(MAX_ADAPTIVE_SCALE, scale));
    const baseDpr = Math.min(window.devicePixelRatio || 1, INITIAL_DPR_CAP);
    effectiveDpr = Math.max(0.65, Number((baseDpr * adaptiveScale).toFixed(3)));
  }

  function dispose() {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    if (!gl) return;
    while (pendingQueries.length > 0) {
      const q = pendingQueries.shift();
      if (q) gl.deleteQuery(q);
    }
    if (program) gl.deleteProgram(program);
    if (vao) gl.deleteVertexArray(vao);
  }

  return {
    setCourse,
    render,
    getCompiledShaders,
    getProfilerMetrics,
    setAdaptiveScale,
    dispose,
  };
}
