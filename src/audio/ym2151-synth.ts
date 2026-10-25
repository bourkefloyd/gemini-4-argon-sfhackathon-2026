/**
 * Procedural WebAudio YM2151-Inspired Arcade Synthesizer & Spatial SFX (`src/audio/ym2151-synth.ts`)
 *
 * Zero external MP3/WAV dependencies — 100% pure WebAudio API FM synthesis inspired by
 * Brad Fuller & Hal Canon's iconic 1984 Atari System 1 (Yamaha YM2151 OPM) stereo score:
 *
 * 1. Continuous Rolling Resonance:
 *    - Carrier pitch, FM harmonic brightness (`modulationIndex`), filter cutoff, and stereo pan
 *      modulated in realtime by ground speed `||v||`, slip ratio `||v - omega x r||`, and
 *      surface material (`ice` crystalline shimmer, `acid` sizzle, `conveyor` servo hum,
 *      `standard` glass-on-tile roll, `sticky` damped drag).
 * 2. Backspin Skid & Rim-Save Audio:
 *    - High-friction glass chirp (`1450..2900 Hz` FM) when counter-spinning hard (`backspin brake`)
 *    - Subtle low-end sub-pulse (`58..95 Hz`) when teetering within `0.5 R` of a cliff edge (`rimProximity`)
 * 3. Impact, Glass Stress Crackle, Shatter, Bumper, Whisk-Broom, Portal & Goal Fanfare SFX:
 *    - Crisp inharmonic FM percussion on bumper hits
 *    - Glass stress crackle on hard landings (`lastStressImpulse`)
 *    - 4-voice crystalline shatter chord
 *    - Classic double whisk-broom sweep on respawn
 *    - Non-Euclidean Portal Doppler warp
 *    - Triumphant 1984 Goal fanfare arpeggio
 * 4. Hal Canon-Inspired 1984 Arpeggiated Synth Theme Loop:
 *    - 16-step stereo FM bass + lead arpeggiator with mute/volume toggle (`[M]` / HUD button).
 */

import type { CameraState, MarbleState, SurfaceMaterial } from '../contracts';
import type { TactileFeelState } from '../feel';

export type ArcadeSfxKind =
  | 'impact'
  | 'stress_crackle'
  | 'bumper'
  | 'shatter'
  | 'respawn_broom'
  | 'portal_warp'
  | 'goal_fanfare'
  | 'acid_sizzle';

export interface TriggeredSfxEvent {
  readonly kind: ArcadeSfxKind;
  readonly timestampSec: number;
  readonly intensity: number;
  readonly stereoPan: number;
  readonly peakFrequencyHz: number;
}

export interface SurfaceFmProfile {
  readonly material: SurfaceMaterial;
  readonly baseCarrierHz: number;
  readonly speedPitchScaleHz: number;
  /** Carrier-to-Modulator frequency ratio (e.g. `2.0` warm woody, `3.5` crystalline ice, `2.91` acid) */
  readonly cToMRatio: number;
  readonly baseModIndex: number;
  readonly baseFilterCutoffHz: number;
  readonly filterQ: number;
  readonly shimmerAmount: number;
}

export const SURFACE_FM_PROFILES: Readonly<Record<SurfaceMaterial, SurfaceFmProfile>> = {
  standard: {
    material: 'standard',
    baseCarrierHz: 92,
    speedPitchScaleHz: 14.5,
    cToMRatio: 2.0,
    baseModIndex: 1.35,
    baseFilterCutoffHz: 980,
    filterQ: 2.2,
    shimmerAmount: 0.18,
  },
  start: {
    material: 'start',
    baseCarrierHz: 98,
    speedPitchScaleHz: 14.0,
    cToMRatio: 2.0,
    baseModIndex: 1.25,
    baseFilterCutoffHz: 1050,
    filterQ: 2.0,
    shimmerAmount: 0.2,
  },
  goal: {
    material: 'goal',
    baseCarrierHz: 130.81,
    speedPitchScaleHz: 15.0,
    cToMRatio: 3.0,
    baseModIndex: 2.1,
    baseFilterCutoffHz: 1850,
    filterQ: 3.2,
    shimmerAmount: 0.55,
  },
  ice: {
    material: 'ice',
    baseCarrierHz: 210,
    speedPitchScaleHz: 22.0,
    cToMRatio: 3.5, // Crystalline inharmonic bell shimmer
    baseModIndex: 3.8,
    baseFilterCutoffHz: 3400,
    filterQ: 5.5,
    shimmerAmount: 0.95,
  },
  sticky: {
    material: 'sticky',
    baseCarrierHz: 62,
    speedPitchScaleHz: 7.5,
    cToMRatio: 1.5,
    baseModIndex: 2.4,
    baseFilterCutoffHz: 420,
    filterQ: 1.4,
    shimmerAmount: 0.05,
  },
  bounce: {
    material: 'bounce',
    baseCarrierHz: 145,
    speedPitchScaleHz: 18.0,
    cToMRatio: 2.5,
    baseModIndex: 2.6,
    baseFilterCutoffHz: 1600,
    filterQ: 3.8,
    shimmerAmount: 0.45,
  },
  acid: {
    material: 'acid',
    baseCarrierHz: 175,
    speedPitchScaleHz: 19.0,
    cToMRatio: 2.91, // Caustic sizzle sidebands
    baseModIndex: 6.4,
    baseFilterCutoffHz: 2650,
    filterQ: 4.6,
    shimmerAmount: 0.82,
  },
  bumper: {
    material: 'bumper',
    baseCarrierHz: 260,
    speedPitchScaleHz: 20.0,
    cToMRatio: 2.76, // Metallic pinball bell
    baseModIndex: 4.5,
    baseFilterCutoffHz: 2900,
    filterQ: 4.8,
    shimmerAmount: 0.78,
  },
  conveyor: {
    material: 'conveyor',
    baseCarrierHz: 118, // Industrial servo motor hum
    speedPitchScaleHz: 16.5,
    cToMRatio: 1.25,
    baseModIndex: 3.1,
    baseFilterCutoffHz: 1420,
    filterQ: 3.5,
    shimmerAmount: 0.4,
  },
};

