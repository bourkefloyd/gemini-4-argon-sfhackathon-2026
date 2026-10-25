/**
 * Retro-Futuristic Marble Madness Arcade HUD (`src/ui/ArcadeHud.tsx`)
 *
 * Clean Fullscreen Default UI + Collapsible Debug Drawer + Multi-Player Perspective Grid Overlay:
 * - Default Fullscreen Mode (`1×1`):
 *   1. Sleek, compact Top Arcade Bar: Course Name (`COURSE 01: MARBLE RAMP GAUNTLET`),
 *      large glowing Countdown Timer (`58.4s`), Score (`001420`), and active Portal / Powerup pill
 *      (`[Q] Smart Portal · [F] Crater · [V] Bridge`).
 *   2. Minimal Top-Right Pill Strip with 4 action buttons:
 *      - `[Tab / V] View: Fullscreen 1×1 ↔ Player Grid (2×2)`
 *      - `[Y] QR Party (Room ARGON-1)`
 *      - `[G] Argon 1M`
 *      - `[` / D] Debug & Controls` (opens collapsible Debug/Telemetry drawer)
 * - Player Perspective Grid Mode (`2×2 / Multi-POV`):
 *   - Overlays a minimal HUD badge on each grid cell (`P1: YOU (14.2 u/s)`, `P2: @MAYA / AI BOT (16.8 u/s)`,
 *     `P3: @DAN / GHOST`, `P4: @ALEX`, plus room badge `ROOM ARGON-1`).
 *   - Clicking any grid cell (or pressing `1`–`4` in grid mode) maximizes that player to Fullscreen.
 */

import React from 'react';
import {
  type CameraState,
  type CourseSpec,
  type FieldMutation,
  MARBLE_VISUAL_PRESETS,
  MAX_FIELD_MUTATIONS,
  type MarbleState,
  type PortalPair,
  type WeaponAbilityId,
} from '../contracts';
import type { TrackballUiTelemetry } from '../camera';
import type { TactileFeelState } from '../feel';
import type { SplitDeltaSnapshot } from '../replay';
import type { Ym2151SynthState } from '../audio';
import type { BotPlayStyle } from '../bot';
import {
  type EngineComparisonMode,
  getEngineModeSpec,
} from '../physics/basic-polygon-mode';

export type ViewportDisplayMode = 'fullscreen' | 'grid';

export interface PlayerGridCellHudInfo {
  readonly slotIndex: number;
  readonly badgeTitle: string;
  readonly subtitle: string;
  readonly speedUps: number;
  readonly roomCode: string;
  readonly accentColor: string;
  readonly status: MarbleState['status'];
}

export interface ArcadeHudProps {
  readonly courses: readonly CourseSpec[];
  readonly activeCourseIndex: number;
  readonly currentCourse: CourseSpec;
  readonly marble: MarbleState;
  readonly camera: CameraState;
  readonly timeRemainingSec: number;
  readonly score: number;
  readonly bonusBannerSec: number | null;
  readonly fps: number;
  readonly trackball: TrackballUiTelemetry;
  readonly feel?: TactileFeelState;
  readonly ghostSplit?: SplitDeltaSnapshot;
  readonly synthTelemetry?: Ym2151SynthState;
  readonly botEnabled?: boolean;
  readonly botStyle?: BotPlayStyle;
  readonly architectOpen: boolean;
  readonly partyOpen?: boolean;
  readonly partyRoomCode?: string;
  readonly viewMode?: ViewportDisplayMode;
  readonly focusedPlayerIndex?: number;
  readonly debugDrawerOpen?: boolean;
  readonly engineMode?: EngineComparisonMode;
  readonly gridCells?: readonly PlayerGridCellHudInfo[];
  readonly portals?: readonly PortalPair[];
  readonly fieldMutations?: readonly FieldMutation[];
  readonly bridgeExtruderRemainingSec?: number;
  readonly lastActivatedAbility?: WeaponAbilityId | null;
  readonly onSelectCourse: (index: number) => void;
  readonly onCycleCameraZoom: () => void;
  readonly onCycleMarblePreset: () => void;
  readonly onRespawn: () => void;
  readonly onNextCourseWithBonus: () => void;
  readonly onToggleArchitect: () => void;
  readonly onToggleAudioMute?: () => void;
  readonly onToggleBotPlaytest?: () => void;
  readonly onFirePortal?: (end: 'blue' | 'orange') => void;
  readonly onTriggerWeapon?: (ability: WeaponAbilityId) => void;
  readonly onToggleParty?: () => void;
  readonly onToggleViewMode?: () => void;
  readonly onToggleDebugDrawer?: () => void;
  readonly onCycleEngineMode?: () => void;
  readonly onSelectGridPlayer?: (slotIndex: number) => void;
}

