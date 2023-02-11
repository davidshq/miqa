module.exports = {
  root: true,

  env: {
    node: true,
  },
  parser: 'vue-eslint-parser',

  parserOptions: {
    parser: {
      js: 'babel-eslint',
      ts: '@typescript-eslint/parser',
    },
  },

  rules: {
    'no-console': 'off',
    'no-param-reassign': 'off',
    'no-underscore-dangle': 'off',
    'func-names': 'off',
    'vue/valid-template-root': 'warn',
    'no-debugger': 'off',
    'vue/attribute-hyphenation': 'warn',
    'vue/attributes-order': 'warn',
    'vue/block-tag-newline': 'warn',
    'vue/comment-directive': 'warn',
    'vue/component-api-style': 'warn',
    'vue/component-definition-name-casing': 'warn',
    'vue/component-name-in-template-casing': 'warn',
    'vue/component-tags-order': 'warn',
    'vue/custom-event-name-casing': 'warn',
    'vue/experimental-script-setup-vars': 'warn',
    'vue/html-button-has-type': 'warn',
    'vue/html-closing-bracket-newline': 'warn',
    'vue/html-closing-bracket-spacing': 'warn',
    'vue/html-comment-content-newline': 'warn',
    'vue/html-comment-content-spacing': 'warn',
    'vue/html-comment-indent': 'warn',
    'vue/jsx-uses-vars': 'warn',
    'vue/match-component-file-name': 'warn',
    'vue/multi-word-component-names': 'warn',
    'vue/multiline-html-element-content-newline': 'warn',
    'vue/mustache-interpolation-spacing': 'warn',
    'vue/name-property-casing': 'warn',
    'vue/new-line-between-multi-line-property': 'warn',
    'vue/next-tick-style': 'warn',
    'vue/no-arrow-functions-in-watch': 'warn',
    'vue/no-async-in-computed-properties': 'warn',
    'vue/no-bare-strings-in-template': 'warn',
    'vue/no-boolean-default': 'warn',
    'vue/no-computed-properties-in-data': 'warn',
    'vue/no-confusing-v-for-v-if': 'warn',
    'vue/no-custom-modifiers-on-v-model': 'warn',
    'vue/no-deprecated-data-object-declaration': 'warn',
    'vue/no-deprecated-destroyed-lifecycle': 'warn',
    'vue/no-deprecated-dollar-listeners-api': 'warn',
    'vue/no-deprecated-dollar-scopedslots-api': 'warn',
    'vue/no-deprecated-events-api': 'warn',
    'vue/no-deprecated-filter': 'warn',
    'vue/no-deprecated-functional-template': 'warn',
    'vue/no-deprecated-html-element-is': 'warn',
    'vue/no-deprecated-inline-template': 'warn',
    'vue/no-deprecated-props-default-this': 'warn',
    'vue/no-deprecated-router-link-tag-prop': 'warn',
    'vue/no-deprecated-scope-attribute': 'warn',
    'vue/no-deprecated-slot-attribute': 'warn',
    'vue/no-deprecated-slot-scope-attribute': 'warn',
    'vue/no-deprecated-v-bind-sync': 'warn',
    'vue/no-deprecated-v-is': 'warn',
    'vue/no-deprecated-v-on-native-modifier': 'warn',
    'vue/no-deprecated-v-on-number-modifiers': 'warn',
    'vue/no-deprecated-vue-config-keycodes': 'warn',
    'vue/no-dupe-keys': 'warn',
    'vue/no-dupe-v-else-if': 'warn',
    'vue/no-duplicate-attr-inheritance': 'warn',
    'vue/no-duplicate-attributes': 'warn',
    'vue/no-empty-component-block': 'warn',
    'vue/no-export-in-script-setup': 'warn',
    'vue/no-invalid-model-keys': 'warn',
    'vue/no-irregular-whitespace': 'warn',
    'vue/no-lifecycle-after-await': 'warn',
    'vue/no-lone-template': 'warn',
    'vue/no-multi-spaces': 'warn',
    'vue/no-multiple-objects-in-class': 'warn',
    'vue/no-multiple-slot-args': 'warn',
    'vue/no-multiple-template-root': 'warn',
    'vue/no-mutating-props': 'warn',
    'vue/no-parsing-error': 'warn',
    'vue/no-potential-component-option-typo': 'warn',
    'vue/no-ref-as-operand': 'warn',
    'vue/no-reserved-component-names': 'warn',
    'vue/no-reserved-keys': 'warn',
    'vue/no-restricted-block': 'warn',
    'vue/no-restricted-call-after-await': 'warn',
    'vue/no-restricted-class': 'warn',
    'vue/no-restricted-component-options': 'warn',
    'vue/no-restricted-custom-event': 'warn',
    'vue/no-restricted-props': 'warn',
    'vue/no-restricted-static-attribute': 'warn',
    'vue/no-restricted-v-bind': 'warn',
    'vue/no-setup-props-destructure': 'warn',
    'vue/no-shared-component-data': 'warn',
    'vue/no-side-effects-in-computed-properties': 'warn',
    'vue/no-spaces-around-equal-signs-in-attribute': 'warn',
    'vue/no-static-inline-styles': 'warn',
    'vue/no-template-key': 'warn',
    'vue/no-template-shadow': 'warn',
    'vue/no-template-target-blank': 'warn',
    'vue/no-textarea-mustache': 'warn',
    'vue/no-this-in-before-route-enter': 'warn',
    'vue/no-undef-properties': 'warn',
    'vue/no-unregistered-components': 'warn',
    'vue/no-unsupported-features': 'warn',
    'vue/no-unused-components': 'warn',
    'vue/no-unused-properties': 'warn',
    'vue/no-unused-refs': 'warn',
    'vue/no-unused-vars': 'warn',
    'vue/no-use-computed-property-like-method': 'warn',
    'vue/no-use-v-if-with-v-for': 'warn',
    'vue/no-useless-mustaches': 'warn',
    'vue/no-useless-template-attributes': 'warn',
    'vue/no-useless-v-bind': 'warn',
    'vue/no-v-for-template-key-on-child': 'warn',
    'vue/no-v-for-template-key': 'warn',
    'vue/no-v-html': 'warn',
    'vue/no-v-model-argument': 'warn',
    'vue/no-v-text': 'warn',
    'vue/no-watch-after-await': 'warn',
    'vue/one-component-per-file': 'warn',
    'vue/order-in-components': 'warn',
    'vue/padding-line-between-blocks': 'warn',
    'vue/prop-name-casing': 'warn',
    'vue/require-component-is': 'warn',
    'vue/require-default-prop': 'warn',
    'vue/require-direct-export': 'warn',
    'vue/require-emit-validator': 'warn',
    'vue/require-explicit-emits': 'warn',
    'vue/require-expose': 'warn',
    'vue/require-name-property': 'warn',
    'vue/require-prop-type-constructor': 'warn',
    'vue/require-prop-types': 'warn',
    'vue/require-render-return': 'warn',
    'vue/require-slots-as-functions': 'warn',
    'vue/require-toggle-inside-transition': 'warn',
    'vue/require-v-for-key': 'warn',
    'vue/require-valid-default-prop': 'warn',
    'vue/return-in-computed-property': 'warn',
    'vue/return-in-emits-validator': 'warn',
    'vue/script-indent': 'warn',
    'vue/script-setup-uses-vars': 'warn',
    'vue/singleline-html-element-content-newline': 'warn',
    'vue/sort-keys': 'warn',
    'vue/static-class-names-order': 'warn',
    'vue/this-in-template': 'warn',
    'vue/use-v-on-exact': 'warn',
    'vue/v-bind-style': 'warn',
    'vue/v-for-delimiter-style': 'warn',
    'vue/v-on-event-hyphenation': 'warn',
    'vue/v-on-function-call': 'warn',
    'vue/v-on-style': 'warn',
    'vue/v-slot-style': 'warn',
    'vue/valid-define-emits': 'warn',
    'vue/valid-define-props': 'warn',
    'vue/valid-next-tick': 'warn',
    'vue/valid-v-bind-sync': 'warn',
    'vue/valid-v-bind': 'warn',
    'vue/valid-v-cloak': 'warn',
    'vue/valid-v-else-if': 'warn',
    'vue/valid-v-else': 'warn',
    'vue/valid-v-for': 'warn',
    'vue/valid-v-html': 'warn',
    'vue/valid-v-if': 'warn',
    'vue/valid-v-is': 'warn',
    'vue/valid-v-memo': 'warn',
    'vue/valid-v-model': 'warn',
    'vue/valid-v-on': 'warn',
    'vue/valid-v-once': 'warn',
    'vue/valid-v-pre': 'warn',
    'vue/valid-v-show': 'warn',
    'vue/valid-v-slot': 'warn',
    'vue/valid-v-text': 'warn'
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

  'extends': [
    'plugin:vue/recommended',
    'plugin:vuetify/recommended',
    '@vue/airbnb'
  ]
};
