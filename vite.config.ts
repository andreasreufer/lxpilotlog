import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

// These hosts do not send CORS headers for our origin, so the browser cannot
// call them directly. Route them through the dev/preview server instead.
const upstreams = {
  'swiss-schedule': 'https://schedule.swiss.com',
  opensky: 'https://opensky-network.org',
  'opensky-auth': 'https://auth.opensky-network.org',
}

const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.entries(upstreams).map(([name, target]) => [
    `/proxy/${name}/`,
    { target, changeOrigin: true, rewrite: (p: string) => p.slice(`/proxy/${name}`.length) },
  ]),
)

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages serves the site from /<repo>/
  base: mode === 'pages' ? '/lxpilotlog/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy },
  preview: { proxy },
}))
