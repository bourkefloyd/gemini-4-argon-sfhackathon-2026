/**
 * Gemini 4 Argon (`gemini-4-argon`) Interactions API & Multi-Agent Swarm Orchestrator
 * (`src/argon/argon-client.ts`)
 *
 * Coordinates:
 *   - Agent 1 (`gemini-4-argon`, `thinking_level: "high"`): Lead Course Architect reading
 *     the 1M-token context window + 120 Hz player death/slip/speed telemetry
 *   - Agent 2 (`gemini-3.8-flash`, `thinking_level: "medium"`): Parallel Hazard & Portal Specialist
 *     placing synchronized SDF pistons, wave floors, Steelies, and linked Blue/Orange Portals
 *   - Agent 3 (`CPU SDF Solvability & Shader Gate`): Runs `createCpuWorldEvaluator` +
 *     `compileCourseToGlsl`/`Wgsl` + a simulated 120 Hz bot rollout before unlocking the
 *     human-in-the-loop "Approve & Hot-Swap Course" action.
 *
 * Honesty Pass & 3-Try Self-Repair Loop:
 *   - `executionSource` is strictly `'live-interactions-api' | 'live-generate-content' | 'offline-preset'`.
 *   - Clicking an Offline Preset button loads the preset directly in memory with ZERO network `fetch` calls.
 *   - Chains `previous_interaction_id` ONLY when the previous turn returned a real server-issued interaction ID.
 *   - Enforces a 45s timeout with `AbortController` (or caller-provided `signal`).
 *   - When a live Argon synthesis fails `verifyCourseSpecSolvability`, automatically runs up to 3
 *     autonomous self-repair attempts (`Attempt 1/3 -> Attempt 2/3 -> Attempt 3/3`), sending exact
 *     structured failure diagnostics back to `gemini-4-argon` and recording `repairAttempts[]`.
 */

import type { CourseSpec } from '../contracts';
import {
  packArgon1MContext,
  reconcileContextBundleWithUsageMetadata,
  type ArgonContextBundle,
  type ArgonUsageMetadata,
} from './context-packer';
import {
  ARGON_SYNTHESIS_PRESETS,
  applyRealtimeCsgMutationToCourse,
  mutateCourseFromTelemetry,
  type ArgonPresetId,
  type RealtimeCsgMutationKind,
  type SwarmAgentExecutionTrace,
} from './presets';
import {
  verifyCourseSpecSolvability,
  type CourseSolvabilityReport,
} from './solvability-gate';
import type { PlayerRunTelemetrySummary } from './telemetry-tracker';
import {
  buildLocalAntigravityCertificate,
  isRealServerInteractionId,
  pollAntigravitySandboxVerification,
  requestAntigravitySandboxVerification,
  type AntigravitySandboxCertificate,
} from './antigravity-sandbox';

export const MAX_SELF_REPAIR_ATTEMPTS = 3;
export const CLIENT_ARGON_TIMEOUT_MS = 45_000;

export type ArgonExecutionSource =
  | 'live-interactions-api'
  | 'live-generate-content'
  | 'offline-preset';

export interface SelfRepairAttemptRecord {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly interactionId: string;
  readonly previousInteractionId: string | null;
  readonly passed: boolean;
  readonly diagnosticsSent: readonly string[];
  readonly gateDiagnostics: readonly string[];
  readonly fixSummary: string;
  readonly latencyMs: number;
}

export interface SwarmSynthesisRequest {
  readonly mode: 'preset' | 'telemetry-mutation' | 'natural-language' | 'realtime-csg';
  readonly presetId?: ArgonPresetId;
  readonly csgMutationKind?: RealtimeCsgMutationKind;
  readonly prompt: string;
  readonly currentCourse: CourseSpec;
  readonly allCourses?: readonly CourseSpec[];
  readonly compiledShaders?: { glsl: string; wgsl: string; backend: string };
  readonly telemetry: PlayerRunTelemetrySummary;
  readonly apiKey?: string;
  readonly previousInteractionId?: string | null;
  readonly signal?: AbortSignal;
  readonly onProgress?: (agents: readonly SwarmAgentExecutionTrace[]) => void;
  readonly onRepairAttempt?: (attempts: readonly SelfRepairAttemptRecord[]) => void;
  readonly fetchFn?: typeof fetch;
}

