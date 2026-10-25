/**
 * Shared Multiplayer QR Party Mode Contracts (`src/multiplayer/party-types.ts`)
 *
 * Used by:
 * - In-Memory Wi-Fi Party Room Server (`server/party-room.ts`)
 * - Browser Party Client & BroadcastChannel Bridge (`src/multiplayer/party-client.ts`)
 * - 120 Hz Multi-Marble Bumper Physics (`src/multiplayer/multi-marble-sim.ts`)
 * - Mobile Touch Controller (`src/multiplayer/MobilePartyController.tsx`)
 * - Stage Projector QR HUD Modal (`src/multiplayer/QrPartyHudModal.tsx`)
 */

import type { Quat, SurfaceMaterial, Vec3 } from '../contracts';

export const MAX_PLAYERS = 6;
export const DEFAULT_MAX_MARBLES_PER_ROOM = MAX_PLAYERS;
export const MIN_MARBLES_PER_ROOM = 2;
export const MAX_MARBLES_PER_ROOM = 8;
export const MAX_ARENA_RACERS = MAX_PLAYERS;
export const CROWD_ACTION_COOLDOWN_MS = 4000;
export const IDLE_PLAYER_TIMEOUT_MS = 60_000;
export const PHONE_INPUT_THROTTLE_MS = 66; // ~15 Hz
export const MAX_PARTY_BODY_BYTES = 16 * 1024; // 16 KB
export const MAX_INPUT_REQUESTS_PER_SEC = 25;
export const MAX_ACTIVE_WORLD_MUTATIONS = 16;
export const MAX_RECENT_TOASTS = 12;
export const MAX_CROWD_PROMPTS = 24;

export type PartyPlayerRole = 'racer' | 'architect';

export type CrowdMutatorKind =
  | 'rescueBridge'
  | 'craterMortar'
  | 'tectonicRamp'
  | 'cryoFreeze'
  | 'waveSurge';

export interface CrowdMutatorDefinition {
  readonly kind: CrowdMutatorKind;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: string;
  readonly csgBadge: string;
  readonly description: string;
  readonly accentColor: string;
  readonly cooldownMs: number;
  readonly defaultTtlSec: number;
}

export const CROWD_MUTATOR_CATALOG: readonly CrowdMutatorDefinition[] = [
  {
    kind: 'rescueBridge',
    label: 'Extrude Rescue Bridge',
    shortLabel: 'Rescue Bridge',
    icon: '🛟',
    csgBadge: 'smoothUnion(Capsule)',
    description: 'Solidifies a hard-light bounce bridge under the lead racer!',
    accentColor: '#22d3ee',
    cooldownMs: CROWD_ACTION_COOLDOWN_MS,
    defaultTtlSec: 12,
  },
  {
    kind: 'craterMortar',
    label: 'Drop Crater Mortar',
    shortLabel: 'Crater Mortar',
    icon: '💥',
    csgBadge: 'smoothSubtract(Sphere)',
    description: 'Carves a smooth spherical crater into the track ahead of the pack!',
    accentColor: '#f97316',
    cooldownMs: CROWD_ACTION_COOLDOWN_MS,
    defaultTtlSec: 10,
  },
  {
    kind: 'tectonicRamp',
    label: 'Pop Tectonic Ramp',
    shortLabel: 'Tectonic Ramp',
    icon: '🚀',
    csgBadge: 'smoothUnion(Ramp)',
    description: 'Erupts a launch wedge under the racers with an upward velocity kick!',
    accentColor: '#a855f7',
    cooldownMs: CROWD_ACTION_COOLDOWN_MS,
    defaultTtlSec: 12,
  },
  {
    kind: 'cryoFreeze',
    label: 'Cryo Freeze Pulse',
    shortLabel: 'Cryo Freeze',
    icon: '❄️',
    csgBadge: 'material(Acid -> Ice)',
    description: 'Freezes lethal green Acid pools into fast blue Ice rinks!',
    accentColor: '#38bdf8',
    cooldownMs: CROWD_ACTION_COOLDOWN_MS,
    defaultTtlSec: 9,
  },
  {
    kind: 'waveSurge',
    label: 'Gravity / Wave Surge',
    shortLabel: 'Wave Surge',
    icon: '🌀',
    csgBadge: 'waveFloor(2x Amp)',
    description: 'Doubles traveling wave floor amplitude + low-gravity lift for 5s!',
    accentColor: '#facc15',
    cooldownMs: CROWD_ACTION_COOLDOWN_MS,
    defaultTtlSec: 5,
  },
];

