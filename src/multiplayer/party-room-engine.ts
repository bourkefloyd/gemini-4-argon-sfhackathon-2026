/**
 * Pure In-Memory Multiplayer Party Room State Engine (`src/multiplayer/party-room-engine.ts`)
 *
 * Shared between:
 * - Node/Vite Wi-Fi Room Server (`server/party-room.ts`)
 * - Browser `BroadcastChannel` Fallback (`src/multiplayer/party-client.ts`)
 */

import type { SurfaceMaterial, Vec3 } from '../contracts';
import {
  CROWD_ACTION_COOLDOWN_MS,
  CROWD_MUTATOR_CATALOG,
  type CrowdMutatorKind,
  type JoinPartyRequest,
  MAX_ACTIVE_WORLD_MUTATIONS,
  MAX_ARENA_RACERS,
  MAX_CROWD_PROMPTS,
  MAX_RECENT_TOASTS,
  PARTY_MARBLE_PALETTES,
  type PartyActionPayload,
  type PartyArcadeToast,
  type PartyCrowdPrompt,
  type PartyInputPayload,
  type PartyLeaderboardEntry,
  type PartyPlayerRecord,
  type PartyPromptPayload,
  type PartyRoomSnapshot,
  type PartyWorldMutationEvent,
} from './party-types';

export interface PartyRoomEngineOptions {
  readonly roomCode?: string;
  readonly lanIp?: string;
  readonly port?: number;
  readonly customTunnelUrl?: string | null;
  readonly cooldownMs?: number;
  readonly now?: () => number;
}

export interface PartyActionResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly cooldownRemainingMs?: number;
  readonly mutation?: PartyWorldMutationEvent;
  readonly toast?: PartyArcadeToast;
  readonly snapshot: PartyRoomSnapshot;
}

export interface PartyRoomEngine {
  getSnapshot(nowMs?: number): PartyRoomSnapshot;
  joinPlayer(req: JoinPartyRequest, nowMs?: number): {
    player: PartyPlayerRecord;
    snapshot: PartyRoomSnapshot;
  };
  removePlayer(playerId: string, nowMs?: number): PartyRoomSnapshot;
  updateInput(payload: PartyInputPayload, nowMs?: number): PartyPlayerRecord | null;
  syncPlayerPose(
    playerId: string,
    pose: NonNullable<PartyPlayerRecord['pose']>,
    scoreDelta?: number,
    bumpsDelta?: number,
    nowMs?: number,
  ): void;
  triggerCrowdAction(payload: PartyActionPayload, nowMs?: number): PartyActionResult;
  submitCrowdPrompt(payload: PartyPromptPayload, nowMs?: number): {
    prompt: PartyCrowdPrompt | null;
    snapshot: PartyRoomSnapshot;
  };
  setCustomTunnelUrl(url: string | null, nowMs?: number): PartyRoomSnapshot;
  setLanAddress(lanIp: string, port?: number, nowMs?: number): PartyRoomSnapshot;
  spawnSimulatedCrowdPhones(count?: number, nowMs?: number): PartyRoomSnapshot;
  stepSimulatedCrowdPhones(nowMs?: number): PartyRoomSnapshot;
  subscribe(listener: (snapshot: PartyRoomSnapshot) => void): () => void;
  reset(nowMs?: number): PartyRoomSnapshot;
}

function sanitizeHandle(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-\s]/g, '').slice(0, 18).trim();
  return cleaned || `player_${Math.floor(100 + Math.random() * 900)}`;
}

function sanitizePromptTwist(raw: string): string {
  const words = raw
    .trim()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
  return words.join(' ').slice(0, 48);
}

