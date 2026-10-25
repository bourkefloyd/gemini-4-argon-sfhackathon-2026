/**
 * AI Course Architect (Gemini 4 Argon 1M-Token Context & Multi-Agent Swarm Director)
 * (`src/ui/ArchitectHookPanel.tsx`)
 *
 * Provides:
 * - Live 1M-Token Context Meter (breakdown of Engine Contracts, CPU/GPU SDF Kernel,
 *   GLSL2/WGSL Shaders, Course Catalog, Gameplay Feel Bible, and 120 Hz Run Telemetry)
 * - Parallel 3-Agent Swarm Status:
 *     1. Agent 1 (`gemini-4-argon`, `thinking_level: "high"`): Lead Course Architect
 *     2. Agent 2 (`gemini-3.8-flash`, parallel worker): Hazard & Portal Specialist
 *     3. Agent 3 (CPU SDF Solvability & Shader Gate): `createCpuWorldEvaluator` +
 *        `compileCourseToGlsl`/`Wgsl` + 120 Hz Bot Rollout verification
 * - "Analyze My Last Run & Mutate Course" telemetry-driven flow sculptor
 * - 3 Pre-computed Argon 1M Showcase Presets ("Portal Fling Citadel",
 *   "Ferrofluid Wave Gauntlet", "Adaptive Coach Remix") + Realtime CSG Mutations
 * - Human-in-the-Loop Preview & "Approve & Hot-Swap Course" confirmation gate
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ARGON_SYNTHESIS_PRESETS,
  announceArcadeCallout,
  createArchitectVoiceInput,
  createLiveTelemetryTracker,
  fetchArgonServerStatus,
  packArgon1MContext,
  runArgonSwarmArchitect,
  verifyCourseSpecSolvability,
  type ArcadeAnnounceEvent,
  type ArgonPresetId,
  type RealtimeCsgMutationKind,
  type SwarmAgentExecutionTrace,
  type SwarmSynthesisProposal,
} from '../argon';
import { ArchitectureDiagramModal } from '../argon/ArchitectureDiagramModal';
import type { CourseSpec } from '../contracts';

export interface ArchitectHookPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentCourse: CourseSpec;
  readonly compiledShaders: { glsl: string; wgsl: string; backend: string };
  readonly onApplyCustomCourse: (course: CourseSpec) => void;
}

const ARCHITECT_SCOPED_STYLES = `
.architect-drawer-wide {
  width: 520px !important;
  overflow-y: auto;
  overflow-x: hidden;
}
.argon-meter-card {
  background: rgba(12, 22, 46, 0.85);
  border: 1px solid rgba(217, 107, 255, 0.38);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.argon-meter-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10px;
}
.argon-meter-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  display: flex;
}
.argon-meter-seg-cached {
  background: linear-gradient(90deg, #3ce8ff, #bc6ff1);
  height: 100%;
}
.argon-meter-seg-dynamic {
  background: #ffd23f;
  height: 100%;
}
.argon-breakdown-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}
.argon-breakdown-item {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 5px;
  padding: 4px 7px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 9.5px;
}
.argon-breakdown-item strong {
  color: var(--cyan-neon);
}
.argon-swarm-box {
  background: rgba(8, 16, 34, 0.9);
  border: 1px solid rgba(60, 232, 255, 0.3);
  border-radius: 8px;
  padding: 9px 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.argon-agent-row {
  background: rgba(255, 255, 255, 0.035);
  border-left: 3px solid var(--cyan-neon);
  border-radius: 4px;
  padding: 5px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.argon-agent-row.agent-lead {
  border-left-color: var(--violet-argon);
}
.argon-agent-row.agent-flash {
  border-left-color: var(--gold-arcade);
}
.argon-agent-row.agent-gate {
  border-left-color: var(--emerald-neon);
}
.argon-agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  color: #ffffff;
}
.argon-hitl-card {
  background: linear-gradient(135deg, rgba(16, 48, 44, 0.92), rgba(14, 24, 52, 0.95));
  border: 1.5px solid var(--emerald-neon);
  border-radius: 9px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 0 22px rgba(40, 247, 156, 0.22);
}
.argon-hitl-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.argon-preset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}
.argon-csg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px;
}
.argon-key-row {
  display: flex;
  gap: 6px;
  align-items: center;
}
.argon-key-input {
  flex: 1;
  background: rgba(3, 7, 16, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 5px;
  color: #e6f3ff;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 4px 8px;
  user-select: text;
}
.argon-trace-pre {
  max-height: 92px;
  overflow-y: auto;
  background: rgba(3, 7, 16, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1.35;
  color: #d6eaff;
  white-space: pre-wrap;
  user-select: text;
}
`;

export const ArchitectHookPanel: React.FC<ArchitectHookPanelProps> = ({
  isOpen,
  onClose,
  currentCourse,
  compiledShaders,
  onApplyCustomCourse,
}) => {
  const telemetryTrackerRef = useRef(createLiveTelemetryTracker());
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  const [jsonText, setJsonText] = useState<string>(() =>
    JSON.stringify(currentCourse, null, 2),
  );
  const [promptText, setPromptText] = useState<string>(
    'Synthesize Portal Fling Citadel: helical ice chute with linked Blue/Orange SDF Portals & synchronized slamming pistons',
  );
  const [userApiKey, setUserApiKey] = useState<string>('');
  const [hasServerEnvKey, setHasServerEnvKey] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'swarm' | 'spec' | 'glsl' | 'wgsl'>('swarm');

  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [previousInteractionId, setPreviousInteractionId] = useState<string | null>(null);
  const [pendingProposal, setPendingProposal] = useState<SwarmSynthesisProposal | null>(null);
  const [approvedBanner, setApprovedBanner] = useState<string | null>(null);
  const [diagramOpen, setDiagramOpen] = useState<boolean>(false);
  const [micState, setMicState] = useState<'idle' | 'listening' | 'unsupported'>('idle');
  const [callout, setCallout] = useState<string | null>(null);
  const voiceInput = useMemo(
    () =>
      createArchitectVoiceInput({
        onTranscript: (text) => setPromptText(text),
        onState: setMicState,
      }),
    [],
  );
  const [swarmAgents, setSwarmAgents] = useState<readonly SwarmAgentExecutionTrace[]>(
    () => ARGON_SYNTHESIS_PRESETS['portal-fling-citadel'].swarmAgents,
  );

  // Continuously sample 120 Hz telemetry from window.__MARBLE_PLAYTEST__ in the background
  useEffect(() => {
    const interval = window.setInterval(() => {
      const api = window.__MARBLE_PLAYTEST__;
      if (!api) return;
      const snap = api.getTelemetry();
      telemetryTrackerRef.current.recordSnapshot(
        snap.course,
        snap.position,
        snap.velocity,
        snap.status,
        snap.surfaceMaterial,
        snap.grounded,
        snap.timeRemainingSec,
      );
      if (isOpen) {
        setTelemetryTick((t) => t + 1);
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    fetchArgonServerStatus().then((st) => {
      setHasServerEnvKey(st.hasEnvKey);
    });
  }, []);

  useEffect(() => {
    setJsonText(JSON.stringify(currentCourse, null, 2));
    setErrorMsg(null);
  }, [currentCourse]);

  const liveTelemetry = useMemo(
    () => telemetryTrackerRef.current.getSummary(currentCourse),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentCourse, telemetryTick],
  );

  const contextBundle = useMemo(
    () =>
      packArgon1MContext({
        currentCourse,
        compiledShaders,
        telemetry: liveTelemetry,
        userPrompt: promptText,
      }),
    [currentCourse, compiledShaders, liveTelemetry, promptText],
  );

  if (!isOpen) return null;

  const glslLines = compiledShaders.glsl.split('\n').length;
  const wgslLines = compiledShaders.wgsl.split('\n').length;

  const speakCallout = (event: ArcadeAnnounceEvent, title?: string) => {
    void announceArcadeCallout(
      {
        event,
        courseName: title ?? currentCourse.name,
        archetype: liveTelemetry.inferredArchetype,
        peakSpeed: liveTelemetry.peakSpeed,
        title,
      },
      { apiKey: userApiKey.trim() || undefined },
    ).then((announcement) => setCallout(announcement.text));
  };

  const executeSwarm = async (options: {
    mode: 'preset' | 'telemetry-mutation' | 'natural-language' | 'realtime-csg';
    presetId?: ArgonPresetId;
    csgMutationKind?: RealtimeCsgMutationKind;
    customPrompt?: string;
  }) => {
    setIsSynthesizing(true);
    setErrorMsg(null);
    setApprovedBanner(null);

    try {
      const effectivePrompt = options.customPrompt ?? promptText;
      if (options.customPrompt) {
        setPromptText(options.customPrompt);
      }

      const proposal = await runArgonSwarmArchitect({
        mode: options.mode,
        presetId: options.presetId,
        csgMutationKind: options.csgMutationKind,
        prompt: effectivePrompt,
        currentCourse,
        compiledShaders,
        telemetry: liveTelemetry,
        apiKey: userApiKey.trim() || undefined,
        previousInteractionId,
        onProgress: (agents) => setSwarmAgents(agents),
      });

      setSwarmAgents(proposal.swarmAgents);
      setPreviousInteractionId(proposal.interactionId);
      setPendingProposal(proposal);
      setJsonText(JSON.stringify(proposal.proposedCourse, null, 2));
      const announceEvent: ArcadeAnnounceEvent =
        options.mode === 'telemetry-mutation'
          ? 'analyze-run'
          : options.mode === 'realtime-csg'
            ? 'csg'
            : options.mode === 'preset'
              ? 'preset'
              : 'mutate-course';
      speakCallout(announceEvent, proposal.title);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleApproveProposal = () => {
    if (!pendingProposal) return;
    const approvedCourse = pendingProposal.proposedCourse;
    onApplyCustomCourse(approvedCourse);
    speakCallout('approved', approvedCourse.name);
    setApprovedBanner(
      `HOT-SWAPPED "${approvedCourse.name}" (${approvedCourse.nodes.length + approvedCourse.hazards.length} SDF Primitives · CPU == GPU Lockstep)`,
    );
    setPendingProposal(null);
  };

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as CourseSpec;
      const gate = verifyCourseSpecSolvability(parsed);
      if (!gate.schemaValid) {
        throw new Error(gate.diagnostics.join(' '));
      }
      setErrorMsg(null);
      onApplyCustomCourse(gate.verifiedCourse);
      setApprovedBanner(
        `HOT-COMPILED "${gate.verifiedCourse.name}" (Spawn d=${gate.startDistance.toFixed(2)}m · ${gate.glslLineCount} GLSL2 lines)`,
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const cachedBarPct = Math.min(
    85,
    Math.max(12, (contextBundle.cachedPrefixTokens / 250_000) * 100),
  );
  const dynamicBarPct = Math.min(
    15,
    Math.max(4, (contextBundle.dynamicTailTokens / 250_000) * 100),
  );

  return (
    <aside
      className="architect-drawer architect-drawer-wide"
      data-hud-interactive="true"
      aria-label="AI Course Architect Panel"
    >
      <style>{ARCHITECT_SCOPED_STYLES}</style>

      <div className="architect-header">
        <div>
          <div className="architect-eyebrow">
            GEMINI 4 ARGON // 1M-TOKEN CONTEXT &amp; SWARM DIRECTOR
          </div>
          <h2 className="architect-title">AI COURSE ARCHITECT</h2>
        </div>
        <button type="button" className="hud-btn hud-btn-sm" onClick={onClose}>
          CLOSE [G]
        </button>
      </div>

      {/* 1M-TOKEN CONTEXT UTILIZATION METER */}
      <div className="argon-meter-card" data-testid="argon-context-meter">
        <div className="argon-meter-top">
          <span>
            <strong>1M-TOKEN WINDOW:</strong>{' '}
            {contextBundle.totalTokensPacked.toLocaleString()} / 1,000,000 TOKENS
          </span>
          <span className="text-emerald">
            95% IMPLICIT CACHE · ~${contextBundle.estimatedInputCostUsd.toFixed(3)}
          </span>
        </div>
        <div className="argon-meter-bar">
          <div
            className="argon-meter-seg-cached"
            style={{ width: `${cachedBarPct}%` }}
            title="Implicitly Cached Prefix (Contracts + SDF Kernel + Shaders + Courses)"
          />
          <div
            className="argon-meter-seg-dynamic"
            style={{ width: `${dynamicBarPct}%` }}
            title="Dynamic 120 Hz Player Telemetry & Prompt Tail"
          />
        </div>
        <div className="argon-breakdown-grid">
          {contextBundle.sections.map((sec) => (
            <div key={sec.id} className="argon-breakdown-item" title={sec.summary}>
              <span>{sec.label.split('(')[0].trim()}</span>
              <strong>{(sec.tokenCount / 1000).toFixed(1)}k tok</strong>
            </div>
          ))}
        </div>
      </div>

      {/* STATS PILLS */}
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
          <span>120HZ ARCHETYPE</span>
          <strong className="text-emerald">
            {liveTelemetry.inferredArchetype.split(' ')[0]}
          </strong>
        </div>
      </div>

      {/* OPTIONAL GEMINI API KEY BAR (NEVER COMMITTED TO GIT) */}
      <div className="argon-key-row">
        <input
          type="password"
          className="argon-key-input"
          placeholder={
            hasServerEnvKey
              ? 'Server GEMINI_API_KEY active (or override here)'
              : 'Optional: Paste GEMINI_API_KEY for live Argon API (instant 1M trace ready)'
          }
          value={userApiKey}
          onChange={(e) => setUserApiKey(e.target.value)}
          aria-label="Gemini API Key"
        />
        <span className="hud-badge hud-badge-cyan">
          {hasServerEnvKey || userApiKey.trim().length > 8
            ? 'LIVE API KEY'
            : '1M TRACE READY'}
        </span>
      </div>

      {/* NATURAL LANGUAGE PROMPT & TELEMETRY MUTATION CONTROLS */}
      <div className="architect-prompt-box">
        <label className="architect-label" htmlFor="argon-prompt-input">
          ARCHITECT PROMPT / TELEMETRY-DRIVEN LEVEL INTENT (`thinking_level: &quot;high&quot;`)
        </label>
        <textarea
          id="argon-prompt-input"
          className="architect-prompt-input"
          rows={2}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
        />
        <div className="architect-prompt-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="hud-btn hud-btn-sm"
            data-testid="btn-voice-mic"
            aria-pressed={micState === 'listening'}
            onClick={() => {
              if (micState === 'listening') voiceInput.stop();
              else voiceInput.start();
            }}
          >
            {micState === 'listening'
              ? 'MIC LIVE'
              : micState === 'unsupported'
                ? 'MIC UNAVAILABLE'
                : 'VOICE MIC'}
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-primary"
            disabled={isSynthesizing}
            data-testid="btn-analyze-mutate-run"
            onClick={() =>
              executeSwarm({
                mode: 'telemetry-mutation',
                customPrompt: `Analyze my last 120 Hz run on ${currentCourse.name} (${liveTelemetry.deathEvents.length} deaths, peak ${liveTelemetry.peakSpeed.toFixed(1)} u/s) and sculpt catch-berms, sticky brake zones, and a portal skybridge.`,
              })
            }
          >
            ANALYZE MY LAST RUN &amp; MUTATE COURSE
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-accent"
            disabled={isSynthesizing}
            data-testid="btn-run-swarm-architect"
            onClick={() => executeSwarm({ mode: 'natural-language' })}
          >
            {isSynthesizing ? 'RUNNING 3-AGENT SWARM...' : 'SYNTHESIZE WITH ARGON SWARM'}
          </button>
        </div>

        {/* 3 INSTANT SHOWCASE PRESETS */}
        <div className="architect-label" style={{ marginTop: '4px' }}>
          INSTANT 1M-TOKEN SHOWCASE SYNTHESIS TRACES:
        </div>
        <div className="argon-preset-grid">
          <button
            type="button"
            className="hud-btn hud-btn-sm"
            data-testid="preset-portal-fling-citadel"
            onClick={() =>
              executeSwarm({
                mode: 'preset',
                presetId: 'portal-fling-citadel',
                customPrompt: ARGON_SYNTHESIS_PRESETS['portal-fling-citadel'].prompt,
              })
            }
          >
            PORTAL FLING CITADEL
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-sm"
            data-testid="preset-ferrofluid-wave-gauntlet"
            onClick={() =>
              executeSwarm({
                mode: 'preset',
                presetId: 'ferrofluid-wave-gauntlet',
                customPrompt: ARGON_SYNTHESIS_PRESETS['ferrofluid-wave-gauntlet'].prompt,
              })
            }
          >
            FERROFLUID WAVE GAUNTLET
          </button>
          <button
            type="button"
            className="hud-btn hud-btn-sm"
            data-testid="preset-adaptive-coach-remix"
            onClick={() =>
              executeSwarm({
                mode: 'preset',
                presetId: 'adaptive-coach-remix',
                customPrompt: ARGON_SYNTHESIS_PRESETS['adaptive-coach-remix'].prompt,
              })
            }
          >
            ADAPTIVE COACH REMIX
          </button>
        </div>
      </div>

      {/* HUMAN-IN-THE-LOOP PREVIEW & APPROVE CARD */}
      {pendingProposal && (
        <div className="argon-hitl-card" data-testid="hitl-approval-card">
          <div className="argon-agent-header">
            <span className="text-emerald">
              HUMAN-IN-THE-LOOP GATE // READY TO HOT-SWAP: {pendingProposal.proposedCourse.name}
            </span>
            <span className="hud-badge hud-badge-cyan">
              {pendingProposal.solvability.passed ? 'GATE PASSED' : 'REPAIRED'}
            </span>
          </div>
          <div
            data-testid="antigravity-sandbox-badge"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ffd29a' }}
          >
            Antigravity Sandbox Verifier (`{pendingProposal.antigravitySandbox.agent}`):{' '}
            {pendingProposal.antigravitySandbox.verdict} · {pendingProposal.antigravitySandbox.source}{' '}
            · env {pendingProposal.antigravitySandbox.environment}
          </div>
          <pre className="argon-trace-pre" data-testid="antigravity-verification-trace">
            {pendingProposal.antigravitySandbox.verificationTrace.join('\n')}
          </pre>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#d8f3ff' }}>
            Spawn d={pendingProposal.solvability.startDistance.toFixed(2)}m (Grounded) ·{' '}
            {pendingProposal.solvability.glslLineCount} GLSL2 /{' '}
            {pendingProposal.solvability.wgslLineCount} WGSL lines · 120 Hz Bot Rollout:{' '}
            {Math.round(pendingProposal.solvability.botRollout.progressRatio * 100)}% progress (Peak{' '}
            {pendingProposal.solvability.botRollout.peakSpeed.toFixed(1)} u/s)
          </div>
          <pre className="argon-trace-pre">{pendingProposal.reasoningTrace}</pre>
          <div className="argon-hitl-actions">
            <button
              type="button"
              className="hud-btn hud-btn-primary"
              data-testid="btn-approve-hotswap"
              onClick={handleApproveProposal}
            >
              APPROVE &amp; HOT-SWAP COURSE
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() => setPendingProposal(null)}
            >
              DISCARD PREVIEW
            </button>
          </div>
        </div>
      )}

      {approvedBanner && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--emerald-neon)',
            background: 'rgba(40, 247, 156, 0.14)',
            border: '1px solid var(--emerald-neon)',
            padding: '5px 8px',
            borderRadius: '6px',
          }}
          data-testid="approved-hotswap-banner"
        >
          {approvedBanner}
        </div>
      )}

      {/* TABS */}
      <div className="architect-tabs">
        <button
          type="button"
          className={`architect-tab ${activeTab === 'swarm' ? 'active' : ''}`}
          onClick={() => setActiveTab('swarm')}
        >
          Swarm &amp; CSG
        </button>
        <button
          type="button"
          className="architect-tab"
          data-testid="tab-how-it-works"
          onClick={() => setDiagramOpen(true)}
        >
          How It Works / 1M Diagram
        </button>
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

      {activeTab === 'swarm' ? (
        <div className="argon-swarm-box" data-testid="parallel-swarm-status">
          <div className="architect-label">
            PARALLEL MULTI-AGENT SWARM ORCHESTRATOR STATUS:
          </div>
          <div className="argon-agent-row agent-gate" data-testid="antigravity-standby-badge">
            <div className="argon-agent-header">
              <span>Antigravity Sandbox Verifier (antigravity-preview-09-2026)</span>
              <span className="text-emerald">
                {pendingProposal
                  ? `${pendingProposal.antigravitySandbox.verdict} · ${pendingProposal.antigravitySandbox.status.toUpperCase()}`
                  : 'READY'}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              {pendingProposal
                ? pendingProposal.antigravitySandbox.verificationTrace[0]
                : 'Remote sandbox (environment remote, background true, model gemini-4-argon) signs the certificate before you approve.'}
            </div>
          </div>
          {callout && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#ffd23f' }}>
              ARCADE ANNOUNCER: {callout}
            </div>
          )}
          {swarmAgents.map((agent) => (
            <div
              key={agent.agentId}
              className={`argon-agent-row ${
                agent.agentId === 'lead-architect'
                  ? 'agent-lead'
                  : agent.agentId === 'hazard-specialist'
                    ? 'agent-flash'
                    : 'agent-gate'
              }`}
            >
              <div className="argon-agent-header">
                <span>{agent.roleTitle}</span>
                <span className="text-emerald">
                  {agent.status.toUpperCase()} ({agent.latencyMs}ms)
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>{agent.summary}</div>
            </div>
          ))}

          <div className="architect-label" style={{ marginTop: '4px' }}>
            REALTIME CSG FIELD MUTATIONS (PREVIEW &amp; HOT-SCULPT ACTIVE COURSE):
          </div>
          <div className="argon-csg-grid">
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() =>
                executeSwarm({
                  mode: 'realtime-csg',
                  csgMutationKind: 'ferrofluid-skybridge',
                  customPrompt: 'Extrude Ferrofluid Skybridge across active course chasm',
                })
              }
            >
              + FERROFLUID SKYBRIDGE
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() =>
                executeSwarm({
                  mode: 'realtime-csg',
                  csgMutationKind: 'tectonic-pop-ramp',
                  customPrompt: 'Erupt Tectonic Pop-Ramp bounce wedge at course midpoint',
                })
              }
            >
              + TECTONIC POP-RAMP
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() =>
                executeSwarm({
                  mode: 'realtime-csg',
                  csgMutationKind: 'cryo-freeze-acid',
                  customPrompt: 'Detonate Cryo-Phase Bomb to freeze Acid into Ice rink',
                })
              }
            >
              + CRYO-FREEZE ACID
            </button>
            <button
              type="button"
              className="hud-btn hud-btn-sm"
              onClick={() =>
                executeSwarm({
                  mode: 'realtime-csg',
                  csgMutationKind: 'portal-fling-pair',
                  customPrompt: 'Spawn linked Blue/Orange SDF Portal Fling pair',
                })
              }
            >
              + PORTAL FLING PAIR
            </button>
          </div>

          <div className="architect-label" style={{ marginTop: '4px' }}>
            120 HZ TELEMETRY DIAGNOSIS ({liveTelemetry.totalFramesRecorded} FRAMES ·{' '}
            {liveTelemetry.deathEvents.length} DEATHS · PEAK {liveTelemetry.peakSpeed.toFixed(1)} U/S):
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9.5px', color: '#b9d8f8', lineHeight: 1.35 }}>
            {liveTelemetry.coachingDiagnosis}
          </div>
        </div>
      ) : activeTab === 'spec' ? (
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
              HOT-COMPILE &amp; PLAY COURSESPEC
            </button>
          </div>
        </>
      ) : (
        <pre className="architect-code-readonly">
          {activeTab === 'glsl' ? compiledShaders.glsl : compiledShaders.wgsl}
        </pre>
      )}

      <ArchitectureDiagramModal
        open={diagramOpen}
        onClose={() => setDiagramOpen(false)}
        stats={{
          totalTokens: contextBundle.totalTokensPacked,
          cachedTokens: contextBundle.cachedPrefixTokens,
          dynamicTokens: contextBundle.dynamicTailTokens,
          courseName: currentCourse.name,
        }}
      />
    </aside>
  );
};
