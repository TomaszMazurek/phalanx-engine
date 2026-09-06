/**
 * Bindings — the data model connecting abstract actions to physical inputs
 * (Phase 2, docs/phase-2-core.md: "akcje abstrakcyjne" — bind 'jump' → key,
 * never `if (key === ' ')` in game logic).
 *
 * Pure JSON-serializable data, no functions: this structure is what a future
 * editor (Phase 5) will load and save. InputSystem interprets it; nothing
 * here knows about the DOM or any device.
 */

/** Physical keyboard input, `KeyboardEvent.code` (layout-independent): 'KeyW', 'Space'. */
export type KeyboardCode = string;

/** Gamepad button, standard-mapping index (0 = south button: "A"/cross). */
export type GamepadButton = number;

/** Mouse button, `MouseEvent.button` (0 = primary/left, 2 = secondary/right). */
export type MouseButton = number;

/**
 * One physical input bound to an action. `preventDefault` opts the binding
 * into suppressing the browser behavior (Space scrolling the page, mouse
 * selection...). It applies ONLY to explicitly bound inputs — unbound keys
 * (F12, Ctrl+Shift+I, devtools shortcuts) are never touched.
 */
export type Binding =
  | { kind: 'keyboard'; code: KeyboardCode; preventDefault?: boolean }
  | { kind: 'mouse'; button: MouseButton; preventDefault?: boolean }
  | { kind: 'gamepad'; button: GamepadButton };

/** Action name → physical inputs that trigger it (OR semantics). */
export type ActionBindings = Record<string, Binding[]>;

/** Analog source on a gamepad: index into `Gamepad.axes` plus a direction sign. */
export interface GamepadAxisSource {
  /** Index into `Gamepad.axes` (0 = left stick X, 1 = left stick Y). */
  index: number;
  /** +1 normal, -1 inverted. */
  direction: 1 | -1;
}

/** One analog axis: digital bindings plus an optional gamepad stick. */
export interface AxisDefinition {
  /** Inputs pushing the axis toward -1 when held. */
  negative: Binding[];
  /** Inputs pushing the axis toward +1 when held. */
  positive: Binding[];
  /** Optional analog gamepad source, added on top of the digital part. */
  gamepad?: GamepadAxisSource;
}

/** Axis name → definition. */
export type AxisDefinitions = Record<string, AxisDefinition>;

/** The whole bindings model — the single argument of `InputSystem.loadBindings()`. */
export interface BindingsConfig {
  actions: ActionBindings;
  axes: AxisDefinitions;
}

/**
 * Default configuration — also the reference data shape for editor
 * integration (Phase 5): one plain object, serializable as-is.
 *
 * Note on moveY: gamepad left stick Y is negative when pushed up (DOM
 * convention), while the keyboard treats W (up) as positive — hence
 * direction: -1 to make stick-up read like W.
 */
export const DEFAULT_BINDINGS: BindingsConfig = {
  actions: {
    jump: [
      { kind: 'keyboard', code: 'Space', preventDefault: true },
      { kind: 'gamepad', button: 0 },
    ],
    confirm: [{ kind: 'keyboard', code: 'Enter' }, { kind: 'gamepad', button: 0 }],
    primary: [{ kind: 'mouse', button: 0 }],
    secondary: [{ kind: 'mouse', button: 2 }],
    toggleInterpolation: [{ kind: 'keyboard', code: 'KeyI' }],
    back: [{ kind: 'keyboard', code: 'Escape' }],
  },
  axes: {
    moveX: {
      negative: [{ kind: 'keyboard', code: 'KeyA' }],
      positive: [{ kind: 'keyboard', code: 'KeyD' }],
      gamepad: { index: 0, direction: 1 },
    },
    moveY: {
      negative: [{ kind: 'keyboard', code: 'KeyS' }],
      positive: [{ kind: 'keyboard', code: 'KeyW' }],
      gamepad: { index: 1, direction: -1 },
    },
    // Aiming: right stick only (twin-stick shooter, Game 1 Sprint 0) — no
    // keyboard bindings, so `negative`/`positive` stay empty and the axis
    // reads purely from the analog source. aimY inverts like moveY: right
    // stick up reads positive.
    aimX: {
      negative: [],
      positive: [],
      gamepad: { index: 2, direction: 1 },
    },
    aimY: {
      negative: [],
      positive: [],
      gamepad: { index: 3, direction: -1 },
    },
  },
};