/**
 * Gemini 4 Argon (`gemini-4-argon`) & Gemini 3.8 Flash (`gemini-3.8-flash`)
 * Server Middleware & Multi-Agent Swarm Proxy (`server/argon-proxy.ts`)
 *
 * Implements the Google Builder Guide specification + Honesty Pass:
 *   - Lead Architect: `gemini-4-argon` with `thinking_level: "high"` / `thinkingConfig: { thinkingLevel: "HIGH" }`
 *     (1M-token context window, 95% automatic implicit input caching, `previous_interaction_id` chaining
 *     only for real server interaction IDs, no legacy temperature/top_p/top_k/thinking_budget parameters).
 *   - Parallel Leaf Specialist: `gemini-3.8-flash` with `thinking_level: "medium"` / `thinkingLevel: "MEDIUM"`
 *     for concurrent Hazard & Portal synthesis.
 *   - Enforces a 45s request timeout via `AbortController`.
 *   - Forwards real `usageMetadata` (promptTokenCount, candidatesTokenCount, thoughtsTokenCount, cachedContentTokenCount, totalTokenCount)
 *     and exact `executionSource` (`'live-interactions-api' | 'live-generate-content' | 'offline-preset'`).
 *   - Supports `/api/argon/antigravity` and `/api/argon/antigravity/poll` (`GET /v1beta/interactions/{id}`).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { CourseSpec, SdfPrimitiveNode } from '../src/contracts';
import type { ArgonUsageMetadata } from '../src/argon/context-packer';
import {
  dispatchAntigravitySandboxOnServer,
  isRealServerInteractionId,
  pollAntigravitySandboxOnServer,
  type AntigravitySandboxCertificate,
} from '../src/argon/antigravity-sandbox';
import type { CourseSolvabilityReport } from '../src/argon/solvability-gate';

export const ARGON_REQUEST_TIMEOUT_MS = 45_000;

export type ArgonLiveExecutionSource =
  | 'live-interactions-api'
  | 'live-generate-content'
  | 'offline-preset';

export interface ArgonServerSynthesizeRequest {
  readonly prompt: string;
  readonly mode: 'swarm-synthesizer' | 'telemetry-mutation' | 'preset';
  readonly presetId?: string;
  readonly systemInstruction: string;
  readonly cachedPrefixPrompt: string;
  readonly dynamicTelemetryPrompt: string;
  readonly previousInteractionId?: string | null;
  readonly repairAttempt?: number;
  readonly repairDiagnostics?: readonly string[];
  readonly apiKey?: string;
}

export interface ArgonServerSynthesizeResponse {
  readonly ok: boolean;
  readonly source: 'live-gemini-api' | 'server-fallback';
  readonly executionSource: ArgonLiveExecutionSource;
  readonly modelId: 'gemini-4-argon';
  readonly companionModelId: 'gemini-3.8-flash';
  readonly thinkingLevel: 'high';
  readonly interactionId: string;
  readonly reasoningTrace?: string;
  readonly course?: CourseSpec;
  readonly agent2Hazards?: readonly SdfPrimitiveNode[];
  readonly agent2Summary?: string;
  readonly usageMetadata?: ArgonUsageMetadata | null;
  readonly error?: string;
  readonly latencyMs: number;
}

export const GEMINI_INTERACTIONS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/interactions';
export const GEMINI_ARGON_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-4-argon:generateContent';
export const GEMINI_FLASH_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent';
export const GEMINI_TTS_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash-tts:generateContent';

export interface ArcadeTtsResult {
  readonly ok: boolean;
  readonly source: 'gemini-3.8-flash-tts' | 'unavailable';
  readonly text: string;
  readonly audioBase64?: string;
  readonly mimeType?: string;
}

/**
 * `gemini-3.8-flash-tts` via generateContent. No temperature / top_p / top_k.
 * The browser falls back to speechSynthesis when this returns unavailable.
 */
