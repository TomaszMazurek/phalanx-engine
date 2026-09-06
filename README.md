# Phalanx — browser game engine on three.js

Phalanx started in 2019 as a student dream of building a game engine — one README,
four commits, then silence. In 2026 it was revived as a browser game engine on
three.js. The original 2019 repository lives on in the [`legacy-2019`](../../tree/legacy-2019)
branch.

Master plan: [`docs/ENGINE_PLAN.md`](docs/ENGINE_PLAN.md),
Phase 1 plan: [`docs/phase-1-foundation.md`](docs/phase-1-foundation.md),
Phase 2 plan: [`docs/phase-2-core.md`](docs/phase-2-core.md).

## Demo

**Live demo:** https://phalanx-engine.tomasz-a-mazurek.workers.dev — engine demo (menu → gameplay);
[viewer](https://phalanx-engine.tomasz-a-mazurek.workers.dev/viewer) — material tool (Phase 3);
**[game1](https://phalanx-engine.tomasz-a-mazurek.workers.dev/game1) — Arena Defense Shooter (Game 1, WIP — Sprint 0 playable)**.

Locally: `npm run dev` → http://localhost:5173 (Phase 2 engine demo: menu → gameplay),
http://localhost:5173/viewer.html (material tool).

### Material tool (Phase 3, `viewer.html`)

- **Material editor** — lil-gui panel over a declarative `MaterialDefinition`:
  identity, params, UV transform and per-slot maps, applied live to the scene
  (in-place updates; a shading switch recompiles). JSON export/import round-trip.
  v1 limitation: `uri` map sources stay unbound — the compiler's resolver is
  synchronous (never loads), so only loaded texture sets can serve a slot;
  async URI resolution is deferred.
- **IBL environments** — HDR presets from `public/env/manifest.json` (PMREM baked
  once per HDRI; skybox / blurred / off backgrounds).
- **Lighting presets** — `public/lighting/presets.json` (day / dusk / arena)
  applied onto the rig.
- **glTF models** — `model:*` shapes stream through the AssetManager, including
  the compressed variants (Draco, meshopt).

Compression on the demo asset (bytes on disk, `public/models/`):

| Variant                           | Bytes  | vs `.gltf` |
| --------------------------------- | ------ | ---------- |
| `demo-cube.gltf` (uncompressed)   | 3433 B | —          |
| `demo-cube-draco.glb` (Draco)     | 1196 B | −65%       |
| `demo-cube-meshopt.glb` (meshopt) | 2544 B | −26%       |

Toy asset — the numbers favor Draco on tiny meshes; meshopt aims for load-time
(decode on the fly), not smallest bytes.

## Run

```bash
npm install
npm run dev      # dev server (Vite)
npm run build    # typecheck (tsc -b) + production build → dist/ (two pages: index.html, viewer.html)
npm run test     # vitest (unit tests)
npm run lint     # ESLint
npm run format   # Prettier
```

No manual steps — all dependencies come from npm (the old `libs/` vendoring is gone for good).

## Stack & versions (recorded at project init — Phase 1, task 1)

| Dependency | Version | Note                                                                                            |
| ---------- | ------- | ----------------------------------------------------------------------------------------------- |
| three      | 0.185.1 | rendering foundation; new code, **not** a migration of legacy r~120                             |
| lil-gui    | 0.21.x  | dev panels                                                                                      |
| vite       | 8.2.x   | bundler / dev server                                                                            |
| typescript | ~5.9    | **deliberately not TS 7.0 (tsgo)** — typescript-eslint support for 5.x is mature; revisit later |
| @types/three | ~0.185 | three does not bundle types                                                                    |

## Structure

```
src/
  core/        # engine, zero three.js imports (Engine, GameLoop — Phase 2)
  render/      # three.js adapter (Renderer, CameraRig, MeshFactory, LightingRig)
  assets/      # AssetManager, TextureLibrary, manifest
  editor/      # dev panels (DevPanel, MaterialEditor + MaterialDraft)
  examples/    # usage examples (MaterialViewer — the old app reborn)
public/
  textures/    # PBR texture sets + skyboxes (from the legacy app)
docs/          # plans: ENGINE_PLAN.md, phase-1-foundation.md
legacy/        # the old materialeditor_js app — reference only, not runnable
```

## Conventions (Phase 1 rules)

- No `any`, no `eval`, no globals — enforced by ESLint.
- Only `src/render` and `src/examples` touch three.js directly; `src/core` and
  `src/editor` stay renderer-agnostic.
- The legacy app (`legacy/`) is never modified — it is a semantic reference for porting.
