/**
 * In-Memory Wi-Fi & Public-Tunnel Party Room Server (`server/party-room.ts`)
 *
 * Provides:
 * - Automatic LAN IPv4 discovery via `os.networkInterfaces()`
 * - Automatic `PUBLIC_PARTY_URL` / Cloudflare Quick Tunnel detection for 5G/LTE & AP-isolated venue Wi-Fi
 * - Zero-database in-memory `PartyRoomEngine` instance
 * - Connect / Vite dev & preview server middleware (`/api/party/*` + `/api/party/stream` SSE)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import {
  createPartyRoomEngine,
  type PartyRoomEngine,
  type PartyRoomEngineOptions,
} from '../src/multiplayer/party-room-engine';
import {
  MAX_INPUT_REQUESTS_PER_SEC,
  MAX_PARTY_BODY_BYTES,
  type JoinPartyRequest,
  type PartyActionPayload,
  type PartyInputPayload,
  type PartyPromptPayload,
  type PartyRoomSnapshot,
} from '../src/multiplayer/party-types';
import { isLocalhostRequest } from './argon-proxy';

export {
  createPartyRoomEngine,
  isLocalhostRequest,
  type PartyRoomEngine,
  type PartyRoomEngineOptions,
};

/**
 * Discovers the primary non-internal IPv4 LAN address (e.g. `192.168.x.x` or `10.x.x.x`)
 * so phones on the same Wi-Fi network can scan the QR code and join immediately.
 */
export function detectLanIpv4Address(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces(),
): string {
  const candidates: { address: string; priority: number }[] = [];

  for (const [name, infos] of Object.entries(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      const family = String(info.family);
      if ((family === 'IPv4' || family === '4') && !info.internal && info.address) {
        let priority = 10;
        const lower = name.toLowerCase();
        if (lower.startsWith('en') || lower.startsWith('wlan') || lower.startsWith('wifi')) {
          priority = 1;
        } else if (lower.startsWith('eth')) {
          priority = 2;
        }
        if (info.address.startsWith('192.168.')) {
          priority -= 0.5;
        } else if (info.address.startsWith('10.')) {
          priority -= 0.25;
        }
        candidates.push({ address: info.address, priority });
      }
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0]?.address ?? '127.0.0.1';
}

const DEAD_TUNNEL_HOSTS = new Set([
  'did-scott-yet-queens.trycloudflare.com',
  'argon-demo.trycloudflare.com',
]);

const TRY_CLOUDFLARE_URL_SOURCE = 'https:\\/\\/[a-z0-9-]+\\.trycloudflare\\.com';

const PARTY_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

/**
 * Last live `https://*.trycloudflare.com` in a cloudflared log. Dead hosts that
 * showed up in earlier playtests are skipped. Explicit env URLs are not filtered.
 */
export function extractTryCloudflareUrl(log: string): string | null {
  const matches = log.match(new RegExp(TRY_CLOUDFLARE_URL_SOURCE, 'gi'));
  if (!matches) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    const url = matches[i];
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (!DEAD_TUNNEL_HOSTS.has(host)) return url;
    } catch {
      // Ignore a truncated match.
    }
  }
  return null;
}

function readTunnelLog(logPath: string): string | null {
  try {
    return extractTryCloudflareUrl(fs.readFileSync(logPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Public tunnel for the party room.
 * `PUBLIC_PARTY_URL`, `VITE_PUBLIC_PARTY_URL`, or `TUNNEL_URL` wins so tests and
 * an operator override stay stable. Otherwise the active Mac cloudflared log
 * (`PARTY_TUNNEL_LOG` or `/tmp/marble-cf.log`) is read. Dead hosts are never
 * taken from that log.
 */
export function detectPublicTunnelUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = env.PUBLIC_PARTY_URL ?? env.VITE_PUBLIC_PARTY_URL ?? env.TUNNEL_URL ?? null;
  if (raw && raw.trim().length > 0) return raw.trim().replace(/\/+$/, '');

  if (env.PARTY_TUNNEL_LOG && env.PARTY_TUNNEL_LOG.trim().length > 0) {
    return readTunnelLog(env.PARTY_TUNNEL_LOG.trim());
  }
  if (env !== process.env) return null;
  return readTunnelLog('/tmp/marble-cf.log');
}

export class PayloadTooLargeError extends Error {
  readonly statusCode = 413;
  constructor(maxBytes = MAX_PARTY_BODY_BYTES) {
    super(`Payload Too Large (exceeded ${maxBytes} bytes)`);
    this.name = 'PayloadTooLargeError';
  }
}

function readJsonBody<T>(
  req: IncomingMessage,
  maxBytes = MAX_PARTY_BODY_BYTES,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer | string) => {
      if (rejected) return;
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      totalBytes += buf.byteLength;
      if (totalBytes > maxBytes) {
        rejected = true;
        reject(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => {
      if (!rejected) reject(err);
    });
  });
}

function extractPortFromHostHeader(req: IncomingMessage): number | null {
  const hostHeader = req.headers?.host;
  const rawHost = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!rawHost) return null;
  const match = rawHost.trim().match(/:(\d+)$/);
  if (!match) return null;
  const port = Number.parseInt(match[1], 10);
  return Number.isFinite(port) && port > 0 && port <= 65535 ? port : null;
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...PARTY_CORS_HEADERS,
  });
  res.end(body);
}

