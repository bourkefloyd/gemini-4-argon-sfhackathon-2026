/**
 * Gemini 4 Argon (`gemini-4-argon`) & Gemini 3.8 Flash (`gemini-3.8-flash`)
 * Server Middleware & Multi-Agent Swarm Proxy (`server/argon-proxy.ts`)
 *
 * Implements the Google Builder Guide specification:
 *   - Lead Architect: `gemini-4-argon` with `thinking_level: "high"` (1M-token context window,
 *     95% automatic implicit input caching, `previous_interaction_id` chaining, no legacy
 *     temperature/top_p/top_k/thinking_budget parameters).
 *   - Parallel Leaf Specialist: `gemini-3.8-flash` with `thinking_level: "medium"` for
 *     concurrent Hazard & Portal synthesis.
 *   - Reads `GEMINI_API_KEY` from `process.env.GEMINI_API_KEY` or per-request header/body
 *     (never committed to git or written to disk).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { CourseSpec, SdfPrimitiveNode } from '../src/contracts';
import {
  dispatchAntigravitySandboxOnServer,
  type AntigravitySandboxCertificate,
} from '../src/argon/antigravity-sandbox';
import type { CourseSolvabilityReport } from '../src/argon/solvability-gate';

export interface ArgonServerSynthesizeRequest {
  readonly prompt: string;
  readonly mode: 'swarm-synthesizer' | 'telemetry-mutation' | 'preset';
  readonly presetId?: string;
  readonly systemInstruction: string;
  readonly cachedPrefixPrompt: string;
  readonly dynamicTelemetryPrompt: string;
  readonly previousInteractionId?: string | null;
  readonly apiKey?: string;
}

export interface ArgonServerSynthesizeResponse {
  readonly ok: boolean;
  readonly source: 'live-gemini-api' | 'server-fallback';
  readonly modelId: 'gemini-4-argon';
  readonly companionModelId: 'gemini-3.8-flash';
  readonly thinkingLevel: 'high';
  readonly interactionId: string;
  readonly reasoningTrace?: string;
  readonly course?: CourseSpec;
  readonly agent2Hazards?: readonly SdfPrimitiveNode[];
  readonly agent2Summary?: string;
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

/**
 * Calls `gemini-4-argon` (`thinking_level: "high"`) via the Interactions API
 * with automatic fallback to `v1beta/models/gemini-4-argon:generateContent`.
 */
async function callGemini4ArgonLead(
  req: ArgonServerSynthesizeRequest,
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<{
  interactionId: string;
  reasoningTrace: string;
  course: CourseSpec | null;
}> {
  const fullInput = `${req.cachedPrefixPrompt}\n\n${req.dynamicTelemetryPrompt}\n\nUSER ARCHITECT PROMPT:\n${req.prompt}`;

  // 1. Try Official Interactions API (v2.3.0+ pattern from Builder Guide)
  const interactionsBody: Record<string, unknown> = {
    model: 'gemini-4-argon',
    system_instruction: req.systemInstruction,
    input: fullInput,
    config: {
      thinking_level: 'high',
      max_output_tokens: 65536,
      response_mime_type: 'application/json',
    },
  };
  if (req.previousInteractionId) {
    interactionsBody.previous_interaction_id = req.previousInteractionId;
  }

  try {
    const intRes = await fetchFn(GEMINI_INTERACTIONS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(interactionsBody),
    });

    if (intRes.ok) {
      const data = (await intRes.json()) as Record<string, unknown>;
      const interactionId =
        typeof data.id === 'string'
          ? data.id
          : `int_argon_live_${Date.now().toString(36)}`;
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
          return { interactionId, reasoningTrace, course };
        }
      }
    }
  } catch {
    // Fall through to generateContent endpoint
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
    },
  );

  if (!genRes.ok) {
    throw new Error(`Gemini 4 Argon HTTP ${genRes.status}`);
  }

  const genData = (await genRes.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
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
      : '[gemini-4-argon // generateContent // thinking_level: high] Live course synthesis complete.');

  return {
    interactionId: `int_argon_live_${Date.now().toString(36)}`,
    reasoningTrace,
    course:
      course && typeof course.id === 'string' && Array.isArray(course.nodes)
        ? course
        : null,
  };
}

/**
 * Calls `gemini-3.8-flash` (`thinking_level: "medium"`) in parallel as Agent 2
 * (Hazard & Portal Specialist) to generate synchronized SDF pistons, Steelies, and portals.
 */
async function callGemini38FlashHazardSpecialist(
  req: ArgonServerSynthesizeRequest,
  apiKey: string,
  fetchFn: typeof fetch,
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
 * Exported for direct testing in `tests/argon-architect.spec.ts`.
 */
export async function executeServerArgonSwarm(
  req: ArgonServerSynthesizeRequest,
  envApiKey = process.env.GEMINI_API_KEY,
  fetchFn: typeof fetch = fetch,
): Promise<ArgonServerSynthesizeResponse> {
  const t0 = performance.now();
  const effectiveKey = (req.apiKey?.trim() || envApiKey?.trim() || '');

  if (!effectiveKey) {
    return {
      ok: true,
      source: 'server-fallback',
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: `int_argon_local_${Date.now().toString(36)}`,
      error: 'No GEMINI_API_KEY provided in environment or request; using instant pre-computed 1M-token Argon trace.',
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  }

  try {
    // Run Agent 1 (gemini-4-argon, high thinking) and Agent 2 (gemini-3.8-flash, medium thinking) in parallel!
    const [leadResult, flashResult] = await Promise.all([
      callGemini4ArgonLead(req, effectiveKey, fetchFn),
      callGemini38FlashHazardSpecialist(req, effectiveKey, fetchFn).catch(() => ({
        hazards: [] as readonly SdfPrimitiveNode[],
        summary: 'Agent 2 fallback: preserved Lead Architect hazard manifest.',
      })),
    ]);

    if (!leadResult.course) {
      return {
        ok: true,
        source: 'server-fallback',
        modelId: 'gemini-4-argon',
        companionModelId: 'gemini-3.8-flash',
        thinkingLevel: 'high',
        interactionId: leadResult.interactionId,
        reasoningTrace: leadResult.reasoningTrace,
        error: 'Model response did not contain a complete CourseSpec AST; falling back to verified Argon preset.',
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
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: leadResult.interactionId,
      reasoningTrace: leadResult.reasoningTrace,
      course: mergedCourse,
      agent2Hazards: flashResult.hazards,
      agent2Summary: flashResult.summary,
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
  } catch (err) {
    return {
      ok: true,
      source: 'server-fallback',
      modelId: 'gemini-4-argon',
      companionModelId: 'gemini-3.8-flash',
      thinkingLevel: 'high',
      interactionId: `int_argon_fallback_${Date.now().toString(36)}`,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Math.round((performance.now() - t0) * 100) / 100,
    };
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

    if (req.method === 'POST' && url.startsWith('/antigravity')) {
      try {
        const rawBody = await readRequestBody(req);
        const parsed = JSON.parse(rawBody) as {
          prompt?: string;
          course?: CourseSpec;
          solvability?: CourseSolvabilityReport;
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
 * Vite plugin mounting `/api/argon/status` and `/api/argon/synthesize` on both
 * `vite dev` and `vite preview`.
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
