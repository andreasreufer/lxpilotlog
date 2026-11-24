import { describe, expect, it } from "vitest"
import type { Flight } from "./flights"
import { isLookupAvailable, pickFlight } from "./tails"

const flight: Flight = {
  uid: "x",
  flightNumber: "LX798",
  from: "GVA",
  to: "BRU",
  departureUtc: new Date("2026-11-02T18:08:00Z"),
  arrivalUtc: new Date("2026-11-02T19:22:00Z"),
  departureLocalDate: "2026-11-02",
}
const sched = flight.departureUtc.getTime() / 1000
const window = [sched - 1800, sched + 4 * 3600] as const

function os(callsign: string | null, offsetMin: number, icao24: string, arr: string | null = "EBBR") {
  const firstSeen = sched + offsetMin * 60
  return { icao24, callsign, firstSeen, lastSeen: firstSeen + 4000, estDepartureAirport: "LSGG", estArrivalAirport: arr }
}

describe("pickFlight", () => {
  it("prefers the exact ICAO callsign, even with a worse time match", () => {
    const m = pickFlight(flight, [os("EZS1234 ", 2, "aaa"), os("SWR798  ", 25, "bbb")], ...window, "EBBR")
    expect(m).toEqual({ flight: expect.objectContaining({ icao24: "bbb" }), exact: true })
  })

  it("falls back to an alphanumeric callsign of the same airline on the same route", () => {
    const m = pickFlight(
      flight,
      [os("SWR4KL", 10, "aaa", "EGLL"), os("SWR7BR", 15, "bbb"), os("BEL3PX", 5, "ccc")],
      ...window,
      "EBBR",
    )
    expect(m).toEqual({ flight: expect.objectContaining({ icao24: "bbb" }), exact: false })
  })

  it("ignores flights outside the time window", () => {
    expect(pickFlight(flight, [os("SWR798", -120, "aaa"), os("SWR798", 300, "bbb")], ...window, "EBBR")).toBeUndefined()
  })
})

describe("isLookupAvailable", () => {
  it("only allows flights before the current UTC day", () => {
    expect(isLookupAvailable(flight, new Date("2026-11-02T23:59:00Z"))).toBe(false)
    expect(isLookupAvailable(flight, new Date("2026-11-03T00:01:00Z"))).toBe(true)
  })
})