function clampUnit(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

export function buildPartyJoinUrl(
  lanIp: string,
  port: number,
  roomCode: string,
  customTunnelUrl: string | null,
): string {
  const encodedRoom = encodeURIComponent(roomCode);
  if (customTunnelUrl && customTunnelUrl.trim().length > 0) {
    const base = customTunnelUrl.trim().replace(/\/+$/, '');
    const sep = base.includes('?') ? '&' : '/?';
    return `${base}${sep}party=1&room=${encodedRoom}`;
  }
  return `http://${lanIp}:${port}/?party=1&room=${encodedRoom}`;
}

export function createPartyRoomEngine(options: PartyRoomEngineOptions = {}): PartyRoomEngine {
  const roomCode = (options.roomCode ?? 'ARGON').toUpperCase();
  let lanIp = options.lanIp ?? '127.0.0.1';
  let port = options.port ?? 5173;
  let customTunnelUrl: string | null = options.customTunnelUrl ?? null;
  const cooldownMs = options.cooldownMs ?? CROWD_ACTION_COOLDOWN_MS;
  const nowFn = options.now ?? (() => Date.now());

  const players = new Map<string, PartyPlayerRecord>();
  let mutations: PartyWorldMutationEvent[] = [];
  let toasts: PartyArcadeToast[] = [];
  let prompts: PartyCrowdPrompt[] = [];
  let idCounter = 1;
  const listeners = new Set<(snapshot: PartyRoomSnapshot) => void>();

  function nextId(prefix: string): string {
    return `${prefix}_${idCounter++}`;
  }

  function pruneExpired(nowMs: number) {
    mutations = mutations.filter((m) => m.expiresAtMs > nowMs);
  }

  function pushToast(toast: PartyArcadeToast) {
    toasts = [toast, ...toasts].slice(0, MAX_RECENT_TOASTS);
  }

  function findAvailableRacerSlot(): number | null {
    const usedSlots = new Set<number>();
    for (const p of players.values()) {
      if (p.role === 'racer' && p.racerSlot !== null) {
        usedSlots.add(p.racerSlot);
      }
    }
    for (let slot = 0; slot < MAX_ARENA_RACERS; slot++) {
      if (!usedSlots.has(slot)) {
        return slot;
      }
    }
    return null;
  }

  function findLeadRacerAheadPosition(): Vec3 {
    let bestRacer: PartyPlayerRecord | null = null;
    for (const p of players.values()) {
      if (p.role === 'racer' && p.pose) {
        if (!bestRacer || p.pose.position[2] < (bestRacer.pose?.position[2] ?? 0)) {
          bestRacer = p;
        }
      }
    }
    if (bestRacer?.pose) {
      const [px, py, pz] = bestRacer.pose.position;
      const [vx, , vz] = bestRacer.pose.velocity;
      const speed = Math.hypot(vx, vz);
      const dirX = speed > 0.5 ? vx / speed : 0;
      const dirZ = speed > 0.5 ? vz / speed : -1;
      return [px + dirX * 3.2, py - 0.35, pz + dirZ * 3.2];
    }
    return [0, 3.5, -6.0];
  }

  function getSnapshot(nowMs = nowFn()): PartyRoomSnapshot {
    pruneExpired(nowMs);

    const playerList = Array.from(players.values()).sort((a, b) => {
      if (a.role !== b.role) return a.role === 'racer' ? -1 : 1;
      return (a.racerSlot ?? 99) - (b.racerSlot ?? 99);
    });

    const leaderboard: PartyLeaderboardEntry[] = Array.from(players.values())
      .map((p) => ({
        playerId: p.playerId,
        handle: p.handle,
        role: p.role,
        racerSlot: p.racerSlot,
        colorHex: p.colorHex,
        score: p.score,
        bumpsLanded: p.bumpsLanded,
        crowdActionsTriggered: p.crowdActionsTriggered,
      }))
      .sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));

    const hasWaveSurge = mutations.some((m) => m.kind === 'waveSurge' && m.expiresAtMs > nowMs);

    return {
      roomCode,
      lanIp,
      port,
      joinUrl: buildPartyJoinUrl(lanIp, port, roomCode, customTunnelUrl),
      customTunnelUrl,
      updatedAtMs: nowMs,
      players: playerList,
      activeMutations: [...mutations],
      recentToasts: [...toasts],
      crowdPrompts: [...prompts],
      leaderboard,
      waveSurgeMultiplier: hasWaveSurge ? 2.0 : 1.0,
    };
  }

  function notify(nowMs = nowFn()): PartyRoomSnapshot {
    const snap = getSnapshot(nowMs);
    for (const listener of listeners) {
      listener(snap);
    }
    return snap;
  }

  function joinPlayer(req: JoinPartyRequest, nowMs = nowFn()) {
    const handle = sanitizeHandle(req.handle);
    const existingId = req.playerId && players.has(req.playerId) ? req.playerId : null;

    if (existingId) {
      const existing = players.get(existingId)!;
      const updated: PartyPlayerRecord = {
        ...existing,
        handle,
        lastSeenAtMs: nowMs,
      };
      players.set(existingId, updated);
      return { player: updated, snapshot: notify(nowMs) };
    }

    const playerId = req.playerId?.trim() || nextId('plr');
    const availableSlot =
      req.preferredRole === 'architect' ? null : findAvailableRacerSlot();
    const role = availableSlot !== null ? 'racer' : 'architect';
    const palette =
      availableSlot !== null
        ? PARTY_MARBLE_PALETTES[availableSlot % PARTY_MARBLE_PALETTES.length]
        : PARTY_MARBLE_PALETTES[players.size % PARTY_MARBLE_PALETTES.length];

    const record: PartyPlayerRecord = {
      playerId,
      handle,
      role,
      racerSlot: availableSlot,
      colorHex: palette.hex,
      score: 0,
      bumpsLanded: 0,
      crowdActionsTriggered: 0,
      joinedAtMs: nowMs,
      lastSeenAtMs: nowMs,
      lastActionAtMs: 0,
      input: {
        moveXZ: [0, 0],
        jumpPressed: false,
        backspinActive: false,
        updatedAtMs: nowMs,
      },
    };

    players.set(playerId, record);

    pushToast({
      id: nextId('toast'),
      icon: role === 'racer' ? '🟢' : '⚡',
      text:
        role === 'racer'
          ? `@${handle} joined as Marble #${(availableSlot ?? 0) + 1} (${palette.name})!`
          : `@${handle} joined the Crowd Chaos & Rescue Deck!`,
      accentColor: palette.hex,
      playerId,
      playerHandle: handle,
      kind: 'join',
      createdAtMs: nowMs,
    });

    return { player: record, snapshot: notify(nowMs) };
  }

  function removePlayer(playerId: string, nowMs = nowFn()): PartyRoomSnapshot {
    const removed = players.get(playerId);
    players.delete(playerId);

    // If an Arena Racer slot opened up, promote the longest-waiting Crowd Architect!
    if (removed && removed.role === 'racer' && removed.racerSlot !== null) {
      const freedSlot = removed.racerSlot;
      const waitingArchitect = Array.from(players.values())
        .filter((p) => p.role === 'architect')
        .sort((a, b) => b.score - a.score || a.joinedAtMs - b.joinedAtMs)[0];

      if (waitingArchitect) {
        const palette = PARTY_MARBLE_PALETTES[freedSlot % PARTY_MARBLE_PALETTES.length];
        players.set(waitingArchitect.playerId, {
          ...waitingArchitect,
          role: 'racer',
          racerSlot: freedSlot,
          colorHex: palette.hex,
        });
      }
    }

    return notify(nowMs);
  }

  function updateInput(payload: PartyInputPayload, nowMs = nowFn()): PartyPlayerRecord | null {
    const existing = players.get(payload.playerId);
    if (!existing) return null;

    const rawX = clampUnit(payload.moveXZ[0]);
    const rawZ = clampUnit(payload.moveXZ[1]);
    const mag = Math.hypot(rawX, rawZ);
    const moveXZ: readonly [number, number] =
      mag > 1 ? [rawX / mag, rawZ / mag] : [rawX, rawZ];

    const updated: PartyPlayerRecord = {
      ...existing,
      lastSeenAtMs: nowMs,
      input: {
        moveXZ,
        jumpPressed: Boolean(payload.jumpPressed),
        backspinActive: Boolean(payload.backspinActive),
        updatedAtMs: nowMs,
      },
    };
    players.set(payload.playerId, updated);
    notify(nowMs);
    return updated;
  }

  function syncPlayerPose(
    playerId: string,
    pose: NonNullable<PartyPlayerRecord['pose']>,
    scoreDelta = 0,
    bumpsDelta = 0,
    nowMs = nowFn(),
  ) {
    const existing = players.get(playerId);
    if (!existing) return;
    players.set(playerId, {
      ...existing,
      pose,
      score: Math.max(0, existing.score + scoreDelta),
      bumpsLanded: existing.bumpsLanded + bumpsDelta,
      lastSeenAtMs: nowMs,
    });
  }

  function triggerCrowdAction(payload: PartyActionPayload, nowMs = nowFn()): PartyActionResult {
    pruneExpired(nowMs);
    const player = players.get(payload.playerId);
    if (!player) {
      return {
        ok: false,
        reason: 'Player not found in party room',
        snapshot: getSnapshot(nowMs),
      };
    }

    const elapsedSinceLast = nowMs - player.lastActionAtMs;
    if (player.lastActionAtMs > 0 && elapsedSinceLast < cooldownMs) {
      return {
        ok: false,
        reason: 'Action on cooldown',
        cooldownRemainingMs: cooldownMs - elapsedSinceLast,
        snapshot: getSnapshot(nowMs),
      };
    }

    const def =
      CROWD_MUTATOR_CATALOG.find((c) => c.kind === payload.kind) ?? CROWD_MUTATOR_CATALOG[0];
    const targetPos = payload.targetPosition ?? findLeadRacerAheadPosition();

    let material: SurfaceMaterial = 'standard';
    let radius = 1.65;
    let blendK = 0.25;
    let secondaryPos: Vec3 = [targetPos[0], targetPos[1], targetPos[2] - 3.6];
    let actionVerb = 'triggered an SDF mutation';
    let pointsAwarded = 150;

    switch (def.kind) {
      case 'rescueBridge':
        material = 'bounce';
        radius = 0.85;
        blendK = 0.28;
        secondaryPos = [targetPos[0], targetPos[1], targetPos[2] - 4.2];
        actionVerb = 'extruded a Rescue Bridge!';
        pointsAwarded = 250;
        break;
      case 'craterMortar':
        material = 'standard';
        radius = 1.65;
        blendK = 0.25;
        secondaryPos = targetPos;
        actionVerb = 'blasted a Crater!';
        pointsAwarded = 180;
        break;
      case 'tectonicRamp':
        material = 'bumper';
        radius = 2.0;
        blendK = 0.3;
        secondaryPos = [2.2, 0.95, 2.4];
        actionVerb = 'popped a Tectonic Ramp!';
        pointsAwarded = 200;
        break;
      case 'cryoFreeze':
        material = 'ice';
        radius = 3.2;
        blendK = 0.2;
        secondaryPos = targetPos;
        actionVerb = 'froze the Acid into Ice!';
        pointsAwarded = 220;
        break;
      case 'waveSurge':
        material = 'bounce';
        radius = 4.0;
        blendK = 0.35;
        secondaryPos = targetPos;
        actionVerb = 'triggered a 2x Wave Surge!';
        pointsAwarded = 200;
        break;
    }

    const mutation: PartyWorldMutationEvent = {
      id: nextId('mut'),
      kind: def.kind,
      playerId: player.playerId,
      playerHandle: player.handle,
      position: targetPos,
      secondaryPos,
      radius,
      blendK,
      material,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + def.defaultTtlSec * 1000,
    };

    mutations = [...mutations, mutation].slice(-MAX_ACTIVE_WORLD_MUTATIONS);

    const toast: PartyArcadeToast = {
      id: nextId('toast'),
      icon: def.icon,
      text: `${def.icon} @${player.handle} ${actionVerb}`,
      accentColor: def.accentColor,
      playerId: player.playerId,
      playerHandle: player.handle,
      kind: def.kind,
      createdAtMs: nowMs,
    };
    pushToast(toast);

    players.set(player.playerId, {
      ...player,
      score: player.score + pointsAwarded,
      crowdActionsTriggered: player.crowdActionsTriggered + 1,
      lastActionAtMs: nowMs,
      lastSeenAtMs: nowMs,
    });

    const snapshot = notify(nowMs);
    return {
      ok: true,
      mutation,
      toast,
      snapshot,
    };
  }

  function submitCrowdPrompt(payload: PartyPromptPayload, nowMs = nowFn()) {
    const player = players.get(payload.playerId);
    const twist = sanitizePromptTwist(payload.twist);
    if (!twist) {
      return { prompt: null, snapshot: getSnapshot(nowMs) };
    }

    const handle = player?.handle ?? 'crowd';
    const existingIdx = prompts.findIndex(
      (p) => p.twist.toLowerCase() === twist.toLowerCase(),
    );

    let promptRecord: PartyCrowdPrompt;
    if (existingIdx >= 0) {
      const prev = prompts[existingIdx];
      promptRecord = {
        ...prev,
        votes: prev.votes + 1,
      };
      prompts = prompts
        .map((p, idx) => (idx === existingIdx ? promptRecord : p))
        .sort((a, b) => b.votes - a.votes || b.createdAtMs - a.createdAtMs);
    } else {
      promptRecord = {
        id: nextId('prm'),
        playerId: payload.playerId,
        playerHandle: handle,
        twist,
        votes: 1,
        createdAtMs: nowMs,
      };
      prompts = [promptRecord, ...prompts]
        .sort((a, b) => b.votes - a.votes || b.createdAtMs - a.createdAtMs)
        .slice(0, MAX_CROWD_PROMPTS);
    }

    if (player) {
      players.set(player.playerId, {
        ...player,
        score: player.score + 100,
        lastSeenAtMs: nowMs,
      });
    }

    pushToast({
      id: nextId('toast'),
      icon: '✨',
      text: `✨ @${handle} queued Argon twist: "${twist}"`,
      accentColor: '#c084fc',
      playerId: payload.playerId,
      playerHandle: handle,
      kind: 'prompt',
      createdAtMs: nowMs,
    });

    return { prompt: promptRecord, snapshot: notify(nowMs) };
  }

  function setCustomTunnelUrl(url: string | null, nowMs = nowFn()): PartyRoomSnapshot {
    customTunnelUrl = url && url.trim().length > 0 ? url.trim() : null;
    return notify(nowMs);
  }

  function setLanAddress(nextLanIp: string, nextPort = port, nowMs = nowFn()): PartyRoomSnapshot {
    lanIp = nextLanIp.trim() || '127.0.0.1';
    port = nextPort;
    return notify(nowMs);
  }

  const SIMULATED_CROWD_PERSONAS = [
    { id: 'sim_phone_1', handle: 'ivan_dm', role: 'racer' as const, twist: 'deterministic lockstep ice chute' },
    { id: 'sim_phone_2', handle: 'joana_devrel', role: 'racer' as const, twist: 'low gravity neon pinball' },
    { id: 'sim_phone_3', handle: 'subhasmita_rsi', role: 'racer' as const, twist: 'self healing bridge gauntlet' },
    { id: 'sim_phone_4', handle: 'shudhatma_sys', role: 'racer' as const, twist: 'high speed spiral halfpipe' },
    { id: 'sim_phone_5', handle: 'oskar_world', role: 'architect' as const, twist: 'non euclidean portal fling' },
    { id: 'sim_phone_6', handle: 'maya_sf', role: 'architect' as const, twist: 'ferrofluid steelie bumper arena' },
  ];

  function spawnSimulatedCrowdPhones(count = 6, nowMs = nowFn()): PartyRoomSnapshot {
    const clampedCount = Math.max(1, Math.min(8, Math.floor(count)));
    const mutatorCycle: CrowdMutatorKind[] = [
      'rescueBridge',
      'craterMortar',
      'tectonicRamp',
      'cryoFreeze',
      'waveSurge',
    ];

    for (let i = 0; i < clampedCount; i++) {
      const persona = SIMULATED_CROWD_PERSONAS[i % SIMULATED_CROWD_PERSONAS.length];
      const playerId = i < SIMULATED_CROWD_PERSONAS.length ? persona.id : `sim_phone_${i + 1}`;
      const handle = i < SIMULATED_CROWD_PERSONAS.length ? persona.handle : `sim_crowd_${i + 1}`;

      const { player } = joinPlayer(
        {
          playerId,
          handle,
          preferredRole: persona.role,
        },
        nowMs,
      );

      const angle = (i / clampedCount) * Math.PI * 0.6 - Math.PI * 0.3;
      const moveX = Math.sin(angle) * 0.45;
      const moveZ = -0.88;

      players.set(player.playerId, {
        ...player,
        isSimulated: true,
        input: {
          moveXZ: [moveX, moveZ],
          jumpPressed: i % 2 === 0,
          backspinActive: false,
          updatedAtMs: nowMs,
        },
      });

      if (i < 3) {
        triggerCrowdAction(
          {
            playerId: player.playerId,
            kind: mutatorCycle[i % mutatorCycle.length],
            targetPosition: [(i - 1) * 1.4, 3.6, -5.5 - i * 2.2],
          },
          nowMs + i,
        );
      }

      if (persona.twist && i < 3) {
        submitCrowdPrompt(
          {
            playerId: player.playerId,
            twist: persona.twist,
          },
          nowMs + i,
        );
      }
    }

    return notify(nowMs);
  }

  function stepSimulatedCrowdPhones(nowMs = nowFn()): PartyRoomSnapshot {
    const tSec = nowMs / 1000;
    const mutatorCycle: CrowdMutatorKind[] = [
      'rescueBridge',
      'craterMortar',
      'tectonicRamp',
      'cryoFreeze',
      'waveSurge',
    ];

    let idx = 0;
    for (const p of players.values()) {
      if (!p.isSimulated) continue;
      const phase = tSec * 1.8 + idx * 1.15;
      const steerX = Math.sin(phase) * 0.55;
      const steerZ = -0.82 + Math.cos(phase * 0.7) * 0.15;
      const hop = Math.sin(phase * 3.1) > 0.92;

      players.set(p.playerId, {
        ...p,
        lastSeenAtMs: nowMs,
        input: {
          moveXZ: [steerX, steerZ],
          jumpPressed: hop,
          backspinActive: false,
          updatedAtMs: nowMs,
        },
      });

      // Periodically trigger crowd mutations when off cooldown
      if (p.role === 'architect' && nowMs - p.lastActionAtMs >= cooldownMs + 600) {
        const mutKind = mutatorCycle[(idx + Math.floor(tSec)) % mutatorCycle.length];
        triggerCrowdAction(
          {
            playerId: p.playerId,
            kind: mutKind,
          },
          nowMs,
        );
      }
      idx++;
    }

    return notify(nowMs);
  }

  function subscribe(listener: (snapshot: PartyRoomSnapshot) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function reset(nowMs = nowFn()): PartyRoomSnapshot {
    players.clear();
    mutations = [];
    toasts = [];
    prompts = [];
    return notify(nowMs);
  }

  return {
    getSnapshot,
    joinPlayer,
    removePlayer,
    updateInput,
    syncPlayerPose,
    triggerCrowdAction,
    submitCrowdPrompt,
    setCustomTunnelUrl,
    setLanAddress,
    spawnSimulatedCrowdPhones,
    stepSimulatedCrowdPhones,
    subscribe,
    reset,
  };
}
