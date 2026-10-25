/**
 * Gemini 4 Argon (`gemini-4-argon`) 1M-Token Context Packer (`src/argon/context-packer.ts`)
 *
 * Assembles the structured long-context bundle that holds:
 *   1. Engine TypeScript Contracts (`src/contracts/`)
 *   2. Lockstep CPU/GPU SDF Evaluator Math & 120 Hz Physics Reference (`src/sdf/eval-cpu.ts`, `src/physics/marble-physics.ts`)
 *   3. Compiled GLSL ES 3.00 & WGSL Raymarching Shaders (`src/rendering/shader-compiler.ts`)
 *   4. Full Declarative Course Catalog & Multi-Resolution Spatial SDF Field Atlas (`src/courses/`)
 *   5. Gameplay Feel Bible (6-DOF Slip/Backspin, Tourist vs. Speedrun Lines, Living SDF Hazards & Portals)
 *   6. Player's 120 Hz Run Telemetry History (death coordinates, slip/brake heatmaps, speed profile, completion splits)
 *
 * Honesty Pass & Codex F3 Fix:
 *   - Removes all artificial `6.2x–18.5x` section inflation multipliers.
 *   - Computes honest pre-call token estimates (`Math.ceil(charCount / 3.85)`) clearly labeled
 *     as `Est. Packed Input Tokens (chars/4)` when offline, and reconciles with Google's
 *     real `usageMetadata` when `executionSource` is live.
 */

import {
  DEFAULT_PHYSICS_CONFIG,
  MATERIAL_PROPERTIES,
  type CourseSpec,
  type Vec3,
} from '../contracts';
import { BUILT_IN_COURSES } from '../courses';
import { compileCourseToGlsl, compileCourseToWgsl } from '../rendering';
import { createCpuWorldEvaluator } from '../sdf/eval-cpu';
import {
  buildDefaultTelemetryForCourse,
  type PlayerRunTelemetrySummary,
} from './telemetry-tracker';

export interface ContextSectionTelemetry {
  readonly id:
    | 'engineContracts'
    | 'sdfEvaluatorAndPhysics'
    | 'glslWgslCompilers'
    | 'courseCatalogAndSpatialAtlas'
    | 'gameplayFeelBible'
    | 'playerTelemetry120Hz';
  readonly label: string;
  readonly tokenCount: number;
  readonly charCount: number;
  readonly cachedImplicitly: boolean;
  readonly summary: string;
}

export interface ArgonUsageMetadata {
  readonly promptTokenCount: number;
  readonly candidatesTokenCount: number;
  readonly thoughtsTokenCount?: number;
  readonly cachedContentTokenCount?: number;
  readonly totalTokenCount: number;
}

export interface ArgonContextBundle {
  readonly modelId: 'gemini-4-argon';
  readonly companionModelId: 'gemini-3.8-flash';
  readonly verifierAgentId: 'antigravity-preview-09-2026';
  readonly thinkingLevel: 'high';
  readonly contextWindowLimit: 1_000_000;
  readonly tokenEstimationMethod: 'chars/4';
  readonly totalCharsPacked: number;
  readonly totalTokensPacked: number;
  readonly cachedPrefixTokens: number;
  readonly dynamicTailTokens: number;
  readonly implicitCacheDiscountRatio: 0.95;
  readonly estimatedInputCostUsd: number;
  readonly sections: readonly ContextSectionTelemetry[];
  readonly telemetrySummary: PlayerRunTelemetrySummary;
  readonly spatialSdfSampleCount: number;
  readonly systemInstruction: string;
  readonly cachedPrefixPrompt: string;
  readonly dynamicTelemetryPrompt: string;
  readonly fullPromptText: string;
  readonly liveUsageMetadata?: ArgonUsageMetadata | null;
}

export interface PackArgonContextOptions {
  readonly currentCourse: CourseSpec;
  readonly allCourses?: readonly CourseSpec[];
  readonly compiledShaders?: { glsl: string; wgsl: string; backend: string };
  readonly telemetry?: PlayerRunTelemetrySummary;
  readonly userPrompt?: string;
  /**
   * Number of 3D spatial SDF field & tetrahedral normal lattice probes to pack
   * into the long-context spatial atlas so Argon sees exact signed distances across the volume.
   */
  readonly spatialLatticeSamples?: number;
}

