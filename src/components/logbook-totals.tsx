import { useState } from "react"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { blockMinutes, formatDuration, parseDuration, type Flight } from "@/lib/flights"
import { readCookie, writeCookie } from "@/lib/storage"

const SUBHEADS = ["SE", "ME", "Day", "Night", "Night", "IFR", "PIC", "Copi", "Dual", "Instructor"]
// Per column: "time" (h:mm), "count" (landings) or null (Name PIC, not summed).
const KINDS = [
  "time",
  "time",
  "time",
  "time",
  null,
  "count",
  "count",
  "time",
  "time",
  "time",
  "time",
  "time",
  "time",
] as const
const COOKIE = "carriedForward"

type Totals = (number | null)[]

/**
 * Airline flights are multi-pilot IFR flights, logged as PIC. Landings and night
 * time aren't in the roster, so those columns stay empty.
 */
function totals(flights: Flight[]): Totals {
  const t = flights.reduce((sum, f) => sum + blockMinutes(f), 0)
  return KINDS.map((k, i) => (k === null ? null : [2, 3, 8, 9].includes(i) ? t : 0))
}

/** Carried-forward entries as typed; undefined where the text isn't a valid number or h:mm. */
function parseCarried(values: string[]): (number | undefined)[] {
  return KINDS.map((k, i) => {
    const v = values[i]?.trim() ?? ""
    if (k === null || v === "") return 0
    return k === "count" ? (/^\d+$/.test(v) ? Number(v) : undefined) : parseDuration(v)
  })
}

function add(a: Totals, b: (number | null | undefined)[]): Totals {
  return a.map((x, i) => (x === null ? null : x + (b[i] ?? 0)))
}

function format(values: Totals): string[] {
  return values.map((v, i) => (!v ? "" : KINDS[i] === "time" ? formatDuration(v) : String(v)))
}

export function LogbookTotals({ page, previous }: { page: Flight[]; previous: Flight[] }) {
  const [carried, setCarried] = useState<string[]>(() => {
    try {
      return JSON.parse(readCookie(COOKIE) ?? "[]")
    } catch {
      return []
    }
  })
  const carriedValues = parseCarried(carried)
  const previousTotals = add(totals(previous), carriedValues)
  const rows: [string, Totals][] = [
    ["Total this page", totals(page)],
    ["Total previous pages", previousTotals],
    ["Total Time", add(previousTotals, totals(page))],
  ]

  function setCarriedAt(i: number, value: string) {
    const next = KINDS.map((_, j) => (j === i ? value : (carried[j] ?? "")))
    setCarried(next)
    writeCookie(COOKIE, JSON.stringify(next))
  }

  const group = "border-l text-center"
  return (
    <Card className="py-0">
      <Table className="[&_td+td]:border-l [&_th]:h-auto [&_th]:py-1.5 [&_th]:whitespace-normal">
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2} className="pl-4" />
            <TableHead colSpan={2} className={group}>
              Single Pilot Time
            </TableHead>
            <TableHead rowSpan={2} className={group}>
              Multi Pilot Time
            </TableHead>
            <TableHead rowSpan={2} className={group}>
              Total Time of Flight
            </TableHead>
            <TableHead rowSpan={2} className={group}>
              Name PIC
            </TableHead>
            <TableHead colSpan={2} className={group}>
              Landings
            </TableHead>
            <TableHead colSpan={2} className={group}>
              Operational Condition Time
            </TableHead>
            <TableHead colSpan={4} className={group}>
              Pilot Function Time
            </TableHead>
          </TableRow>
          <TableRow>
            {SUBHEADS.map((h, i) => (
              <TableHead key={i} className={group}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <TableCell className="pl-4 font-medium">
              Carried forward
              <div className="text-xs font-normal text-muted-foreground">from your paper logbook</div>
            </TableCell>
            {KINDS.map((k, i) => (
              <TableCell key={i} className="p-1">
                {k && (
                  <Input
                    aria-label={`Carried forward ${i}`}
                    aria-invalid={carriedValues[i] === undefined}
                    placeholder={k === "time" ? "h:mm" : "0"}
                    value={carried[i] ?? ""}
                    onChange={(e) => setCarriedAt(i, e.target.value)}
                    className="h-7 min-w-14 px-1.5 text-right tabular-nums"
                  />
                )}
              </TableCell>
            ))}
          </TableRow>
          {rows.map(([label, values]) => (
            <TableRow key={label}>
              <TableCell className="pl-4 font-medium">{label}</TableCell>
              {format(values).map((v, i) => (
                <TableCell key={i} className="text-right tabular-nums">
                  {v}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
