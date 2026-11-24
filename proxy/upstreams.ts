// Hosts the app needs that send no CORS headers for our origin. The Vite
// dev/preview server and the Cloudflare Worker (proxy/worker.ts) relay
// /<name>/<path> to <host>/<path>.
export const upstreams: Record<string, string> = {
  'swiss-schedule': 'https://schedule.swiss.com',
  opensky: 'https://opensky-network.org',
  'opensky-auth': 'https://auth.opensky-network.org',
}
