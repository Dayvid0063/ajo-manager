// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',
    'nuxt-auth-utils'
  ],

  css: ['~/assets/css/main.css'],

  // <AppButton> not <UiAppButton> — folders are for organisation only.
  components: [{ path: '~/components', pathPrefix: false }],

  vite: {
    plugins: [tailwindcss()]
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en-NG' },
      title: 'Ajo Manager',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Keep your Ajo, Esusu or Adashe group organised, transparent and on time.' },
        { name: 'theme-color', content: '#0E7A57', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#121412', media: '(prefers-color-scheme: dark)' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' }
      ]
    }
  },

  // Server-only values are read from NUXT_* env vars at runtime (see .env.example).
  runtimeConfig: {
    mongodbUri: '',
    managementFeeKobo: 370000,
    platformBank: {
      name: '',
      accountNumber: '',
      accountName: ''
    },
    r2: {
      accountId: '',
      accessKeyId: '',
      secretAccessKey: '',
      bucket: '',
      endpoint: ''
    },
    public: {
      appUrl: 'http://localhost:3000',
      timezone: 'Africa/Lagos'
    }
  },

  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'ajo-color-mode'
  },

  fonts: {
    families: [
      { name: 'Plus Jakarta Sans', provider: 'google', weights: [400, 500, 600, 700, 800] }
    ]
  },

  icon: {
    serverBundle: 'local',
    clientBundle: { scan: true }
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Ajo Manager',
      short_name: 'Ajo',
      description: 'Keep your Ajo, Esusu or Adashe group organised, transparent and on time.',
      lang: 'en-NG',
      start_url: '/',
      display: 'standalone',
      background_color: '#FAF8F5',
      theme_color: '#0E7A57',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      navigateFallback: null,
      globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
      // Financial data must always be fresh — never cache API responses.
      runtimeCaching: [
        { urlPattern: /\/api\//, handler: 'NetworkOnly' }
      ]
    },
    client: { installPrompt: true },
    devOptions: { enabled: false }
  },

  hooks: {
    // /design is an internal style guide — never ship it to production
    'pages:extend'(pages) {
      if (process.env.NODE_ENV !== 'development') {
        const index = pages.findIndex(page => page.path === '/design')
        if (index !== -1) pages.splice(index, 1)
      }
    }
  },

  nitro: {
    experimental: { tasks: true }
  },

  typescript: {
    strict: true
  }
})
