/**
 * Isometric-Follow Arcade Camera Rig (`src/camera/isometric-camera.ts`)
 *
 * Features:
 * - 3 Zoom Stops:
 *   0: Isometric Classic (high-angle 42° pitch, crisp 34° FOV, classic Atari perspective)
 *   1: Close Action (25° pitch, 40° FOV, close behind-the-marble chase)
 *   2: Tactical Course Overview (64° pitch, auto-framed to whole course bounds)
 * - Smooth exponential damping (`1 - exp(-k * dt)`)
 * - Velocity look-ahead along the marble's horizontal velocity vector
 * - CPU line-of-sight check driving `occlusionCutoutStrength` for the shader's capsule tunnel cutout
 */

import {
  type CameraState,
  type CameraZoomStopId,
  type CameraZoomStopProfile,
  type CourseSpec,
  type CpuWorldEvaluator,
  type MarbleState,
  type Vec3,
} from '../contracts';
import {
  vec3Add,
  vec3Cross,
  vec3Lerp,
  vec3Normalize,
  vec3Scale,
  vec3Sub,
} from '../sdf/eval-cpu';

export const CAMERA_ZOOM_STOPS: readonly CameraZoomStopProfile[] = [
  {
    id: 'isometric',
    label: 'ISOMETRIC CLASSIC',
    distance: 21.0,
    pitchDeg: 41.0,
    fovDeg: 34.0,
    lookAhead: 0.34,
    overviewBlend: 0.0,
  },
  {
    id: 'close',
    label: 'CLOSE ACTION',
    distance: 13.0,
    pitchDeg: 25.0,
    fovDeg: 40.0,
    lookAhead: 0.24,
    overviewBlend: 0.0,
  },
  {
    id: 'overview',
    label: 'TACTICAL OVERVIEW',
    distance: 42.0,
    pitchDeg: 62.0,
    fovDeg: 44.0,
    lookAhead: 0.08,
    overviewBlend: 0.92,
  },
];

export interface IsometricCameraRig {
  getState(): CameraState;
  cycleZoomStop(): CameraZoomStopProfile;
  setZoomStop(indexOrId: number | CameraZoomStopId): void;
  adjustYaw(deltaDeg: number): void;
  snapToCourse(course: CourseSpec, marblePos: Vec3): CameraState;
  update(
    dt: number,
    course: CourseSpec,
    marble: MarbleState,
    renderMarblePos: Vec3,
    evaluator: CpuWorldEvaluator,
    simTime: number,
  ): CameraState;
  /** Project screen-space 2D input `(right, up)` onto the camera's ground XZ plane */
  projectInputToWorldXZ(inputRight: number, inputUp: number): readonly [number, number];
}