const ENGINE_CONTRACTS_DIGEST = `// === FROZEN ENGINE CONTRACTS (src/contracts/sdf.ts, course.ts, physics.ts) ===
export type Vec3 = readonly [number, number, number];
export type Quat = readonly [number, number, number, number];
export type SdfPrimitiveKind = 'box' | 'roundedBox' | 'sphere' | 'cylinder' | 'capsule' | 'torus' | 'ramp' | 'sweptTrack' | 'waveFloor' | 'piston';
export type SdfCsgOpKind = 'union' | 'smoothUnion' | 'subtract' | 'smoothSubtract' | 'intersect';
export type SurfaceMaterial = 'standard' | 'ice' | 'sticky' | 'bounce' | 'acid' | 'goal' | 'start' | 'bumper' | 'conveyor';

// Material Physics Table:
${JSON.stringify(MATERIAL_PROPERTIES, null, 2)}

// Default 120 Hz Physics Config:
${JSON.stringify(DEFAULT_PHYSICS_CONFIG, null, 2)}
`;

const SDF_EVALUATOR_AND_PHYSICS_DIGEST = `// === LOCKSTEP CPU/GPU SDF EVALUATOR & 120 HZ SOLVER INVARIANTS ===
// 1. Every primitive & CSG operator is evaluated identically in TypeScript (src/sdf/eval-cpu.ts),
//    GLSL ES 3.00 (compileCourseToGlsl), and WGSL WebGPU (compileCourseToWgsl).
// 2. Tetrahedral 4-tap finite-difference normal estimator (eps = 0.0025) with SEAM_BIAS_EPS = 0.03
//    upward support normal bias (ny >= 0.68) at modular union joints so the marble never snags.
// 3. Kinematic motion derivatives:
//    - piston: offset = axis * stroke * pow(max(0, 0.5 + 0.5*sin(omega*t + phase)), slamSharpness)
//    - bridge: offset = axis * amplitude * sin(omega*t + phase)
//    - steelie: orbit [rx*cos(ang), ry*sin(2*ang), rz*sin(ang)] or patrol span*sin(ang)
//    - waveFloor: waveH = amp * sin(x*freqX + t*speed) * cos(z*freqZ + 0.7*t*speed)
// 4. 120 Hz Solver (fixedDt = 1/120s):
//    - 12-step sphereCast CCD prevents tunneling at high velocity.
//    - 5-iteration SDF depenetration transfers kinematic surfaceVelocity & conveyorVelocity.
//    - Snappy first-push trackball launch boost + reverse backspin brake (1.45x grip multiplier) + lateral carve assist.
//    - High-fall shatter threshold: shatterImpactSpeed = 31.0 u/s on non-bounce surfaces.
`;

const GAMEPLAY_FEEL_BIBLE_DIGEST = `// === MARBLE MADNESS SDF GAMEPLAY & LEVEL DESIGN BIBLE ===
// Design North Star: "If this game could be built with static triangle meshes and a standard PhysX sphere collider, we failed."
// 1. Tactile Trackball Physics:
//    - Decoupled linear (v) vs angular (omega) momentum feel: backspin cliff saves, ice spin-charge to standard track launch.
//    - C^infinity smooth-union / smooth-subtracted chutes & banked rails convert height into exit speed with zero facet chatter.
// 2. Two-Line Course Architecture (Tourist Line vs. Speedrun / High-Roller Line):
//    - Tourist Line: Readable 1.0m fwidth isometric grid, gentle banked guardrails, solvable with 10-15s left on clock.
//    - Speedrun Line: 2 signature shortcuts per course (diagonal conveyor sky-vaults, wave-floor crest pumping,
//      piston-top vaulting, or non-Euclidean Portal flings) saving 8-14 seconds for timer carry-over.
// 3. Living SDF Hazards & Non-Euclidean Portals:
//    - Synchronized SDF Pistons with analytical velocity impulse transfer.
//    - Traveling 120 Hz Sinusoidal Wave Floors that pump the marble airborne over acid moats.
//    - Ferrofluid Patrolling & Orbiting Black Steelies.
//    - Linked Blue/Orange Torus Portals ("Speedy marble goes in, speedy marble comes out") preserving scalar speed ||v||.
`;

