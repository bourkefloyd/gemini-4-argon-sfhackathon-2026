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

export const MAX_ARENA_RACERS = 8;
export const CROWD_ACTION_COOLDOWN_MS = 4000;
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
  readonly name: string;
  readonly hex: string;
  readonly rgb: Vec3;
}

export const PARTY_MARBLE_PALETTES: readonly PartyMarblePalette[] = [
  { slotIndex: 0, name: 'Cobalt Arcade', hex: '#2563eb', rgb: [0.15, 0.39, 0.92] },
  { slotIndex: 1, name: 'Crimson Flare', hex: '#e11d48', rgb: [0.88, 0.11, 0.28] },
  { slotIndex: 2, name: 'Jade Matrix', hex: '#10b981', rgb: [0.06, 0.73, 0.51] },
  { slotIndex: 3, name: 'Hyper Gold', hex: '#f59e0b', rgb: [0.96, 0.62, 0.04] },
  { slotIndex: 4, name: 'Amethyst Nova', hex: '#9333ea', rgb: [0.58, 0.2, 0.92] },
  { slotIndex: 5, name: 'Cyber Cyan', hex: '#06b6d4', rgb: [0.02, 0.71, 0.83] },
  { slotIndex: 6, name: 'Solar Magenta', hex: '#ec4899', rgb: [0.93, 0.28, 0.6] },
  { slotIndex: 7, name: 'Titanium Pearl', hex: '#e2e8f0', rgb: [0.89, 0.91, 0.94] },
];

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

export interface PartyPlayerRecord {
  readonly playerId: string;
  readonly handle: string;
  readonly role: PartyPlayerRole;
  /** `0..7` for Arena Racers, `null` for Crowd Chaos & Rescue Architects */
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
  readonly racerSlot: number | null;
  readonly colorHex: string;
  readonly score: number;
  readonly bumpsLanded: number;
  readonly crowdActionsTriggered: number;
}

export interface PartyRoomSnapshot {
  readonly roomCode: string;
  readonly lanIp: string;
  readonly port: number;
  readonly joinUrl: string;
  readonly customTunnelUrl: string | null;
  readonly updatedAtMs: number;
  readonly players: readonly PartyPlayerRecord[];
  readonly activeMutations: readonly PartyWorldMutationEvent[];
  readonly recentToasts: readonly PartyArcadeToast[];
  readonly crowdPrompts: readonly PartyCrowdPrompt[];
  readonly leaderboard: readonly PartyLeaderboardEntry[];
  readonly waveSurgeMultiplier: number;
}

export interface JoinPartyRequest {
  readonly roomCode?: string;
  readonly playerId?: string;
  readonly handle: string;
  readonly preferredRole?: PartyPlayerRole;
}

export interface PartyInputPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly moveXZ: readonly [number, number];
  readonly jumpPressed?: boolean;
  readonly backspinActive?: boolean;
}

export interface PartyActionPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly kind: CrowdMutatorKind;
  /** Optional world target coordinate (defaults to lead racer trajectory ahead) */
  readonly targetPosition?: Vec3;
}

export interface PartyPromptPayload {
  readonly roomCode?: string;
  readonly playerId: string;
  readonly twist: string;
}
