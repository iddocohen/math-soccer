// Copied from math-tank eslint.config.js. The math and physics import rules are left out: math-soccer has no
// src/core/physics.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const frameworkImports = [
  { name: 'phaser', message: 'src/core must stay engine-free (research R1).' },
  { name: 'react', message: 'src/core must stay framework-free (research R1).' },
  { name: 'react-dom', message: 'src/core must stay framework-free (research R1).' },
];

const frameworkPatterns = [
  { group: ['phaser/*', 'react/*', 'react-dom/*'], message: 'src/core must stay engine- and framework-free (research R1).' },
];

export default tseslint.config(
  { ignores: ['dist/', 'dist-base/', 'dev-dist/', 'coverage/', 'node_modules/', 'playwright-report/', 'test-results/', 'blob-report/', 'specs/', '.specify/', '.claude/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded Rng from src/core/rng.ts (research R1).' },
      ],
      'no-restricted-imports': ['error', { paths: frameworkImports, patterns: frameworkPatterns }],
    },
  },
);
