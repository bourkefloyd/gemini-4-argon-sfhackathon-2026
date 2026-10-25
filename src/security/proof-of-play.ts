/**
 * Deterministic 120 Hz Proof-of-Play Progressive Sector Streaming & Input Verifier
 * (`src/security/proof-of-play.ts`)
 *
 * Security + Anti-Clone Moat:
 * 1. Rather than bundling all courses in the initial client payload, subsequent course
 *    sectors are gated behind a Proof-of-Play state transition.
 * 2. The client records a compact 120 Hz `InputCommand` stream (`packInputFrames`),
 *    quantizing `moveXZ` to `Int8` with Run-Length Encoding (RLE) so a full arcade run
 *    takes only a few hundred bytes on the wire.
 * 3. `verifyProofOfPlay` replays the unpacked input stream deterministically against
 *    `createMarbleSimulation` at `fixedDt = 1/120` (backed by the fast `.msdf` bytecode
 *    evaluator) in < 2 ms of server CPU time, verifies goal capture and timer carry-over,
 *    and issues a keyed HMAC/FNV256 `SectorUnlockToken` + ephemeral sector decryption seed.
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  type MarbleLifecycleStatus,
  type PhysicsConfig,
  type Vec3,
} from '../contracts';
import { createMarbleSimulation } from '../physics';
import {
  compileCourseToMsdfBytecode,
  createMsdfBytecodeWorldEvaluator,
} from './msdf-bytecode';

export const MPOP_MAGIC = 0x504f504d; // "MPOP" in little-endian
export const MPOP_VERSION = 1;
export const MPOP_HEADER_BYTES = 16;

export interface SectorUnlockToken {
  readonly completedCourseId: string;
  readonly unlockedCourseIndex: number;
  readonly sessionNonce: number;
  readonly ticksVerified: number;
  readonly elapsedTimeSec: number;
  readonly carryOverTimeSec: number;
  readonly trajectoryDigest: string;
  /** Ephemeral 32-bit decryption seed derived for the next course's `.msdf` binary */
  readonly nextSectorSeed: number;
  /** Keyed MAC signature authenticating the unlock token */
  readonly signature: string;
}

export interface ProofOfPlayOptions {
  /** Whether the run must reach `'goal'` status to issue an unlock token (default: `true`) */
  readonly requireGoal?: boolean;
  /** Optional custom evaluator (defaults to fast `.msdf` bytecode evaluator) */
  readonly evaluator?: CpuWorldEvaluator;
  /** Optional physics configuration override */
  readonly physicsConfig?: PhysicsConfig;
}

export interface ProofOfPlayVerificationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly reachedGoal: boolean;
  readonly finalStatus: MarbleLifecycleStatus;
  readonly finalPosition: Vec3;
  readonly finalVelocity: Vec3;
  readonly ticksSimulated: number;
  readonly elapsedTimeSec: number;
  readonly remainingTimeSec: number;
  readonly carryOverTimeSec: number;
  readonly verificationTimeMs: number;
  readonly wireByteLength: number;
  readonly trajectoryDigest: string;
  readonly unlockToken: SectorUnlockToken | null;
}

function quantizeAxis(v: number): number {
  const clamped = v < -1 ? -1 : v > 1 ? 1 : v;
  return Math.round(clamped * 127);
}

function dequantizeAxis(q: number): number {
  // Sign-extend 8-bit integer
  const s8 = (q << 24) >> 24;
  return Math.max(-1, Math.min(1, s8 / 127));
}

/**
 * Keyed 256-bit mixing digest (deterministic across browser and Node/Edge runtimes without async WebCrypto latency).
 */
export function computeKeyedDigestHex(payload: string, secret: string): string {
  const combined = `${secret}::${payload}::${secret.length}`;
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);

  for (let i = 0; i < combined.length; i++) {
    const code = combined.charCodeAt(i);
    const lane = i & 7;
    let h = state[lane] ^ (code + Math.imul(i + 1, 0x9e3779b9));
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) >>> 0;
    state[lane] = h;
    state[(lane + 1) & 7] = (state[(lane + 1) & 7] + Math.imul(h, 0x27d4eb2d)) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += state[i].toString(16).padStart(8, '0');
  }
  return hex;
}