export interface RollingVoiceTelemetry {
  readonly active: boolean;
  readonly material: SurfaceMaterial;
  readonly carrierFreqHz: number;
  readonly modulatorFreqHz: number;
  readonly fmModulationIndex: number;
  readonly harmonicBrightness: number;
  readonly filterCutoffHz: number;
  readonly stereoPan: number;
  readonly gain: number;
}

export interface SkidAndRimVoiceTelemetry {
  /** Audible high-friction glass chirp when counter-spinning (`backspin brake`) */
  readonly backspinChirpActive: boolean;
  readonly backspinChirpFreqHz: number;
  readonly backspinChirpGain: number;
  /** Subtle low-end pulse when teetering within `0.5 R` of a cliff edge */
  readonly rimPulseActive: boolean;
  readonly rimPulseFreqHz: number;
  readonly rimPulseModRateHz: number;
  readonly rimPulseGain: number;
}

export interface ArpeggiatorVoiceTelemetry {
  readonly enabled: boolean;
  readonly playing: boolean;
  readonly tempoBpm: number;
  readonly stepIndex: number;
  readonly leadFreqHz: number;
  readonly bassFreqHz: number;
  readonly stereoPan: number;
}

export interface Ym2151SynthState {
  readonly initialized: boolean;
  readonly muted: boolean;
  readonly masterVolume: number;
  readonly musicEnabled: boolean;
  readonly simTimeSec: number;
  readonly rolling: RollingVoiceTelemetry;
  readonly skidAndRim: SkidAndRimVoiceTelemetry;
  readonly theme: ArpeggiatorVoiceTelemetry;
  readonly lastTriggeredSfx: TriggeredSfxEvent | null;
  readonly sfxHistory: readonly TriggeredSfxEvent[];
}

export interface Ym2151SynthUpdateParams {
  readonly dt: number;
  readonly marble: MarbleState;
  readonly feel?: TactileFeelState;
  readonly camera?: CameraState;
  readonly timeRemainingSec?: number;
  readonly courseIndex?: number;
}

