import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  alarmVoice,
  buildVoice,
  hitVoice,
  killVoice,
  shootVoice,
  AudioSystem,
} from './AudioSystem';
import type { AudioVoiceSpec, OscillatorSpec } from './AudioSystem';

/**
 * AudioSystem tests cover the PURE part only — the voice specs (designed,
 * finite, distinct values) and the trigger/unlock guard logic. There is no
 * AudioContext in node, and the context path (renderVoice) is intentionally
 * thin and untested here (manual acceptance in the browser, like the editor
 * gui glue); only the unlock orchestration is exercised against a stubbed
 * global AudioContext that counts constructions.
 */

/** Minimal fake gain node: records the gain value and its connections. */
class FakeGainNode {
  readonly gain = { value: 1 };
  connections = 0;

  connect(node: unknown): unknown {
    this.connections += 1;
    return node;
  }
}

/** Minimal fake context: only the surface unlock()/setVolume() touch. */
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];

  readonly state = 'suspended';
  readonly destination = { toString: () => 'destination' } as unknown as AudioNode;
  readonly resume = vi.fn();
  readonly close = vi.fn();
  readonly gains: FakeGainNode[] = [];

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeAudioContext.instances = [];
});

/** Every number in the spec graph is finite; durations positive, gains sane. */
function expectWellFormed(spec: AudioVoiceSpec): void {
  expect(spec.oscillators.length).toBeGreaterThanOrEqual(1);
  for (const oscillator of spec.oscillators) {
    expect(Number.isFinite(oscillator.freqStart)).toBe(true);
    expect(Number.isFinite(oscillator.freqEnd)).toBe(true);
    expect(Number.isFinite(oscillator.durationMs)).toBe(true);
    expect(Number.isFinite(oscillator.gain)).toBe(true);
    expect(oscillator.freqStart).toBeGreaterThan(0);
    expect(oscillator.freqEnd).toBeGreaterThan(0);
    expect(oscillator.durationMs).toBeGreaterThan(0);
    expect(oscillator.gain).toBeGreaterThan(0);
    expect(oscillator.gain).toBeLessThanOrEqual(1);
    if (oscillator.startMs !== undefined) {
      expect(oscillator.startMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(oscillator.startMs)).toBe(true);
    }
    if (oscillator.vibrato !== undefined) {
      expect(oscillator.vibrato.rateHz).toBeGreaterThan(0);
      expect(oscillator.vibrato.depthHz).toBeGreaterThan(0);
    }
  }
  if (spec.noise !== undefined) {
    expect(spec.noise.durationMs).toBeGreaterThan(0);
    expect(spec.noise.gain).toBeGreaterThan(0);
    expect(spec.noise.gain).toBeLessThanOrEqual(1);
    if (spec.noise.filterHz !== undefined) {
      expect(spec.noise.filterHz).toBeGreaterThan(0);
    }
  }
}

