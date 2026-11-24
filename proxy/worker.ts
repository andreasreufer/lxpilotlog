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
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      Vary: 'Origin',
    }
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

    const url = new URL(req.url)
    const [, name, ...rest] = url.pathname.split('/')
    const upstream = upstreams[name]
    if (!upstream || (req.method !== 'GET' && req.method !== 'POST')) {
      return new Response('Not found', { status: 404, headers: cors })
    }

    const headers = new Headers()
    for (const h of ['Authorization', 'Content-Type']) {
      const v = req.headers.get(h)
      if (v) headers.set(h, v)
    }
    const res = await fetch(`${upstream}/${rest.join('/')}${url.search}`, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? req.body : undefined,
    })

    const out = new Response(res.body, res)
    out.headers.delete('Set-Cookie')
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v)
    return out
  },
}
