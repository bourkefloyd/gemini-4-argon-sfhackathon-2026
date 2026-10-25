/**
 * Pure In-Memory Multiplayer Party Room State Engine (`src/multiplayer/party-room-engine.ts`)
 *
 * Shared between:
 * - Node/Vite Wi-Fi Room Server (`server/party-room.ts`)
 * - Browser `BroadcastChannel` Fallback (`src/multiplayer/party-client.ts`)
 *
 * Supports automatic multi-room capacity limits & overflow (`ARGON-1`, `ARGON-2`, `ARGON-3`, ...):
 * - Configurable `maxMarblesPerRoom` (default `4` for a clean 2x2 split-screen grid, configurable `4..8`).
 * - When `ARGON-1` reaches `maxMarblesPerRoom`, the 5th+ QR joiner automatically overflows into `ARGON-2`,
 *   the 9th+ into `ARGON-3`, etc.
 */

import type { SurfaceMaterial, Vec3 } from '../contracts';
import {
  CROWD_ACTION_COOLDOWN_MS,
  CROWD_MUTATOR_CATALOG,
  type CrowdMutatorKind,
  DEFAULT_MAX_MARBLES_PER_ROOM,
  IDLE_PLAYER_TIMEOUT_MS,
  type JoinPartyRequest,
  type JoinPartyResponse,
  MAX_ACTIVE_WORLD_MUTATIONS,
  MAX_CROWD_PROMPTS,
  MAX_MARBLES_PER_ROOM,
  MAX_RECENT_TOASTS,
  MIN_MARBLES_PER_ROOM,
  PARTY_MARBLE_PALETTES,
  type PartyActionPayload,
  type PartyArcadeToast,
  type PartyCrowdPrompt,
  type PartyInputPayload,
  type PartyLeaderboardEntry,
  type PartyPlayerRecord,
  type PartyPromptPayload,
  type PartyRoomSnapshot,
  type PartyRoomSummary,
  type PartyWorldMutationEvent,
} from './party-types';

export interface PartyRoomEngineOptions {
  readonly roomCode?: string;
  /** Per-room marble capacity before overflowing into `ARGON-2`, `ARGON-3`, ... (default: 4, range: 4..8) */
  readonly maxMarblesPerRoom?: number;
  /** Whether to automatically overflow players into `ARGON-2`, `ARGON-3`, ... when a room is full (default: true) */
  readonly autoOverflow?: boolean;
  readonly lanIp?: string;
  readonly port?: number;
  readonly basePath?: string;
  readonly customTunnelUrl?: string | null;
  readonly cooldownMs?: number;
  readonly idleTimeoutMs?: number;
  readonly mintSecret?: () => string;
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
  getSnapshot(nowMs?: number, targetRoomId?: string): PartyRoomSnapshot;
  joinPlayer(req: JoinPartyRequest, nowMs?: number): JoinPartyResponse;
  removePlayer(playerId: string, nowMs?: number): PartyRoomSnapshot;
  updateInput(payload: PartyInputPayload, nowMs?: number): PartyPlayerRecord | null;
  verifyPlayerSecret(playerId: string, secret?: string | null): boolean;
  getPlayerSecret(playerId: string): string | undefined;
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
  setActiveRoom(roomIdOrIndex: string | number, nowMs?: number): PartyRoomSnapshot;
  setMaxMarblesPerRoom(maxMarbles: number, nowMs?: number): PartyRoomSnapshot;
  setCustomTunnelUrl(url: string | null, nowMs?: number): PartyRoomSnapshot;
  setLanAddress(lanIp: string, port?: number, nowMs?: number, basePath?: string): PartyRoomSnapshot;
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

function clampMarblesPerRoom(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_MAX_MARBLES_PER_ROOM;
  }
  return Math.max(MIN_MARBLES_PER_ROOM, Math.min(MAX_MARBLES_PER_ROOM, Math.round(value)));
}

