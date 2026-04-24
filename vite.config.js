import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4174,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/generated': 'http://127.0.0.1:8000',
      '/test-audio': 'http://127.0.0.1:8000',
    },
  },
})
