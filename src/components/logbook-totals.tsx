import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Flight } from "@/lib/flights"
import { add, format, KINDS, pageTotals, parse } from "@/lib/logbook"

const SUBHEADS = ["SE", "ME", "Day", "Night", "Night", "IFR", "PIC", "Copi", "Dual", "Instructor"]

export function LogbookTotals({
  page,
  previous,
  onPreviousChange,
}: {
  page: Flight[]
  previous: string[]
  onPreviousChange: (values: string[]) => void
}) {
  const previousValues = parse(previous)
  const thisPage = pageTotals(page)

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
          <TableRow>
            <TableCell className="pl-4 font-medium">Total this page</TableCell>
            {format(thisPage).map((v, i) => (
              <TableCell key={i} className="text-right tabular-nums">
                {v}
              </TableCell>
            ))}
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableCell className="pl-4 font-medium">Total previous pages</TableCell>
            {KINDS.map((k, i) => (
              <TableCell key={i} className="p-1">
                <Input
                  aria-label={`Total previous pages, ${SUBHEADS[i] ?? ""} column ${i + 1}`}
                  aria-invalid={previousValues[i] === undefined}
                  placeholder={k === "time" ? "h:mm" : "0"}
                  value={previous[i] ?? ""}
                  onChange={(e) =>
                    onPreviousChange(KINDS.map((_, j) => (j === i ? e.target.value : (previous[j] ?? ""))))
                  }
                  className="h-7 min-w-14 px-1.5 text-right tabular-nums"
                />
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableCell className="pl-4 font-medium">Total Time</TableCell>
            {format(add(thisPage, previousValues)).map((v, i) => (
              <TableCell key={i} className="text-right tabular-nums">
                {v}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  )
}
