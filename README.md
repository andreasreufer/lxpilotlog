<img src="assets/icon.svg" width="64" height="64" alt="">

# LXpilotLog

Reads a crew schedule ICS feed (e.g. `https://schedule.swiss.com/…/….ics`),
extracts the flights and lists them in a table with UTC departure/arrival
times, block time, aircraft type, duty role and the aircraft tail sign.

Built with Vite, React, Tailwind and shadcn/ui.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm test
```

## GitHub Pages

The feed host and OpenSky block requests from web pages (no CORS headers).
Locally the Vite server relays them; on GitHub Pages a small Cloudflare Worker
([proxy/worker.ts](proxy/worker.ts)) does the same, limited to the hosts in
[proxy/upstreams.ts](proxy/upstreams.ts).

1. Deploy the worker (free Cloudflare account):
   `npx wrangler login && npx wrangler deploy`. Note the
   `https://lxpilotlog-proxy.<you>.workers.dev` URL it prints.
2. In the GitHub repo, add the Actions variable `PROXY_URL` with that URL
   (*Settings → Secrets and variables → Actions → Variables*).
3. Set *Settings → Pages → Source* to *GitHub Actions* and push to `main`.
   `.github/workflows/pages.yml` runs `npm run build:pages` (base
   `/lxpilotlog/`) and deploys.

## Notes

- **Feed loading** – through the proxy (see above). You can also open a
  downloaded `.ics` file.
- **Flights** – events whose summary looks like
  `LX1480 ZRH 0827 PRG 0951 221 [CM]` are treated as flights; everything else
  (days off, simulator, …) and deadhead legs (`[DH]`) are ignored. UTC times
  come from `DTSTART`/`DTEND`.
- **Tail signs** – free sources only:
  1. [OpenSky Network](https://opensky-network.org) `/flights/departure`
     lists the transponders that left the departure airport that day with
     their callsigns. The rostered flight is matched by callsign (`LX798` →
     `SWR798`), or by airline prefix + destination for alphanumeric
     callsigns, closest to the scheduled time. Needs a free account and an
     API client (client ID/secret, entered in the settings dialog). The free
     tier has 4,000 credits/day, and one airport-day query costs 30. Flights
     are published the day after they operated.
  2. [hexdb.io](https://hexdb.io) maps the transponder address to the
     registration (no key).

  Results are cached in `localStorage`. Click a tail cell to enter or correct
  it by hand.
- **Airports** – `src/lib/airports.json` (IATA → ICAO) is generated from
  [OurAirports](https://ourairports.com/data/) with
  `node scripts/build-airports.mjs`.
