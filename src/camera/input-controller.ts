/**
 * Arcade Input Controller (`src/camera/input-controller.ts`)
 *
 * Unifies:
 * - WASD / Arrow Keys digital movement with smooth analog ramp
 * - Virtual Trackball mouse-drag / pointer-drag impulse (drag anywhere on canvas to spin the marble)
 * - Right-drag or Q/E to orbit camera yaw
 * - Hotkeys:
 *   - `Space`: Jump / Hop
 *   - `R`: Respawn at checkpoint
 *   - `C`: Cycle Camera Zoom Stop (Isometric Classic / Close Action / Tactical Overview)
 *   - `M`: Cycle Marble Visual Shader Preset
 *   - `1` / `2` / `3`: Switch playable courses immediately
 */

export interface TrackballUiTelemetry {
  readonly active: boolean;
  readonly vector: readonly [number, number];
  readonly keyVector: readonly [number, number];
}

export interface ArcadeInputCallbacks {
  onSelectCourse?: (index: number) => void;
  onCycleCameraZoom?: () => void;
  onCycleMarblePreset?: () => void;
  onRespawn?: () => void;
  onOrbitCameraYaw?: (deltaDeg: number) => void;
  onToggleArchitectPanel?: () => void;
}

export interface ArcadeInputController {
  sampleInput(dt: number, projectToWorldXZ: (right: number, up: number) => readonly [number, number]): {
    moveXZ: readonly [number, number];
    jumpPressed: boolean;
    respawnPressed: boolean;
    telemetry: TrackballUiTelemetry;
  };
  triggerVirtualPulse(right: number, up: number, jump?: boolean): void;
  dispose(): void;
}

export function createArcadeInputController(
  targetElement: HTMLElement | Window,
  callbacks: ArcadeInputCallbacks = {},
): ArcadeInputController {
  const keysDown = new Set<string>();
  let jumpQueued = false;
  let respawnQueued = false;

  // Virtual trackball pointer state
  let pointerDragging = false;
  let orbitDragging = false;
  let pointerOrigin: [number, number] = [0, 0];
  let pointerCurrent: [number, number] = [0, 0];
  let smoothedRight = 0;
  let smoothedUp = 0;

  function isTypingInInput(ev: Event): boolean {
    const el = ev.target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (isTypingInInput(ev)) return;
    const code = ev.code;
    keysDown.add(code);

    if (code === 'Space') {
      ev.preventDefault();
      jumpQueued = true;
    } else if (code === 'KeyR') {
      respawnQueued = true;
      callbacks.onRespawn?.();
    } else if (code === 'KeyC') {
      callbacks.onCycleCameraZoom?.();
    } else if (code === 'KeyM') {
      callbacks.onCycleMarblePreset?.();
    } else if (code === 'KeyG') {
      callbacks.onToggleArchitectPanel?.();
    } else if (code === 'Digit1') {
      callbacks.onSelectCourse?.(0);
    } else if (code === 'Digit2') {
      callbacks.onSelectCourse?.(1);
    } else if (code === 'Digit3') {
      callbacks.onSelectCourse?.(2);
    }
  }

  function onKeyUp(ev: KeyboardEvent) {
    keysDown.delete(ev.code);
  }

  function onPointerDown(ev: PointerEvent) {
    if (isTypingInInput(ev)) return;
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('[data-hud-interactive="true"]')) {
      return;
    }
    if (ev.button === 2 || ev.shiftKey) {
      orbitDragging = true;
    } else {
      pointerDragging = true;
    }
    pointerOrigin = [ev.clientX, ev.clientY];
    pointerCurrent = [ev.clientX, ev.clientY];
  }

  function onPointerMove(ev: PointerEvent) {
    if (!pointerDragging && !orbitDragging) return;
    if (orbitDragging) {
      const dx = ev.clientX - pointerCurrent[0];
      callbacks.onOrbitCameraYaw?.(-dx * 0.35);
    }
    pointerCurrent = [ev.clientX, ev.clientY];
  }

  function onPointerUp() {
    pointerDragging = false;
    orbitDragging = false;
  }

  function onContextMenu(ev: MouseEvent) {
    const target = ev.target as HTMLElement | null;
    if (target && target.tagName?.toLowerCase() === 'canvas') {
      ev.preventDefault();
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('contextmenu', onContextMenu);

  void targetElement;

  function sampleInput(
    dt: number,
    projectToWorldXZ: (right: number, up: number) => readonly [number, number],
  ) {
    const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

    // Camera yaw orbit via Q/E
    if (keysDown.has('KeyQ')) {
      callbacks.onOrbitCameraYaw?.(-65 * safeDt);
    }
    if (keysDown.has('KeyE')) {
      callbacks.onOrbitCameraYaw?.(65 * safeDt);
    }

    let keyRight = 0;
    let keyUp = 0;
    if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) keyRight += 1;
    if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) keyRight -= 1;
    if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) keyUp += 1;
    if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) keyUp -= 1;

    const keyMag = Math.hypot(keyRight, keyUp);
    if (keyMag > 1) {
      keyRight /= keyMag;
      keyUp /= keyMag;
    }

    let trackRight = 0;
    let trackUp = 0;
    if (pointerDragging) {
      const dx = pointerCurrent[0] - pointerOrigin[0];
      const dy = -(pointerCurrent[1] - pointerOrigin[1]); // Screen Y is down, up is -dy
      const maxRadiusPx = 95;
      trackRight = Math.max(-1, Math.min(1, dx / maxRadiusPx));
      trackUp = Math.max(-1, Math.min(1, dy / maxRadiusPx));
      const mag = Math.hypot(trackRight, trackUp);
      if (mag > 1) {
        trackRight /= mag;
        trackUp /= mag;
      }
    }

    const desiredRight = Math.max(-1, Math.min(1, keyRight + trackRight));
    const desiredUp = Math.max(-1, Math.min(1, keyUp + trackUp));

    const smoothRate = 1.0 - Math.exp(-18.0 * safeDt);
    smoothedRight += (desiredRight - smoothedRight) * smoothRate;
    smoothedUp += (desiredUp - smoothedUp) * smoothRate;

    const moveXZ = projectToWorldXZ(smoothedRight, smoothedUp);
    const jumpPressed = jumpQueued;
    const respawnPressed = respawnQueued;
    jumpQueued = false;
    respawnQueued = false;

    return {
      moveXZ,
      jumpPressed,
      respawnPressed,
      telemetry: {
        active: pointerDragging || keyMag > 0.01,
        vector: [smoothedRight, smoothedUp] as const,
        keyVector: [keyRight, keyUp] as const,
      },
    };
  }

  function triggerVirtualPulse(right: number, up: number, jump = false) {
    smoothedRight = right;
    smoothedUp = up;
    if (jump) jumpQueued = true;
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('contextmenu', onContextMenu);
  }

  return {
    sampleInput,
    triggerVirtualPulse,
    dispose,
  };
}
