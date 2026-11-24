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

The feed host and FlightAware AeroAPI block requests from web pages (no CORS
headers).
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
- **Tail signs** – from [FlightAware AeroAPI](https://flightaware.com/aeroapi)
  (`/flights/{ident}`, Personal tier with $5 free usage per month; key in
  the settings dialog). Works for flights from the last 10 days up to 2 days
  ahead, once an aircraft is assigned. Requests are spaced to the Personal
  tier's 10 per minute. Results are cached in `localStorage`; click a tail
  cell to enter or correct it by hand.
- **Airports** – `src/lib/airports.json` (IATA → ICAO) is generated from
  [OurAirports](https://ourairports.com/data/) with
  `node scripts/build-airports.mjs`.
