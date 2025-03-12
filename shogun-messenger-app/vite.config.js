import { resolve } from 'path';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  optimizeDeps: {
    include: ['shogun-core']
  },
  resolve: {
    alias: {
      '@src': resolve(__dirname, 'src'),
    },
  },
  plugins: [
    nodePolyfills({
      include: [
        '*.js',
        'node_modules/**/*.js',
        new RegExp('node_modules/.vite/.*js'),
      ],
      exclude: ['node_modules/polyfill-nodeglobal.js'],
    }),
    solidPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        sourcemap: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,vue,txt,woff2}']
      },
      includeAssets: [
        './src/robots.txt',
        './src/assets/lonewolf-16.png',
        './src/assets/lonewolf-32.png',
        './src/assets/lonewolf-64.png',
        './src/assets/lonewolf-128.png',
        './src/assets/lonewolf-144.png',
        './src/assets/lonewolf-192.png',
        './src/assets/lonewolf-256.png',
        './src/assets/lonewolf-512.png',
      ],
      manifest: {
        short_name: 'LoneWolf',
        name: 'LoneWolf Messenger',
        icons: [
          {
            src: '/assets/lonewolf-16.png',
            sizes: '16x16',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-32.png',
            sizes: '32x32',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-64.png',
            sizes: '64x64',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-256.png',
            sizes: '256x256',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/assets/lonewolf-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
        start_url: '/',
        display: 'standalone',
        theme_color: '#000000',
        background_color: '#ffffff',
      },
    }),
  ],
  build: {
    target: 'esnext',
    polyfillDynamicImport: true,
  },
});
