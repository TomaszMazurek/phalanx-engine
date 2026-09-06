import type { AudioSystem } from '../core/AudioSystem';
import type { InputSystem } from '../core/InputSystem';
import type { System } from '../core/System';
import type { RenderSystem } from '../render/RenderSystem';
import { TraumaShake } from '../render/CameraShake';
import { ArenaVisuals } from './ArenaVisuals';
import { RoundState } from './RoundState';
import { AimSystem } from './systems/AimSystem';
import { CameraSystem } from './systems/CameraSystem';
import { EnemySystem } from './systems/EnemySystem';
import { HudSystem } from './systems/HudSystem';
import { PlayerSystem } from './systems/PlayerSystem';
import { RoundSystem } from './systems/RoundSystem';
import { WaveSystem } from './systems/WaveSystem';
import { WeaponSystem } from './systems/WeaponSystem';

/**
 * ArenaGame (Game 1, Sprint 0) — composition root for the arena-defense
 * "30 seconds of fun" build: builds the three.js arena, instantiates the
 * engine systems (Health, WaveDirector, TraumaShake, AudioSystem are
 * engine code used verbatim) and wires them into focused product-layer
 * systems. main.ts registers [..gameSystems, render, input].
 *
 * REGISTRATION ORDER (per-phase contract; see each system's doc):
 *  - fixedUpdate: player → waves (spawn) → enemies (seek/touch) → weapon
 *    (fire) → round (outcome poll).
 *  - update: player (edge buffer + render cache) → camera (follow; matrix
 *    refreshed for the raycast) → aim (raycast through THIS frame's
 *    camera) → enemies (mesh sync at alpha) → weapon (fx decay) → round
 *    (result overlay + restart edge) → hud (bars, marker, DebugHUD).
 * InputSystem itself is registered LAST by main.ts — its update() clears
 * the input edges every other input consumer above has consumed.
 *
 * Restart (R) is a full state reset without a page reload: the onRestart
 * callback below is the single ordered place every subsystem resets.
 */
export interface ArenaGameDeps {
  readonly render: RenderSystem;
  readonly input: InputSystem;
  readonly audio: AudioSystem;
}

export class ArenaGame {
  readonly systems: readonly System[];

  constructor(deps: ArenaGameDeps) {
    const visuals = new ArenaVisuals();
    deps.render.setRenderOutput(visuals.scene, visuals.camera);
    deps.render.onResize(() => {
      visuals.camera.aspect = window.innerWidth / window.innerHeight;
      visuals.camera.updateProjectionMatrix();
    });

    // Shared game state (pure engine pieces).
    const round = new RoundState();
    const shake = new TraumaShake();

    // Product-layer systems.
    const player = new PlayerSystem(deps.input, visuals.playerMesh);
    const camera = new CameraSystem(visuals.camera, shake, player);
    const enemies = new EnemySystem({
      player,
      audio: deps.audio,
      shake,
      round,
      scene: visuals.scene,
      createEnemyMesh: () => visuals.createEnemyMesh(),
    });
    const waves = new WaveSystem({ enemies, audio: deps.audio, round });
    const aim = new AimSystem(
      deps.input,
      visuals.camera,
      () => player.renderedPosition,
      visuals.aimBar,
      visuals.aimMarker,
    );
    const hud = new HudSystem(player, waves);
    const weapon = new WeaponSystem({
      input: deps.input,
      player,
      aim,
      enemies,
      hud,
      audio: deps.audio,
      shake,
      round,
      muzzle: visuals.muzzle,
      fxGroup: visuals.fxGroup,
    });

    const restartRound = (): void => {
      round.restart();
      player.respawn();
      enemies.clear();
      waves.restart();
      weapon.reset();
      camera.snap();
      hud.reset();
    };
    const roundSystem = new RoundSystem({
      player,
      enemies,
      waves,
      round,
      input: deps.input,
      onRestart: restartRound,
    });

    this.systems = [player, camera, waves, aim, enemies, weapon, roundSystem, hud];
  }
}
