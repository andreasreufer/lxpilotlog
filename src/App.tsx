import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns"
import type { DateRange } from "react-day-picker"
import { toast } from "sonner"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  Loader2Icon,
  PlaneIcon,
  RefreshCwIcon,
  SearchIcon,
  SquareIcon,
  UploadIcon,
} from "lucide-react"

import { cn } from "cn"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LogbookTotals } from "@/components/logbook-totals"
import { SettingsDialog } from "@/components/settings-dialog"
import { TailCell, type TailState } from "@/components/tail-cell"
import { blockMinutes, formatDuration, formatUtcDate, formatUtcTime, parseFlights, type Flight } from "@/lib/flights"
import {
  clearCache,
  loadCache,
  loadOverrides,
  isLookupAvailable,
  LookupError,
  saveOverrides,
  storeResult,
  TailLookup,
  tailKey,
} from "@/lib/tails"
import { toIcao } from "@/lib/airports"
import { PROXY } from "@/lib/proxy"
import { readSetting, writeSetting } from "@/lib/storage"

/** schedule.swiss.com has no CORS headers, so go through the proxy. */
function toFetchUrl(feedUrl: string): string {
  const url = new URL(feedUrl.trim().replace(/^webcals?:\/\//, "https://"))
  if (url.hostname === "schedule.swiss.com") {
    return `${PROXY}/swiss-schedule${url.pathname}${url.search}`
  }
  return url.toString()
}

export default function App() {
  const [feedUrl, setFeedUrl] = useState(() => readSetting("feedUrl") ?? "")
  const [apiKey, setApiKey] = useState(() => readSetting("aeroapiKey") ?? "")
  const [flights, setFlights] = useState<Flight[]>([])
  const [loading, setLoading] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date>()
  const [range, setRange] = useState<DateRange | undefined>(lastSevenDays)
  const [tails, setTails] = useState<Record<string, TailState>>(() => loadCache())
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadOverrides())
  const [lookup, setLookup] = useState<{ done: number; total: number }>()
  const [windowStart, setWindowStart] = useState<number>()
  const [windowSize, setWindowSize] = useState(7)
  const abortRef = useRef<AbortController | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const ingest = useCallback((text: string) => {
    const all = parseFlights(text)
    // Deadhead (positioning) legs are not flown, so they don't belong in the log.
    const parsed = all.filter((f) => f.role !== "DH")
    setFlights(parsed)
    setLoadedAt(new Date())
    const skipped = all.length - parsed.length
    toast.success(`Loaded ${parsed.length} flights`, {
      description: skipped ? `${skipped} deadhead flights ignored` : undefined,
    })
  }, [])

  const loadFeed = useCallback(
    async (url: string) => {
      if (!url.trim()) return
      setLoading(true)
      try {
        const res = await fetch(toFetchUrl(url))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        ingest(await res.text())
        writeSetting("feedUrl", url.trim())
      } catch (err) {
        toast.error("Could not load calendar feed", { description: String(err) })
      } finally {
        setLoading(false)
      }
    },
    [ingest],
  )

  useEffect(() => {
    if (feedUrl) void loadFeed(feedUrl)
    // Only auto-load the remembered feed once on startup.
  }, [])

  const visible = useMemo(() => {
    const from = range?.from ? format(range.from, "yyyy-MM-dd") : undefined
    const to = range?.to ? format(range.to, "yyyy-MM-dd") : from
    return flights.filter((f) => {
      const d = formatUtcDate(f.departureUtc)
      return (!from || d >= from) && (!to || d <= to)
    })
  }, [flights, range])

  const totalBlock = visible.reduce((sum, f) => sum + blockMinutes(f), 0)
  // Window of consecutive shown flights; kept inside the list when the date range shrinks.
  const start = windowStart === undefined ? undefined : Math.max(0, Math.min(windowStart, visible.length - windowSize))
  const end = start === undefined ? 0 : Math.min(start + windowSize, visible.length)
  const inWindow = (i: number) => start !== undefined && i >= start && i < end
  const windowBlock = visible.filter((_, i) => inWindow(i)).reduce((sum, f) => sum + blockMinutes(f), 0)

  const tailFor = (f: Flight): string | undefined => {
    const key = tailKey(f)
    if (overrides[key]) return overrides[key]
    const t = tails[key]
    return t?.status === "found" ? t.reg : undefined
  }

  async function runLookup() {
    if (!apiKey) {
      toast.error("Add your FlightAware AeroAPI key in settings first")
      return
    }
    const pending = visible.filter((f) => {
      const key = tailKey(f)
      const t = tails[key]
      const retry = !t || t.status === "error" || (t.status === "not-found" && f.departureUtc.getTime() > Date.now())
      return !overrides[key] && isLookupAvailable(f) && retry
    })
    if (pending.length === 0) {
      toast.info("Nothing to look up", {
        description:
          "Tail signs in this range are known, or the flights are outside FlightAware's window (last 10 days to 2 days ahead).",
      })
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    const lookup = new TailLookup(apiKey, controller.signal)
    setLookup({ done: 0, total: pending.length })
    let errors = 0

    try {
      for (const [i, f] of pending.entries()) {
        const key = tailKey(f)
        setTails((t) => ({ ...t, [key]: { status: "loading" } }))
        const result = await lookup.lookup(f).catch((err: unknown) => {
          // Login or quota problems affect every flight - stop right away.
          if (controller.signal.aborted || err instanceof LookupError) throw err
          return { status: "error" as const, message: String(err) }
        })
        if (result.status === "error") errors++
        storeResult(f, result)
        setTails((t) => ({ ...t, [key]: result }))
        setLookup({ done: i + 1, total: pending.length })
      }
    } catch (err) {
      if (err instanceof LookupError) toast.error(err.message)
    } finally {
      // Drop any "loading" markers left by an abort.
      setTails((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => v.status !== "loading")))
      setLookup(undefined)
      abortRef.current = null
      if (errors) toast.error(`${errors} lookup(s) failed`, { description: "Hover a ⚠ cell for details." })
    }
  }

  function setOverride(f: Flight, reg: string) {
    const next = { ...overrides }
    const value = reg.trim().toUpperCase()
    if (value) next[tailKey(f)] = value
    else delete next[tailKey(f)]
    setOverrides(next)
    saveOverrides(next)
  }

  function exportCsv() {
    const header = ["Flight", "Date (UTC)", "From", "To", "Dep (UTC)", "Arr (UTC)", "Block", "Type", "Role", "Tail"]
    const rows = visible.map((f) => [
      f.flightNumber,
      formatUtcDate(f.departureUtc),
      toIcao(f.from) ?? f.from,
      toIcao(f.to) ?? f.to,
      formatUtcTime(f.departureUtc),
      formatUtcTime(f.arrivalUtc),
      formatDuration(blockMinutes(f)),
      f.aircraftType ?? "",
      f.role ?? "",
      tailFor(f) ?? "",
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(",")).join("\n")
    const a = document.createElement("a")
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
    const from = range?.from ? format(range.from, "yyyy-MM-dd") : "all"
    const to = range?.to ? format(range.to, "yyyy-MM-dd") : from
    a.download = `flights_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <PlaneIcon className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">LXpilotLog</h1>
            <p className="text-sm text-muted-foreground">Flights from your crew schedule feed, times in UTC</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh calendar feed"
                disabled={loading || !feedUrl.trim()}
                onClick={() => void loadFeed(feedUrl)}
              >
                <RefreshCwIcon className={cn(loading && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh calendar feed{loadedAt && ` (loaded ${format(loadedAt, "HH:mm")})`}</TooltipContent>
          </Tooltip>
          <SettingsDialog
            apiKey={apiKey}
            onSave={(key) => {
              setApiKey(key)
              writeSetting("aeroapiKey", key)
            }}
            onClearCache={() => {
              clearCache()
              setTails({})
              toast.success("Tail sign cache cleared")
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) ingest(await file.text())
                e.target.value = ""
              }}
            />
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void loadFeed(feedUrl)
              }}
            >
              <Input
                id="feed-url"
                type="url"
                placeholder="https://schedule.swiss.com/…/….ics"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading || !feedUrl.trim()}>
                  {loading ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
                  Load feed
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                      <UploadIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open an .ics file instead</TooltipContent>
                </Tooltip>
              </div>
            </form>
            {loadedAt && (
              <p className="mt-2 text-xs text-muted-foreground">
                {flights.length} flights in feed (excluding deadheads) · loaded {format(loadedAt, "HH:mm:ss")}
              </p>
            )}
          </SettingsDialog>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker range={range} onChange={setRange} flights={flights} />
        <div className="ml-auto flex gap-2">
          {lookup ? (
            <Button variant="outline" onClick={() => abortRef.current?.abort()}>
              <SquareIcon />
              Stop ({lookup.done}/{lookup.total})
            </Button>
          ) : (
            <Button variant="outline" onClick={runLookup} disabled={visible.length === 0}>
              <SearchIcon />
              Look up tail signs
            </Button>
          )}
          <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
            <DownloadIcon />
            CSV
          </Button>
        </div>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Flight</TableHead>
              <TableHead>Date (UTC)</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Dep (UTC)</TableHead>
              <TableHead>Arr (UTC)</TableHead>
              <TableHead className="text-right">Block</TableHead>
              <TableHead>Tail</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="pr-4">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                  {flights.length === 0
                    ? "Add your calendar feed in the settings (gear icon) to see your flights."
                    : "No flights in this date range."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((f, i) => {
                const key = tailKey(f)
                return (
                  <TableRow
                    key={f.uid}
                    data-window={
                      inWindow(i) ? `${i === start ? "first " : ""}${i === end - 1 ? "last" : ""}` : undefined
                    }
                    className={cn("cursor-pointer", f.arrivalUtc.getTime() > Date.now() && "opacity-50")}
                    onClick={(e) => {
                      // Clicks on the tail sign editor shouldn't move the window.
                      if (!(e.target as HTMLElement).closest("button, input, a")) setWindowStart(i)
                    }}
                  >
                    <TableCell className="pl-4 font-medium">{f.flightNumber}</TableCell>
                    <TableCell className="tabular-nums">{formatUtcDate(f.departureUtc)}</TableCell>
                    <TableCell>
                      <Airport iata={f.from} />
                    </TableCell>
                    <TableCell>
                      <Airport iata={f.to} />
                    </TableCell>
                    <TableCell className="tabular-nums">{formatUtcTime(f.departureUtc)}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatUtcTime(f.arrivalUtc)}
                      {formatUtcDate(f.arrivalUtc) !== formatUtcDate(f.departureUtc) && (
                        <sup className="ml-0.5 text-muted-foreground">+1</sup>
                      )}
                    </TableCell>
                    <TableCell className="relative text-right tabular-nums">
                      {formatDuration(blockMinutes(f))}
                      {i === end - 1 && (
                        <span className="absolute right-0 bottom-0 z-10 translate-y-1/2 rounded-md border bg-background px-2 py-0.5 font-semibold shadow-sm">
                          Σ {formatDuration(windowBlock)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TailCell
                        state={tails[key]}
                        override={overrides[key]}
                        available={isLookupAvailable(f)}
                        onOverride={(reg) => setOverride(f, reg)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{f.aircraftType}</TableCell>
                    <TableCell className="pr-4">{f.role && <Badge variant="outline">{f.role}</Badge>}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
          {visible.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={10} className="pl-4">
                  <div className="flex items-center gap-2">
                    Window of
                    <Input
                      type="number"
                      min={1}
                      aria-label="Flights in window"
                      value={windowSize}
                      onChange={(e) => setWindowSize(Math.max(1, Number(e.target.value) || 1))}
                      className="h-7 w-16"
                    />
                    flights
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label="Move window to earlier flights"
                      disabled={start === undefined || start === 0}
                      onClick={() => setWindowStart((start ?? 0) - 1)}
                    >
                      <ChevronLeftIcon />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label="Move window to later flights"
                      disabled={start !== undefined && start + windowSize >= visible.length}
                      onClick={() => setWindowStart(start === undefined ? 0 : start + 1)}
                    >
                      <ChevronRightIcon />
                    </Button>
                    {start === undefined ? (
                      <span className="text-muted-foreground">Click a flight to start the window there</span>
                    ) : (
                      <>
                        <span className="text-muted-foreground">
                          flights {start + 1}–{end}
                        </span>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => setWindowStart(undefined)}
                        >
                          Clear
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={6} className="pl-4">
                  {visible.length} flights
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatDuration(totalBlock)}</TableCell>
                <TableCell colSpan={3} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </Card>

      {start !== undefined && (
        <LogbookTotals
          page={visible.slice(start, end)}
          previous={flights.filter((f) => f.departureUtc < visible[start].departureUtc)}
        />
      )}

      <p className="text-xs text-muted-foreground">
        Version{" "}
        <a
          className="underline underline-offset-2"
          href={`https://github.com/andreasreufer/lxpilotlog/commit/${import.meta.env.VITE_COMMIT}`}
          target="_blank"
          rel="noreferrer"
        >
          {import.meta.env.VITE_VERSION}
        </a>
        . Times are scheduled times from the roster. Deadhead flights are not listed. Tail signs come from FlightAware
        AeroAPI and can be looked up for flights from the last 10 days up to 2 days ahead. Click a tail sign to correct
        it manually.
      </p>
    </div>
  )
}

/** Today and the six days before it. */
function lastSevenDays(): DateRange {
  const today = new Date()
  return { from: subDays(today, 6), to: today }
}

/** ICAO code, with the roster's IATA code on hover. */
function Airport({ iata }: { iata: string }) {
  const icao = toIcao(iata)
  if (!icao) return <span title="No ICAO code known">{iata}</span>
  return <span title={iata}>{icao}</span>
}

function DateRangePicker({
  range,
  onChange,
  flights,
}: {
  range: DateRange | undefined
  onChange: (r: DateRange | undefined) => void
  flights: Flight[]
}) {
  const now = new Date()
  const last = subMonths(now, 1)
  const presets: { label: string; range: DateRange | undefined }[] = [
    { label: "Last 7 days", range: lastSevenDays() },
    { label: "This month", range: { from: startOfMonth(now), to: endOfMonth(now) } },
    { label: "Last month", range: { from: startOfMonth(last), to: endOfMonth(last) } },
    {
      label: "All",
      range: flights.length
        ? { from: utcDateAsLocal(flights[0].departureUtc), to: utcDateAsLocal(flights.at(-1)!.departureUtc) }
        : undefined,
    },
  ]

  const label = range?.from
    ? range.to && range.to.getTime() !== range.from.getTime()
      ? `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`
      : format(range.from, "d MMM yyyy")
    : "All dates"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="min-w-60 justify-start font-normal">
            <CalendarIcon />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={range?.from}
            selected={range}
            onSelect={onChange}
            weekStartsOn={1}
          />
        </PopoverContent>
      </Popover>
      {presets.map((p) => (
        <Button key={p.label} variant="ghost" size="sm" onClick={() => onChange(p.range)}>
          {p.label}
        </Button>
      ))}
    </div>
  )
}

/** Calendar works on local dates; map a UTC calendar day onto the same local day. */
function utcDateAsLocal(d: Date) {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