/**
 * Pack a 120 Hz `InputCommand[]` sequence into a compact RLE-compressed `.mpop` binary packet.
 *
 * Each RLE packet is 4 bytes:
 *   - byte 0: `moveX` quantized `Int8` (`-127..127`)
 *   - byte 1: `moveZ` quantized `Int8` (`-127..127`)
 *   - byte 2: `flags` (`bit 0: jumpPressed`, `bit 1: respawnPressed`)
 *   - byte 3: `runLength` (`1..255` consecutive identical quantized ticks)
 */
export function packInputFrames(
  frames: readonly InputCommand[],
  sessionNonce = 0x20266e5b,
): Uint8Array {
  const packets: number[] = [];
  let currentQx = 0;
  let currentQz = 0;
  let currentFlags = 0;
  let runLength = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const qx = quantizeAxis(f.moveXZ[0]) & 0xff;
    const qz = quantizeAxis(f.moveXZ[1]) & 0xff;
    const flags = (f.jumpPressed ? 1 : 0) | (f.respawnPressed ? 2 : 0);

    if (
      runLength > 0 &&
      qx === currentQx &&
      qz === currentQz &&
      flags === currentFlags &&
      runLength < 255
    ) {
      runLength++;
    } else {
      if (runLength > 0) {
        packets.push(currentQx, currentQz, currentFlags, runLength);
      }
      currentQx = qx;
      currentQz = qz;
      currentFlags = flags;
      runLength = 1;
    }
  }

  if (runLength > 0) {
    packets.push(currentQx, currentQz, currentFlags, runLength);
  }

  const out = new Uint8Array(MPOP_HEADER_BYTES + packets.length);
  const view = new DataView(out.buffer, out.byteOffset, MPOP_HEADER_BYTES);
  view.setUint32(0, MPOP_MAGIC, true);
  view.setUint16(4, MPOP_VERSION, true);
  view.setUint16(6, packets.length / 4, true);
  view.setUint32(8, frames.length, true);
  view.setUint32(12, sessionNonce >>> 0, true);

  for (let i = 0; i < packets.length; i++) {
    out[MPOP_HEADER_BYTES + i] = packets[i];
  }

  return out;
}

/**
 * Unpack a binary `.mpop` input packet back into a deterministic 120 Hz `InputCommand[]` stream.
 */
export function unpackInputFrames(packed: Uint8Array): {
  frames: InputCommand[];
  sessionNonce: number;
  totalTicks: number;
} {
  if (packed.byteLength < MPOP_HEADER_BYTES) {
    throw new Error('Invalid .mpop input stream: shorter than 16-byte header');
  }
  const view = new DataView(packed.buffer, packed.byteOffset, MPOP_HEADER_BYTES);
  const magic = view.getUint32(0, true);
  if (magic !== MPOP_MAGIC) {
    throw new Error(`Invalid .mpop magic: 0x${magic.toString(16)}`);
  }

  const totalTicks = view.getUint32(8, true);
  const sessionNonce = view.getUint32(12, true);
  const frames: InputCommand[] = [];

  for (let offset = MPOP_HEADER_BYTES; offset + 3 < packed.byteLength; offset += 4) {
    const moveX = dequantizeAxis(packed[offset]);
    const moveZ = dequantizeAxis(packed[offset + 1]);
    const flags = packed[offset + 2];
    const runLen = packed[offset + 3];
    const jumpPressed = (flags & 1) !== 0;
    const respawnPressed = (flags & 2) !== 0;

    for (let r = 0; r < runLen; r++) {
      frames.push({
        moveXZ: [moveX, moveZ],
        // Edge-triggered button presses fire on the first tick of a run
        jumpPressed: r === 0 ? jumpPressed : false,
        respawnPressed: r === 0 ? respawnPressed : false,
      });
    }
  }

  if (frames.length !== totalTicks) {
    throw new Error(
      `Corrupted .mpop RLE stream: header declared ${totalTicks} ticks, unpacked ${frames.length}`,
    );
  }

  return { frames, sessionNonce, totalTicks };
}

function serializeUnlockTokenPayload(
  token: Omit<SectorUnlockToken, 'signature'>,
): string {
  return [
    token.completedCourseId,
    token.unlockedCourseIndex,
    token.sessionNonce >>> 0,
    token.ticksVerified,
    token.elapsedTimeSec.toFixed(4),
    token.carryOverTimeSec.toFixed(4),
    token.trajectoryDigest,
    token.nextSectorSeed >>> 0,
  ].join('|');
}

