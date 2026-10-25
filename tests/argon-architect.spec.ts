import { describe, expect, it } from 'vitest';
import {
  ANTIGRAVITY_AGENT_ID,
  ARGON_SYNTHESIS_PRESETS,
  COURSE_ADAPTIVE_COACH_REMIX,
  COURSE_FERROFLUID_WAVE_GAUNTLET,
  COURSE_PORTAL_FLING_CITADEL,
  applyRealtimeCsgMutationToCourse,
  buildAntigravityInteractionsPayload,
  buildArchitectureDiagramHtml,
  buildDefaultTelemetryForCourse,
  composeArcadeCallout,
  createLiveTelemetryTracker,
  dispatchAntigravitySandboxOnServer,
  inferPresetFromPrompt,
  mutateCourseFromTelemetry,
  packArgon1MContext,
  runArgonSwarmArchitect,
  validateCourseSpecSchema,
  verifyCourseSpecSolvability,
} from '../src/argon';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
} from '../src/courses';
import { executeServerArgonSwarm, synthesizeArcadeSpeech } from '../server/argon-proxy';

describe('Stage 2 Workstream 4 — Gemini 4 Argon 1M-Token Live Course Architect & Multi-Agent Swarm', () => {
  it('packs the 1M-token context bundle with exact section token telemetry and 95% implicit caching', () => {
    const telemetry = buildDefaultTelemetryForCourse(COURSE_1_PRACTICE_RACE);
    const bundle = packArgon1MContext({
      currentCourse: COURSE_1_PRACTICE_RACE,
      telemetry,
      userPrompt: 'Synthesize Portal Fling Citadel with synchronized SDF pistons.',
      spatialLatticeSamples: 64,
    });

    expect(bundle.modelId).toBe('gemini-4-argon');
    expect(bundle.companionModelId).toBe('gemini-3.8-flash');
    expect(bundle.verifierAgentId).toBe('antigravity-preview-09-2026');
    expect(bundle.thinkingLevel).toBe('high');
    expect(bundle.contextWindowLimit).toBe(1_000_000);
    expect(bundle.implicitCacheDiscountRatio).toBe(0.95);
    expect(bundle.spatialSdfSampleCount).toBe(64);

    expect(bundle.sections).toHaveLength(6);
    const sectionIds = bundle.sections.map((s) => s.id);
    expect(sectionIds).toEqual([
      'engineContracts',
      'sdfEvaluatorAndPhysics',
      'glslWgslCompilers',
      'courseCatalogAndSpatialAtlas',
      'gameplayFeelBible',
      'playerTelemetry120Hz',
    ]);

    expect(bundle.totalTokensPacked).toBe(
      bundle.cachedPrefixTokens + bundle.dynamicTailTokens,
    );
    expect(bundle.totalTokensPacked).toBeGreaterThan(50_000);
    expect(bundle.totalTokensPacked).toBeLessThan(1_000_000);
    expect(bundle.estimatedInputCostUsd).toBeGreaterThan(0);
    expect(bundle.fullPromptText).toContain('evalCourseWorldRaw');
    expect(bundle.fullPromptText).toContain('High-Speed Chute Daredevil');
  });

  it('records live 120 Hz player telemetry frames, death coordinates, and slip/brake spikes', () => {
    const tracker = createLiveTelemetryTracker();

    // Simulate 80 snapshots (320 physics frames) rolling, slipping on ice, and falling
    for (let i = 0; i < 80; i++) {
      const isIce = i >= 30 && i <= 45;
      const isDeathFrame = i === 65;
      tracker.recordSnapshot(
        COURSE_2_INTERMEDIATE_MADNESS,
        [i * 0.25, 8.5 - i * 0.08, -i * 0.45],
        [6.0, -1.2, -19.5],
        isDeathFrame ? 'shattered' : 'racing',
        isIce ? 'ice' : 'standard',
        !isDeathFrame,
        60 - i * 0.2,
      );
    }

    const summary = tracker.getSummary(COURSE_2_INTERMEDIATE_MADNESS);
    expect(summary.sampleRateHz).toBe(120);
    expect(summary.totalFramesRecorded).toBeGreaterThanOrEqual(320);
    expect(summary.peakSpeed).toBeGreaterThan(20.0);
    expect(summary.deathEvents.length).toBeGreaterThanOrEqual(1);
    expect(summary.deathEvents[0].cause).toBe('shattered');
    expect(summary.slipBrakeHeatmap.length).toBeGreaterThanOrEqual(1);
    expect(summary.inferredArchetype).toBe('High-Speed Chute Daredevil');
  });

  it('validates CourseSpec schema and auto-repairs ungrounded spawn heights in Agent 3 Solvability Gate', () => {
    const invalidCheck = validateCourseSpecSchema({
      id: '',
      name: 'Broken Course',
      nodes: [],
    });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors.length).toBeGreaterThan(0);

    // Deliberately offset startPos Y by +1.8m above the Start Pad to test automatic spawn height snap repair
    const slightlyFloatingCourse = {
      ...COURSE_1_PRACTICE_RACE,
      startPos: [
        COURSE_1_PRACTICE_RACE.startPos[0],
        COURSE_1_PRACTICE_RACE.startPos[1] + 1.8,
        COURSE_1_PRACTICE_RACE.startPos[2],
      ] as const,
    };

    const report = verifyCourseSpecSolvability(slightlyFloatingCourse);
    expect(report.schemaValid).toBe(true);
    expect(report.startGrounded).toBe(true);
    expect(report.startHeightRepaired).toBe(true);
    expect(report.verifiedCourse.startPos[1]).toBeCloseTo(
      COURSE_1_PRACTICE_RACE.startPos[1],
      1,
    );
    expect(report.shaderCompilePassed).toBe(true);
    expect(report.passed).toBe(true);
  });

  it('verifies all 3 showcase Argon 1M presets pass CPU SDF solvability, GLSL/WGSL compilation, and 120 Hz bot rollout', () => {
    const showcaseCourses = [
      COURSE_PORTAL_FLING_CITADEL,
      COURSE_FERROFLUID_WAVE_GAUNTLET,
      COURSE_ADAPTIVE_COACH_REMIX,
    ];

    for (const course of showcaseCourses) {
      const gate = verifyCourseSpecSolvability(course);
      expect(gate.schemaValid).toBe(true);
      expect(gate.startGrounded).toBe(true);
      expect(gate.goalReachable).toBe(true);
      expect(gate.shaderCompilePassed).toBe(true);
      expect(gate.glslLineCount).toBeGreaterThan(200);
      expect(gate.wgslLineCount).toBeGreaterThan(150);
      expect(gate.botRollout.settledOnStart).toBe(true);
      expect(gate.botRollout.progressRatio).toBeGreaterThan(0.25);
      expect(gate.passed).toBe(true);
    }
  });

  it('orchestrates the 3-Agent Swarm for presets, telemetry mutation, and realtime CSG sculpting with Human-in-the-Loop gating', async () => {
    const telemetry = buildDefaultTelemetryForCourse(COURSE_1_PRACTICE_RACE);

    // 1. Preset Synthesis ("Portal Fling Citadel")
    const progressCalls: number[] = [];
    const presetProposal = await runArgonSwarmArchitect({
      mode: 'preset',
      presetId: 'portal-fling-citadel',
      prompt: ARGON_SYNTHESIS_PRESETS['portal-fling-citadel'].prompt,
      currentCourse: COURSE_1_PRACTICE_RACE,
      telemetry,
      onProgress: (agents) => progressCalls.push(agents.length),
    });

    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    expect(presetProposal.requiresHumanApproval).toBe(true);
    expect(presetProposal.proposedCourse.id).toBe('portal-fling-citadel');
    expect(presetProposal.swarmAgents).toHaveLength(3);
    expect(presetProposal.swarmAgents[0].modelOrEngine).toBe('gemini-4-argon');
    expect(presetProposal.swarmAgents[1].modelOrEngine).toBe('gemini-3.8-flash');
    expect(presetProposal.swarmAgents[2].modelOrEngine).toBe('cpu-sdf-120hz-gate');
    expect(presetProposal.solvability.passed).toBe(true);
    expect(presetProposal.antigravitySandbox.agent).toBe('antigravity-preview-09-2026');
    expect(presetProposal.antigravitySandbox.environment).toBe('remote');
    expect(presetProposal.antigravitySandbox.background).toBe(true);
    expect(presetProposal.antigravitySandbox.verdict).toBe('PASS');

    // 2. Telemetry-Driven Course Mutation ("Analyze My Last Run & Mutate Course")
    const mutated = mutateCourseFromTelemetry(COURSE_1_PRACTICE_RACE, telemetry);
    expect(mutated.mutatedCourse.nodes.length).toBeGreaterThan(
      COURSE_1_PRACTICE_RACE.nodes.length,
    );
    expect(mutated.mutationsApplied.length).toBeGreaterThanOrEqual(3);

    const telemetryProposal = await runArgonSwarmArchitect({
      mode: 'telemetry-mutation',
      prompt: 'Analyze my last run and mutate course',
      currentCourse: COURSE_1_PRACTICE_RACE,
      telemetry,
    });
    expect(telemetryProposal.executionSource).toBe('telemetry-coach-mutator');
    expect(telemetryProposal.solvability.passed).toBe(true);

    // 3. Realtime CSG Sculpting (all 4 operations)
    for (const csgKind of [
      'ferrofluid-skybridge',
      'tectonic-pop-ramp',
      'cryo-freeze-acid',
      'portal-fling-pair',
    ] as const) {
      const csgResult = applyRealtimeCsgMutationToCourse(
        COURSE_2_INTERMEDIATE_MADNESS,
        csgKind,
      );
      const gate = verifyCourseSpecSolvability(csgResult.mutatedCourse);
      expect(gate.passed).toBe(true);
    }

    // 4. Keyword routing for natural language prompts
    expect(inferPresetFromPrompt('Add ferrofluid wave floor and acid moat')).toBe(
      'ferrofluid-wave-gauntlet',
    );
    expect(inferPresetFromPrompt('Coach my telemetry death heatmap and berms')).toBe(
      'adaptive-coach-remix',
    );
    expect(inferPresetFromPrompt('Build a non-euclidean portal fling citadel')).toBe(
      'portal-fling-citadel',
    );
  });

  it('executes live parallel Gemini 4 Argon (thinking_level: high) + Gemini 3.8 Flash API calls when GEMINI_API_KEY is supplied', async () => {
    const calledUrls: string[] = [];
    const calledBodies: string[] = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      calledUrls.push(url);
      if (init?.body) {
        calledBodies.push(String(init.body));
      }

      if (url.includes('interactions')) {
        return new Response(
          JSON.stringify({
            id: 'int_live_argon_test_99',
            output_text: JSON.stringify({
              reasoningTrace:
                'Live Gemini 4 Argon (thinking_level: high) synthesized custom course from 1M context.',
              course: COURSE_PORTAL_FLING_CITADEL,
            }),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Parallel Gemini 3.8 Flash hazard specialist call
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: 'Gemini 3.8 Flash added synchronized bonus Steelie hazard.',
                      hazards: [
                        {
                          id: 'live-flash-steelie',
                          kind: 'sphere',
                          material: 'bumper',
                          center: [2.4, 7.6, -15.2],
                          radius: 0.6,
                          kinematic: {
                            kind: 'steelie',
                            mode: 'orbit',
                            span: [1.8, 0, 1.8],
                            frequency: 0.45,
                            phase: 0,
                          },
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const serverRes = await executeServerArgonSwarm(
      {
        prompt: 'Create a custom portal fling course',
        mode: 'swarm-synthesizer',
        systemInstruction: 'System instruction',
        cachedPrefixPrompt: 'Cached prefix',
        dynamicTelemetryPrompt: 'Dynamic telemetry',
        previousInteractionId: 'int_prev_01',
        apiKey: 'test-ephemeral-key-do-not-commit',
      },
      undefined,
      mockFetch,
    );

    expect(serverRes.ok).toBe(true);
    expect(serverRes.source).toBe('live-gemini-api');
    expect(serverRes.interactionId).toBe('int_live_argon_test_99');
    expect(calledUrls.length).toBe(2); // Agent 1 (Argon) + Agent 2 (Flash) in parallel
    expect(calledBodies[0]).toContain('"thinking_level":"high"');
    expect(calledBodies[0]).toContain('"previous_interaction_id":"int_prev_01"');
    expect(serverRes.course?.hazards.some((h) => h.id === 'live-flash-steelie')).toBe(
      true,
    );

    // Verify the merged live course passes Agent 3 Solvability Gate
    const liveGate = verifyCourseSpecSolvability(serverRes.course!);
    expect(liveGate.passed).toBe(true);
  });

  it('dispatches the Antigravity managed agent, speaks a one-line callout, and draws the 1M diagram', async () => {
    const telemetry = buildDefaultTelemetryForCourse(COURSE_1_PRACTICE_RACE);
    const gate = verifyCourseSpecSolvability(COURSE_PORTAL_FLING_CITADEL);
    const payload = buildAntigravityInteractionsPayload({
      prompt: 'Verify Portal Fling Citadel',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      previousInteractionId: 'int_prev_agy',
    });
    expect(payload.agent).toBe(ANTIGRAVITY_AGENT_ID);
    expect(payload.background).toBe(true);
    expect(JSON.stringify(payload)).toContain('"environment":"remote"');
    expect(JSON.stringify(payload)).not.toContain('temperature');
    expect(JSON.stringify(payload)).not.toContain('thinking_budget');

    const posted: string[] = [];
    const certificate = await dispatchAntigravitySandboxOnServer({
      prompt: 'Verify Portal Fling Citadel',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      apiKey: 'stage-key',
      fetchFn: async (_url, init) => {
        posted.push(String(init?.body ?? ''));
        return new Response(
          JSON.stringify({ id: 'agy_job_7', status: 'queued', output_text: '' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    expect(certificate.source).toBe('live-managed-agent');
    expect(certificate.status).toBe('queued');
    expect(certificate.model).toBe('gemini-4-argon');
    expect(posted[0]).toContain('antigravity-preview-09-2026');

    const callout = composeArcadeCallout({
      event: 'analyze-run',
      courseName: 'PRACTICE RACE',
      peakSpeed: telemetry.peakSpeed,
    });
    expect(callout.split(/[.!?]/).filter((part) => part.trim()).length).toBe(1);
    expect(callout.length).toBeLessThan(220);

    const tts = await synthesizeArcadeSpeech('High roller!', 'stage-key', async () => {
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    expect(tts.ok).toBe(true);
    expect(tts.source).toBe('gemini-3.8-flash-tts');
    expect(tts.mimeType).toBe('audio/wav');

    const html = buildArchitectureDiagramHtml({
      totalTokens: 164820,
      cachedTokens: 148400,
      dynamicTokens: 16420,
      courseName: 'PRACTICE RACE',
    });
    expect(html).toContain('gemini-4-argon');
    expect(html).toContain('gemini-3.8-flash');
    expect(html).toContain('antigravity-preview-09-2026');
    expect(html).toContain('.msdf RPN');
    expect(html).toContain('120 Hz');
    expect(html).toContain('<script>');
  });
});
