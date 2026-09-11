export default defineNuxtConfig({
  compatibilityDate: '2026-09-09',
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  ui: { fonts: false, colorMode: false },
  icon: {
    provider: 'none',
    clientBundle: { scan: true },
  },
  css: ['~/assets/nuxt-ui.css'],
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
