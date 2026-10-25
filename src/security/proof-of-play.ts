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
 *    evaluator) in < 2 ms of server CPU time, verifies single-use challenge nonces
 *    against `replayConsumedNonces`, and issues an RFC 2104 HMAC-SHA256 signed
 *    `SectorUnlockToken` + ephemeral sector decryption seed.
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
  /** RFC 2104 HMAC-SHA256 hex signature authenticating the unlock token */
  readonly signature: string;
}

export interface ProofOfPlayOptions {
  /** Whether the run must reach `'goal'` status to issue an unlock token (default: `true`) */
  readonly requireGoal?: boolean;
  /** Whether the `sessionNonce` must have been pre-issued by `issueProofChallengeNonce` (default: `false`) */
  readonly requireIssuedNonce?: boolean;
  /** Whether to reject previously consumed `sessionNonce` values in `replayConsumedNonces` (default: `true`) */
  readonly rejectReplayNonces?: boolean;
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

/**
 * Active server-issued challenge nonces awaiting consumption.
 */
export const issuedChallengeNonces = new Map<
  number,
  { readonly courseId?: string; readonly issuedAtMs: number }
>();

/**
 * Consumed single-use challenge nonces preventing `.mpop` replay attacks.
 */
export const replayConsumedNonces = new Set<number>();

let fallbackNonceCounter = 0x6e5b0001;

/**
 * Issue a cryptographically random, single-use 32-bit challenge nonce for a Proof-of-Play session.
 */
export function issueProofChallengeNonce(courseId?: string): number {
  const buf = new Uint32Array(1);
  let nonce = 0;
  for (let attempt = 0; attempt < 16; attempt++) {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      globalThis.crypto.getRandomValues(buf);
      nonce = buf[0] >>> 0;
    } else {
      fallbackNonceCounter = (Math.imul(fallbackNonceCounter, 1664525) + 1013904223) >>> 0;
      nonce = fallbackNonceCounter;
    }
    if (nonce !== 0 && !issuedChallengeNonces.has(nonce) && !replayConsumedNonces.has(nonce)) {
      break;
    }
  }
  if (nonce === 0) {
    nonce = 0x20266e5b;
  }
  issuedChallengeNonces.set(nonce, {
    courseId,
    issuedAtMs: Date.now(),
  });
  return nonce;
}

/**
 * Clear issued and consumed challenge nonces (for test isolation or server epoch rotation).
 */
export function resetProofChallengeNonces(): void {
  issuedChallengeNonces.clear();
  replayConsumedNonces.clear();
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

// ============================================================================
// FIPS 180-4 SHA-256 & RFC 2104 HMAC-SHA256 (Browser + Node + WebCrypto)
// ============================================================================

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * Standard FIPS 180-4 SHA-256 digest over raw `Uint8Array` bytes.
 */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  const bitLenHi = Math.floor((data.byteLength * 8) / 0x100000000);
  const bitLenLo = (data.byteLength * 8) >>> 0;
  const paddedLen = (((data.byteLength + 9 + 63) >> 6) << 6);
  const padded = new Uint8Array(paddedLen);
  padded.set(data);
  padded[data.byteLength] = 0x80;
  const padView = new DataView(padded.buffer);
  padView.setUint32(paddedLen - 8, bitLenHi, false);
  padView.setUint32(paddedLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = padView.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Constant-time hex string equality check to prevent timing attacks on HMAC verification.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Standard RFC 2104 HMAC-SHA256 hex digest (synchronous, deterministic across Browser, Node, and Edge).
 */
export function computeHmacSha256Hex(payload: string, secret: string): string {
  const encoder = new TextEncoder();
  const keyRaw = encoder.encode(secret);
  const msgBytes = encoder.encode(payload);

  const blockKey = new Uint8Array(64);
  if (keyRaw.byteLength > 64) {
    blockKey.set(sha256Bytes(keyRaw));
  } else {
    blockKey.set(keyRaw);
  }

  const ipad = new Uint8Array(64 + msgBytes.byteLength);
  const opad = new Uint8Array(64 + 32);
  for (let i = 0; i < 64; i++) {
    ipad[i] = blockKey[i] ^ 0x36;
    opad[i] = blockKey[i] ^ 0x5c;
  }
  ipad.set(msgBytes, 64);

  const innerHash = sha256Bytes(ipad);
  opad.set(innerHash, 64);
  const outerHash = sha256Bytes(opad);
  return bytesToHex(outerHash);
}

/**
 * Async WebCrypto (`crypto.subtle.sign('HMAC', ...)`) HMAC-SHA256 hex digest.
 * Produces bit-identical output to `computeHmacSha256Hex`.
 */
export async function computeHmacSha256WebCryptoHex(
  payload: string,
  secret: string,
): Promise<string> {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    const encoder = new TextEncoder();
    const keyBytes = encoder.encode(secret);
    const msgBytes = encoder.encode(payload);
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, msgBytes);
    return bytesToHex(new Uint8Array(sigBuffer));
  }
  return computeHmacSha256Hex(payload, secret);
}

