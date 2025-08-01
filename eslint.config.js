import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // FoundryVTT globals
        game: 'readonly',
        ui: 'readonly',
        canvas: 'readonly',
        CONFIG: 'readonly',
        CONST: 'readonly',
        foundry: 'readonly',
        Actor: 'readonly',
        Item: 'readonly',
        Token: 'readonly',
        Scene: 'readonly',
        User: 'readonly',
        ChatMessage: 'readonly',
        Roll: 'readonly',
        Dialog: 'readonly',
        Application: 'readonly',
        FormApplication: 'readonly',
        Hooks: 'readonly',
        loadTemplates: 'readonly',
        renderTemplate: 'readonly',
        duplicate: 'readonly',
        mergeObject: 'readonly',
        setProperty: 'readonly',
        getProperty: 'readonly',
        hasProperty: 'readonly',
        expandObject: 'readonly',
        flattenObject: 'readonly',
        isObjectEmpty: 'readonly',
        randomID: 'readonly',
        // Browser globals
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': 'error',
      'curly': 'error',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { 'avoidEscape': true }],
      'indent': ['error', 2],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      'comma-dangle': 'off',
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-function-paren': 'off',
      'keyword-spacing': 'error',
      'space-infix-ops': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 2 }]
    }
  }
];
