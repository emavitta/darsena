import pkg from './package.json'

export default defineNuxtConfig({
  runtimeConfig: { public: { appVersion: pkg.version } },
  compatibilityDate: '2026-09-09',
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  css: ['~/assets/main.css'],
  app: {
    head: {
      title: 'Darsena',
      meta: [{ name: 'color-scheme', content: 'light dark' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/brand/mark.svg' }],
    },
  },
  nitro: { preset: 'static' },
  ignore: ['**/desktop/**', '**/tests/**', '**/release/**', '**/dist-electron/**'],
})
