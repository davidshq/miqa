module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    'plugin:vue/recommended',
    'plugin:vuetify/recommended',
    '@vue/airbnb',
    '@vue/typescript/recommended',
    'prettier',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: {
      js: '@babel/eslint-parser',
      ts: '@typescript-eslint/parser',
    },
  },
  rules: {
    'no-console': 'off',
    'no-param-reassign': 'off',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'vue/valid-template-root': 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
  },
  ignorePatterns: [
    'src/shims-*.d.ts',
  ],
  overrides: [
    {
      files: [
        '**/__tests__/*.{j,t}s?(x)',
        '**/tests/unit/**/*.spec.{j,t}s?(x)',
      ],
      env: {
        jest: true,
      },
    },
  ],
  settings: {
    'import/resolver': {
      "typescript": {},
      }
    }
};
