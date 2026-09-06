/**
 * Game 1 bindings — the engine defaults plus two PRODUCT-layer actions,
 * data-only (no engine file is modified for Game 1).
 *
 *  - 'fire': mouse primary + gamepad RT (button 7, standard mapping).
 *    DECISION: RT, not the south button. South (0) is already 'jump' AND
 *    'confirm' in DEFAULT_BINDINGS — reusing it for HOLD-fire would fire a
 *    buffered jump hop on every trigger pull and double-confirm menus.
 *    RT (button 7) is unbound in the defaults and is the twin-stick
 *    shooter convention for the trigger, so hold-fire maps to hold-RT.
 *  - 'restart': R key (single-use edge, read while a round ended).
 *
 * Everything else (move axes, aim axes, jump, back, …) is inherited
 * verbatim from the engine defaults.
 */
import { DEFAULT_BINDINGS } from '../core/Bindings';
import type { BindingsConfig } from '../core/Bindings';

export const GAME1_BINDINGS: BindingsConfig = {
  actions: {
    ...DEFAULT_BINDINGS.actions,
    fire: [
      { kind: 'mouse', button: 0 },
      { kind: 'gamepad', button: 7 },
    ],
    restart: [{ kind: 'keyboard', code: 'KeyR' }],
  },
  axes: DEFAULT_BINDINGS.axes,
};
