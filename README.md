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

`npm run build:pages` builds a static version (base `/lxpilotlog/`), and
`.github/workflows/pages.yml` deploys it on every push to `main` (set
*Settings → Pages → Source* to *GitHub Actions*). Pages has no proxy, so the
static version opens the feed as a downloaded `.ics` file and tail signs are
entered by hand; the OpenSky lookup only works with `npm run dev`.

## Notes

- **Feed loading** – `schedule.swiss.com` sends no CORS headers, so the app
  fetches it through the Vite dev/preview proxy (`/proxy/…`, see
  `vite.config.ts`). A static deployment needs an equivalent proxy. You can
  also open a downloaded `.ics` file.
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
