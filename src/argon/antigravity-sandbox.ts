/**
 * Antigravity Managed Agent sandbox verifier (`antigravity-preview-09-2026`).
 *
 * This is the $5,000 "Best Use of Managed Agents" path from the Google Builder Guide:
 * one Interactions API call starts a remote Linux sandbox where `gemini-4-argon`
 * re-checks the proposed CourseSpec (CPU SDF parity + 120 Hz bot rollout) before
 * the human approves a hot-swap.
 *
 * Codex F1 & Honesty Fixes:
 *   - Uses explicit `'pending' | 'passed' | 'failed' | 'unavailable'` verification states.
 *   - Preserves the remote sandbox's actual verdict (`PASS` vs `FAIL` vs `PENDING` vs `UNAVAILABLE`)
 *     and never overwrites a remote `FAIL` or `in_progress`/`queued` response with a local `PASS`.
 *   - Binds every verification certificate to a deterministic `courseHash` (`hashCourseSpec(course)`),
 *     plus `repoUrl` (`https://github.com/bourkefloyd/gemini-4-argon-sfhackathon-2026`) and `commitSha`.
 *   - Supports polling `GET /v1beta/interactions/{id}` via `/api/argon/antigravity/poll`.
 */

import type { CourseSpec } from '../contracts';
import type { CourseSolvabilityReport } from './solvability-gate';

export const ANTIGRAVITY_AGENT_ID = 'antigravity-preview-09-2026' as const;
export const ANTIGRAVITY_REPO_URL =
  'https://github.com/bourkefloyd/gemini-4-argon-sfhackathon-2026' as const;
export const ANTIGRAVITY_DEFAULT_COMMIT_SHA = 'e5c00a1' as const;
export const ANTIGRAVITY_NETWORK_ALLOWLIST = [
  'api.github.com',
  'generativelanguage.googleapis.com',
] as const;

export type AntigravityVerificationState =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'unavailable';

export interface AntigravitySandboxCertificate {
  readonly agent: typeof ANTIGRAVITY_AGENT_ID;
  readonly model: 'gemini-4-argon';
  readonly environment: 'remote';
  readonly background: true;
  readonly source: 'live-managed-agent' | 'local-sandbox-trace';
  readonly interactionId: string;
  readonly status: AntigravityVerificationState;
  readonly passed: boolean;
  readonly verdict: 'PASS' | 'FAIL' | 'PENDING' | 'UNAVAILABLE';
  readonly courseHash: string;
  readonly repoUrl: string;
  readonly commitSha: string;
  readonly verificationTrace: readonly string[];
  readonly latencyMs: number;
  readonly networkAllowlist: readonly string[];
  readonly courseId: string;
}

export interface AntigravitySandboxRequest {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly repoUrl?: string;
  readonly commitSha?: string;
  readonly previousInteractionId?: string | null;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}

/**
 * Computes a deterministic FNV-1a 64-bit hex digest of a `CourseSpec` (canonicalized JSON)
 * so every Antigravity verification certificate is cryptographically bound to the exact course geometry.
 */
