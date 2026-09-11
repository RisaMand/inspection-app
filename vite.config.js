import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Legal Metrology Compliance Inspector',
        short_name: 'Inspector',
        description: 'Field inspection tool for Legal Metrology (Packaged Commodities) Rules compliance scanning',
        theme_color: '#0A0E0F',
        background_color: '#0A0E0F',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        // Caching strategy for API routes goes here once Person 2 publishes
        // the endpoint list — NetworkFirst for API calls, CacheFirst for
        // static assets. Left as default (precache static assets) for now.
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        // Offline-first OCR: tesseract.js pulls its worker script, WASM
        // core, and eng/hin traineddata from jsDelivr at runtime by
        // default. CacheFirst (with opaque-response caching) means one
        // online load warms the cache and every later run — including
        // airplane mode — is served on-device. Without this, checkImage()
        // cannot initialize its worker with zero network.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/(tesseract\.js|tesseract\.js-core|@tesseract\.js-data)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-cdn',
              expiration: { maxEntries: 20, maxAgeSeconds: 90 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})