/**
 * Retro-Futuristic Marble Madness Arcade HUD (`src/ui/ArcadeHud.tsx`)
 *
 * Displays:
 * - Rolling arcade countdown timer with `+BONUS SECONDS` carry-over banner
 * - Player score, course title, subtitle, and difficulty badge
 * - Live speed (m/s), slope angle (deg), surface material indicator, and occlusion reveal badge
 * - Course switcher (`1` Practice Race, `2` Intermediate Madness), Camera Zoom (`C`),
 *   Marble Shader Preset (`M`), Respawn (`R`), and AI Course Architect (`G`)
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

  return (
    <div className="arcade-hud-overlay">
      {/* TOP BAR: Score, Rolling Countdown Timer, Course Switcher */}
      <header className="hud-top-bar">
        <div className="hud-panel hud-brand-panel" data-hud-interactive="true">
          <div className="hud-eyebrow">ATARI 1984 // SDF RAYMARCH REMAKE</div>
          <div className="hud-brand-row">
            <span className="hud-brand-title">MARBLE MADNESS</span>
            <span className="hud-badge hud-badge-cyan">120Hz SDF</span>
          </div>
          <div className="hud-score-row">
            <div>
              <span className="hud-metric-label">SCORE</span>
              <strong className="hud-score-value">
                {score.toString().padStart(6, '0')}
              </strong>
            </div>
            <div>
              <span className="hud-metric-label">GOAL DIST</span>
              <strong className="hud-metric-value">{distToGoal.toFixed(1)}m</strong>
            </div>
            <div>
              <span className="hud-metric-label">FPS</span>
              <strong className="hud-metric-value">{Math.round(fps)}</strong>
            </div>
          </div>
        </div>

        {/* CENTER: Classic Arcade Countdown Timer & Course Banner */}
        <div className="hud-center-timer-stack">
          <div className={`hud-timer-box ${isLowTime ? 'hud-timer-critical' : ''}`}>
            <div className="hud-timer-label">TIME REMAINING</div>
            <div className="hud-timer-digits">
              {Math.max(0, Math.ceil(timeRemainingSec)).toString().padStart(2, '0')}
              <span className="hud-timer-sub">
                .{Math.floor((Math.max(0, timeRemainingSec) % 1) * 10)}s
              </span>
            </div>
          </div>

          <div className="hud-course-banner">
            <span className="hud-course-index">COURSE 0{currentCourse.index}</span>
            <span className="hud-course-name">{currentCourse.name}</span>
            <span className="hud-course-diff">{currentCourse.difficulty}</span>
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

          {bonusBannerSec !== null && (
            <div className="hud-bonus-carryover-banner">
              +{bonusBannerSec} BONUS SECONDS CARRIED OVER!
            </div>
          )}
        </div>

        {/* RIGHT: Course Switcher & Quick Controls */}
        <div className="hud-panel hud-controls-panel" data-hud-interactive="true">
          <div className="hud-eyebrow">SELECT COURSE [1–6] & CAMERA [C]</div>
          <div className="hud-course-tabs">
            {courses.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                className={`hud-btn ${idx === activeCourseIndex ? 'hud-btn-active' : ''}`}
                title={c.name}
                onClick={() => onSelectCourse(idx)}
              >
                [{idx + 1}] {c.name}
              </button>
            ))}
          </div>
          <div className="hud-action-row">
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
              className={`hud-btn hud-btn-sm ${architectOpen ? 'hud-btn-accent' : ''}`}
              onClick={onToggleArchitect}
            >
              ARGON 1M ARCHITECT [G]
            </button>
          </div>
        </div>
      </header>

      {/* CENTER STATUS OVERLAY: Goal / Shattered / Sunk / Fell */}
      {marble.status !== 'racing' && (
        <div className="hud-status-modal" data-hud-interactive="true">
          {marble.status === 'goal' && (
            <div className="hud-status-card hud-status-goal">
              <div className="hud-status-eyebrow">COURSE COMPLETE!</div>
              <h2>{currentCourse.name} CLEARED</h2>
              <p>
                Time Remaining: <strong>{timeRemainingSec.toFixed(1)}s</strong> + Next Stage Bonus:{' '}
                <strong>+{ courses[(activeCourseIndex + 1) % courses.length].bonusTimeSec }s</strong>
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

      {/* BOTTOM BAR: Speed / Slope Gauge, Surface Material, Hazard Manifest, Trackball */}
      <footer className="hud-bottom-bar">
        <div className="hud-panel hud-telemetry-panel" data-hud-interactive="true">
          <div className="hud-gauge-header">
            <span className="hud-metric-label">VELOCITY & SLOPE TELEMETRY</span>
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
              <span className="hud-metric-label">SPEED</span>
              <strong className="hud-metric-value">{totalSpeed.toFixed(1)} u/s</strong>
            </div>
            <div>
              <span className="hud-metric-label">SLOPE GRADE</span>
              <strong className="hud-metric-value">{slopeDeg}°</strong>
            </div>
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

        <div className="hud-panel hud-hazards-panel" data-hud-interactive="true">
          <div className="hud-weapons-header">
            <span className="hud-eyebrow">
              RAYMARCHED SDF PORTALS [Q / E] &amp; REALTIME CSG WEAPONS [F / V / B / N]
            </span>
            <div className="hud-portal-status-badges">
              <span className="hud-badge hud-badge-portal-blue">
                PORTALS: {portals.length > 0 ? 'LINKED A↔B' : 'READY'}
                {(marble.portalCrossings ?? 0) > 0
                  ? ` (${marble.portalCrossings} FLINGS · ${(marble.lastPortalExitSpeed ?? 0).toFixed(1)} u/s)`
                  : ''}
              </span>
              <span className="hud-badge hud-badge-cyan">
                CSG BUFFER: {fieldMutations.length}/{MAX_FIELD_MUTATIONS}
              </span>
            </div>
          </div>

          <div className="hud-weapons-bar">
            <button
              type="button"
              className="hud-btn hud-btn-sm hud-btn-portal-blue"
              onClick={() => onFirePortal?.('blue')}
              title="Fire Blue SDF Portal along aim direction [Q]"
            >
              [Q] BLUE PORTAL
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-sm hud-btn-portal-orange"
              onClick={() => onFirePortal?.('orange')}
              title="Fire Orange SDF Portal along aim direction [E / Right-Click]"
            >
              [E / RMB] ORANGE PORTAL
            </button>
            <button
              type="button"
              className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'matterBomb' ? 'hud-btn-active' : ''}`}
              onClick={() => onTriggerWeapon?.('matterBomb')}
              title="CSG Matter Bomb / Crater Cannon (smoothSubtract sphere) [F]"
            >
              [F] CRATER BOMB
            </button>
            <button
              type="button"
              className={`hud-btn hud-btn-sm ${bridgeExtruderRemainingSec > 0 ? 'hud-btn-active' : ''}`}
              onClick={() => onTriggerWeapon?.('bridgeExtruder')}
              title="Ferrofluid Bridge Extruder (3.5s smoothUnion capsule trail) [V]"
            >
              [V] BRIDGE EXTRUDER
              {bridgeExtruderRemainingSec > 0 ? ` (${bridgeExtruderRemainingSec.toFixed(1)}s)` : ''}
            </button>
            <button
              type="button"
              className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'popRamp' ? 'hud-btn-active' : ''}`}
              onClick={() => onTriggerWeapon?.('popRamp')}
              title="Tectonic Pop-Ramp (smoothUnion wedge + upward vault impulse) [B]"
            >
              [B] POP-RAMP
            </button>
            <button
              type="button"
              className={`hud-btn hud-btn-sm ${lastActivatedAbility === 'cryoFreeze' ? 'hud-btn-active' : ''}`}
              onClick={() => onTriggerWeapon?.('cryoFreeze')}
              title="Cryo Freeze Pulse (materialOverride acid/sticky -> fast ice) [X]"
            >
              [X] CRYO FREEZE
            </button>
          </div>

          <div className="hud-keybind-hint">
            <span>WASD / DRAG: Roll Trackball</span>
            <span>SPACE: Hop</span>
            <span>P: AI Bot</span>
            <span>N: Synth</span>
            <span>G: Argon 1M</span>
            <span>Q / E: Blue &amp; Orange Portals</span>
            <span>F / V / B / X: CSG Crater / Bridge / Ramp / Cryo</span>
            <span>[ / ]: Orbit Cam</span>
          </div>
        </div>

        {/* Virtual Trackball Vector Disc */}
        <div className="hud-panel hud-trackball-panel">
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
      </footer>
    </div>
  );
};