function extractBaseRoomPrefix(rawCode: string | undefined): string {
  const upper = (rawCode ?? 'ARGON').trim().toUpperCase();
  if (!upper || upper === 'AUTO') return 'ARGON';
  const match = upper.match(/^([A-Z0-9_]+?)(?:-\d+)?$/);
  return match?.[1] || 'ARGON';
}

function parseRequestedRoomIndex(rawCode: string | undefined, basePrefix: string): number | null {
  if (!rawCode) return null;
  const upper = rawCode.trim().toUpperCase();
  if (!upper || upper === 'AUTO' || upper === basePrefix) return null;
  const match = upper.match(new RegExp(`^${basePrefix}-(\\d+)$`));
  if (match) {
    const idx = Number.parseInt(match[1], 10);
    return Number.isFinite(idx) && idx >= 1 ? idx : null;
  }
  return null;
}

function defaultMintHexSecret(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

function normalizeBasePath(rawPath: string | undefined): string {
  if (!rawPath) return '/';
  const cleaned = rawPath.split('?')[0].split('#')[0].trim();
  if (!cleaned || cleaned === '/') return '/';
  const withLeading = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  if (/\.[a-zA-Z0-9]+$/.test(withLeading)) {
    return withLeading;
  }
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function buildPartyJoinUrl(
  lanIp: string,
  port: number,
  roomCode: string,
  customTunnelUrl: string | null,
  basePath = '/',
): string {
  const encodedRoom = encodeURIComponent(roomCode);
  const normalizedPath = normalizeBasePath(basePath);

  if (customTunnelUrl && customTunnelUrl.trim().length > 0) {
    const raw = customTunnelUrl.trim();
    try {
      const parsed = new URL(raw);
      // If the tunnel URL has only root '/' pathname, inherit a non-root basePath if configured
      if ((parsed.pathname === '' || parsed.pathname === '/') && normalizedPath !== '/') {
        parsed.pathname = normalizedPath;
      } else {
        parsed.pathname = normalizeBasePath(parsed.pathname);
      }
      parsed.searchParams.set('party', '1');
      parsed.searchParams.set('room', roomCode);
      return parsed.toString();
    } catch {
      const base = raw.replace(/\/+$/, '');
      const sep = base.includes('?') ? '&' : '/?';
      return `${base}${sep}party=1&room=${encodedRoom}`;
    }
  }

  return `http://${lanIp}:${port}${normalizedPath}?party=1&room=${encodedRoom}`;
}

export function createPartyRoomEngine(options: PartyRoomEngineOptions = {}): PartyRoomEngine {
  const roomCode = extractBaseRoomPrefix(options.roomCode);
  let maxMarblesPerRoom = clampMarblesPerRoom(options.maxMarblesPerRoom);
  const autoOverflow = options.autoOverflow ?? true;
  let activeRoomIndex = 1;
  let lanIp = options.lanIp ?? '127.0.0.1';
  let port = options.port ?? 5173;
  let basePath = normalizeBasePath(options.basePath);
  let customTunnelUrl: string | null = options.customTunnelUrl ?? null;
  const cooldownMs = options.cooldownMs ?? CROWD_ACTION_COOLDOWN_MS;
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_PLAYER_TIMEOUT_MS;
  const mintSecretFn = options.mintSecret ?? defaultMintHexSecret;
  const nowFn = options.now ?? (() => Date.now());

  const players = new Map<string, PartyPlayerRecord>();
  const playerSecrets = new Map<string, string>();
  let mutations: PartyWorldMutationEvent[] = [];
  let toasts: PartyArcadeToast[] = [];
  let prompts: PartyCrowdPrompt[] = [];
  let idCounter = 1;
  const listeners = new Set<(snapshot: PartyRoomSnapshot) => void>();

  function formatRoomId(index: number): string {
    return `${roomCode}-${Math.max(1, Math.floor(index))}`;
  }

  function nextId(prefix: string): string {
    return `${prefix}_${idCounter++}`;
  }

  function promoteWaitingArchitectInRoom(freedRoomIdx: number, freedSlot: number) {
    const waitingArchitect = Array.from(players.values())
      .filter((p) => p.roomIndex === freedRoomIdx && p.role === 'architect')
      .sort((a, b) => b.score - a.score || a.joinedAtMs - b.joinedAtMs)[0];

    if (waitingArchitect) {
      const palette = PARTY_MARBLE_PALETTES[freedSlot % PARTY_MARBLE_PALETTES.length];
      players.set(waitingArchitect.playerId, {
        ...waitingArchitect,
        role: 'racer',
        racerSlot: freedSlot,
        roomPlayerNumber: freedSlot + 1,
        colorHex: palette.hex,
      });
    }
  }

  function pruneExpired(nowMs: number) {
    mutations = mutations.filter((m) => m.expiresAtMs > nowMs);
    if (idleTimeoutMs > 0) {
      for (const [id, p] of players.entries()) {
        if (!p.isSimulated && nowMs - p.lastSeenAtMs > idleTimeoutMs) {
          players.delete(id);
          playerSecrets.delete(id);
          if (p.role === 'racer' && p.racerSlot !== null) {
            promoteWaitingArchitectInRoom(p.roomIndex, p.racerSlot);
          }
        }
      }
    }
  }

  function pushToast(toast: PartyArcadeToast) {
    toasts = [toast, ...toasts].slice(0, MAX_RECENT_TOASTS);
  }

  function getRoomRacers(roomIdx: number): PartyPlayerRecord[] {
    return Array.from(players.values())
      .filter((p) => p.roomIndex === roomIdx && p.role === 'racer' && p.racerSlot !== null)
      .sort((a, b) => (a.racerSlot ?? 99) - (b.racerSlot ?? 99));
  }

  function findAvailableSlotInRoom(roomIdx: number): number | null {
    const usedSlots = new Set<number>();
    for (const p of players.values()) {
      if (p.roomIndex === roomIdx && p.role === 'racer' && p.racerSlot !== null) {
        usedSlots.add(p.racerSlot);
      }
    }
    for (let slot = 0; slot < maxMarblesPerRoom; slot++) {
      if (!usedSlots.has(slot)) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Finds the first room index (`1, 2, 3, ...`) that has `< maxMarblesPerRoom` active racers.
   * If `preferredStartRoomIndex` is provided (e.g., `?room=ARGON-2`) and has space, assigns there;
   * if that room is full, overflows to the next available room!
   */
  function assignRoomAndSlot(preferredStartRoomIndex: number | null): {
    roomIndex: number;
    roomId: string;
    racerSlot: number | null;
    autoOverflowed: boolean;
  } {
    if (!autoOverflow) {
      const slot = findAvailableSlotInRoom(1);
      return {
        roomIndex: 1,
        roomId: formatRoomId(1),
        racerSlot: slot,
        autoOverflowed: false,
      };
    }

    const startIdx = preferredStartRoomIndex && preferredStartRoomIndex >= 1 ? preferredStartRoomIndex : 1;

    // First check from startIdx upward (so ARGON-1 fills first, then overflows to ARGON-2, ARGON-3, ...)
    for (let roomIdx = startIdx; roomIdx <= 64; roomIdx++) {
      const slot = findAvailableSlotInRoom(roomIdx);
      if (slot !== null) {
        return {
          roomIndex: roomIdx,
          roomId: formatRoomId(roomIdx),
          racerSlot: slot,
          autoOverflowed: roomIdx > 1,
        };
      }
    }

    return {
      roomIndex: 1,
      roomId: formatRoomId(1),
      racerSlot: null,
      autoOverflowed: false,
    };
  }

  function buildAllRoomsSummary(): PartyRoomSummary[] {
    let highestRoomIdx = Math.max(1, activeRoomIndex);
    for (const p of players.values()) {
      if (p.roomIndex > highestRoomIdx) {
        highestRoomIdx = p.roomIndex;
      }
    }

    const summaries: PartyRoomSummary[] = [];
    for (let idx = 1; idx <= highestRoomIdx; idx++) {
      const rId = formatRoomId(idx);
      const roomMembers = Array.from(players.values()).filter((p) => p.roomIndex === idx);
      const roomRacers = roomMembers.filter((p) => p.role === 'racer');
      const sortedByScore = [...roomMembers].sort(
        (a, b) => b.score - a.score || a.joinedAtMs - b.joinedAtMs,
      );
      const playerCount = roomRacers.length;
      summaries.push({
        roomId: rId,
        roomIndex: idx,
        playerCount,
        maxPlayers: maxMarblesPerRoom,
        isFull: playerCount >= maxMarblesPerRoom,
        leaderName: sortedByScore[0]?.handle ?? null,
      });
    }
    return summaries;
  }

  function findLeadRacerAheadPosition(roomIdx = activeRoomIndex): Vec3 {
    let bestRacer: PartyPlayerRecord | null = null;
    for (const p of players.values()) {
      if (p.roomIndex === roomIdx && p.role === 'racer' && p.pose) {
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

  function resolveRoomIndex(roomIdOrIndex?: string | number): number {
    if (typeof roomIdOrIndex === 'number' && Number.isFinite(roomIdOrIndex)) {
      return Math.max(1, Math.floor(roomIdOrIndex));
    }
    if (typeof roomIdOrIndex === 'string' && roomIdOrIndex.trim()) {
      const parsed = parseRequestedRoomIndex(roomIdOrIndex, roomCode);
      if (parsed !== null) return parsed;
    }
    return activeRoomIndex;
  }

  function getSnapshot(nowMs = nowFn(), targetRoomId?: string): PartyRoomSnapshot {
    pruneExpired(nowMs);

    const viewRoomIndex = targetRoomId ? resolveRoomIndex(targetRoomId) : activeRoomIndex;
    const viewRoomId = formatRoomId(viewRoomIndex);

    const allPlayerList = Array.from(players.values()).sort((a, b) => {
      if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
      if (a.role !== b.role) return a.role === 'racer' ? -1 : 1;
      return (a.racerSlot ?? 99) - (b.racerSlot ?? 99);
    });

    const roomPlayers = allPlayerList.filter((p) => p.roomIndex === viewRoomIndex);
    const roomRacers = roomPlayers.filter((p) => p.role === 'racer');

    const leaderboard: PartyLeaderboardEntry[] = Array.from(players.values())
      .map((p) => ({
        playerId: p.playerId,
        handle: p.handle,
        role: p.role,
        roomId: p.roomId,
        roomIndex: p.roomIndex,
        racerSlot: p.racerSlot,
        colorHex: p.colorHex,
        score: p.score,
        bumpsLanded: p.bumpsLanded,
        crowdActionsTriggered: p.crowdActionsTriggered,
      }))
      .sort((a, b) => b.score - a.score || a.handle.localeCompare(b.handle));

    const hasWaveSurge = mutations.some((m) => m.kind === 'waveSurge' && m.expiresAtMs > nowMs);
    const allRoomsSummary = buildAllRoomsSummary();

    return {
      roomCode,
      roomId: viewRoomId,
      roomIndex: viewRoomIndex,
      roomPlayerCount: roomRacers.length,
      maxMarblesPerRoom,
      allRoomsSummary,
      lanIp,
      port,
      joinUrl: buildPartyJoinUrl(lanIp, port, roomCode, customTunnelUrl, basePath),
      customTunnelUrl,
      updatedAtMs: nowMs,
      players: allPlayerList,
      roomPlayers,
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

  function verifyPlayerSecret(playerId: string, secret?: string | null): boolean {
    if (!playerId || !secret) return false;
    const expected = playerSecrets.get(playerId);
    if (!expected) return false;
    return expected === secret;
  }

  function getPlayerSecret(playerId: string): string | undefined {
    return playerSecrets.get(playerId);
  }

  function joinPlayer(req: JoinPartyRequest, nowMs = nowFn()): JoinPartyResponse {
    pruneExpired(nowMs);
    const handle = sanitizeHandle(req.handle);
    const existingId = req.playerId && players.has(req.playerId) ? req.playerId : null;

    if (existingId) {
      const existing = players.get(existingId)!;
      const existingSecret =
        playerSecrets.get(existingId) ?? req.playerSecret?.trim() ?? mintSecretFn();
      playerSecrets.set(existingId, existingSecret);
      const updated: PartyPlayerRecord = {
        ...existing,
        handle,
        lastSeenAtMs: nowMs,
      };
      players.set(existingId, updated);
      const snap = notify(nowMs);
      const roomCount = getRoomRacers(updated.roomIndex).length;
      return {
        player: updated,
        playerId: existingId,
        playerSecret: existingSecret,
        roomId: updated.roomId,
        roomIndex: updated.roomIndex,
        roomPlayerCount: roomCount,
        maxMarblesPerRoom,
        autoOverflowed: updated.autoOverflowed,
        allRoomsSummary: snap.allRoomsSummary,
        snapshot: snap,
      };
    }

    const playerId = req.playerId?.trim() || nextId('plr');
    const playerSecret = req.playerSecret?.trim() || mintSecretFn();
    playerSecrets.set(playerId, playerSecret);
    const requestedRoomIdx = parseRequestedRoomIndex(req.roomCode, roomCode);

    let assignedRoomIdx = requestedRoomIdx ?? 1;
    let assignedRoomId = formatRoomId(assignedRoomIdx);
    let availableSlot: number | null = null;
    let autoOverflowed = false;

    if (req.preferredRole !== 'architect') {
      const assignment = assignRoomAndSlot(requestedRoomIdx);
      assignedRoomIdx = assignment.roomIndex;
      assignedRoomId = assignment.roomId;
      availableSlot = assignment.racerSlot;
      autoOverflowed = assignment.autoOverflowed;
    }

    const role = availableSlot !== null ? 'racer' : 'architect';
    const palette =
      availableSlot !== null
        ? PARTY_MARBLE_PALETTES[availableSlot % PARTY_MARBLE_PALETTES.length]
        : PARTY_MARBLE_PALETTES[players.size % PARTY_MARBLE_PALETTES.length];

    const currentRoomRacers = getRoomRacers(assignedRoomIdx).length;
    const roomPlayerNumber =
      availableSlot !== null ? availableSlot + 1 : currentRoomRacers + 1;

    const record: PartyPlayerRecord = {
      playerId,
      handle,
      role,
      roomId: assignedRoomId,
      roomIndex: assignedRoomIdx,
      roomPlayerNumber,
      autoOverflowed,
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
    const updatedRoomPlayerCount = getRoomRacers(assignedRoomIdx).length;

    pushToast({
      id: nextId('toast'),
      icon: autoOverflowed ? '🚀' : role === 'racer' ? '🟢' : '⚡',
      text:
        role === 'racer'
          ? autoOverflowed
            ? `@${handle} auto-overflowed to ${assignedRoomId} (Player ${roomPlayerNumber}/${maxMarblesPerRoom} • ${palette.name})!`
            : `@${handle} joined ${assignedRoomId} as Marble #${roomPlayerNumber}/${maxMarblesPerRoom} (${palette.name})!`
          : `@${handle} joined ${assignedRoomId} Crowd Chaos & Rescue Deck!`,
      accentColor: palette.hex,
      playerId,
      playerHandle: handle,
      roomId: assignedRoomId,
      kind: 'join',
      createdAtMs: nowMs,
    });

    const snap = notify(nowMs);
    return {
      player: record,
      playerId,
      playerSecret,
      roomId: assignedRoomId,
      roomIndex: assignedRoomIdx,
      roomPlayerCount: updatedRoomPlayerCount,
      maxMarblesPerRoom,
      autoOverflowed,
      allRoomsSummary: snap.allRoomsSummary,
      snapshot: snap,
    };
  }

  function removePlayer(playerId: string, nowMs = nowFn()): PartyRoomSnapshot {
    const removed = players.get(playerId);
    players.delete(playerId);
    playerSecrets.delete(playerId);

    // If an Arena Racer slot opened up in that room, promote a waiting Crowd Architect in the same room
    if (removed && removed.role === 'racer' && removed.racerSlot !== null) {
      promoteWaitingArchitectInRoom(removed.roomIndex, removed.racerSlot);
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
    const targetPos = payload.targetPosition ?? findLeadRacerAheadPosition(player.roomIndex);

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
        radius = 4.5;
        blendK = 0.2;
        secondaryPos = targetPos;
        actionVerb = 'froze the Track into Ice!';
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
      roomId: player.roomId,
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
      text: `${def.icon} @${player.handle} (${player.roomId}) ${actionVerb}`,
      accentColor: def.accentColor,
      playerId: player.playerId,
      playerHandle: player.handle,
      roomId: player.roomId,
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
      roomId: player?.roomId,
      kind: 'prompt',
      createdAtMs: nowMs,
    });

    return { prompt: promptRecord, snapshot: notify(nowMs) };
  }

  function setActiveRoom(roomIdOrIndex: string | number, nowMs = nowFn()): PartyRoomSnapshot {
    activeRoomIndex = resolveRoomIndex(roomIdOrIndex);
    return notify(nowMs);
  }

  function setMaxMarblesPerRoom(nextMax: number, nowMs = nowFn()): PartyRoomSnapshot {
    maxMarblesPerRoom = clampMarblesPerRoom(nextMax);
    return notify(nowMs);
  }

  function setCustomTunnelUrl(url: string | null, nowMs = nowFn()): PartyRoomSnapshot {
    customTunnelUrl = url && url.trim().length > 0 ? url.trim() : null;
    return notify(nowMs);
  }

  function setLanAddress(
    nextLanIp: string,
    nextPort = port,
    nowMs = nowFn(),
    nextBasePath?: string,
  ): PartyRoomSnapshot {
    lanIp = nextLanIp.trim() || '127.0.0.1';
    port = nextPort;
    if (nextBasePath !== undefined) {
      basePath = normalizeBasePath(nextBasePath);
    }
    return notify(nowMs);
  }

  const SIMULATED_CROWD_PERSONAS = [
    { id: 'sim_phone_1', handle: 'ivan_dm', twist: 'deterministic lockstep ice chute' },
    { id: 'sim_phone_2', handle: 'joana_devrel', twist: 'low gravity neon pinball' },
    { id: 'sim_phone_3', handle: 'subhasmita_rsi', twist: 'self healing bridge gauntlet' },
    { id: 'sim_phone_4', handle: 'shudhatma_sys', twist: 'high speed spiral halfpipe' },
    { id: 'sim_phone_5', handle: 'oskar_world', twist: 'non euclidean portal fling' },
    { id: 'sim_phone_6', handle: 'maya_sf', twist: 'ferrofluid steelie bumper arena' },
    { id: 'sim_phone_7', handle: 'alex_gpu', twist: 'cyber wave boost highway' },
    { id: 'sim_phone_8', handle: 'sara_sdf', twist: 'cryo acid vortex funnel' },
    { id: 'sim_phone_9', handle: 'devon_synth', twist: 'double piston catapult alley' },
    { id: 'sim_phone_10', handle: 'kai_shader', twist: 'escher reverse gravity spiral' },
  ];

  function spawnSimulatedCrowdPhones(count = 6, nowMs = nowFn()): PartyRoomSnapshot {
    const clampedCount = Math.max(1, Math.min(16, Math.floor(count)));
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
      if (nowMs - p.lastActionAtMs >= cooldownMs + 600 && idx % 3 === 0) {
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
    playerSecrets.clear();
    mutations = [];
    toasts = [];
    prompts = [];
    activeRoomIndex = 1;
    return notify(nowMs);
  }

  return {
    getSnapshot,
    joinPlayer,
    removePlayer,
    updateInput,
    verifyPlayerSecret,
    getPlayerSecret,
    syncPlayerPose,
    triggerCrowdAction,
    submitCrowdPrompt,
    setActiveRoom,
    setMaxMarblesPerRoom,
    setCustomTunnelUrl,
    setLanAddress,
    spawnSimulatedCrowdPhones,
    stepSimulatedCrowdPhones,
    subscribe,
    reset,
  };
}
