import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/', '**/node_modules/', 'api/'] },

  // Base JS/TS rules for all files
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Shared & server files (Node)
  {
    files: ['server/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Client files (React)
  {
    files: ['client/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // Disable react-refresh for shadcn UI files and providers (they export non-components)
  {
    files: ['client/src/components/ui/**/*.{ts,tsx}', 'client/src/providers/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Relax rules that conflict with our patterns
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