const SSE_TICK_INTERVAL_MS = 50; // Fixed 20 Hz SSE broadcast when dirty
const SSE_HEARTBEAT_INTERVAL_MS = 15_000; // 15s keep-alive heartbeat

/**
 * Creates a Node HTTP / Connect / Vite middleware handling `/api/party/*` endpoints.
 */
export function createPartyRoomMiddleware(engine?: PartyRoomEngine) {
  const detectedLanIp = detectLanIpv4Address();
  const room =
    engine ??
    createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: detectedLanIp,
      port: Number(process.env.PORT) || 5173,
      customTunnelUrl: detectPublicTunnelUrl(),
      mintSecret: () => crypto.randomBytes(16).toString('hex'),
    });

  const sseClients = new Set<ServerResponse>();
  let sseDirty = false;
  let latestSnapshot: PartyRoomSnapshot = room.getSnapshot();

  // Per-player sliding 1-second rate limiter for `/api/party/input` (max 25 req/sec)
  const inputRateWindows = new Map<string, { windowStartMs: number; count: number }>();

  function checkInputRateLimit(playerId: string, nowMs = Date.now()): boolean {
    const entry = inputRateWindows.get(playerId);
    if (!entry || nowMs - entry.windowStartMs >= 1000) {
      inputRateWindows.set(playerId, { windowStartMs: nowMs, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= MAX_INPUT_REQUESTS_PER_SEC;
  }

  const flushDirtySse = () => {
    if (!sseDirty || sseClients.size === 0) return;
    sseDirty = false;
    const frame = `data: ${JSON.stringify(latestSnapshot)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const sendSseHeartbeat = () => {
    if (sseClients.size === 0) return;
    for (const client of sseClients) {
      try {
        client.write(': heartbeat\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const sseTickTimer = setInterval(flushDirtySse, SSE_TICK_INTERVAL_MS);
  sseTickTimer.unref?.();

  const sseHeartbeatTimer = setInterval(sendSseHeartbeat, SSE_HEARTBEAT_INTERVAL_MS);
  sseHeartbeatTimer.unref?.();

  room.subscribe((snapshot: PartyRoomSnapshot) => {
    latestSnapshot = snapshot;
    sseDirty = true;
  });

  const middleware = async (
    req: IncomingMessage,
    res: ServerResponse,
    next?: () => void,
  ): Promise<void> => {
    const urlStr = req.url ?? '';
    if (!urlStr.startsWith('/api/party')) {
      if (next) next();
      return;
    }

    const detectedTunnel = detectPublicTunnelUrl();
    if (detectedTunnel) {
      const current = room.getSnapshot().customTunnelUrl?.replace(/\/+$/, '') ?? null;
      if (current !== detectedTunnel) {
        room.setCustomTunnelUrl(detectedTunnel);
      }
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, PARTY_CORS_HEADERS);
      res.end();
      return;
    }

    // Codex F4: Dynamically sync actual listening port from `req.headers.host` (e.g. 5176 vs 5173)
    const hostPort = extractPortFromHostHeader(req);
    const currentSnap = room.getSnapshot();
    if (hostPort && hostPort !== currentSnap.port) {
      room.setLanAddress(currentSnap.lanIp, hostPort);
    }

    const [pathname, rawQuery = ''] = urlStr.split('?');

    try {
      if (req.method === 'GET' && pathname === '/api/party/state') {
        const params = new URLSearchParams(rawQuery);
        const requestedRoom = params.get('room') ?? undefined;
        sendJson(res, 200, room.getSnapshot(undefined, requestedRoom));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/party/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          ...PARTY_CORS_HEADERS,
        });
        res.write(': heartbeat\n\n');
        res.write(`data: ${JSON.stringify(room.getSnapshot())}\n\n`);
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/join') {
        const body = await readJsonBody<JoinPartyRequest>(req);
        const isExistingValidSession =
          Boolean(body.playerId && body.playerSecret) &&
          room.verifyPlayerSecret(body.playerId!, body.playerSecret);

        const assignedPlayerId = isExistingValidSession
          ? body.playerId!
          : `plr_${crypto.randomBytes(8).toString('hex')}`;
        const assignedSecret = isExistingValidSession
          ? body.playerSecret!
          : crypto.randomBytes(16).toString('hex');

        const result = room.joinPlayer({
          ...body,
          playerId: assignedPlayerId,
          playerSecret: assignedSecret,
        });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/input') {
        const body = await readJsonBody<PartyInputPayload>(req);
        if (!room.verifyPlayerSecret(body.playerId, body.playerSecret)) {
          sendJson(res, 401, {
            ok: false,
            error: 'Unauthorized: valid playerSecret required for /api/party/input',
          });
          return;
        }
        if (!checkInputRateLimit(body.playerId)) {
          sendJson(res, 429, {
            ok: false,
            error: `Rate limit exceeded (max ${MAX_INPUT_REQUESTS_PER_SEC} inputs/sec)`,
          });
          return;
        }
        const player = room.updateInput(body);
        sendJson(res, 200, { ok: Boolean(player), player });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/action') {
        const body = await readJsonBody<PartyActionPayload>(req);
        if (!room.verifyPlayerSecret(body.playerId, body.playerSecret)) {
          sendJson(res, 401, {
            ok: false,
            error: 'Unauthorized: valid playerSecret required for /api/party/action',
          });
          return;
        }
        const result = room.triggerCrowdAction(body);
        sendJson(res, result.ok ? 200 : 429, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/prompt') {
        const body = await readJsonBody<PartyPromptPayload>(req);
        const result = room.submitCrowdPrompt(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/tunnel') {
        if (!isLocalhostRequest(req)) {
          sendJson(res, 403, {
            ok: false,
            error: 'Forbidden: /api/party/tunnel is restricted to localhost stage admin',
          });
          return;
        }
        const body = await readJsonBody<{ customTunnelUrl?: string | null }>(req);
        const snapshot = room.setCustomTunnelUrl(body.customTunnelUrl ?? null);
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/simulate') {
        if (!isLocalhostRequest(req)) {
          sendJson(res, 403, {
            ok: false,
            error: 'Forbidden: /api/party/simulate is restricted to localhost stage admin',
          });
          return;
        }
        const body = await readJsonBody<{ count?: number; stepOnly?: boolean }>(req);
        const snapshot = body.stepOnly
          ? room.stepSimulatedCrowdPhones()
          : room.spawnSimulatedCrowdPhones(body.count ?? 6);
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/room') {
        const body = await readJsonBody<{
          roomId?: string | number;
          maxMarblesPerRoom?: number;
        }>(req);
        let snapshot = room.getSnapshot();
        if (typeof body.maxMarblesPerRoom === 'number') {
          snapshot = room.setMaxMarblesPerRoom(body.maxMarblesPerRoom);
        }
        if (body.roomId !== undefined) {
          snapshot = room.setActiveRoom(body.roomId);
        }
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }

      sendJson(res, 404, { error: 'Unknown party endpoint' });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        sendJson(res, 413, {
          ok: false,
          error: err.message,
        });
        return;
      }
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Invalid request payload',
      });
    }
  };

  return {
    engine: room,
    middleware,
    flushDirtySse,
  };
}

/**
 * Vite plugin helper that mounts `/api/party/*` on both `vite dev` and `vite preview`.
 */
export function createPartyRoomVitePlugin(engine?: PartyRoomEngine) {
  const { engine: room, middleware } = createPartyRoomMiddleware(engine);
  return {
    name: 'marble-party-room-middleware',
    configureServer(server: { middlewares: { use: (fn: typeof middleware) => void } }) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server: { middlewares: { use: (fn: typeof middleware) => void } }) {
      server.middlewares.use(middleware);
    },
    partyRoomEngine: room,
  };
}