export const ArcadeHud: React.FC<ArcadeHudProps> = ({
  courses,
  activeCourseIndex,
  currentCourse,
  marble,
  camera,
  timeRemainingSec,
  score,
  bonusBannerSec,
  fps,
  trackball,
  feel,
  ghostSplit,
  synthTelemetry,
  botEnabled,
  botStyle,
  architectOpen,
  partyOpen = false,
  partyRoomCode = 'ARGON-1',
  viewMode = 'fullscreen',
  focusedPlayerIndex = 0,
  debugDrawerOpen = false,
  engineMode = 0,
  gridCells = [],
  portals = [],
  fieldMutations = [],
  bridgeExtruderRemainingSec = 0,
  lastActivatedAbility = null,
  onSelectCourse,
  onCycleCameraZoom,
  onCycleMarblePreset,
  onRespawn,
  onNextCourseWithBonus,
  onToggleArchitect,
  onToggleAudioMute,
  onToggleBotPlaytest,
  onFirePortal,
  onTriggerWeapon,
  onToggleParty,
  onToggleViewMode,
  onToggleDebugDrawer,
  onCycleEngineMode,
  onSelectGridPlayer,
}) => {
  const horizSpeed = Math.hypot(marble.velocity[0], marble.velocity[2]);
  const totalSpeed = Math.hypot(marble.velocity[0], marble.velocity[1], marble.velocity[2]);
  const speedPct = Math.min(100, (horizSpeed / 19.5) * 100);

  const ny = Math.min(1, Math.max(-1, marble.contact.normal[1]));
  const slopeDeg = marble.contact.grounded
    ? Math.round((Math.acos(ny) * 180) / Math.PI)
    : 0;

  const distToGoal = Math.hypot(
    marble.position[0] - currentCourse.goalPos[0],
    marble.position[2] - currentCourse.goalPos[2],
  );

  const preset =
    MARBLE_VISUAL_PRESETS[marble.marblePresetIndex % MARBLE_VISUAL_PRESETS.length] ??
    MARBLE_VISUAL_PRESETS[0];

  const isLowTime = timeRemainingSec <= 12 && marble.status === 'racing';
  const focusedCell = gridCells[focusedPlayerIndex];
  const engineSpec = getEngineModeSpec(engineMode);

  return (
    <div className="arcade-hud-overlay">
      {/* SLEEK COMPACT TOP ARCADE BAR + TOP-RIGHT 4-PILL STRIP */}
      <header className="hud-clean-top-strip">
        <div className="hud-compact-arcade-bar" data-hud-interactive="true">
          <div className="hud-compact-course-block">
            <span className="hud-course-index">
              COURSE 0{currentCourse.index}:
            </span>
            <span className="hud-course-name">
              {currentCourse.name.toUpperCase()}
            </span>
            {focusedPlayerIndex > 0 && focusedCell && viewMode === 'fullscreen' && (
              <button
                type="button"
                className="hud-focused-pov-pill"
                onClick={() => onSelectGridPlayer?.(0)}
                title="Click to return to P1: YOU"
              >
                POV: {focusedCell.badgeTitle} [1]
              </button>
            )}
          </div>

          <div
            className={`hud-compact-timer ${isLowTime ? 'hud-timer-critical' : ''}`}
            data-testid="hud-countdown-timer"
          >
            <span className="hud-compact-timer-digits">
              {Math.max(0, timeRemainingSec).toFixed(1)}s
            </span>
          </div>

          <div className="hud-compact-score">
            <span className="hud-compact-score-label">SCORE</span>
            <strong className="hud-compact-score-digits">
              {score.toString().padStart(6, '0')}
            </strong>
          </div>

          <div className="hud-compact-powerup-pill">
            <button
              type="button"
              className="hud-powerup-chip hud-powerup-portal"
              onClick={() => onFirePortal?.('blue')}
              title="Fire Smart SDF Portal [Q / E]"
            >
              [Q] Smart Portal
              {portals.length > 0 ? ' (A↔B)' : ''}
            </button>
            <span className="hud-powerup-sep">·</span>
            <button
              type="button"
              className={`hud-powerup-chip ${lastActivatedAbility === 'matterBomb' ? 'active' : ''}`}
              onClick={() => onTriggerWeapon?.('matterBomb')}
              title="CSG Crater Bomb [F]"
            >
              [F] Crater
            </button>
            <span className="hud-powerup-sep">·</span>
            <button
              type="button"
              className={`hud-powerup-chip ${bridgeExtruderRemainingSec > 0 ? 'active' : ''}`}
              onClick={() => onTriggerWeapon?.('bridgeExtruder')}
              title="Ferrofluid Bridge Extruder [V]"
            >
              [V] Bridge
              {bridgeExtruderRemainingSec > 0
                ? ` (${bridgeExtruderRemainingSec.toFixed(1)}s)`
                : ''}
            </button>
          </div>
        </div>

        {/* MINIMAL TOP-RIGHT 4-PILL STRIP */}
        <nav
          className="hud-top-right-pill-strip"
          data-hud-interactive="true"
          aria-label="Primary View and Arena Actions"
        >
          <button
            type="button"
            className={`hud-action-pill ${engineMode !== 0 ? 'hud-action-pill-active' : 'hud-action-pill-accent'}`}
            onClick={() => onCycleEngineMode?.()}
            data-testid="hud-engine-mode-toggle"
            title={`${engineSpec.label}: ${engineSpec.description} [K]`}
          >
            [K] Engine: {engineSpec.shortLabel}
          </button>

          <button
            type="button"
            className={`hud-action-pill ${viewMode === 'grid' ? 'hud-action-pill-active' : ''}`}
            onClick={() => onToggleViewMode?.()}
            data-testid="hud-view-mode-toggle"
            title="Toggle Fullscreen (1×1) vs Multi-Player Perspective Grid (2×2) [Tab]"
          >
            [Tab / V] View: {viewMode === 'grid' ? 'Player Grid (2×2)' : 'Fullscreen 1×1'}
          </button>

          <button
            type="button"
            className={`hud-action-pill ${partyOpen ? 'hud-action-pill-active' : ''}`}
            onClick={() => onToggleParty?.()}
            data-testid="hud-party-toggle"
            title="Open QR Multiplayer Party Lobby [Y]"
          >
            [Y] QR Party (Room {partyRoomCode})
          </button>

          <button
            type="button"
            className={`hud-action-pill ${architectOpen ? 'hud-action-pill-accent' : ''}`}
            onClick={onToggleArchitect}
            data-testid="hud-architect-toggle"
            title="Open Gemini 4 Argon 1M Course Architect [G]"
          >
            [G] Argon 1M
          </button>

          <button
            type="button"
            className={`hud-action-pill ${debugDrawerOpen ? 'hud-action-pill-active' : ''}`}
            onClick={() => onToggleDebugDrawer?.()}
            data-testid="hud-debug-toggle"
            title="Toggle Collapsible Debug & Telemetry Drawer [`]"
          >
            [` / D] Debug &amp; Controls
          </button>
        </nav>
      </header>

      {bonusBannerSec !== null && (
        <div className="hud-bonus-carryover-banner hud-bonus-floating">
          +{bonusBannerSec} BONUS SECONDS CARRIED OVER!
        </div>
      )}

      {/* LIVE A/B ENGINE COMPARISON SPLIT-SCREEN / POLYGON OVERLAY LABELS */}
      {engineMode === 2 && viewMode === 'fullscreen' && (
        <div
          className="hud-ab-split-comparison-bar"
          data-testid="hud-ab-split-overlay"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '16px',
            right: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            pointerEvents: 'none',
            zIndex: 18,
            gap: '24px',
          }}
        >
          <div
            style={{
              background: 'rgba(8, 18, 28, 0.86)',
              border: '1px solid rgba(110, 235, 165, 0.65)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#98f5c4',
              fontFamily: 'monospace',
              fontSize: '12px',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.65)',
            }}
          >
            <strong style={{ color: '#6effb0', display: 'block', fontSize: '13px' }}>
              ◀ LEFT: BASIC POLYGON MESH + 16-SEG FACETED PHYSICS
            </strong>
            <span>
              dFdx×dFdy Flat Triangles · Quad Diagonal Wireframe · Hard Seams (k=0) · 3°–6° Normal Chatter
            </span>
          </div>
          <div
            style={{
              background: 'rgba(10, 14, 32, 0.88)',
              border: '1px solid rgba(255, 210, 80, 0.78)',
              borderRadius: '8px',
              padding: '8px 14px',
              color: '#ffe89e',
              fontFamily: 'monospace',
              fontSize: '12px',
              textAlign: 'right',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.65)',
            }}
          >
            <strong style={{ color: '#ffd447', display: 'block', fontSize: '13px' }}>
              RIGHT: ULTRA LOCKSTEP SDF + OPTICAL GLASS REFRACTION ▶
            </strong>
            <span>
              C∞ Smooth CSG · Chromatic Dispersion (IOR 1.50–1.55) · Floor Caustics · O(1) Cathedral · 120Hz jSDF
            </span>
          </div>
        </div>
      )}

      {/* MULTI-PLAYER PERSPECTIVE 2×2 GRID OVERLAY BADGES */}
      {viewMode === 'grid' && gridCells.length > 0 && (
        <div
          className="hud-player-grid-overlay"
          data-testid="hud-player-grid-overlay"
        >
          {gridCells.slice(0, 4).map((cell, idx) => (
            <div
              key={cell.slotIndex}
              className={`hud-grid-cell-frame ${focusedPlayerIndex === idx ? 'hud-grid-cell-focused' : ''}`}
              data-hud-interactive="true"
              data-testid={`hud-grid-cell-${idx}`}
              onClick={() => onSelectGridPlayer?.(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectGridPlayer?.(idx);
                }
              }}
              title={`Click or press [${idx + 1}] to maximize ${cell.badgeTitle} to Fullscreen`}
            >
              <div className="hud-grid-cell-top-row">
                <div
                  className="hud-grid-player-badge"
                  style={{ borderColor: cell.accentColor }}
                >
                  <span
                    className="hud-grid-player-dot"
                    style={{ background: cell.accentColor }}
                  />
                  <strong className="hud-grid-player-title">
                    {cell.badgeTitle}
                  </strong>
                  <span className="hud-grid-player-speed">
                    ({cell.speedUps.toFixed(1)} u/s)
                  </span>
                </div>

                <div className="hud-grid-room-badge">
                  ROOM {cell.roomCode}
                </div>
              </div>

              <div className="hud-grid-cell-bottom-row">
                <span className="hud-grid-player-subtitle">{cell.subtitle}</span>
                <span className="hud-grid-maximize-hint">
                  [{idx + 1} / CLICK] FULLSCREEN
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CENTER STATUS OVERLAY: Goal / Shattered / Sunk / Fell */}
      {marble.status !== 'racing' && (
        <div className="hud-status-modal" data-hud-interactive="true">
          {marble.status === 'goal' && (
            <div className="hud-status-card hud-status-goal">
              <div className="hud-status-eyebrow">COURSE COMPLETE!</div>
              <h2>{currentCourse.name} CLEARED</h2>
              <p>
                Time Remaining: <strong>{timeRemainingSec.toFixed(1)}s</strong> + Next Stage Bonus:{' '}
                <strong>+{courses[(activeCourseIndex + 1) % courses.length].bonusTimeSec}s</strong>
              </p>
              <button
                type="button"
                className="hud-btn hud-btn-primary"
                onClick={onNextCourseWithBonus}
              >
                ADVANCE WITH BONUS TIME [ENTER / CLICK]
              </button>
            </div>
          )}
          {marble.status === 'shattered' && (
            <div className="hud-status-card hud-status-danger">
              <div className="hud-status-eyebrow">HIGH-IMPACT FRACTURE</div>
              <h2>MARBLE SHATTERED!</h2>
              <p>Reforming on checkpoint pad...</p>
            </div>
          )}
          {marble.status === 'sunk' && (
            <div className="hud-status-card hud-status-acid">
              <div className="hud-status-eyebrow">CAUSTIC HAZARD</div>
              <h2>DISSOLVED IN ACID!</h2>
              <p>Respawning on last safe platform...</p>
            </div>
          )}
          {marble.status === 'fell' && (
            <div className="hud-status-card hud-status-danger">
              <div className="hud-status-eyebrow">OFF THE EDGE</div>
              <h2>LOST IN THE ABYSS!</h2>
              <p>Returning to course deck...</p>
            </div>
          )}
        </div>
      )}

      {/* COLLAPSIBLE DEBUG & TELEMETRY DRAWER (`[` / Backquote / [D] button) */}
      {debugDrawerOpen && (
        <aside
          className="hud-debug-drawer"
          data-hud-interactive="true"
          data-testid="hud-debug-drawer"
          aria-label="Debug Telemetry and Controls Drawer"
        >
          <div className="hud-debug-drawer-header">
            <div>
              <div className="hud-eyebrow">120HZ SDF TELEMETRY &amp; CONTROLS DRAWER</div>
              <h3 className="hud-debug-title">DEBUG &amp; ARCADE RIG CONTROLS</h3>
            </div>
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() => onToggleDebugDrawer?.()}
            >
              CLOSE [`]
            </button>
          </div>

          {/* FPS, Goal Distance, Ghost Split */}
          <div className="hud-debug-metrics-strip">
            <div className="hud-debug-stat-card">
              <span className="hud-metric-label">FPS</span>
              <strong className="hud-metric-value">{Math.round(fps)}</strong>
            </div>
            <div className="hud-debug-stat-card">
              <span className="hud-metric-label">GOAL DIST</span>
              <strong className="hud-metric-value">{distToGoal.toFixed(1)}m</strong>
            </div>
            <div className="hud-debug-stat-card">
              <span className="hud-metric-label">SPEED</span>
              <strong className="hud-metric-value">{totalSpeed.toFixed(1)} u/s</strong>
            </div>
            <div className="hud-debug-stat-card">
              <span className="hud-metric-label">SLOPE</span>
              <strong className="hud-metric-value">{slopeDeg}°</strong>
            </div>
          </div>

          {ghostSplit && ghostSplit.hasReferenceGhost && (
            <div
              className={`hud-ghost-split-pill ${
                ghostSplit.status === 'ahead'
                  ? 'ghost-split-ahead'
                  : ghostSplit.status === 'behind'
                    ? 'ghost-split-behind'
                    : 'ghost-split-even'
              }`}
              data-testid="ghost-split-timer"
            >
              <span className="hud-ghost-label">GHOST ({ghostSplit.referenceLabel}):</span>
              <strong className="hud-ghost-delta">{ghostSplit.formattedDelta}</strong>
            </div>
          )}

          {/* Velocity & Slope Gauge + Tactile Feel Stress */}
          <div className="hud-debug-section">
            <div className="hud-gauge-header">
              <span className="hud-metric-label">VELOCITY, CONTACT &amp; GLASS STRESS</span>
              <span className={`hud-surface-pill surface-${marble.surfaceMaterial}`}>
                SURFACE: {marble.surfaceMaterial.toUpperCase()}
              </span>
            </div>
            <div className="hud-speed-bar-track">
              <div
                className="hud-speed-bar-fill"
                style={{ width: `${speedPct.toFixed(1)}%` }}
              />
            </div>
            <div className="hud-telemetry-grid">
              <div>
                <span className="hud-metric-label">CONTACT</span>
                <strong className="hud-metric-value">
                  {marble.contact.grounded ? 'GROUNDED' : 'AIRBORNE'}
                </strong>
              </div>
              <div>
                <span className="hud-metric-label">X-RAY CUTOUT</span>
                <strong className="hud-metric-value">
                  {camera.occlusionCutoutStrength > 0.05
                    ? `${Math.round(camera.occlusionCutoutStrength * 100)}%`
                    : 'CLEAR'}
                </strong>
              </div>
              <div>
                <span className="hud-metric-label">PORTALS</span>
                <strong className="hud-metric-value">
                  {portals.length > 0 ? 'LINKED A↔B' : 'READY'}
                </strong>
              </div>
              <div>
                <span className="hud-metric-label">CSG BUFFER</span>
                <strong className="hud-metric-value">
                  {fieldMutations.length}/{MAX_FIELD_MUTATIONS}
                </strong>
              </div>
            </div>

            {feel && (
              <div className="hud-feel-row" data-testid="hud-feel-telemetry">
                <span className={`hud-stress-pill stress-${feel.stress.fractureStage}`}>
                  GLASS: {feel.stress.fractureStage.toUpperCase()} ({Math.round(feel.stress.glassStress * 100)}%)
                </span>
                {feel.rim.rimSaveActive && (
                  <span className="hud-rim-assist-pill">RIM-CATCH ASSIST</span>
                )}
                {feel.slip.backspinIntensity > 0.2 && (
                  <span className="hud-skid-pill">BACKSPIN SKID</span>
                )}
              </div>
            )}
          </div>

          {/* Course Switcher 1-7 */}
          <div className="hud-debug-section">
            <div className="hud-eyebrow">SELECT COURSE [1–7]</div>
            <div className="hud-course-tabs">
              {courses.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className={`hud-btn hud-btn-sm ${idx === activeCourseIndex ? 'hud-btn-active' : ''}`}
                  title={c.name}
                  onClick={() => onSelectCourse(idx)}
                >
                  [{idx + 1}] {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Camera, Marble, Audio, Bot, Respawn */}
          <div className="hud-debug-section">
            <div className="hud-eyebrow">RIG, ENGINE A/B, AUDIO &amp; AUTONOMOUS BOT</div>
            <div className="hud-action-row">
              <button
                type="button"
                className="hud-btn hud-btn-sm hud-btn-active"
                onClick={() => onCycleEngineMode?.()}
              >
                ENGINE: {engineSpec.shortLabel} [K]
              </button>
              <button type="button" className="hud-btn hud-btn-sm" onClick={onCycleCameraZoom}>
                CAM: {camera.zoomStopLabel} [C]
              </button>
              <button type="button" className="hud-btn hud-btn-sm" onClick={onCycleMarblePreset}>
                MARBLE: {preset.name.toUpperCase()} [M]
              </button>
              <button type="button" className="hud-btn hud-btn-sm" onClick={onRespawn}>
                RESPAWN [R]
              </button>
              {onToggleAudioMute && (
                <button
                  type="button"
                  className={`hud-btn hud-btn-sm ${synthTelemetry && !synthTelemetry.muted ? 'hud-btn-active' : ''}`}
                  onClick={onToggleAudioMute}
                  data-testid="hud-audio-toggle"
                >
                  SYNTH: {synthTelemetry?.muted ? 'MUTED' : 'YM2151 FM'} [N]
                </button>
              )}
              {onToggleBotPlaytest && (
                <button
                  type="button"
                  className={`hud-btn hud-btn-sm ${botEnabled ? 'hud-btn-active' : ''}`}
                  onClick={onToggleBotPlaytest}
                  data-testid="hud-bot-toggle"
                >
                  AI BOT: {botEnabled ? (botStyle ?? 'tourist').toUpperCase() : 'OFF'} [P]
                </button>
              )}
            </div>
          </div>

          {/* Portals & CSG Weapons */}
          <div className="hud-debug-section">
            <div className="hud-eyebrow">RAYMARCHED PORTALS &amp; REALTIME CSG WEAPONS</div>
            <div className="hud-weapons-bar">
              <button
                type="button"
                className="hud-btn hud-btn-sm hud-btn-portal-blue"
                onClick={() => onFirePortal?.('blue')}
              >
                [Q] BLUE PORTAL
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-sm hud-btn-portal-orange"
                onClick={() => onFirePortal?.('orange')}
              >
                [E / RMB] ORANGE PORTAL
              </button>
              <button
                type="button"
                className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'matterBomb' ? 'hud-btn-active' : ''}`}
                onClick={() => onTriggerWeapon?.('matterBomb')}
              >
                [F] CRATER BOMB
              </button>
              <button
                type="button"
                className={`hud-btn hud-btn-sm ${bridgeExtruderRemainingSec > 0 ? 'hud-btn-active' : ''}`}
                onClick={() => onTriggerWeapon?.('bridgeExtruder')}
              >
                [V] BRIDGE
              </button>
              <button
                type="button"
                className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'popRamp' ? 'hud-btn-active' : ''}`}
                onClick={() => onTriggerWeapon?.('popRamp')}
              >
                [B] POP-RAMP
              </button>
              <button
                type="button"
                className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'cryoFreeze' ? 'hud-btn-active' : ''}`}
                onClick={() => onTriggerWeapon?.('cryoFreeze')}
              >
                [X] CRYO FREEZE
              </button>
            </div>
          </div>

          {/* Virtual Trackball Spin Radar + Keybind Legend */}
          <div className="hud-debug-bottom-row">
            <div className="hud-trackball-panel">
              <div className="hud-eyebrow">TRACKBALL SPIN</div>
              <div className="trackball-disc">
                <div className="trackball-crosshair-h" />
                <div className="trackball-crosshair-v" />
                <div
                  className="trackball-puck"
                  style={{
                    transform: `translate(${(trackball.vector[0] * 24).toFixed(1)}px, ${(-trackball.vector[1] * 24).toFixed(1)}px)`,
                  }}
                />
              </div>
            </div>

            <div className="hud-keybind-hint">
              <span>WASD / DRAG: Roll Trackball</span>
              <span>SPACE: Hop</span>
              <span>TAB: 1×1 ↔ 2×2 Grid</span>
              <span>P: AI Bot</span>
              <span>N: Synth</span>
              <span>G: Argon 1M</span>
              <span>Q / E: Portals</span>
              <span>F / V / B / X: CSG Weapons</span>
              <span>Y: QR Party</span>
              <span>[ / ]: Orbit Cam</span>
              <span>`: Debug Drawer</span>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
