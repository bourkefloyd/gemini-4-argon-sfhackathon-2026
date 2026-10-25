/**
 * Browser Party Room Client (`src/multiplayer/party-client.ts`)
 *
 * Dual-transport architecture:
 * 1. Wi-Fi / Public-Tunnel Server Transport (`/api/party/stream` SSE + `fetch` POSTs)
 *    for phones scanning the QR code across LAN or 5G/LTE Cloudflare Quick Tunnel.
 * 2. Local In-Memory `PartyRoomEngine` + `BroadcastChannel` Bridge so same-machine
 *    multi-tab testing and offline stage demos work with zero backend dependency.
 */

import {
  createPartyRoomEngine,
  type PartyActionResult,
  type PartyRoomEngine,
} from './party-room-engine';
import {
  PHONE_INPUT_THROTTLE_MS,
  type CrowdMutatorKind,
  type JoinPartyRequest,
  type JoinPartyResponse,
  type PartyActionPayload,
  type PartyCrowdPrompt,
  type PartyInputPayload,
  type PartyPromptPayload,
  type PartyRoomSnapshot,
} from './party-types';

const BROADCAST_CHANNEL_NAME = 'marble-madness-qr-party-v1';

type BroadcastEnvelope =
  | { type: 'snapshot'; snapshot: PartyRoomSnapshot }
  | { type: 'join'; payload: JoinPartyRequest }
  | { type: 'input'; payload: PartyInputPayload }
  | { type: 'action'; payload: PartyActionPayload }
  | { type: 'prompt'; payload: PartyPromptPayload }
  | { type: 'tunnel'; customTunnelUrl: string | null }
  | { type: 'simulate'; count: number; stepOnly?: boolean }
  | { type: 'selectRoom'; roomId: string | number }
  | { type: 'setMaxMarbles'; maxMarblesPerRoom: number };

export interface PartyRoomClientOptions {
  readonly roomCode?: string;
  readonly apiBaseUrl?: string;
  readonly enableNetwork?: boolean;
  readonly localEngine?: PartyRoomEngine;
}

export interface PartyRoomClient {
  getSnapshot(): PartyRoomSnapshot;
  getLocalEngine(): PartyRoomEngine;
  connect(): void;
  join(req: JoinPartyRequest): Promise<JoinPartyResponse>;
  sendInput(payload: PartyInputPayload): Promise<void>;
  triggerAction(
    playerId: string,
    kind: CrowdMutatorKind,
    playerSecret?: string,
  ): Promise<PartyActionResult>;
  sendAction(
    playerIdOrKind: string,
    kind?: CrowdMutatorKind,
    playerSecret?: string,
  ): Promise<PartyActionResult>;
  submitPrompt(
    playerId: string,
    twist: string,
  ): Promise<{ prompt: PartyCrowdPrompt | null; snapshot: PartyRoomSnapshot }>;
  setCustomTunnelUrl(url: string | null): Promise<PartyRoomSnapshot>;
  simulateCrowdPhones(count?: number, stepOnly?: boolean): Promise<PartyRoomSnapshot>;
  selectRoom(roomIdOrIndex: string | number): Promise<PartyRoomSnapshot>;
  setMaxMarblesPerRoom(maxMarbles: number): Promise<PartyRoomSnapshot>;
  subscribe(listener: (snapshot: PartyRoomSnapshot) => void): () => void;
  dispose(): void;
}

/**
 * Detects whether the current page URL has `?party=1` (mobile controller mode)
 * and extracts any `?room=` or `?public-url=` parameters.
 */
export function parsePartyUrlQuery(search: string = typeof window !== 'undefined' ? window.location.search : ''): {
  isPartyController: boolean;
  roomCode: string;
  publicTunnelOverride: string | null;
} {
  const params = new URLSearchParams(search);
  const partyParam = params.get('party');
  const isPartyController = partyParam === '1' || partyParam === 'true';
  const roomCode = (params.get('room') ?? 'ARGON').toUpperCase();
  const publicTunnelOverride =
    params.get('public-url') ?? params.get('tunnel') ?? null;

  return {
    isPartyController,
    roomCode,
    publicTunnelOverride,
  };
}

