/**
 * Classic Marble Madness Exotic SDF Hazards POC (`src/vfx/exotic-hazards.ts`)
 *
 * Clean, self-contained CPU + GLSL/WGSL SDF evaluators and physics helpers for:
 *   1. Suction Vortex / Vacuum Funnel (`sdVortexFunnel`):
 *      Smooth logarithmic gravity funnel that pulls the marble centripetally toward its rim
 *      while allowing high-speed tangential rim-orbiting to sling out the far side.
 *   2. Marble Muncher (`sdMarbleMuncher`):
 *      Animated CSG chomping sphere-mouth hazard (`opSmoothSubtract` jaw wedge + teeth ridges)
 *      that lunges and hops along a deterministic patrol path.
 */

import type { Vec3 } from '../contracts';
import { vec3Add, vec3Dot, vec3Length, vec3Normalize, vec3Scale, vec3Sub } from '../sdf/eval-cpu';

export interface VortexFunnelParams {
  /** World-space center of the funnel top rim plane */
  readonly center: Vec3;
  /** Outer rim radius where the funnel meets the surrounding track deck (`2.6` units) */
  readonly outerRadius: number;
  /** Inner drain throat radius at the center of the vortex (`0.45` units) */
  readonly throatRadius: number;
  /** Total vertical drop from the outer rim (`y = 0`) to the bottom of the throat (`1.8` units) */
  readonly depth: number;
  /** Thickness of the solid logarithmic funnel bowl shell (`0.42` units) */
  readonly wallThickness?: number;
  /** Logarithmic curvature steepness (`k_log > 0`, default `6.0`) */
  readonly logCurvature?: number;
  /** Centripetal suction strength pulling slow marbles toward the vortex axis (`16.0` u/s^2) */
  readonly suctionStrength?: number;
  /** Minimum tangential speed (`u/s`) required to orbit the rim and sling out the far side (`8.5` u/s) */
  readonly rimOrbitSpeedThreshold?: number;
  /** Tangential sling acceleration boost when rim-orbiting above threshold (`6.5` u/s^2) */
  readonly rimSlingBoost?: number;
}

export interface VortexDynamicsResult {
  /** Radial distance in XZ from the vortex center */
  readonly radialDistance: number;
  /** Whether the marble is currently inside the vortex influence zone */
  readonly inVortexZone: boolean;
  /** True when tangential speed exceeds `rimOrbitSpeedThreshold` (high-speed rim-orbit sling!) */
  readonly isRimOrbiting: boolean;
  /** True when the marble has dropped into the central drain throat */
  readonly inThroatTrap: boolean;
  /** Target funnel surface elevation `Y` at the marble's radial distance */
  readonly funnelSurfaceY: number;
  /** Net world-space acceleration `[ax, ay, az]` applied by vortex suction + rim-orbit sling */
  readonly acceleration: Vec3;
  /** Updated marble velocity after integrating over `dt` */
  readonly nextVelocity: Vec3;
}

export interface MarbleMuncherParams {
  /** Base patrol anchor position in world space */
  readonly center: Vec3;
  /** Outer spherical body radius (`0.85` units) */
  readonly radius: number;
  /** Chomps per second (`2.4` Hz) */
  readonly chompFrequency: number;
  /** Maximum jaw opening half-angle in radians (`0.65` rad) */
  readonly maxMouthAngleRad?: number;
  /** Patrol half-span vector in world space (e.g. `[3.2, 0, 0]`) */
  readonly patrolSpan?: Vec3;
  /** Patrol oscillation frequency in Hz (`0.55` Hz) */
  readonly patrolFrequency?: number;
  /** Phase offset in radians (`0`) */
  readonly phase?: number;
  /** Vertical lunge hop height synchronized with chomps (`0.45` units) */
  readonly lungeHopHeight?: number;
  /** Explicit facing unit vector in XZ (if omitted, automatically aligns with patrol lunge direction) */
  readonly facingDir?: Vec3;
}

export interface MarbleMuncherPose {
  /** Instantaneous world-space center of the Muncher (including patrol + hop) */
  readonly position: Vec3;
  /** Instantaneous linear velocity vector of the Muncher */
  readonly velocity: Vec3;
  /** Unit horizontal facing direction of the chomping mouth */
  readonly facingDir: Vec3;
  /** Current jaw half-opening angle in radians `[0 .. maxMouthAngleRad]` */
  readonly mouthAngleRad: number;
  /** Normalized `[0..1]` mouth openness (`0` = snapped shut, `1` = wide open) */
  readonly mouthOpenRatio: number;
}

