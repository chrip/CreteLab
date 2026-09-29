import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt({
  rules: {
    'vue/multi-word-component-names': 'off',
    // Prettier writes void elements as <input />.
    'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'never', component: 'always' } }],
  },
});
