import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { blockMinutes, formatDuration, type Flight } from "@/lib/flights"

const SUBHEADS = ["SE", "ME", "Day", "Night", "Night", "IFR", "PIC", "Copi", "Dual", "Instructor"]

/**
 * Airline flights are multi-pilot IFR flights, logged as PIC. Landings and night
 * time aren't in the roster, so those columns stay empty.
 */
function totals(flights: Flight[]): string[] {
  const t = formatDuration(flights.reduce((sum, f) => sum + blockMinutes(f), 0))
  return ["", "", t, t, "", "", "", "", t, t, "", "", ""]
}

export function LogbookTotals({ page, previous }: { page: Flight[]; previous: Flight[] }) {
  const rows: [string, string[]][] = [
    ["Total this page", totals(page)],
    ["Total previous pages", totals(previous)],
    ["Total Time", totals([...previous, ...page])],
  ]
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
          {rows.map(([label, values]) => (
            <TableRow key={label}>
              <TableCell className="pl-4 font-medium">{label}</TableCell>
              {values.map((v, i) => (
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