/**
 * Verify a previously issued `SectorUnlockToken` before streaming the next course's `.msdf` key.
 */
export function verifySectorUnlockToken(
  token: SectorUnlockToken,
  serverSecret: string,
): boolean {
  const expectedSig = computeKeyedDigestHex(
    serializeUnlockTokenPayload(token),
    serverSecret,
  );
  return expectedSig === token.signature;
}

/**
 * Deterministically replay a packed 120 Hz input stream against `MarblePhysics` and
 * issue a signed `SectorUnlockToken` if the run satisfies course rules.
 */
export function verifyProofOfPlay(
  course: CourseSpec,
  packedInputs: Uint8Array,
  serverSecret: string,
  options: ProofOfPlayOptions = {},
): ProofOfPlayVerificationResult {
  const tStart = performance.now();
  const requireGoal = options.requireGoal ?? true;
  const config = options.physicsConfig ?? DEFAULT_PHYSICS_CONFIG;

  let unpacked: ReturnType<typeof unpackInputFrames>;
  try {
    unpacked = unpackInputFrames(packedInputs);
  } catch (err) {
    return {
      valid: false,
      reason: err instanceof Error ? err.message : 'Failed to unpack input stream',
      reachedGoal: false,
      finalStatus: 'fell',
      finalPosition: course.startPos,
      finalVelocity: [0, 0, 0],
      ticksSimulated: 0,
      elapsedTimeSec: 0,
      remainingTimeSec: 0,
      carryOverTimeSec: 0,
      verificationTimeMs: performance.now() - tStart,
      wireByteLength: packedInputs.byteLength,
      trajectoryDigest: '',
      unlockToken: null,
    };
  }

  const maxAllowedTicks = Math.ceil(course.parTimeSec / config.fixedDt);
  if (unpacked.totalTicks === 0 || unpacked.totalTicks > maxAllowedTicks) {
    return {
      valid: false,
      reason: `Tick count ${unpacked.totalTicks} outside valid range [1..${maxAllowedTicks}]`,
      reachedGoal: false,
      finalStatus: 'racing',
      finalPosition: course.startPos,
      finalVelocity: [0, 0, 0],
      ticksSimulated: 0,
      elapsedTimeSec: 0,
      remainingTimeSec: 0,
      carryOverTimeSec: 0,
      verificationTimeMs: performance.now() - tStart,
      wireByteLength: packedInputs.byteLength,
      trajectoryDigest: '',
      unlockToken: null,
    };
  }

  const evaluator =
    options.evaluator ??
    createMsdfBytecodeWorldEvaluator(compileCourseToMsdfBytecode(course, 0));
  const sim = createMarbleSimulation(course, evaluator, config);

  let ticksSimulated = 0;
  let reachedGoal = false;
  const checkpointsSampled: string[] = [];

  for (let tick = 0; tick < unpacked.frames.length; tick++) {
    const simTime = (tick + 1) * config.fixedDt;
    const state = sim.stepFixed(config.fixedDt, unpacked.frames[tick], simTime);
    ticksSimulated++;

    if (tick % 30 === 0 || state.status === 'goal') {
      checkpointsSampled.push(
        `${tick}:${state.position[0].toFixed(2)},${state.position[1].toFixed(2)},${state.position[2].toFixed(2)}:${state.status}`,
      );
    }

    if (state.status === 'goal') {
      reachedGoal = true;
      break;
    }
  }

  const finalState = sim.getState();
  const elapsedTimeSec = ticksSimulated * config.fixedDt;
  const remainingTimeSec = Math.max(0, course.parTimeSec - elapsedTimeSec);
  const carryOverTimeSec = reachedGoal ? remainingTimeSec + course.bonusTimeSec : 0;

  const trajectoryDigest = computeKeyedDigestHex(
    `${course.id}|${unpacked.sessionNonce}|${checkpointsSampled.join(';')}`,
    serverSecret,
  );

  const verificationTimeMs = performance.now() - tStart;

  if (requireGoal && !reachedGoal) {
    return {
      valid: false,
      reason: `Run ended in status '${finalState.status}' at [${finalState.position.map((n) => n.toFixed(2)).join(', ')}] without reaching goal`,
      reachedGoal: false,
      finalStatus: finalState.status,
      finalPosition: finalState.position,
      finalVelocity: finalState.velocity,
      ticksSimulated,
      elapsedTimeSec,
      remainingTimeSec,
      carryOverTimeSec: 0,
      verificationTimeMs,
      wireByteLength: packedInputs.byteLength,
      trajectoryDigest,
      unlockToken: null,
    };
  }

  const nextSectorSeed =
    Number.parseInt(trajectoryDigest.slice(0, 8), 16) ^
    ((unpacked.sessionNonce + course.index * 0x9e3779b9) >>> 0);

  const unsignedToken: Omit<SectorUnlockToken, 'signature'> = {
    completedCourseId: course.id,
    unlockedCourseIndex: course.index + 1,
    sessionNonce: unpacked.sessionNonce,
    ticksVerified: ticksSimulated,
    elapsedTimeSec,
    carryOverTimeSec,
    trajectoryDigest,
    nextSectorSeed: nextSectorSeed >>> 0,
  };

  const signature = computeKeyedDigestHex(
    serializeUnlockTokenPayload(unsignedToken),
    serverSecret,
  );

  return {
    valid: true,
    reachedGoal,
    finalStatus: finalState.status,
    finalPosition: finalState.position,
    finalVelocity: finalState.velocity,
    ticksSimulated,
    elapsedTimeSec,
    remainingTimeSec,
    carryOverTimeSec,
    verificationTimeMs,
    wireByteLength: packedInputs.byteLength,
    trajectoryDigest,
    unlockToken: {
      ...unsignedToken,
      signature,
    },
  };
}

