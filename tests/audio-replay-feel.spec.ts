import { describe, expect, it } from 'vitest';
import {
  createYm2151ArcadeSynth,
  SURFACE_FM_PROFILES,
} from '../src/audio';
import {
  COURSE_1_PRACTICE_RACE,
  COURSE_2_INTERMEDIATE_MADNESS,
} from '../src/courses';
import {
  classifyGlassFractureStage,
  computeSlipMetrics,
  createArcadeSensorySession,
  createTactileFeelTracker,
} from '../src/feel';
import {
  createInitialMarbleState,
  createMarbleSimulation,
} from '../src/physics';
import {
  computeLiveSplitDelta,
  createGhostReplayManager,
  decodeGhostFramesFloat32,
  encodeGhostFramesFloat32,
  formatSplitDelta,
  sampleGhostPoseAtTime,
  synthesizeArgonProGhost,
} from '../src/replay';
import { createCpuWorldEvaluator } from '../src/sdf/eval-cpu';

describe('Stage 2 Worker 3 — YM2151 Synth, Tactile Trackball Feel, Glass Stress & 120 Hz Ghost Replay', () => {
  describe('1. Tactile Trackball Feel, Backspin Braking, Rim-Catch Assist & Glass Stress (`src/feel/`)', () => {
    it('computes near-zero slip ratio during pure rolling and high slip/backspin when counter-spinning', () => {
      const baseMarble = createInitialMarbleState(COURSE_1_PRACTICE_RACE);
      const R = baseMarble.radius;

      // Pure rolling along +X at 10 u/s: omega = [vz/R, 0, -vx/R] = [0, 0, -10/R]
      const pureRollingMarble = {
        ...baseMarble,
        velocity: [10, 0, 0] as const,
        angularVelocity: [0, 0, -10 / R] as const,
      };
      const pureSlip = computeSlipMetrics(pureRollingMarble, [1, 0]);
      expect(pureSlip.slipSpeed).toBeCloseTo(0, 4);
      expect(pureSlip.slipRatio).toBeCloseTo(0, 4);
      expect(pureSlip.backspinIntensity).toBe(0);

      // Hard counter-spin (backspin brake): rolling +X at 12 u/s while whipping trackball [-1, 0]
      const counterSpinMarble = {
        ...baseMarble,
        velocity: [12, 0, 0] as const,
        angularVelocity: [0, 0, 8 / R] as const, // Reversed spin!
      };
      const backspinSlip = computeSlipMetrics(counterSpinMarble, [-1, 0]);
      expect(backspinSlip.slipSpeed).toBeGreaterThan(15);
      expect(backspinSlip.slipRatio).toBeGreaterThan(0.75);
      expect(backspinSlip.backspinIntensity).toBeGreaterThan(0.7);
      expect(backspinSlip.inputVelocityAlignment).toBeCloseTo(-1, 3);
    });

    it('accumulates Glass Stress (0..1) across impacts, transitions fracture stages, and anneals while rolling smoothly', () => {
      const tracker = createTactileFeelTracker();
      expect(tracker.getState().stress.glassStress).toBe(0);
      expect(tracker.getState().stress.fractureStage).toBe('pristine');

      // 1st medium-hard wall impact (impactSpeed = 12.5 u/s) -> hairline / cracked stage
      const s1 = tracker.registerImpact(12.5, true, 'standard');
      expect(s1.glassStress).toBeGreaterThan(0.25);
      expect(s1.glassStress).toBeLessThan(0.6);
      expect(['hairline', 'cracked']).toContain(s1.fractureStage);
      expect(s1.crackVisibility).toBeGreaterThan(0.1);
      expect(s1.lastStressImpulse).toBeGreaterThan(0.25);

      // 2nd bumper hit (impactSpeed = 14.0 u/s) -> critical fracture stage with internal glow
      const s2 = tracker.registerImpact(14.0, true, 'bumper');
      expect(s2.glassStress).toBeGreaterThan(0.75);
      expect(s2.fractureStage).toBe('critical');
      expect(s2.stressGlowIntensity).toBeGreaterThan(0.6);
      expect(s2.isShattered).toBe(false);

      // Smooth grounded rolling for 1.5 seconds (180 ticks at 120 Hz) anneals/heals stress
      const calmMarble = {
        ...createInitialMarbleState(COURSE_1_PRACTICE_RACE),
        surfaceMaterial: 'standard' as const,
        velocity: [4, 0, -4] as const,
      };
      for (let i = 0; i < 180; i++) {
        tracker.step(1 / 120, calmMarble, {
          moveXZ: [0, -1],
          jumpPressed: false,
          respawnPressed: false,
        });
      }
      const annealed = tracker.getState().stress;
      expect(annealed.glassStress).toBeLessThan(s2.glassStress - 0.2);

      // Fatal high-fall impact (>= 31 u/s) pushes glassStress to 1.0 ('shattered')
      const fatal = tracker.registerImpact(32.5, false, 'standard');
      expect(fatal.glassStress).toBe(1.0);
      expect(fatal.fractureStage).toBe('shattered');
      expect(fatal.isShattered).toBe(true);
      expect(classifyGlassFractureStage(1.0)).toBe('shattered');
    });

    it('detects cliff-edge rim proximity within 0.5 R on narrow catwalks and activates Rim-Catch Assist', () => {
      const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
      const tracker = createTactileFeelTracker();

      // Narrow Abyss Bridge on Course 1 is centered at x = 24.6, yTop = 1.0, z = -25.6 with halfWidth = 1.65.
      // Place the marble right at the eastern unrailed cliff lip: x = 24.6 + 1.55 = 26.15
      const lipMarble = {
        ...createInitialMarbleState(COURSE_1_PRACTICE_RACE),
        position: [26.12, 1.55, -25.6] as const,
        velocity: [2.5, 0, -4.0] as const,
        surfaceMaterial: 'standard' as const,
      };

      // Player pulls trackball left [-1, 0] away from the +X cliff drop
      const feelState = tracker.step(
        1 / 120,
        lipMarble,
        { moveXZ: [-1, 0], jumpPressed: false, respawnPressed: false },
        evaluator,
        1.0,
      );

      expect(feelState.rim.rimProximity).toBeGreaterThan(0.25);
      expect(feelState.rim.safeLedgeNormalXZ[0]).toBeLessThan(-0.5);
      expect(feelState.rim.rimSaveActive).toBe(true);
      expect(feelState.rim.rimTorqueMultiplier).toBeGreaterThan(1.2);
      expect(feelState.rim.assistedMoveXZ[0]).toBeLessThan(-1.1);
    });
  });

  describe('2. 120 Hz Deterministic Ghost Marble Replay & Split Timer (`src/replay/`)', () => {
    it('synthesizes a 120 Hz Argon Pro Ghost par line and interpolates pose smoothly at any timestamp', () => {
      const argonGhost = synthesizeArgonProGhost(COURSE_1_PRACTICE_RACE);
      expect(argonGhost.source).toBe('argon_pro_par');
      expect(argonGhost.sampleRateHz).toBe(120);
      expect(argonGhost.completedGoal).toBe(true);
      expect(argonGhost.frames.length).toBeGreaterThan(600);

      // Start frame is at course startPos, final frame is at course goalPos
      const first = argonGhost.frames[0];
      const last = argonGhost.frames[argonGhost.frames.length - 1];
      expect(first.position[0]).toBeCloseTo(COURSE_1_PRACTICE_RACE.startPos[0], 2);
      expect(first.position[2]).toBeCloseTo(COURSE_1_PRACTICE_RACE.startPos[2], 2);
      expect(last.position[0]).toBeCloseTo(COURSE_1_PRACTICE_RACE.goalPos[0], 2);
      expect(last.position[2]).toBeCloseTo(COURSE_1_PRACTICE_RACE.goalPos[2], 2);

      // Sample interpolated pose at mid-run timestamp
      const midTime = argonGhost.finishTimeSec * 0.5;
      const midPose = sampleGhostPoseAtTime(argonGhost, midTime);
      expect(midPose.active).toBe(true);
      expect(midPose.finished).toBe(false);
      expect(midPose.progressFraction).toBeCloseTo(0.5, 1);
      expect(midPose.speed).toBeGreaterThan(1.0);
      // Quaternion remains unit length after slerp
      const qNorm = Math.hypot(
        midPose.orientation[0],
        midPose.orientation[1],
        midPose.orientation[2],
        midPose.orientation[3],
      );
      expect(qNorm).toBeCloseTo(1.0, 4);

      // Compact Float32Array round-trip preserves trajectory frames
      const packed = encodeGhostFramesFloat32(argonGhost.frames);
      expect(packed.length).toBe(argonGhost.frames.length * 8);
      const unpacked = decodeGhostFramesFloat32(packed);
      expect(unpacked.length).toBe(argonGhost.frames.length);
      expect(unpacked[120].position[0]).toBeCloseTo(argonGhost.frames[120].position[0], 3);
      expect(unpacked[120].time).toBeCloseTo(argonGhost.frames[120].time, 4);
    });

    it('records 120 Hz player frames, computes live +/- split deltas, and promotes faster runs to Personal Best', () => {
      const manager = createGhostReplayManager(COURSE_1_PRACTICE_RACE);
      manager.clearPersonalBests();
      manager.startRun(COURSE_1_PRACTICE_RACE);

      // Before any Personal Best exists, reference ghost defaults to Argon Pro Ghost
      const ref0 = manager.getReferenceGhost();
      expect(ref0.source).toBe('argon_pro_par');

      // Simulate a brisk player run that follows the Argon Pro Ghost path 1.50s faster
      const parFrames = ref0.frames;
      const speedupFactor = (ref0.finishTimeSec - 1.5) / ref0.finishTimeSec;

      let baseMarble = createInitialMarbleState(COURSE_1_PRACTICE_RACE);
      for (let i = 0; i < parFrames.length; i++) {
        const pf = parFrames[i];
        const playerTime = pf.time * speedupFactor;
        baseMarble = {
          ...baseMarble,
          position: pf.position,
          orientation: pf.orientation,
          velocity: [0, 0, -9],
          status: i === parFrames.length - 1 ? 'goal' : 'racing',
        };
        manager.recordFrame(baseMarble, playerTime);
      }

      // Check mid-course split when player is 1.5s ahead of the ghost at the goal position
      const splitAtGoal = computeLiveSplitDelta(
        ref0,
        COURSE_1_PRACTICE_RACE,
        COURSE_1_PRACTICE_RACE.goalPos,
        ref0.finishTimeSec - 1.5,
      );
      expect(splitAtGoal.deltaSec).toBeCloseTo(-1.5, 1);
      expect(splitAtGoal.status).toBe('ahead');
      expect(splitAtGoal.formattedDelta).toBe('-1.50s');

      // Check behind split (+2.25s slower)
      const splitBehind = computeLiveSplitDelta(
        ref0,
        COURSE_1_PRACTICE_RACE,
        COURSE_1_PRACTICE_RACE.goalPos,
        ref0.finishTimeSec + 2.25,
      );
      expect(splitBehind.deltaSec).toBeCloseTo(2.25, 1);
      expect(splitBehind.status).toBe('behind');
      expect(splitBehind.formattedDelta).toBe('+2.25s');

      // Verify Personal Best was automatically saved upon reaching 'goal'
      const savedPb = manager.getPersonalBestGhost(COURSE_1_PRACTICE_RACE.id);
      expect(savedPb).not.toBeNull();
      expect(savedPb?.source).toBe('player_best');
      expect(savedPb?.finishTimeSec).toBeCloseTo(ref0.finishTimeSec - 1.5, 2);

      // Verify a slower subsequent run does NOT overwrite the faster Personal Best
      manager.startRun(COURSE_1_PRACTICE_RACE);
      manager.recordFrame(baseMarble, ref0.finishTimeSec + 4.0);
      const slowSummary = manager.completeRun(ref0.finishTimeSec + 4.0);
      expect(slowSummary.isNewPersonalBest).toBe(false);
      expect(manager.getPersonalBestGhost(COURSE_1_PRACTICE_RACE.id)?.finishTimeSec).toBeCloseTo(
        ref0.finishTimeSec - 1.5,
        2,
      );

      expect(formatSplitDelta(0).status).toBe('even');
    });
  });

  describe('3. Procedural WebAudio YM2151-Inspired Arcade Synthesizer (`src/audio/`)', () => {
    it('modulates rolling FM pitch, harmonic brightness, and filter cutoff by speed, slip ratio, and surface material', () => {
      const synth = createYm2151ArcadeSynth({ initialVolume: 0.8 });
      const feelTracker = createTactileFeelTracker();
      const baseMarble = createInitialMarbleState(COURSE_2_INTERMEDIATE_MADNESS);

      // 1. Slow roll on standard tile (4 u/s)
      const slowStandardMarble = {
        ...baseMarble,
        surfaceMaterial: 'standard' as const,
        velocity: [0, 0, -4] as const,
      };
      const slowFeel = feelTracker.step(1 / 120, slowStandardMarble, {
        moveXZ: [0, -1],
        jumpPressed: false,
        respawnPressed: false,
      });
      const slowState = synth.update({
        dt: 1 / 60,
        marble: slowStandardMarble,
        feel: slowFeel,
      });

      // 2. High-speed roll on standard tile (18 u/s)
      const fastStandardMarble = {
        ...baseMarble,
        surfaceMaterial: 'standard' as const,
        velocity: [0, 0, -18] as const,
      };
      const fastFeel = feelTracker.step(1 / 120, fastStandardMarble, {
        moveXZ: [0, -1],
        jumpPressed: false,
        respawnPressed: false,
      });
      const fastState = synth.update({
        dt: 1 / 60,
        marble: fastStandardMarble,
        feel: fastFeel,
      });

      expect(fastState.rolling.active).toBe(true);
      expect(fastState.rolling.carrierFreqHz).toBeGreaterThan(slowState.rolling.carrierFreqHz + 120);
      expect(fastState.rolling.harmonicBrightness).toBeGreaterThan(slowState.rolling.harmonicBrightness);
      expect(fastState.rolling.filterCutoffHz).toBeGreaterThan(slowState.rolling.filterCutoffHz);

      // 3. Crystalline Ice surface produces higher c:m ratio (3.5) and higher shimmer cutoff than Sticky
      const iceMarble = {
        ...fastStandardMarble,
        surfaceMaterial: 'ice' as const,
      };
      const iceState = synth.update({
        dt: 1 / 60,
        marble: iceMarble,
      });
      const stickyMarble = {
        ...fastStandardMarble,
        surfaceMaterial: 'sticky' as const,
      };
      const stickyState = synth.update({
        dt: 1 / 60,
        marble: stickyMarble,
      });

      expect(SURFACE_FM_PROFILES.ice.cToMRatio).toBe(3.5);
      expect(iceState.rolling.filterCutoffHz).toBeGreaterThan(stickyState.rolling.filterCutoffHz + 1500);
      expect(iceState.rolling.modulatorFreqHz / iceState.rolling.carrierFreqHz).toBeCloseTo(3.5, 2);

      synth.dispose();
    });

    it('activates backspin skid glass chirp, cliff rim-save pulse, all arcade SFX, and Hal Canon theme mute/volume toggles', () => {
      const synth = createYm2151ArcadeSynth({ initialVolume: 0.75 });
      const baseMarble = createInitialMarbleState(COURSE_1_PRACTICE_RACE);

      // Trigger backspin skid & cliff rim teeter via TactileFeelState
      const feelWithSkidAndRim = {
        ...createTactileFeelTracker().getState(),
        groundSpeed: 14,
        totalSpeed: 14,
        slip: {
          tangentialVelocity: [14, 0, 0] as const,
          rotationalSurfaceVelocity: [-8, 0, 0] as const,
          slipVelocity: [22, 0, 0] as const,
          slipSpeed: 22,
          slipRatio: 0.88,
          backspinIntensity: 0.85,
          iceSpinCharge: 0,
          inputVelocityAlignment: -0.95,
        },
        rim: {
          rimProximity: 0.65,
          safeLedgeNormalXZ: [-1, 0] as const,
          rimCatchWindowTimer: 0.14,
          rimSaveActive: true,
          rimTorqueMultiplier: 1.45,
          assistedMoveXZ: [-1.45, 0] as const,
        },
      };

      const activeState = synth.update({
        dt: 0.05,
        marble: { ...baseMarble, velocity: [14, 0, 0] },
        feel: feelWithSkidAndRim,
        timeRemainingSec: 9.5, // Low time (< 12s) accelerates Hal Canon arpeggiator tempo!
      });

      expect(activeState.skidAndRim.backspinChirpActive).toBe(true);
      expect(activeState.skidAndRim.backspinChirpGain).toBeGreaterThan(0.1);
      expect(activeState.skidAndRim.rimPulseActive).toBe(true);
      expect(activeState.skidAndRim.rimPulseGain).toBeGreaterThan(0.04);
      expect(activeState.theme.playing).toBe(true);
      expect(activeState.theme.tempoBpm).toBe(168);

      // Trigger all discrete YM2151 SFX voices
      expect(synth.triggerBumperHit(0.9, -0.3).kind).toBe('bumper');
      expect(synth.triggerStressCrackle(0.7, 0.1).kind).toBe('stress_crackle');
      expect(synth.triggerShatter(0).kind).toBe('shatter');
      expect(synth.triggerRespawnSweep(0).kind).toBe('respawn_broom');
      expect(synth.triggerPortalWarp(18.0, 0.4).kind).toBe('portal_warp');
      expect(synth.triggerAcidSizzle(-0.2).kind).toBe('acid_sizzle');
      expect(synth.triggerGoalFanfare().kind).toBe('goal_fanfare');

      expect(synth.getState().sfxHistory.length).toBeGreaterThanOrEqual(7);

      // Mute / Volume controls
      const nowMuted = synth.toggleMute();
      expect(nowMuted).toBe(true);
      expect(synth.getState().muted).toBe(true);

      const mutedUpdate = synth.update({
        dt: 0.02,
        marble: { ...baseMarble, velocity: [14, 0, 0] },
        feel: feelWithSkidAndRim,
      });
      expect(mutedUpdate.rolling.gain).toBe(0);
      expect(mutedUpdate.theme.playing).toBe(false);

      synth.setMuted(false);
      synth.setMasterVolume(0.5);
      expect(synth.getState().muted).toBe(false);
      expect(synth.getState().masterVolume).toBeCloseTo(0.5, 4);

      synth.dispose();
    });

    it('runs unified ArcadeSensorySession in 120 Hz lockstep with MarbleSimulation', () => {
      const evaluator = createCpuWorldEvaluator(COURSE_1_PRACTICE_RACE);
      const sim = createMarbleSimulation(COURSE_1_PRACTICE_RACE, evaluator);
      const session = createArcadeSensorySession(COURSE_1_PRACTICE_RACE);

      let snap = session.getSnapshot(sim.getState(), 0);
      expect(snap.ghostPose.active).toBe(true);

      const dt = 1 / 120;
      const input = { moveXZ: [0, -1] as const, jumpPressed: false, respawnPressed: false };
      for (let tick = 1; tick <= 60; tick++) {
        const simTime = tick * dt;
        const marble = sim.stepFixed(dt, input, simTime);
        snap = session.step({
          dt,
          marble,
          input,
          evaluator,
          simTimeSec: simTime,
          runTimeSec: simTime,
          timeRemainingSec: 60 - simTime,
        });
      }

      expect(session.replayManager.getCurrentRunFrames().length).toBe(60);
      expect(snap.feel.groundSpeed).toBeGreaterThan(2.0);
      expect(snap.synth.rolling.active).toBe(true);
      expect(snap.split.hasReferenceGhost).toBe(true);

      session.dispose();
    });
  });
});
