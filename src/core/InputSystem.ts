import type { System } from './System';
import { DEFAULT_BINDINGS } from './Bindings';
import type { AxisDefinition, Binding, BindingsConfig } from './Bindings';

/**
 * InputSystem — abstract input actions over keyboard, mouse and gamepad
 * (Phase 2, docs/phase-2-core.md, task 3).
 *
 * Game logic never asks "is Space held" — it asks "is the 'jump' action down".
 * The action → physical-input mapping lives in pure data (Bindings.ts,
 * JSON-serializable for the future editor); this system only interprets it.
 *
 * === REGISTRATION ORDER — read this or edges will vanish ===
 * Register InputSystem LAST, after every input-consuming system. Frame shape
 * (GameLoop): all fixedUpdate substeps first, then the frame phase (systems'
 * update in registration order). This system's update() clears the frame's
 * edges and polls gamepads. Consequences:
 *
 * - keyboard/mouse edges recorded between frames are visible to ALL fixedUpdate
 *   substeps of the current frame and to every update() running earlier in the
 *   frame phase;
 * - gamepad edges are recorded during this system's per-frame poll and live
 *   until the NEXT frame's clear — one frame of polling latency, inherent to
 *   per-frame gamepad polling (plan trap #3: never poll in fixedUpdate);
 * - an input arriving mid-frame (after the substeps already ran) is missed by
 *   fixedUpdate readers this frame — the input-buffer pattern below is the fix.
 *
 * === INPUT-BUFFER PATTERN (jump-once semantics, plan trap #2) ===
 * Reading `wasPressedThisFrame` directly in fixedUpdate can miss or double
 * fire (a 144 Hz frame carries 0–2 substeps). Instead:
 * ```ts
 * class Player implements System {
 *   private jumpRequested = false;
 *
 *   update(): void {
 *     if (this.input.wasPressedThisFrame('jump')) {
 *       this.jumpRequested = true; // survives until the nearest fixedUpdate
 *     }
 *   }
 *
 *   fixedUpdate(fixedDt: number): void {
 *     if (this.jumpRequested) {
 *       this.jumpRequested = false;
 *       this.velocity.y += JUMP_SPEED;
 *     }
 *   }
 * }
 * ```
 *
 * Out of scope (documented, not implemented): wheel, pointer lock,
 * touch/multi-touch — they arrive with a real use case (Phase 4+).
 * `blur` releases all held keyboard/mouse state (no stuck keys after alt-tab).
 */
export class InputSystem implements System {
  readonly name = 'input';

  /** Gamepad stick deadzone: below this an axis reads as 0. */
  static readonly DEADZONE = 0.15;

  private actions: Record<string, Binding[]> = {};
  private axes: Record<string, AxisDefinition> = {};

  private readonly domTarget: EventTarget;

  private readonly heldKeyboard = new Set<string>();
  private readonly heldMouse = new Set<number>();
  private heldPadButtons = new Set<number>();
  private padAxes: readonly number[] = [];

  private readonly pressedEdges = new Set<string>();
  private readonly releasedEdges = new Set<string>();

  private pointerX = 0;
  private pointerY = 0;
  private attached = false;

  constructor(
    bindings: BindingsConfig = DEFAULT_BINDINGS,
    domTarget: EventTarget = window,
  ) {
    this.loadBindings(bindings);
    this.domTarget = domTarget;
  }

  // === System lifecycle ===

