import { FlatCompat } from '@eslint/eslintrc';
import tsdoc from 'eslint-plugin-tsdoc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/lib/**/*.ts'],
    plugins: { tsdoc },
    rules: {
      'tsdoc/syntax': 'warn',
    },
  },
  {
    files: ['src/__tests__/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
];

export default config;
