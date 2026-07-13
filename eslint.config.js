// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores(['dist', 'storybook-static', 'coverage', '.claude']), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    // Legitimate data-fetching and dialog-hydration patterns use setState in effects today.
    // Prefer moving to event handlers or transitions when touching these call sites.
    'react-hooks/set-state-in-effect': 'off',
  },
}, {
  // shadcn/ui components often export both components and variants/constants.
  // That pattern is safe here; disable the fast-refresh limitation for this folder.
  files: ['src/ui/**/*.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  files: ['src/provider/theme-provider.tsx'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, ...storybook.configs["flat/recommended"]])
