import ICAL from "ical.js"

export type Flight = {
  uid: string
  /** e.g. "LX1480" */
  flightNumber: string
  /** IATA codes */
  from: string
  to: string
  departureUtc: Date
  arrivalUtc: Date
  /** Local departure date at the origin (YYYY-MM-DD), as airlines date flights. */
  departureLocalDate: string
  /** IATA aircraft type code from the roster, e.g. "221", "32N" */
  aircraftType?: string
  /** Duty code in brackets, e.g. "CM" (crew member) or "DH" (deadhead) */
  role?: string
}

// "LX1480 ZRH 0827 PRG 0951 221 [CM]" / "LX1886 ZRH 2155 OTP 0115+1 221 [CM]"
const SUMMARY_RE =
  /^([A-Z0-9]{2}\d{1,4}[A-Z]?)\s+([A-Z]{3})\s+(\d{2})(\d{2})\s+([A-Z]{3})\s+\d{4}(?:[+-]\d)?(?:\s+([A-Z0-9]{3}))?(?:\s+\[([^\]]+)\])?/

export function parseFlights(icsText: string): Flight[] {
  const vcalendar = new ICAL.Component(ICAL.parse(icsText))
  const flights: Flight[] = []

  for (const vevent of vcalendar.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent)
    const match = SUMMARY_RE.exec((event.summary ?? "").trim())
    if (!match || !event.startDate || !event.endDate) continue

    const [, flightNumber, from, depHH, depMM, to, aircraftType, role] = match
    const departureUtc = event.startDate.toJSDate()
    const arrivalUtc = event.endDate.toJSDate()

    flights.push({
      uid: event.uid ?? `${flightNumber}-${departureUtc.toISOString()}`,
      flightNumber,
      from,
      to,
      departureUtc,
      arrivalUtc,
      departureLocalDate: localDate(departureUtc, Number(depHH) * 60 + Number(depMM)),
      aircraftType,
      role,
    })
  }

  return flights.sort((a, b) => a.departureUtc.getTime() - b.departureUtc.getTime())
}

/**
 * The roster gives the local departure time but no time zone. Derive the UTC
 * offset from the local and UTC minute-of-day, then shift the UTC instant to
 * get the local calendar date.
 */
function localDate(utc: Date, localMinuteOfDay: number): string {
  const utcMinuteOfDay = utc.getUTCHours() * 60 + utc.getUTCMinutes()
  let offset = localMinuteOfDay - utcMinuteOfDay
  if (offset > 14 * 60) offset -= 24 * 60
  if (offset < -12 * 60) offset += 24 * 60
  return new Date(utc.getTime() + offset * 60_000).toISOString().slice(0, 10)
}

export function blockMinutes(f: Flight): number {
  return Math.round((f.arrivalUtc.getTime() - f.departureUtc.getTime()) / 60_000)
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, "0")}`
}

/** "123:45" or "12" (hours) to minutes; undefined if it isn't a duration. */
export function parseDuration(text: string): number | undefined {
  const m = /^(\d+)(?::([0-5]\d))?$/.exec(text.trim())
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : undefined
}

export function formatUtcTime(d: Date): string {
  return d.toISOString().slice(11, 16)
}

export function formatUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
