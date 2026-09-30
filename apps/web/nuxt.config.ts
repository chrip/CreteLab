// CreteLab web app: static pages (nuxt generate) in German and English. The only server
// call is POST /api/describe to the Laya service (services/api); every calculation runs in
// the browser with @cretelab/engine.
// A public site needs a legal notice: warn when it is built for https without one.
if (process.env.NUXT_PUBLIC_SITE_URL?.startsWith('https') && !process.env.NUXT_PUBLIC_LEGAL_NAME) {
  console.warn('\n⚠  NUXT_PUBLIC_LEGAL_* is not set: the legal notice and privacy policy will have no operator (see .env.example).\n');
}

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  modules: ['@nuxtjs/i18n', '@nuxt/eslint', '@nuxt/test-utils/module'],
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'de' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/icon.png' },
      ],
      meta: [{ name: 'theme-color', content: '#1f5f8b' }],
    },
  },

  runtimeConfig: {
    public: {
      /** Base URL of the Laya service; the dev server and nginx proxy it to services/api. */
      apiBase: '/api',
      repository: 'https://github.com/chrip/CreteLab',
      /**
       * Legal notice and privacy policy. Set at build time from the environment
       * (NUXT_PUBLIC_LEGAL_NAME, …, see .env.example), never committed.
       */
      legal: {
        name: '',
        street: '',
        city: '',
        country: '',
        email: '',
        /** Who hosts the server, if not the operator themselves (name and address). */
        hosting: '',
      },
    },
  },

  i18n: {
    strategy: 'prefix',
    defaultLocale: 'de',
    locales: [
      { code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: { useCookie: true, cookieKey: 'cretelab_locale', redirectOn: 'root' },
    baseUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  },

  nitro: {
    prerender: { routes: ['/de', '/en'], crawlLinks: true },
    devProxy: {
      '/api': { target: process.env.API_URL ?? 'http://127.0.0.1:8000/api', changeOrigin: true },
    },
  },

  typescript: { strict: true },
  eslint: { config: { stylistic: false } },
});