export interface ExoticHazardsShaderSnippet {
  readonly glsl: string;
  readonly wgsl: string;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function smin(a: number, b: number, k: number): number {
  const safeK = Math.max(1e-4, k);
  const h = clamp(0.5 + (0.5 * (b - a)) / safeK, 0, 1);
  return b * (1 - h) + a * h - safeK * h * (1 - h);
}

function smaxSubtract(base: number, cut: number, k: number): number {
  const safeK = Math.max(1e-4, k);
  const h = clamp(0.5 - (0.5 * (base + cut)) / safeK, 0, 1);
  return base * (1 - h) + -cut * h + safeK * h * (1 - h);
}

/**
 * Evaluate the logarithmic funnel surface height `y <= 0` in local coordinates
 * at radial distance `r` from the funnel axis.
 *
 * - At `r >= outerRadius`: `y = 0` (flush with the outer rim deck).
 * - As `r -> throatRadius`: `y` plunges smoothly along a logarithmic horn to `-depth`.
 */
export function evalVortexSurfaceHeightLocal(
  r: number,
  outerRadius: number,
  throatRadius: number,
  depth: number,
  logCurvature = 6.0,
): number {
  const safeOuter = Math.max(outerRadius, throatRadius + 0.05);
  const u = clamp((r - throatRadius) / (safeOuter - throatRadius), 0, 1);
  const k = Math.max(0.5, logCurvature);
  const logProfile = Math.log(1.0 + k * u) / Math.log(1.0 + k);
  return -depth * (1.0 - logProfile);
}

/**
 * Signed Distance Function for the **Suction Vortex / Vacuum Funnel** (`sdVortexFunnel`).
 *
 * Evaluates a smooth logarithmic funnel bowl with raised outer rim lip and central suction throat.
 * Mirrors the GLSL/WGSL `sdVortexFunnel` implementation 1:1.
 */
export function sdVortexFunnel(p: Vec3, params: VortexFunnelParams): number {
  const q = vec3Sub(p, params.center);
  const r = Math.hypot(q[0], q[2]);
  const outerR = Math.max(params.outerRadius, 0.5);
  const throatR = clamp(params.throatRadius, 0.1, outerR - 0.1);
  const depth = Math.max(0.2, params.depth);
  const wallThick = Math.max(0.16, params.wallThickness ?? 0.42);
  const halfThick = 0.5 * wallThick;
  const kLog = Math.max(0.5, params.logCurvature ?? 6.0);

  // Normalized radial coordinate u in [0..1] from throatRadius to outerRadius
  const span = Math.max(outerR - throatR, 0.05);
  const u = clamp((r - throatR) / span, 0, 1);
  const invLogDenom = 1.0 / Math.log(1.0 + kLog);
  const logNorm = Math.log(1.0 + kLog * u) * invLogDenom;
  const yFunnel = -depth * (1.0 - logNorm);

  // Analytic radial slope dy/dr for normal-corrected thickness
  const dyDr =
    r >= throatR && r <= outerR
      ? (depth * kLog * invLogDenom) / ((1.0 + kLog * u) * span)
      : 0.0;
  const cosSlope = 1.0 / Math.sqrt(1.0 + dyDr * dyDr);

  // Signed distance to the logarithmic funnel shell between [throatR .. outerR]
  const dRadialSpan = Math.max(throatR - r, r - outerR);
  const dShellY = (Math.abs(q[1] - (yFunnel - halfThick)) - halfThick) * cosSlope;
  const dBowl =
    Math.hypot(Math.max(dRadialSpan, 0), Math.max(dShellY, 0)) +
    Math.min(Math.max(dRadialSpan, dShellY), 0);

  // Smooth toroidal rim collar at r = outerR, y = -0.06 so marbles roll smoothly over the lip
  const rimMinorR = halfThick * 1.05;
  const dRimCollar = Math.hypot(r - outerR, q[1] + halfThick * 0.65) - rimMinorR;

  return smin(dBowl, dRimCollar, 0.12);
}

/**
 * Evaluate the Suction Vortex / Vacuum Funnel centripetal pull and high-speed rim-orbit sling physics.
 *
 * - Slow marbles (`tangentialSpeed < rimOrbitSpeedThreshold`) are pulled centripetally inward
 *   toward the rim/funnel throat.
 * - High-speed tangential marbles (`tangentialSpeed >= rimOrbitSpeedThreshold`) bank around the
 *   logarithmic rim and receive a centrifugal + tangential sling boost to rocket out the far side!
 */
export function evaluateVortexDynamics(
  marblePos: Vec3,
  marbleVel: Vec3,
  params: VortexFunnelParams,
  dt = 1 / 120,
): VortexDynamicsResult {
  const rel = vec3Sub(marblePos, params.center);
  const r = Math.hypot(rel[0], rel[2]);
  const captureRadius = params.outerRadius * 1.25;
  const suctionStrength = params.suctionStrength ?? 16.0;
  const orbitThreshold = params.rimOrbitSpeedThreshold ?? 8.5;
  const slingBoost = params.rimSlingBoost ?? 6.5;

  const funnelSurfaceY =
    params.center[1] +
    evalVortexSurfaceHeightLocal(
      r,
      params.outerRadius,
      params.throatRadius,
      params.depth,
      params.logCurvature ?? 6.0,
    );

  if (r > captureRadius || r < 1e-5) {
    return {
      radialDistance: r,
      inVortexZone: false,
      isRimOrbiting: false,
      inThroatTrap: r <= params.throatRadius,
      funnelSurfaceY,
      acceleration: [0, 0, 0],
      nextVelocity: marbleVel,
    };
  }

  // Unit radial outward vector (rHat) and counter-clockwise tangent vector (thetaHat) in XZ
  const rHatX = rel[0] / r;
  const rHatZ = rel[2] / r;
  const thetaHatX = -rHatZ;
  const thetaHatZ = rHatX;

  const radialSpeed = marbleVel[0] * rHatX + marbleVel[2] * rHatZ;
  const signedTangentialSpeed = marbleVel[0] * thetaHatX + marbleVel[2] * thetaHatZ;
  const tangentialSpeed = Math.abs(signedTangentialSpeed);
  const orbitSign = signedTangentialSpeed >= 0 ? 1 : -1;

  const isRimOrbiting =
    tangentialSpeed >= orbitThreshold && r >= params.throatRadius * 1.25;

  // Radial pull profile peaks near the mid-funnel and outer rim
  const normR = clamp(r / params.outerRadius, 0, 1.25);
  const pullEnvelope = clamp(1.15 - 0.35 * normR, 0.35, 1.15);

  let radialAccel = -suctionStrength * pullEnvelope;
  let tangentialAccel = 0;

  if (isRimOrbiting) {
    // High-speed rim-orbiting: centrifugal support counters inward suction near the rim
    // and slings the marble along its orbital tangent out the far side!
    const orbitExcess = clamp(
      (tangentialSpeed - orbitThreshold) / Math.max(2.0, orbitThreshold * 0.5),
      0,
      1.5,
    );
    const rimTargetR = params.outerRadius * 0.86;
    const radialSpring = (rimTargetR - r) * 14.0;
    const outwardRelease = orbitExcess * suctionStrength * 0.65;
    radialAccel = radialSpring + outwardRelease - Math.min(0, radialSpeed) * 2.5;
    tangentialAccel = orbitSign * slingBoost * (1.0 + 0.45 * orbitExcess);
  } else {
    // Low/medium speed: gentle vortex swirl + strong inward centripetal pull toward the rim/funnel
    tangentialAccel = orbitSign * 2.2 * pullEnvelope;
  }

  const ax = rHatX * radialAccel + thetaHatX * tangentialAccel;
  const az = rHatZ * radialAccel + thetaHatZ * tangentialAccel;
  const acceleration: Vec3 = [ax, 0, az];
  const nextVelocity: Vec3 = [
    marbleVel[0] + ax * dt,
    marbleVel[1],
    marbleVel[2] + az * dt,
  ];

  return {
    radialDistance: r,
    inVortexZone: true,
    isRimOrbiting,
    inThroatTrap: r <= params.throatRadius,
    funnelSurfaceY,
    acceleration,
    nextVelocity,
  };
}

/**
 * Evaluate the instantaneous kinematic pose and jaw opening angle of a **Marble Muncher** at `time`.
 */
export function evaluateMarbleMuncherPose(
  time: number,
  params: MarbleMuncherParams,
): MarbleMuncherPose {
  const twoPi = Math.PI * 2;
  const phase = params.phase ?? 0;
  const chompOmega = twoPi * params.chompFrequency;
  const chompWave = 0.5 + 0.5 * Math.sin(chompOmega * time + phase);
  const mouthOpenRatio = Math.pow(clamp(chompWave, 0, 1), 1.35);
  const maxMouthAngle = params.maxMouthAngleRad ?? 0.65;
  const mouthAngleRad = maxMouthAngle * mouthOpenRatio;

  const patrolSpan = params.patrolSpan ?? [0, 0, 0];
  const patrolFreq = params.patrolFrequency ?? 0.55;
  const patrolOmega = twoPi * patrolFreq;
  const patrolAngle = patrolOmega * time + phase;
  const sinP = Math.sin(patrolAngle);
  const cosP = Math.cos(patrolAngle);

  const hopHeight = (params.lungeHopHeight ?? 0.42) * Math.abs(Math.sin(Math.PI * params.chompFrequency * time + phase * 0.5));
  const hopVelY =
    (params.lungeHopHeight ?? 0.42) *
    Math.PI *
    params.chompFrequency *
    Math.cos(Math.PI * params.chompFrequency * time + phase * 0.5) *
    (Math.sin(Math.PI * params.chompFrequency * time + phase * 0.5) >= 0 ? 1 : -1);

  const position: Vec3 = [
    params.center[0] + patrolSpan[0] * sinP,
    params.center[1] + patrolSpan[1] * sinP + hopHeight,
    params.center[2] + patrolSpan[2] * sinP,
  ];

  const velocity: Vec3 = [
    patrolSpan[0] * patrolOmega * cosP,
    patrolSpan[1] * patrolOmega * cosP + hopVelY,
    patrolSpan[2] * patrolOmega * cosP,
  ];

  let facingDir: Vec3 = [1, 0, 0];
  if (params.facingDir && Math.hypot(params.facingDir[0], params.facingDir[2]) > 1e-4) {
    facingDir = vec3Normalize([params.facingDir[0], 0, params.facingDir[2]]);
  } else if (Math.hypot(velocity[0], velocity[2]) > 1e-4) {
    facingDir = vec3Normalize([velocity[0], 0, velocity[2]]);
  } else if (Math.hypot(patrolSpan[0], patrolSpan[2]) > 1e-4) {
    facingDir = vec3Normalize([patrolSpan[0], 0, patrolSpan[2]]);
  }

  return {
    position,
    velocity,
    facingDir,
    mouthAngleRad,
    mouthOpenRatio,
  };
}

/**
 * Signed Distance Function for the classic **Marble Muncher** (`sdMarbleMuncher`).
 *
 * Combines a spherical body with an animated smooth-subtracted chomping jaw wedge
 * (`opSmoothSubtract`) aligned with the Muncher's lunge direction, plus upper brow ridges.
 * Mirrors the GLSL/WGSL `sdMarbleMuncher` implementation 1:1.
 */
export function sdMarbleMuncher(
  p: Vec3,
  time: number,
  params: MarbleMuncherParams,
): number {
  const pose = evaluateMarbleMuncherPose(time, params);
  const rel = vec3Sub(p, pose.position);

  // Transform world offset `rel` into Muncher-local space where +X is `facingDir`
  const fx = pose.facingDir[0];
  const fz = pose.facingDir[2];
  const localX = rel[0] * fx + rel[2] * fz;
  const localY = rel[1];
  const localZ = -rel[0] * fz + rel[2] * fx;

  const r = Math.max(0.15, params.radius);
  const dBody = Math.hypot(localX, localY, localZ) - r;

  // Upper angry eye/brow sockets slightly embossed on top-front
  const eyeX = localX - r * 0.42;
  const eyeY = localY - r * 0.48;
  const eyeZ = Math.abs(localZ) - r * 0.34;
  const dEyes = Math.hypot(eyeX, eyeY, eyeZ) - r * 0.18;
  let dMuncher = smin(dBody, dEyes, 0.06);

  // Subtract the animated chomping mouth wedge when the jaws open
  const theta = pose.mouthAngleRad;
  if (theta > 0.015) {
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    // Point is inside the open mouth wedge when |localY| < localX * tan(theta) and localX > -0.12*r
    const dUpperPlane = localY * cosT - localX * sinT;
    const dLowerPlane = -localY * cosT - localX * sinT;
    const dBackThroat = -localX - r * 0.12;
    const dSideCheeks = Math.abs(localZ) - r * 0.82;
    const dMouthWedge = Math.max(
      Math.max(dUpperPlane, dLowerPlane),
      Math.max(dBackThroat, dSideCheeks),
    );

    dMuncher = smaxSubtract(dMuncher, dMouthWedge, 0.055);
  }

  return dMuncher;
}

/**
 * Evaluate whether the player marble is chomped by a Marble Muncher or squashes it from above.
 */
export function evaluateMuncherInteraction(
  marblePos: Vec3,
  marbleVel: Vec3,
  marbleRadius: number,
  time: number,
  params: MarbleMuncherParams,
): {
  readonly chomped: boolean;
  readonly squashedMuncher: boolean;
  readonly distance: number;
  readonly pose: MarbleMuncherPose;
} {
  const pose = evaluateMarbleMuncherPose(time, params);
  const toMarble = vec3Sub(marblePos, pose.position);
  const centerDist = vec3Length(toMarble);
  const contactThreshold = params.radius + marbleRadius;

  if (centerDist > contactThreshold * 1.15) {
    return {
      chomped: false,
      squashedMuncher: false,
      distance: centerDist - contactThreshold,
      pose,
    };
  }

  // If the marble lands from above onto the Muncher's crown while falling downward -> squash!
  const relDir = vec3Normalize(toMarble);
  const squashedMuncher =
    relDir[1] > 0.68 && marbleVel[1] < -2.5 && centerDist <= contactThreshold * 1.05;

  // If the marble is in front of the Muncher's jaws while the mouth is open or snapping -> chomped!
  const forwardAlign = relDir[0] * pose.facingDir[0] + relDir[2] * pose.facingDir[2];
  const chomped =
    !squashedMuncher &&
    centerDist <= contactThreshold * 0.96 &&
    (forwardAlign > 0.15 || pose.mouthOpenRatio > 0.25);

  return {
    chomped,
    squashedMuncher,
    distance: centerDist - contactThreshold,
    pose,
  };
}

/**
 * Returns lockstep GLSL ES 3.00 and WGSL shader functions for `sdVortexFunnel` and `sdMarbleMuncher`.
 */
export function getExoticHazardsShaderSnippet(): ExoticHazardsShaderSnippet {
  const glsl = `// --- Exotic SDF Hazards: Suction Vortex Funnel & Marble Muncher (GLSL ES 3.00) ---
float sdVortexFunnel(vec3 p, float outerR, float throatR, float depth, float wallThick, float kLog) {
  float r = length(p.xz);
  float safeOuter = max(outerR, 0.5);
  float safeThroat = clamp(throatR, 0.1, safeOuter - 0.1);
  float halfThick = 0.5 * max(wallThick, 0.16);
  float span = max(safeOuter - safeThroat, 0.05);
  float u = clamp((r - safeThroat) / span, 0.0, 1.0);
  float invLog = 1.0 / log(1.0 + kLog);
  float logNorm = log(1.0 + kLog * u) * invLog;
  float yFunnel = -depth * (1.0 - logNorm);

  float dyDr = (r >= safeThroat && r <= safeOuter)
    ? (depth * kLog * invLog) / ((1.0 + kLog * u) * span)
    : 0.0;
  float cosSlope = inversesqrt(1.0 + dyDr * dyDr);

  float dRadialSpan = max(safeThroat - r, r - safeOuter);
  float dShellY = (abs(p.y - (yFunnel - halfThick)) - halfThick) * cosSlope;
  vec2 q = vec2(dRadialSpan, dShellY);
  float dBowl = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);

  float dRimCollar = length(vec2(r - safeOuter, p.y + halfThick * 0.65)) - halfThick * 1.05;
  float h = clamp(0.5 + 0.5 * (dRimCollar - dBowl) / 0.12, 0.0, 1.0);
  return mix(dRimCollar, dBowl, h) - 0.12 * h * (1.0 - h);
}

float sdMarbleMuncher(vec3 p, float radius, float mouthAngleRad, vec2 facingXZ) {
  vec2 f = normalize(facingXZ);
  vec3 q = vec3(p.x * f.x + p.z * f.y, p.y, -p.x * f.y + p.z * f.x);
  float r = max(0.15, radius);
  float dBody = length(q) - r;
  vec3 eyeP = vec3(q.x - r * 0.42, q.y - r * 0.48, abs(q.z) - r * 0.34);
  float dEyes = length(eyeP) - r * 0.18;
  float hEye = clamp(0.5 + 0.5 * (dEyes - dBody) / 0.06, 0.0, 1.0);
  float dMuncher = mix(dEyes, dBody, hEye) - 0.06 * hEye * (1.0 - hEye);

  if (mouthAngleRad > 0.015) {
    float s = sin(mouthAngleRad);
    float c = cos(mouthAngleRad);
    float dUpper = q.y * c - q.x * s;
    float dLower = -q.y * c - q.x * s;
    float dBack = -q.x - r * 0.12;
    float dSide = abs(q.z) - r * 0.82;
    float dWedge = max(max(dUpper, dLower), max(dBack, dSide));
    float hCut = clamp(0.5 - 0.5 * (dMuncher + dWedge) / 0.055, 0.0, 1.0);
    dMuncher = mix(dMuncher, -dWedge, hCut) + 0.055 * hCut * (1.0 - hCut);
  }
  return dMuncher;
}
`;

  const wgsl = `// --- Exotic SDF Hazards: Suction Vortex Funnel & Marble Muncher (WGSL) ---
fn sdVortexFunnel(p: vec3<f32>, outerR: f32, throatR: f32, depth: f32, wallThick: f32, kLog: f32) -> f32 {
  let r = length(p.xz);
  let safeOuter = max(outerR, 0.5);
  let safeThroat = clamp(throatR, 0.1, safeOuter - 0.1);
  let halfThick = 0.5 * max(wallThick, 0.16);
  let span = max(safeOuter - safeThroat, 0.05);
  let u = clamp((r - safeThroat) / span, 0.0, 1.0);
  let invLog = 1.0 / log(1.0 + kLog);
  let logNorm = log(1.0 + kLog * u) * invLog;
  let yFunnel = -depth * (1.0 - logNorm);

  let dyDr = select(0.0, (depth * kLog * invLog) / ((1.0 + kLog * u) * span), r >= safeThroat && r <= safeOuter);
  let cosSlope = inverseSqrt(1.0 + dyDr * dyDr);

  let dRadialSpan = max(safeThroat - r, r - safeOuter);
  let dShellY = (abs(p.y - (yFunnel - halfThick)) - halfThick) * cosSlope;
  let q = vec2<f32>(dRadialSpan, dShellY);
  let dBowl = length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);

  let dRimCollar = length(vec2<f32>(r - safeOuter, p.y + halfThick * 0.65)) - halfThick * 1.05;
  let h = clamp(0.5 + 0.5 * (dRimCollar - dBowl) / 0.12, 0.0, 1.0);
  return mix(dRimCollar, dBowl, h) - 0.12 * h * (1.0 - h);
}

fn sdMarbleMuncher(p: vec3<f32>, radius: f32, mouthAngleRad: f32, facingXZ: vec2<f32>) -> f32 {
  let f = normalize(facingXZ);
  let q = vec3<f32>(p.x * f.x + p.z * f.y, p.y, -p.x * f.y + p.z * f.x);
  let r = max(0.15, radius);
  let dBody = length(q) - r;
  let eyeP = vec3<f32>(q.x - r * 0.42, q.y - r * 0.48, abs(q.z) - r * 0.34);
  let dEyes = length(eyeP) - r * 0.18;
  let hEye = clamp(0.5 + 0.5 * (dEyes - dBody) / 0.06, 0.0, 1.0);
  var dMuncher = mix(dEyes, dBody, hEye) - 0.06 * hEye * (1.0 - hEye);

  if (mouthAngleRad > 0.015) {
    let s = sin(mouthAngleRad);
    let c = cos(mouthAngleRad);
    let dUpper = q.y * c - q.x * s;
    let dLower = -q.y * c - q.x * s;
    let dBack = -q.x - r * 0.12;
    let dSide = abs(q.z) - r * 0.82;
    let dWedge = max(max(dUpper, dLower), max(dBack, dSide));
    let hCut = clamp(0.5 - 0.5 * (dMuncher + dWedge) / 0.055, 0.0, 1.0);
    dMuncher = mix(dMuncher, -dWedge, hCut) + 0.055 * hCut * (1.0 - hCut);
  }
  return dMuncher;
}
`;

  return {
    glsl,
    wgsl,
  };
}
