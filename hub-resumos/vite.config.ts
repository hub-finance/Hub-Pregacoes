import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Caminho relativo (./) e HashRouter: o app funciona em qualquer endereço,
// em subpasta e instalado, sem depender de servidor.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist', chunkSizeWarningLimit: 900 },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        id: 'hub-resumos',
        name: 'Hub Resumos — Resumos e Interpretações',
        short_name: 'Hub Resumos',
        description: 'Painel, passo a passo, DNA, mapa de conceitos, cartões, consulta rápida, plano de ação e infográfico de livros, estudos e resumos.',
        lang: 'pt-BR',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#faf8f5',
        theme_color: '#1d5c4d',
        categories: ['books', 'education', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tudo o que o app precisa fica no aparelho: funciona sem internet
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,mjs}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