export function createIsometricCameraRig(
  initialCourse: CourseSpec,
  initialMarblePos: Vec3 = initialCourse.startPos,
): IsometricCameraRig {
  let zoomStopIndex = 0;
  let yawDeg = 32.0; // Classic isometric diagonal view angle
  let currentPitchDeg = CAMERA_ZOOM_STOPS[0].pitchDeg;
  let currentDistance = CAMERA_ZOOM_STOPS[0].distance;
  let currentFovDeg = CAMERA_ZOOM_STOPS[0].fovDeg;
  let smoothedTarget: Vec3 = [...initialMarblePos];
  let smoothedLookAhead: Vec3 = [0, 0, 0];
  let occlusionStrength = 0;
  let occlusionEnabled = true;

  function computeCameraVectors(
    target: Vec3,
    yaw: number,
    pitch: number,
    dist: number,
    fov: number,
    stopIdx: number,
    occStrength: number,
  ): CameraState {
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const cosPitch = Math.cos(pitchRad);

    // Offset from target to camera position
    const offset: Vec3 = [
      Math.sin(yawRad) * cosPitch * dist,
      Math.sin(pitchRad) * dist,
      Math.cos(yawRad) * cosPitch * dist,
    ];

    const position = vec3Add(target, offset);
    const forward = vec3Normalize(vec3Sub(target, position));
    const worldUp: Vec3 = [0, 1, 0];
    const right = vec3Normalize(vec3Cross(forward, worldUp));
    const up = vec3Normalize(vec3Cross(right, forward));
    const stop = CAMERA_ZOOM_STOPS[stopIdx] ?? CAMERA_ZOOM_STOPS[0];

    return {
      position,
      target,
      forward,
      right,
      up,
      fovDeg: fov,
      yawDeg: yaw,
      pitchDeg: pitch,
      distance: dist,
      zoomStopIndex: stopIdx,
      zoomStopId: stop.id,
      zoomStopLabel: stop.label,
      occlusionCutoutStrength: occStrength,
    };
  }

  let state = computeCameraVectors(
    smoothedTarget,
    yawDeg,
    currentPitchDeg,
    currentDistance,
    currentFovDeg,
    zoomStopIndex,
    0,
  );

  function snapToCourse(course: CourseSpec, marblePos: Vec3): CameraState {
    const stop = CAMERA_ZOOM_STOPS[zoomStopIndex];
    smoothedLookAhead = [0, 0, 0];
    smoothedTarget = vec3Lerp(marblePos, course.overviewCenter, stop.overviewBlend);
    currentPitchDeg = stop.pitchDeg;
    currentDistance =
      stop.id === 'overview' ? Math.max(stop.distance, course.overviewRadius * 1.45) : stop.distance;
    currentFovDeg = stop.fovDeg;
    occlusionStrength = 0;
    state = computeCameraVectors(
      smoothedTarget,
      yawDeg,
      currentPitchDeg,
      currentDistance,
      currentFovDeg,
      zoomStopIndex,
      occlusionStrength,
    );
    return state;
  }

  function cycleZoomStop(): CameraZoomStopProfile {
    zoomStopIndex = (zoomStopIndex + 1) % CAMERA_ZOOM_STOPS.length;
    return CAMERA_ZOOM_STOPS[zoomStopIndex];
  }

  function setZoomStop(indexOrId: number | CameraZoomStopId) {
    if (typeof indexOrId === 'number') {
      zoomStopIndex =
        ((indexOrId % CAMERA_ZOOM_STOPS.length) + CAMERA_ZOOM_STOPS.length) %
        CAMERA_ZOOM_STOPS.length;
    } else {
      const idx = CAMERA_ZOOM_STOPS.findIndex((s) => s.id === indexOrId);
      if (idx >= 0) zoomStopIndex = idx;
    }
  }

  function adjustYaw(deltaDeg: number) {
    yawDeg = (yawDeg + deltaDeg) % 360;
  }

  function update(
    dt: number,
    course: CourseSpec,
    marble: MarbleState,
    renderMarblePos: Vec3,
    evaluator: CpuWorldEvaluator,
    simTime: number,
  ): CameraState {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);
    const stop = CAMERA_ZOOM_STOPS[zoomStopIndex] ?? CAMERA_ZOOM_STOPS[0];

    const blendRate = 1.0 - Math.exp(-8.5 * safeDt);
    const lookAheadRate = 1.0 - Math.exp(-5.5 * safeDt);

    const desiredLookAhead: Vec3 = [
      marble.velocity[0] * stop.lookAhead,
      Math.max(-1.2, Math.min(0.8, marble.velocity[1] * stop.lookAhead * 0.3)),
      marble.velocity[2] * stop.lookAhead,
    ];
    smoothedLookAhead = vec3Lerp(smoothedLookAhead, desiredLookAhead, lookAheadRate);

    const followPoint = vec3Add(renderMarblePos, smoothedLookAhead);
    const desiredTarget = vec3Lerp(followPoint, course.overviewCenter, stop.overviewBlend);

    // Smoothly align camera follow target across a non-Euclidean portal warp
    const jumpDist = Math.hypot(
      desiredTarget[0] - smoothedTarget[0],
      desiredTarget[1] - smoothedTarget[1],
      desiredTarget[2] - smoothedTarget[2],
    );
    const warpBoost = (marble.portalCooldown ?? 0) > 0.12 || jumpDist > 8.5 ? 24.0 : 8.5;
    const targetBlendRate = 1.0 - Math.exp(-warpBoost * safeDt);
    smoothedTarget = vec3Lerp(smoothedTarget, desiredTarget, targetBlendRate);

    const targetDist =
      stop.id === 'overview'
        ? Math.max(stop.distance, course.overviewRadius * 1.45)
        : stop.distance;

    currentDistance += (targetDist - currentDistance) * blendRate;
    currentPitchDeg += (stop.pitchDeg - currentPitchDeg) * blendRate;
    currentFovDeg += (stop.fovDeg - currentFovDeg) * blendRate;

    const candidateState = computeCameraVectors(
      smoothedTarget,
      yawDeg,
      currentPitchDeg,
      currentDistance,
      currentFovDeg,
      zoomStopIndex,
      occlusionStrength,
    );

    const isBlocked =
      occlusionEnabled &&
      evaluator.isOccluded(candidateState.position, renderMarblePos, marble.radius, simTime);
    const targetOcc = isBlocked ? 1.0 : 0.0;
    const occRate = 1.0 - Math.exp(-11.0 * safeDt);
    occlusionStrength += (targetOcc - occlusionStrength) * occRate;

    state = {
      ...candidateState,
      occlusionCutoutStrength: occlusionStrength,
    };
    return state;
  }

  function projectInputToWorldXZ(
    inputRight: number,
    inputUp: number,
  ): readonly [number, number] {
    // Ground-projected forward and right vectors from camera yaw
    const yawRad = (yawDeg * Math.PI) / 180;
    // Camera looks from (+sin(yaw), +cos(yaw)) toward origin, so ground forward is (-sin(yaw), -cos(yaw))
    const fwdX = -Math.sin(yawRad);
    const fwdZ = -Math.cos(yawRad);
    const rightX = Math.cos(yawRad);
    const rightZ = -Math.sin(yawRad);

    let worldX = rightX * inputRight + fwdX * inputUp;
    let worldZ = rightZ * inputRight + fwdZ * inputUp;
    const mag = Math.hypot(worldX, worldZ);
    if (mag > 1.0) {
      worldX /= mag;
      worldZ /= mag;
    }
    return [worldX, worldZ];
  }

  return {
    getState: () => state,
    cycleZoomStop,
    setZoomStop,
    adjustYaw,
    snapToCourse,
    update,
    projectInputToWorldXZ,
  };
}
