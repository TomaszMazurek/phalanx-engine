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
[viewer](https://phalanx-engine.tomasz-a-mazurek.workers.dev/viewer) — Phase 1 material viewer.

Locally: `npm run dev` → http://localhost:5173 (Phase 2 engine demo: menu → gameplay),
http://localhost:5173/viewer.html (Phase 1 material viewer).

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
  editor/      # dev panels (DevPanel, later MaterialEditor)
  examples/    # usage examples (MaterialViewer — the old app reborn)
public/
  textures/    # PBR texture sets + skyboxes (from the legacy app)
docs/          # plans: ENGINE_PLAN.md, phase-1-foundation.md
legacy/        # the old materialeditor_js app — reference only, not runnable
```

## Conventions (Phase 1 rules)

- No `any`, no `eval`, no globals — enforced by ESLint.
- Only `src/render` touches three.js directly; `src/core` stays renderer-agnostic.
- The legacy app (`legacy/`) is never modified — it is a semantic reference for porting.
