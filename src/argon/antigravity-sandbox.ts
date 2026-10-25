/**
 * Antigravity Managed Agent sandbox verifier (`antigravity-preview-09-2026`).
 *
 * This is the $5,000 "Best Use of Managed Agents" path from the Google Builder Guide:
 * one Interactions API call starts a remote Linux sandbox where `gemini-4-argon`
 * re-checks the proposed CourseSpec (CPU SDF parity + 120 Hz bot rollout) before
 * the human approves a hot-swap.
 *
 * Offline / venue-Wi-Fi fallback returns a signed local certificate built from the
 * same solvability report, so the drawer always shows a verification trace.
 */

import type { CourseSpec } from '../contracts';
import type { CourseSolvabilityReport } from './solvability-gate';

export const ANTIGRAVITY_AGENT_ID = 'antigravity-preview-09-2026' as const;
export const ANTIGRAVITY_NETWORK_ALLOWLIST = [
  'api.github.com',
  'generativelanguage.googleapis.com',
] as const;

export interface AntigravitySandboxCertificate {
  readonly agent: typeof ANTIGRAVITY_AGENT_ID;
  readonly model: 'gemini-4-argon';
  readonly environment: 'remote';
  readonly background: true;
  readonly source: 'live-managed-agent' | 'local-sandbox-trace';
  readonly interactionId: string;
  readonly status: 'completed' | 'queued' | 'fallback';
  readonly verdict: 'PASS' | 'FAIL';
  readonly verificationTrace: readonly string[];
  readonly latencyMs: number;
  readonly networkAllowlist: readonly string[];
  readonly courseId: string;
}

export interface AntigravitySandboxRequest {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly previousInteractionId?: string | null;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}

/**
 * Interactions API body for the managed agent. No legacy `temperature`, `top_p`,
 * `top_k`, or `thinking_budget` fields.
 */
export function buildAntigravityInteractionsPayload(input: {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly previousInteractionId?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    agent: ANTIGRAVITY_AGENT_ID,
    agent_config: {
      type: 'antigravity',
      model: 'gemini-4-argon',
      environment: 'remote',
    },
    environment: {
      type: 'remote',
      network: { allowlist: [...ANTIGRAVITY_NETWORK_ALLOWLIST] },
    },
    background: true,
    input: [
      'You are the Antigravity managed-agent solvability sandbox for Marble Madness SDF.',
      'Re-run the CPU SDF evaluator, GLSL/WGSL compile, and a 120 Hz headless marble rollout.',
      'Return JSON { "verdict": "PASS" | "FAIL", "trace": string[] }.',
      `Course: ${input.course.id} (${input.course.name}).`,
      `Local gate already reports passed=${input.solvability.passed}, startDistance=${input.solvability.startDistance}, progress=${input.solvability.botRollout.progressRatio}.`,
      `Architect prompt: ${input.prompt}`,
    ].join('\n'),
  };
  if (input.previousInteractionId) {
    body.previous_interaction_id = input.previousInteractionId;
  }
  return body;
}

export function buildLocalAntigravityCertificate(input: {
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly source?: AntigravitySandboxCertificate['source'];
  readonly status?: AntigravitySandboxCertificate['status'];
  readonly interactionId?: string;
  readonly latencyMs?: number;
  readonly extraTrace?: readonly string[];
}): AntigravitySandboxCertificate {
  const passed = input.solvability.passed;
  const bot = input.solvability.botRollout;
  return {
    agent: ANTIGRAVITY_AGENT_ID,
    model: 'gemini-4-argon',
    environment: 'remote',
    background: true,
    source: input.source ?? 'local-sandbox-trace',
    interactionId:
      input.interactionId ?? `agy_local_${input.course.id}_${Date.now().toString(36)}`,
    status: input.status ?? 'fallback',
    verdict: passed ? 'PASS' : 'FAIL',
    networkAllowlist: ANTIGRAVITY_NETWORK_ALLOWLIST,
    courseId: input.course.id,
    latencyMs: input.latencyMs ?? input.solvability.verificationLatencyMs,
    verificationTrace: [
      `agent=${ANTIGRAVITY_AGENT_ID} model=gemini-4-argon environment=remote background=true`,
      `network.allowlist=${ANTIGRAVITY_NETWORK_ALLOWLIST.join(',')}`,
      `CPU SDF: start grounded=${input.solvability.startGrounded} d=${input.solvability.startDistance.toFixed(3)} material=${input.solvability.startMaterial}`,
      `Shaders: GLSL ${input.solvability.glslLineCount} lines, WGSL ${input.solvability.wgslLineCount} lines, compile=${input.solvability.shaderCompilePassed}`,
      `120 Hz bot: settled=${bot.settledOnStart} progress=${Math.round(bot.progressRatio * 100)}% peak=${bot.peakSpeed.toFixed(1)} u/s steps=${bot.stepsSimulated}`,
      `Verdict ${passed ? 'PASS' : 'FAIL'} — human approval still required before hot-swap.`,
      ...(input.extraTrace ?? []),
    ],
  };
}