  start(): void {
    if (this.attached) return;
    this.attached = true;
    this.domTarget.addEventListener('keydown', this.onKeyDown);
    this.domTarget.addEventListener('keyup', this.onKeyUp);
    this.domTarget.addEventListener('mousedown', this.onMouseDown);
    this.domTarget.addEventListener('mouseup', this.onMouseUp);
    this.domTarget.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  stop(): void {
    if (!this.attached) return;
    this.attached = false;
    this.domTarget.removeEventListener('keydown', this.onKeyDown);
    this.domTarget.removeEventListener('keyup', this.onKeyUp);
    this.domTarget.removeEventListener('mousedown', this.onMouseDown);
    this.domTarget.removeEventListener('mouseup', this.onMouseUp);
    this.domTarget.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    // Detached input must not report stale held state.
    this.heldKeyboard.clear();
    this.heldMouse.clear();
    this.heldPadButtons.clear();
    this.padAxes = [];
  }

  update(_dt: number, _alpha: number): void {
    // Clear the previous frame's edges — by now every fixedUpdate substep
    // and every earlier update() of the frame has already seen them
    // (ordering contract in the class doc).
    this.pressedEdges.clear();
    this.releasedEdges.clear();
    // Gamepad poll — once per frame, never in fixedUpdate (plan trap #3).
    this.pollGamepads();
  }

  dispose(): void {
    this.stop();
    this.pressedEdges.clear();
    this.releasedEdges.clear();
  }

  // === Bindings management ===

  /** Replace the entire bindings model (e.g. with data loaded from JSON). */
  loadBindings(config: BindingsConfig): void {
    this.actions = structuredClone(config.actions);
    this.axes = structuredClone(config.axes);
  }

  /** Add or replace the bindings of a single action. */
  bindAction(action: string, bindings: readonly Binding[]): void {
    this.actions[action] = structuredClone([...bindings]);
  }

  /** Remove an action. Unknown actions are a no-op. */
  unbindAction(action: string): void {
    delete this.actions[action];
  }

  // === Queries ===

  /**
   * Is the action currently held (keyboard, mouse or gamepad)? Unknown
   * actions read as "not held" — missing bindings must not crash logic.
   */
  isDown(action: string): boolean {
    const bindings = this.actions[action];
    if (!bindings) return false;
    return this.anyHeld(bindings);
  }

  /** Did the action transition to held during this frame? See class doc for
   * the ordering contract and the input-buffer pattern. */
  wasPressedThisFrame(action: string): boolean {
    return this.pressedEdges.has(action);
  }

  /** Did the action transition to released during this frame? */
  wasReleasedThisFrame(action: string): boolean {
    return this.releasedEdges.has(action);
  }

  /**
   * Analog axis value in [-1, 1]: digital bindings contribute ±1, the gamepad
   * stick is added on top (deadzone applied), the sum clamped. Unknown axes
   * read as 0.
   */
  getAxis(axisName: string): number {
    const definition = this.axes[axisName];
    if (!definition) return 0;
    let value = 0;
    if (this.anyHeld(definition.positive)) value += 1;
    if (this.anyHeld(definition.negative)) value -= 1;
    if (definition.gamepad) {
      const raw =
        (this.padAxes[definition.gamepad.index] ?? 0) * definition.gamepad.direction;
      value += Math.abs(raw) < InputSystem.DEADZONE ? 0 : raw;
    }
    return Math.min(1, Math.max(-1, value));
  }

  /** Last pointer position in viewport coordinates. */
  get lastPointerPosition(): { readonly x: number; readonly y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  // === DOM handlers (attached in start, detached in stop) ===

  private readonly onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    const bound = this.actionsBoundToKeyboard(event.code);
    for (const entry of bound) {
      if (entry.preventDefault) event.preventDefault();
    }
    // Auto-repeat must not re-fire the pressed edge; the key is held already.
    if (event.repeat) return;
    const wasHeld = this.heldKeyboard.has(event.code);
    this.heldKeyboard.add(event.code);
    if (wasHeld) return;
    for (const entry of bound) {
      this.pressedEdges.add(entry.action);
    }
  };

  private readonly onKeyUp = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    this.heldKeyboard.delete(event.code);
    for (const entry of this.actionsBoundToKeyboard(event.code)) {
      this.releasedEdges.add(entry.action);
    }
  };

