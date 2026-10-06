// eslint.config.mjs
// Generated base config from @nuxt/eslint (run `nuxt prepare` first).
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    // Brief §5: template → script → style in every .vue file
    'vue/block-order': ['error', { order: ['template', 'script', 'style'] }],
    // Brief §5: no TypeScript inside .vue files
    'vue/block-lang': ['error', { script: { allowNoLang: true } }],
    'vue/multi-word-component-names': 'off'
  }
})