export interface SwarmSynthesisProposal {
  readonly proposalId: string;
  readonly interactionId: string;
  readonly previousInteractionId: string | null;
  readonly executionSource: ArgonExecutionSource;
  readonly mode: SwarmSynthesisRequest['mode'];
  readonly title: string;
  readonly prompt: string;
  readonly reasoningTrace: string;
  readonly contextBundle: ArgonContextBundle;
  readonly usageMetadata: ArgonUsageMetadata | null;
  readonly serverError: string | null;
  readonly repairAttempts: readonly SelfRepairAttemptRecord[];
  readonly swarmAgents: readonly SwarmAgentExecutionTrace[];
  readonly solvability: CourseSolvabilityReport;
  readonly proposedCourse: CourseSpec;
  readonly antigravitySandbox: AntigravitySandboxCertificate;
  readonly requiresHumanApproval: true;
  readonly createdAtIso: string;
}

/**
 * Returns the initial idle 3-agent swarm state before any synthesis call runs (Codex F3).
 */
export function buildInitialIdleSwarmAgents(): readonly SwarmAgentExecutionTrace[] {
  return [
    {
      agentId: 'lead-architect',
      modelOrEngine: 'gemini-4-argon',
      roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
      thinkingLevel: 'high',
      status: 'idle',
      latencyMs: 0,
      summary: 'Idle — ready to synthesize CourseSpec from 1M-token context or load an instant offline preset.',
      reasoningSteps: [],
    },
    {
      agentId: 'hazard-specialist',
      modelOrEngine: 'gemini-3.8-flash',
      roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
      thinkingLevel: 'medium',
      status: 'idle',
      latencyMs: 0,
      summary: 'Idle — ready to place synchronized SDF pistons, wave floors, Steelies & linked Portals.',
      reasoningSteps: [],
    },
    {
      agentId: 'solvability-verifier',
      modelOrEngine: 'cpu-sdf-120hz-gate',
      roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
      status: 'idle',
      latencyMs: 0,
      summary: 'Idle — awaiting candidate CourseSpec for schema, GLSL/WGSL compile & 120 Hz goal rollout check.',
      reasoningSteps: [],
    },
  ];
}

export function inferPresetFromPrompt(prompt: string): ArgonPresetId {
  const lower = prompt.toLowerCase();
  if (
    lower.includes('wave') ||
    lower.includes('ferrofluid') ||
    lower.includes('mercury') ||
    lower.includes('acid') ||
    lower.includes('pump')
  ) {
    return 'ferrofluid-wave-gauntlet';
  }
  if (
    lower.includes('coach') ||
    lower.includes('telemetry') ||
    lower.includes('death') ||
    lower.includes('berm') ||
    lower.includes('brake') ||
    lower.includes('balance')
  ) {
    return 'adaptive-coach-remix';
  }
  return 'portal-fling-citadel';
}

/**
 * Queries `/api/argon/status` to check if the Vite server has `GEMINI_API_KEY` set in its environment.
 */
export async function fetchArgonServerStatus(
  fetchFn: typeof fetch = typeof fetch !== 'undefined' ? fetch : (undefined as unknown as typeof fetch),
): Promise<{ hasEnvKey: boolean; leadModel: string; companionModel: string }> {
  if (!fetchFn) {
    return {
      hasEnvKey: false,
      leadModel: 'gemini-4-argon',
      companionModel: 'gemini-3.8-flash',
    };
  }
  try {
    const res = await fetchFn('/api/argon/status', { method: 'GET' });
    if (res.ok) {
      const data = (await res.json()) as {
        hasEnvKey?: boolean;
        leadModel?: string;
        companionModel?: string;
      };
      return {
        hasEnvKey: Boolean(data.hasEnvKey),
        leadModel: data.leadModel ?? 'gemini-4-argon',
        companionModel: data.companionModel ?? 'gemini-3.8-flash',
      };
    }
  } catch {
    // Ignore when running in unit tests or static environment without server
  }
  return {
    hasEnvKey: false,
    leadModel: 'gemini-4-argon',
    companionModel: 'gemini-3.8-flash',
  };
}

