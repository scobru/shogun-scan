import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'crypto', 'events', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      stream: 'stream-browserify',
      buffer: 'buffer',
      events: 'events',
      crypto: 'crypto-browserify',
      path: 'path-browserify',
      fs: 'browserify-fs'
    }
  },
  define: {
    'process.env': {},
    'global': 'globalThis',
    'Buffer': ['buffer', 'Buffer'],
  },
  optimizeDeps: {
    include: [
      'buffer',
      'gun',
      'gun/sea',
      'gun/radix',
      'gun/radisk',
      'gun/store',
      'gun/rindexed',
      'gun/not'
    ],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'ethereum': [
            'ethereumjs-wallet',
            'ethereum-cryptography'
          ]
        }
      }
    }
  }
})
