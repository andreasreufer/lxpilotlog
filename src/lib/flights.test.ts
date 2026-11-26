import { describe, expect, it } from "vitest"
import { blockMinutes, parseDuration, parseFlights } from "./flights"

const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:test
BEGIN:VEVENT
DESCRIPTION:Reporting time: 07:05 (05:05Z)\\nDeparture time: 08:27 (06:27Z)
 \\nArrival time: 09:51 (07:51Z)
DTEND:20261006T075100Z
DTSTART:20261006T062700Z
SUMMARY:LX1480 ZRH 0827 PRG 0951 221 [CM]
UID:a
END:VEVENT
BEGIN:VEVENT
DTEND:20261008T001500Z
DTSTART:20261007T205500Z
SUMMARY:LX1886 ZRH 2155 OTP 0115+1 221 [DH]
UID:b
END:VEVENT
BEGIN:VEVENT
DTEND:20261224T130000Z
DTSTART:20261224T053000Z
SUMMARY:SIM-BCS [EBT4-DAY2-BCS\\, TRAINEE]
UID:c
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261010
SUMMARY:OW
UID:d
END:VEVENT
END:VCALENDAR
`

describe("parseFlights", () => {
  const flights = parseFlights(ics)

  it("keeps only flight duties", () => {
    expect(flights.map((f) => f.flightNumber)).toEqual(["LX1480", "LX1886"])
  })

  it("extracts UTC times, route, type and role", () => {
    const [f] = flights
    expect(f.from).toBe("ZRH")
    expect(f.to).toBe("PRG")
    expect(f.departureUtc.toISOString()).toBe("2026-10-06T06:27:00.000Z")
    expect(f.arrivalUtc.toISOString()).toBe("2026-10-06T07:51:00.000Z")
    expect(f.aircraftType).toBe("221")
    expect(f.role).toBe("CM")
    expect(blockMinutes(f)).toBe(84)
  })

  it("handles overnight arrivals and local departure date", () => {
    const f = flights[1]
    expect(f.role).toBe("DH")
    expect(f.departureLocalDate).toBe("2026-10-07")
    expect(blockMinutes(f)).toBe(200)
  })

  it("derives local departure date across midnight UTC", () => {
    const [f] = parseFlights(ics.replace("20261006T062700Z", "20261005T231000Z").replace("0827", "0110"))
    expect(f.departureLocalDate).toBe("2026-10-06")
  })
})

describe("parseDuration", () => {
  it("reads h:mm and whole hours", () => {
    expect(parseDuration("1234:05")).toBe(1234 * 60 + 5)
    expect(parseDuration(" 12 ")).toBe(720)
    expect(parseDuration("1:75")).toBeUndefined()
    expect(parseDuration("abc")).toBeUndefined()
  })
})