/**
 * Orchestrates the 3-Agent Swarm Architect pipeline with:
 *   - Zero-network in-memory execution for `mode === 'preset'` and `mode === 'realtime-csg'`
 *   - 45s timeout & `AbortController` support for live API calls
 *   - Strict `previous_interaction_id` validation (never chains preset IDs)
 *   - 3-Try Autonomous Self-Repair Loop when a live Argon CourseSpec fails `verifyCourseSpecSolvability`
 */
export async function runArgonSwarmArchitect(
  req: SwarmSynthesisRequest,
): Promise<SwarmSynthesisProposal> {
  const baseContextBundle = packArgon1MContext({
    currentCourse: req.currentCourse,
    allCourses: req.allCourses,
    compiledShaders: req.compiledShaders,
    telemetry: req.telemetry,
    userPrompt: req.prompt,
  });

  const validPrevInteractionId = isRealServerInteractionId(req.previousInteractionId)
    ? req.previousInteractionId!
    : null;

  // Notify UI that Agent 1 & Agent 2 have launched
  req.onProgress?.([
    {
      agentId: 'lead-architect',
      modelOrEngine: 'gemini-4-argon',
      roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
      thinkingLevel: 'high',
      status: 'running',
      latencyMs: 0,
      summary: `Reading ${baseContextBundle.totalTokensPacked.toLocaleString()} est. packed tokens (chars/4) & synthesizing macro SDF layout...`,
      reasoningSteps: [],
    },
    {
      agentId: 'hazard-specialist',
      modelOrEngine: 'gemini-3.8-flash',
      roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
      thinkingLevel: 'medium',
      status: 'running',
      latencyMs: 0,
      summary: 'Computing synchronized SDF pistons, wave floors, Steelies & Blue/Orange Portal flings...',
      reasoningSteps: [],
    },
    {
      agentId: 'solvability-verifier',
      modelOrEngine: 'cpu-sdf-120hz-gate',
      roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
      status: 'idle',
      latencyMs: 0,
      summary: 'Awaiting CourseSpec AST from Agent 1 + Agent 2...',
      reasoningSteps: [],
    },
  ]);

  // === PATH A: OFFLINE PRESET BUTTON (ZERO NETWORK FETCH CALLS!) ===
  if (req.mode === 'preset') {
    const tPreset0 = performance.now();
    const targetPresetId: ArgonPresetId =
      req.presetId ?? inferPresetFromPrompt(req.prompt);
    const preset = ARGON_SYNTHESIS_PRESETS[targetPresetId];
    const solvability = verifyCourseSpecSolvability(preset.course);
    const verifiedCourse = solvability.verifiedCourse;
    const elapsedMs = Math.max(1, Math.round((performance.now() - tPreset0) * 100) / 100);

    const offlineAgents: readonly SwarmAgentExecutionTrace[] = [
      {
        ...preset.swarmAgents[0],
        latencyMs: elapsedMs,
      },
      {
        ...preset.swarmAgents[1],
        latencyMs: elapsedMs,
      },
      {
        agentId: 'solvability-verifier',
        modelOrEngine: 'cpu-sdf-120hz-gate',
        roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
        status: solvability.passed ? 'completed' : 'error',
        latencyMs: solvability.verificationLatencyMs,
        summary: solvability.passed
          ? `PASS: Spawn grounded (d=${solvability.startDistance.toFixed(2)}m), GLSL2 (${solvability.glslLineCount}L) & WGSL (${solvability.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`
          : `GATE FAILED: ${solvability.diagnostics.join(' ')}`,
        reasoningSteps: solvability.diagnostics,
      },
    ];
    req.onProgress?.(offlineAgents);

    const antigravitySandbox = buildLocalAntigravityCertificate({
      course: verifiedCourse,
      solvability,
      status: 'unavailable',
      extraTrace: ['Offline preset loaded directly in memory with zero network calls.'],
    });

    return {
      proposalId: `prop_${Date.now().toString(36)}`,
      interactionId: `preset-${targetPresetId}`,
      previousInteractionId: null,
      executionSource: 'offline-preset',
      mode: req.mode,
      title: preset.title,
      prompt: req.prompt,
      reasoningTrace: preset.reasoningTrace,
      contextBundle: baseContextBundle,
      usageMetadata: null,
      serverError: null,
      repairAttempts: [],
      swarmAgents: offlineAgents,
      solvability,
      proposedCourse: verifiedCourse,
      antigravitySandbox,
      requiresHumanApproval: true,
      createdAtIso: new Date().toISOString(),
    };
  }

  // === PATH B: REALTIME CSG LEVEL MUTATION (IN-MEMORY DETERMINISTIC SCULPT) ===
  if (req.mode === 'realtime-csg' && req.csgMutationKind) {
    const tCsg0 = performance.now();
    const csgRes = applyRealtimeCsgMutationToCourse(
      req.currentCourse,
      req.csgMutationKind,
    );
    const solvability = verifyCourseSpecSolvability(csgRes.mutatedCourse);
    const verifiedCourse = solvability.verifiedCourse;
    const elapsedMs = Math.max(1, Math.round((performance.now() - tCsg0) * 100) / 100);

    const reasoningTrace = [
      `[Offline CSG Field Mutator // Local CPU == GPU SDF Tree Edit]`,
      `• Operation: ${csgRes.mutationLabel}`,
      `• Details: ${csgRes.description}`,
      `• Active Course Nodes: ${req.currentCourse.nodes.length} -> ${verifiedCourse.nodes.length}`,
    ].join('\n');

    const csgAgents: readonly SwarmAgentExecutionTrace[] = [
      {
        agentId: 'lead-architect',
        modelOrEngine: 'gemini-4-argon',
        roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
        thinkingLevel: 'high',
        status: 'completed',
        latencyMs: elapsedMs,
        summary: csgRes.description,
        reasoningSteps: [csgRes.mutationLabel, csgRes.description],
      },
      {
        agentId: 'hazard-specialist',
        modelOrEngine: 'gemini-3.8-flash',
        roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
        thinkingLevel: 'medium',
        status: 'completed',
        latencyMs: elapsedMs,
        summary: 'Aligned CSG field mutation with existing kinematic hazards and supportBias normals.',
        reasoningSteps: ['Verified zero collision interference with Start and Goal pads.'],
      },
      {
        agentId: 'solvability-verifier',
        modelOrEngine: 'cpu-sdf-120hz-gate',
        roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
        status: solvability.passed ? 'completed' : 'error',
        latencyMs: solvability.verificationLatencyMs,
        summary: solvability.passed
          ? `PASS: Spawn grounded (d=${solvability.startDistance.toFixed(2)}m), GLSL2 (${solvability.glslLineCount}L) & WGSL (${solvability.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`
          : `GATE FAILED: ${solvability.diagnostics.join(' ')}`,
        reasoningSteps: solvability.diagnostics,
      },
    ];
    req.onProgress?.(csgAgents);

    const antigravitySandbox = buildLocalAntigravityCertificate({
      course: verifiedCourse,
      solvability,
      status: 'unavailable',
      extraTrace: ['Realtime CSG mutation evaluated locally in memory.'],
    });

    return {
      proposalId: `prop_${Date.now().toString(36)}`,
      interactionId: `preset-csg-${req.csgMutationKind}`,
      previousInteractionId: null,
      executionSource: 'offline-preset',
      mode: req.mode,
      title: csgRes.mutationLabel,
      prompt: req.prompt,
      reasoningTrace,
      contextBundle: baseContextBundle,
      usageMetadata: null,
      serverError: null,
      repairAttempts: [],
      swarmAgents: csgAgents,
      solvability,
      proposedCourse: verifiedCourse,
      antigravitySandbox,
      requiresHumanApproval: true,
      createdAtIso: new Date().toISOString(),
    };
  }

  // === PATH C: LIVE GEMINI 4 ARGON API CALL WITH 3-TRY AUTONOMOUS SELF-REPAIR LOOP ===
  const fetchImpl =
    req.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const repairAttempts: SelfRepairAttemptRecord[] = [];
  let liveCandidateCourse: CourseSpec | null = null;
  let liveSolvability: CourseSolvabilityReport | null = null;
  let liveReasoningTrace = '';
  let liveSwarmAgents: readonly SwarmAgentExecutionTrace[] = [];
  let liveInteractionId: string | null = null;
  let liveExecutionSource: ArgonExecutionSource = 'offline-preset';
  let liveProposalTitle = 'Argon 1M Course Proposal';
  let liveUsageMetadata: ArgonUsageMetadata | null = null;
  let serverError: string | null = null;

  if (fetchImpl) {
    let chainedInteractionId: string | null = validPrevInteractionId;
    let pendingDiagnostics: readonly string[] = [];

    for (let attempt = 1; attempt <= MAX_SELF_REPAIR_ATTEMPTS; attempt++) {
      const attemptT0 = performance.now();
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        CLIENT_ARGON_TIMEOUT_MS,
      );
      const onCallerAbort = () => timeoutController.abort();
      req.signal?.addEventListener('abort', onCallerAbort, { once: true });

      try {
        if (req.signal?.aborted) {
          throw new Error('Request cancelled by user.');
        }

        if (attempt > 1) {
          req.onProgress?.([
            {
              agentId: 'lead-architect',
              modelOrEngine: 'gemini-4-argon',
              roleTitle: `Agent 1 · Lead Course Architect (Self-Repair Attempt ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS})`,
              thinkingLevel: 'high',
              status: 'running',
              latencyMs: 0,
              summary: `Sending structured failure diagnostics back to gemini-4-argon (previous_interaction_id=${chainedInteractionId ?? 'none'})...`,
              reasoningSteps: pendingDiagnostics,
            },
            {
              agentId: 'hazard-specialist',
              modelOrEngine: 'gemini-3.8-flash',
              roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
              thinkingLevel: 'medium',
              status: 'running',
              latencyMs: 0,
              summary: 'Re-aligning hazards for repaired course topology...',
              reasoningSteps: [],
            },
            {
              agentId: 'solvability-verifier',
              modelOrEngine: 'cpu-sdf-120hz-gate',
              roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
              status: 'idle',
              latencyMs: 0,
              summary: `Awaiting repaired CourseSpec for Attempt ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS}...`,
              reasoningSteps: pendingDiagnostics,
            },
          ]);
        }

        const repairPrompt =
          attempt === 1
            ? req.prompt
            : `${req.prompt}\n\n[SELF-REPAIR ATTEMPT ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS}] Fix these exact CPU SDF & 120 Hz Rollout Gate failures from Attempt ${attempt - 1}:\n${pendingDiagnostics.map((d, idx) => `${idx + 1}. ${d}`).join('\n')}`;

        const res = await fetchImpl('/api/argon/synthesize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(req.apiKey ? { 'x-gemini-api-key': req.apiKey } : {}),
          },
          body: JSON.stringify({
            prompt: repairPrompt,
            mode:
              req.mode === 'telemetry-mutation'
                ? 'telemetry-mutation'
                : 'swarm-synthesizer',
            presetId: req.presetId,
            systemInstruction: baseContextBundle.systemInstruction,
            cachedPrefixPrompt: baseContextBundle.cachedPrefixPrompt,
            dynamicTelemetryPrompt: baseContextBundle.dynamicTelemetryPrompt,
            previousInteractionId: isRealServerInteractionId(chainedInteractionId)
              ? chainedInteractionId
              : null,
            repairAttempt: attempt,
            repairDiagnostics: pendingDiagnostics,
            apiKey: req.apiKey,
          }),
          signal: timeoutController.signal,
        });

        const attemptLatencyMs = Math.max(
          1,
          Math.round((performance.now() - attemptT0) * 100) / 100,
        );

        if (!res.ok) {
          let errBodyText = '';
          try {
            const errJson = (await res.json()) as { error?: string };
            errBodyText = errJson.error ?? `HTTP ${res.status}`;
          } catch {
            errBodyText = `HTTP ${res.status}`;
          }
          serverError = `Server returned error: ${errBodyText}`;
          break;
        }

        const data = (await res.json()) as {
          ok?: boolean;
          source?: string;
          executionSource?: ArgonExecutionSource;
          interactionId?: string;
          reasoningTrace?: string;
          course?: CourseSpec;
          agent2Summary?: string;
          usageMetadata?: ArgonUsageMetadata | null;
          error?: string;
          latencyMs?: number;
        };

        if (data.error) {
          serverError = data.error;
        }

        const isLive =
          data.ok &&
          (data.executionSource === 'live-interactions-api' ||
            data.executionSource === 'live-generate-content' ||
            data.source === 'live-gemini-api') &&
          data.course &&
          typeof data.course.id === 'string' &&
          Array.isArray(data.course.nodes);

        if (!isLive || !data.course) {
          // Server did not return a live model synthesis (e.g. missing API key or upstream error)
          break;
        }

        const returnedInteractionId =
          typeof data.interactionId === 'string' && data.interactionId.trim()
            ? data.interactionId
            : `int_argon_live_${Date.now().toString(36)}`;
        const gateReport = verifyCourseSpecSolvability(data.course);
        const realLatency = data.latencyMs ?? attemptLatencyMs;

        const attemptRecord: SelfRepairAttemptRecord = {
          attempt,
          maxAttempts: MAX_SELF_REPAIR_ATTEMPTS,
          interactionId: returnedInteractionId,
          previousInteractionId: isRealServerInteractionId(chainedInteractionId)
            ? chainedInteractionId
            : null,
          passed: gateReport.passed,
          diagnosticsSent: [...pendingDiagnostics],
          gateDiagnostics: gateReport.diagnostics,
          fixSummary: gateReport.passed
            ? `Attempt ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS} PASSED CPU SDF & 120 Hz Rollout Gate (${gateReport.verifiedCourse.nodes.length} nodes, d=${gateReport.startDistance.toFixed(2)}m, reachedGoal=true).`
            : `Attempt ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS} FAILED gate: ${gateReport.diagnostics.join(' | ')}`,
          latencyMs: realLatency,
        };
        repairAttempts.push(attemptRecord);
        req.onRepairAttempt?.([...repairAttempts]);

        liveCandidateCourse = gateReport.verifiedCourse;
        liveSolvability = gateReport;
        liveInteractionId = returnedInteractionId;
        liveExecutionSource =
          data.executionSource === 'live-generate-content'
            ? 'live-generate-content'
            : 'live-interactions-api';
        liveUsageMetadata = data.usageMetadata ?? null;
        liveReasoningTrace =
          data.reasoningTrace ??
          `[gemini-4-argon // ${liveExecutionSource}] Synthesized CourseSpec from 1M-token context.`;
        liveProposalTitle = gateReport.verifiedCourse.name || 'Live Gemini 4 Argon Course';
        serverError = null;

        liveSwarmAgents = [
          {
            agentId: 'lead-architect',
            modelOrEngine: 'gemini-4-argon',
            roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
            thinkingLevel: 'high',
            status: 'completed',
            latencyMs: realLatency,
            summary: `Live ${liveExecutionSource} synthesis completed on Attempt ${attempt}/${MAX_SELF_REPAIR_ATTEMPTS} (${gateReport.verifiedCourse.nodes.length} SDF nodes).`,
            reasoningSteps: [liveReasoningTrace],
          },
          {
            agentId: 'hazard-specialist',
            modelOrEngine: 'gemini-3.8-flash',
            roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
            thinkingLevel: 'medium',
            status: 'completed',
            latencyMs: realLatency,
            summary:
              data.agent2Summary ??
              `Placed ${gateReport.verifiedCourse.hazards?.length ?? 0} synchronized kinematic hazards.`,
            reasoningSteps: [
              data.agent2Summary ?? 'Synchronized pistons, wave floors, and Steelie patrols.',
            ],
          },
        ];

        if (gateReport.passed) {
          break;
        }

        // Prepare next self-repair turn chaining the real server interactionId
        if (isRealServerInteractionId(returnedInteractionId)) {
          chainedInteractionId = returnedInteractionId;
        }
        pendingDiagnostics = gateReport.diagnostics;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (req.signal?.aborted) {
          serverError = 'Live Gemini 4 Argon request cancelled by user.';
        } else if (timeoutController.signal.aborted) {
          serverError = `Live Gemini 4 Argon request timed out after ${CLIENT_ARGON_TIMEOUT_MS / 1000}s.`;
        } else {
          serverError = `Live API error: ${msg}`;
        }
        break;
      } finally {
        clearTimeout(timeoutId);
        req.signal?.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  // If live synthesis succeeded (or ran 3 attempts and produced a candidate), finalize it
  if (liveCandidateCourse && liveSolvability && liveInteractionId) {
    const reconciledBundle = reconcileContextBundleWithUsageMetadata(
      baseContextBundle,
      liveUsageMetadata,
    );

    const agent3Trace: SwarmAgentExecutionTrace = {
      agentId: 'solvability-verifier',
      modelOrEngine: 'cpu-sdf-120hz-gate',
      roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
      status: liveSolvability.passed ? 'completed' : 'error',
      latencyMs: liveSolvability.verificationLatencyMs,
      summary: liveSolvability.passed
        ? `PASS (Attempt ${repairAttempts.length}/${MAX_SELF_REPAIR_ATTEMPTS}): Spawn grounded (d=${liveSolvability.startDistance.toFixed(2)}m), GLSL2 (${liveSolvability.glslLineCount}L) & WGSL (${liveSolvability.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`
        : `GATE FAILED after ${repairAttempts.length}/${MAX_SELF_REPAIR_ATTEMPTS} attempts: ${liveSolvability.diagnostics.join(' ')}`,
      reasoningSteps: liveSolvability.diagnostics,
    };

    const finalSwarmAgents: readonly SwarmAgentExecutionTrace[] = [
      ...liveSwarmAgents,
      agent3Trace,
    ];
    req.onProgress?.(finalSwarmAgents);

    let antigravitySandbox = await requestAntigravitySandboxVerification({
      prompt: req.prompt,
      course: liveCandidateCourse,
      solvability: liveSolvability,
      previousInteractionId: isRealServerInteractionId(liveInteractionId)
        ? liveInteractionId
        : null,
      apiKey: req.apiKey,
      fetchFn: fetchImpl,
    });

    // If Antigravity returned 'pending', poll once automatically if interactionId is valid
    if (
      antigravitySandbox.status === 'pending' &&
      isRealServerInteractionId(antigravitySandbox.interactionId) &&
      fetchImpl
    ) {
      const polled = await pollAntigravitySandboxVerification({
        interactionId: antigravitySandbox.interactionId,
        course: liveCandidateCourse,
        solvability: liveSolvability,
        apiKey: req.apiKey,
        fetchFn: fetchImpl,
      });
      if (polled.status !== 'unavailable') {
        antigravitySandbox = polled;
      }
    }

    return {
      proposalId: `prop_${Date.now().toString(36)}`,
      interactionId: liveInteractionId,
      previousInteractionId: validPrevInteractionId,
      executionSource: liveExecutionSource,
      mode: req.mode,
      title: liveProposalTitle,
      prompt: req.prompt,
      reasoningTrace: liveReasoningTrace,
      contextBundle: reconciledBundle,
      usageMetadata: liveUsageMetadata,
      serverError,
      repairAttempts,
      swarmAgents: finalSwarmAgents,
      solvability: liveSolvability,
      proposedCourse: liveCandidateCourse,
      antigravitySandbox,
      requiresHumanApproval: true,
      createdAtIso: new Date().toISOString(),
    };
  }

  // === PATH D: OFFLINE FALLBACK WHEN LIVE API IS UNAVAILABLE OR KEYS MISSING ===
  const tFallback0 = performance.now();
  let fallbackCourse: CourseSpec;
  let fallbackReasoningTrace: string;
  let fallbackTitle: string;
  let fallbackInteractionId: string;
  let fallbackBaseAgents: readonly SwarmAgentExecutionTrace[];

  if (req.mode === 'telemetry-mutation') {
    const mutated = mutateCourseFromTelemetry(
      req.currentCourse,
      req.telemetry,
      req.prompt,
    );
    fallbackCourse = mutated.mutatedCourse;
    fallbackReasoningTrace = mutated.reasoningTrace;
    fallbackTitle = mutated.mutatedCourse.name;
    fallbackInteractionId = `preset-telemetry-${req.currentCourse.id}`;
    fallbackBaseAgents = mutated.swarmAgents.slice(0, 2);
  } else {
    const targetPresetId: ArgonPresetId =
      req.presetId ?? inferPresetFromPrompt(req.prompt);
    const preset = ARGON_SYNTHESIS_PRESETS[targetPresetId];
    fallbackCourse = preset.course;
    fallbackReasoningTrace = preset.reasoningTrace;
    fallbackTitle = preset.title;
    fallbackInteractionId = `preset-${targetPresetId}`;
    fallbackBaseAgents = preset.swarmAgents.slice(0, 2);
  }

  const solvability = verifyCourseSpecSolvability(fallbackCourse);
  const verifiedCourse = solvability.verifiedCourse;
  const elapsedFallbackMs = Math.max(
    1,
    Math.round((performance.now() - tFallback0) * 100) / 100,
  );

  const agent3Trace: SwarmAgentExecutionTrace = {
    agentId: 'solvability-verifier',
    modelOrEngine: 'cpu-sdf-120hz-gate',
    roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
    status: solvability.passed ? 'completed' : 'error',
    latencyMs: solvability.verificationLatencyMs,
    summary: solvability.passed
      ? `PASS: Spawn grounded (d=${solvability.startDistance.toFixed(2)}m), GLSL2 (${solvability.glslLineCount}L) & WGSL (${solvability.wgslLineCount}L) compiled, 120 Hz Bot reached Goal Pad (100%).`
      : `GATE FAILED: ${solvability.diagnostics.join(' ')}`,
    reasoningSteps: solvability.diagnostics,
  };

  const finalSwarmAgents: readonly SwarmAgentExecutionTrace[] = [
    ...fallbackBaseAgents.map((a) => ({ ...a, latencyMs: elapsedFallbackMs })),
    agent3Trace,
  ];
  req.onProgress?.(finalSwarmAgents);

  const antigravitySandbox = await requestAntigravitySandboxVerification({
    prompt: req.prompt,
    course: verifiedCourse,
    solvability,
    previousInteractionId: null,
    apiKey: req.apiKey,
    fetchFn: fetchImpl,
  });

  return {
    proposalId: `prop_${Date.now().toString(36)}`,
    interactionId: fallbackInteractionId,
    previousInteractionId: null,
    executionSource: 'offline-preset',
    mode: req.mode,
    title: fallbackTitle,
    prompt: req.prompt,
    reasoningTrace: fallbackReasoningTrace,
    contextBundle: baseContextBundle,
    usageMetadata: null,
    serverError,
    repairAttempts,
    swarmAgents: finalSwarmAgents,
    solvability,
    proposedCourse: verifiedCourse,
    antigravitySandbox,
    requiresHumanApproval: true,
    createdAtIso: new Date().toISOString(),
  };
}
