/**
 * Arcade Input Controller (`src/camera/input-controller.ts`)
 *
 * Unifies:
 * - WASD / Arrow Keys digital movement with smooth analog ramp
 * - Virtual Trackball mouse-drag / pointer-drag impulse (drag anywhere on canvas to spin the marble)
 * - Right-drag or `[` / `]` to orbit camera yaw
 * - Hotkeys:
 *   - `Space`: Jump / Hop
 *   - `R`: Respawn at checkpoint
 *   - `C`: Cycle Camera Zoom Stop (Isometric Classic / Close Action / Tactical Overview)
 *   - `M`: Cycle Marble Visual Shader Preset
 *   - `N`: Toggle YM2151 synth mute
 *   - `Q` / `E`: Place Blue / Orange SDF portals (short right-click also places Orange)
 *   - `F` / `V` / `B` / `X`: CSG Crater Bomb / Bridge Extruder / Pop-Ramp / Cryo Freeze
 *   - `Y`: QR Party arena
 *   - `1`–`6`: Switch the classic campaign courses immediately
 */

import type { WeaponAbilityId } from '../contracts';

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
  onToggleAudioMute?: () => void;
  onUserGesture?: () => void;
  onFirePortal?: (end: 'blue' | 'orange', pointerNdc?: readonly [number, number]) => void;
  onPointerHoverNdc?: (pointerNdc: readonly [number, number], altKey?: boolean) => void;
  onTriggerWeapon?: (ability: WeaponAbilityId) => void;
  onToggleParty?: () => void;
  onToggleViewMode?: () => void;
  onToggleDebugDrawer?: () => void;
  onToggleSdfWizard?: () => void;
  onCycleEngineMode?: () => void;
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
  let rightClickDownPos: [number, number] | null = null;
  let pointerOrigin: [number, number] = [0, 0];
  let pointerCurrent: [number, number] = [0, 0];
  let lastPointerNdc: [number, number] | undefined = undefined;
  let smoothedRight = 0;
  let smoothedUp = 0;

  function computeNdc(clientX: number, clientY: number): [number, number] {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    return [(clientX / w) * 2 - 1, 1 - (clientY / h) * 2];
  }

  function isTypingInInput(ev: Event): boolean {
    const el = ev.target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (isTypingInInput(ev)) return;
    callbacks.onUserGesture?.();
    const code = ev.code;
    const isRepeat = keysDown.has(code);
    keysDown.add(code);

    if (code === 'Space') {
      ev.preventDefault();
      jumpQueued = true;
    } else if (code === 'Tab' && !isRepeat) {
      ev.preventDefault();
      callbacks.onToggleViewMode?.();
    } else if (code === 'Backquote' && !isRepeat) {
      ev.preventDefault();
      callbacks.onToggleDebugDrawer?.();
    } else if (code === 'KeyR') {
      respawnQueued = true;
      callbacks.onRespawn?.();
    } else if (code === 'KeyC') {
      callbacks.onCycleCameraZoom?.();
    } else if (code === 'KeyM') {
      callbacks.onCycleMarblePreset?.();
    } else if (code === 'KeyG') {
      callbacks.onToggleArchitectPanel?.();
    } else if (code === 'KeyN' && !isRepeat) {
      callbacks.onToggleAudioMute?.();
    } else if (code === 'KeyQ' && !isRepeat) {
      callbacks.onFirePortal?.('blue', lastPointerNdc);
    } else if (code === 'KeyE' && !isRepeat) {
      callbacks.onFirePortal?.('orange', lastPointerNdc);
    } else if (code === 'KeyF' && !isRepeat) {
      callbacks.onTriggerWeapon?.('matterBomb');
    } else if (code === 'KeyV' && !isRepeat) {
      callbacks.onTriggerWeapon?.('bridgeExtruder');
    } else if (code === 'KeyB' && !isRepeat) {
      callbacks.onTriggerWeapon?.('popRamp');
    } else if (code === 'KeyX' && !isRepeat) {
      callbacks.onTriggerWeapon?.('cryoFreeze');
    } else if (code === 'KeyY' && !isRepeat) {
      callbacks.onToggleParty?.();
    } else if (code === 'KeyK' && !isRepeat) {
      callbacks.onCycleEngineMode?.();
    } else if ((code === 'KeyZ' || (code === 'KeyW' && ev.shiftKey)) && !isRepeat) {
      callbacks.onToggleSdfWizard?.();
    } else if (code === 'Digit1') {
      callbacks.onSelectCourse?.(0);
    } else if (code === 'Digit2') {
      callbacks.onSelectCourse?.(1);
    } else if (code === 'Digit3') {
      callbacks.onSelectCourse?.(2);
    } else if (code === 'Digit4') {
      callbacks.onSelectCourse?.(3);
    } else if (code === 'Digit5') {
      callbacks.onSelectCourse?.(4);
    } else if (code === 'Digit6') {
      callbacks.onSelectCourse?.(5);
    } else if (code === 'Digit7') {
      callbacks.onSelectCourse?.(6);
    } else if (code === 'Digit8') {
      callbacks.onSelectCourse?.(7);
    } else if (code === 'Digit9') {
      callbacks.onSelectCourse?.(8);
    } else if (code === 'Digit0') {
      callbacks.onSelectCourse?.(9);
    }
  }

  function onKeyUp(ev: KeyboardEvent) {
    keysDown.delete(ev.code);
    if (
      lastPointerNdc &&
      (ev.key === 'Alt' || ev.code === 'AltLeft' || ev.code === 'AltRight')
    ) {
      callbacks.onPointerHoverNdc?.(lastPointerNdc, false);
    }
  }

  function onPointerDown(ev: PointerEvent) {
    if (isTypingInInput(ev)) return;
    callbacks.onUserGesture?.();
    const target = ev.target as HTMLElement | null;
    if (target && target.closest('[data-hud-interactive="true"]')) {
      return;
    }
    lastPointerNdc = computeNdc(ev.clientX, ev.clientY);
    callbacks.onPointerHoverNdc?.(lastPointerNdc, ev.altKey);
    if (ev.button === 0 && ev.altKey) {
      ev.preventDefault();
      callbacks.onFirePortal?.('orange', lastPointerNdc);
      return;
    }
    if (ev.button === 2) {
      rightClickDownPos = [ev.clientX, ev.clientY];
      orbitDragging = true;
    } else if (ev.shiftKey) {
      orbitDragging = true;
    } else {
      pointerDragging = true;
    }
    pointerOrigin = [ev.clientX, ev.clientY];
    pointerCurrent = [ev.clientX, ev.clientY];
  }

  function onPointerMove(ev: PointerEvent) {
    lastPointerNdc = computeNdc(ev.clientX, ev.clientY);
    callbacks.onPointerHoverNdc?.(lastPointerNdc, ev.altKey);
    if (!pointerDragging && !orbitDragging) return;
    if (orbitDragging) {
      const dx = ev.clientX - pointerCurrent[0];
      callbacks.onOrbitCameraYaw?.(-dx * 0.35);
    }
    pointerCurrent = [ev.clientX, ev.clientY];
  }

  function onPointerUp(ev: PointerEvent) {
    if (rightClickDownPos) {
      const moved = Math.hypot(ev.clientX - rightClickDownPos[0], ev.clientY - rightClickDownPos[1]);
      if (moved < 8) {
        callbacks.onFirePortal?.('orange', computeNdc(ev.clientX, ev.clientY));
      }
      rightClickDownPos = null;
    }
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

    // Camera yaw orbit via [ / ]
    if (keysDown.has('BracketLeft')) {
      callbacks.onOrbitCameraYaw?.(-65 * safeDt);
    }
    if (keysDown.has('BracketRight')) {
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