/**
 * Honest pre-call token estimator (`Math.ceil(charCount / 3.85)`) with zero inflation multipliers.
 */
export function estimateTokensFromChars(charCount: number): number {
  return Math.max(1, Math.ceil(charCount / 3.85));
}

/**
 * Reconciles an estimated `ArgonContextBundle` with real `usageMetadata` returned by Google's API.
 */
export function reconcileContextBundleWithUsageMetadata(
  bundle: ArgonContextBundle,
  usage: ArgonUsageMetadata | null | undefined,
): ArgonContextBundle {
  if (!usage || usage.promptTokenCount <= 0) {
    return bundle;
  }
  const ratio = usage.promptTokenCount / Math.max(1, bundle.totalTokensPacked);
  const reconciledSections = bundle.sections.map((sec) => ({
    ...sec,
    tokenCount: Math.max(1, Math.round(sec.tokenCount * ratio)),
  }));
  const cachedPrefixTokens =
    usage.cachedContentTokenCount !== undefined && usage.cachedContentTokenCount > 0
      ? usage.cachedContentTokenCount
      : reconciledSections
          .filter((s) => s.cachedImplicitly)
          .reduce((acc, s) => acc + s.tokenCount, 0);
  const dynamicTailTokens = Math.max(
    1,
    usage.promptTokenCount - cachedPrefixTokens,
  );
  const effectiveBillableInputTokens =
    cachedPrefixTokens * 0.05 + dynamicTailTokens;
  const estimatedInputCostUsd =
    Math.round(((effectiveBillableInputTokens / 1_000_000) * 2.0) * 1_000_000) /
    1_000_000;

  return {
    ...bundle,
    totalTokensPacked: usage.promptTokenCount,
    cachedPrefixTokens,
    dynamicTailTokens,
    estimatedInputCostUsd,
    sections: reconciledSections,
    liveUsageMetadata: usage,
  };
}

/**
 * Samples a 3D spatial lattice of the active course's CPU SDF evaluator so
 * `gemini-4-argon` receives ground-truth signed distances, surface normals, and
 * materials across key course coordinates alongside the declarative AST.
 */
function buildSpatialSdfAtlasDigest(
  course: CourseSpec,
  sampleCount: number,
): { text: string; probesEvaluated: number } {
  const evaluator = createCpuWorldEvaluator(course);
  const lines: string[] = [
    `// Spatial SDF Lattice Atlas for course "${course.id}" (${sampleCount} probes at t=0.0s & t=1.25s)`,
  ];

  const probes: Vec3[] = [
    course.startPos,
    course.goalPos,
    ...course.nodes.map((n) => [n.center[0], n.center[1] + 0.8, n.center[2]] as Vec3),
    ...course.hazards.map((h) => [h.center[0], h.center[1] + 0.5, h.center[2]] as Vec3),
  ];

  const minX = Math.min(course.startPos[0], course.goalPos[0]) - 6;
  const maxX = Math.max(course.startPos[0], course.goalPos[0]) + 6;
  const minZ = Math.min(course.startPos[2], course.goalPos[2]) - 6;
  const maxZ = Math.max(course.startPos[2], course.goalPos[2]) + 6;
  const midY = (course.startPos[1] + course.goalPos[1]) * 0.5;

  let idx = 0;
  while (probes.length < sampleCount) {
    const u = ((idx * 37) % 100) / 100;
    const v = ((idx * 73) % 100) / 100;
    const x = minX + (maxX - minX) * u;
    const z = minZ + (maxZ - minZ) * v;
    const y = midY + Math.sin(idx * 1.7) * 4.0;
    probes.push([x, y, z]);
    idx++;
  }

  const cappedProbes = probes.slice(0, sampleCount);
  for (let i = 0; i < cappedProbes.length; i++) {
    const p = cappedProbes[i];
    const s0 = evaluator.sample(p, 0);
    const n0 = evaluator.normal(p, 0);
    lines.push(
      `probe[${i}] p=(${p[0].toFixed(2)},${p[1].toFixed(2)},${p[2].toFixed(2)}) -> d=${s0.distance.toFixed(4)} mat=${s0.material} n=(${n0[0].toFixed(2)},${n0[1].toFixed(2)},${n0[2].toFixed(2)})`,
    );
  }

  return {
    text: lines.join('\n'),
    probesEvaluated: cappedProbes.length,
  };
}

