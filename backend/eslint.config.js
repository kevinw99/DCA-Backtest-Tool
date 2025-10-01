const jest = require('eslint-plugin-jest');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
      },
    },
    plugins: {
      jest,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['**/*.test.js', '**/__tests__/**/*.js'],
    ...jest.configs['flat/recommended'],
    rules: {
      'jest/expect-expect': 'error',
      'jest/no-disabled-tests': 'warn',
    },
  },
  prettier,
];
