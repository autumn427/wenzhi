import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Let Rollup split Three.js by dynamic study entry instead of
          // placing the core and every optional addon in the generic vendor chunk.
          if (id.includes('/three/')) return undefined
          if (id.includes('/gsap/') || id.includes('/@gsap/')) return 'motion-vendor'
          if (id.includes('/@phosphor-icons/')) return 'icons-vendor'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'react-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyReq, request) => {
            // Translate only same-origin dev requests to the Worker's origin.
            // Foreign origins remain untouched so the backend still rejects them.
            const origin = request.headers.origin
            const host = request.headers.host
            if (origin && host && origin === `http://${host}` && request.headers['sec-fetch-site'] !== 'cross-site') {
              proxyReq.setHeader('Origin', 'http://127.0.0.1:8787')
            }
          })
        },
      },
    },
    fs: {
      // Keep Vite's default deny patterns and block Wrangler secret files too.
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.dev.vars', '**/.dev.vars.*'],
    },
  },
})
