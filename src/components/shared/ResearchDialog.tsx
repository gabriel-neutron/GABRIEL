import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { shouldSkipEntity } from "@/services/research/entity-richness"
import type { MapEntity } from "@/types/domain.types"
import type { EntityResearchStatus } from "@/hooks/useLayeredResearch"
import type { LayeredResearchResult } from "@/services/research/layered-research.service"

type ResearchDialogProps = {
  open: boolean
  onClose: () => void
  entities: MapEntity[]
  entityStatuses: Record<string, EntityResearchStatus>
  totalUsage: { inputTokens: number; outputTokens: number }
  cacheAdditions: Array<{ url: string; content: string }>
  lastStats: LayeredResearchResult["stats"] | null
  runStatus: "idle" | "running" | "done" | "failed"
  progress: { entityId: string; name: string; layer: number; done: number; total: number } | null
  reviewQueueLength: number
  batchSize: number
  setBatchSize: (n: number) => void
  richnessThreshold: number
  setRichnessThreshold: (n: number) => void
  skipAnalyzedWithinDays: number
  setSkipAnalyzedWithinDays: (n: number) => void
  hasProcessedEntities: boolean
  onRun: () => void
  onCancel: () => void
  onReviewNext: () => void
}

const BATCH_SIZE_OPTIONS = [5, 10, 20, 50, 100]
const RICHNESS_OPTIONS = [
  { label: "Never skip", value: 0 },
  { label: "3+ sources", value: 6 },
  { label: "2+ sources", value: 4 },
  { label: "1+ sources", value: 2 },
  { label: "Has notes", value: 1 },
]
const ANALYZED_WINDOW_OPTIONS = [
  { label: "Never skip by date", value: 0 },
  { label: "Last 24h", value: 1 },
  { label: "Last 3 days", value: 3 },
  { label: "Last 7 days", value: 7 },
  { label: "Last 14 days", value: 14 },
  { label: "Last 30 days", value: 30 },
]

function isAnalyzedRecently(entity: MapEntity, withinDays: number): boolean {
  if (withinDays <= 0 || !entity.analyzedAt) return false
  const analyzedMs = Date.parse(entity.analyzedAt)
  if (!Number.isFinite(analyzedMs)) return false
  const windowMs = withinDays * 24 * 60 * 60 * 1000
  return Date.now() - analyzedMs <= windowMs
}

function StatusIcon({ status }: { status: EntityResearchStatus | undefined }) {
  switch (status) {
    case "running":
      return <span className="animate-pulse text-blue-500 font-mono">→</span>
    case "done":
      return <span className="text-green-600 font-mono">✓</span>
    case "done-empty":
      return <span className="text-muted-foreground font-mono">✓</span>
    case "failed":
      return <span className="text-red-600 font-mono">!</span>
    case "skipped-rich":
      return <span className="text-amber-500 font-mono">—</span>
    case "skipped-recent":
      return <span className="text-sky-500 font-mono">⏱</span>
    case "skipped-abort":
      return <span className="text-muted-foreground font-mono">✗</span>
    case "pending":
    default:
      return <span className="text-muted-foreground font-mono">○</span>
  }
}

function StatusLabel({ status }: { status: EntityResearchStatus | undefined }) {
  switch (status) {
    case "running": return <span className="text-blue-500 text-xs">running</span>
    case "done": return <span className="text-green-600 text-xs">done</span>
    case "done-empty": return <span className="text-muted-foreground text-xs">no results</span>
    case "failed": return <span className="text-red-600 text-xs">failed</span>
    case "skipped-rich": return <span className="text-amber-500 text-xs">rich — skipped</span>
    case "skipped-recent": return <span className="text-sky-600 text-xs">recent — skipped</span>
    case "skipped-abort": return <span className="text-muted-foreground text-xs">not reached</span>
    default: return <span className="text-muted-foreground text-xs">pending</span>
  }
}

