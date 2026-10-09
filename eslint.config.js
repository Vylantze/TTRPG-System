import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

const sourceFiles = ['**/*.{js,mjs,cjs,jsx,ts,tsx}'];

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/.*']),
  {
    files: sourceFiles,
    extends: [
      js.configs.recommended,
      stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: true,
        jsx: true,
        braceStyle: '1tbs',
        arrowParens: true,
        commaDangle: 'always-multiline',
      }),
    ],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'eqeqeq': ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true }],
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.es2022 },
  },
  {
    files: ['ui/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    files: ['eslint.config.js', 'tools/**/*.{js,mjs,cjs}', 'tests/**/*.js', 'examples/**/*.js', 'ui/vite.config.js', 'ui/tests/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    // Server-rendering tests explicitly supply a simulated browser environment.
    files: ['ui/tests/**/*.mjs'],
    languageOptions: { globals: { window: 'readonly', localStorage: 'readonly' } },
  },
]);