describe('voice specs (pure)', () => {
  it('shoot: noise burst + square pitch drop 180→60 Hz over 90 ms', () => {
    const spec = shootVoice();
    expectWellFormed(spec);
    expect(spec.noise).toBeDefined();
    expect(spec.oscillators).toHaveLength(1);
    const [oscillator] = spec.oscillators;
    expect(oscillator.type).toBe('square');
    expect(oscillator.freqStart).toBe(180);
    expect(oscillator.freqEnd).toBe(60);
    expect(oscillator.durationMs).toBe(90);
  });

  it('hit: single short triangle click at 900 Hz, 30 ms, no noise', () => {
    const spec = hitVoice();
    expectWellFormed(spec);
    expect(spec.noise).toBeUndefined();
    expect(spec.oscillators).toHaveLength(1);
    const [oscillator] = spec.oscillators;
    expect(oscillator.type).toBe('triangle');
    expect(oscillator.freqStart).toBe(900);
    expect(oscillator.freqEnd).toBe(900);
    expect(oscillator.durationMs).toBe(30);
  });

  it('kill: two-note square arpeggio 520 Hz then 780 Hz, 70 ms each', () => {
    const spec = killVoice();
    expectWellFormed(spec);
    expect(spec.oscillators).toHaveLength(2);
    const [first, second] = spec.oscillators;
    expect(first.type).toBe('square');
    expect(first.freqStart).toBe(520);
    expect(first.durationMs).toBe(70);
    expect(second.type).toBe('square');
    expect(second.freqStart).toBe(780);
    expect(second.durationMs).toBe(70);
    expect(second.startMs).toBe(70); // staggered arpeggio, 140 ms total
  });

  it('build: soft sine up-chirp 200→400 Hz over 120 ms', () => {
    const spec = buildVoice();
    expectWellFormed(spec);
    expect(spec.oscillators).toHaveLength(1);
    const [oscillator] = spec.oscillators;
    expect(oscillator.type).toBe('sine');
    expect(oscillator.freqStart).toBe(200);
    expect(oscillator.freqEnd).toBe(400);
    expect(oscillator.durationMs).toBe(120);
  });

  it('alarm: sawtooth 440 Hz with vibrato', () => {
    const spec = alarmVoice();
    expectWellFormed(spec);
    const [oscillator] = spec.oscillators;
    expect(oscillator.type).toBe('sawtooth');
    expect(oscillator.freqStart).toBe(440);
    expect(oscillator.freqEnd).toBe(440);
    expect(oscillator.vibrato).toEqual({ rateHz: 6, depthHz: 12 });
  });

  it('all five cues are well-formed and pairwise distinct', () => {
    const specs = [shootVoice(), hitVoice(), killVoice(), buildVoice(), alarmVoice()];
    for (const spec of specs) expectWellFormed(spec);
    const serialized = specs.map((spec) => JSON.stringify(spec));
    expect(new Set(serialized).size).toBe(specs.length);
  });

  it('voice specs are fresh objects — mutating one call must not leak', () => {
    const first = shootVoice();
    // OscillatorSpec is readonly by design; a writable view lets the test
    // prove call-freshness without weakening the public type.
    type WritableOscillator = { -readonly [K in keyof OscillatorSpec]: OscillatorSpec[K] };
    (first.oscillators[0] as WritableOscillator).gain = 0.123;
    expect(shootVoice().oscillators[0].gain).not.toBe(0.123);
  });
});

describe('AudioSystem', () => {
  it('trigger before unlock is a safe no-op even without AudioContext (node)', () => {
    const audio = new AudioSystem();
    expect(() => audio.trigger('shoot')).not.toThrow();
    expect(() => audio.trigger('alarm')).not.toThrow();
    expect(() => audio.trigger('nonexistent' as 'shoot')).not.toThrow();
  });

  it('unlock is idempotent: one context, one master gain, resume called once', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioSystem();
    audio.unlock();
    audio.unlock();
    audio.unlock();

    expect(FakeAudioContext.instances).toHaveLength(1);
    const [context] = FakeAudioContext.instances;
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.gains).toHaveLength(1); // master gain created exactly once
    expect(context.gains[0].connections).toBe(1); // connected to destination
    expect(context.gains[0].gain.value).toBe(1); // default volume
  });

  it('setVolume clamps into [0, 1] and drives the master gain live', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioSystem();
    audio.unlock();
    const [context] = FakeAudioContext.instances;

    audio.setVolume(0.5);
    expect(context.gains[0].gain.value).toBe(0.5);
    expect(audio.volume).toBe(0.5);

    audio.setVolume(2);
    expect(context.gains[0].gain.value).toBe(1);
    audio.setVolume(-1);
    expect(context.gains[0].gain.value).toBe(0);
  });

  it('setVolume before unlock only stores the value; unlock applies it', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioSystem();
    audio.setVolume(0.25);
    expect(audio.volume).toBe(0.25);
    audio.unlock();
    expect(FakeAudioContext.instances[0].gains[0].gain.value).toBe(0.25);
  });

  it('dispose closes the unlocked context exactly once', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const audio = new AudioSystem();
    audio.unlock();
    audio.dispose();
    audio.dispose();
    expect(FakeAudioContext.instances[0].close).toHaveBeenCalledTimes(1);
  });

  it('honors per-cue voice overrides (game tuning lives in data)', () => {
    const replacement = buildVoice();
    const audio = new AudioSystem({ voices: { build: replacement } });
    expect(audio.voiceSpec('build')).toBe(replacement);
    expect(audio.voiceSpec('shoot')).toEqual(shootVoice()); // others default
  });
});
