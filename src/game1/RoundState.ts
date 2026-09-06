/**
 * RoundState (Game 1, Sprint 0) — the round outcome FSM.
 *
 * 'playing' is the only live state; victory (all waves spawned and the
 * field cleared) and defeat (player health gone) end the round. The FIRST
 * outcome wins — a kill that clears the field on the same tick the player
 * dies still produces exactly one result. restart() is the R-key reset:
 * back to 'playing', transitions reopen.
 */
export type RoundStatus = 'playing' | 'victory' | 'defeat';

export class RoundState {
  private statusValue: RoundStatus = 'playing';

  get status(): RoundStatus {
    return this.statusValue;
  }

  /** Player died. No-op unless the round is still live. */
  markDefeat(): void {
    if (this.statusValue === 'playing') this.statusValue = 'defeat';
  }

  /** Field cleared after the last wave. No-op unless the round is live. */
  markVictory(): void {
    if (this.statusValue === 'playing') this.statusValue = 'victory';
  }

  /** Full reset: any state → 'playing' (the restart seam). */
  restart(): void {
    this.statusValue = 'playing';
  }
}