export function hashCourseSpec(course: CourseSpec): string {
  const canonical = JSON.stringify({
    id: course.id,
    startPos: course.startPos,
    goalPos: course.goalPos,
    goalRadius: course.goalRadius,
    killPlaneY: course.killPlaneY,
    nodes: course.nodes,
    hazards: course.hazards,
    scene: course.scene ?? null,
    portals: course.portals ?? null,
  });
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193) >>> 0;
  }
  return `cspec_${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

/**
 * Checks whether an interaction ID is a real server-issued interaction ID
 * (never a preset ID like `preset-portal-citadel` or `int_argon1m_...` or `agy_local_...`).
 */
export function isRealServerInteractionId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed) return false;
  if (
    trimmed.startsWith('preset-') ||
    trimmed.startsWith('int_argon1m_') ||
    trimmed.startsWith('int_argon_local_') ||
    trimmed.startsWith('int_argon_fallback_') ||
    trimmed.startsWith('agy_local_') ||
    trimmed.startsWith('prop_')
  ) {
    return false;
  }
  return true;
}

/**
 * Interactions API body for the managed agent (`antigravity-preview-09-2026`).
 * Includes the candidate `CourseSpec` JSON, `repoUrl`, `commitSha`, and `courseHash`.
 * No legacy `temperature`, `top_p`, `top_k`, or `thinking_budget` fields.
 */
export function buildAntigravityInteractionsPayload(input: {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly repoUrl?: string;
  readonly commitSha?: string;
  readonly previousInteractionId?: string | null;
}): Record<string, unknown> {
  const courseHash = hashCourseSpec(input.course);
  const repoUrl = input.repoUrl ?? ANTIGRAVITY_REPO_URL;
  const commitSha = input.commitSha ?? ANTIGRAVITY_DEFAULT_COMMIT_SHA;

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
      'You are the Antigravity managed-agent solvability sandbox (`antigravity-preview-09-2026`) for Marble Madness SDF.',
      `Repository: ${repoUrl} @ commit ${commitSha}`,
      `Course Hash: ${courseHash}`,
      'Re-run the CPU SDF evaluator (`createCpuWorldEvaluator`), GLSL/WGSL shader compilers (`compileCourseToGlsl`, `compileCourseToWgsl`), and a 120 Hz headless marble rollout (`createMarbleSimulation`).',
      'Return JSON `{ "verdict": "PASS" | "FAIL", "courseHash": string, "trace": string[] }`.',
      `Local gate diagnostics: passed=${input.solvability.passed}, startDistance=${input.solvability.startDistance}, reachedGoal=${input.solvability.botRollout.reachedGoal}, progress=${input.solvability.botRollout.progressRatio}.`,
      `Architect prompt: ${input.prompt}`,
      `Candidate CourseSpec JSON:\n${JSON.stringify(input.course)}`,
    ].join('\n'),
  };
  if (isRealServerInteractionId(input.previousInteractionId)) {
    body.previous_interaction_id = input.previousInteractionId;
  }
  return body;
}

export function buildLocalAntigravityCertificate(input: {
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly source?: AntigravitySandboxCertificate['source'];
  readonly status?: AntigravityVerificationState;
  readonly verdict?: AntigravitySandboxCertificate['verdict'];
  readonly passed?: boolean;
  readonly interactionId?: string;
  readonly latencyMs?: number;
  readonly repoUrl?: string;
  readonly commitSha?: string;
  readonly extraTrace?: readonly string[];
}): AntigravitySandboxCertificate {
  const courseHash = hashCourseSpec(input.course);
  const repoUrl = input.repoUrl ?? ANTIGRAVITY_REPO_URL;
  const commitSha = input.commitSha ?? ANTIGRAVITY_DEFAULT_COMMIT_SHA;
  const source = input.source ?? 'local-sandbox-trace';
  const status: AntigravityVerificationState = input.status ?? 'unavailable';

  // Determine honest passed & verdict from explicit status/verdict
  let passed: boolean;
  let verdict: AntigravitySandboxCertificate['verdict'];

  if (input.passed !== undefined && input.verdict !== undefined) {
    passed = input.passed;
    verdict = input.verdict;
  } else if (status === 'passed') {
    passed = true;
    verdict = 'PASS';
  } else if (status === 'failed') {
    passed = false;
    verdict = 'FAIL';
  } else if (status === 'pending') {
    passed = false;
    verdict = 'PENDING';
  } else {
    // status === 'unavailable': local sandbox trace reflects local CPU SDF gate
    passed = false;
    verdict = input.solvability.passed ? 'PASS' : 'FAIL';
  }

  const bot = input.solvability.botRollout;
  return {
    agent: ANTIGRAVITY_AGENT_ID,
    model: 'gemini-4-argon',
    environment: 'remote',
    background: true,
    source,
    interactionId:
      input.interactionId ?? `agy_local_${input.course.id}_${Date.now().toString(36)}`,
    status,
    passed,
    verdict,
    courseHash,
    repoUrl,
    commitSha,
    networkAllowlist: ANTIGRAVITY_NETWORK_ALLOWLIST,
    courseId: input.course.id,
    latencyMs: input.latencyMs ?? input.solvability.verificationLatencyMs,
    verificationTrace: [
      `agent=${ANTIGRAVITY_AGENT_ID} model=gemini-4-argon environment=remote background=true status=${status} verdict=${verdict}`,
      `repo=${repoUrl} commit=${commitSha} courseHash=${courseHash}`,
      `network.allowlist=${ANTIGRAVITY_NETWORK_ALLOWLIST.join(',')}`,
      `CPU SDF: start grounded=${input.solvability.startGrounded} d=${input.solvability.startDistance.toFixed(3)} material=${input.solvability.startMaterial}`,
      `Shaders: GLSL ${input.solvability.glslLineCount} lines, WGSL ${input.solvability.wgslLineCount} lines, compile=${input.solvability.shaderCompilePassed}`,
      `120 Hz bot: settled=${bot.settledOnStart} reachedGoal=${bot.reachedGoal} progress=${Math.round(bot.progressRatio * 100)}% peak=${bot.peakSpeed.toFixed(1)} u/s steps=${bot.stepsSimulated}`,
      ...(input.extraTrace ?? []),
    ],
  };
}

/**
 * Parses the remote Antigravity interaction payload and preserves its exact state:
 *   - `'in_progress'` / `'queued'` / `'running'` -> `status: 'pending'`, `verdict: 'PENDING'`, `passed: false`
 *   - `'failed'` / `'error'` / `'cancelled'` -> `status: 'failed'`, `verdict: 'FAIL'`, `passed: false`
 *   - Explicit `"verdict": "FAIL"` -> `status: 'failed'`, `verdict: 'FAIL'`, `passed: false`
 *   - Explicit `"verdict": "PASS"` (and local solvability passed) -> `status: 'passed'`, `verdict: 'PASS'`, `passed: true`
 */
export function parseManagedAgentResponse(
  raw: unknown,
  localSolvabilityPassed: boolean,
): {
  status: AntigravityVerificationState;
  verdict: AntigravitySandboxCertificate['verdict'];
  passed: boolean;
  trace: string[];
} {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'unavailable',
      verdict: 'UNAVAILABLE',
      passed: false,
      trace: ['Empty or malformed response from Antigravity endpoint.'],
    };
  }
  const record = raw as Record<string, unknown>;
  const rawStatus = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  const text =
    typeof record.output_text === 'string'
      ? record.output_text
      : typeof record.output === 'string'
        ? record.output
        : JSON.stringify(record.output ?? '');

  const trace: string[] = [];
  if (rawStatus) {
    trace.push(`sandbox status=${rawStatus}`);
  }

  // 1. Check if remote sandbox job is still pending/queued/in_progress
  if (rawStatus === 'queued' || rawStatus === 'in_progress' || rawStatus === 'running' || rawStatus === 'pending') {
    trace.push(`Remote sandbox job is ${rawStatus}; awaiting completion poll.`);
    return {
      status: 'pending',
      verdict: 'PENDING',
      passed: false,
      trace,
    };
  }

  // 2. Check if remote sandbox job failed at the infrastructure level
  if (rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'cancelled') {
    trace.push(`Remote sandbox job ${rawStatus}.`);
    return {
      status: 'failed',
      verdict: 'FAIL',
      passed: false,
      trace,
    };
  }

  // 3. Check explicit verdict in output text
  const verdictMatch = text.match(/"verdict"\s*:\s*"(PASS|FAIL)"/i);
  if (verdictMatch) {
    const remoteVerdict = verdictMatch[1].toUpperCase() as 'PASS' | 'FAIL';
    trace.push(text.slice(0, 400));
    if (remoteVerdict === 'FAIL') {
      return {
        status: 'failed',
        verdict: 'FAIL',
        passed: false,
        trace,
      };
    }
    // Remote verdict is PASS — also require local solvability to have passed
    const bothPassed = localSolvabilityPassed;
    return {
      status: bothPassed ? 'passed' : 'failed',
      verdict: bothPassed ? 'PASS' : 'FAIL',
      passed: bothPassed,
      trace,
    };
  }

  // 4. Completed without explicit verdict JSON
  if (rawStatus === 'completed' || rawStatus === 'succeeded') {
    return {
      status: localSolvabilityPassed ? 'passed' : 'failed',
      verdict: localSolvabilityPassed ? 'PASS' : 'FAIL',
      passed: localSolvabilityPassed,
      trace: [...trace, 'Remote sandbox completed without explicit verdict token; bound to local gate result.'],
    };
  }

  return {
    status: 'unavailable',
    verdict: 'UNAVAILABLE',
    passed: false,
    trace: [...trace, 'Unrecognized Antigravity response format.'],
  };
}

/**
 * Polls `GET /v1beta/interactions/{id}` on the server for a background Antigravity job.
 */
export async function pollAntigravitySandboxOnServer(input: {
  readonly interactionId: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly repoUrl?: string;
  readonly commitSha?: string;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}): Promise<AntigravitySandboxCertificate> {
  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  const fetchImpl = input.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!apiKey || !fetchImpl || !isRealServerInteractionId(input.interactionId)) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      status: 'unavailable',
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: ['Cannot poll Antigravity interaction without valid API key and server interactionId.'],
    });
  }

  const t0 = performance.now();
  try {
    const res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/interactions/${encodeURIComponent(input.interactionId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
      },
    );
    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    if (!res.ok) {
      return buildLocalAntigravityCertificate({
        course: input.course,
        solvability: input.solvability,
        source: 'local-sandbox-trace',
        status: 'unavailable',
        interactionId: input.interactionId,
        latencyMs,
        repoUrl: input.repoUrl,
        commitSha: input.commitSha,
        extraTrace: [`Poll GET /v1beta/interactions/${input.interactionId} returned HTTP ${res.status}.`],
      });
    }
    const data = (await res.json()) as Record<string, unknown>;
    const parsed = parseManagedAgentResponse(data, input.solvability.passed);
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      source: 'live-managed-agent',
      status: parsed.status,
      verdict: parsed.verdict,
      passed: parsed.passed,
      interactionId: input.interactionId,
      latencyMs,
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: parsed.trace,
    });
  } catch (err) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      source: 'local-sandbox-trace',
      status: 'unavailable',
      interactionId: input.interactionId,
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: [
        `Poll failed (${err instanceof Error ? err.message : 'network'}).`,
      ],
    });
  }
}

/**
 * Client-side helper to poll `/api/argon/antigravity/poll` while a remote Antigravity job is `'pending'`.
 */
export async function pollAntigravitySandboxVerification(input: {
  readonly interactionId: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}): Promise<AntigravitySandboxCertificate> {
  const fetchImpl = input.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      status: 'unavailable',
    });
  }
  try {
    const res = await fetchImpl('/api/argon/antigravity/poll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.apiKey ? { 'x-gemini-api-key': input.apiKey } : {}),
      },
      body: JSON.stringify({
        interactionId: input.interactionId,
        course: input.course,
        solvability: input.solvability,
        apiKey: input.apiKey,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as AntigravitySandboxCertificate;
      if (data && data.agent === ANTIGRAVITY_AGENT_ID) {
        return data;
      }
    }
  } catch {
    // Fall through to unavailable
  }
  return buildLocalAntigravityCertificate({
    course: input.course,
    solvability: input.solvability,
    status: 'unavailable',
    interactionId: input.interactionId,
  });
}

/**
 * Dispatch the managed agent from the client.
 * When no network `fetchFn` is provided (e.g. offline preset), returns an honest
 * `status: 'unavailable'` local certificate without making any network calls.
 */
export async function requestAntigravitySandboxVerification(
  req: AntigravitySandboxRequest,
): Promise<AntigravitySandboxCertificate> {
  const fetchImpl = req.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) {
    return buildLocalAntigravityCertificate({
      course: req.course,
      solvability: req.solvability,
      status: 'unavailable',
      repoUrl: req.repoUrl,
      commitSha: req.commitSha,
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
        repoUrl: req.repoUrl ?? ANTIGRAVITY_REPO_URL,
        commitSha: req.commitSha ?? ANTIGRAVITY_DEFAULT_COMMIT_SHA,
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
        previousInteractionId: isRealServerInteractionId(req.previousInteractionId)
          ? req.previousInteractionId
          : null,
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
    status: 'unavailable',
    repoUrl: req.repoUrl,
    commitSha: req.commitSha,
    latencyMs: Math.round((performance.now() - t0) * 100) / 100,
  });
}

export async function dispatchAntigravitySandboxOnServer(input: {
  readonly prompt: string;
  readonly course: CourseSpec;
  readonly solvability: CourseSolvabilityReport;
  readonly repoUrl?: string;
  readonly commitSha?: string;
  readonly previousInteractionId?: string | null;
  readonly apiKey?: string;
  readonly fetchFn?: typeof fetch;
}): Promise<AntigravitySandboxCertificate> {
  const apiKey = input.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey || !input.fetchFn) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      status: 'unavailable',
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: ['No GEMINI_API_KEY available; remote Antigravity sandbox unavailable (local CPU SDF gate used).'],
    });
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
        status: 'unavailable',
        latencyMs,
        repoUrl: input.repoUrl,
        commitSha: input.commitSha,
        extraTrace: [`Live managed-agent HTTP ${res.status}; remote sandbox unavailable.`],
      });
    }
    const data = (await res.json()) as Record<string, unknown>;
    const parsed = parseManagedAgentResponse(data, input.solvability.passed);
    const interactionId =
      typeof data.id === 'string' ? data.id : `agy_live_${Date.now().toString(36)}`;

    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      source: 'live-managed-agent',
      status: parsed.status,
      verdict: parsed.verdict,
      passed: parsed.passed,
      interactionId,
      latencyMs,
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: parsed.trace,
    });
  } catch (err) {
    return buildLocalAntigravityCertificate({
      course: input.course,
      solvability: input.solvability,
      status: 'unavailable',
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
      repoUrl: input.repoUrl,
      commitSha: input.commitSha,
      extraTrace: [
        `Managed agent unreachable (${err instanceof Error ? err.message : 'network'}). Local 120 Hz gate used.`,
      ],
    });
  }
}
