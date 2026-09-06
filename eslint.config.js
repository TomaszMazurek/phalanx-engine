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
    // Phase 2 boundary (docs/phase-2-core.md, note 9): the engine core and the
    // scene layer must stay renderer-agnostic — no three.js imports outside
    // the render/ and assets/ adapter layers. src/scenes/ does not exist yet;
    // a flat-config glob matching no files is simply inert, so it is safe to
    // declare it now (rule becomes active the day the directory appears).
    files: ['src/core/**', 'src/scenes/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/**'],
              message: 'src/core and src/scenes must not import three.js directly — go through the render/ (or assets/) adapter layer (plan decision #5, phase-2-core.md note 9).',
            },
          ],
        },
      ],
    },
  },
);
