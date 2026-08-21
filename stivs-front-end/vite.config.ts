import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isProxyDebugEnabled = process.env.VITE_PROXY_DEBUG === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: isProxyDebugEnabled
          ? (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                console.log(`[proxy:req] ${req.method} ${req.url} -> ${proxyReq.protocol}//${proxyReq.host}${proxyReq.path}`)
              })

              proxy.on('proxyRes', (proxyRes, req) => {
                console.log(`[proxy:res] ${req.method} ${req.url} <- ${proxyRes.statusCode}`)
              })

              proxy.on('error', (error, req) => {
                console.error(`[proxy:error] ${req.method} ${req.url}:`, error.message)
              })
            }
          : undefined,
      },
    },
  },
})
