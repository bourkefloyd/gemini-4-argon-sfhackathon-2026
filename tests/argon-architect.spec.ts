import { describe, expect, it } from 'vitest';
import {
  ANTIGRAVITY_AGENT_ID,
  ANTIGRAVITY_REPO_URL,
  ARGON_SYNTHESIS_PRESETS,
  COURSE_ADAPTIVE_COACH_REMIX,
  COURSE_FERROFLUID_WAVE_GAUNTLET,
  COURSE_PORTAL_FLING_CITADEL,
  MAX_COURSE_NODES,
  applyRealtimeCsgMutationToCourse,
  buildAntigravityInteractionsPayload,
  buildArchitectureDiagramHtml,
  buildDefaultTelemetryForCourse,
  buildInitialIdleSwarmAgents,
  clampCourseNodesToBudget,
  composeArcadeCallout,
  createLiveTelemetryTracker,
  dispatchAntigravitySandboxOnServer,
  hashCourseSpec,
  inferPresetFromPrompt,
  isRealServerInteractionId,
  mutateCourseFromTelemetry,
  packArgon1MContext,
  pollAntigravitySandboxOnServer,
  reconcileContextBundleWithUsageMetadata,
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
  it('packs the context bundle with honest chars/3.85 token estimates (zero artificial multipliers) and reconciles live usageMetadata', () => {
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
    expect(bundle.tokenEstimationMethod).toBe('chars/4');
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
    // Codex F3: Verify honest token estimate (Math.ceil(charCount / 3.85)) without 6.2x-18.5x inflation
    for (const sec of bundle.sections) {
      expect(sec.tokenCount).toBe(Math.max(1, Math.ceil(sec.charCount / 3.85)));
    }
    expect(bundle.totalTokensPacked).toBeGreaterThan(10_000);
    expect(bundle.totalTokensPacked).toBeLessThan(100_000);
    expect(bundle.estimatedInputCostUsd).toBeGreaterThan(0);
    expect(bundle.fullPromptText).toContain('evalCourseWorldRaw');
    expect(bundle.fullPromptText).toContain('High-Speed Chute Daredevil');

    // Reconcile with Google usageMetadata when live
    const reconciled = reconcileContextBundleWithUsageMetadata(bundle, {
      promptTokenCount: 42_500,
      candidatesTokenCount: 3_200,
      thoughtsTokenCount: 8_100,
      cachedContentTokenCount: 38_000,
      totalTokenCount: 53_800,
    });
    expect(reconciled.totalTokensPacked).toBe(42_500);
    expect(reconciled.cachedPrefixTokens).toBe(38_000);
    expect(reconciled.dynamicTailTokens).toBe(4_500);
    expect(reconciled.liveUsageMetadata?.totalTokenCount).toBe(53_800);
  });

  it('Codex F3: records honest stationary vs moving telemetry (0 deaths and 0 speed when stationary, real frames only)', () => {
    const tracker = createLiveTelemetryTracker();

    // Before any frames are recorded: 0 frames, 0 deaths, 0 speed
    const emptySummary = tracker.getSummary(COURSE_1_PRACTICE_RACE);
    expect(emptySummary.totalFramesRecorded).toBe(0);
    expect(emptySummary.deathEvents).toHaveLength(0);
    expect(emptySummary.peakSpeed).toBe(0);

    // 80 stationary samples with 0 deaths -> must report 80 frames, 0 deaths, 0.0 u/s peak!
    for (let i = 0; i < 80; i++) {
      tracker.recordSnapshot(
        COURSE_1_PRACTICE_RACE,
        COURSE_1_PRACTICE_RACE.startPos,
        [0, 0, 0],
        'racing',
        'start',
        true,
        60,
      );
    }
    const stationarySummary = tracker.getSummary(COURSE_1_PRACTICE_RACE);
    expect(stationarySummary.totalFramesRecorded).toBe(80);
    expect(stationarySummary.deathEvents).toHaveLength(0);
    expect(stationarySummary.peakSpeed).toBe(0);
    expect(stationarySummary.averageSpeed).toBe(0);

    // Reset and simulate 80 moving snapshots with 1 real shatter death
    tracker.reset();
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

    const movingSummary = tracker.getSummary(COURSE_2_INTERMEDIATE_MADNESS);
    expect(movingSummary.sampleRateHz).toBe(120);
    expect(movingSummary.totalFramesRecorded).toBe(80);
    expect(movingSummary.peakSpeed).toBeGreaterThan(20.0);
    expect(movingSummary.deathEvents).toHaveLength(1);
    expect(movingSummary.deathEvents[0].cause).toBe('shattered');
    expect(movingSummary.slipBrakeHeatmap.length).toBeGreaterThanOrEqual(1);
    expect(movingSummary.inferredArchetype).toBe('High-Speed Chute Daredevil');

    // Initial swarm agents start as 'idle' before any call runs
    const initialAgents = buildInitialIdleSwarmAgents();
    expect(initialAgents.every((a) => a.status === 'idle')).toBe(true);
  });

  it('Codex F2: recursively validates discriminated primitives, clamps >32 nodes, rejects disconnected courses, and auto-repairs spawn height', () => {
    const invalidCheck = validateCourseSpecSchema({
      id: '',
      name: 'Broken Course',
      nodes: [],
    });
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors.length).toBeGreaterThan(0);

    // Box missing halfExtents must fail schema validation (never throw TypeError at evaluation time)
    const missingHalfExtentsCourse = {
      ...COURSE_1_PRACTICE_RACE,
      nodes: [
        {
          id: 'bad-box',
          kind: 'box',
          material: 'standard',
          center: [0, 0, 0],
        } as unknown as (typeof COURSE_1_PRACTICE_RACE.nodes)[number],
      ],
    };
    const boxSchema = validateCourseSpecSchema(missingHalfExtentsCourse);
    expect(boxSchema.valid).toBe(false);
    expect(boxSchema.errors.some((e) => e.includes('halfExtents'))).toBe(true);
    const badGate = verifyCourseSpecSolvability(missingHalfExtentsCourse);
    expect(badGate.passed).toBe(false);
    expect(badGate.schemaValid).toBe(false);

    // Disconnected course that only gets 35% of the way to Goal before falling must FAIL solvability gate!
    const disconnectedCourse = {
      ...COURSE_1_PRACTICE_RACE,
      nodes: COURSE_1_PRACTICE_RACE.nodes.slice(0, 4), // Only start podium + first ramp, huge chasm before goal
    };
    const disconnectedReport = verifyCourseSpecSolvability(disconnectedCourse);
    expect(disconnectedReport.botRollout.reachedGoal).toBe(false);
    expect(disconnectedReport.passed).toBe(false);

    // Node clamping: course with 40 nodes is clamped to MAX_COURSE_NODES = 32
    const bloatedCourse = {
      ...COURSE_ADAPTIVE_COACH_REMIX,
      nodes: [
        ...COURSE_ADAPTIVE_COACH_REMIX.nodes,
        ...Array.from({ length: 30 }, (_, idx) => ({
          id: `extra- filler-${idx}`,
          kind: 'sphere' as const,
          material: 'standard' as const,
          center: [-20 - idx * 2, -5, 10] as const,
          radius: 0.5,
        })),
      ],
    };
    const clamped = clampCourseNodesToBudget(bloatedCourse, MAX_COURSE_NODES);
    expect(clamped.clamped).toBe(true);
    expect(clamped.clampedCount).toBeLessThanOrEqual(MAX_COURSE_NODES);

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
    expect(report.botRollout.reachedGoal).toBe(true);
    expect(report.passed).toBe(true);
  });

  it('verifies all 3 showcase Argon presets pass CPU SDF solvability, GLSL/WGSL compilation, and 100% 120 Hz goal rollout', () => {
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
      expect(gate.botRollout.reachedGoal).toBe(true);
      expect(gate.botRollout.progressRatio).toBe(1);
      expect(gate.passed).toBe(true);
    }
  });

  it('loads offline presets with zero network fetch calls, and runs telemetry mutation & realtime CSG sculpting', async () => {
    const telemetry = buildDefaultTelemetryForCourse(COURSE_1_PRACTICE_RACE);

    // 1. Offline Preset Synthesis ("Portal Fling Citadel") -> MUST make ZERO network fetch calls!
    let fetchCallCount = 0;
    const forbiddenFetch: typeof fetch = async () => {
      fetchCallCount++;
      throw new Error('Offline preset should never call fetch!');
    };

    const presetProposal = await runArgonSwarmArchitect({
      mode: 'preset',
      presetId: 'portal-fling-citadel',
      prompt: ARGON_SYNTHESIS_PRESETS['portal-fling-citadel'].prompt,
      currentCourse: COURSE_1_PRACTICE_RACE,
      telemetry,
      fetchFn: forbiddenFetch,
    });

    expect(fetchCallCount).toBe(0);
    expect(presetProposal.executionSource).toBe('offline-preset');
    expect(presetProposal.requiresHumanApproval).toBe(true);
    expect(presetProposal.proposedCourse.id).toBe('portal-fling-citadel');
    expect(presetProposal.solvability.passed).toBe(true);
    expect(presetProposal.antigravitySandbox.courseHash).toBe(
      hashCourseSpec(presetProposal.proposedCourse),
    );

    // Preset interaction IDs must never be treated as real server interaction IDs
    expect(isRealServerInteractionId(presetProposal.interactionId)).toBe(false);
    expect(isRealServerInteractionId('preset-portal-citadel')).toBe(false);
    expect(isRealServerInteractionId('int_live_argon_99')).toBe(true);

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
    expect(telemetryProposal.executionSource).toBe('offline-preset');
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

  it('executes live parallel Gemini 4 Argon + Gemini 3.8 Flash API calls and runs the 3-Try Autonomous Self-Repair Loop on broken courses', async () => {
    const telemetry = buildDefaultTelemetryForCourse(COURSE_1_PRACTICE_RACE);
    let argonAttemptCount = 0;
    const receivedBodies: Record<string, unknown>[] = [];

    // Mock server endpoint `/api/argon/synthesize` where Attempt 1 returns a broken course (missing halfExtents),
    // Attempt 2 returns a disconnected course, and Attempt 3 returns a repaired solvable course!
    const selfRepairMockFetch: typeof fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/argon/antigravity')) {
        return new Response(
          JSON.stringify({
            agent: ANTIGRAVITY_AGENT_ID,
            model: 'gemini-4-argon',
            environment: 'remote',
            background: true,
            source: 'live-managed-agent',
            interactionId: 'agy_live_verified_03',
            status: 'passed',
            passed: true,
            verdict: 'PASS',
            courseHash: hashCourseSpec(COURSE_PORTAL_FLING_CITADEL),
            repoUrl: ANTIGRAVITY_REPO_URL,
            commitSha: 'e5c00a1',
            verificationTrace: ['Remote sandbox verified PASS'],
            latencyMs: 95,
            networkAllowlist: ['api.github.com', 'generativelanguage.googleapis.com'],
            courseId: COURSE_PORTAL_FLING_CITADEL.id,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      argonAttemptCount++;
      const parsedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      receivedBodies.push(parsedBody);

      if (argonAttemptCount === 1) {
        // Attempt 1: Return a course with a broken box node (missing halfExtents)
        return new Response(
          JSON.stringify({
            ok: true,
            source: 'live-gemini-api',
            executionSource: 'live-interactions-api',
            interactionId: 'int_live_turn_1',
            reasoningTrace: 'Attempt 1 initial synthesis',
            usageMetadata: {
              promptTokenCount: 38_400,
              candidatesTokenCount: 2_100,
              totalTokenCount: 40_500,
            },
            course: {
              ...COURSE_PORTAL_FLING_CITADEL,
              nodes: [
                {
                  id: 'broken-box-node',
                  kind: 'box',
                  material: 'standard',
                  center: [0, 0, 0],
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (argonAttemptCount === 2) {
        // Attempt 2: Return a schema-valid but disconnected course
        return new Response(
          JSON.stringify({
            ok: true,
            source: 'live-gemini-api',
            executionSource: 'live-interactions-api',
            interactionId: 'int_live_turn_2',
            reasoningTrace: 'Attempt 2 fixed schema but left chasm',
            usageMetadata: {
              promptTokenCount: 39_100,
              candidatesTokenCount: 2_400,
              totalTokenCount: 41_500,
            },
            course: {
              ...COURSE_1_PRACTICE_RACE,
              nodes: COURSE_1_PRACTICE_RACE.nodes.slice(0, 3),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Attempt 3: Return the fully repaired solvable course
      return new Response(
        JSON.stringify({
          ok: true,
          source: 'live-gemini-api',
          executionSource: 'live-interactions-api',
          interactionId: 'int_live_turn_3',
          reasoningTrace: 'Attempt 3 bridged chasm and passed 120 Hz rollout',
          usageMetadata: {
            promptTokenCount: 40_200,
            candidatesTokenCount: 2_800,
            thoughtsTokenCount: 6_500,
            totalTokenCount: 49_500,
          },
          course: COURSE_PORTAL_FLING_CITADEL,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const proposal = await runArgonSwarmArchitect({
      mode: 'natural-language',
      prompt: 'Synthesize Portal Fling Citadel',
      currentCourse: COURSE_1_PRACTICE_RACE,
      telemetry,
      previousInteractionId: 'preset-portal-citadel', // Preset ID must NOT be chained on Attempt 1!
      apiKey: 'test-live-key',
      fetchFn: selfRepairMockFetch,
    });

    expect(argonAttemptCount).toBe(3);
    expect(proposal.executionSource).toBe('live-interactions-api');
    expect(proposal.repairAttempts).toHaveLength(3);
    expect(proposal.repairAttempts[0].passed).toBe(false);
    expect(proposal.repairAttempts[0].previousInteractionId).toBeNull();
    expect(proposal.repairAttempts[1].passed).toBe(false);
    expect(proposal.repairAttempts[1].previousInteractionId).toBe('int_live_turn_1');
    expect(proposal.repairAttempts[2].passed).toBe(true);
    expect(proposal.repairAttempts[2].previousInteractionId).toBe('int_live_turn_2');
    expect(receivedBodies[0].previousInteractionId).toBeNull();
    expect(receivedBodies[1].previousInteractionId).toBe('int_live_turn_1');
    expect(receivedBodies[2].previousInteractionId).toBe('int_live_turn_2');
    expect(proposal.solvability.passed).toBe(true);
    expect(proposal.usageMetadata?.totalTokenCount).toBe(49_500);
  });

  it('Codex F1: preserves remote Antigravity FAIL and pending states, binds courseHash, and polls GET /v1beta/interactions/{id}', async () => {
    const gate = verifyCourseSpecSolvability(COURSE_PORTAL_FLING_CITADEL);
    const payload = buildAntigravityInteractionsPayload({
      prompt: 'Verify Portal Fling Citadel',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      previousInteractionId: 'int_prev_agy',
    });
    expect(payload.agent).toBe(ANTIGRAVITY_AGENT_ID);
    expect(payload.background).toBe(true);
    expect(JSON.stringify(payload)).toContain(ANTIGRAVITY_REPO_URL);
    expect(JSON.stringify(payload)).toContain(hashCourseSpec(COURSE_PORTAL_FLING_CITADEL));
    expect(JSON.stringify(payload)).not.toContain('temperature');
    expect(JSON.stringify(payload)).not.toContain('thinking_budget');

    // 1. Remote queued/in_progress response MUST produce status: 'pending', passed: false, verdict: 'PENDING'
    const pendingCert = await dispatchAntigravitySandboxOnServer({
      prompt: 'Verify Portal Fling Citadel',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      apiKey: 'stage-key',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ id: 'agy_job_pending_1', status: 'in_progress', output_text: '' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    expect(pendingCert.source).toBe('live-managed-agent');
    expect(pendingCert.status).toBe('pending');
    expect(pendingCert.verdict).toBe('PENDING');
    expect(pendingCert.passed).toBe(false);

    // 2. Remote completed response with verdict: "FAIL" MUST produce status: 'failed', passed: false, verdict: 'FAIL'
    const failedCert = await dispatchAntigravitySandboxOnServer({
      prompt: 'Verify Portal Fling Citadel',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      apiKey: 'stage-key',
      fetchFn: async () =>
        new Response(
          JSON.stringify({
            id: 'agy_job_fail_2',
            status: 'completed',
            output_text: '{"verdict":"FAIL","trace":["Bot fell off at z=-22"]}',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    expect(failedCert.source).toBe('live-managed-agent');
    expect(failedCert.status).toBe('failed');
    expect(failedCert.verdict).toBe('FAIL');
    expect(failedCert.passed).toBe(false);

    // 3. Polling GET /v1beta/interactions/{id} when remote finishes with PASS -> status: 'passed', passed: true
    const polledCert = await pollAntigravitySandboxOnServer({
      interactionId: 'agy_job_pending_1',
      course: COURSE_PORTAL_FLING_CITADEL,
      solvability: gate,
      apiKey: 'stage-key',
      fetchFn: async (url) => {
        expect(String(url)).toContain('/v1beta/interactions/agy_job_pending_1');
        return new Response(
          JSON.stringify({
            id: 'agy_job_pending_1',
            status: 'completed',
            output_text: '{"verdict":"PASS","trace":["120 Hz rollout reached goal"]}',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    expect(polledCert.status).toBe('passed');
    expect(polledCert.verdict).toBe('PASS');
    expect(polledCert.passed).toBe(true);
    expect(polledCert.courseHash).toBe(hashCourseSpec(COURSE_PORTAL_FLING_CITADEL));

    // Also verify server proxy executeServerArgonSwarm forwards usageMetadata and live-interactions-api
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
      async (input) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.includes('interactions')) {
          return new Response(
            JSON.stringify({
              id: 'int_live_argon_test_99',
              usageMetadata: {
                promptTokenCount: 35_000,
                candidatesTokenCount: 2_500,
                totalTokenCount: 37_500,
              },
              output_text: JSON.stringify({
                reasoningTrace: 'Live Gemini 4 Argon synthesized course.',
                course: COURSE_PORTAL_FLING_CITADEL,
              }),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        summary: 'Added Steelie hazard.',
                        hazards: [],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    );
    expect(serverRes.ok).toBe(true);
    expect(serverRes.executionSource).toBe('live-interactions-api');
    expect(serverRes.usageMetadata?.totalTokenCount).toBe(37_500);

    const callout = composeArcadeCallout({
      event: 'analyze-run',
      courseName: 'PRACTICE RACE',
      peakSpeed: 22.4,
    });
    expect(callout.split(/[.!?]/).filter((part) => part.trim()).length).toBe(1);

    const tts = await synthesizeArcadeSpeech('High roller!', 'stage-key', async () =>
      new Response(
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
      ),
    );
    expect(tts.ok).toBe(true);
    expect(tts.source).toBe('gemini-3.8-flash-tts');

    const html = buildArchitectureDiagramHtml({
      totalTokens: 35000,
      cachedTokens: 31000,
      dynamicTokens: 4000,
      courseName: 'PRACTICE RACE',
    });
    expect(html).toContain('gemini-4-argon');
    expect(html).toContain('antigravity-preview-09-2026');
  });
});
