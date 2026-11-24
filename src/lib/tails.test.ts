import { describe, expect, it } from "vitest"
import type { Flight } from "./flights"
import { isLookupAvailable, pickFlight, type AeroApiFlight } from "./tails"

const flight: Flight = {
  uid: "x",
  flightNumber: "LX798",
  from: "GVA",
  to: "BRU",
  departureUtc: new Date("2026-11-02T18:08:00Z"),
  arrivalUtc: new Date("2026-11-02T19:22:00Z"),
  departureLocalDate: "2026-11-02",
}

const leg = (origin: string, scheduledOut: string, registration: string | null): AeroApiFlight => ({
  registration,
  aircraft_type: "BCS3",
  origin: { code_iata: origin },
  scheduled_out: scheduledOut,
  scheduled_off: null,
})

describe("pickFlight", () => {
  it("picks the leg from the rostered origin closest to the scheduled time", () => {
    const legs = [
      leg("GVA", "2026-11-01T18:10:00Z", "HB-JCA"),
      leg("ZRH", "2026-11-02T18:05:00Z", "HB-JCB"),
      leg("GVA", "2026-11-02T18:10:00Z", "HB-JCC"),
    ]
    expect(pickFlight(flight, legs)?.registration).toBe("HB-JCC")
  })

  it("returns nothing when no leg leaves from the rostered airport", () => {
    expect(pickFlight(flight, [leg("ZRH", "2026-11-02T18:08:00Z", "HB-JCB")])).toBeUndefined()
  })
})

describe("isLookupAvailable", () => {
  const now = Date.parse("2026-11-05T12:00:00Z")
  it("covers the last 10 days up to 2 days ahead", () => {
    expect(isLookupAvailable(flight, now)).toBe(true)
    expect(isLookupAvailable(flight, Date.parse("2026-11-13T12:00:00Z"))).toBe(false)
    expect(isLookupAvailable({ ...flight, departureUtc: new Date("2026-11-08T12:00:00Z") }, now)).toBe(false)
  })
})
