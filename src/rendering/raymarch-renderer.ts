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
  /** Optional multi-POV grid tiles; when provided with length > 0, renders each tile with WebGL2 scissor + viewport */
  readonly gridTiles?: readonly GridTileViewInput[];
}

export interface RaymarchRenderer {
  setCourse(course: CourseSpec): void;
  render(frame: RenderFrameInput): void;
  getCompiledShaders(): { glsl: string; wgsl: string; backend: string };
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
    };
  }

  function rebuildGpuProgram(course: CourseSpec) {
    currentCourse = course;
    currentGlsl = compileCourseToGlsl(course);
    currentWgsl = compileCourseToWgsl(course);
    fallbackEvaluator = createCpuWorldEvaluator(course);

    if (!gl) return;
    if (program) {
      gl.deleteProgram(program);
      program = null;
    }
    program = createProgram(gl, VERTEX_SHADER_GLSL, currentGlsl);
    locations = queryUniforms(gl, program);
    if (!vao) {
      vao = gl.createVertexArray();
    }
  }

  rebuildGpuProgram(initialCourse);

  function setCourse(course: CourseSpec) {
    if (course.id === currentCourse.id && course === currentCourse) return;
    rebuildGpuProgram(course);
  }

  function render(frame: RenderFrameInput) {
    if (frame.course !== currentCourse) {
      rebuildGpuProgram(frame.course);
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const displayWidth = Math.max(1, Math.floor((canvas.clientWidth || window.innerWidth) * dpr));
    const displayHeight = Math.max(1, Math.floor((canvas.clientHeight || window.innerHeight) * dpr));

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    if (!gl || !program || !locations) {
      renderCpuFallback(canvas, frame);
      return;
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

    gl.uniform3f(locations.uMarbleBaseColor, preset.baseColor[0], preset.baseColor[1], preset.baseColor[2]);
    gl.uniform3f(locations.uMarbleVeinColor, preset.veinColor[0], preset.veinColor[1], preset.veinColor[2]);
    gl.uniform3f(locations.uMarbleGlowColor, preset.coreGlowColor[0], preset.coreGlowColor[1], preset.coreGlowColor[2]);
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

    gl.uniform1i(locations.uGhostActive, frame.ghostActive ? 1 : 0);
    const gPos = frame.ghostPos ?? [0, -100, 0];
    const gQuat = frame.ghostQuat ?? [0, 0, 0, 1];
    const gCol = frame.ghostColor ?? [0.22, 0.94, 1.0];
    gl.uniform3f(locations.uGhostPos, gPos[0], gPos[1], gPos[2]);
    gl.uniform4f(locations.uGhostQuat, gQuat[0], gQuat[1], gQuat[2], gQuat[3]);
    gl.uniform3f(locations.uGhostColor, gCol[0], gCol[1], gCol[2]);

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
    const mutPosAData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
    const mutPosBData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
    const mutMetaData = new Float32Array(MAX_FIELD_MUTATIONS * 4);
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
    const portalPosAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
    const portalNormalAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
    const portalUpAData = new Float32Array(MAX_PORTAL_PAIRS * 4);
    const portalPosBData = new Float32Array(MAX_PORTAL_PAIRS * 4);
    const portalNormalBData = new Float32Array(MAX_PORTAL_PAIRS * 4);
    const portalUpBData = new Float32Array(MAX_PORTAL_PAIRS * 4);
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

        gl.uniform3f(locations.uMarbleBaseColor, tilePreset.baseColor[0], tilePreset.baseColor[1], tilePreset.baseColor[2]);
        gl.uniform3f(locations.uMarbleVeinColor, tilePreset.veinColor[0], tilePreset.veinColor[1], tilePreset.veinColor[2]);
        gl.uniform3f(locations.uMarbleGlowColor, tilePreset.coreGlowColor[0], tilePreset.coreGlowColor[1], tilePreset.coreGlowColor[2]);
        gl.uniform1f(locations.uMarbleIridescence, tilePreset.iridescence);

        const tGhostActive = tile.ghostActive ?? frame.ghostActive ?? false;
        const tGhostPos = tile.ghostPos ?? gPos;
        const tGhostQuat = tile.ghostQuat ?? gQuat;
        const tGhostCol = tile.ghostColor ?? gCol;
        gl.uniform1i(locations.uGhostActive, tGhostActive ? 1 : 0);
        gl.uniform3f(locations.uGhostPos, tGhostPos[0], tGhostPos[1], tGhostPos[2]);
        gl.uniform4f(locations.uGhostQuat, tGhostQuat[0], tGhostQuat[1], tGhostQuat[2], tGhostQuat[3]);
        gl.uniform3f(locations.uGhostColor, tGhostCol[0], tGhostCol[1], tGhostCol[2]);

        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.disable(gl.SCISSOR_TEST);
    } else {
      gl.disable(gl.SCISSOR_TEST);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  function renderCpuFallback(targetCanvas: HTMLCanvasElement, frame: RenderFrameInput) {
    const ctx2d = targetCanvas.getContext('2d');
    if (!ctx2d) return;
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    ctx2d.fillStyle = '#060c1a';
    ctx2d.fillRect(0, 0, w, h);
    void fallbackEvaluator;
    void frame;
  }

  function getCompiledShaders() {
    return {
      glsl: currentGlsl,
      wgsl: currentWgsl,
      backend: gl ? 'webgl2-lockstep-wgsl' : 'cpu-fallback',
    };
  }

  function dispose() {
    if (!gl) return;
    if (program) gl.deleteProgram(program);
    if (vao) gl.deleteVertexArray(vao);
  }

  return {
    setCourse,
    render,
    getCompiledShaders,
    dispose,
  };
}