/**
 * Detects the best default public tunnel URL in the browser if accessed via
 * Cloudflare Quick Tunnel (`trycloudflare.com`), `ngrok`, GitHub Pages (`github.io`), or `?public-url=`.
 * Preserves `window.location.pathname` (e.g. `/gemini-4-argon-sfhackathon-2026/`) so sub-path deployments never 404.
 */
export function detectBrowserTunnelOrigin(
  loc: Pick<Location, 'hostname' | 'origin' | 'pathname' | 'search'> | undefined =
    typeof window !== 'undefined' ? window.location : undefined,
): string | null {
  if (!loc) return null;
  const { publicTunnelOverride } = parsePartyUrlQuery(loc.search);
  if (publicTunnelOverride) return publicTunnelOverride;

  const host = loc.hostname;
  if (
    host &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    !host.startsWith('192.168.') &&
    !host.startsWith('10.')
  ) {
    const pathname = loc.pathname || '/';
    return new URL(pathname, loc.origin).toString();
  }
  return null;
}

export function createPartyRoomClient(
  options: PartyRoomClientOptions = {},
): PartyRoomClient {
  const roomCode = (options.roomCode ?? 'ARGON').toUpperCase();
  const apiBase = (options.apiBaseUrl ?? '').replace(/\/+$/, '');
  const enableNetwork =
    options.enableNetwork ?? (typeof window !== 'undefined' && typeof fetch === 'function');

  const localEngine =
    options.localEngine ??
    createPartyRoomEngine({
      roomCode,
      lanIp:
        typeof window !== 'undefined' &&
        window.location.hostname &&
        window.location.hostname !== 'localhost'
          ? window.location.hostname
          : '192.168.1.42',
      port:
        typeof window !== 'undefined' && window.location.port
          ? Number(window.location.port) || 5173
          : 5173,
      basePath:
        typeof window !== 'undefined' && window.location.pathname
          ? window.location.pathname
          : '/',
      customTunnelUrl: detectBrowserTunnelOrigin(),
    });

  let latestSnapshot: PartyRoomSnapshot = localEngine.getSnapshot();
  const listeners = new Set<(snapshot: PartyRoomSnapshot) => void>();
  const playerSecrets = new Map<string, string>();
  let activePlayerId: string | null = null;
  let activePlayerSecret: string | null = null;

  let channel: BroadcastChannel | null = null;
  let eventSource: EventSource | null = null;
  let unsubLocal: (() => void) | null = null;
  let isDisposed = false;
  let sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // 15 Hz (~66 ms) phone input network throttle state
  let lastInputSentAtMs = 0;
  let pendingInputPayload: PartyInputPayload | null = null;
  let inputThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (snap: PartyRoomSnapshot) => {
    latestSnapshot = snap;
    for (const listener of listeners) {
      listener(snap);
    }
  };

  function openBroadcastChannel(): BroadcastChannel | null {
    if (channel) return channel;
    if (typeof BroadcastChannel === 'undefined') return null;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.onmessage = (ev: MessageEvent<BroadcastEnvelope>) => {
        const msg = ev.data;
        if (!msg || typeof msg !== 'object') return;
        switch (msg.type) {
          case 'snapshot':
            emit(msg.snapshot);
            break;
          case 'join':
            localEngine.joinPlayer(msg.payload);
            break;
          case 'input':
            localEngine.updateInput(msg.payload);
            break;
          case 'action':
            localEngine.triggerCrowdAction(msg.payload);
            break;
          case 'prompt':
            localEngine.submitCrowdPrompt(msg.payload);
            break;
          case 'tunnel':
            localEngine.setCustomTunnelUrl(msg.customTunnelUrl);
            break;
          case 'simulate':
            if (msg.stepOnly) {
              localEngine.stepSimulatedCrowdPhones();
            } else {
              localEngine.spawnSimulatedCrowdPhones(msg.count);
            }
            break;
          case 'selectRoom':
            localEngine.setActiveRoom(msg.roomId);
            break;
          case 'setMaxMarbles':
            localEngine.setMaxMarblesPerRoom(msg.maxMarblesPerRoom);
            break;
        }
      };
      return channel;
    } catch {
      channel = null;
      return null;
    }
  }

  function postBroadcast(msg: BroadcastEnvelope) {
    ensureConnected();
    const activeChannel = channel ?? openBroadcastChannel();
    if (!activeChannel) return;
    try {
      activeChannel.postMessage(msg);
    } catch {
      // Codex F5: If BroadcastChannel was closed by React StrictMode cleanup, re-open and retry
      try {
        activeChannel.close();
      } catch {
        // Ignore close error
      }
      channel = null;
      const reopened = openBroadcastChannel();
      try {
        reopened?.postMessage(msg);
      } catch {
        // Ignore if BroadcastChannel is unavailable in environment
      }
    }
  }

  function openEventSource() {
    if (!enableNetwork || typeof EventSource === 'undefined' || eventSource) return;
    try {
      eventSource = new EventSource(`${apiBase}/api/party/stream`);
      eventSource.onmessage = (ev) => {
        try {
          const remoteSnap = JSON.parse(ev.data) as PartyRoomSnapshot;
          if (remoteSnap && remoteSnap.roomCode) {
            emit(remoteSnap);
          }
        } catch {
          // Ignore malformed SSE frames
        }
      };
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!isDisposed && !sseReconnectTimer) {
          sseReconnectTimer = setTimeout(() => {
            sseReconnectTimer = null;
            if (!isDisposed) {
              openEventSource();
            }
          }, 1500);
          sseReconnectTimer.unref?.();
        }
      };
    } catch {
      eventSource = null;
    }
  }

  function ensureConnected() {
    if (isDisposed) {
      isDisposed = false;
    }
    if (!unsubLocal) {
      unsubLocal = localEngine.subscribe((snap) => {
        emit(snap);
      });
    }
    if (!channel) {
      openBroadcastChannel();
    }
    if (!eventSource && enableNetwork) {
      openEventSource();
    }
  }

  function connect(): void {
    ensureConnected();
    if (enableNetwork && typeof fetch === 'function') {
      void fetch(`${apiBase}/api/party/state`)
        .then((res) => (res.ok ? res.json() : null))
        .then((remoteSnap: PartyRoomSnapshot | null) => {
          if (remoteSnap && remoteSnap.roomCode) {
            emit(remoteSnap);
          }
        })
        .catch(() => {
          // Local engine stays authoritative until the party middleware is reachable.
        });
    }
  }

  connect();

  async function postJson<T>(path: string, body: unknown): Promise<T | null> {
    if (!enableNetwork || typeof fetch !== 'function') return null;
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok && res.status !== 429) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  function resolveSecretForPlayer(playerId: string, explicitSecret?: string): string | undefined {
    return (
      explicitSecret ??
      playerSecrets.get(playerId) ??
      localEngine.getPlayerSecret(playerId) ??
      activePlayerSecret ??
      undefined
    );
  }

  async function join(req: JoinPartyRequest): Promise<JoinPartyResponse> {
    ensureConnected();
    const enrichedReq: JoinPartyRequest = {
      ...req,
      playerSecret: req.playerSecret ?? (req.playerId ? resolveSecretForPlayer(req.playerId) : undefined),
    };
    const localRes = localEngine.joinPlayer(enrichedReq);
    playerSecrets.set(localRes.playerId, localRes.playerSecret);
    activePlayerId = localRes.playerId;
    activePlayerSecret = localRes.playerSecret;

    postBroadcast({ type: 'join', payload: enrichedReq });
    const remote = await postJson<JoinPartyResponse>('/api/party/join', enrichedReq);
    if (remote?.snapshot) {
      if (remote.playerId && remote.playerSecret) {
        playerSecrets.set(remote.playerId, remote.playerSecret);
        if (req.playerId) {
          playerSecrets.set(req.playerId, remote.playerSecret);
        }
        activePlayerId = remote.playerId;
        activePlayerSecret = remote.playerSecret;
      }
      emit(remote.snapshot);
      return remote;
    }
    return localRes;
  }

  async function sendInput(payload: PartyInputPayload): Promise<void> {
    ensureConnected();
    const effectivePlayerId = activePlayerId ?? payload.playerId;
    const enrichedPayload: PartyInputPayload = {
      ...payload,
      playerId: effectivePlayerId,
      playerSecret: resolveSecretForPlayer(effectivePlayerId, payload.playerSecret),
    };

    localEngine.updateInput(enrichedPayload);
    postBroadcast({ type: 'input', payload: enrichedPayload });

    if (!enableNetwork || typeof fetch !== 'function') return;

    const now = Date.now();
    const isUrgent =
      Boolean(enrichedPayload.jumpPressed) ||
      (enrichedPayload.moveXZ[0] === 0 && enrichedPayload.moveXZ[1] === 0);
    const elapsed = now - lastInputSentAtMs;

    if (isUrgent || elapsed >= PHONE_INPUT_THROTTLE_MS) {
      if (inputThrottleTimer) {
        clearTimeout(inputThrottleTimer);
        inputThrottleTimer = null;
      }
      pendingInputPayload = null;
      lastInputSentAtMs = now;
      await postJson('/api/party/input', enrichedPayload);
    } else {
      pendingInputPayload = enrichedPayload;
      if (!inputThrottleTimer) {
        const delay = Math.max(10, PHONE_INPUT_THROTTLE_MS - elapsed);
        inputThrottleTimer = setTimeout(() => {
          inputThrottleTimer = null;
          if (pendingInputPayload && !isDisposed) {
            const toSend = pendingInputPayload;
            pendingInputPayload = null;
            lastInputSentAtMs = Date.now();
            void postJson('/api/party/input', toSend);
          }
        }, delay);
        inputThrottleTimer.unref?.();
      }
    }
  }

  async function triggerAction(
    playerId: string,
    kind: CrowdMutatorKind,
    playerSecret?: string,
  ): Promise<PartyActionResult> {
    ensureConnected();
    const effectivePlayerId =
      localEngine.getSnapshot().players.some((p) => p.playerId === playerId)
        ? playerId
        : activePlayerId ?? playerId;
    const payload: PartyActionPayload = {
      roomCode,
      playerId: effectivePlayerId,
      playerSecret: resolveSecretForPlayer(effectivePlayerId, playerSecret),
      kind,
    };
    const localRes = localEngine.triggerCrowdAction(payload);
    postBroadcast({ type: 'action', payload });
    const remote = await postJson<PartyActionResult>('/api/party/action', payload);
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote;
    }
    return localRes;
  }

  async function sendAction(
    playerIdOrKind: string,
    kind?: CrowdMutatorKind,
    playerSecret?: string,
  ): Promise<PartyActionResult> {
    const validKinds = new Set<CrowdMutatorKind>([
      'rescueBridge',
      'craterMortar',
      'tectonicRamp',
      'cryoFreeze',
      'waveSurge',
    ]);
    if (!kind && validKinds.has(playerIdOrKind as CrowdMutatorKind)) {
      const targetPlayerId =
        activePlayerId ??
        localEngine.getSnapshot().players[0]?.playerId ??
        'plr_default';
      return triggerAction(targetPlayerId, playerIdOrKind as CrowdMutatorKind, playerSecret);
    }
    return triggerAction(
      playerIdOrKind,
      kind ?? 'rescueBridge',
      playerSecret,
    );
  }

  async function submitPrompt(playerId: string, twist: string) {
    ensureConnected();
    const effectivePlayerId = activePlayerId ?? playerId;
    const payload: PartyPromptPayload = {
      roomCode,
      playerId: effectivePlayerId,
      playerSecret: resolveSecretForPlayer(effectivePlayerId),
      twist,
    };
    const localRes = localEngine.submitCrowdPrompt(payload);
    postBroadcast({ type: 'prompt', payload });
    const remote = await postJson<{
      prompt: PartyCrowdPrompt | null;
      snapshot: PartyRoomSnapshot;
    }>('/api/party/prompt', payload);
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote;
    }
    return localRes;
  }

  async function setCustomTunnelUrl(url: string | null): Promise<PartyRoomSnapshot> {
    ensureConnected();
    const localSnap = localEngine.setCustomTunnelUrl(url);
    postBroadcast({
      type: 'tunnel',
      customTunnelUrl: url,
    });
    const remote = await postJson<{ ok: boolean; snapshot: PartyRoomSnapshot }>(
      '/api/party/tunnel',
      { customTunnelUrl: url },
    );
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote.snapshot;
    }
    return localSnap;
  }

  async function simulateCrowdPhones(
    count = 6,
    stepOnly = false,
  ): Promise<PartyRoomSnapshot> {
    ensureConnected();
    const localSnap = stepOnly
      ? localEngine.stepSimulatedCrowdPhones()
      : localEngine.spawnSimulatedCrowdPhones(count);
    postBroadcast({
      type: 'simulate',
      count,
      stepOnly,
    });
    const remote = await postJson<{ ok: boolean; snapshot: PartyRoomSnapshot }>(
      '/api/party/simulate',
      { count, stepOnly },
    );
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote.snapshot;
    }
    return localSnap;
  }

  async function selectRoom(roomIdOrIndex: string | number): Promise<PartyRoomSnapshot> {
    ensureConnected();
    const localSnap = localEngine.setActiveRoom(roomIdOrIndex);
    postBroadcast({
      type: 'selectRoom',
      roomId: roomIdOrIndex,
    });
    const remote = await postJson<{ ok: boolean; snapshot: PartyRoomSnapshot }>(
      '/api/party/room',
      { roomId: roomIdOrIndex },
    );
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote.snapshot;
    }
    return localSnap;
  }

  async function setMaxMarblesPerRoom(maxMarbles: number): Promise<PartyRoomSnapshot> {
    ensureConnected();
    const localSnap = localEngine.setMaxMarblesPerRoom(maxMarbles);
    postBroadcast({
      type: 'setMaxMarbles',
      maxMarblesPerRoom: maxMarbles,
    });
    const remote = await postJson<{ ok: boolean; snapshot: PartyRoomSnapshot }>(
      '/api/party/room',
      { maxMarblesPerRoom: maxMarbles },
    );
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote.snapshot;
    }
    return localSnap;
  }

  function subscribe(listener: (snapshot: PartyRoomSnapshot) => void): () => void {
    ensureConnected();
    listeners.add(listener);
    listener(latestSnapshot);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    isDisposed = true;
    if (unsubLocal) {
      unsubLocal();
      unsubLocal = null;
    }
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
    if (inputThrottleTimer) {
      clearTimeout(inputThrottleTimer);
      inputThrottleTimer = null;
    }
    pendingInputPayload = null;
    if (channel) {
      try {
        channel.close();
      } catch {
        // Ignore already-closed channel
      }
      channel = null;
    }
    if (eventSource) {
      try {
        eventSource.close();
      } catch {
        // Ignore already-closed EventSource
      }
      eventSource = null;
    }
  }

  return {
    getSnapshot: () => latestSnapshot,
    getLocalEngine: () => localEngine,
    connect,
    join,
    sendInput,
    triggerAction,
    sendAction,
    submitPrompt,
    setCustomTunnelUrl,
    simulateCrowdPhones,
    selectRoom,
    setMaxMarblesPerRoom,
    subscribe,
    dispose,
  };
}
