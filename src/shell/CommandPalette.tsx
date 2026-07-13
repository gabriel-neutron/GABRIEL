import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Input } from "@/ui/input"
import { modules } from "./moduleRegistry"
import { useSelectedRef } from "@/store/useSelectedRef"
import type { ModuleCommand, ModuleCommandContext } from "@/types/module.types"

type Props = {
  readOnly: boolean
}

/**
 * Ctrl/Cmd+K palette (ADR 0007) — additive to the existing header "..." dropdown,
 * fed by every module's `commands[]`. `shell/moduleRegistry.ts` composes the list
 * generically; this component never names a specific module.
 */
export function CommandPalette({ readOnly }: Props): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selectedRef = useSelectedRef()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const ctx: ModuleCommandContext = useMemo(() => ({ selectedRef, readOnly }), [selectedRef, readOnly])

  const commands = useMemo(() => {
    const all: ModuleCommand[] = modules.flatMap((m) => m.commands ?? [])
    return all.filter((c) => c.when?.(ctx) ?? true)
  }, [ctx])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query])

  function runCommand(command: ModuleCommand) {
    command.run(ctx)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[10000] max-w-md gap-0 p-0" showCloseButton>
        <DialogHeader className="border-b border-border px-3 py-2">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <Input
            autoFocus
            placeholder="Type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matching commands</div>
          ) : (
            filtered.map((command) => (
              <button
                key={command.id}
                type="button"
                className="w-full rounded px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => runCommand(command)}
              >
                {command.label}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
