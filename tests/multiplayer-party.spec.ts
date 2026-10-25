import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { COURSE_1_PRACTICE_RACE, COURSE_2_INTERMEDIATE_MADNESS } from '../src/courses';
import { createInitialMarbleState } from '../src/physics';
import { compileCourseToGlsl, compileCourseToWgsl } from '../src/rendering';
import { createCpuWorldEvaluator, evaluateSdfTree } from '../src/sdf/eval-cpu';
import {
  applyCrowdMutationsToCourse,
  createMultiMarbleArenaSimulation,
  createPartyRoomClient,
  createPartyRoomEngine,
  encodeQrMatrix,
  parsePartyUrlQuery,
  renderQrSvg,
  resolveMarbleCollisions,
} from '../src/multiplayer';
import {
  createPartyRoomMiddleware,
  detectLanIpv4Address,
  detectPublicTunnelUrl,
} from '../server/party-room';

describe('QR Party Multiplayer Module — QR SVG, In-Memory Room, Tunnel & Bumper Physics', () => {
  it('generates valid ISO/IEC 18004 QR matrices and crisp zero-dependency SVG markup', () => {
    const lanUrl = 'http://192.168.1.42:5173/?party=1&room=ARGON';
    const matrix = encodeQrMatrix(lanUrl);

    expect(matrix.encodedText).toBe(lanUrl);
    expect(matrix.size).toBeGreaterThanOrEqual(25);
    expect(matrix.modules.length).toBe(matrix.size);
    expect(matrix.modules[0].length).toBe(matrix.size);

    // Top-left, Top-right, and Bottom-left 7x7 finder corners must have dark outer corners and 3x3 cores
    const checkFinder = (topR: number, leftC: number) => {
      expect(matrix.modules[topR][leftC]).toBe(true);
      expect(matrix.modules[topR][leftC + 6]).toBe(true);
      expect(matrix.modules[topR + 6][leftC]).toBe(true);
      expect(matrix.modules[topR + 6][leftC + 6]).toBe(true);
      expect(matrix.modules[topR + 3][leftC + 3]).toBe(true);
      // Inner white ring at offset 1
      expect(matrix.modules[topR + 1][leftC + 1]).toBe(false);
    };

    checkFinder(0, 0);
    checkFinder(0, matrix.size - 7);
    checkFinder(matrix.size - 7, 0);

    const svg = renderQrSvg(lanUrl, {
      sizePx: 220,
      marginModules: 3,
      darkColor: '#050811',
      lightColor: '#ffffff',
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="220" height="220"');
    expect(svg).toContain('<path d="M');
    expect(svg).toContain(lanUrl.replace(/&/g, '&amp;'));
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
  });

  it('manages 8 Arena Racers, unlimited Crowd Architects, 4s CSG cooldowns, Argon twists, and 6-Phone Simulation', () => {
    let clockMs = 10_000;
    const room = createPartyRoomEngine({
      roomCode: 'ARGON',
      lanIp: '192.168.1.50',
      port: 5173,
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
    expect(bridgeRes.toast?.text).toContain('@player_9 extruded a Rescue Bridge!');

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

  it('serves /api/party/* HTTP endpoints via createPartyRoomMiddleware and PartyRoomClient', async () => {
    const { engine, middleware } = createPartyRoomMiddleware();

    const invokeJson = async (
      method: 'GET' | 'POST',
      url: string,
      body?: unknown,
    ): Promise<{ statusCode: number; data: unknown }> => {
      const payloadStr = body ? JSON.stringify(body) : '';
      const stream = Readable.from(payloadStr ? [Buffer.from(payloadStr)] : []);
      const req = Object.assign(stream, {
        method,
        url,
        headers: { 'content-type': 'application/json' },
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

    const joinRes = await invokeJson('POST', '/api/party/join', {
      playerId: 'judge_1',
      handle: 'ivan_leo',
    });
    expect(joinRes.statusCode).toBe(200);

    const simRes = await invokeJson('POST', '/api/party/simulate', { count: 6 });
    expect(simRes.statusCode).toBe(200);
    expect(engine.getSnapshot().players.length).toBeGreaterThanOrEqual(6);

    // Verify browser PartyRoomClient against localEngine
    const client = createPartyRoomClient({
      roomCode: 'ARGON',
      enableNetwork: false,
      localEngine: engine,
    });
    const actionRes = await client.triggerAction('judge_1', 'tectonicRamp');
    expect(actionRes.ok).toBe(true);
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
