/**
 * AudioSystem — procedural WebAudio cue synth, zero audio assets (Game 1,
 * Sprint 0: docs/games/GAME-1-plan.md, "AudioSystem (proceduralny)",
 * pillar #4: shoot/hit/kill must TELL the player what happened).
 *
 * Split by testability, mirroring the MaterialEditor gui-glue precedent:
 *
 *  - PURE half (fully tested here): the voice design functions below build
 *    AudioVoiceSpec DATA — no AudioContext needed, so node tests can pin
 *    every designed value. Voice specs are the engine's defaults; a game
 *    passes its own per-cue specs in the constructor (design law: tuning
 *    lives in data, not code).
 *
 *  - THIN IMPURE half (untested by design, manual browser acceptance):
 *    `renderVoice` turns one spec into real oscillators/noise on a context.
 *    `unlock()` creates/resumes the context — browser autoplay policy
 *    requires a user gesture, so the GAME calls unlock() from a real input
 *    event; the engine never auto-unlocks. In node (no AudioContext global)
 *    everything is a safe no-op.
 */
import type { System } from './System';

/** WebAudio oscillator waveform names (the four standard ones). */
export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';

/** One oscillator voice: optional frequency sweep over its lifetime. */
export interface OscillatorSpec {
  readonly type: Waveform;
  /** Frequency at note start, Hz (> 0). */
  readonly freqStart: number;
  /** Frequency at note end, Hz (> 0) — exponential sweep from freqStart. */
  readonly freqEnd: number;
  /** Note length, ms (> 0). */
  readonly durationMs: number;
  /** Peak gain, 0..1 (per-oscillator, before the master volume). */
  readonly gain: number;
  /** Delay before this oscillator starts, ms (≥ 0). Default 0. */
  readonly startMs?: number;
  /** Optional vibrato: an LFO added onto the oscillator frequency. */
  readonly vibrato?: {
    readonly rateHz: number;
    readonly depthHz: number;
  };
}

/** White-noise burst, optionally low-pass filtered. */
export interface NoiseSpec {
  readonly durationMs: number;
  readonly gain: number;
  /** Low-pass cutoff in Hz; omit for unfiltered noise. */
  readonly filterHz?: number;
}

/** A complete procedural cue: oscillators plus an optional noise layer. */
export interface AudioVoiceSpec {
  readonly oscillators: readonly OscillatorSpec[];
  readonly noise?: NoiseSpec;
}

/** Cue names the engine knows by default; games may override every spec. */
export type AudioCueName = 'shoot' | 'hit' | 'kill' | 'build' | 'alarm';

export interface AudioSystemOptions {
  /** Per-cue replacements on top of the engine default voices. */
  readonly voices?: Readonly<Partial<Record<AudioCueName, AudioVoiceSpec>>>;
  /** Initial master volume, 0..1. Default 1. */
  readonly volume?: number;
}

// === PURE voice designs (data only — pinned by tests, tuned for
// distinctness: shoot ≠ hit ≠ kill ≠ build ≠ alarm, Game 1 risk #4) ===

/** Shot: white-noise crack over a square pitch drop 180 → 60 Hz, 90 ms. */
export function shootVoice(): AudioVoiceSpec {
  return {
    oscillators: [
      { type: 'square', freqStart: 180, freqEnd: 60, durationMs: 90, gain: 0.4 },
    ],
    noise: { durationMs: 90, gain: 0.35, filterHz: 1200 },
  };
}

/** Hit confirm: short triangle click, flat 900 Hz, 30 ms. */
export function hitVoice(): AudioVoiceSpec {
  return {
    oscillators: [
      { type: 'triangle', freqStart: 900, freqEnd: 900, durationMs: 30, gain: 0.5 },
    ],
  };
}

/** Kill reward: two-note square arpeggio, 520 Hz then 780 Hz, 140 ms total. */
export function killVoice(): AudioVoiceSpec {
  return {
    oscillators: [
      { type: 'square', freqStart: 520, freqEnd: 520, durationMs: 70, gain: 0.4 },
      { type: 'square', freqStart: 780, freqEnd: 780, durationMs: 70, gain: 0.4, startMs: 70 },
    ],
  };
}

/** Build placed: soft sine up-chirp 200 → 400 Hz, 120 ms. */
export function buildVoice(): AudioVoiceSpec {
  return {
    oscillators: [
      { type: 'sine', freqStart: 200, freqEnd: 400, durationMs: 120, gain: 0.35 },
    ],
  };
}

/** Alarm / wave incoming: sawtooth 440 Hz with a slow 6 Hz vibrato. */
export function alarmVoice(): AudioVoiceSpec {
  return {
    oscillators: [
      {
        type: 'sawtooth',
        freqStart: 440,
        freqEnd: 440,
        durationMs: 500,
        gain: 0.25,
        vibrato: { rateHz: 6, depthHz: 12 },
      },
    ],
  };
}

