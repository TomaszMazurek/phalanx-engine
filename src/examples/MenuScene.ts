import type { EventBus } from '../core/EventBus';
import type { System } from '../core/System';
import { Scene } from '../scenes/Scene';
import type { GameEvents } from './GameEvents';

/**
 * MenuScene — the Phase 2 demo landing scene (docs/phase-2-core.md, task 6).
 *
 * Pure DOM glue: a centered overlay with a title and a Play button that
 * publishes 'menu/play' on the app bus; main.ts owns the actual switch
 * (scenes stay decoupled from SceneManager). No unit tests on purpose —
 * DOM glue is covered by Wave F manual acceptance; the emitted event and
 * the switch itself are exercised by the SceneManager/GameplayScene suites.
 */
export class MenuScene extends Scene {
  readonly id = 'menu';

  private root: HTMLDivElement | null = null;
  private readonly events: EventBus<GameEvents>;

  constructor(events: EventBus<GameEvents>) {
    super();
    this.events = events;
  }

  createSystems(): System[] {
    return [];
  }

  override enter(): void {
    const root = document.createElement('div');
    root.style.cssText = [
      'position:fixed',
      'inset:0',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:20px',
      'z-index:5',
      'background:#0d1117',
      'color:#e6edf3',
      'font-family:system-ui,sans-serif',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = 'Engine — Phase 2 demo';
    title.style.cssText = 'margin:0;font-weight:300;letter-spacing:0.12em;font-size:2rem';

    const hint = document.createElement('p');
    hint.textContent = 'WASD / left stick — move · Space / pad south — jump · I — interpolation · Esc — back';
    hint.style.cssText = 'margin:0;font-weight:300;color:#8b949e;font-size:0.85rem';

    const play = document.createElement('button');
    play.textContent = 'Play';
    play.style.cssText = [
      'padding:10px 44px',
      'font-size:1.1rem',
      'font-weight:600',
      'color:#0d1117',
      'background:#e6edf3',
      'border:none',
      'border-radius:6px',
      'cursor:pointer',
    ].join(';');
    // Node-local listener: removing the root in exit() drops it — no manual
    // teardown needed (leak discipline targets bus subscriptions).
    play.addEventListener('click', () => {
      this.events.emit('menu/play', { via: 'ui' });
    });

    root.append(title, hint, play);
    document.body.appendChild(root);
    this.root = root;
  }

  override exit(): void {
    this.root?.remove();
  }

  override dispose(): void {
    this.root = null;
  }
}
