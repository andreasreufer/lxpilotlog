/**
 * Base URL of the relay for hosts without CORS (proxy/upstreams.ts): the Vite
 * dev/preview server locally, the Cloudflare Worker (VITE_PROXY_URL) on Pages.
 */
export const PROXY: string = import.meta.env.VITE_PROXY_URL || "/proxy"
