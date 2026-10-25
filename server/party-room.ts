/**
 * In-Memory Wi-Fi & Public-Tunnel Party Room Server (`server/party-room.ts`)
 *
 * Provides:
 * - Automatic LAN IPv4 discovery via `os.networkInterfaces()`
 * - Automatic `PUBLIC_PARTY_URL` / Cloudflare Quick Tunnel detection for 5G/LTE & AP-isolated venue Wi-Fi
 * - Zero-database in-memory `PartyRoomEngine` instance
 * - Connect / Vite dev & preview server middleware (`/api/party/*` + `/api/party/stream` SSE)
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import {
  createPartyRoomEngine,
  type PartyRoomEngine,
  type PartyRoomEngineOptions,
} from '../src/multiplayer/party-room-engine';
import type {
  JoinPartyRequest,
  PartyActionPayload,
  PartyInputPayload,
  PartyPromptPayload,
  PartyRoomSnapshot,
} from '../src/multiplayer/party-types';

export { createPartyRoomEngine, type PartyRoomEngine, type PartyRoomEngineOptions };

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

/**
 * Detects an optional public tunnel URL from environment variables
 * (`PUBLIC_PARTY_URL`, `VITE_PUBLIC_PARTY_URL`, `TUNNEL_URL`) for venues with Wi-Fi AP isolation.
 */
export function detectPublicTunnelUrl(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw =
    env.PUBLIC_PARTY_URL ?? env.VITE_PUBLIC_PARTY_URL ?? env.TUNNEL_URL ?? null;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer | string) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

/**
 * Creates a Node HTTP / Connect / Vite middleware handling `/api/party/*` endpoints.
 */
export function createPartyRoomMiddleware(engine?: PartyRoomEngine) {
  const room =
    engine ??
    createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: detectLanIpv4Address(),
      port: 5173,
      customTunnelUrl: detectPublicTunnelUrl(),
    });

  const sseClients = new Set<ServerResponse>();

  const broadcastSse = (snapshot: PartyRoomSnapshot) => {
    if (sseClients.size === 0) return;
    const frame = `data: ${JSON.stringify(snapshot)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  room.subscribe(broadcastSse);

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

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    const pathname = urlStr.split('?')[0];

    try {
      if (req.method === 'GET' && pathname === '/api/party/state') {
        sendJson(res, 200, room.getSnapshot());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/party/stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(`data: ${JSON.stringify(room.getSnapshot())}\n\n`);
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/join') {
        const body = await readJsonBody<JoinPartyRequest>(req);
        const result = room.joinPlayer(body);
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/input') {
        const body = await readJsonBody<PartyInputPayload>(req);
        const player = room.updateInput(body);
        sendJson(res, 200, { ok: Boolean(player), player });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/action') {
        const body = await readJsonBody<PartyActionPayload>(req);
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
        const body = await readJsonBody<{ customTunnelUrl?: string | null }>(req);
        const snapshot = room.setCustomTunnelUrl(body.customTunnelUrl ?? null);
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }

      if (req.method === 'POST' && pathname === '/api/party/simulate') {
        const body = await readJsonBody<{ count?: number; stepOnly?: boolean }>(req);
        const snapshot = body.stepOnly
          ? room.stepSimulatedCrowdPhones()
          : room.spawnSimulatedCrowdPhones(body.count ?? 6);
        sendJson(res, 200, { ok: true, snapshot });
        return;
      }

      sendJson(res, 404, { error: 'Unknown party endpoint' });
    } catch (err) {
      sendJson(res, 400, {
        error: err instanceof Error ? err.message : 'Invalid request payload',
      });
    }
  };

  return {
    engine: room,
    middleware,
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
