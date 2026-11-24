import type { Flight } from "./flights"
import { toIcao } from "./airports"

/**
 * Aircraft registration lookup from free sources:
 *
 * 1. OpenSky Network (https://opensky-network.org) knows which transponder
 *    (ICAO 24-bit address) departed an airport at what time and under which
 *    callsign. Needs a free account + API client (OAuth2 client credentials).
 *    Flights are published by a nightly batch job, so only flights up to the
 *    previous UTC day can be looked up.
 * 2. hexdb.io maps the transponder address to the registration, no key needed.
 *
 * OpenSky sends no CORS headers for third-party origins, so its API and auth
 * server go through the Vite proxy (see vite.config.ts).
 */
const OPENSKY_API = "/proxy/opensky/api"
const OPENSKY_TOKEN_URL = "/proxy/opensky-auth/auth/realms/opensky-network/protocol/openid-connect/token"
const HEXDB_API = "https://hexdb.io/api/v1/aircraft"

const CACHE_KEY = "lxpilotlog.tails.v2"
const OVERRIDES_KEY = "lxpilotlog.tailOverrides.v1"

/** IATA airline designator -> ICAO callsign prefix, for matching callsigns. */
const AIRLINE_ICAO: Record<string, string> = {
  LX: "SWR",
  WK: "EDW",
  "2L": "OAW",
  LH: "DLH",
  OS: "AUA",
  SN: "BEL",
  EN: "DLA",
  BT: "BTI",
}

export type Credentials = { clientId: string; clientSecret: string }

export type TailResult =
  | { status: "found"; reg: string; model?: string; icao24: string; callsign?: string; exact: boolean }
  | { status: "not-found" }
  | { status: "error"; message: string }

type OpenSkyFlight = {
  icao24: string
  firstSeen: number
  lastSeen: number
  estDepartureAirport: string | null
  estArrivalAirport: string | null
  callsign: string | null
}

export function tailKey(f: Flight): string {
  return `${f.flightNumber}|${f.departureLocalDate}|${f.from}`
}

/** OpenSky only has flights up to the end of the previous UTC day. */
export function isLookupAvailable(f: Flight, now = new Date()): boolean {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return f.departureUtc.getTime() < todayUtc
}

export function loadCache(): Record<string, TailResult> {
  return readJson(CACHE_KEY)
}

export function loadOverrides(): Record<string, string> {
  return readJson(OVERRIDES_KEY)
}

export function saveOverrides(overrides: Record<string, string>) {
  writeJson(OVERRIDES_KEY, overrides)
}

export function storeResult(f: Flight, result: TailResult) {
  // Errors are transient - only cache final answers.
  if (result.status === "error") return
  const cache = loadCache()
  cache[tailKey(f)] = result
  writeJson(CACHE_KEY, cache)
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* storage unavailable */
  }
}

export class LookupError extends Error {}

/** Looks up tail signs; keeps the OpenSky token and per-airport-day results in memory. */
export class TailLookup {
  private token?: { value: string; expiresAt: number }
  private departures = new Map<string, Promise<OpenSkyFlight[]>>()
  private registrations = new Map<string, Promise<{ reg?: string; model?: string }>>()
  private readonly creds: Credentials
  private readonly signal?: AbortSignal

  constructor(creds: Credentials, signal?: AbortSignal) {
    this.creds = creds
    this.signal = signal
  }

  async lookup(f: Flight): Promise<TailResult> {
    const from = toIcao(f.from)
    const to = toIcao(f.to)
    if (!from) return { status: "error", message: `Unknown airport ${f.from}` }

    const sched = f.departureUtc.getTime() / 1000
    // Accept detection from 30 min before to 4 h after scheduled departure.
    const earliest = sched - 30 * 60
    const latest = sched + 4 * 3600

    const days = new Set([utcDay(earliest), utcDay(latest)])
    const candidates = (await Promise.all([...days].map((d) => this.departuresOn(from, d)))).flat()
    const match = pickFlight(f, candidates, earliest, latest, to)
    if (!match) return { status: "not-found" }

    const { reg, model } = await this.registration(match.flight.icao24)
    if (!reg) return { status: "not-found" }
    return {
      status: "found",
      reg,
      model,
      icao24: match.flight.icao24,
      callsign: match.flight.callsign?.trim() || undefined,
      exact: match.exact,
    }
  }

