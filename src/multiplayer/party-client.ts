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
import type {
  CrowdMutatorKind,
  JoinPartyRequest,
  JoinPartyResponse,
  PartyActionPayload,
  PartyCrowdPrompt,
  PartyInputPayload,
  PartyPromptPayload,
  PartyRoomSnapshot,
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
  join(req: JoinPartyRequest): Promise<JoinPartyResponse>;
  sendInput(payload: PartyInputPayload): Promise<void>;
  triggerAction(
    playerId: string,
    kind: CrowdMutatorKind,
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
 * Cloudflare Quick Tunnel (`trycloudflare.com`), `ngrok`, or `?public-url=`.
 */
export function detectBrowserTunnelOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const { publicTunnelOverride } = parsePartyUrlQuery(window.location.search);
  if (publicTunnelOverride) return publicTunnelOverride;

  const host = window.location.hostname;
  if (
    host &&
    host !== 'localhost' &&
    host !== '127.0.0.1' &&
    !host.startsWith('192.168.') &&
    !host.startsWith('10.')
  ) {
    return window.location.origin;
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
      customTunnelUrl: detectBrowserTunnelOrigin(),
    });

  let latestSnapshot: PartyRoomSnapshot = localEngine.getSnapshot();
  const listeners = new Set<(snapshot: PartyRoomSnapshot) => void>();

  let channel: BroadcastChannel | null = null;
  let eventSource: EventSource | null = null;

  const emit = (snap: PartyRoomSnapshot) => {
    latestSnapshot = snap;
    for (const listener of listeners) {
      listener(snap);
    }
  };

  const unsubLocal = localEngine.subscribe((snap) => {
    emit(snap);
  });

  if (typeof BroadcastChannel !== 'undefined') {
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
    } catch {
      channel = null;
    }
  }

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

  if (enableNetwork && typeof EventSource !== 'undefined') {
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
        // Fallback to local engine + BroadcastChannel silently when server middleware isn't running
        eventSource?.close();
        eventSource = null;
      };
    } catch {
      eventSource = null;
    }
  }

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

  async function join(req: JoinPartyRequest): Promise<JoinPartyResponse> {
    const localRes = localEngine.joinPlayer(req);
    channel?.postMessage({ type: 'join', payload: req } satisfies BroadcastEnvelope);
    const remote = await postJson<JoinPartyResponse>('/api/party/join', req);
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote;
    }
    return localRes;
  }

  async function sendInput(payload: PartyInputPayload): Promise<void> {
    localEngine.updateInput(payload);
    channel?.postMessage({ type: 'input', payload } satisfies BroadcastEnvelope);
    await postJson('/api/party/input', payload);
  }

  async function triggerAction(
    playerId: string,
    kind: CrowdMutatorKind,
  ): Promise<PartyActionResult> {
    const payload: PartyActionPayload = { roomCode, playerId, kind };
    const localRes = localEngine.triggerCrowdAction(payload);
    channel?.postMessage({ type: 'action', payload } satisfies BroadcastEnvelope);
    const remote = await postJson<PartyActionResult>('/api/party/action', payload);
    if (remote?.snapshot) {
      emit(remote.snapshot);
      return remote;
    }
    return localRes;
  }

  async function submitPrompt(playerId: string, twist: string) {
    const payload: PartyPromptPayload = { roomCode, playerId, twist };
    const localRes = localEngine.submitCrowdPrompt(payload);
    channel?.postMessage({ type: 'prompt', payload } satisfies BroadcastEnvelope);
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
    const localSnap = localEngine.setCustomTunnelUrl(url);
    channel?.postMessage({
      type: 'tunnel',
      customTunnelUrl: url,
    } satisfies BroadcastEnvelope);
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
    const localSnap = stepOnly
      ? localEngine.stepSimulatedCrowdPhones()
      : localEngine.spawnSimulatedCrowdPhones(count);
    channel?.postMessage({
      type: 'simulate',
      count,
      stepOnly,
    } satisfies BroadcastEnvelope);
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
    const localSnap = localEngine.setActiveRoom(roomIdOrIndex);
    channel?.postMessage({
      type: 'selectRoom',
      roomId: roomIdOrIndex,
    } satisfies BroadcastEnvelope);
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
    const localSnap = localEngine.setMaxMarblesPerRoom(maxMarbles);
    channel?.postMessage({
      type: 'setMaxMarbles',
      maxMarblesPerRoom: maxMarbles,
    } satisfies BroadcastEnvelope);
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
    listeners.add(listener);
    listener(latestSnapshot);
    return () => {
      listeners.delete(listener);
    };
  }

  function dispose(): void {
    unsubLocal();
    channel?.close();
    eventSource?.close();
    listeners.clear();
  }

  return {
    getSnapshot: () => latestSnapshot,
    getLocalEngine: () => localEngine,
    join,
    sendInput,
    triggerAction,
    submitPrompt,
    setCustomTunnelUrl,
    simulateCrowdPhones,
    selectRoom,
    setMaxMarblesPerRoom,
    subscribe,
    dispose,
  };
}
