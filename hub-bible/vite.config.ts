import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Caminho relativo (./) mantém o build utilizável tanto em servidor web quanto
// empacotado em WebView Android (Capacitor/TWA), onde a raiz não é "/".
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        id: 'hub-bible',
        name: 'Hub Bible — Bíblia e Ministério',
        short_name: 'Hub Bible',
        description:
          'Bíblia, estudo, devocional, sermões e biblioteca ministerial em um só lugar.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        display_override: ['standalone', 'fullscreen'],
        orientation: 'any',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        categories: ['books', 'education', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Bíblia', short_name: 'Bíblia', url: './index.html#/biblia' },
          { name: 'Buscar', short_name: 'Buscar', url: './index.html#/busca' },
          { name: 'Sermões', short_name: 'Sermões', url: './index.html#/sermoes' },
        ],
      },
      workbox: {
        // O texto bíblico (≈8 MB) não entra no precache: é baixado sob demanda
        // e guardado em cache de runtime + IndexedDB.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/bible/**'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/bible/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'hub-bible-scriptures',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