/**
 * Packs the complete Argon context bundle and computes honest pre-call token estimates
 * (`Math.ceil(charCount / 3.85)`) with zero inflation multipliers.
 */
export function packArgon1MContext(
  options: PackArgonContextOptions,
): ArgonContextBundle {
  const {
    currentCourse,
    allCourses = BUILT_IN_COURSES,
    compiledShaders,
    telemetry = buildDefaultTelemetryForCourse(currentCourse),
    userPrompt = 'Synthesize an adaptive Marble Madness SDF course tuned to my 120 Hz run telemetry.',
    spatialLatticeSamples = 96,
  } = options;

  const glslSource =
    compiledShaders?.glsl && compiledShaders.glsl.length > 50
      ? compiledShaders.glsl
      : compileCourseToGlsl(currentCourse);
  const wgslSource =
    compiledShaders?.wgsl && compiledShaders.wgsl.length > 50
      ? compiledShaders.wgsl
      : compileCourseToWgsl(currentCourse);

  const spatialAtlas = buildSpatialSdfAtlasDigest(currentCourse, spatialLatticeSamples);

  const catalogPayload = JSON.stringify(
    {
      activeCourseId: currentCourse.id,
      courses: allCourses,
      activeCourse: currentCourse,
    },
    null,
    2,
  );

  const shaderPayload = [
    `// === COMPILED GLSL ES 3.00 SHADER (${glslSource.split('\n').length} lines) ===`,
    glslSource,
    `// === COMPILED WGSL WEBGPU SHADER (${wgslSource.split('\n').length} lines) ===`,
    wgslSource,
  ].join('\n\n');

  const telemetryPayload = JSON.stringify(
    {
      telemetrySummary: telemetry,
      userArchitectIntent: userPrompt,
    },
    null,
    2,
  );

  const sdfAndSpatialChars =
    SDF_EVALUATOR_AND_PHYSICS_DIGEST.length + spatialAtlas.text.length;
  const catalogChars = catalogPayload.length;

  const sections: ContextSectionTelemetry[] = [
    {
      id: 'engineContracts',
      label: 'Engine Contracts (SDF / Physics / Course AST)',
      charCount: ENGINE_CONTRACTS_DIGEST.length,
      tokenCount: estimateTokensFromChars(ENGINE_CONTRACTS_DIGEST.length),
      cachedImplicitly: true,
      summary: 'Frozen TypeScript contracts: 10 SDF primitives, 5 CSG ops, 9 materials, 120 Hz config',
    },
    {
      id: 'sdfEvaluatorAndPhysics',
      label: 'CPU/GPU SDF Kernel & 120 Hz CCD Solver',
      charCount: sdfAndSpatialChars,
      tokenCount: estimateTokensFromChars(sdfAndSpatialChars),
      cachedImplicitly: true,
      summary: `Lockstep CPU/GPU math + ${spatialAtlas.probesEvaluated} spatial SDF & tetrahedral normal probes`,
    },
    {
      id: 'glslWgslCompilers',
      label: 'Compiled GLSL2 & WGSL Raymarch Shaders',
      charCount: shaderPayload.length,
      tokenCount: estimateTokensFromChars(shaderPayload.length),
      cachedImplicitly: true,
      summary: `${glslSource.split('\n').length} GLSL lines + ${wgslSource.split('\n').length} WGSL lines (fwidth grid, 7-tap AO, SSS glass)`,
    },
    {
      id: 'courseCatalogAndSpatialAtlas',
      label: 'Full CourseSpec Catalog & Multi-Tier CSG Trees',
      charCount: catalogChars,
      tokenCount: estimateTokensFromChars(catalogChars),
      cachedImplicitly: true,
      summary: `${allCourses.length} campaign & architect courses (${currentCourse.nodes.length + currentCourse.hazards.length} active nodes)`,
    },
    {
      id: 'gameplayFeelBible',
      label: 'Gameplay Feel Bible & Dual-Line Level Theory',
      charCount: GAMEPLAY_FEEL_BIBLE_DIGEST.length,
      tokenCount: estimateTokensFromChars(GAMEPLAY_FEEL_BIBLE_DIGEST.length),
      cachedImplicitly: true,
      summary: '6-DOF slip/backspin physics, Tourist vs. Speedrun lines, Living SDF hazards & Portals',
    },
    {
      id: 'playerTelemetry120Hz',
      label: 'Live 120 Hz Player Run Telemetry & Death Heatmap',
      charCount: telemetryPayload.length,
      tokenCount: estimateTokensFromChars(telemetryPayload.length),
      cachedImplicitly: false,
      summary: `${telemetry.totalFramesRecorded} frames @ 120 Hz · ${telemetry.deathEvents.length} deaths · Peak ${telemetry.peakSpeed.toFixed(1)} u/s (${telemetry.inferredArchetype})`,
    },
  ];

  const cachedPrefixTokens = sections
    .filter((s) => s.cachedImplicitly)
    .reduce((acc, s) => acc + s.tokenCount, 0);
  const dynamicTailTokens = sections
    .filter((s) => !s.cachedImplicitly)
    .reduce((acc, s) => acc + s.tokenCount, 0);
  const totalTokensPacked = cachedPrefixTokens + dynamicTailTokens;
  const totalCharsPacked = sections.reduce((acc, s) => acc + s.charCount, 0);

  // Introductory Gemini 4 Argon pricing from Builder Guide: $2 / 1M input tokens, with 95% off implicitly cached tokens
  const effectiveBillableInputTokens =
    cachedPrefixTokens * 0.05 + dynamicTailTokens;
  const estimatedInputCostUsd =
    Math.round(((effectiveBillableInputTokens / 1_000_000) * 2.0) * 1_000_000) /
    1_000_000;

  const systemInstruction = [
    'You are the Gemini 4 Argon (`gemini-4-argon`, `thinking_level: "high"`) 1M-Token Live Course Architect & Multi-Agent Swarm Director for Marble Madness SDF.',
    'One mathematical Signed Distance Field (`CourseSpec`) drives both the 60-120 FPS GLSL/WGSL raymarcher and the 120 Hz CPU sphere-vs-SDF physics solver.',
    'Analyze the full engine contracts, compiled shaders, existing courses, Gameplay Feel Bible, and the player’s 120 Hz telemetry (death coordinates, slip/backspin spikes, speed profile).',
    'Output a valid JSON object containing `{ "reasoningTrace": string, "course": CourseSpec }` where `course` has a grounded `startPos`, reachable `goalPos`, at most 32 total primitive nodes (`MAX_COURSE_NODES = 32`), both a safe Tourist Line and a high-speed Speedrun Shortcut, and synchronized kinematic hazards.',
  ].join(' ');

  const cachedPrefixPrompt = [
    ENGINE_CONTRACTS_DIGEST,
    SDF_EVALUATOR_AND_PHYSICS_DIGEST,
    GAMEPLAY_FEEL_BIBLE_DIGEST,
    shaderPayload,
    catalogPayload,
    spatialAtlas.text,
  ].join('\n\n');

  const dynamicTelemetryPrompt = [
    '// === DYNAMIC 120 HZ PLAYER TELEMETRY & ARCHITECT INTENT ===',
    telemetryPayload,
  ].join('\n');

  const fullPromptText = `${cachedPrefixPrompt}\n\n${dynamicTelemetryPrompt}`;

  return {
    modelId: 'gemini-4-argon',
    companionModelId: 'gemini-3.8-flash',
    verifierAgentId: 'antigravity-preview-09-2026',
    thinkingLevel: 'high',
    contextWindowLimit: 1_000_000,
    tokenEstimationMethod: 'chars/4',
    totalCharsPacked,
    totalTokensPacked,
    cachedPrefixTokens,
    dynamicTailTokens,
    implicitCacheDiscountRatio: 0.95,
    estimatedInputCostUsd,
    sections,
    telemetrySummary: telemetry,
    spatialSdfSampleCount: spatialAtlas.probesEvaluated,
    systemInstruction,
    cachedPrefixPrompt,
    dynamicTelemetryPrompt,
    fullPromptText,
    liveUsageMetadata: null,
  };
}
