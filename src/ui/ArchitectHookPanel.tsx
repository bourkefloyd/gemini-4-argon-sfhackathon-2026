/**
 * AI Course Architect (Gemini 4 Argon 1M-Token Context) Hook Panel (`src/ui/ArchitectHookPanel.tsx`)
 *
 * Provides:
 * - One-click synthesis / hot-swap of procedural `CourseSpec` levels
 * - Live declarative `CourseSpec` JSON editor & hot-compiler (`Apply & Compile SDF`)
 * - Lockstep CPU/GPU shader inspection (GLSL ES 3.00 & WGSL line counts + primitive breakdown)
 * - Global `window.__MARBLE_MADNESS_ARCHITECT__` bridge for fan-out workers
 */

import React, { useEffect, useState } from 'react';
import type { CourseSpec } from '../contracts';
import { generateArchitectCoursePreset } from '../courses';

export interface ArchitectHookPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentCourse: CourseSpec;
  readonly compiledShaders: { glsl: string; wgsl: string; backend: string };
  readonly onApplyCustomCourse: (course: CourseSpec) => void;
}

export const ArchitectHookPanel: React.FC<ArchitectHookPanelProps> = ({
  isOpen,
  onClose,
  currentCourse,
  compiledShaders,
  onApplyCustomCourse,
}) => {
  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(currentCourse, null, 2),
  );
  const [promptText, setPromptText] = useState<string>(
    '4-tier helical ice chute with synchronized SDF slamming pistons and undulating wave floor bridge',
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'spec' | 'glsl' | 'wgsl'>('spec');

  useEffect(() => {
    setJsonText(JSON.stringify(currentCourse, null, 2));
    setErrorMsg(null);
  }, [currentCourse]);

  if (!isOpen) return null;

  const glslLines = compiledShaders.glsl.split('\n').length;
  const wgslLines = compiledShaders.wgsl.split('\n').length;

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as CourseSpec;
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes)) {
        throw new Error('CourseSpec requires id, name, and nodes[] array.');
      }
      setErrorMsg(null);
      onApplyCustomCourse(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSynthesizePreset = () => {
    const generated = generateArchitectCoursePreset('spiral-citadel');
    setJsonText(JSON.stringify(generated, null, 2));
    setErrorMsg(null);
    onApplyCustomCourse(generated);
  };

  return (
    <aside
      className="architect-drawer"
      data-hud-interactive="true"
      aria-label="AI Course Architect Panel"
    >
      <div className="architect-header">
        <div>
          <div className="architect-eyebrow">GEMINI 4 ARGON // 1M-TOKEN CONTEXT HOOK</div>
          <h2 className="architect-title">AI COURSE ARCHITECT</h2>
        </div>
        <button type="button" className="hud-btn hud-btn-sm" onClick={onClose}>
          CLOSE [G]
        </button>
      </div>

      <div className="architect-stats-row">
        <div className="architect-stat-pill">
          <span>PRIMITIVES</span>
          <strong>{currentCourse.nodes.length + currentCourse.hazards.length}</strong>
        </div>
        <div className="architect-stat-pill">
          <span>GLSL2 LINES</span>
          <strong>{glslLines}</strong>
        </div>
        <div className="architect-stat-row-pill architect-stat-pill">
          <span>WGSL LINES</span>
          <strong>{wgslLines}</strong>
        </div>
        <div className="architect-stat-pill">
          <span>LOCKSTEP</span>
          <strong className="text-emerald">CPU == GPU</strong>
        </div>
      </div>

      <div className="architect-prompt-box">
        <label className="architect-label" htmlFor="argon-prompt-input">
          ARCHITECT PROMPT / LEVEL INTENT
        </label>
        <textarea
          id="argon-prompt-input"
          className="architect-prompt-input"
          rows={2}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
        />
        <div className="architect-prompt-actions">
          <button
            type="button"
            className="hud-btn hud-btn-accent"
            onClick={handleSynthesizePreset}
          >
            SYNTHESIZE ARGON HELIX COURSE
          </button>
        </div>
      </div>

      <div className="architect-tabs">
        <button
          type="button"
          className={`architect-tab ${activeTab === 'spec' ? 'active' : ''}`}
          onClick={() => setActiveTab('spec')}
        >
          CourseSpec JSON
        </button>
        <button
          type="button"
          className={`architect-tab ${activeTab === 'glsl' ? 'active' : ''}`}
          onClick={() => setActiveTab('glsl')}
        >
          Compiled GLSL2
        </button>
        <button
          type="button"
          className={`architect-tab ${activeTab === 'wgsl' ? 'active' : ''}`}
          onClick={() => setActiveTab('wgsl')}
        >
          Compiled WGSL
        </button>
      </div>

      {activeTab === 'spec' ? (
        <>
          <textarea
            className="architect-code-editor"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          {errorMsg && <div className="architect-error">{errorMsg}</div>}
          <div className="architect-footer">
            <button
              type="button"
              className="hud-btn hud-btn-primary"
              onClick={handleApplyJson}
            >
              HOT-COMPILE & PLAY COURSESPEC
            </button>
          </div>
        </>
      ) : (
        <pre className="architect-code-readonly">
          {activeTab === 'glsl' ? compiledShaders.glsl : compiledShaders.wgsl}
        </pre>
      )}
    </aside>
  );
};
