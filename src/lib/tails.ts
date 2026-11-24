import type { Flight } from "./flights"
import { PROXY } from "./proxy"

/**
 * Aircraft registration lookup via FlightAware AeroAPI
 * (https://flightaware.com/aeroapi, Personal tier: $5 free usage per month).
 * `/flights/{ident}` covers flights from 10 days ago to 2 days ahead; the
 * registration appears once the airline has assigned an aircraft.
 *
 * AeroAPI sends no CORS headers, so requests go through the proxy
 * (see src/lib/proxy.ts).
 */
const AEROAPI = `${PROXY}/aeroapi/aeroapi`
const DAY = 86_400_000
// Personal tier allows 10 result sets per minute.
const MIN_INTERVAL_MS = 6500

const CACHE_KEY = "lxpilotlog.tails.v3"
const OVERRIDES_KEY = "lxpilotlog.tailOverrides.v1"

export type TailResult =
  { status: "found"; reg: string; model?: string } | { status: "not-found" } | { status: "error"; message: string }

export type AeroApiFlight = {
  registration: string | null
  aircraft_type: string | null
  origin: { code_iata: string | null } | null
  scheduled_out: string | null
  scheduled_off: string | null
}

export function tailKey(f: Flight): string {
  return `${f.flightNumber}|${f.departureLocalDate}|${f.from}`
}

/** AeroAPI only serves flights from 10 days ago to 2 days ahead. */
export function isLookupAvailable(f: Flight, now = Date.now()): boolean {
  const t = f.departureUtc.getTime()
  return t > now - 10 * DAY && t < now + 2 * DAY
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
  // Errors are transient, and an upcoming flight may still get an aircraft
  // assigned - only cache final answers.
  if (result.status === "error") return
  if (result.status === "not-found" && f.departureUtc.getTime() > Date.now()) return
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

/** Problems that affect every lookup (bad key, quota), so the run should stop. */
export class LookupError extends Error {}

export class TailLookup {
  private lastRequest = 0
  private readonly apiKey: string
  private readonly signal?: AbortSignal

  constructor(apiKey: string, signal?: AbortSignal) {
    this.apiKey = apiKey
    this.signal = signal
  }

  async lookup(f: Flight): Promise<TailResult> {
    const now = Date.now()
    const sched = f.departureUtc.getTime()
    // Stay inside the window AeroAPI accepts, or it rejects the request.
    const start = new Date(Math.max(sched - 6 * 3600_000, now - 10 * DAY + 60_000))
    const end = new Date(Math.min(sched + 6 * 3600_000, now + 2 * DAY - 60_000))
    const params = new URLSearchParams({
      ident_type: "designator",
      start: start.toISOString().slice(0, 19) + "Z",
      end: end.toISOString().slice(0, 19) + "Z",
    })
    const data = await this.get(`${AEROAPI}/flights/${encodeURIComponent(f.flightNumber)}?${params}`)
    const leg = pickFlight(f, data.flights ?? [])
    return leg?.registration
      ? { status: "found", reg: leg.registration, model: leg.aircraft_type ?? undefined }
      : { status: "not-found" }
  }

  private async get(url: string, attempt = 0): Promise<{ flights?: AeroApiFlight[] }> {
    await sleep(this.lastRequest + MIN_INTERVAL_MS - Date.now(), this.signal)
    this.lastRequest = Date.now()
    const res = await fetch(url, { headers: { "x-apikey": this.apiKey }, signal: this.signal })

    if (res.status === 429 && attempt < 2) {
      await sleep(60_000, this.signal)
      return this.get(url, attempt + 1)
    }
    if (res.status === 401 || res.status === 403) throw new LookupError("FlightAware rejected the AeroAPI key")
    if (res.status === 429) throw new LookupError("FlightAware rate limit reached, try again later")
    if (!res.ok) throw new Error(`AeroAPI HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`)
    return res.json()
  }
}

/** The leg departing from the rostered airport, scheduled closest to the roster time. */
export function pickFlight(f: Flight, flights: AeroApiFlight[]): AeroApiFlight | undefined {
  const sched = f.departureUtc.getTime()
  const offset = (l: AeroApiFlight) => Math.abs(Date.parse(l.scheduled_out ?? l.scheduled_off ?? "") - sched)
  return flights
    .filter((l) => l.origin?.code_iata === f.from && !Number.isNaN(offset(l)))
    .sort((a, b) => offset(a) - offset(b))[0]
}

export function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve()
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
