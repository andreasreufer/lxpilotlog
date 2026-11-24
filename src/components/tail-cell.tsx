import { useState } from "react"
import { AlertTriangleIcon, Loader2Icon, PencilIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { TailResult } from "@/lib/tails"

export type TailState = TailResult | { status: "loading" }

export function TailCell({
  state,
  override,
  available,
  onOverride,
}: {
  state: TailState | undefined
  override: string | undefined
  available: boolean
  onOverride: (reg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const reg = override ?? (state?.status === "found" ? state.reg : undefined)

  if (editing) {
    return (
      <Input
        autoFocus
        defaultValue={reg ?? ""}
        placeholder="HB-…"
        className="h-7 w-28 font-mono text-xs uppercase"
        onBlur={(e) => {
          onOverride(e.target.value)
          setEditing(false)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          if (e.key === "Escape") setEditing(false)
        }}
      />
    )
  }

  let content: React.ReactNode
  let hint: string
  if (reg) {
    content = <span className="font-mono">{reg}</span>
    hint = override
      ? "Entered manually · click to edit"
      : state?.status === "found"
        ? `${state.model ? `${state.model} · ` : ""}from FlightAware · click to edit`
        : "Click to edit"
  } else if (state?.status === "loading") {
    content = <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
    hint = "Looking up…"
  } else if (state?.status === "error") {
    content = <AlertTriangleIcon className="size-4 text-destructive" />
    hint = state.message
  } else {
    content = <span className="text-muted-foreground">—</span>
    hint =
      state?.status === "not-found"
        ? "No aircraft known to FlightAware (yet) · click to enter"
        : available
          ? "Not looked up yet · click to enter"
          : "Lookup only covers the last 10 days · click to enter"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="group inline-flex h-7 min-w-16 items-center gap-1.5 rounded-md px-1.5 -mx-1.5 text-left hover:bg-muted"
        >
          {content}
          <PencilIcon className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
