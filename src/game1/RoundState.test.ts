import { describe, expect, it } from 'vitest';
import { RoundState } from './RoundState';

/**
 * RoundState (src/game1/RoundState.ts) — the round outcome FSM.
 * Transitions: playing → victory|defeat (first outcome wins), and
 * restart() → playing from anywhere (the R-key reset completeness seam).
 */
describe('RoundState', () => {
  it('starts playing', () => {
    expect(new RoundState().status).toBe('playing');
  });

  it('transitions playing → defeat on player death', () => {
    const state = new RoundState();
    state.markDefeat();
    expect(state.status).toBe('defeat');
  });

  it('transitions playing → victory when the field is cleared', () => {
    const state = new RoundState();
    state.markVictory();
    expect(state.status).toBe('victory');
  });

  it('keeps the FIRST outcome — no flip after the round ended', () => {
    const state = new RoundState();
    state.markDefeat();
    state.markVictory();
    expect(state.status).toBe('defeat');

    const other = new RoundState();
    other.markVictory();
    other.markDefeat();
    expect(other.status).toBe('victory');
  });

  it('restart() resets to playing from any outcome and reopens transitions', () => {
    for (const outcome of ['victory', 'defeat'] as const) {
      const state = new RoundState();
      if (outcome === 'victory') state.markVictory();
      else state.markDefeat();
      state.restart();
      expect(state.status).toBe('playing');
      state.markVictory();
      expect(state.status).toBe('victory');
    }
  });
});
