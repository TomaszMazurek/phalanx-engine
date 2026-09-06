// ESLint flat config — TypeScript + browser project
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', 'legacy/', 'public/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // Phase 1 rule from docs/phase-1-foundation.md: no `any` in new code
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Node scripts (asset generators) run outside the browser; declare the
    // few Node globals they use instead of pulling in a `globals` package.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { Buffer: 'readonly', console: 'readonly' },
    },
  },
  {
    // Phase 2 boundary (docs/phase-2-core.md, note 9): the engine core, the
    // scene layer and the generic asset cache must stay renderer-agnostic —
    // no three.js imports outside the render/ adapter layer. Three-facing
    // loaders (e.g. GLTFAdapter) live in render/; assets/ holds the pure
    // TS cache + manifest types. src/scenes/ files exist since Wave B; a
    // flat-config glob matching no files is simply inert, so extending the
    // glob ahead of a directory is safe.
    //
    // Phase 3 wave C addition: src/editor is DOM/gui ONLY — panels, HUD,
    // overlays and the pure editor data model (MaterialDraft). It must not
    // import three either; render/MaterialTarget bridges editor definitions
    // to meshes (the editor layer stays one-way: types flow out, no engine
    // types flow in).
    files: ['src/core/**', 'src/scenes/**', 'src/assets/**', 'src/editor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/**'],
              message: 'src/core, src/scenes, src/assets and src/editor must not import three.js directly — go through the render/ adapter layer (plan decision #5, phase-2-core.md note 9).',
            },
          ],
        },
      ],
    },
  },
);
