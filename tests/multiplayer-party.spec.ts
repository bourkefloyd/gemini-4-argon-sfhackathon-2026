import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PNG } from 'pngjs';
import { Resvg } from '@resvg/resvg-js';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { COURSE_1_PRACTICE_RACE, COURSE_2_INTERMEDIATE_MADNESS } from '../src/courses';
import { createInitialMarbleState } from '../src/physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import { createCpuWorldEvaluator, evaluateSdfTree } from '../src/sdf/eval-cpu';
import {
  applyCrowdMutationsToCourse,
  GITHUB_PAGES_PARTY_ORIGIN,
  buildPartyControllerUrl,
  buildPartyJoinUrl,
  createMultiMarbleArenaSimulation,
  createPartyRoomClient,
  createPartyRoomEngine,
  detectBrowserTunnelOrigin,
  MAX_PLAYERS,
  parsePartyUrlQuery,
  partyJoinUrlForViewer,
  PLAYER_MARBLE_PALETTE,
  renderQrSvg,
  resolvePartyApiBase,
  resolveMarbleCollisions,
  type JoinPartyResponse,
} from '../src/multiplayer';
import {
  createPartyRoomMiddleware,
  detectLanIpv4Address,
  detectPublicTunnelUrl,
  extractTryCloudflareUrl,
  isLocalhostRequest,
} from '../server/party-room';

async function decodeQrSvg(svg: string): Promise<string | null> {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 640 } }).render().asPng();
  const image = PNG.sync.read(png);
  const decoded = jsQR(new Uint8ClampedArray(image.data), image.width, image.height);
  return decoded?.data ?? null;
}
import { isAuthorizedArgonRequest } from '../server/argon-proxy';

