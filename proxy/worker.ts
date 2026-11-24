// Cloudflare Worker that relays the app's requests for GitHub Pages, where no
// dev-server proxy exists. Only the hosts in upstreams.ts are reachable, so it
// is not an open proxy. Deploy with `npx wrangler deploy`.
import { upstreams } from './upstreams.ts'

const ALLOWED_ORIGIN = /^(https:\/\/andreasreufer\.github\.io|http:\/\/localhost:\d+)$/

export default {
  async fetch(req: Request): Promise<Response> {
    const origin = req.headers.get('Origin') ?? ''
    const cors: Record<string, string> = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN.test(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'x-apikey',
      Vary: 'Origin',
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

    const url = new URL(req.url)
    const [, name, ...rest] = url.pathname.split('/')
    const upstream = upstreams[name]
    if (!upstream || req.method !== 'GET') {
      return new Response('Not found', { status: 404, headers: cors })
    }

    const headers = new Headers()
    const apiKey = req.headers.get('x-apikey')
    if (apiKey) headers.set('x-apikey', apiKey)
    const res = await fetch(`${upstream}/${rest.join('/')}${url.search}`, { headers })

    const out = new Response(res.body, res)
    out.headers.delete('Set-Cookie')
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
    return out
  },
}
