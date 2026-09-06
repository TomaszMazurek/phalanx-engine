import { describe, expect, it } from 'vitest';
import { WaveDirector } from './WaveDirector';
import type { SpawnCommand } from './WaveDirector';

/**
 * Pins the WaveDirector state machine (src/core/WaveDirector.ts) at exact
 * fixed-step arithmetic. Timings are chosen as clean multiples of the tick:
 * FIXED_DT = 1/60 s → one tick = 16.66 ms, so 300 ms = 18 ticks,
 * 100 ms = 6 ticks, 50 ms = 3 ticks. Expected spawn ticks below are
 * computed from those ratios and asserted as exact integers.
 */
const DT = 1 / 60;

/** 3 waves: 3x/100ms, 2x/50ms, 1x/200ms; 300 ms intermissions; 2 points. */
function makeDirector(): WaveDirector {
  return new WaveDirector({
    waves: [
      { count: 3, intervalMs: 100 },
      { count: 2, intervalMs: 50 },
      { count: 1, intervalMs: 200 },
    ],
    interWaveMs: 300,
    spawnPointCount: 2,
  });
}

/** Drive `ticks` fixed steps, recording every command with its 1-based tick. */
function runTicks(
  director: WaveDirector,
  ticks: number,
): Array<{ tick: number; command: SpawnCommand }> {
  const events: Array<{ tick: number; command: SpawnCommand }> = [];
  for (let tick = 1; tick <= ticks; tick += 1) {
    for (const command of director.tick(DT)) {
      events.push({ tick, command });
    }
  }
  return events;
}

describe('WaveDirector', () => {
  it('spawns at exact tick arithmetic: 18/24/30, 48/51, 69 with 300 ms gaps', () => {
    const director = makeDirector();
    director.start();

    const events = runTicks(director, 100);
    expect(events.map((event) => event.tick)).toEqual([18, 24, 30, 48, 51, 69]);
    expect(events.map((event) => event.command.waveIndex)).toEqual([0, 0, 0, 1, 1, 2]);
  });

  it('round-robins spawnPointIndex across a global cursor; default is one point', () => {
    const director = makeDirector();
    director.start();
    const events = runTicks(director, 100);
    expect(events.map((event) => event.command.spawnPointIndex)).toEqual([0, 1, 0, 1, 0, 1]);

    const single = new WaveDirector({
      waves: [{ count: 3, intervalMs: 50 }],
      interWaveMs: 50,
    });
    single.start();
    expect(
      runTicks(single, 100).map((event) => event.command.spawnPointIndex),
    ).toEqual([0, 0, 0]);
  });

  it('walks phases intermission → spawning → … → done at the exact ticks', () => {
    const director = makeDirector();
    director.start();
    expect(director.phase).toBe('intermission');
    expect(director.currentWave).toBe(-1);

    // Probe the phase on landmark ticks: last pre-wave tick, each transition,
    // and deep after the finish.
    const probes = new Map<number, string>();
    const landmarks = [17, 18, 24, 29, 30, 47, 48, 51, 68, 69, 100];
    for (let tick = 1; tick <= 100; tick += 1) {
      director.tick(DT);
      if (landmarks.includes(tick)) probes.set(tick, director.phase);
    }
    expect(Object.fromEntries(probes)).toEqual({
      17: 'intermission', // wave 0 not yet started
      18: 'spawning', // wave 0 starts, first spawn same tick
      24: 'spawning',
      29: 'spawning',
      30: 'intermission', // wave 0 exhausted, gap to wave 1
      47: 'intermission',
      48: 'spawning', // wave 1 starts
      51: 'intermission', // wave 1 exhausted, gap to wave 2
      68: 'intermission',
      69: 'done', // wave 2 (count 1) starts and finishes on one tick
      100: 'done',
    });
  });

  it('tracks currentWave through the schedule, -1 before the first wave', () => {
    const director = makeDirector();
    director.start();
    for (let tick = 1; tick <= 17; tick += 1) director.tick(DT);
    expect(director.currentWave).toBe(-1);
    director.tick(DT); // tick 18: wave 0
    expect(director.currentWave).toBe(0);
    for (let tick = 19; tick <= 48; tick += 1) director.tick(DT);
    expect(director.currentWave).toBe(1);
    for (let tick = 49; tick <= 69; tick += 1) director.tick(DT);
    expect(director.currentWave).toBe(2);
  });

  it('exposes waveJustStarted / waveJustEnded only on the transition ticks', () => {
    const director = makeDirector();
    director.start();
    const started: number[] = [];
    const ended: number[] = [];
    for (let tick = 1; tick <= 100; tick += 1) {
      director.tick(DT);
      if (director.waveJustStarted) started.push(tick);
      if (director.waveJustEnded) ended.push(tick);
    }
    expect(started).toEqual([18, 48, 69]);
    expect(ended).toEqual([30, 51, 69]); // count-1 wave starts and ends on tick 69
  });

  it('reports remainingInWave and a counting-down timeToNextMs mid-wave', () => {
    const director = makeDirector();
    director.start();
    for (let tick = 1; tick <= 5; tick += 1) director.tick(DT);
    expect(director.remainingInWave).toBe(0); // still intermission
    expect(director.timeToNextMs).toBeCloseTo(300 - 5 * (1000 / 60), 10);

    for (let tick = 6; tick <= 18; tick += 1) director.tick(DT);
    expect(director.remainingInWave).toBe(2); // one of three spawned at wave start
    expect(director.timeToNextMs).toBeCloseTo(100, 10);
  });

  it('done stops emitting — late ticks return no commands and keep phase done', () => {
    const director = makeDirector();
    director.start();
    const all = runTicks(director, 200);
    expect(all).toHaveLength(6);
    expect(director.phase).toBe('done');
    expect(director.tick(DT)).toEqual([]);
    expect(director.tick(DT)).toEqual([]);
  });

  it('start() resets to a replayable identical schedule', () => {
    const director = makeDirector();
    director.start();
    const firstRun = runTicks(director, 100);
    director.start();
    expect(director.spawnCursor).toBe(0); // reset rewinds round-robin too
    expect(director.currentWave).toBe(-1);
    expect(director.phase).toBe('intermission');
    const secondRun = runTicks(director, 100);
    expect(secondRun).toEqual(firstRun);
    expect(director.phase).toBe('done');
  });

  it('a fresh director sits in intermission and emits nothing before start()', () => {
    const director = makeDirector();
    expect(runTicks(director, 100)).toEqual([]);
  });

  it('empty wave list finishes after the opening intermission with zero spawns', () => {
    const director = new WaveDirector({ waves: [], interWaveMs: 300 });
    director.start();
    expect(runTicks(director, 100)).toEqual([]);
    expect(director.phase).toBe('done');
  });

  it('rejects invalid config loudly', () => {
    expect(() => new WaveDirector({ waves: [{ count: 0, intervalMs: 100 }], interWaveMs: 0 }))
      .toThrow(RangeError);
    expect(() => new WaveDirector({ waves: [{ count: 2, intervalMs: -1 }], interWaveMs: 0 }))
      .toThrow(RangeError);
    expect(() => new WaveDirector({ waves: [], interWaveMs: -5 })).toThrow(RangeError);
    expect(
      () =>
        new WaveDirector({
          waves: [{ count: 1, intervalMs: 100 }],
          interWaveMs: 0,
          spawnPointCount: 0,
        }),
    ).toThrow(RangeError);
    expect(() =>
      new WaveDirector({
        waves: [{ count: 1.5, intervalMs: 100 }],
        interWaveMs: 0,
      }),
    ).toThrow(RangeError);
  });
});