export interface Ym2151ArcadeSynth {
  /** Resume / initialize WebAudio graph (call on first pointer/key gesture or automatically) */
  resume(): void;
  /** Return deterministic snapshot of all FM voices, parameters, mute/volume & recent SFX */
  getState(): Ym2151SynthState;
  /** Toggle master mute (`[M]` key or HUD button) */
  toggleMute(): boolean;
  /** Set explicit mute state */
  setMuted(muted: boolean): void;
  /** Set master volume in `[0, 1]` */
  setMasterVolume(volume: number): void;
  /** Enable or pause the Hal Canon 1984 arpeggiated theme loop */
  setMusicEnabled(enabled: boolean): void;
  /** Step continuous rolling FM resonance, backspin skid, rim-save pulse, and arpeggiated theme */
  update(params: Ym2151SynthUpdateParams): Ym2151SynthState;
  /** Trigger surface landing impact + optional glass stress micro-fracture crackle */
  triggerImpact(impactSpeed: number, material?: SurfaceMaterial, stressImpulse?: number, pan?: number): TriggeredSfxEvent;
  /** Trigger high-stress glass crackle burst */
  triggerStressCrackle(stressLevel: number, pan?: number): TriggeredSfxEvent;
  /** Trigger metallic YM2151 arcade bumper bell */
  triggerBumperHit(strength?: number, pan?: number): TriggeredSfxEvent;
  /** Trigger 4-voice crystalline marble shatter chord */
  triggerShatter(pan?: number): TriggeredSfxEvent;
  /** Trigger classic whisk-broom sweep on respawn */
  triggerRespawnSweep(pan?: number): TriggeredSfxEvent;
  /** Trigger non-Euclidean SDF Portal Doppler warp */
  triggerPortalWarp(exitSpeed?: number, pan?: number): TriggeredSfxEvent;
  /** Trigger Hal Canon-inspired Goal fanfare chord sequence */
  triggerGoalFanfare(): TriggeredSfxEvent;
  /** Trigger caustic acid pool sizzle */
  triggerAcidSizzle(pan?: number): TriggeredSfxEvent;
  /** Bind keyboard shortcut (`KeyM` or custom code) to toggle mute */
  bindMuteHotkey(target?: Window | HTMLElement, keyCode?: string): () => void;
  /** Clean up WebAudio nodes */
  dispose(): void;
}

// 1984 Hal Canon-inspired 16-step arpeggio MIDI notes per course index (A minor / D minor / E minor)
const ARPEGGIO_LEAD_MIDI: readonly (readonly number[])[] = [
  // Course 1 (Practice Race): Iconic A-minor / F-major7 / E7 perpetual motion arpeggio
  [69, 72, 76, 81, 76, 72, 69, 72, 65, 69, 72, 77, 64, 68, 71, 76],
  // Course 2 (Intermediate Madness): Chromatic D-minor / Bb-augmented / A7 tension fugue
  [62, 65, 69, 74, 73, 69, 65, 62, 70, 74, 77, 82, 69, 73, 76, 81],
  // Course 3+ (Argon Architect / Aerial / Ultimate): High-energy E-minor synth ostinato
  [64, 67, 71, 76, 79, 76, 71, 67, 60, 64, 67, 72, 66, 69, 74, 78],
];

const ARPEGGIO_BASS_MIDI: readonly (readonly number[])[] = [
  [45, 45, 57, 45, 48, 48, 60, 48, 41, 41, 53, 41, 40, 40, 52, 40],
  [38, 38, 50, 38, 38, 50, 45, 38, 46, 46, 58, 46, 45, 45, 57, 45],
  [40, 40, 52, 40, 43, 43, 55, 43, 36, 36, 48, 36, 38, 38, 50, 38],
];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function computeSpatialPan(marble: MarbleState, camera?: CameraState): number {
  if (camera) {
    const dx = marble.position[0] - camera.target[0];
    const dz = marble.position[2] - camera.target[2];
    const rightProj = dx * camera.right[0] + dz * camera.right[2];
    return clamp(rightProj / 9.5, -0.92, 0.92);
  }
  return clamp(marble.position[0] / 18.0, -0.88, 0.88);
}

interface WebAudioLiveGraph {
  ctx: AudioContext;
  masterGain: GainNode;
  rollingCarrier: OscillatorNode;
  rollingModulator: OscillatorNode;
  rollingModGain: GainNode;
  rollingFilter: BiquadFilterNode;
  rollingPanner: StereoPannerNode | null;
  rollingGain: GainNode;
  skidCarrier: OscillatorNode;
  skidModulator: OscillatorNode;
  skidModGain: GainNode;
  skidGain: GainNode;
  rimOsc: OscillatorNode;
  rimGain: GainNode;
}