export async function synthesizeArcadeSpeech(
  text: string,
  apiKey?: string,
  fetchFn: typeof fetch = fetch,
): Promise<ArcadeTtsResult> {
  const key = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  const spoken = text.trim().slice(0, 280);
  if (!key) {
    return { ok: false, source: 'unavailable', text: spoken };
  }
  const body = {
    contents: [{ role: 'user', parts: [{ text: spoken }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
    },
  };
  try {
    const res = await fetchFn(`${GEMINI_TTS_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, source: 'unavailable', text: spoken };
    }
    const data = (await res.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }>;
        };
      }>;
    };
    const inline = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
    if (!inline?.inlineData?.data) {
      return { ok: false, source: 'unavailable', text: spoken };
    }
    return {
      ok: true,
      source: 'gemini-3.8-flash-tts',
      text: spoken,
      audioBase64: inline.inlineData.data,
      mimeType: inline.inlineData.mimeType || 'audio/wav',
    };
  } catch {
    return { ok: false, source: 'unavailable', text: spoken };
  }
}

/**
 * Extracts a JSON object from raw model text (handles optional markdown code fences).
 */
export function extractJsonObjectFromText(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null;
  }
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractUsageMetadata(raw: unknown): ArgonUsageMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const u = (r.usageMetadata ?? r.usage_metadata ?? r.usage) as Record<string, unknown> | undefined;
  if (!u || typeof u !== 'object') return null;

  const promptTokenCount = Number(
    u.promptTokenCount ?? u.prompt_token_count ?? u.input_tokens ?? 0,
  );
  const candidatesTokenCount = Number(
    u.candidatesTokenCount ?? u.candidates_token_count ?? u.output_tokens ?? 0,
  );
  const thoughtsTokenCount = Number(
    u.thoughtsTokenCount ?? u.thoughts_token_count ?? u.thinking_tokens ?? 0,
  );
  const cachedContentTokenCount = Number(
    u.cachedContentTokenCount ?? u.cached_content_token_count ?? u.cached_tokens ?? 0,
  );
  const totalTokenCount = Number(
    u.totalTokenCount ??
      u.total_token_count ??
      u.total_tokens ??
      promptTokenCount + candidatesTokenCount + thoughtsTokenCount,
  );

  if (promptTokenCount <= 0 && totalTokenCount <= 0) {
    return null;
  }

  return {
    promptTokenCount,
    candidatesTokenCount,
    ...(thoughtsTokenCount > 0 ? { thoughtsTokenCount } : {}),
    ...(cachedContentTokenCount > 0 ? { cachedContentTokenCount } : {}),
    totalTokenCount: totalTokenCount > 0 ? totalTokenCount : promptTokenCount + candidatesTokenCount,
  };
}

/**
 * Calls `gemini-4-argon` (`thinking_level: "high"`) via the Interactions API
 * with automatic fallback to `v1beta/models/gemini-4-argon:generateContent`.
 */
async function callGemini4ArgonLead(
  req: ArgonServerSynthesizeRequest,
  apiKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<{
  interactionId: string;
  executionSource: 'live-interactions-api' | 'live-generate-content';
  reasoningTrace: string;
  course: CourseSpec | null;
  usageMetadata: ArgonUsageMetadata | null;
}> {
  const repairSuffix =
    req.repairAttempt && req.repairAttempt > 1 && req.repairDiagnostics?.length
      ? `\n\n=== AUTONOMOUS SELF-REPAIR ATTEMPT ${req.repairAttempt}/3 ===\nPrevious CourseSpec failed the CPU SDF Solvability & Shader Gate with exact diagnostics:\n${req.repairDiagnostics.map((d, i) => `${i + 1}. ${d}`).join('\n')}\nFix ALL reported errors and return a corrected JSON \`{ "reasoningTrace": string, "course": CourseSpec }\` with grounded startPos, continuous floor geometry reaching goalPos, valid positive halfExtents/radius on every node, and <= 32 total nodes.`
      : '';

  const fullInput = `${req.cachedPrefixPrompt}\n\n${req.dynamicTelemetryPrompt}\n\nUSER ARCHITECT PROMPT:\n${req.prompt}${repairSuffix}`;

  // 1. Try Official Interactions API (v2.3.0+ pattern from Builder Guide)
  const interactionsBody: Record<string, unknown> = {
    model: 'gemini-4-argon',
    system_instruction: req.systemInstruction,
    input: fullInput,
    generation_config: {
      thinking_level: 'high',
      max_output_tokens: 65536,
      response_mime_type: 'application/json',
    },
    config: {
      thinking_level: 'high',
      max_output_tokens: 65536,
      response_mime_type: 'application/json',
    },
  };
  // Chain previous_interaction_id ONLY when it is a real server-issued interaction ID
  if (isRealServerInteractionId(req.previousInteractionId)) {
    interactionsBody.previous_interaction_id = req.previousInteractionId;
  }

  let interactionsHttpError: string | null = null;
  try {
    const intRes = await fetchFn(GEMINI_INTERACTIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(interactionsBody),
      signal,
    });

    if (intRes.ok) {
      const data = (await intRes.json()) as Record<string, unknown>;
      const interactionId =
        typeof data.id === 'string' && data.id.trim().length > 0
          ? data.id
          : `int_argon_live_${Date.now().toString(36)}`;
      const usageMetadata = extractUsageMetadata(data);
      const outputText =
        typeof data.output_text === 'string'
          ? data.output_text
          : JSON.stringify(data.output ?? data);
      const parsed = extractJsonObjectFromText(outputText);
      if (parsed) {
        const course = (parsed.course ?? parsed) as CourseSpec;
        const reasoningTrace =
          typeof parsed.reasoningTrace === 'string'
            ? parsed.reasoningTrace
            : '[gemini-4-argon // Interactions API // thinking_level: high] Synthesized custom SDF course from 1M-token context.';
        if (course && typeof course.id === 'string' && Array.isArray(course.nodes)) {
          return {
            interactionId,
            executionSource: 'live-interactions-api',
            reasoningTrace,
            course,
            usageMetadata,
          };
        }
      }
    } else {
      interactionsHttpError = `Interactions API HTTP ${intRes.status}`;
    }
  } catch (err) {
    if (signal.aborted) {
      throw new Error('Gemini 4 Argon request timed out or was cancelled (45s limit).');
    }
    interactionsHttpError = err instanceof Error ? err.message : String(err);
  }

  // 2. Fallback to v1beta/models/gemini-4-argon:generateContent
  const generateBody = {
    systemInstruction: {
      parts: [{ text: req.systemInstruction }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: fullInput }],
      },
    ],
    generationConfig: {
      thinkingConfig: {
        thinkingLevel: 'HIGH',
      },
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  };

  const genRes = await fetchFn(
    `${GEMINI_ARGON_GENERATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateBody),
      signal,
    },
  );

  if (!genRes.ok) {
    let errDetail = '';
    try {
      const errBody = await genRes.text();
      if (errBody) errDetail = `: ${errBody.slice(0, 240)}`;
    } catch {
      // ignore
    }
    throw new Error(
      `Gemini 4 Argon HTTP ${genRes.status}${errDetail}${interactionsHttpError ? ` (after ${interactionsHttpError})` : ''}`,
    );
  }

  const genData = (await genRes.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
    usageMetadata?: unknown;
  };
  const usageMetadata = extractUsageMetadata(genData);
  const parts = genData.candidates?.[0]?.content?.parts ?? [];
  const thoughtParts = parts.filter((p) => p.thought && p.text).map((p) => p.text ?? '');
  const textParts = parts.filter((p) => !p.thought && p.text).map((p) => p.text ?? '');
  const combinedText = textParts.join('\n') || parts.map((p) => p.text ?? '').join('\n');
  const parsed = extractJsonObjectFromText(combinedText);

  const course = parsed ? ((parsed.course ?? parsed) as CourseSpec) : null;
  const reasoningTrace =
    thoughtParts.join('\n') ||
    (parsed && typeof parsed.reasoningTrace === 'string'
      ? parsed.reasoningTrace
      : '[gemini-4-argon // generateContent // thinkingLevel: HIGH] Live course synthesis complete.');

  return {
    interactionId: `gen_argon_live_${Date.now().toString(36)}`,
    executionSource: 'live-generate-content',
    reasoningTrace,
    course:
      course && typeof course.id === 'string' && Array.isArray(course.nodes)
        ? course
        : null,
    usageMetadata,
  };
}

/**
 * Calls `gemini-3.8-flash` (`thinkingLevel: "MEDIUM"`) in parallel as Agent 2
 * (Hazard & Portal Specialist) to generate synchronized SDF pistons, Steelies, and portals.
 */
async function callGemini38FlashHazardSpecialist(
  req: ArgonServerSynthesizeRequest,
  apiKey: string,
  fetchFn: typeof fetch,
  signal: AbortSignal,
): Promise<{
  hazards: readonly SdfPrimitiveNode[];
  summary: string;
}> {
  const flashPrompt = [
    'You are Agent 2 (gemini-3.8-flash, thinking_level: medium): Hazard & Portal Specialist for Marble Madness SDF.',
    'Given the player telemetry and course intent below, output JSON `{ "summary": string, "hazards": SdfPrimitiveNode[] }` with 1-3 synchronized kinematic hazards (`piston`, `sphere` with `steelie` kinematic, or `torus` portal rings).',
    req.dynamicTelemetryPrompt,
    `User Prompt: ${req.prompt}`,
  ].join('\n\n');

  const body = {
    contents: [{ role: 'user', parts: [{ text: flashPrompt }] }],
    generationConfig: {
      thinkingConfig: { thinkingLevel: 'MEDIUM' },
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetchFn(
    `${GEMINI_FLASH_GENERATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini 3.8 Flash HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('\n') ?? '';
  const parsed = extractJsonObjectFromText(text);
  const hazards = Array.isArray(parsed?.hazards)
    ? (parsed.hazards as SdfPrimitiveNode[])
    : [];
  const summary =
    typeof parsed?.summary === 'string'
      ? parsed.summary
      : `Synthesized ${hazards.length} parallel kinematic hazard node(s) via gemini-3.8-flash.`;

  return { hazards, summary };
}

/**
 * Executes the parallel Multi-Agent Swarm on the server when `GEMINI_API_KEY` is available.
 * Enforces a 45s `AbortController` timeout and returns real server errors when a live call fails.
 */
export async function executeServerArgonSwarm(
  req: ArgonServerSynthesizeRequest,
  envApiKey = process.env.GEMINI_API_KEY,
  fetchFn: typeof fetch = fetch,
): Promise<ArgonServerSynthesizeResponse> {
  const t0 = performance.now();
  const effectiveKey = req.apiKey?.trim() || envApiKey?.trim() || '';

  if (!effectiveKey) {
    return {
      ok: false,
      source: 'server-fallback',
      executionSource: 'offline-preset',
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: `int_argon_local_${Date.now().toString(36)}`,
      usageMetadata: null,
      error:
        'No GEMINI_API_KEY configured on server or provided in UI. Loaded offline preset (zero live tokens billed).',
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ARGON_REQUEST_TIMEOUT_MS);

  try {
    // Run Agent 1 (gemini-4-argon, high thinking) and Agent 2 (gemini-3.8-flash, medium thinking) in parallel!
    const [leadResult, flashResult] = await Promise.all([
      callGemini4ArgonLead(req, effectiveKey, fetchFn, controller.signal),
      callGemini38FlashHazardSpecialist(
        req,
        effectiveKey,
        fetchFn,
        controller.signal,
      ).catch(() => ({
        hazards: [] as readonly SdfPrimitiveNode[],
        summary: 'Agent 2 fallback: preserved Lead Architect hazard manifest.',
      })),
    ]);

    if (!leadResult.course) {
      return {
        ok: false,
        source: 'server-fallback',
        executionSource: 'offline-preset',
        modelId: 'gemini-4-argon',
        companionModelId: 'gemini-3.8-flash',
        thinkingLevel: 'high',
        interactionId: leadResult.interactionId,
        reasoningTrace: leadResult.reasoningTrace,
        usageMetadata: leadResult.usageMetadata,
        error:
          'Gemini 4 Argon response did not contain a valid CourseSpec JSON object.',
        latencyMs: Math.round((performance.now() - t0) * 100) / 100,
      };
    }

    const mergedCourse: CourseSpec =
      flashResult.hazards.length > 0
        ? {
            ...leadResult.course,
            hazards: [...(leadResult.course.hazards ?? []), ...flashResult.hazards],
          }
        : leadResult.course;

    return {
      ok: true,
      source: 'live-gemini-api',
      executionSource: leadResult.executionSource,
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: leadResult.interactionId,
      reasoningTrace: leadResult.reasoningTrace,
      course: mergedCourse,
      agent2Hazards: flashResult.hazards,
      agent2Summary: flashResult.summary,
      usageMetadata: leadResult.usageMetadata,
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  } catch (err) {
    return {
      ok: false,
      source: 'server-fallback',
      executionSource: 'offline-preset',
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: `int_argon_fallback_${Date.now().toString(36)}`,
      usageMetadata: null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  } finally {
    clearTimeout(timer);
  }
}

const LOOPBACK_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  'localhost',
]);

/**
 * Verifies that an HTTP request originated from the local demo machine (`127.0.0.1`, `::1`, `::ffff:127.0.0.1`)
 * and was not forwarded through a public tunnel (`cf-connecting-ip` / `x-forwarded-for`).
 */
export function isLocalhostRequest(req: IncomingMessage): boolean {
  const cfIpHeader = req.headers?.['cf-connecting-ip'];
  const cfIp = (Array.isArray(cfIpHeader) ? cfIpHeader[0] : cfIpHeader)?.trim();
  if (cfIp && !LOOPBACK_ADDRESSES.has(cfIp)) {
    return false;
  }

  const xffHeader = req.headers?.['x-forwarded-for'];
  const xffRaw = Array.isArray(xffHeader) ? xffHeader[0] : xffHeader;
  if (xffRaw) {
    const clientIp = xffRaw.split(',')[0]?.trim();
    if (clientIp && !LOOPBACK_ADDRESSES.has(clientIp)) {
      return false;
    }
  }

  const remoteAddress = req.socket?.remoteAddress?.trim();
  if (!remoteAddress) {
    return true;
  }
  return LOOPBACK_ADDRESSES.has(remoteAddress);
}

/**
 * Protects `/api/argon/*` live Gemini endpoints from public tunnel abuse:
 * requires either a localhost request OR a matching `x-argon-admin-token` / `DEMO_ADMIN_TOKEN`.
 */
export function isAuthorizedArgonRequest(
  req: IncomingMessage,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const configuredToken = (
    env.DEMO_ADMIN_TOKEN ??
    env.ARGON_ADMIN_TOKEN ??
    ''
  ).trim();

  const headerTokenRaw =
    req.headers?.['x-argon-admin-token'] ?? req.headers?.['x-demo-admin-token'];
  const providedToken = (
    Array.isArray(headerTokenRaw) ? headerTokenRaw[0] : headerTokenRaw
  )?.trim();

  if (configuredToken.length > 0 && providedToken === configuredToken) {
    return true;
  }

  return isLocalhostRequest(req);
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function attachArgonMiddleware(
  middlewares: {
    use: (
      route: string,
      fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
    ) => void;
  },
) {
  middlewares.use('/api/argon', async (req, res, next) => {
    const url = req.url ?? '/';
    if (req.method === 'GET' && url.startsWith('/status')) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          ok: true,
          hasEnvKey: Boolean(process.env.GEMINI_API_KEY),
          isLocalhost: isLocalhostRequest(req),
          leadModel: 'gemini-4-argon',
          companionModel: 'gemini-3.8-flash',
          verifierAgent: 'antigravity-preview-09-2026',
          thinkingLevel: 'high',
          contextWindow: 1_000_000,
          implicitCacheDiscount: 0.95,
        }),
      );
      return;
    }

    if (
      req.method === 'POST' &&
      (url.startsWith('/antigravity') ||
        url.startsWith('/tts') ||
        url.startsWith('/synthesize'))
    ) {
      if (!isAuthorizedArgonRequest(req)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error:
              'Forbidden: live Gemini API endpoints require localhost or valid x-argon-admin-token.',
          }),
        );
        return;
      }
    }

    if (req.method === 'POST' && url.startsWith('/antigravity/poll')) {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody) as {
          interactionId?: string;
          course?: CourseSpec;
          solvability?: CourseSolvabilityReport;
          repoUrl?: string;
          commitSha?: string;
          apiKey?: string;
        };
        const headerKey = req.headers['x-gemini-api-key'];
        const apiKeyFromHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
        if (!parsed.interactionId || !parsed.course || !parsed.solvability) {
          throw new Error('Antigravity poll requires interactionId, course, and solvability.');
        }
        const certificate = await pollAntigravitySandboxOnServer({
          interactionId: parsed.interactionId,
          course: parsed.course,
          solvability: {
            ...parsed.solvability,
            verifiedCourse: parsed.course,
          },
          repoUrl: parsed.repoUrl,
          commitSha: parsed.commitSha,
          apiKey: parsed.apiKey || apiKeyFromHeader,
          fetchFn: fetch,
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(certificate));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    if (req.method === 'POST' && url.startsWith('/antigravity')) {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody) as {
          prompt?: string;
          course?: CourseSpec;
          solvability?: CourseSolvabilityReport;
          repoUrl?: string;
          commitSha?: string;
          previousInteractionId?: string | null;
          apiKey?: string;
        };
        const headerKey = req.headers['x-gemini-api-key'];
        const apiKeyFromHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
        if (!parsed.course || !parsed.solvability) {
          throw new Error('Antigravity sandbox needs course and solvability.');
        }
        const certificate: AntigravitySandboxCertificate =
          await dispatchAntigravitySandboxOnServer({
            prompt: parsed.prompt ?? '',
            course: parsed.course,
            solvability: {
              ...parsed.solvability,
              verifiedCourse: parsed.course,
            },
            repoUrl: parsed.repoUrl,
            commitSha: parsed.commitSha,
            previousInteractionId: parsed.previousInteractionId,
            apiKey: parsed.apiKey || apiKeyFromHeader,
            fetchFn: fetch,
          });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(certificate));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    if (req.method === 'POST' && url.startsWith('/tts')) {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody) as { text?: string; apiKey?: string };
        const headerKey = req.headers['x-gemini-api-key'];
        const apiKeyFromHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
        const speech = await synthesizeArcadeSpeech(
          parsed.text ?? '',
          parsed.apiKey || apiKeyFromHeader,
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(speech));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    if (req.method === 'POST' && url.startsWith('/synthesize')) {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody) as ArgonServerSynthesizeRequest;
        const headerKey = req.headers['x-gemini-api-key'];
        const apiKeyFromHeader = Array.isArray(headerKey) ? headerKey[0] : headerKey;
        const result = await executeServerArgonSwarm({
          ...parsed,
          apiKey: parsed.apiKey || apiKeyFromHeader,
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
      }
      return;
    }

    next();
  });
}

/**
 * Vite plugin mounting `/api/argon/status`, `/api/argon/synthesize`, `/api/argon/antigravity`,
 * and `/api/argon/antigravity/poll` on both `vite dev` and `vite preview`.
 */
export function createArgonVitePlugin(): Plugin {
  return {
    name: 'marble-madness-argon-1m-swarm-proxy',
    configureServer(server) {
      attachArgonMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachArgonMiddleware(server.middlewares);
    },
  };
}
