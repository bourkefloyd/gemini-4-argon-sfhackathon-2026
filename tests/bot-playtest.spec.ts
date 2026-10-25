import { describe, expect, it } from 'vitest';
import {
  createAutonomousDriver,
  createBotPlaytestController,
  FAN_PROBE_ANGLES_DEG,
  type PlaytestWindowHost,
  runHeadlessBotRollout,
} from '../src/bot';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
  generateArchitectCoursePreset,
} from '../src/courses';
import { createMarbleSimulation } from '../src/physics';
import { createCpuWorldEvaluator } from '../src/sdf/eval-cpu';

describe('Stage 2 Worker 5 — 120 Hz SDF Autonomous Driver & Telemetry Harness', () => {
  it('probes 7 SDF fan rays (-60°..+60°) and detects abyss drop-offs (d > 0.4) & acid pools', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_2_INTERMEDIATE_MADNESS);
    const sim = createMarbleSimulation(COURSE_2_INTERMEDIATE_MADNESS, evaluator);
    const driver = createAutonomousDriver(COURSE_2_INTERMEDIATE_MADNESS, evaluator, {
      style: 'tourist',
    });

    const initialDecision = driver.stepDecision(sim.getState(), 0, 1 / 120);
    expect(initialDecision.fanProbes).toHaveLength(7);
    expect(initialDecision.fanProbes.map((p) => p.angleDeg)).toEqual(
      FAN_PROBE_ANGLES_DEG,
    );

    // Approach the acid-moat launch lip from the north, just outside its capture
    // radius, so the jump hint is still the active waypoint on the rebuilt course.
    sim.setState({
      ...sim.getState(),
      position: [21.8, 4.2, -27.9],
      velocity: [0, 0, -9.5],
    });
    const moatDecision = driver.stepDecision(sim.getState(), 2.5, 1 / 120);
    const hasAbyssDropOff = moatDecision.fanProbes.some(
      (p) => p.isAbyssDropOff && p.floorDistance > 0.4,
    );
    const hasAcidDetection = moatDecision.fanProbes.some((p) => p.isAcidHazard);
    expect(hasAbyssDropOff).toBe(true);
    expect(hasAcidDetection).toBe(true);
    expect(moatDecision.jumpTriggered).toBe(true);
    expect(['acid-moat', 'narrow-gap']).toContain(moatDecision.jumpReason);
  });

  it('applies counter-spin braking (backspin) when approaching sharp turns at excessive speed', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim = createMarbleSimulation(COURSE_1_PRACTICE_RACE, evaluator);
    const driver = createAutonomousDriver(COURSE_1_PRACTICE_RACE, evaluator, {
      style: 'tourist',
    });

    // Place marble hurtling down Ramp 2 toward the 90-degree Abyss Bridge Approach turn
    sim.setState({
      ...sim.getState(),
      position: [20.6, 1.55, -16.8],
      velocity: [17.5, 0, 0],
    });

    const decision = driver.stepDecision(sim.getState(), 2.0, 1 / 120);
    expect(decision.backspinApplied).toBe(true);
    expect(decision.backspinStrength).toBeGreaterThan(0.45);
    // Input X should oppose the +X velocity (counter-spin brake < 0)
    expect(decision.commands.moveXZ[0]).toBeLessThan(0);
  });

  it('triggers jump onto bounce shortcuts in speedrunner mode', () => {
    const evaluator = createCpuWorldEvaluator(COURSE_2_INTERMEDIATE_MADNESS);
    const sim = createMarbleSimulation(COURSE_2_INTERMEDIATE_MADNESS, evaluator);
    const driver = createAutonomousDriver(COURSE_2_INTERMEDIATE_MADNESS, evaluator, {
      style: 'speedrunner',
    });

    // Place marble rolling onto the c2-bounce-shortcut pad
    sim.setState({
      ...sim.getState(),
      position: [18.5, 4.38, -28.8],
      velocity: [2.0, 0, -8.5],
      surfaceMaterial: 'bounce',
    });

    const decision = driver.stepDecision(sim.getState(), 3.0, 1 / 120);
    expect(decision.jumpTriggered).toBe(true);
  });

  it('reaches goal on Course 1 (Practice Race) at 250+ Hz in tourist & speedrunner styles', () => {
    const touristRun = runHeadlessBotRollout(COURSE_1_PRACTICE_RACE, {
      style: 'tourist',
    });

    expect(touristRun.summary.reachedGoal).toBe(true);
    expect(touristRun.summary.outcome).toBe('goal');
    expect(touristRun.finalState.status).toBe('goal');
    expect(touristRun.effectiveHz).toBeGreaterThan(250);
    expect(touristRun.summary.topSpeed).toBeGreaterThan(12.0);
    expect(touristRun.summary.slipRatioPeak).toBeGreaterThan(0.5);
    expect(touristRun.summary.splitTimes.length).toBeGreaterThan(5);
    expect(touristRun.summary.bottleneckSegments.length).toBeGreaterThan(0);
    expect(touristRun.summary.backspinBrakeCount).toBeGreaterThan(0);
    expect(touristRun.summary.deathCount).toBe(0);

    const speedrun = runHeadlessBotRollout(COURSE_1_PRACTICE_RACE, {
      style: 'speedrunner',
    });
    expect(speedrun.summary.reachedGoal).toBe(true);
    expect(speedrun.finalState.status).toBe('goal');
    expect(speedrun.summary.durationSec).toBeLessThan(
      touristRun.summary.durationSec,
    );
  });

  it('reaches goal on Course 2 (Intermediate Madness) at 250+ Hz across ice, pistons, wave floor & acid moat', () => {
    const touristRun = runHeadlessBotRollout(COURSE_2_INTERMEDIATE_MADNESS, {
      style: 'tourist',
    });

    expect(touristRun.summary.reachedGoal).toBe(true);
    expect(touristRun.summary.outcome).toBe('goal');
    expect(touristRun.finalState.status).toBe('goal');
    expect(touristRun.effectiveHz).toBeGreaterThan(250);
    expect(touristRun.summary.jumpCount).toBeGreaterThanOrEqual(1);
    expect(touristRun.summary.totalAirtimeSec).toBeGreaterThan(0.2);
    expect(touristRun.summary.deathCount).toBe(0);
    expect(touristRun.summary.argonContextPromptBlock).toContain(
      'INTERMEDIATE MADNESS',
    );

    const speedrun = runHeadlessBotRollout(COURSE_2_INTERMEDIATE_MADNESS, {
      style: 'speedrunner',
    });
    expect(speedrun.summary.reachedGoal).toBe(true);
    expect(speedrun.finalState.status).toBe('goal');
  });

  it('supports chaos-explorer failure heatmap generation and controller live/fast-forward toggle API', () => {
    const chaosRun = runHeadlessBotRollout(COURSE_2_INTERMEDIATE_MADNESS, {
      style: 'chaos-explorer',
      maxDurationSec: 28,
      seed: 2026,
    });
    expect(chaosRun.summary.style).toBe('chaos-explorer');
    expect(chaosRun.summary.framesSimulated).toBeGreaterThan(500);
    expect(chaosRun.summary.deathCount).toBeGreaterThan(0);
    expect(chaosRun.summary.deathCoordinates.length).toBe(
      chaosRun.summary.deathCount,
    );
    expect(chaosRun.summary.bottleneckSegments.length).toBeGreaterThan(0);

    // Verify controller against a PlaytestWindowHost (1x live + 10x fast-forward)
    const eval1 = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
    const sim1 = createMarbleSimulation(COURSE_1_PRACTICE_RACE, eval1);
    let lastWorldInput: readonly [number, number] = [0, 0];

    const host: PlaytestWindowHost = {
      getState: () => ({
        course: COURSE_1_PRACTICE_RACE,
        marble: sim1.getState(),
        status: sim1.getState().status,
      }),
      setWorldInputXZ: (wx, wz) => {
        lastWorldInput = [wx, wz];
      },
      clearInput: () => {
        lastWorldInput = [0, 0];
      },
      stepFrames: (frames = 1, moveXZ = [0, 0], jump = false) => {
        for (let i = 0; i < frames; i++) {
          sim1.stepFixed(
            1 / 120,
            { moveXZ, jumpPressed: i === 0 ? jump : false, respawnPressed: false },
            i / 120,
          );
        }
        return {
          course: COURSE_1_PRACTICE_RACE,
          marble: sim1.getState(),
          status: sim1.getState().status,
        };
      },
    };

    const ctrl = createBotPlaytestController(() => host, {
      initialStyle: 'tourist',
      attachKeyboardShortcut: false,
    });
    expect(ctrl.isEnabled()).toBe(false);
    expect(ctrl.toggle('speedrunner')).toBe(true);
    expect(ctrl.getStyle()).toBe('speedrunner');

    const dec = ctrl.stepLiveFrame(1 / 60);
    expect(dec).not.toBeNull();
    expect(Math.hypot(lastWorldInput[0], lastWorldInput[1])).toBeGreaterThan(0.1);

    // Test 10x live frame multiplier
    ctrl.setSpeedMultiplier(10);
    expect(ctrl.getSpeedMultiplier()).toBe(10);
    ctrl.stepLiveFrame(1 / 60);

    // Test full fast-forward rollout
    const ffSummary = ctrl.runFastForwardRollout({
      style: 'tourist',
      applyToLiveViewport: true,
    });
    expect(ffSummary.reachedGoal).toBe(true);
    expect(ctrl.getLatestSummary()?.reachedGoal).toBe(true);
    expect(ctrl.getTelemetryHistory().length).toBeGreaterThanOrEqual(1);
    ctrl.dispose();
  });

  it('also navigates procedural Architect course preset (Argon Spiral Citadel)', () => {
    const citadel = generateArchitectCoursePreset('spiral-citadel');
    const rollout = runHeadlessBotRollout(citadel, { style: 'tourist' });
    expect(rollout.summary.reachedGoal).toBe(true);
    expect(rollout.finalState.status).toBe('goal');
  });
});
