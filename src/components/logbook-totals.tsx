import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Flight } from "@/lib/flights"
import { add, format, KINDS, LANDINGS, pageTotals, parse } from "@/lib/logbook"

const SUBHEADS = ["SE", "ME", "Day", "Night", "Night", "IFR", "PIC", "Copi", "Dual", "Instructor"]

export function LogbookTotals({
  page,
  pageEntries,
  onPageEntriesChange,
  previous,
  onPreviousChange,
}: {
  page: Flight[]
  /** Typed into this page's row: only the landings, which the roster doesn't have. */
  pageEntries: string[]
  onPageEntriesChange: (values: string[]) => void
  previous: string[]
  onPreviousChange: (values: string[]) => void
}) {
  const previousValues = parse(previous)
  const pageValues = parse(pageEntries)
  const thisPage = add(pageTotals(page), pageValues)

  function entry(
    row: string,
    values: string[],
    parsed: (number | undefined)[],
    onChange: (v: string[]) => void,
    i: number,
  ) {
    return (
      <TableCell key={i} className="p-1">
        <Input
          aria-label={`${row}, column ${i + 1}`}
          aria-invalid={parsed[i] === undefined}
          placeholder={KINDS[i] === "time" ? "h:mm" : "0"}
          value={values[i] ?? ""}
          onChange={(e) => onChange(KINDS.map((_, j) => (j === i ? e.target.value : (values[j] ?? ""))))}
          className="h-7 min-w-14 px-1.5 text-right tabular-nums"
        />
      </TableCell>
    )
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
            <TableCell className="pl-4 font-medium">Total this page</TableCell>
            {format(thisPage).map((v, i) =>
              LANDINGS.includes(i) ? (
                entry("Total this page", pageEntries, pageValues, onPageEntriesChange, i)
              ) : (
                <TableCell key={i} className="text-right tabular-nums">
                  {v}
                </TableCell>
              ),
            )}
          </TableRow>
          <TableRow className="hover:bg-transparent">
            <TableCell className="pl-4 font-medium">Total previous pages</TableCell>
            {KINDS.map((_, i) => entry("Total previous pages", previous, previousValues, onPreviousChange, i))}
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
