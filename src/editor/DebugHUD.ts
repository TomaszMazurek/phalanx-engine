/**
 * DebugHUD — per-frame engine stats readout (FPS / fixed steps / alpha /
 * interpolation state) for the Phase 2 fixed-timestep showcase (task 7 of
 * docs/phase-2-core.md).
 *
 * The stats math lives here and is unit-tested headlessly; when a root
 * element is provided the same snapshot text is mirrored into the DOM
 * (fixed, top-left, pointer-transparent so it never eats input events).
 */
export class DebugHUD {
  /** EMA factor for FPS smoothing (higher = snappier, noisier). */
  private static readonly FPS_SMOOTHING = 0.1;

  private readonly element: HTMLDivElement | null;

  private smoothedFps = 0;
  private hasFpsSample = false;
  private lastAlpha = 0;
  private lastSteps = 0;
  private lastInterpolationOn = false;

  /**
   * @param root optional DOM parent — omit for headless mode (tests);
   *             when given, a HUD element is appended and kept in sync.
   */
  constructor(root?: HTMLElement) {
    if (!root) {
      this.element = null;
      return;
    }
    const element = document.createElement('div');
    element.style.cssText = [
      'position:fixed',
      'top:8px',
      'left:8px',
      'z-index:10',
      'font:12px/1.5 monospace',
      'color:#cfd8dc',
      'background:rgba(0,0,0,0.55)',
      'padding:4px 8px',
      'border-radius:4px',
      'pointer-events:none',
      'white-space:pre',
    ].join(';');
    root.appendChild(element);
    this.element = element;
  }

  /** Feed one frame's stats. `dt <= 0` is ignored for FPS but still updates the rest. */
  update(dt: number, alpha: number, stepsThisFrame: number, interpolationOn: boolean): void {
    if (dt > 0) {
      const instantFps = 1 / dt;
      this.smoothedFps = this.hasFpsSample
        ? this.smoothedFps + DebugHUD.FPS_SMOOTHING * (instantFps - this.smoothedFps)
        : instantFps;
      this.hasFpsSample = true;
    }
    this.lastAlpha = alpha;
    this.lastSteps = stepsThisFrame;
    this.lastInterpolationOn = interpolationOn;
    if (this.element) {
      this.element.textContent = this.text;
    }
  }

  /** Smoothed frames-per-second (0 until the first frame with dt > 0). */
  get fps(): number {
    return this.smoothedFps;
  }

  /** `FPS <int> | steps <int> | alpha <0.00> | interp <ON|OFF>` */
  get text(): string {
    return `FPS ${Math.round(this.fps)} | steps ${this.lastSteps} | alpha ${this.lastAlpha.toFixed(2)} | interp ${this.lastInterpolationOn ? 'ON' : 'OFF'}`;
  }
}
