import { blockMinutes, formatDuration, parseDuration, type Flight } from "./flights"
import { readCookie, writeCookie } from "./storage"

// Per column: "time" (h:mm) or "count" (landings).
export const KINDS = [
  "time",
  "time",
  "time",
  "time",
  "count",
  "count",
  "time",
  "time",
  "time",
  "time",
  "time",
  "time",
] as const
export const LANDINGS = [4, 5]
const COOKIE = "carriedForward"

/**
 * Airline flights are multi-pilot IFR flights, logged as PIC. Landings and night
 * time aren't in the roster, so those columns stay empty.
 */
export function pageTotals(flights: Flight[]): number[] {
  const t = flights.reduce((sum, f) => sum + blockMinutes(f), 0)
  return KINDS.map((_, i) => ([2, 3, 7, 8].includes(i) ? t : 0))
}

/** Entries as typed; undefined where the text isn't a valid number or h:mm. */
export function parse(values: string[]): (number | undefined)[] {
  return KINDS.map((k, i) => {
    const v = values[i]?.trim() ?? ""
    if (v === "") return 0
    return k === "count" ? (/^\d+$/.test(v) ? Number(v) : undefined) : parseDuration(v)
  })
}

export function format(values: number[]): string[] {
  return values.map((v, i) => (!v ? "" : KINDS[i] === "time" ? formatDuration(v) : String(v)))
}

export function add(a: number[], b: (number | undefined)[]): number[] {
  return a.map((x, i) => x + (b[i] ?? 0))
}

export function loadPrevious(): string[] {
  try {
    const values: string[] = JSON.parse(readCookie(COOKIE) ?? "[]")
    // Saved before the Name PIC column was dropped (it was at index 4).
    return values.length === 13 ? values.filter((_, i) => i !== 4) : values
  } catch {
    return []
  }
}

export function savePrevious(values: string[]) {
  writeCookie(COOKIE, JSON.stringify(values))
}

/**
 * The previous pages plus this page and what was typed into it (landings);
 * undefined if an entry isn't valid.
 */
export function addPage(previous: string[], page: Flight[], pageEntries: string[] = []): string[] | undefined {
  const values = parse(previous)
  const entries = parse(pageEntries)
  if (values.includes(undefined) || entries.includes(undefined)) return undefined
  return format(add(add(pageTotals(page), entries), values))
}