function formatTokens(n: number): string {
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k`
  return `~${n}`
}

function formatAnalyzedAt(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function ResearchDialog({
  open,
  onClose,
  entities,
  entityStatuses,
  totalUsage,
  cacheAdditions,
  lastStats,
  runStatus,
  progress,
  reviewQueueLength,
  batchSize,
  setBatchSize,
  richnessThreshold,
  setRichnessThreshold,
  skipAnalyzedWithinDays,
  setSkipAnalyzedWithinDays,
  hasProcessedEntities,
  onRun,
  onCancel,
  onReviewNext,
}: ResearchDialogProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll the running entity into view
  useEffect(() => {
    if (!progress || !listRef.current) return
    const el = listRef.current.querySelector(`[data-entity-id="${progress.entityId}"]`)
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  }, [progress])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && runStatus !== "running") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, runStatus])

  if (!open) return null

  const isRunning = runStatus === "running"
  const totalTokens = totalUsage.inputTokens + totalUsage.outputTokens
  const progressPct = progress ? Math.round(((progress.done + 1) / progress.total) * 100) : 0
  const eligibleEntities = entities.filter(
    (entity) =>
      !shouldSkipEntity(entity, richnessThreshold) &&
      !isAnalyzedRecently(entity, skipAnalyzedWithinDays),
  )
  const hasEligibleEntities = eligibleEntities.length > 0

  const startLabel = hasProcessedEntities
    ? `Continue (next ${batchSize})`
    : `Start research (${Math.min(batchSize, eligibleEntities.length)} entities)`

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4">
      <Card className="flex w-full max-w-2xl flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold">Research all entities</h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            disabled={isRunning}
            className="h-7 px-2"
          >
            Close
          </Button>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
          {/* Config row — hidden while running */}
          {!isRunning && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/30 px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Batch size</span>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="rounded border bg-background px-2 py-0.5 text-sm"
                >
                  {BATCH_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} entities</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Skip if</span>
                <select
                  value={richnessThreshold}
                  onChange={(e) => setRichnessThreshold(Number(e.target.value))}
                  className="rounded border bg-background px-2 py-0.5 text-sm"
                >
                  {RICHNESS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Skip analyzed</span>
                <select
                  value={skipAnalyzedWithinDays}
                  onChange={(e) => setSkipAnalyzedWithinDays(Number(e.target.value))}
                  className="rounded border bg-background px-2 py-0.5 text-sm"
                >
                  {ANALYZED_WINDOW_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Progress bar */}
          {isRunning && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Layer {(progress?.layer ?? 0) + 1} · {progress?.name ?? "…"}
                </span>
                <span>{progress ? `${progress.done + 1} / ${progress.total}` : ""}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats row */}
          {(totalTokens > 0 || cacheAdditions.length > 0) && (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {totalTokens > 0 && (
                <span>{formatTokens(totalTokens)} tokens est.</span>
              )}
              {cacheAdditions.length > 0 && (
                <span>{cacheAdditions.length} new sources cached</span>
              )}
              {lastStats && lastStats.sourcesFromCache > 0 && (
                <span>{lastStats.sourcesFromCache} cache hits</span>
              )}
              {reviewQueueLength > 0 && (
                <span className="font-medium text-foreground">
                  {reviewQueueLength} {reviewQueueLength === 1 ? "entity" : "entities"} to review
                </span>
              )}
            </div>
          )}

          {/* Entity list */}
          <div
            ref={listRef}
            className="max-h-72 overflow-y-auto rounded-md border text-sm"
          >
            {entities.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No entities in project.
              </p>
            ) : !hasEligibleEntities ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No entities match the current skip filters.
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-3 py-1.5 text-left font-medium w-6"></th>
                    <th className="px-3 py-1.5 text-left font-medium">Entity</th>
                    <th className="px-3 py-1.5 text-left font-medium hidden sm:table-cell">Echelon</th>
                    <th className="px-3 py-1.5 text-right font-medium">Src</th>
                    <th className="px-3 py-1.5 text-left font-medium">Status</th>
                    <th className="px-3 py-1.5 text-left font-medium hidden md:table-cell">Analyzed</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleEntities.map((entity) => {
                    const st = entityStatuses[entity.id]
                    const isCurrentEntity = progress?.entityId === entity.id
                    const sourceCount = typeof entity.sources === "string"
                      ? entity.sources.split("\n").filter((s) => s.trim()).length
                      : Array.isArray(entity.sources) ? (entity.sources as string[]).length : 0
                    return (
                      <tr
                        key={entity.id}
                        data-entity-id={entity.id}
                        className={
                          isCurrentEntity
                            ? "bg-blue-500/10 dark:bg-blue-400/10"
                            : "hover:bg-muted/30"
                        }
                      >
                        <td className="px-3 py-1.5 text-center">
                          <StatusIcon status={st} />
                        </td>
                        <td className="px-3 py-1.5 max-w-[180px] truncate font-medium">
                          {entity.name}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground hidden sm:table-cell">
                          {entity.echelon ?? "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {sourceCount > 0 ? sourceCount : "—"}
                        </td>
                        <td className="px-3 py-1.5">
                          <StatusLabel status={st} />
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground hidden md:table-cell">
                          {formatAnalyzedAt(entity.analyzedAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-3">
          <div className="flex gap-2">
            {isRunning ? (
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                Stop
              </Button>
            ) : (
              reviewQueueLength > 0 && (
                <Button type="button" size="sm" variant="secondary" onClick={onReviewNext}>
                  Review next ({reviewQueueLength})
                </Button>
              )
            )}
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isRunning || !hasEligibleEntities}
            onClick={onRun}
          >
            {isRunning ? "Running…" : startLabel}
          </Button>
        </div>
      </Card>
    </div>
  )
}
