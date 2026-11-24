import { useState } from "react"
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
import type { Credentials } from "@/lib/tails"

export function SettingsDialog({
  creds,
  onSave,
  onClearCache,
}: {
  creds: Credentials
  onSave: (creds: Credentials) => void
  onClearCache: () => void
}) {
  const [draft, setDraft] = useState(creds)

  return (
    <Dialog onOpenChange={(open) => open && setDraft(creds)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Settings">
          <SettingsIcon />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tail sign lookup</DialogTitle>
          <DialogDescription>
            Tail signs are matched from free{" "}
            <a className="underline underline-offset-2" href="https://opensky-network.org" target="_blank" rel="noreferrer">
              OpenSky Network
            </a>{" "}
            ADS-B data. Create a free account, then on your{" "}
            <a
              className="underline underline-offset-2"
              href="https://opensky-network.org/my-opensky/account"
              target="_blank"
              rel="noreferrer"
            >
              account page
            </a>{" "}
            create an API client and paste its credentials here. They are stored only in this browser.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              autoComplete="off"
              value={draft.clientId}
              onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-secret">Client secret</Label>
            <Input
              id="client-secret"
              type="password"
              autoComplete="off"
              value={draft.clientSecret}
              onChange={(e) => setDraft({ ...draft, clientSecret: e.target.value })}
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClearCache}>
            Clear cached tail signs
          </Button>
          <DialogClose asChild>
            <Button onClick={() => onSave({ clientId: draft.clientId.trim(), clientSecret: draft.clientSecret.trim() })}>
              Save
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