  private departuresOn(airport: string, dayStart: number): Promise<OpenSkyFlight[]> {
    const key = `${airport}|${dayStart}`
    let p = this.departures.get(key)
    if (!p) {
      const url = `${OPENSKY_API}/flights/departure?airport=${airport}&begin=${dayStart}&end=${dayStart + 86_399}`
      p = this.openSky(url)
      p.catch(() => this.departures.delete(key))
      this.departures.set(key, p)
    }
    return p
  }

  private async openSky(url: string, retried = false): Promise<OpenSkyFlight[]> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${await this.getToken()}` },
      signal: this.signal,
    })
    if (res.status === 404) return []
    if (res.status === 401 && !retried) {
      this.token = undefined
      return this.openSky(url, true)
    }
    if (res.status === 429) {
      const wait = res.headers.get("X-Rate-Limit-Retry-After-Seconds")
      throw new LookupError(
        `OpenSky daily credits used up${wait ? `, retry in ${Math.ceil(Number(wait) / 3600)} h` : ""}`,
      )
    }
    if (!res.ok) throw new LookupError(`OpenSky HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`)
    return (await res.json()) as OpenSkyFlight[]
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value
    const res = await fetch(OPENSKY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.creds.clientId,
        client_secret: this.creds.clientSecret,
      }),
      signal: this.signal,
    })
    if (!res.ok) throw new LookupError(`OpenSky login failed (HTTP ${res.status}) - check client ID and secret`)
    const data = (await res.json()) as { access_token: string; expires_in: number }
    this.token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
    return this.token.value
  }

  private registration(icao24: string) {
    let p = this.registrations.get(icao24)
    if (!p) {
      p = fetch(`${HEXDB_API}/${icao24}`, { signal: this.signal }).then(async (res) => {
        if (res.status === 404) return {}
        if (!res.ok) throw new LookupError(`hexdb.io HTTP ${res.status}`)
        const data = (await res.json()) as { Registration?: string; Type?: string }
        return { reg: data.Registration || undefined, model: data.Type || undefined }
      })
      p.catch(() => this.registrations.delete(icao24))
      this.registrations.set(icao24, p)
    }
    return p
  }
}

/**
 * Picks the OpenSky flight that most likely is the rostered one:
 * 1. callsign equals the ICAO flight number (LX798 -> SWR798),
 * 2. callsign has the airline's prefix (alphanumeric callsigns like SWR4KL)
 *    and the arrival airport matches,
 * then the one detected closest to the scheduled departure.
 */
export function pickFlight(
  f: Flight,
  candidates: OpenSkyFlight[],
  earliest: number,
  latest: number,
  toIcao: string | undefined,
): { flight: OpenSkyFlight; exact: boolean } | undefined {
  const [, airline, number] = /^([A-Z0-9]{2})(\d+[A-Z]?)$/.exec(f.flightNumber) ?? []
  const prefix = airline ? AIRLINE_ICAO[airline] : undefined
  const exactCallsign = prefix ? `${prefix}${number}` : undefined
  const sched = f.departureUtc.getTime() / 1000

  const inWindow = candidates.filter((c) => c.firstSeen >= earliest && c.firstSeen <= latest)
  const byTime = (a: OpenSkyFlight, b: OpenSkyFlight) =>
    Math.abs(a.firstSeen - sched) - Math.abs(b.firstSeen - sched)

  const exact = inWindow.filter((c) => c.callsign?.trim() === exactCallsign).sort(byTime)
  if (exact.length) return { flight: exact[0], exact: true }

  if (!prefix || !toIcao) return undefined
  const sameAirline = inWindow
    .filter((c) => c.callsign?.trim().startsWith(prefix) && c.estArrivalAirport === toIcao)
    .sort(byTime)
  return sameAirline.length ? { flight: sameAirline[0], exact: false } : undefined
}

function utcDay(unixSeconds: number): number {
  return unixSeconds - (unixSeconds % 86_400)
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener("abort", () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })
}

function readJson<T extends object>(key: string): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as T
  } catch {
    return {} as T
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable or full */
  }
}
