import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      com: '/src/com',
      api: '/src/api',
      img: '/src/img',
      style: '/src/style',
      hook: '/src/hook',
    }
  }
})