function createBrowserAudioGraph(initialMasterVol: number): WebAudioLiveGraph | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = initialMasterVol;
    masterGain.connect(ctx.destination);

    // 1. Continuous Rolling 2-Op FM Voice
    const rollingCarrier = ctx.createOscillator();
    const rollingModulator = ctx.createOscillator();
    const rollingModGain = ctx.createGain();
    const rollingFilter = ctx.createBiquadFilter();
    const rollingGain = ctx.createGain();
    const rollingPanner =
      typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;

    rollingCarrier.type = 'sine';
    rollingModulator.type = 'sine';
    rollingFilter.type = 'lowpass';
    rollingFilter.frequency.value = 980;
    rollingFilter.Q.value = 2.2;
    rollingGain.gain.value = 0;

    rollingModulator.connect(rollingModGain);
    rollingModGain.connect(rollingCarrier.frequency);
    rollingCarrier.connect(rollingFilter);
    if (rollingPanner) {
      rollingFilter.connect(rollingPanner);
      rollingPanner.connect(rollingGain);
    } else {
      rollingFilter.connect(rollingGain);
    }
    rollingGain.connect(masterGain);

    rollingCarrier.start();
    rollingModulator.start();

    // 2. Backspin Skid High-Friction Chirp FM Voice
    const skidCarrier = ctx.createOscillator();
    const skidModulator = ctx.createOscillator();
    const skidModGain = ctx.createGain();
    const skidGain = ctx.createGain();

    skidCarrier.type = 'triangle';
    skidModulator.type = 'sawtooth';
    skidGain.gain.value = 0;

    skidModulator.connect(skidModGain);
    skidModGain.connect(skidCarrier.frequency);
    skidCarrier.connect(skidGain);
    skidGain.connect(masterGain);

    skidCarrier.start();
    skidModulator.start();

    // 3. Cliff Rim-Teeter Sub-Bass Pulse Voice
    const rimOsc = ctx.createOscillator();
    const rimGain = ctx.createGain();
    rimOsc.type = 'triangle';
    rimOsc.frequency.value = 68;
    rimGain.gain.value = 0;
    rimOsc.connect(rimGain);
    rimGain.connect(masterGain);
    rimOsc.start();

    return {
      ctx,
      masterGain,
      rollingCarrier,
      rollingModulator,
      rollingModGain,
      rollingFilter,
      rollingPanner,
      rollingGain,
      skidCarrier,
      skidModulator,
      skidModGain,
      skidGain,
      rimOsc,
      rimGain,
    };
  } catch {
    return null;
  }
}

