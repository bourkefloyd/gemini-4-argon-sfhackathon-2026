/**
 * 120 Hz Fixed-Timestep Arcade Marble Physics (`src/physics/marble-physics.ts`)
 *
 * Features:
 * - 120 Hz fixed accumulator with render pose interpolation (`lerp` position, `slerp` quaternion)
 * - 12-step `sphereCast` Continuous Collision Detection (CCD)
 * - 5-iteration SDF depenetration with seam-biased normals
 * - Per-material friction, restitution, slope boost, bounce pads, bumpers, conveyors, and acid hazard
 * - Kinematic hazard velocity impulse transfer (moving pistons, bridges, patrolling Steelies)
 * - Jump/hop with coyote time & input buffering
 * - High-fall shatter & out-of-bounds respawn
 */

import {
  type CourseSpec,
  type CpuWorldEvaluator,
  DEFAULT_PHYSICS_CONFIG,
  type InputCommand,
  MATERIAL_PROPERTIES,
  type MarbleContactState,
  type MarbleLifecycleStatus,
  type MarbleState,
  type PhysicsConfig,
  type Quat,
  type Vec3,
} from '../contracts';
import {
  quatMultiply,
  quatNormalize,
  quatSlerp,
  vec3Add,
  vec3Dot,
  vec3Length,
  vec3Lerp,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';
import { stepPortalCrossing } from '../portals';

export function createInitialMarbleState(
  course: CourseSpec,
  presetIndex = 0,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): MarbleState {
  const initialContact: MarbleContactState = {
    grounded: true,
    normal: [0, 1, 0],
    distance: config.marbleRadius,
    contactPoint: [
      course.startPos[0],
      course.startPos[1] - config.marbleRadius,
      course.startPos[2],
    ],
    surfaceVelocity: [0, 0, 0],
    impactSpeed: 0,
    wallContact: false,
  };

  return {
    position: [...course.startPos],
    prevPosition: [...course.startPos],
    velocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    prevOrientation: [0, 0, 0, 1],
    radius: config.marbleRadius,
    contact: initialContact,
    surfaceMaterial: 'start',
    status: 'racing',
    statusTimer: 0,
    airTime: 0,
    peakFallSpeed: 0,
    coyoteTimer: config.coyoteTime,
    jumpBufferTimer: 0,
    jumpCooldown: 0,
    portalCooldown: 0,
    portalCrossings: 0,
    lastPortalExitSpeed: 0,
    respawnPos: [...course.startPos],
    marblePresetIndex: presetIndex,
  };
}

export interface MarbleSimulation {
  getState(): MarbleState;
  setState(next: MarbleState): void;
  setCourse(course: CourseSpec, evaluator: CpuWorldEvaluator): void;
  respawn(atCheckpoint?: boolean): void;
  cycleMarblePreset(): void;
  update(frameDt: number, input: InputCommand, simTime: number): {
    state: MarbleState;
    renderPosition: Vec3;
    renderOrientation: Quat;
    alpha: number;
    subStepsRun: number;
  };
  stepFixed(dt: number, input: InputCommand, simTime: number): MarbleState;
}

export function createMarbleSimulation(
  initialCourse: CourseSpec,
  initialEvaluator: CpuWorldEvaluator,
  config: PhysicsConfig = DEFAULT_PHYSICS_CONFIG,
): MarbleSimulation {
  let course = initialCourse;
  let evaluator = initialEvaluator;
  let state = createInitialMarbleState(initialCourse, 0, config);
  let accumulator = 0;

  function respawn(atCheckpoint = true) {
    const spawnTarget = atCheckpoint ? state.respawnPos : course.startPos;
    state = {
      ...createInitialMarbleState(course, state.marblePresetIndex, config),
      position: [...spawnTarget],
      prevPosition: [...spawnTarget],
      respawnPos: [...spawnTarget],
    };
    accumulator = 0;
  }

  function setCourse(nextCourse: CourseSpec, nextEvaluator: CpuWorldEvaluator) {
    course = nextCourse;
    evaluator = nextEvaluator;
    state = createInitialMarbleState(nextCourse, state.marblePresetIndex, config);
    accumulator = 0;
  }

  function cycleMarblePreset() {
    state = {
      ...state,
      marblePresetIndex: (state.marblePresetIndex + 1) % 4,
    };
  }

  function stepFixed(dt: number, input: InputCommand, simTime: number): MarbleState {
    if (input.respawnPressed) {
      respawn(true);
      return state;
    }

    const prevPosition = state.position;
    const prevOrientation = state.orientation;

    // Handle non-racing terminal/penalty states
    if (state.status !== 'racing') {
      const nextTimer = state.statusTimer + dt;
      if (state.status === 'goal') {
        // Gently pull marble toward center of the goal pad
        const toGoal: Vec3 = [
          course.goalPos[0] - state.position[0],
          0,
          course.goalPos[2] - state.position[2],
        ];
        const nextVel: Vec3 = [
          (state.velocity[0] + toGoal[0] * 12 * dt) * 0.9,
          0,
          (state.velocity[2] + toGoal[2] * 12 * dt) * 0.9,
        ];
        const nextPos = vec3Add(state.position, vec3Scale(nextVel, dt));
        state = {
          ...state,
          prevPosition,
          prevOrientation,
          position: nextPos,
          velocity: nextVel,
          statusTimer: nextTimer,
        };
        return state;
      }

      if (nextTimer >= config.respawnDelaySec) {
        respawn(true);
        return state;
      }

      state = {
        ...state,
        prevPosition,
        prevOrientation,
        statusTimer: nextTimer,
      };
      return state;
    }

    // Check intermediate checkpoints
    let respawnPos = state.respawnPos;
    if (course.checkpoints) {
      for (const cp of course.checkpoints) {
        const dCp = vec3Length(vec3Sub(state.position, cp.position));
        if (dCp <= cp.radius) {
          respawnPos = cp.position;
        }
      }
    }

    // Check Goal Pad capture
    const dxGoal = state.position[0] - course.goalPos[0];
    const dyGoal = Math.abs(state.position[1] - (course.goalPos[1] + state.radius));
    const dzGoal = state.position[2] - course.goalPos[2];
    if (Math.hypot(dxGoal, dzGoal) <= course.goalRadius && dyGoal <= 1.45) {
      state = {
        ...state,
        prevPosition,
        prevOrientation,
        status: 'goal',
        statusTimer: 0,
        surfaceMaterial: 'goal',
        respawnPos,
      };
      return state;
    }

    // Check out-of-bounds kill plane
    if (state.position[1] < course.killPlaneY) {
      state = {
        ...state,
        prevPosition,
        prevOrientation,
        status: 'fell',
        statusTimer: 0,
        respawnPos,
      };
      return state;
    }

    // Update jump & coyote timers
    let coyoteTimer = Math.max(0, state.coyoteTimer - dt);
    let jumpBufferTimer = input.jumpPressed
      ? config.jumpBufferTime
      : Math.max(0, state.jumpBufferTimer - dt);
    let jumpCooldown = Math.max(0, state.jumpCooldown - dt);

    let [vx, vy, vz] = state.velocity;
    const matProps = MATERIAL_PROPERTIES[state.surfaceMaterial] ?? MATERIAL_PROPERTIES.standard;

    // 1. Gravity
    vy -= config.gravity * dt;

    // 2. Grounded vs. Airborne forces (with Snappy Launch, Backspin Brake, Lateral Carve & Slippery Ice Drift)
    const [inX, inZ] = input.moveXZ;
    const inMag = Math.hypot(inX, inZ);
    const isIce = state.surfaceMaterial === 'ice';
    if (state.contact.grounded) {
      const surfVx = state.contact.surfaceVelocity[0];
      const surfVz = state.contact.surfaceVelocity[2];
      const relVx = vx - surfVx;
      const relVz = vz - surfVz;
      const relSpeed = Math.hypot(relVx, relVz);

      let accelX = inX * config.rollAcceleration;
      let accelZ = inZ * config.rollAcceleration;

      if (inMag > 0.01) {
        // Snappy first-push trackball launch impulse when starting from rest or low speed
        const launchBoost = 1.0 + 0.65 * (1.0 - Math.min(1.0, relSpeed / 5.5));
        accelX *= launchBoost;
        accelZ *= launchBoost;

        if (relSpeed > 0.35) {
          const velDirX = relVx / relSpeed;
          const velDirZ = relVz / relSpeed;
          const inDirX = inX / inMag;
          const inDirZ = inZ / inMag;
          const alignment = velDirX * inDirX + velDirZ * inDirZ;

          // Grip factor scales with surface friction; on ice, scale steering/carving assist
          // and backspin braking grip by 0.18 so the marble drifts wide on turns and skids when braking
          const gripFactor = isIce
            ? 0.18
            : Math.min(1.6, Math.max(0.18, matProps.friction / 1.85));

          if (alignment < -0.1) {
            // HARD BACKSPIN BRAKE: reverse counter-spin catches the marble at ledge lips (skids on ice with 0.18 grip)
            const brakeMult =
              isIce && relSpeed < 12.5
                ? 0.18 + (1.0 - (-alignment)) * 0.65
                : 1.0 + (-alignment) * 1.45 * gripFactor;
            accelX *= brakeMult;
            accelZ *= brakeMult;
          } else {
            // LATERAL CARVE ASSIST: perpendicular steering tightens cornering lines (0.18 on ice -> wide drift)
            const lateralFraction = Math.sqrt(Math.max(0, 1.0 - alignment * alignment));
            const lateralComponent = -velDirZ * inDirX + velDirX * inDirZ;
            const carveBoost =
              lateralFraction * 0.45 * gripFactor * config.rollAcceleration * inMag;
            accelX += -velDirZ * Math.sign(lateralComponent) * carveBoost;
            accelZ += velDirX * Math.sign(lateralComponent) * carveBoost;
            if (isIce && lateralFraction > 0.2 && relSpeed < 12.5) {
              // Scale perpendicular steering acceleration on ice by 0.18 so the marble genuinely drifts wide on turns
              const longComp = accelX * velDirX + accelZ * velDirZ;
              const latX = accelX - longComp * velDirX;
              const latZ = accelZ - longComp * velDirZ;
              const iceLatScale = 0.18 + 0.42 * Math.max(0, alignment);
              accelX = longComp * velDirX + latX * iceLatScale;
              accelZ = longComp * velDirZ + latZ * iceLatScale;
            }
          }
        }
      }

      vx += accelX * dt;
      vz += accelZ * dt;

      // Downhill slope boost (boosted by 1.4x+ on ice)
      const nx = state.contact.normal[0];
      const nz = state.contact.normal[2];
      const slopeMag = Math.hypot(nx, nz);
      if (slopeMag > 0.02) {
        const slopeMult = isIce
          ? Math.max(1.4, matProps.slopeMultiplier)
          : matProps.slopeMultiplier;
        const boost = config.slopeBoost * slopeMult;
        vx += nx * boost * dt;
        vz += nz * boost * dt;
      }

      // Conveyor & kinematic surface velocity coupling (low friction 0.08 / rollingDrag 0.015 on ice)
      const updatedRelVx = vx - surfVx;
      const updatedRelVz = vz - surfVz;
      const effectiveDrag =
        isIce && inMag < 0.05
          ? (matProps.rollingDrag ?? matProps.friction)
          : matProps.friction;
      const damp = 1.0 / (1.0 + effectiveDrag * dt);
      vx = surfVx + updatedRelVx * damp;
      vz = surfVz + updatedRelVz * damp;

      // Sleep tiny creep when no input and flat ground (disabled on ice so marble coasts effortlessly)
      if (
        !isIce &&
        inMag < 0.01 &&
        slopeMag < 0.025 &&
        Math.hypot(vx - surfVx, vz - surfVz) < 0.12
      ) {
        vx = surfVx;
        vz = surfVz;
      }
    } else {
      vx += inX * config.rollAcceleration * config.airControl * dt;
      vz += inZ * config.rollAcceleration * config.airControl * dt;
    }

    // 3. Consume buffered jump if within coyote time (with wave-crest vertical launch lift)
    let grounded = state.contact.grounded;
    if (jumpBufferTimer > 0 && coyoteTimer > 0 && jumpCooldown <= 0) {
      vy = Math.max(vy, config.jumpImpulse) + Math.max(0, state.contact.surfaceVelocity[1] * 0.85);
      grounded = false;
      coyoteTimer = 0;
      jumpBufferTimer = 0;
      jumpCooldown = 0.26;
    }

    // 4. Clamp horizontal speed (boosted by speedMultiplier on ice)
    const horizSpeed = Math.hypot(vx, vz);
    const maxSpeed = config.maxHorizontalSpeed * (matProps.speedMultiplier ?? 1.0);
    if (horizSpeed > maxSpeed) {
      const scale = maxSpeed / horizSpeed;
      vx *= scale;
      vz *= scale;
    }

    let nextVel: Vec3 = [vx, vy, vz];
    const displacement = vec3Scale(nextVel, dt);
    let nextPos: Vec3 = state.position;

    // 5. Continuous Collision Detection (12-step sphereCast) when moving rapidly
    const stepMoveLen = vec3Length(displacement);
    if (!grounded && stepMoveLen > state.radius * 0.45) {
      const cast = evaluator.sphereCast(state.position, state.radius, displacement, simTime, 12);
      if (cast.hit) {
        nextPos = vec3Add(state.position, vec3Scale(displacement, cast.toi * 0.96));
      } else {
        nextPos = vec3Add(state.position, displacement);
      }
    } else {
      nextPos = vec3Add(state.position, displacement);
    }

    // 5.5 Non-Euclidean SDF Portal Crossing Check ("Speedy marble goes in, speedy marble comes out")
    const activePortals = evaluator.getPortals?.() ?? course.portals ?? [];
    let portalCooldown = Math.max(0, (state.portalCooldown ?? 0) - dt);
    if (activePortals.length > 0) {
      const portalCandidate: MarbleState = {
        ...state,
        position: nextPos,
        velocity: nextVel,
      };
      const portalResult = stepPortalCrossing(
        prevPosition,
        portalCandidate,
        activePortals,
        dt,
      );
      if (portalResult.crossed) {
        state = {
          ...portalResult.state,
          coyoteTimer: 0,
          jumpBufferTimer,
          jumpCooldown,
          respawnPos,
        };
        return state;
      }
      nextVel = portalResult.state.velocity;
      portalCooldown = portalResult.state.portalCooldown ?? 0;
    }

    // 6. 5-Iteration SDF Collision & Depenetration Solver
    let contactGrounded = false;
    let wallContact = false;
    let contactNormal: Vec3 = [0, 1, 0];
    let contactDist = state.radius;
    let contactPoint: Vec3 = [nextPos[0], nextPos[1] - state.radius, nextPos[2]];
    let surfaceVelocity: Vec3 = [0, 0, 0];
    let surfaceMaterial = state.surfaceMaterial;
    let maxImpactSpeed = 0;
    let nextStatus: MarbleLifecycleStatus = state.status;

    const skin = 0.0015;
    const snapMargin =
      state.contact.grounded && jumpCooldown <= 0 && nextVel[1] <= 2.0 ? 0.075 : 0.0;
    for (let iter = 0; iter < 5; iter++) {
      const q = evaluator.queryContact(nextPos, state.radius, simTime);
      contactDist = q.distance;
      const effectiveRadius =
        iter === 0 && q.normal[1] > config.groundNormalThreshold
          ? state.radius + snapMargin
          : state.radius;
      if (q.distance >= effectiveRadius) {
        break;
      }

      const penetration = state.radius - q.distance + skin;
      nextPos = vec3Add(nextPos, vec3Scale(q.normal, penetration));

      contactNormal = q.normal;
      contactPoint = q.contactPoint;
      surfaceVelocity = q.surfaceVelocity;
      surfaceMaterial = q.material;

      const props = MATERIAL_PROPERTIES[q.material] ?? MATERIAL_PROPERTIES.standard;

      // Check lethal acid pool
      if (props.lethal === 'acid') {
        nextStatus = 'sunk';
        break;
      }

      // Check goal surface contact
      if (props.isGoal) {
        nextStatus = 'goal';
      }

      // Relative velocity against moving kinematic hazard / conveyor
      const relVel = vec3Sub(nextVel, q.surfaceVelocity);
      const vn = vec3Dot(relVel, q.normal);

      if (vn < 0) {
        const impact = -vn;
        if (impact > maxImpactSpeed) {
          maxImpactSpeed = impact;
        }

        // High-fall shatter check on hard surfaces
        if (
          impact >= config.shatterImpactSpeed &&
          q.material !== 'bounce' &&
          q.normal[1] > 0.5
        ) {
          nextStatus = 'shattered';
          break;
        }

        const effectiveRestitution =
          impact < 2.2 && q.material !== 'bounce' && q.material !== 'bumper'
            ? 0.0
            : props.restitution;

        const impulseMag = -(1.0 + effectiveRestitution) * vn;
        nextVel = vec3Add(nextVel, vec3Scale(q.normal, impulseMag));

        // Extra radial kick from arcade bumpers or slamming pistons
        if (props.bumperImpulse > 0) {
          const kickDir = vec3Normalize([q.normal[0], Math.max(0.18, q.normal[1]), q.normal[2]]);
          nextVel = vec3Add(nextVel, vec3Scale(kickDir, props.bumperImpulse));
        }

        // Wall slide friction
        if (q.normal[1] <= config.groundNormalThreshold) {
          wallContact = true;
          nextVel = [nextVel[0] * 0.94, nextVel[1], nextVel[2] * 0.94];
        }
      }

      if (q.normal[1] > config.groundNormalThreshold) {
        contactGrounded = true;
      }
    }

    // Grounded normal-velocity stabilization & slope-hugging adhesion
    if (
      contactGrounded &&
      nextStatus === 'racing' &&
      surfaceMaterial !== 'bounce' &&
      surfaceMaterial !== 'bumper'
    ) {
      const relV = vec3Sub(nextVel, surfaceVelocity);
      const vnAfter = vec3Dot(relV, contactNormal);
      if (vnAfter < 0.8) {
        // Project velocity onto the tangent plane of the slope + slight downward normal stickiness
        nextVel = vec3Sub(nextVel, vec3Scale(contactNormal, vnAfter + 0.35));
      }
    }

    // 7. Rolling angular velocity & quaternion integration
    const rollVx = nextVel[0] - (contactGrounded ? surfaceVelocity[0] : 0);
    const rollVz = nextVel[2] - (contactGrounded ? surfaceVelocity[2] : 0);
    const angularVelocity: Vec3 = [
      rollVz / state.radius,
      0,
      -rollVx / state.radius,
    ];
    const angSpeed = vec3Length(angularVelocity);
    let nextOrientation = state.orientation;
    if (angSpeed > 1e-4) {
      const axis = vec3Scale(angularVelocity, 1 / angSpeed);
      const halfAngle = 0.5 * angSpeed * dt;
      const sinHalf = Math.sin(halfAngle);
      const dq: Quat = [
        axis[0] * sinHalf,
        axis[1] * sinHalf,
        axis[2] * sinHalf,
        Math.cos(halfAngle),
      ];
      nextOrientation = quatNormalize(quatMultiply(dq, state.orientation));
    }

    const nextAirTime = contactGrounded ? 0 : state.airTime + dt;
    const nextPeakFallSpeed = contactGrounded
      ? 0
      : Math.max(state.peakFallSpeed, Math.max(0, -nextVel[1]));

    if (contactGrounded) {
      coyoteTimer = config.coyoteTime;
    }

    state = {
      position: nextPos,
      prevPosition,
      velocity: nextVel,
      angularVelocity,
      orientation: nextOrientation,
      prevOrientation,
      radius: state.radius,
      contact: {
        grounded: contactGrounded,
        normal: contactNormal,
        distance: contactDist,
        contactPoint,
        surfaceVelocity,
        impactSpeed: maxImpactSpeed,
        wallContact,
      },
      surfaceMaterial,
      status: nextStatus,
      statusTimer: nextStatus === 'racing' ? 0 : state.statusTimer,
      airTime: nextAirTime,
      peakFallSpeed: nextPeakFallSpeed,
      coyoteTimer,
      jumpBufferTimer,
      jumpCooldown,
      portalCooldown,
      portalCrossings: state.portalCrossings ?? 0,
      lastPortalExitSpeed: state.lastPortalExitSpeed ?? 0,
      respawnPos,
      marblePresetIndex: state.marblePresetIndex,
    };

    return state;
  }

  function update(frameDt: number, input: InputCommand, simTime: number) {
    const clampedDt = Math.min(Math.max(frameDt, 0), 0.08);
    accumulator += clampedDt;

    let subStepsRun = 0;
    let stepInput = input;

    while (accumulator >= config.fixedDt && subStepsRun < config.maxSubSteps) {
      stepFixed(config.fixedDt, stepInput, simTime - accumulator + config.fixedDt);
      accumulator -= config.fixedDt;
      subStepsRun++;
      // Consume one-shot button edges after the first substep
      stepInput = {
        ...stepInput,
        jumpPressed: false,
        respawnPressed: false,
      };
    }

    if (accumulator > config.fixedDt * 2) {
      accumulator = 0;
    }

    const alpha = Math.min(1, Math.max(0, accumulator / config.fixedDt));
    const renderPosition = vec3Lerp(state.prevPosition, state.position, alpha);
    const renderOrientation = quatSlerp(state.prevOrientation, state.orientation, alpha);

    return {
      state,
      renderPosition,
      renderOrientation,
      alpha,
      subStepsRun,
    };
  }

  return {
    getState: () => state,
    setState: (next: MarbleState) => {
      state = next;
    },
    setCourse,
    respawn,
    cycleMarblePreset,
    update,
    stepFixed,
  };
}