describe('QR Party Multiplayer Module — QR SVG, In-Memory Room, Tunnel & Bumper Physics', () => {
  it('renders a black-on-white ISO QR that a real decoder reads back', async () => {
    const joinUrl = `${GITHUB_PAGES_PARTY_ORIGIN}/?party=1&room=ARGON&api=${encodeURIComponent(
      'https://live-mac.trycloudflare.com',
    )}`;
    const created = QRCode.create(joinUrl, { errorCorrectionLevel: 'M' });
    const quiet = created.modules.size + 8;

    const svg = await renderQrSvg(joinUrl, {
      sizePx: 280,
      marginModules: 3,
      darkColor: '#050811',
      lightColor: '#111111',
    });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="280"');
    expect(svg).toContain('height="280"');
    expect(svg).toContain(`viewBox="0 0 ${quiet} ${quiet}"`);
    expect(svg).toContain('#000000');
    expect(svg).toContain('#ffffff');
    expect(svg).not.toContain('#050811');
    expect(svg).not.toContain('#070b14');
    expect(await decodeQrSvg(svg)).toBe(joinUrl);
  });

  it('auto-detects LAN IPv4 addresses and PUBLIC_PARTY_URL tunnel overrides for AP-isolated venues', () => {
    const detectedIp = detectLanIpv4Address({
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8',
        },
      ],
      en0: [
        {
          address: '192.168.4.88',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: 'aa:bb:cc:dd:ee:ff',
          internal: false,
          cidr: '192.168.4.88/24',
        },
      ],
    });
    expect(detectedIp).toBe('192.168.4.88');

    const tunnel = detectPublicTunnelUrl({
      PUBLIC_PARTY_URL: 'https://argon-sf-demo.trycloudflare.com',
    });
    expect(tunnel).toBe('https://argon-sf-demo.trycloudflare.com');

    const parsed = parsePartyUrlQuery(
      '?party=1&room=shack15&public-url=https://shack15.trycloudflare.com',
    );
    expect(parsed.isPartyController).toBe(true);
    expect(parsed.roomCode).toBe('SHACK15');
    expect(parsed.publicTunnelOverride).toBe('https://shack15.trycloudflare.com');
    expect(parsed.apiBase).toBeNull();

    const withApi = parsePartyUrlQuery(
      '?party=1&room=ARGON&api=https%3A%2F%2Flive-mac.trycloudflare.com',
    );
    expect(withApi.apiBase).toBe('https://live-mac.trycloudflare.com');
    expect(
      resolvePartyApiBase(
        '?party=1&room=ARGON&api=https://live-mac.trycloudflare.com/api/party/state',
        'bourkefloyd.github.io',
      ),
    ).toBe('https://live-mac.trycloudflare.com');
    expect(
      resolvePartyApiBase('', 'bourkefloyd.github.io', 'https://live-mac.trycloudflare.com/'),
    ).toBe('https://live-mac.trycloudflare.com');
    expect(resolvePartyApiBase('', 'localhost', 'https://live-mac.trycloudflare.com')).toBe('');

    const scanned = partyJoinUrlForViewer({
      roomCode: 'argon',
      serverJoinUrl: 'https://live-mac.trycloudflare.com/?party=1&room=ARGON',
      tunnelOrigin: 'https://live-mac.trycloudflare.com',
    });
    expect(scanned).toBe(
      `${GITHUB_PAGES_PARTY_ORIGIN}/?party=1&room=ARGON&api=https%3A%2F%2Flive-mac.trycloudflare.com`,
    );
    expect(new URL(scanned).pathname).toBe('/gemini-4-argon-sfhackathon-2026/');
    expect(
      buildPartyControllerUrl({
        origin: 'https://bourkefloyd.github.io',
        pathname: '/gemini-4-argon-sfhackathon-2026',
        roomCode: 'ARGON',
        apiBase: 'https://live-mac.trycloudflare.com',
      }),
    ).toBe(scanned);

    const log = [
      'old https://did-scott-yet-queens.trycloudflare.com',
      'placeholder https://argon-demo.trycloudflare.com',
      'live https://live-mac-tunnel.trycloudflare.com',
    ].join('\n');
    expect(extractTryCloudflareUrl(log)).toBe('https://live-mac-tunnel.trycloudflare.com');
    expect(extractTryCloudflareUrl('https://did-scott-yet-queens.trycloudflare.com')).toBeNull();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'party-tunnel-'));
    const logPath = path.join(dir, 'cloudflared.log');
    fs.writeFileSync(logPath, 'https://from-log.trycloudflare.com\n');
    expect(detectPublicTunnelUrl({ PARTY_TUNNEL_LOG: logPath })).toBe(
      'https://from-log.trycloudflare.com',
    );
    expect(
      detectPublicTunnelUrl({
        PUBLIC_PARTY_URL: 'https://argon-sf-demo.trycloudflare.com/',
        PARTY_TUNNEL_LOG: logPath,
      }),
    ).toBe('https://argon-sf-demo.trycloudflare.com');
    expect(detectPublicTunnelUrl({})).toBeNull();
  });

  it('assigns up to 6 players into one server-owned room with distinct marble colors and replaces AI bots when a human joins', () => {
    const defaultRoom = createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: '192.168.1.50',
      port: 5173,
    });

    expect(MAX_PLAYERS).toBe(6);
    expect(PLAYER_MARBLE_PALETTE.map((c) => c.hex)).toEqual([
      '#00d8ff',
      '#10b981',
      '#f59e0b',
      '#ec4899',
      '#8b5cf6',
      '#ef4444',
    ]);
    expect(defaultRoom.getSnapshot().maxMarblesPerRoom).toBe(6);

    // Fill all 6 slots with AI bots via 1-click Fill Open Slots
    const simSnap = defaultRoom.spawnSimulatedCrowdPhones(6);
    expect(simSnap.players.length).toBe(6);
    expect(simSnap.players.every((p) => p.isSimulated)).toBe(true);
    expect(simSnap.players.map((p) => p.racerSlot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(simSnap.players.map((p) => p.colorHex)).toEqual([
      '#00d8ff',
      '#10b981',
      '#f59e0b',
      '#ec4899',
      '#8b5cf6',
      '#ef4444',
    ]);

    // When a human scans the QR code on a full 6-bot room, they immediately replace an AI bot slot
    const humanJoin = defaultRoom.joinPlayer({
      playerId: 'human_phone_1',
      handle: 'bourke',
    });
    expect(humanJoin.player.role).toBe('racer');
    expect(humanJoin.player.racerSlot).not.toBeNull();
    expect(humanJoin.player.racerSlot!).toBeGreaterThanOrEqual(0);
    expect(humanJoin.player.racerSlot!).toBeLessThan(6);
    expect(humanJoin.player.colorHex).toBe(PLAYER_MARBLE_PALETTE[humanJoin.player.racerSlot!].hex);
    expect(defaultRoom.getSnapshot().players.filter((p) => !p.isSimulated).length).toBe(1);
    expect(defaultRoom.getSnapshot().players.length).toBe(6);

    // Explicit multi-room overflow still works when configured with maxMarblesPerRoom: 4, autoOverflow: true
    const room = createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: '192.168.1.50',
      port: 5173,
      maxMarblesPerRoom: 4,
      autoOverflow: true,
    });

    expect(room.getSnapshot().maxMarblesPerRoom).toBe(4);

    // Join 10 players scanning the master QR code (?party=1&room=ARGON or room=AUTO)
    const joinResults = [];
    for (let i = 1; i <= 10; i++) {
      const res = room.joinPlayer({
        roomCode: i % 2 === 0 ? 'AUTO' : 'ARGON',
        playerId: `overflow_p_${i}`,
        handle: `racer_${i}`,
      });
      joinResults.push(res);
    }

    // Players 1..4 fill ARGON-1
    for (let i = 0; i < 4; i++) {
      expect(joinResults[i].roomId).toBe('ARGON-1');
      expect(joinResults[i].roomIndex).toBe(1);
      expect(joinResults[i].roomPlayerCount).toBe(i + 1);
      expect(joinResults[i].maxMarblesPerRoom).toBe(4);
      expect(joinResults[i].autoOverflowed).toBe(false);
    }

    // Players 5..8 automatically overflow into ARGON-2
    for (let i = 4; i < 8; i++) {
      expect(joinResults[i].roomId).toBe('ARGON-2');
      expect(joinResults[i].roomIndex).toBe(2);
      expect(joinResults[i].roomPlayerCount).toBe(i - 4 + 1);
      expect(joinResults[i].maxMarblesPerRoom).toBe(4);
      expect(joinResults[i].autoOverflowed).toBe(true);
    }

    // Players 9..10 automatically overflow into ARGON-3
    for (let i = 8; i < 10; i++) {
      expect(joinResults[i].roomId).toBe('ARGON-3');
      expect(joinResults[i].roomIndex).toBe(3);
      expect(joinResults[i].roomPlayerCount).toBe(i - 8 + 1);
      expect(joinResults[i].maxMarblesPerRoom).toBe(4);
      expect(joinResults[i].autoOverflowed).toBe(true);
    }

    const lastJoin = joinResults[9];
    expect(lastJoin.allRoomsSummary).toEqual([
      {
        roomId: 'ARGON-1',
        roomIndex: 1,
        playerCount: 4,
        maxPlayers: 4,
        isFull: true,
        leaderName: 'racer_1',
      },
      {
        roomId: 'ARGON-2',
        roomIndex: 2,
        playerCount: 4,
        maxPlayers: 4,
        isFull: true,
        leaderName: 'racer_5',
      },
      {
        roomId: 'ARGON-3',
        roomIndex: 3,
        playerCount: 2,
        maxPlayers: 4,
        isFull: false,
        leaderName: 'racer_9',
      },
    ]);

    // Host can switch the active Stage room between ARGON-1, ARGON-2, and ARGON-3
    const snapRoom2 = room.setActiveRoom('ARGON-2');
    expect(snapRoom2.roomId).toBe('ARGON-2');
    expect(snapRoom2.roomIndex).toBe(2);
    expect(snapRoom2.roomPlayerCount).toBe(4);
    expect(snapRoom2.roomPlayers.map((p) => p.handle)).toEqual([
      'racer_5',
      'racer_6',
      'racer_7',
      'racer_8',
    ]);

    // Reconfiguring maxMarblesPerRoom to 6 (clamped 4..8) updates room capacity dynamically
    const snapCap6 = room.setMaxMarblesPerRoom(6);
    expect(snapCap6.maxMarblesPerRoom).toBe(6);
  });

  it('manages 8 Arena Racers, unlimited Crowd Architects, 4s CSG cooldowns, Argon twists, and 6-Phone Simulation', () => {
    let clockMs = 10_000;
    const room = createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: '192.168.1.50',
      port: 5173,
      maxMarblesPerRoom: 8,
      autoOverflow: false,
      now: () => clockMs,
    });

    // Join 10 players: first 8 become Arena Racers (slots 0..7), #9 and #10 become Crowd Architects
    for (let i = 1; i <= 10; i++) {
      room.joinPlayer({
        playerId: `p_${i}`,
        handle: `player_${i}`,
      });
    }

    const snap10 = room.getSnapshot();
    const racers = snap10.players.filter((p) => p.role === 'racer');
    const architects = snap10.players.filter((p) => p.role === 'architect');
    expect(racers.length).toBe(8);
    expect(architects.length).toBe(2);
    expect(racers.map((r) => r.racerSlot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);

    // Update virtual trackball input for racer #1
    const updatedRacer = room.updateInput({
      playerId: 'p_1',
      moveXZ: [0.8, -0.6],
      jumpPressed: true,
      backspinActive: true,
    });
    expect(updatedRacer?.input.moveXZ[0]).toBeCloseTo(0.8, 3);
    expect(updatedRacer?.input.moveXZ[1]).toBeCloseTo(-0.6, 3);
    expect(updatedRacer?.input.jumpPressed).toBe(true);
    expect(updatedRacer?.input.backspinActive).toBe(true);

    // Crowd Architect #9 triggers a Rescue Bridge (`smoothUnion`)
    const bridgeRes = room.triggerCrowdAction({
      playerId: 'p_9',
      kind: 'rescueBridge',
      targetPosition: [0, 3.2, -8.0],
    });
    expect(bridgeRes.ok).toBe(true);
    expect(bridgeRes.mutation?.kind).toBe('rescueBridge');
    expect(bridgeRes.toast?.text).toContain('@player_9');
    expect(bridgeRes.toast?.text).toContain('extruded a Rescue Bridge!');

    // Immediate second click within 4.0s cooldown is rejected with remaining time
    clockMs += 1500;
    const cooldownRes = room.triggerCrowdAction({
      playerId: 'p_9',
      kind: 'craterMortar',
    });
    expect(cooldownRes.ok).toBe(false);
    expect(cooldownRes.cooldownRemainingMs).toBeCloseTo(2500, 0);

    // After 4.0s cooldown expires, player_9 can fire Crater Mortar (`smoothSubtract`)
    clockMs += 2600;
    const craterRes = room.triggerCrowdAction({
      playerId: 'p_9',
      kind: 'craterMortar',
      targetPosition: [0.5, 2.5, -12.0],
    });
    expect(craterRes.ok).toBe(true);
    expect(craterRes.mutation?.kind).toBe('craterMortar');

    // Submit & upvote 5-word Argon 1M Crowd Twists (truncates beyond 5 words automatically)
    const p1 = room.submitCrowdPrompt({
      playerId: 'p_10',
      twist: 'low gravity ice pinball extra words ignored',
    });
    expect(p1.prompt?.twist).toBe('low gravity ice pinball extra');
    expect(p1.prompt?.votes).toBe(1);

    const p2 = room.submitCrowdPrompt({
      playerId: 'p_9',
      twist: 'low gravity ice pinball extra',
    });
    expect(p2.prompt?.votes).toBe(2);

    // Editable public tunnel override updates joinUrl for 5G/LTE QR scanning
    const tunnelSnap = room.setCustomTunnelUrl('https://argon-live.trycloudflare.com');
    expect(tunnelSnap.joinUrl).toBe(
      'https://argon-live.trycloudflare.com/?party=1&room=ARGON',
    );

    // Removing an Arena Racer promotes the top-scoring Crowd Architect (`p_9`) into the freed slot!
    const afterRemove = room.removePlayer('p_3');
    const promoted = afterRemove.players.find((p) => p.playerId === 'p_9');
    expect(promoted?.role).toBe('racer');
    expect(promoted?.racerSlot).toBe(2);

    // Reset and test 1-click "Simulate 6 Crowd Phones" stage fallback
    room.reset();
    const simSnap = room.spawnSimulatedCrowdPhones(6);
    expect(simSnap.players.length).toBe(6);
    expect(simSnap.activeMutations.length).toBeGreaterThanOrEqual(3);
    expect(simSnap.crowdPrompts.length).toBeGreaterThanOrEqual(3);

    clockMs += 5000;
    const steppedSnap = room.stepSimulatedCrowdPhones();
    expect(steppedSnap.players.every((p) => p.isSimulated)).toBe(true);
  });

  it('serves /api/party/* HTTP endpoints with server-issued playerSecret, localhost lockdown, rate limits, 16KB body cap, and 60s expiry', async () => {
    const { engine, middleware } = createPartyRoomMiddleware();

    const invokeJson = async (
      method: 'GET' | 'POST',
      url: string,
      body?: unknown,
      extraHeaders: Record<string, string> = {},
      remoteAddress = '127.0.0.1',
    ): Promise<{ statusCode: number; data: unknown }> => {
      const payloadStr =
        typeof body === 'string' ? body : body ? JSON.stringify(body) : '';
      const stream = Readable.from(payloadStr ? [Buffer.from(payloadStr)] : []);
      const req = Object.assign(stream, {
        method,
        url,
        headers: { 'content-type': 'application/json', ...extraHeaders },
        socket: { remoteAddress },
      }) as unknown as IncomingMessage;

      let statusCode = 200;
      let responseBody = '';
      const res = {
        writeHead(code: number) {
          statusCode = code;
          return this;
        },
        end(chunk?: string | Buffer) {
          if (chunk) {
            responseBody += chunk.toString();
          }
        },
      } as unknown as ServerResponse;

      await middleware(req, res);
      return {
        statusCode,
        data: responseBody ? JSON.parse(responseBody) : null,
      };
    };

    // 1. Join mints a server-issued playerId and 32-char hex playerSecret
    // Also test Codex F4: Host header port 5176 updates engine joinUrl port dynamically
    const joinRes = await invokeJson(
      'POST',
      '/api/party/join',
      {
        playerId: 'client_spoof_attempt',
        handle: 'ivan_leo',
      },
      { host: '192.168.1.42:5176' },
    );
    expect(joinRes.statusCode).toBe(200);
    const joined = joinRes.data as JoinPartyResponse;
    expect(joined.playerId).toMatch(/^plr_[0-9a-f]{16}$/);
    expect(joined.playerSecret).toMatch(/^[0-9a-f]{32}$/);
    expect(engine.getSnapshot().port).toBe(5176);

    // 2. Calling /api/party/input or /api/party/action without valid playerSecret returns 401
    const unauthInput = await invokeJson('POST', '/api/party/input', {
      playerId: joined.playerId,
      moveXZ: [0.5, -0.5],
    });
    expect(unauthInput.statusCode).toBe(401);

    const unauthAction = await invokeJson('POST', '/api/party/action', {
      playerId: joined.playerId,
      playerSecret: 'wrong_secret',
      kind: 'tectonicRamp',
    });
    expect(unauthAction.statusCode).toBe(401);

    // 3. With valid server-issued playerSecret, /api/party/input and /api/party/action succeed
    const validInput = await invokeJson('POST', '/api/party/input', {
      playerId: joined.playerId,
      playerSecret: joined.playerSecret,
      moveXZ: [0.5, -0.5],
    });
    expect(validInput.statusCode).toBe(200);

    const validAction = await invokeJson('POST', '/api/party/action', {
      playerId: joined.playerId,
      playerSecret: joined.playerSecret,
      kind: 'tectonicRamp',
    });
    expect(validAction.statusCode).toBe(200);

    // 4. Rate limit on /api/party/input (>25 requests/sec returns 429)
    let hitRateLimit = false;
    for (let i = 0; i < 30; i++) {
      const r = await invokeJson('POST', '/api/party/input', {
        playerId: joined.playerId,
        playerSecret: joined.playerSecret,
        moveXZ: [0.1, -0.2],
      });
      if (r.statusCode === 429) {
        hitRateLimit = true;
        break;
      }
    }
    expect(hitRateLimit).toBe(true);

    // 5. Reject request bodies > 16 KB with 413 Payload Too Large
    const oversizedBody = JSON.stringify({ handle: 'x'.repeat(18 * 1024) });
    const tooLargeRes = await invokeJson('POST', '/api/party/join', oversizedBody);
    expect(tooLargeRes.statusCode).toBe(413);

    // 6. Lock down /api/party/tunnel and /api/party/simulate to localhost only (403 on public tunnel)
    const externalTunnelAttempt = await invokeJson(
      'POST',
      '/api/party/tunnel',
      { customTunnelUrl: 'https://evil.example.com' },
      { 'cf-connecting-ip': '203.0.113.42' },
    );
    expect(externalTunnelAttempt.statusCode).toBe(403);

    const externalSimulateAttempt = await invokeJson(
      'POST',
      '/api/party/simulate',
      { count: 6 },
      {},
      '203.0.113.99',
    );
    expect(externalSimulateAttempt.statusCode).toBe(403);

    // Localhost (127.0.0.1 / ::1) succeeds
    const simRes = await invokeJson('POST', '/api/party/simulate', { count: 6 });
    expect(simRes.statusCode).toBe(200);
    expect(engine.getSnapshot().players.length).toBeGreaterThanOrEqual(6);

    // 7. Verify /api/argon/* authorization helper (localhost OR DEMO_ADMIN_TOKEN)
    expect(
      isLocalhostRequest({
        headers: {},
        socket: { remoteAddress: '::1' },
      } as unknown as IncomingMessage),
    ).toBe(true);
    expect(
      isAuthorizedArgonRequest(
        {
          headers: { 'cf-connecting-ip': '198.51.100.7' },
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as IncomingMessage,
        { DEMO_ADMIN_TOKEN: 'secret-stage-token' },
      ),
    ).toBe(false);
    expect(
      isAuthorizedArgonRequest(
        {
          headers: {
            'cf-connecting-ip': '198.51.100.7',
            'x-argon-admin-token': 'secret-stage-token',
          },
          socket: { remoteAddress: '127.0.0.1' },
        } as unknown as IncomingMessage,
        { DEMO_ADMIN_TOKEN: 'secret-stage-token' },
      ),
    ).toBe(true);

    // 8. Verify 60s idle player expiry in PartyRoomEngine
    let simClock = 1_000;
    const expiryEngine = createPartyRoomEngine({
      roomCode: 'ARGON',
      now: () => simClock,
    });
    expiryEngine.joinPlayer({ playerId: 'idle_1', handle: 'sleepy_marble' });
    expect(expiryEngine.getSnapshot().players.length).toBe(1);
    simClock += 61_000; // > 60s idle timeout
    expect(expiryEngine.getSnapshot().players.length).toBe(0);
  });

  it('answers party preflight from GitHub Pages with wildcard CORS', async () => {
    const { middleware } = createPartyRoomMiddleware();
    const corsHeaders: Record<string, string | number | string[]> = {};
    let optionsStatus = 0;
    const optionsReq = Object.assign(Readable.from([]), {
      method: 'OPTIONS',
      url: '/api/party/join',
      headers: {
        origin: 'https://bourkefloyd.github.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    }) as unknown as IncomingMessage;
    const optionsRes = {
      writeHead(code: number, hdrs?: Record<string, string | number | string[]>) {
        optionsStatus = code;
        if (hdrs) Object.assign(corsHeaders, hdrs);
        return this;
      },
      end() {
        return this;
      },
    } as unknown as ServerResponse;
    await middleware(optionsReq, optionsRes);
    expect(optionsStatus).toBe(204);
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
    expect(String(corsHeaders['Access-Control-Allow-Methods'])).toContain('OPTIONS');
    expect(String(corsHeaders['Access-Control-Allow-Headers'])).toContain('Content-Type');
    expect(String(corsHeaders['Access-Control-Allow-Headers'])).toContain('Accept');
  });

  it('fixes Codex F4 (GitHub Pages base path preservation) and Codex F5 (React StrictMode BroadcastChannel remount)', async () => {
    // Codex F4: Preserve /gemini-4-argon-sfhackathon-2026/ base path when hosted on GitHub Pages
    const ghPagesOrigin = detectBrowserTunnelOrigin({
      hostname: 'bourkefloyd.github.io',
      origin: 'https://bourkefloyd.github.io',
      pathname: '/gemini-4-argon-sfhackathon-2026/',
      search: '',
    });
    expect(ghPagesOrigin).toBe(
      'https://bourkefloyd.github.io/gemini-4-argon-sfhackathon-2026/',
    );

    const ghJoinUrl = buildPartyJoinUrl(
      '192.168.1.42',
      5173,
      'ARGON',
      ghPagesOrigin,
      '/gemini-4-argon-sfhackathon-2026/',
    );
    expect(ghJoinUrl).toBe(
      'https://bourkefloyd.github.io/gemini-4-argon-sfhackathon-2026/?party=1&room=ARGON',
    );

    // Codex F5: client.connect() -> client.dispose() -> client.connect() -> client.sendAction()
    // must re-open BroadcastChannel and never throw InvalidStateError: BroadcastChannel is closed
    const engine = createPartyRoomEngine({ roomCode: 'ARGON' });
    const client = createPartyRoomClient({
      roomCode: 'ARGON',
      enableNetwork: false,
      localEngine: engine,
    });

    const joinRes = await client.join({ handle: 'strict_mode_tester' });
    client.connect();
    client.dispose(); // Simulates React 19 StrictMode unmount closing BroadcastChannel
    client.connect(); // Simulates React 19 StrictMode remount

    const actionRes = await client.sendAction(joinRes.playerId, 'rescueBridge');
    expect(actionRes.ok).toBe(true);
    expect(actionRes.mutation?.kind).toBe('rescueBridge');
    client.dispose();
  });

  it('resolves pairwise 3D marble-vs-marble elastic bumper collisions and live CSG world mutations at 120 Hz', () => {
    const mA = {
      ...createInitialMarbleState(COURSE_1_PRACTICE_RACE, 0),
      position: [-0.4, 4.55, 0] as const,
      velocity: [8.0, 0, 0] as const,
    };
    const mB = {
      ...createInitialMarbleState(COURSE_1_PRACTICE_RACE, 1),
      position: [0.4, 4.55, 0] as const,
      velocity: [-6.0, 0, 0] as const,
    };

    // Distance between centers is 0.8 < 2 * radius (1.10) -> overlapping head-on collision!
    const { states, collisions } = resolveMarbleCollisions([mA, mB]);
    expect(collisions.length).toBe(1);
    expect(collisions[0].relativeSpeed).toBeCloseTo(14.0, 3);

    // Marbles depenetrate so center distance >= 1.10 and velocities rebound in opposite X directions
    const sepDist = Math.hypot(
      states[1].position[0] - states[0].position[0],
      states[1].position[1] - states[0].position[1],
      states[1].position[2] - states[0].position[2],
    );
    expect(sepDist).toBeGreaterThanOrEqual(mA.radius + mB.radius);
    expect(states[0].velocity[0]).toBeLessThan(-4.0);
    expect(states[1].velocity[0]).toBeGreaterThan(4.0);

    // Verify 120 Hz Multi-Marble Arena Simulation + Live Crowd CSG Mutations
    const room = createPartyRoomEngine({ roomCode: 'ARGON' });
    room.spawnSimulatedCrowdPhones(6);

    const arenaSim = createMultiMarbleArenaSimulation(COURSE_2_INTERMEDIATE_MADNESS);
    arenaSim.syncPlayersFromRoom(room.getSnapshot());

    const inputs = new Map([
      ['sim_phone_1', { moveXZ: [0.3, -0.9] as const, jumpPressed: false, respawnPressed: false }],
      ['sim_phone_2', { moveXZ: [-0.3, -0.9] as const, jumpPressed: false, respawnPressed: false }],
    ]);

    for (let step = 0; step < 30; step++) {
      arenaSim.stepFixed(1 / 120, inputs, step / 120);
    }

    const marbles = arenaSim.getMarbles();
    expect(marbles.length).toBeGreaterThanOrEqual(4);
    expect(marbles[0].state.position[2]).toBeLessThan(
      COURSE_2_INTERMEDIATE_MADNESS.startPos[2],
    );

    // Verify that `applyCrowdMutationsToCourse` produces a valid CSG tree that compiles to GLSL & WGSL
    const mutatedCourse = applyCrowdMutationsToCourse(COURSE_2_INTERMEDIATE_MADNESS, [
      {
        id: 'mut_bridge',
        kind: 'rescueBridge',
        playerId: 'p1',
        playerHandle: 'maya',
        position: [0, 2.0, -10],
        secondaryPos: [0, 2.0, -14],
        radius: 0.85,
        blendK: 0.28,
        material: 'bounce',
        createdAtMs: 1000,
        expiresAtMs: 9000,
      },
      {
        id: 'mut_crater',
        kind: 'craterMortar',
        playerId: 'p2',
        playerHandle: 'dan',
        position: [0, 4.0, -4],
        secondaryPos: [0, 4.0, -4],
        radius: 1.5,
        blendK: 0.25,
        material: 'standard',
        createdAtMs: 1000,
        expiresAtMs: 9000,
      },
      {
        id: 'mut_cryo',
        kind: 'cryoFreeze',
        playerId: 'p3',
        playerHandle: 'sara',
        position: [0, 2.0, -18],
        secondaryPos: [0, 2.0, -18],
        radius: 3.0,
        blendK: 0.2,
        material: 'ice',
        createdAtMs: 1000,
        expiresAtMs: 9000,
      },
    ]);

    expect(mutatedCourse.scene).toBeDefined();
    const cpuSample = evaluateSdfTree(mutatedCourse.scene!, [0, 2.0, -10], 0);
    expect(cpuSample.distance).toBeLessThan(0);

    const evaluator = createCpuWorldEvaluator(mutatedCourse);
    expect(evaluator.distance([0, 2.0, -10], 0)).toBeLessThan(0);

    const glsl = compileCourseToGlsl(mutatedCourse);
    const wgsl = compileCourseToWgsl(mutatedCourse);
    expect(glsl).toContain('evalCourseWorldRaw');
    expect(wgsl).toContain('fn evalCourseWorldRaw');
  });
});
