import * as THREE from 'three';
import { SPAWN_PADS } from './arenaMath';

/**
 * ArenaVisuals (Game 1, Sprint 0) — builds the whole three.js side of the
 * arena in one constructor: floor + grid, boundary walls, magenta spawn
 * pads, the cyan player body with its accent light, aim indicator meshes
 * and the enemy mesh factory. The game layer law allows three.js here
 * (product layer, like src/examples); every system only receives the
 * meshes it drives.
 *
 * FEEL is the product (plan pillar #1/#3): faction palette from day one —
 * player/own = cyan, enemy = magenta — dark high-contrast arena blockout,
 * primitive meshes (capsules/boxes) for readability over detail.
 */
export const PLAYER_COLOR = 0x22d3ee;
export const ENEMY_COLOR = 0xff2fd6;

const ARENA_SIZE = 40;
const WALL_HEIGHT = 1.6;
const WALL_THICKNESS = 1;
const PLAYER_MESH_HALF_HEIGHT = 0.8; // CapsuleGeometry(0.4, 0.8) is 1.6 tall

/** Enemy mesh type: shared geometry, per-runner material (kill-fade owns opacity). */
export type EnemyMesh = THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;

export class ArenaVisuals {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly playerMesh: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>;
  readonly aimBar: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  readonly aimMarker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly muzzle: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  /** Parent for shot tracers (weapon system adds/removes pool meshes here). */
  readonly fxGroup: THREE.Group;

  private readonly enemyGeometry: THREE.CapsuleGeometry;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 16, 12);
    this.camera.lookAt(0, 0.6, 0);

    this.scene.add(new THREE.AmbientLight(0x8fa3b8, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(6, 14, 4);
    this.scene.add(sun);

    // Floor + grid: dark, high-contrast, readable zones.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshStandardMaterial({ color: 0x0b0f16, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const grid = new THREE.GridHelper(ARENA_SIZE, 20, 0x2a6f7f, 0x141b26);
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Boundary walls (inner faces at ±19.5 — matches ARENA_BOUNDS ±19).
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x1c2637, roughness: 0.85 });
    for (const [x, z, horizontal] of [
      [0, -20, true],
      [0, 20, true],
      [-20, 0, false],
      [20, 0, false],
    ] as const) {
      const wall = new THREE.Mesh(
        horizontal
          ? new THREE.BoxGeometry(ARENA_SIZE + 2 * WALL_THICKNESS, WALL_HEIGHT, WALL_THICKNESS)
          : new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ARENA_SIZE + 2 * WALL_THICKNESS),
        wallMaterial,
      );
      wall.position.set(x, WALL_HEIGHT / 2, z);
      this.scene.add(wall);
    }

    // Enemy spawn pads: magenta markers on the four wall midpoints.
    const padGeometry = new THREE.CircleGeometry(1.4, 24);
    const padMaterial = new THREE.MeshBasicMaterial({
      color: ENEMY_COLOR,
      transparent: true,
      opacity: 0.8,
    });
    for (const pad of SPAWN_PADS) {
      const marker = new THREE.Mesh(padGeometry, padMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(pad.x, 0.03, pad.z);
      this.scene.add(marker);
    }

    // Player: cyan capsule with a cyan accent light riding on it.
    this.playerMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8, 4, 12),
      new THREE.MeshStandardMaterial({
        color: PLAYER_COLOR,
        emissive: PLAYER_COLOR,
        emissiveIntensity: 0.4,
        roughness: 0.4,
        metalness: 0.1,
      }),
    );
    this.playerMesh.position.set(0, PLAYER_MESH_HALF_HEIGHT, 0);
    const playerLight = new THREE.PointLight(PLAYER_COLOR, 24, 14, 2);
    playerLight.position.set(0, 1.4, 0);
    this.playerMesh.add(playerLight);
    this.scene.add(this.playerMesh);

    // Aim indicator: a short cyan bar from the player + a flat ring marker
    // at the aim point (both repositioned by AimSystem every frame).
    this.aimBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 1.2),
      new THREE.MeshBasicMaterial({ color: PLAYER_COLOR }),
    );
    this.aimBar.position.set(0, 0.95, 1.5);
    this.scene.add(this.aimBar);

    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: PLAYER_COLOR, transparent: true, opacity: 0.75 }),
    );
    this.aimMarker.rotation.x = -Math.PI / 2;
    this.aimMarker.position.set(0, 0.03, 4);
    this.scene.add(this.aimMarker);

    // Muzzle flash: small bright sphere, shown ~60 ms per shot by the weapon.
    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xcaf7ff, transparent: true, opacity: 1 }),
    );
    this.muzzle.visible = false;
    this.scene.add(this.muzzle);

    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    this.enemyGeometry = new THREE.CapsuleGeometry(0.35, 0.7, 4, 10);
  }

  /**
   * Fresh runner mesh: shared geometry, OWN material (each runner fades
   * independently in the kill flash). The caller disposes the material;
   * the geometry stays shared for the page lifetime.
   */
  createEnemyMesh(): EnemyMesh {
    return new THREE.Mesh(
      this.enemyGeometry,
      new THREE.MeshStandardMaterial({
        color: ENEMY_COLOR,
        emissive: ENEMY_COLOR,
        emissiveIntensity: 0.55,
        roughness: 0.5,
        transparent: true,
      }),
    );
  }
}

/** Enemy body center height (matches the hitscan sphere center Y). */
export const RUNNER_CENTER_Y = 0.7; // CapsuleGeometry(0.35, 0.7) is 1.4 tall