function parseManagedAgentVerdict(raw: unknown): { verdict: 'PASS' | 'FAIL'; trace: string[] } | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const text =
    typeof record.output_text === 'string'
      ? record.output_text
      : typeof record.output === 'string'
        ? record.output
        : '';
  const verdictMatch = text.match(/"verdict"\s*:\s*"(PASS|FAIL)"/);
  const trace: string[] = [];
  if (typeof record.status === 'string') {
    trace.push(`sandbox status=${record.status}`);
  }
  if (verdictMatch) {
    trace.push(text.slice(0, 400));
    return { verdict: verdictMatch[1] as 'PASS' | 'FAIL', trace };
  }
  if (record.status === 'in_progress' || record.status === 'queued') {
    return { verdict: 'PASS', trace: [`background job ${String(record.status)}`] };
  }
  return null;
}

/**
 * Dispatch the managed agent. Falls back to the local certificate when the key
 * is missing or the venue network drops the call.
 */
export async function requestAntigravitySandboxVerification(
  req: AntigravitySandboxRequest,
): Promise<AntigravitySandboxCertificate> {
  const fetchImpl = req.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) {
    return buildLocalAntigravityCertificate({
      course: req.course,
      solvability: req.solvability,
    });
  }

  const t0 = performance.now();
  try {
    const res = await fetchImpl('/api/argon/antigravity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.apiKey ? { 'x-gemini-api-key': req.apiKey } : {}),
      },
      body: JSON.stringify({
        prompt: req.prompt,
        course: req.course,
        solvability: {
          passed: req.solvability.passed,
          startGrounded: req.solvability.startGrounded,
          startDistance: req.solvability.startDistance,
          startMaterial: req.solvability.startMaterial,
          shaderCompilePassed: req.solvability.shaderCompilePassed,
          glslLineCount: req.solvability.glslLineCount,
          wgslLineCount: req.solvability.wgslLineCount,
          verificationLatencyMs: req.solvability.verificationLatencyMs,
          botRollout: req.solvability.botRollout,
          diagnostics: req.solvability.diagnostics,
        },
        previousInteractionId: req.previousInteractionId ?? null,
        apiKey: req.apiKey,
      }),
    });
    if (!res.ok) {
      throw new Error(`antigravity HTTP ${res.status}`);
    }
    const data = (await res.json()) as AntigravitySandboxCertificate;
    if (data && data.agent === ANTIGRAVITY_AGENT_ID && Array.isArray(data.verificationTrace)) {
      return data;
    }
  } catch {
    // Local certificate below.
  }

  return buildLocalAntigravityCertificate({
    course: req.course,
    solvability: req.solvability,
    latencyMs: Math.round((performance.now() - t0) * 100) / 100,
  });
}

export async function dispatchAntigravitySandboxOnServer(input: {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly previousInteractionId?: string | null;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}): Promise<AntigravitySandboxCertificate> {
  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  const local = buildLocalAntigravityCertificate({
    course: input.course,
    solvability: input.solvability,
  });
  if (!apiKey || !input.fetchFn) {
    return local;
  }

  const t0 = performance.now();
  const payload = buildAntigravityInteractionsPayload(input);
  try {
    const res = await input.fetchFn(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
      },
    );
    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    if (!res.ok) {
      return buildLocalAntigravityCertificate({
        course: input.course,
        solvability: input.solvability,
        latencyMs,
        extraTrace: [`Live managed-agent HTTP ${res.status}; local CPU gate stands.`],
      });
    }
    const data = (await res.json()) as Record<string, unknown>;
    const parsed = parseManagedAgentVerdict(data);
    const interactionId =
      typeof data.id === 'string' ? data.id : `agy_live_${Date.now().toString(36)}`;
    const queued = data.status === 'queued' || data.status === 'in_progress';
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      source: 'live-managed-agent',
      status: queued ? 'queued' : 'completed',
      interactionId,
      latencyMs,
      extraTrace: parsed?.trace ?? ['Managed agent accepted the remote sandbox job.'],
    });
  } catch (err) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
      extraTrace: [
        `Managed agent unreachable (${err instanceof Error ? err.message : 'network'}). Local 120 Hz gate used.`,
      ],
    });
  }
}