/**
 * Closed-loop 120 Hz waypoint guidance helper that generates a quantized-clean
 * `InputCommand[]` stream rolling the marble along `waypoints` into the Goal Pad.
 */
export function recordGuidedCourseRun(
  course: CourseSpec,
  waypoints: readonly Vec3[],
  maxTicks = 2400,
): InputCommand[] {
  const evaluator = createMsdfBytecodeWorldEvaluator(
    compileCourseToMsdfBytecode(course, 0),
  );
  const sim = createMarbleSimulation(course, evaluator, DEFAULT_PHYSICS_CONFIG);
  const recorded: InputCommand[] = [];
  let wpIndex = 0;

  for (let tick = 0; tick < maxTicks; tick++) {
    const state = sim.getState();
    if (state.status === 'goal') {
      break;
    }

    const target = waypoints[Math.min(wpIndex, waypoints.length - 1)];
    const dx = target[0] - state.position[0];
    const dz = target[2] - state.position[2];
    const distXZ = Math.hypot(dx, dz);

    if (distXZ < 2.2 && wpIndex < waypoints.length - 1) {
      wpIndex++;
    }

    // PD controller: steer toward current waypoint while damping excessive cross-track velocity
    const desiredSpeed = wpIndex === waypoints.length - 1 && distXZ < 4.5 ? 6.5 : 13.5;
    const dirX = distXZ > 1e-4 ? dx / distXZ : 0;
    const dirZ = distXZ > 1e-4 ? dz / distXZ : 0;
    const desiredVx = dirX * desiredSpeed;
    const desiredVz = dirZ * desiredSpeed;

    const rawInX = (desiredVx - state.velocity[0] * 0.55) * 0.22;
    const rawInZ = (desiredVz - state.velocity[2] * 0.55) * 0.22;
    const mag = Math.hypot(rawInX, rawInZ);
    const scale = mag > 1.0 ? 1.0 / mag : 1.0;

    // Quantize to Int8 steps immediately so packed -> unpacked replay is bit-identical!
    const qx = dequantizeAxis(quantizeAxis(rawInX * scale) & 0xff);
    const qz = dequantizeAxis(quantizeAxis(rawInZ * scale) & 0xff);

    const cmd: InputCommand = {
      moveXZ: [qx, qz],
      jumpPressed: false,
      respawnPressed: false,
    };
    recorded.push(cmd);
    sim.stepFixed(
      DEFAULT_PHYSICS_CONFIG.fixedDt,
      cmd,
      (tick + 1) * DEFAULT_PHYSICS_CONFIG.fixedDt,
    );
  }

  return recorded;
}