export interface PartyMarblePalette {
  readonly slotIndex: number;
  readonly slotId: string;
  readonly slotLabel: string;
  readonly name: string;
  readonly marbleTitle: string;
  readonly hex: string;
  readonly rgb: Vec3;
}

export const PLAYER_MARBLE_PALETTE: readonly PartyMarblePalette[] = [
  {
    slotIndex: 0,
    slotId: 'P1',
    slotLabel: 'P1',
    name: 'Cobalt Cyan',
    marbleTitle: 'COBALT MARBLE',
    hex: '#00d8ff',
    rgb: [0.0, 0.847, 1.0],
  },
  {
    slotIndex: 1,
    slotId: 'P2',
    slotLabel: 'P2',
    name: 'Emerald Green',
    marbleTitle: 'EMERALD MARBLE',
    hex: '#10b981',
    rgb: [0.063, 0.725, 0.506],
  },
  {
    slotIndex: 2,
    slotId: 'P3',
    slotLabel: 'P3',
    name: 'Solar Gold',
    marbleTitle: 'SOLAR GOLD MARBLE',
    hex: '#f59e0b',
    rgb: [0.961, 0.62, 0.043],
  },
  {
    slotIndex: 3,
    slotId: 'P4',
    slotLabel: 'P4',
    name: 'Neon Magenta',
    marbleTitle: 'NEON MAGENTA MARBLE',
    hex: '#ec4899',
    rgb: [0.925, 0.282, 0.6],
  },
  {
    slotIndex: 4,
    slotId: 'P5',
    slotLabel: 'P5',
    name: 'Hyper Violet',
    marbleTitle: 'HYPER VIOLET MARBLE',
    hex: '#8b5cf6',
    rgb: [0.545, 0.361, 0.965],
  },
  {
    slotIndex: 5,
    slotId: 'P6',
    slotLabel: 'P6',
    name: 'Coral Red',
    marbleTitle: 'CORAL RED MARBLE',
    hex: '#ef4444',
    rgb: [0.937, 0.267, 0.267],
  },
];

export const PARTY_MARBLE_PALETTES: readonly PartyMarblePalette[] = PLAYER_MARBLE_PALETTE;

export interface PartyPlayerInputState {
  /** Trackball roll input vector in screen/world coordinates `[-1..1, -1..1]` */
  readonly moveXZ: readonly [number, number];
  /** True when player taps Hop / Jump */
  readonly jumpPressed: boolean;
  /** True when player pulls a sharp reverse backspin brake */
  readonly backspinActive: boolean;
  /** Client timestamp of last input sample */
  readonly updatedAtMs: number;
}

export interface PartyRoomSummary {
  /** Full room identifier, e.g. `ARGON-1`, `ARGON-2`, `ARGON-3` */
  readonly roomId: string;
  /** 1-based overflow room index (`1`, `2`, `3`, ...) */
  readonly roomIndex: number;
  /** Number of active marble racers currently in this room */
  readonly playerCount: number;
  /** Per-room marble capacity (`maxMarblesPerRoom`, e.g. `4`) */
  readonly maxPlayers: number;
  /** True when `playerCount >= maxPlayers` */
  readonly isFull: boolean;
  /** Handle of the current top-scoring or first player in this room */
  readonly leaderName: string | null;
}

export type PartyPlayerState = PartyPlayerRecord;

export interface PartyPlayerRecord {
  readonly playerId: string;
  readonly handle: string;
  readonly role: PartyPlayerRole;
  /** Assigned overflow room ID (`ARGON-1`, `ARGON-2`, `ARGON-3`, ...) */
  readonly roomId: string;
  /** 1-based room index (`1`, `2`, `3`, ...) */
  readonly roomIndex: number;
  /** 1-based player number within the assigned room (`1..maxMarblesPerRoom`) */
  readonly roomPlayerNumber: number;
  /** True when this player was automatically overflowed into `ARGON-2+` because earlier rooms were full */
  readonly autoOverflowed: boolean;
  /** `0..maxMarblesPerRoom-1` for Arena Racers, `null` for Crowd Chaos & Rescue Architects */
  readonly racerSlot: number | null;
  readonly colorHex: string;
  readonly score: number;
  readonly bumpsLanded: number;
  readonly crowdActionsTriggered: number;
  readonly joinedAtMs: number;
  readonly lastSeenAtMs: number;
  readonly lastActionAtMs: number;
  readonly isSimulated?: boolean;
  readonly input: PartyPlayerInputState;
  readonly pose?: {
    readonly position: Vec3;
    readonly velocity: Vec3;
    readonly orientation: Quat;
    readonly status: 'racing' | 'goal' | 'shattered' | 'sunk' | 'fell';
  };
}

