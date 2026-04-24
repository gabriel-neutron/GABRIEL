import { useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, X } from "lucide-react"

export type ToastItem = {
  id: string
  title: string
  description: string
}

type ToastStackProps = {
  items: ToastItem[]
  onDismiss: (id: string) => void
}

export function ToastStack({ items, onDismiss }: ToastStackProps) {
  const visibleItems = useMemo(() => items.slice(-3), [items])

  useEffect(() => {
    if (visibleItems.length === 0) return
    const timers = visibleItems.map((item) =>
      window.setTimeout(() => onDismiss(item.id), 8000),
    )
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [visibleItems, onDismiss])

  if (visibleItems.length === 0) return null

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[12000] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {visibleItems.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto rounded-lg border border-amber-500/30 bg-zinc-950/95 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3 p-3">
            <div className="mt-0.5 shrink-0 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-50">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-300">{item.description}</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              onClick={() => onDismiss(item.id)}
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
