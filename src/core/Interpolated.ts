/**
 * Interpolated — double-buffered scalar for fixed-timestep rendering
 * (docs/phase-2-core.md, task 1).
 *
 * The simulation pushes a value once per fixed step (`push`); the render
 * phase reads it back fractionally between the last two states:
 * `read(alpha) = prev + (current - prev) * alpha`, where `alpha` comes from
 * GameLoop's frame callback. This is what makes 60 Hz logic look smooth on
 * any display refresh rate — and the same pattern Phase 4 will apply to
 * physics bodies.
 *
 * Angle caveat: lerp between `prev` and `current` assumes values move
 * monotonically between steps. Accumulate rotation WITHOUT wrapping
 * (no `% 2π`) — growing unbounded is fine and keeps interpolation safe.
 */
export class Interpolated {
  private previous: number;
  private current: number;

  constructor(initial = 0) {
    this.previous = initial;
    this.current = initial;
  }

  /** Record the value produced by the latest fixed simulation step. */
  push(value: number): void {
    this.previous = this.current;
    this.current = value;
  }

  /** Value interpolated into the current frame, `alpha` in [0, 1). */
  read(alpha: number): number {
    return this.previous + (this.current - this.previous) * alpha;
  }

  /** Latest fixed-step value (no interpolation). */
  get value(): number {
    return this.current;
  }
}