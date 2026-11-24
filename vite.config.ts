import { execSync } from 'node:child_process'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'
import { upstreams } from './proxy/upstreams.ts'

// Shown in the app footer: commit hash and build date, e.g. "0ad04ea · 2026-11-24".
const commit = execSync('git rev-parse --short HEAD').toString().trim()
const version = `${commit} · ${new Date().toISOString().slice(0, 10)}`

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
  define: {
    'import.meta.env.VITE_COMMIT': JSON.stringify(commit),
    'import.meta.env.VITE_VERSION': JSON.stringify(version),
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  server: { proxy },
  preview: { proxy },
}))
