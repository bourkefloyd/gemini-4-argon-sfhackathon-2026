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
  MARBLE_VISUAL_PRESETS,
  type MarbleState,
} from '../contracts';
import type { TrackballUiTelemetry } from '../camera';

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
  readonly architectOpen: boolean;
  readonly onSelectCourse: (index: number) => void;
  readonly onCycleCameraZoom: () => void;
  readonly onCycleMarblePreset: () => void;
  readonly onRespawn: () => void;
  readonly onNextCourseWithBonus: () => void;
  readonly onToggleArchitect: () => void;
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
  architectOpen,
  onSelectCourse,
  onCycleCameraZoom,
  onCycleMarblePreset,
  onRespawn,
  onNextCourseWithBonus,
  onToggleArchitect,
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

          {bonusBannerSec !== null && (
            <div className="hud-bonus-carryover-banner">
              +{bonusBannerSec} BONUS SECONDS CARRIED OVER!
            </div>
          )}
        </div>

        {/* RIGHT: Course Switcher & Quick Controls */}
        <div className="hud-panel hud-controls-panel" data-hud-interactive="true">
          <div className="hud-eyebrow">SELECT COURSE [1 / 2] & CAMERA [C]</div>
          <div className="hud-course-tabs">
            {courses.map((c, idx) => (
              <button
                key={c.id}
                type="button"
                className={`hud-btn ${idx === activeCourseIndex ? 'hud-btn-active' : ''}`}
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
        </div>

        <div className="hud-panel hud-hazards-panel">
          <div className="hud-eyebrow">{currentCourse.subtitle}</div>
          <div className="hud-hazard-chips">
            {currentCourse.hazardManifest.map((h) => (
              <div key={h.id} className="hud-hazard-chip" title={h.description}>
                <span className="hud-hazard-dot" />
                <span>{h.label}</span>
              </div>
            ))}
          </div>
          <div className="hud-keybind-hint">
            <span>WASD / ARROWS / MOUSE DRAG: Roll Trackball</span>
            <span>SPACE: Hop</span>
            <span>Q/E: Orbit Cam</span>
            <span>C: Zoom Stop</span>
            <span>1/2: Course</span>
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