  private readonly onMouseDown = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    const bound = this.actionsBoundToMouse(event.button);
    for (const entry of bound) {
      if (entry.preventDefault) event.preventDefault();
    }
    this.heldMouse.add(event.button);
    for (const entry of bound) {
      this.pressedEdges.add(entry.action);
    }
  };

  private readonly onMouseUp = (event: Event): void => {
    if (!(event instanceof MouseEvent)) return;
    this.heldMouse.delete(event.button);
    for (const entry of this.actionsBoundToMouse(event.button)) {
      this.releasedEdges.add(entry.action);
    }
  };

  private readonly onPointerMove = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    this.pointerX = event.clientX;
    this.pointerY = event.clientY;
  };

  private readonly onBlur = (): void => {
    // Alt-tab / focus loss: release everything held, or keys stay stuck
    // (keyup never fires for a window that lost focus mid-press).
    this.heldKeyboard.clear();
    this.heldMouse.clear();
  };

  private readonly onGamepadConnected = (event: Event): void => {
    if (!(event instanceof GamepadEvent)) return;
    console.info(`[InputSystem] gamepad connected: ${event.gamepad.id}`);
  };

  private readonly onGamepadDisconnected = (event: Event): void => {
    if (!(event instanceof GamepadEvent)) return;
    console.info(`[InputSystem] gamepad disconnected: ${event.gamepad.id}`);
    this.heldPadButtons.clear();
    this.padAxes = [];
  };

  // === Internals ===

  /** Actions bound to a keyboard code, with their preventDefault opt-ins. */
  private actionsBoundToKeyboard(code: string): Array<{ action: string; preventDefault: boolean }> {
    const result: Array<{ action: string; preventDefault: boolean }> = [];
    for (const [action, bindings] of Object.entries(this.actions)) {
      for (const binding of bindings) {
        if (binding.kind === 'keyboard' && binding.code === code) {
          result.push({ action, preventDefault: binding.preventDefault === true });
        }
      }
    }
    return result;
  }

  /** Actions bound to a mouse button, with their preventDefault opt-ins. */
  private actionsBoundToMouse(button: number): Array<{ action: string; preventDefault: boolean }> {
    const result: Array<{ action: string; preventDefault: boolean }> = [];
    for (const [action, bindings] of Object.entries(this.actions)) {
      for (const binding of bindings) {
        if (binding.kind === 'mouse' && binding.button === button) {
          result.push({ action, preventDefault: binding.preventDefault === true });
        }
      }
    }
    return result;
  }

  private anyHeld(bindings: readonly Binding[]): boolean {
    for (const binding of bindings) {
      if (
        (binding.kind === 'keyboard' && this.heldKeyboard.has(binding.code)) ||
        (binding.kind === 'mouse' && this.heldMouse.has(binding.button)) ||
        (binding.kind === 'gamepad' && this.heldPadButtons.has(binding.button))
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Poll gamepads once per frame. First connected pad wins (single-player
   * scope). Tolerates an empty `getGamepads()` — browsers put pads to sleep
   * until the first press (plan trap #3). Button state transitions between
   * polls become action edges; edges recorded here live until the next
   * frame's clear (one frame latency — see class doc).
   */
  private pollGamepads(): void {
    let firstPad: Gamepad | null = null;
    for (const pad of navigator.getGamepads()) {
      if (pad) {
        firstPad = pad;
        break;
      }
    }

    const next = new Set<number>();
    if (firstPad) {
      firstPad.buttons.forEach((button, index) => {
        if (button.pressed) next.add(index);
      });
      this.padAxes = [...firstPad.axes];
    } else {
      this.padAxes = [];
    }

    for (const index of next) {
      if (!this.heldPadButtons.has(index)) {
        this.addPadEdge(index, this.pressedEdges);
      }
    }
    for (const index of this.heldPadButtons) {
      if (!next.has(index)) {
        this.addPadEdge(index, this.releasedEdges);
      }
    }
    this.heldPadButtons = next;
  }

  /** Map a gamepad button transition to every action bound to that button. */
  private addPadEdge(buttonIndex: number, edges: Set<string>): void {
    for (const [action, bindings] of Object.entries(this.actions)) {
      for (const binding of bindings) {
        if (binding.kind === 'gamepad' && binding.button === buttonIndex) {
          edges.add(action);
        }
      }
    }
  }
}