export interface PartyWorldMutationEvent {
  readonly id: string;
  readonly kind: CrowdMutatorKind;
  readonly playerId: string;
  readonly playerHandle: string;
  readonly roomId?: string;
  /** Target world-space center where the CSG operation or override applies */
  readonly position: Vec3;
  /** Optional secondary endpoint or half-extents */
  readonly secondaryPos: Vec3;
  readonly radius: number;
  readonly blendK: number;
  readonly material: SurfaceMaterial;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface PartyArcadeToast {
  readonly id: string;
  readonly icon: string;
  readonly text: string;
  readonly accentColor: string;
  readonly playerId: string;
  readonly playerHandle: string;
  readonly roomId?: string;
  readonly kind: CrowdMutatorKind | 'join' | 'prompt' | 'bump';
  readonly createdAtMs: number;
}

export interface PartyCrowdPrompt {
  readonly id: string;
  readonly playerId: string;
  readonly playerHandle: string;
  /** Short 5-word hazard/theme twist for Gemini 4 Argon 1M Architect */
  readonly twist: string;
  readonly votes: number;
  readonly createdAtMs: number;
}

export interface PartyLeaderboardEntry {
  readonly playerId: string;
  readonly handle: string;
  readonly role: PartyPlayerRole;
  readonly roomId: string;
  readonly roomIndex: number;
  readonly racerSlot: number | null;
  readonly colorHex: string;
  readonly score: number;
  readonly bumpsLanded: number;
  readonly crowdActionsTriggered: number;
}

export interface PartyRoomSnapshot {
  /** Base room prefix (e.g. `ARGON`) */
  readonly roomCode: string;
  /** Currently focused/active room ID on the stage (e.g. `ARGON-1`, `ARGON-2`) */
  readonly roomId: string;
  /** 1-based index of the currently focused room (`1`, `2`, ...) */
  readonly roomIndex: number;
  /** Active racer count in the currently focused `roomId` */
  readonly roomPlayerCount: number;
  /** Configurable per-room marble cap (default `4`, configurable `4..8`) */
  readonly maxMarblesPerRoom: number;
  /** Summary of all active/overflow rooms (`ARGON-1`, `ARGON-2`, ...) */
  readonly allRoomsSummary: readonly PartyRoomSummary[];
  readonly lanIp: string;
  readonly port: number;
  readonly joinUrl: string;
  readonly customTunnelUrl: string | null;
  readonly updatedAtMs: number;
  /** All players across all overflow rooms (each has `.roomId` & `.roomIndex`) */
  readonly players: readonly PartyPlayerRecord[];
  /** Players filtered to the currently focused stage `roomId` */
  readonly roomPlayers: readonly PartyPlayerRecord[];
  readonly activeMutations: readonly PartyWorldMutationEvent[];
  readonly recentToasts: readonly PartyArcadeToast[];
  readonly crowdPrompts: readonly PartyCrowdPrompt[];
  readonly leaderboard: readonly PartyLeaderboardEntry[];
  readonly waveSurgeMultiplier: number;
}

export interface JoinPartyRequest {
  readonly roomCode?: string;
  readonly playerId?: string;
  readonly playerSecret?: string;
  readonly handle: string;
  readonly preferredRole?: PartyPlayerRole;
  readonly preferredSlot?: number;
  readonly isSimulated?: boolean;
}

export interface JoinPartyResponse {
  readonly player: PartyPlayerRecord;
  readonly playerId: string;
  readonly playerSecret: string;
  readonly roomId: string;
  readonly roomIndex: number;
  readonly roomPlayerCount: number;
  readonly maxMarblesPerRoom: number;
  readonly autoOverflowed: boolean;
  readonly allRoomsSummary: readonly PartyRoomSummary[];
  readonly snapshot: PartyRoomSnapshot;
}

export interface PartyInputPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly playerSecret?: string;
  readonly moveXZ: readonly [number, number];
  readonly jumpPressed?: boolean;
  readonly backspinActive?: boolean;
}

export interface PartyActionPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly playerSecret?: string;
  readonly kind: CrowdMutatorKind;
  /** Optional world target coordinate (defaults to lead racer trajectory ahead) */
  readonly targetPosition?: Vec3;
}

export interface PartyPromptPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly playerSecret?: string;
  readonly twist: string;
}