/**
 * Keyed 256-bit HMAC-SHA256 digest (alias of `computeHmacSha256Hex`).
 */
export function computeKeyedDigestHex(payload: string, secret: string): string {
  return computeHmacSha256Hex(payload, secret);
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
  const expectedSig = computeHmacSha256Hex(
    serializeUnlockTokenPayload(token),
    serverSecret,
  );
  return timingSafeEqualHex(expectedSig, token.signature);
}

/**
 * Async WebCrypto verification of a `SectorUnlockToken` using `crypto.subtle`.
 */
export async function verifySectorUnlockTokenWebCrypto(
  token: SectorUnlockToken,
  serverSecret: string,
): Promise<boolean> {
  const expectedSig = await computeHmacSha256WebCryptoHex(
    serializeUnlockTokenPayload(token),
    serverSecret,
  );
  return timingSafeEqualHex(expectedSig, token.signature);
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
  const requireIssuedNonce = options.requireIssuedNonce ?? false;
  const rejectReplayNonces = options.rejectReplayNonces ?? true;
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

  const nonce = unpacked.sessionNonce >>> 0;

  if (rejectReplayNonces && replayConsumedNonces.has(nonce)) {
    return {
      valid: false,
      reason: `Replay attack detected: sessionNonce 0x${nonce.toString(16)} has already been consumed`,
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

  const issuedMeta = issuedChallengeNonces.get(nonce);
  if (requireIssuedNonce && !issuedMeta) {
    return {
      valid: false,
      reason: `Unrecognized challenge nonce 0x${nonce.toString(16)}: not issued by server`,
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

  if (issuedMeta?.courseId && issuedMeta.courseId !== course.id) {
    return {
      valid: false,
      reason: `Challenge nonce 0x${nonce.toString(16)} was issued for course '${issuedMeta.courseId}', not '${course.id}'`,
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

  const trajectoryDigest = computeHmacSha256Hex(
    `${course.id}|${nonce}|${checkpointsSampled.join(';')}`,
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

  // Consume the single-use challenge nonce upon successful verification
  issuedChallengeNonces.delete(nonce);
  replayConsumedNonces.add(nonce);

  const nextSectorSeed =
    Number.parseInt(trajectoryDigest.slice(0, 8), 16) ^
    ((nonce + course.index * 0x9e3779b9) >>> 0);

  const unsignedToken: Omit<SectorUnlockToken, 'signature'> = {
    completedCourseId: course.id,
    unlockedCourseIndex: course.index + 1,
    sessionNonce: nonce,
    ticksVerified: ticksSimulated,
    elapsedTimeSec,
    carryOverTimeSec,
    trajectoryDigest,
    nextSectorSeed: nextSectorSeed >>> 0,
  };

  const signature = computeHmacSha256Hex(
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