/** The engine default cue set (fresh data per call — safe to mutate). */
export function defaultVoices(): Record<AudioCueName, AudioVoiceSpec> {
  return {
    shoot: shootVoice(),
    hit: hitVoice(),
    kill: killVoice(),
    build: buildVoice(),
    alarm: alarmVoice(),
  };
}

// === Thin impure half: spec → real WebAudio nodes. Untested by design
// (see class doc); kept linear and boring so the browser manual pass can
// trust it by reading. ===

/**
 * Schedule one voice on `ctx` starting at ctx.currentTime: per-oscillator
 * gain nodes with a ~5 ms attack/release ramp (kills clicks), an optional
 * low-passed white-noise buffer, and optional frequency-vibrato LFOs. All
 * nodes stop themselves — nothing to dispose afterwards.
 */
export function renderVoice(
  ctx: BaseAudioContext,
  spec: AudioVoiceSpec,
  destination: AudioNode,
): void {
  const t0 = ctx.currentTime;

  for (const osc of spec.oscillators) {
    const oscillator = ctx.createOscillator();
    oscillator.type = osc.type;
    const start = t0 + (osc.startMs ?? 0) / 1000;
    const end = start + osc.durationMs / 1000;

    oscillator.frequency.setValueAtTime(osc.freqStart, start);
    if (osc.freqEnd !== osc.freqStart) {
      oscillator.frequency.exponentialRampToValueAtTime(osc.freqEnd, end);
    }
    if (osc.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = osc.vibrato.rateHz;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = osc.vibrato.depthHz;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start(start);
      lfo.stop(end);
    }

    const gain = ctx.createGain();
    const attack = Math.min(0.005, osc.durationMs / 4000);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(osc.gain, start + attack);
    gain.gain.setValueAtTime(osc.gain, end - attack);
    gain.gain.linearRampToValueAtTime(0, end);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(end);
  }

  if (spec.noise) {
    const durationS = spec.noise.durationMs / 1000;
    const buffer = ctx.createBuffer(1, Math.ceil(durationS * ctx.sampleRate), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    let node: AudioNode = source;
    if (spec.noise.filterHz !== undefined) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = spec.noise.filterHz;
      source.connect(filter);
      node = filter;
    }
    const gain = ctx.createGain();
    const attack = Math.min(0.005, durationS / 4);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(spec.noise.gain, t0 + attack);
    gain.gain.setValueAtTime(spec.noise.gain, t0 + durationS - attack);
    gain.gain.linearRampToValueAtTime(0, t0 + durationS);

    node.connect(gain);
    gain.connect(destination);
    source.start(t0);
    source.stop(t0 + durationS);
  }
}

// === The System wrapper: unlock-on-gesture, no-op until then. ===

export class AudioSystem implements System {
  readonly name = 'audio';

  private readonly voices: Record<AudioCueName, AudioVoiceSpec>;
  private volumeValue: number;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  constructor(options: AudioSystemOptions = {}) {
    this.voices = { ...defaultVoices(), ...options.voices };
    this.volumeValue = Math.min(1, Math.max(0, options.volume ?? 1));
  }

  /**
   * Create and resume the AudioContext (user gesture required by the
   * autoplay policy — call from a real input event). Idempotent; a no-op
   * in environments without AudioContext (node tests stay silent).
   */
  unlock(): void {
    if (this.context) return;
    if (typeof AudioContext === 'undefined') return;

    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = this.volumeValue;
    master.connect(context.destination);
    this.context = context;
    this.masterGain = master;
    if (context.state === 'suspended') void context.resume();
  }

  /** Play a cue. Safe no-op before unlock(), in node, or for unknown names. */
  trigger(name: AudioCueName): void {
    const spec = this.voices[name];
    if (!this.context || !this.masterGain || !spec) return;
    renderVoice(this.context, spec, this.masterGain);
  }

  /** Master volume, clamped into [0, 1]; applied live when unlocked. */
  setVolume(volume: number): void {
    this.volumeValue = Math.min(1, Math.max(0, volume));
    if (this.masterGain) this.masterGain.gain.value = this.volumeValue;
  }

  get volume(): number {
    return this.volumeValue;
  }

  /** The spec a cue would currently play (diagnostics/overrides/testing). */
  voiceSpec(name: AudioCueName): AudioVoiceSpec {
    return this.voices[name];
  }

  /** Close the unlocked context. Idempotent; safe when never unlocked. */
  dispose(): void {
    if (!this.context) return;
    void this.context.close();
    this.context = null;
    this.masterGain = null;
  }
}
