// ═══════════════════════════════════════════════════════════════════════════════
// NovaOS Backend — ESLint Configuration (Flat Config for ESLint 9+)
// ═══════════════════════════════════════════════════════════════════════════════

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // ─────────────────────────────────────────────────────────────────────────────
  // GLOBAL IGNORES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
    ],
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BASE CONFIGURATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TYPESCRIPT FILES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      // ─────────────────────────────────────────────────────────────────────────
      // TYPESCRIPT RULES
      // ─────────────────────────────────────────────────────────────────────────
      
      // Allow explicit any in specific cases (gradually tighten)
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // Require explicit return types on exports
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      
      // Prefer nullish coalescing
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      
      // Prefer optional chaining
      '@typescript-eslint/prefer-optional-chain': 'warn',
      
      // No floating promises (must handle or void)
      '@typescript-eslint/no-floating-promises': 'error',
      
      // No misused promises
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],
      
      // Allow non-null assertions (but use sparingly)
      '@typescript-eslint/no-non-null-assertion': 'warn',
      
      // ─────────────────────────────────────────────────────────────────────────
      // GENERAL RULES
      // ─────────────────────────────────────────────────────────────────────────
      
      // Enforce consistent brace style
      'curly': ['error', 'all'],
      
      // Require === and !==
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      
      // No console.log in production (allow warn, error)
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      
      // No debugger
      'no-debugger': 'error',
      
      // Prefer const
      'prefer-const': 'error',
      
      // No var
      'no-var': 'error',
      
      // Require return await in try/catch
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TEST FILES (relaxed rules)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    files: ['src/tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'no-console': 'off',
    },
  },
);
