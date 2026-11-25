import { useState, type ReactNode } from "react"
import { SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SettingsDialog({
  apiKey,
  onSave,
  onClearCache,
  children,
}: {
  apiKey: string
  onSave: (key: string) => void
  onClearCache: () => void
  /** The calendar feed form */
  children: ReactNode
}) {
  const [draft, setDraft] = useState(apiKey)

  return (
    <Dialog onOpenChange={(open) => open && setDraft(apiKey)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Everything here is stored only in this browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="feed-url">Calendar feed</Label>
          {children}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="api-key">AeroAPI key</Label>
          <p className="text-sm text-muted-foreground">
            Tail signs come from{" "}
            <a
              className="underline underline-offset-2"
              href="https://flightaware.com/aeroapi/portal"
              target="_blank"
              rel="noreferrer"
            >
              FlightAware AeroAPI
            </a>
            . The Personal tier includes $5 of free usage per month. Create an API key there and paste it here.
          </p>
          <Input
            id="api-key"
            type="password"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono"
          />
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClearCache}>
            Clear cached tail signs
          </Button>
          <DialogClose asChild>
            <Button onClick={() => onSave(draft.trim())}>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