export function createYm2151ArcadeSynth(options?: {
  initialMuted?: boolean;
  initialVolume?: number;
  initialMusicEnabled?: boolean;
}): Ym2151ArcadeSynth {
  let muted = options?.initialMuted ?? false;
  let masterVolume = clamp(options?.initialVolume ?? 0.65, 0, 1);
  let musicEnabled = options?.initialMusicEnabled ?? true;
  let simTimeSec = 0;
  let graph: WebAudioLiveGraph | null = null;

  let prevStatus: MarbleState['status'] = 'racing';
  let prevImpactSpeed = 0;
  let arpeggioPhaseSteps = 0;
  let lastArpeggioStep = -1;

  const sfxHistory: TriggeredSfxEvent[] = [];

  let state: Ym2151SynthState = {
    initialized: false,
    muted,
    masterVolume,
    musicEnabled,
    simTimeSec: 0,
    rolling: {
      active: false,
      material: 'start',
      carrierFreqHz: 98,
      modulatorFreqHz: 196,
      fmModulationIndex: 1.25,
      harmonicBrightness: 0.15,
      filterCutoffHz: 1050,
      stereoPan: 0,
      gain: 0,
    },
    skidAndRim: {
      backspinChirpActive: false,
      backspinChirpFreqHz: 1580,
      backspinChirpGain: 0,
      rimPulseActive: false,
      rimPulseFreqHz: 68,
      rimPulseModRateHz: 6.5,
      rimPulseGain: 0,
    },
    theme: {
      enabled: musicEnabled,
      playing: false,
      tempoBpm: 136,
      stepIndex: 0,
      leadFreqHz: midiToHz(69),
      bassFreqHz: midiToHz(45),
      stereoPan: 0,
    },
    lastTriggeredSfx: null,
    sfxHistory: [],
  };

  function ensureGraph(): WebAudioLiveGraph | null {
    if (!graph) {
      graph = createBrowserAudioGraph(muted ? 0 : masterVolume);
    }
    if (graph && graph.ctx.state === 'suspended') {
      void graph.ctx.resume().catch(() => {});
    }
    return graph;
  }

  function syncMasterGain(): void {
    if (graph) {
      const target = muted ? 0 : masterVolume;
      graph.masterGain.gain.setValueAtTime(target, graph.ctx.currentTime);
    }
    state = {
      ...state,
      initialized: graph !== null || state.initialized,
      muted,
      masterVolume,
      musicEnabled,
    };
  }

  function playFmBurstOnGraph(
    carrierStartHz: number,
    carrierEndHz: number,
    modRatio: number,
    modIndex: number,
    durationSec: number,
    peakGain: number,
    pan = 0,
    waveType: OscillatorType = 'sine',
  ): void {
    const g = ensureGraph();
    if (!g || muted || masterVolume <= 0) return;

    try {
      const now = g.ctx.currentTime;
      const carrier = g.ctx.createOscillator();
      const modulator = g.ctx.createOscillator();
      const modGain = g.ctx.createGain();
      const envGain = g.ctx.createGain();

      carrier.type = waveType;
      modulator.type = 'sine';

      carrier.frequency.setValueAtTime(carrierStartHz, now);
      carrier.frequency.exponentialRampToValueAtTime(
        Math.max(24, carrierEndHz),
        now + durationSec,
      );

      modulator.frequency.setValueAtTime(carrierStartHz * modRatio, now);
      modulator.frequency.exponentialRampToValueAtTime(
        Math.max(24, carrierEndHz * modRatio),
        now + durationSec,
      );

      modGain.gain.setValueAtTime(carrierStartHz * modIndex, now);
      modGain.gain.exponentialRampToValueAtTime(1.0, now + durationSec);

      envGain.gain.setValueAtTime(0.0001, now);
      envGain.gain.linearRampToValueAtTime(peakGain, now + Math.min(0.012, durationSec * 0.2));
      envGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(envGain);

      if (typeof g.ctx.createStereoPanner === 'function') {
        const panner = g.ctx.createStereoPanner();
        panner.pan.setValueAtTime(clamp(pan, -1, 1), now);
        envGain.connect(panner);
        panner.connect(g.masterGain);
      } else {
        envGain.connect(g.masterGain);
      }

      carrier.start(now);
      modulator.start(now);
      carrier.stop(now + durationSec + 0.02);
      modulator.stop(now + durationSec + 0.02);
    } catch {
      // Ignore WebAudio scheduling exceptions
    }
  }

  function recordSfxEvent(
    kind: ArcadeSfxKind,
    intensity: number,
    stereoPan: number,
    peakFrequencyHz: number,
  ): TriggeredSfxEvent {
    const ev: TriggeredSfxEvent = {
      kind,
      timestampSec: simTimeSec,
      intensity: clamp(intensity, 0, 1),
      stereoPan: clamp(stereoPan, -1, 1),
      peakFrequencyHz,
    };
    sfxHistory.push(ev);
    if (sfxHistory.length > 32) {
      sfxHistory.shift();
    }
    state = {
      ...state,
      lastTriggeredSfx: ev,
      sfxHistory: [...sfxHistory],
    };
    return ev;
  }

  function triggerImpact(
    impactSpeed: number,
    material: SurfaceMaterial = 'standard',
    stressImpulse = 0,
    pan = 0,
  ): TriggeredSfxEvent {
    const profile = SURFACE_FM_PROFILES[material] ?? SURFACE_FM_PROFILES.standard;
    const normImpact = clamp(impactSpeed / 24.0, 0.08, 1.0);
    const peakFreq = profile.baseCarrierHz * (1.2 + normImpact * 1.4);

    playFmBurstOnGraph(
      peakFreq,
      profile.baseCarrierHz * 0.55,
      profile.cToMRatio,
      profile.baseModIndex * (1.0 + normImpact * 1.8),
      0.11 + normImpact * 0.08,
      0.24 * normImpact,
      pan,
      'triangle',
    );

    if (stressImpulse > 0.05) {
      triggerStressCrackle(stressImpulse, pan);
    }

    return recordSfxEvent('impact', normImpact, pan, peakFreq);
  }

  function triggerStressCrackle(stressLevel: number, pan = 0): TriggeredSfxEvent {
    const intensity = clamp(stressLevel, 0.15, 1.0);
    const peakFreq = 3400 + intensity * 1800;

    // Two crystalline high-frequency FM crackle micro-bursts
    playFmBurstOnGraph(peakFreq, 1950, 3.73, 5.2, 0.065, 0.22 * intensity, pan, 'sine');
    playFmBurstOnGraph(peakFreq * 1.24, 2400, 4.17, 6.0, 0.085, 0.18 * intensity, -pan * 0.6, 'sine');

    return recordSfxEvent('stress_crackle', intensity, pan, peakFreq);
  }

  function triggerBumperHit(strength = 0.85, pan = 0): TriggeredSfxEvent {
    const intensity = clamp(strength, 0.2, 1.0);
    const peakFreq = 540 + intensity * 180;

    // Classic 1984 arcade YM2151 metallic pinball bumper clang (`c:m = 1 : 2.76`)
    playFmBurstOnGraph(peakFreq, 175, 2.76, 5.5, 0.22, 0.32 * intensity, pan, 'sine');

    return recordSfxEvent('bumper', intensity, pan, peakFreq);
  }

  function triggerShatter(pan = 0): TriggeredSfxEvent {
    // 4-voice crystalline inharmonic shatter chord
    const shardFreqs = [1864.66, 2489.02, 3322.44, 4434.92];
    for (let i = 0; i < shardFreqs.length; i++) {
      const f = shardFreqs[i];
      const shardPan = clamp(pan + (i - 1.5) * 0.28, -1, 1);
      playFmBurstOnGraph(f, f * 0.42, 3.41 + i * 0.27, 6.8, 0.34 + i * 0.06, 0.22, shardPan, 'sine');
    }
    return recordSfxEvent('shatter', 1.0, pan, shardFreqs[3]);
  }

  function triggerRespawnSweep(pan = 0): TriggeredSfxEvent {
    // Classic Marble Madness whisk-broom double sweep + ready chime
    playFmBurstOnGraph(480, 2450, 4.65, 8.5, 0.14, 0.18, pan - 0.25, 'sawtooth');
    playFmBurstOnGraph(520, 2750, 4.85, 8.5, 0.16, 0.18, pan + 0.25, 'sawtooth');
    playFmBurstOnGraph(880, 880, 2.0, 1.4, 0.12, 0.2, 0, 'sine');
    return recordSfxEvent('respawn_broom', 0.85, pan, 2750);
  }

  function triggerPortalWarp(exitSpeed = 14.0, pan = 0): TriggeredSfxEvent {
    const intensity = clamp(exitSpeed / 22.0, 0.35, 1.0);
    const peakFreq = 920 + intensity * 560;
    playFmBurstOnGraph(240, peakFreq, 3.5, 4.2, 0.26, 0.28 * intensity, pan, 'sine');
    return recordSfxEvent('portal_warp', intensity, pan, peakFreq);
  }

  function triggerGoalFanfare(): TriggeredSfxEvent {
    // Triumphant 5-note YM2151 brass-bell chord arpeggio (C5 - E5 - G5 - B5 - C6)
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      const f = notes[i];
      const notePan = (i - 2) * 0.25;
      playFmBurstOnGraph(f, f * 1.002, 2.0, 2.8, 0.38, 0.22, notePan, 'triangle');
    }
    return recordSfxEvent('goal_fanfare', 1.0, 0, notes[notes.length - 1]);
  }

  function triggerAcidSizzle(pan = 0): TriggeredSfxEvent {
    playFmBurstOnGraph(1850, 290, 3.91, 9.2, 0.38, 0.26, pan, 'sawtooth');
    return recordSfxEvent('acid_sizzle', 0.95, pan, 1850);
  }

  function update(params: Ym2151SynthUpdateParams): Ym2151SynthState {
    const safeDt = clamp(params.dt, 0, 0.1);
    simTimeSec += safeDt;

    const { marble, feel, camera, timeRemainingSec = 45, courseIndex = 1 } = params;
    const groundSpeed =
      feel?.groundSpeed ?? Math.hypot(marble.velocity[0], marble.velocity[2]);
    const totalSpeed =
      feel?.totalSpeed ??
      Math.hypot(marble.velocity[0], marble.velocity[1], marble.velocity[2]);
    const slipRatio = feel?.slip.slipRatio ?? 0;
    const backspinIntensity = feel?.slip.backspinIntensity ?? 0;
    const rimProximity = feel?.rim.rimProximity ?? 0;
    const glassStress = feel?.stress.glassStress ?? 0;
    const lastStressImpulse = feel?.stress.lastStressImpulse ?? 0;

    const material = marble.surfaceMaterial;
    const profile = SURFACE_FM_PROFILES[material] ?? SURFACE_FM_PROFILES.standard;
    const pan = computeSpatialPan(marble, camera);

    // 1. Continuous Rolling Resonance FM Modulation
    const isRolling = marble.status === 'racing' && marble.contact.grounded && groundSpeed > 0.08;
    const speedNorm = clamp(groundSpeed / 20.0, 0, 1.35);

    // Material-specific vibrator/sizzle LFO
    const materialLfo =
      material === 'ice'
        ? Math.sin(simTimeSec * 38.0) * 14.0
        : material === 'conveyor'
          ? Math.sin(simTimeSec * 60.0) * 6.0
          : material === 'acid'
            ? Math.sin(simTimeSec * 85.0) * 24.0
            : 0;

    const carrierFreqHz =
      profile.baseCarrierHz +
      groundSpeed * profile.speedPitchScaleHz +
      slipRatio * 55.0 +
      materialLfo;

    const modulatorFreqHz = carrierFreqHz * profile.cToMRatio;

    const fmModulationIndex =
      profile.baseModIndex *
      (1.0 + speedNorm * 0.85 + slipRatio * 1.45 + glassStress * 0.65);

    const harmonicBrightness = clamp(
      0.12 +
        speedNorm * 0.48 +
        slipRatio * 0.25 +
        profile.shimmerAmount * 0.28 +
        glassStress * 0.15,
      0,
      1,
    );

    const filterCutoffHz = clamp(
      profile.baseFilterCutoffHz +
        groundSpeed * 95.0 +
        slipRatio * 900.0 +
        harmonicBrightness * 1100.0,
      180,
      8500,
    );

    const rollingGain = isRolling
      ? clamp((0.04 + speedNorm * 0.22 + slipRatio * 0.08) * (muted ? 0 : 1), 0, 0.35)
      : marble.status === 'racing' && !marble.contact.grounded && totalSpeed > 3.0
        ? clamp(0.025 * (totalSpeed / 22.0) * (muted ? 0 : 1), 0, 0.08)
        : 0;

    // 2. Backspin Skid Chirp & Cliff Rim-Save Sub-Pulse
    const backspinChirpActive =
      marble.status === 'racing' &&
      marble.contact.grounded &&
      (backspinIntensity > 0.16 || (slipRatio > 0.35 && groundSpeed > 2.0));

    const chirpVibrato = Math.sin(simTimeSec * 52.0) * 110.0;
    const backspinChirpFreqHz =
      1480 + Math.max(backspinIntensity, slipRatio) * 1180 + chirpVibrato;
    const backspinChirpGain = backspinChirpActive
      ? clamp(Math.max(backspinIntensity, slipRatio * 0.75) * 0.22 * (muted ? 0 : 1), 0, 0.25)
      : 0;

    const rimPulseActive =
      marble.status === 'racing' && marble.contact.grounded && rimProximity > 0.14;
    const rimPulseModRateHz = 5.5 + rimProximity * 5.5;
    const rimPulseLfo = 0.5 + 0.5 * Math.sin(simTimeSec * rimPulseModRateHz * Math.PI * 2);
    const rimPulseFreqHz = 58 + rimProximity * 34;
    const rimPulseGain = rimPulseActive
      ? clamp(rimProximity * (0.08 + 0.12 * rimPulseLfo) * (muted ? 0 : 1), 0, 0.22)
      : 0;

    // 3. Automatic State-Transition & Impact SFX Triggers
    const impactSpeed = marble.contact.impactSpeed;
    if (impactSpeed > 2.6 && impactSpeed > prevImpactSpeed + 1.0) {
      if (material === 'bumper') {
        triggerBumperHit(clamp(impactSpeed / 14.0, 0.35, 1.0), pan);
      } else {
        triggerImpact(impactSpeed, material, lastStressImpulse, pan);
      }
    } else if (lastStressImpulse > 0.08) {
      triggerStressCrackle(glassStress, pan);
    }
    prevImpactSpeed = impactSpeed;

    if (marble.status !== prevStatus) {
      if (marble.status === 'shattered') {
        triggerShatter(pan);
      } else if (marble.status === 'sunk') {
        triggerAcidSizzle(pan);
      } else if (marble.status === 'goal') {
        triggerGoalFanfare();
      } else if (prevStatus !== 'racing' && marble.status === 'racing') {
        triggerRespawnSweep(pan);
      }
      prevStatus = marble.status;
    }

    // 4. Hal Canon 1984 Arpeggiated Synth Theme Sequencer
    const isLowTime = timeRemainingSec <= 12 && marble.status === 'racing';
    const tempoBpm = isLowTime ? 168 : 136 + ((courseIndex - 1) % 3) * 6;
    const stepsPerSec = (tempoBpm / 60) * 4; // 16th-note grid

    if (musicEnabled && marble.status === 'racing') {
      arpeggioPhaseSteps += safeDt * stepsPerSec;
    }
    const stepIndex = Math.floor(arpeggioPhaseSteps) % 16;
    const patternIdx = Math.max(0, (courseIndex - 1) % ARPEGGIO_LEAD_MIDI.length);
    const leadPattern = ARPEGGIO_LEAD_MIDI[patternIdx] ?? ARPEGGIO_LEAD_MIDI[0];
    const bassPattern = ARPEGGIO_BASS_MIDI[patternIdx] ?? ARPEGGIO_BASS_MIDI[0];

    const leadFreqHz = midiToHz(leadPattern[stepIndex] ?? 69);
    const bassFreqHz = midiToHz(bassPattern[stepIndex] ?? 45);
    const arpPan = ((stepIndex % 4) - 1.5) * 0.35;

    if (
      musicEnabled &&
      !muted &&
      marble.status === 'racing' &&
      stepIndex !== lastArpeggioStep &&
      safeDt > 0
    ) {
      lastArpeggioStep = stepIndex;
      playFmBurstOnGraph(leadFreqHz, leadFreqHz, 2.0, 1.6, 0.09, 0.055, arpPan, 'sine');
      if (stepIndex % 2 === 0) {
        playFmBurstOnGraph(bassFreqHz, bassFreqHz * 0.99, 1.0, 2.2, 0.14, 0.065, 0, 'triangle');
      }
    }

    // 5. Push continuous voice parameters to live WebAudio nodes when initialized
    if (graph) {
      const now = graph.ctx.currentTime;
      graph.rollingCarrier.frequency.setTargetAtTime(carrierFreqHz, now, 0.015);
      graph.rollingModulator.frequency.setTargetAtTime(modulatorFreqHz, now, 0.015);
      graph.rollingModGain.gain.setTargetAtTime(
        carrierFreqHz * fmModulationIndex * 0.35,
        now,
        0.015,
      );
      graph.rollingFilter.frequency.setTargetAtTime(filterCutoffHz, now, 0.02);
      graph.rollingFilter.Q.setTargetAtTime(profile.filterQ, now, 0.02);
      if (graph.rollingPanner) {
        graph.rollingPanner.pan.setTargetAtTime(pan, now, 0.02);
      }
      graph.rollingGain.gain.setTargetAtTime(rollingGain, now, 0.02);

      graph.skidCarrier.frequency.setTargetAtTime(backspinChirpFreqHz, now, 0.01);
      graph.skidModulator.frequency.setTargetAtTime(backspinChirpFreqHz * 2.42, now, 0.01);
      graph.skidModGain.gain.setTargetAtTime(backspinChirpFreqHz * 1.8, now, 0.01);
      graph.skidGain.gain.setTargetAtTime(backspinChirpGain, now, 0.015);

      graph.rimOsc.frequency.setTargetAtTime(rimPulseFreqHz, now, 0.02);
      graph.rimGain.gain.setTargetAtTime(rimPulseGain, now, 0.02);
    }

    state = {
      initialized: graph !== null || state.initialized,
      muted,
      masterVolume,
      musicEnabled,
      simTimeSec,
      rolling: {
        active: rollingGain > 0.001,
        material,
        carrierFreqHz,
        modulatorFreqHz,
        fmModulationIndex,
        harmonicBrightness,
        filterCutoffHz,
        stereoPan: pan,
        gain: rollingGain,
      },
      skidAndRim: {
        backspinChirpActive,
        backspinChirpFreqHz,
        backspinChirpGain,
        rimPulseActive,
        rimPulseFreqHz,
        rimPulseModRateHz,
        rimPulseGain,
      },
      theme: {
        enabled: musicEnabled,
        playing: musicEnabled && !muted && marble.status === 'racing',
        tempoBpm,
        stepIndex,
        leadFreqHz,
        bassFreqHz,
        stereoPan: arpPan,
      },
      lastTriggeredSfx: state.lastTriggeredSfx,
      sfxHistory: [...sfxHistory],
    };

    return state;
  }

  function resume(): void {
    ensureGraph();
    state = {
      ...state,
      initialized: true,
    };
    syncMasterGain();
  }

  function toggleMute(): boolean {
    muted = !muted;
    syncMasterGain();
    return muted;
  }

  function setMuted(nextMuted: boolean): void {
    muted = Boolean(nextMuted);
    syncMasterGain();
  }

  function setMasterVolume(volume: number): void {
    masterVolume = clamp(volume, 0, 1);
    syncMasterGain();
  }

  function setMusicEnabled(enabled: boolean): void {
    musicEnabled = Boolean(enabled);
    syncMasterGain();
  }

  function bindMuteHotkey(
    target: Window | HTMLElement = typeof window !== 'undefined' ? window : ({} as Window),
    keyCode = 'KeyM',
  ): () => void {
    if (!target || typeof target.addEventListener !== 'function') {
      return () => {};
    }
    const handler = (ev: Event) => {
      const kev = ev as KeyboardEvent;
      const el = kev.target as HTMLElement | null;
      if (el) {
        const tag = el.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable) {
          return;
        }
      }
      if (kev.code === keyCode) {
        toggleMute();
      }
    };
    target.addEventListener('keydown', handler);
    return () => {
      target.removeEventListener('keydown', handler);
    };
  }

  function dispose(): void {
    if (graph) {
      try {
        graph.rollingCarrier.stop();
        graph.rollingModulator.stop();
        graph.skidCarrier.stop();
        graph.skidModulator.stop();
        graph.rimOsc.stop();
        void graph.ctx.close();
      } catch {
        // Ignore cleanup errors
      }
      graph = null;
    }
  }

  return {
    resume,
    getState: () => state,
    toggleMute,
    setMuted,
    setMasterVolume,
    setMusicEnabled,
    update,
    triggerImpact,
    triggerStressCrackle,
    triggerBumperHit,
    triggerShatter,
    triggerRespawnSweep,
    triggerPortalWarp,
    triggerGoalFanfare,
    triggerAcidSizzle,
    bindMuteHotkey,
    dispose,
  };
}
