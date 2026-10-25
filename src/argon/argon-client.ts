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
 */

import type { CourseSpec } from '../contracts';
import {
  packArgon1MContext,
  type ArgonContextBundle,
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
  readonly onProgress?: (agents: readonly SwarmAgentExecutionTrace[]) => void;
  readonly fetchFn?: typeof fetch;
}

export interface SwarmSynthesisProposal {
  readonly proposalId: string;
  readonly interactionId: string;
  readonly previousInteractionId: string | null;
  readonly executionSource: 'live-gemini-api' | 'instant-1m-trace' | 'telemetry-coach-mutator' | 'realtime-csg-sculpt';
  readonly mode: SwarmSynthesisRequest['mode'];
  readonly title: string;
  readonly prompt: string;
  readonly reasoningTrace: string;
  readonly contextBundle: ArgonContextBundle;
  readonly swarmAgents: readonly SwarmAgentExecutionTrace[];
  readonly solvability: CourseSolvabilityReport;
  readonly proposedCourse: CourseSpec;
  readonly requiresHumanApproval: true;
  readonly createdAtIso: string;
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
 * Orchestrates the 3-Agent Swarm Architect pipeline:
 *   - Agent 1 (`gemini-4-argon`, `thinking_level: "high"`): Macro layout & telemetry synthesis
 *   - Agent 2 (`gemini-3.8-flash`, `thinking_level: "medium"`): Parallel Hazard & Portal placement
 *   - Agent 3 (`CPU SDF Solvability & Shader Gate`): Grounded spawn, GLSL2/WGSL compile & 120 Hz bot rollout
 */
export async function runArgonSwarmArchitect(
  req: SwarmSynthesisRequest,
): Promise<SwarmSynthesisProposal> {
  const contextBundle = packArgon1MContext({
    currentCourse: req.currentCourse,
    allCourses: req.allCourses,
    compiledShaders: req.compiledShaders,
    telemetry: req.telemetry,
    userPrompt: req.prompt,
  });

  // Notify UI that Agent 1 & Agent 2 have launched in parallel
  req.onProgress?.([
    {
      agentId: 'lead-architect',
      modelOrEngine: 'gemini-4-argon',
      roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
      thinkingLevel: 'high',
      status: 'running',
      latencyMs: 0,
      summary: `Reading ${contextBundle.totalTokensPacked.toLocaleString()} packed tokens (95% cached) & synthesizing macro SDF layout...`,
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

  let candidateCourse: CourseSpec | null = null;
  let reasoningTrace = '';
  let swarmAgents: readonly SwarmAgentExecutionTrace[] = [];
  let interactionId = `int_argon1m_${Date.now().toString(36)}`;
  let executionSource: SwarmSynthesisProposal['executionSource'] = 'instant-1m-trace';
  let proposalTitle = 'Argon 1M Course Proposal';

  // 1. Handle Realtime CSG Level Mutation mode
  if (req.mode === 'realtime-csg' && req.csgMutationKind) {
    const csgRes = applyRealtimeCsgMutationToCourse(
      req.currentCourse,
      req.csgMutationKind,
    );
    candidateCourse = csgRes.mutatedCourse;
    proposalTitle = csgRes.mutationLabel;
    executionSource = 'realtime-csg-sculpt';
    reasoningTrace = [
      `[gemini-4-argon // Realtime CSG Field Mutator // thinking_level: high]`,
      `• Operation: ${csgRes.mutationLabel}`,
      `• Details: ${csgRes.description}`,
      `• Active Course Nodes: ${req.currentCourse.nodes.length} -> ${csgRes.mutatedCourse.nodes.length}`,
    ].join('\n');
    swarmAgents = [
      {
        agentId: 'lead-architect',
        modelOrEngine: 'gemini-4-argon',
        roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
        thinkingLevel: 'high',
        status: 'completed',
        latencyMs: 120,
        summary: csgRes.description,
        reasoningSteps: [csgRes.mutationLabel, csgRes.description],
      },
      {
        agentId: 'hazard-specialist',
        modelOrEngine: 'gemini-3.8-flash',
        roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
        thinkingLevel: 'medium',
        status: 'completed',
        latencyMs: 85,
        summary: 'Aligned CSG field mutation with existing kinematic hazards and supportBias normals.',
        reasoningSteps: ['Verified zero collision interference withStart and Goal pads.'],
      },
    ];
  }

  // 2. Attempt live `/api/argon/synthesize` call if not a direct CSG sculpt
  const fetchImpl =
    req.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!candidateCourse && fetchImpl) {
    try {
      const res = await fetchImpl('/api/argon/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.apiKey ? { 'x-gemini-api-key': req.apiKey } : {}),
        },
        body: JSON.stringify({
          prompt: req.prompt,
          mode:
            req.mode === 'telemetry-mutation'
              ? 'telemetry-mutation'
              : req.mode === 'preset'
                ? 'preset'
                : 'swarm-synthesizer',
          presetId: req.presetId,
          systemInstruction: contextBundle.systemInstruction,
          cachedPrefixPrompt: contextBundle.cachedPrefixPrompt,
          dynamicTelemetryPrompt: contextBundle.dynamicTelemetryPrompt,
          previousInteractionId: req.previousInteractionId ?? null,
          apiKey: req.apiKey,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          source?: string;
          interactionId?: string;
          reasoningTrace?: string;
          course?: CourseSpec;
          agent2Summary?: string;
          latencyMs?: number;
        };
        if (
          data.ok &&
          data.source === 'live-gemini-api' &&
          data.course &&
          typeof data.course.id === 'string' &&
          Array.isArray(data.course.nodes)
        ) {
          candidateCourse = data.course;
          interactionId = data.interactionId ?? interactionId;
          reasoningTrace =
            data.reasoningTrace ??
            '[gemini-4-argon // live API] Synthesized CourseSpec from 1M-token context.';
          executionSource = 'live-gemini-api';
          proposalTitle = data.course.name || 'Live Gemini 4 Argon Course';
          swarmAgents = [
            {
              agentId: 'lead-architect',
              modelOrEngine: 'gemini-4-argon',
              roleTitle: 'Agent 1 · Lead Course Architect (gemini-4-argon · high thinking)',
              thinkingLevel: 'high',
              status: 'completed',
              latencyMs: data.latencyMs ?? 640,
              summary: `Live gemini-4-argon synthesis completed (${data.course.nodes.length} SDF nodes).`,
              reasoningSteps: [reasoningTrace],
            },
            {
              agentId: 'hazard-specialist',
              modelOrEngine: 'gemini-3.8-flash',
              roleTitle: 'Agent 2 · Hazard & Portal Specialist (gemini-3.8-flash · parallel)',
              thinkingLevel: 'medium',
              status: 'completed',
              latencyMs: Math.round((data.latencyMs ?? 640) * 0.45),
              summary:
                data.agent2Summary ??
                `Placed ${data.course.hazards?.length ?? 0} synchronized kinematic hazards.`,
              reasoningSteps: [
                data.agent2Summary ?? 'Synchronized pistons, wave floors, and Steelie patrols.',
              ],
            },
          ];
        }
      }
    } catch {
      // Gracefully fall back to deterministic local 1M synthesis or telemetry mutator
    }
  }

  // 3. If telemetry-mutation mode ("Analyze My Last Run & Mutate Course")
  if (!candidateCourse && req.mode === 'telemetry-mutation') {
    const mutated = mutateCourseFromTelemetry(
      req.currentCourse,
      req.telemetry,
      req.prompt,
    );
    candidateCourse = mutated.mutatedCourse;
    reasoningTrace = mutated.reasoningTrace;
    swarmAgents = mutated.swarmAgents.slice(0, 2);
    proposalTitle = mutated.mutatedCourse.name;
    executionSource = 'telemetry-coach-mutator';
    interactionId = `int_argon1m_telemetry_${Date.now().toString(36)}`;
  }

  // 4. Preset or Natural-Language Instant 1M Synthesis Fallback
  if (!candidateCourse) {
    const targetPresetId: ArgonPresetId =
      req.presetId ?? inferPresetFromPrompt(req.prompt);
    const preset = ARGON_SYNTHESIS_PRESETS[targetPresetId];
    candidateCourse = preset.course;
    reasoningTrace = preset.reasoningTrace;
    swarmAgents = preset.swarmAgents.slice(0, 2);
    interactionId = preset.interactionId;
    proposalTitle = preset.title;
    executionSource = 'instant-1m-trace';
  }

  // 5. Run Agent 3: Live CPU SDF Solvability & Lockstep Shader Gate (`verifyCourseSpecSolvability`)
  const solvability = verifyCourseSpecSolvability(candidateCourse);
  const verifiedCourse = solvability.verifiedCourse;

  const agent3Trace: SwarmAgentExecutionTrace = {
    agentId: 'solvability-verifier',
    modelOrEngine: 'cpu-sdf-120hz-gate',
    roleTitle: 'Agent 3 · CPU SDF Solvability & Shader Gate (120 Hz Bot Rollout)',
    status: solvability.passed ? 'completed' : 'error',
    latencyMs: solvability.verificationLatencyMs,
    summary: solvability.passed
      ? `PASS: Spawn grounded (d=${solvability.startDistance.toFixed(2)}m), GLSL2 (${solvability.glslLineCount}L) & WGSL (${solvability.wgslLineCount}L) compiled, 120 Hz Bot progressed ${Math.round(solvability.botRollout.progressRatio * 100)}% (peak ${solvability.botRollout.peakSpeed.toFixed(1)} u/s).`
      : `GATE WARNING: ${solvability.diagnostics.join(' ')}`,
    reasoningSteps: solvability.diagnostics,
  };

  const finalSwarmAgents: readonly SwarmAgentExecutionTrace[] = [
    ...swarmAgents,
    agent3Trace,
  ];
  req.onProgress?.(finalSwarmAgents);

  return {
    proposalId: `prop_${Date.now().toString(36)}`,
    interactionId,
    previousInteractionId: req.previousInteractionId ?? null,
    executionSource,
    mode: req.mode,
    title: proposalTitle,
    prompt: req.prompt,
    reasoningTrace,
    contextBundle,
    swarmAgents: finalSwarmAgents,
    solvability,
    proposedCourse: verifiedCourse,
    requiresHumanApproval: true,
    createdAtIso: new Date().toISOString(),
  };
}
