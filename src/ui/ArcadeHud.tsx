/**
 * Retro-Futuristic Marble Madness Arcade HUD (`src/ui/ArcadeHud.tsx`)
 *
 * Clean Fullscreen Default UI + Unobstructed 6-Player Split-Screen Grid Mode:
 * - Default Fullscreen Mode (`1×1`):
 *   1. Sleek, compact Top Arcade Bar: Course Name, Countdown Timer, Score, and Portal / Powerup pill.
 *   2. Minimal Top-Right Pill Strip: Engine Mode, `[Tab / V] 6P Split-Screen (3×2)`, `[Y] Join Party (N/6)`, `[G] Argon 1M`, `[D] Debug`.
 * - Split-Screen Grid Mode (`viewMode === 'grid'`, `2×2` or `3×2` for up to 6 players):
 *   1. Does NOT float the big ArcadeHud top bar over the top row of player tiles!
 *   2. Docks a compact `32px` Slim Top Strip above the grid containing ONLY:
 *      Course Name, Timer, and `[Tab] 1×1 Fullscreen` · `[Y] QR Join (N/6)` · `[G] Argon` · `[D] Debug`.
 *   3. Inside each player's grid cell (`P1` through `P6`), shows ONLY a tiny, ultra-clean color-coded
 *      corner tag (`● P2 @MAYA · 14.2 u/s`) in the top-left corner (`padding: 2px 7px`, `font-size: 11px`, `pointer-events: none`),
 *      leaving 98% of every player's viewport completely clear!
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
import type { ShaderPixelEvaluationBenchmark } from '../rendering';
import {
  type EngineComparisonMode,
  getEngineModeSpec,
} from '../physics/basic-polygon-mode';
import { MAX_PLAYERS } from '../multiplayer/party-types';

export type ViewportDisplayMode = 'fullscreen' | 'grid';

export interface LiveProfilerTelemetry {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly emaFrameMs: number;
  readonly gpuPassMs: number;
  readonly gpuTimerQueryAvailable: boolean;
  readonly physicsStepMs: number;
  readonly effectiveDpr: number;
  readonly adaptiveScale: number;
  readonly initialDprCap: number;
  readonly renderResolution: readonly [number, number];
  readonly hudSyncHz: number;
  readonly pixelEvalBenchmark: ShaderPixelEvaluationBenchmark;
}

export interface PlayerGridCellHudInfo {
  readonly slotIndex: number;
  readonly badgeTitle: string;
  readonly subtitle: string;
  readonly speedUps: number;
  readonly roomCode: string;
  readonly accentColor: string;
  readonly status: MarbleState['status'];
  readonly isHuman?: boolean;
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
  readonly partyConnectedCount?: number;
  readonly viewMode?: ViewportDisplayMode;
  readonly focusedPlayerIndex?: number;
  readonly debugDrawerOpen?: boolean;
  readonly sdfWizardOpen?: boolean;
  readonly engineMode?: EngineComparisonMode;
  readonly gridCells?: readonly PlayerGridCellHudInfo[];
  readonly portals?: readonly PortalPair[];
  readonly fieldMutations?: readonly FieldMutation[];
  readonly bridgeExtruderRemainingSec?: number;
  readonly lastActivatedAbility?: WeaponAbilityId | null;
  readonly profilerMetrics?: LiveProfilerTelemetry;
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
  readonly onToggleSdfWizard?: () => void;
  readonly onCycleEngineMode?: () => void;
  readonly onSelectGridPlayer?: (slotIndex: number) => void;
  readonly onClearSavedGhosts?: () => void;
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
  partyConnectedCount = 1,
  viewMode = 'fullscreen',
  focusedPlayerIndex = 0,
  debugDrawerOpen = false,
  sdfWizardOpen = false,
  engineMode = 0,
  gridCells = [],
  portals = [],
  fieldMutations = [],
  bridgeExtruderRemainingSec = 0,
  lastActivatedAbility = null,
  profilerMetrics,
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
  onToggleSdfWizard,
  onCycleEngineMode,
  onSelectGridPlayer,
  onClearSavedGhosts,
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
  const visibleCells = gridCells.slice(0, MAX_PLAYERS);
  const isSixTileGrid = visibleCells.length > 4;

  return (
    <div
      className={`arcade-hud-overlay ${
        viewMode === 'grid' ? 'arcade-hud-overlay-split-grid' : ''
      }`}
    >
      {viewMode === 'grid' ? (
        /* DOCKED 32PX SLIM TOP STRIP IN SPLIT-SCREEN MODE (NEVER OVERLAPS PLAYER TILES) */
        <header
          className="hud-slim-split-top-strip"
          data-testid="hud-slim-split-top-strip"
          data-hud-interactive="true"
        >
          <div className="hud-slim-left">
            <span className="hud-slim-course">
              COURSE {currentCourse.index.toString().padStart(2, '0')}: {currentCourse.name.toUpperCase()}
            </span>
            <span
              className={`hud-slim-timer ${isLowTime ? 'hud-timer-critical' : ''}`}
              data-testid="hud-countdown-timer"
            >
              {Math.max(0, timeRemainingSec).toFixed(1)}s
            </span>
          </div>

          <nav className="hud-slim-actions" aria-label="Split-Screen Quick Actions">
            <button
              type="button"
              className={`hud-slim-btn ${sdfWizardOpen ? 'hud-slim-btn-active' : ''}`}
              onClick={() => onToggleSdfWizard?.()}
              data-testid="hud-sdf-wizard-toggle"
              title="Open 20-Second Interactive SDF X-Ray & Measurement Wizard [W]"
            >
              [W] 20s SDF Wizard
            </button>
            <span className="hud-slim-sep">·</span>
            <button
              type="button"
              className="hud-slim-btn hud-slim-btn-active"
              onClick={() => onToggleViewMode?.()}
              data-testid="hud-view-mode-toggle"
            >
              [Tab] 1×1 Fullscreen
            </button>
            <span className="hud-slim-sep">·</span>
            <button
              type="button"
              className={`hud-slim-btn ${partyOpen ? 'hud-slim-btn-active' : ''}`}
              onClick={() => onToggleParty?.()}
              data-testid="hud-party-toggle"
            >
              [Y] QR Join ({partyConnectedCount}/{MAX_PLAYERS})
            </button>
            <span className="hud-slim-sep">·</span>
            <button
              type="button"
              className={`hud-slim-btn ${architectOpen ? 'hud-slim-btn-active' : ''}`}
              onClick={onToggleArchitect}
              data-testid="hud-architect-toggle"
            >
              [G] Argon
            </button>
            <span className="hud-slim-sep">·</span>
            <button
              type="button"
              className={`hud-slim-btn ${debugDrawerOpen ? 'hud-slim-btn-active' : ''}`}
              onClick={() => onToggleDebugDrawer?.()}
              data-testid="hud-debug-toggle"
            >
              [D] Debug
            </button>
          </nav>
        </header>
      ) : (
        /* SLEEK COMPACT TOP ARCADE BAR + TOP-RIGHT PILL STRIP IN 1x1 FULLSCREEN MODE */
        <header className="hud-clean-top-strip">
          <div className="hud-compact-arcade-bar" data-hud-interactive="true">
            <div className="hud-compact-course-block">
              <span className="hud-course-index">
                COURSE {currentCourse.index.toString().padStart(2, '0')}:
              </span>
              <span className="hud-course-name">
                {currentCourse.name.toUpperCase()}
              </span>
              {(currentCourse.id === 'riptide-surf-break' ||
                currentCourse.id === 'sahara-dune-surge') && (
                <button
                  type="button"
                  className="hud-focused-pov-pill"
                  data-testid="hud-surf-variant-toggle"
                  onClick={() => {
                    const targetId =
                      currentCourse.id === 'riptide-surf-break'
                        ? 'sahara-dune-surge'
                        : 'riptide-surf-break';
                    const targetIdx = courses.findIndex((c) => c.id === targetId);
                    if (targetIdx >= 0) {
                      onSelectCourse(targetIdx);
                    }
                  }}
                  title="Switch between Ocean Riptide Surf Break and Sahara Sand Dunes Variant"
                >
                  {currentCourse.id === 'riptide-surf-break'
                    ? '🏜️ SAND DUNE MODE [0]'
                    : '🌊 OCEAN SURF MODE [8]'}
                </button>
              )}
              {focusedPlayerIndex > 0 && focusedCell && (
                <button
                  type="button"
                  className="hud-focused-pov-pill"
                  onClick={() => onSelectGridPlayer?.(0)}
                  title="Click to return to P1"
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

          {/* MINIMAL TOP-RIGHT PILL STRIP */}
          <nav
            className="hud-top-right-pill-strip"
            data-hud-interactive="true"
            aria-label="Primary View and Arena Actions"
          >
            <button
              type="button"
              className={`hud-action-pill ${sdfWizardOpen ? 'hud-action-pill-active' : 'hud-action-pill-accent'}`}
              onClick={() => onToggleSdfWizard?.()}
              data-testid="hud-sdf-wizard-toggle"
              title="Open 20-Second Interactive SDF X-Ray & Measurement Wizard [W]"
            >
              [W] 20s SDF Wizard
            </button>

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
              className="hud-action-pill"
              onClick={() => onToggleViewMode?.()}
              data-testid="hud-view-mode-toggle"
              title="Toggle Fullscreen (1×1) vs 6-Player Split-Screen Grid (3×2) [Tab]"
            >
              [Tab] Split-Screen ({isSixTileGrid ? '3×2' : '2×2'})
            </button>

            <button
              type="button"
              className={`hud-action-pill ${partyOpen ? 'hud-action-pill-active' : ''}`}
              onClick={() => onToggleParty?.()}
              data-testid="hud-party-toggle"
              title="Open 6-Player QR Party Join Modal [Y]"
            >
              [Y] Join Party ({partyConnectedCount}/{MAX_PLAYERS})
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
              title="Toggle Collapsible Debug & Telemetry Drawer [` / D]"
            >
              [` / D] Debug
            </button>
          </nav>
        </header>
      )}

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

      {/* MULTI-PLAYER SPLIT-SCREEN GRID OVERLAY (UP TO 6 TILES IN 3×2 OR 4 TILES IN 2×2) */}
      {viewMode === 'grid' && visibleCells.length > 0 && (
        <div
          className={`hud-player-grid-overlay ${
            isSixTileGrid ? 'hud-player-grid-3x2' : 'hud-player-grid-2x2'
          }`}
          data-testid="hud-player-grid-overlay"
        >
          {visibleCells.map((cell, idx) => (
            <div
              key={cell.slotIndex}
              className={`hud-grid-cell-frame ${
                focusedPlayerIndex === idx ? 'hud-grid-cell-focused' : ''
              }`}
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
              <div
                className="hud-grid-corner-tag"
                data-testid={`hud-grid-corner-tag-${idx}`}
                style={{ borderColor: cell.accentColor }}
              >
                <span
                  className="hud-grid-player-dot"
                  style={{ background: cell.accentColor }}
                />
                <span className="hud-grid-corner-label">
                  {cell.badgeTitle} · {cell.speedUps.toFixed(1)} u/s
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CENTER STATUS OVERLAY: Goal / Shattered / Sunk / Fell (Only in Fullscreen or Goal) */}
      {marble.status !== 'racing' && (viewMode === 'fullscreen' || marble.status === 'goal') && (
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

          {/* LIVE FRAME-TIME & STEP PROFILER BREAKDOWN (`window.__MARBLE_PROFILER__`) */}
          {profilerMetrics && (
            <div
              className="hud-debug-section"
              data-testid="hud-profiler-breakdown"
            >
              <div className="hud-gauge-header">
                <span className="hud-metric-label">
                  FRAME-TIME &amp; STEP PROFILER (60+ FPS AUTO-GOVERNOR)
                </span>
                <span className="hud-surface-pill surface-stone">
                  SDF EVALS: -{profilerMetrics.pixelEvalBenchmark.primitiveEvalReductionPercent.toFixed(1)}%
                </span>
              </div>
              <div className="hud-telemetry-grid">
                <div>
                  <span className="hud-metric-label">FRAME / EMA</span>
                  <strong className="hud-metric-value" data-testid="profiler-frame-ms">
                    {profilerMetrics.frameTimeMs.toFixed(1)}ms / {profilerMetrics.emaFrameMs.toFixed(1)}ms
                  </strong>
                </div>
                <div>
                  <span className="hud-metric-label">
                    GPU PASS {profilerMetrics.gpuTimerQueryAvailable ? '(HW)' : '(EST)'}
                  </span>
                  <strong className="hud-metric-value" data-testid="profiler-gpu-ms">
                    {profilerMetrics.gpuPassMs.toFixed(2)}ms
                  </strong>
                </div>
                <div>
                  <span className="hud-metric-label">PHYSICS STEP</span>
                  <strong className="hud-metric-value" data-testid="profiler-physics-ms">
                    {profilerMetrics.physicsStepMs.toFixed(2)}ms
                  </strong>
                </div>
                <div>
                  <span className="hud-metric-label">DPR / SCALE</span>
                  <strong className="hud-metric-value" data-testid="profiler-effective-dpr">
                    {profilerMetrics.effectiveDpr.toFixed(2)}× ({Math.round(profilerMetrics.adaptiveScale * 100)}%)
                  </strong>
                </div>
                <div>
                  <span className="hud-metric-label">RESOLUTION</span>
                  <strong className="hud-metric-value" data-testid="profiler-resolution">
                    {profilerMetrics.renderResolution[0]}×{profilerMetrics.renderResolution[1]}
                  </strong>
                </div>
                <div>
                  <span className="hud-metric-label">HUD SYNC</span>
                  <strong className="hud-metric-value" data-testid="profiler-hud-hz">
                    {profilerMetrics.hudSyncHz}Hz (50ms)
                  </strong>
                </div>
              </div>
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

          {/* Course Switcher 1-0 */}
          <div className="hud-debug-section">
            <div className="hud-eyebrow">SELECT COURSE [1–9, 0]</div>
            <div className="hud-course-tabs">
              {courses.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  className={`hud-btn hud-btn-sm ${idx === activeCourseIndex ? 'hud-btn-active' : ''}`}
                  title={c.name}
                  onClick={() => onSelectCourse(idx)}
                >
                  [{(idx + 1) % 10}] {c.name}
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
              <button
                type="button"
                className="hud-btn hud-btn-sm"
                onClick={() => {
                  try {
                    window.localStorage?.removeItem('marble_madness_ghost_runs_v1');
                  } catch {
                    // ignore storage errors
                  }
                  onClearSavedGhosts?.();
                }}
                data-testid="hud-clear-ghosts-btn"
              >
                CLEAR SAVED GHOSTS
              </button>
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
              <span>TAB: 1×1 ↔ 3×2 Split</span>
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
