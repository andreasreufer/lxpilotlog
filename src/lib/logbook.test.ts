import { describe, expect, it } from "vitest"
import type { Flight } from "./flights"
import { addPage } from "./logbook"

const flight = (minutes: number) => ({ departureUtc: new Date(0), arrivalUtc: new Date(minutes * 60_000) }) as Flight

describe("addPage", () => {
  it("adds the page's block time to multi-pilot, total, IFR and PIC", () => {
    const previous = ["", "", "100:30", "100:30", "12", "", "", "", "100:30"]
    expect(addPage(previous, [flight(45), flight(90)])).toEqual([
      "",
      "",
      "102:45",
      "102:45",
      "12",
      "",
      "",
      "2:15",
      "102:45",
      "",
      "",
      "",
    ])
  })

  it("refuses invalid previous totals", () => {
    expect(addPage(["abc"], [flight(60)])).toBeUndefined()
  })
})
