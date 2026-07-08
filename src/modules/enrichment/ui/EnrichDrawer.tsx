import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import type { MapEntity } from "@/types/domain.types"
import type {
  EnrichmentConflictCandidate,
  EnrichmentContext,
  EnrichmentProposal,
  UnresolvedReason,
} from "@/types/enrichment.types"
import { formatValue } from "./formatValue"
import { ProposalCard } from "./ProposalCard"
import { SourceTag } from "./SourceTag"

type EnrichDrawerProps = {
  open: boolean
  entity: MapEntity | null
  context: EnrichmentContext | null
  prompt: string
  status: "idle" | "running" | "success" | "partial" | "failed"
  queryTrace: string[]
  depthUsed: number
  unresolvedFields: string[]
  unresolvedReasons: Record<string, UnresolvedReason>
  conflicts?: Record<string, EnrichmentConflictCandidate[]>
  notes: string
  proposals: EnrichmentProposal[]
  decisions: Record<string, "accepted" | "rejected" | "pending">
  errorMessage: string | null
  closeNotice: string | null
  onClose: () => void
  onPromptChange: (value: string) => void
  onRun: () => void
  onAccept: (field: string) => void
  onReject: (field: string) => void
}

function renderChildren(context: EnrichmentContext | null): string {
  if (!context || context.children.length === 0) return "None"
  return context.children.map((child) => child.name).join(", ")
}

function formatAnalyzedAt(value: string | null | undefined): string {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Never"
  return date.toLocaleString()
}

function reasonBadgeLabel(reason: UnresolvedReason): string {
  const labels: Record<UnresolvedReason, string> = {
    conflict: "Conflict",
    stale: "Stale",
    "no-evidence": "No evidence",
    other: "Other",
  }
  return labels[reason]
}

type EnrichDrawerSidebarProps = {
  entity: MapEntity
  context: EnrichmentContext | null
  prompt: string
  status: EnrichDrawerProps["status"]
  queryTrace: string[]
  depthUsed: number
  errorMessage: string | null
  onPromptChange: (value: string) => void
  onRun: () => void
}

function EnrichDrawerSidebar({
  entity,
  context,
  prompt,
  status,
  queryTrace,
  depthUsed,
  errorMessage,
  onPromptChange,
  onRun,
}: EnrichDrawerSidebarProps) {
  const entityRows = [
    ["Entity", entity.name],
    ["Parent", context?.parent?.name ?? "None"],
    ["Children", renderChildren(context)],
    ["Last analyzed", formatAnalyzedAt(entity.analyzedAt)],
  ] as const

  return (
    <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
      <Card className="p-2.5">
        <div className="space-y-1 text-sm">
          {entityRows.map(([label, value]) => (
            <div key={label} className="rounded-md border bg-muted/30 px-2 py-1 font-medium">
              {label}: {value}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-2.5">
        <div>
          <label htmlFor="enrichment-prompt" className="font-medium">
            Research prompt
          </label>
        </div>
        <Textarea
          id="enrichment-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          rows={5}
          className="text-sm leading-relaxed"
        />
        <Button type="button" onClick={onRun} disabled={status === "running"} className="h-8 w-full sm:w-auto">
          {status === "running" ? "Running enrichment..." : "Run enrichment"}
        </Button>
      </Card>

      {(status === "running" || queryTrace.length > 0 || errorMessage) && (
        <Card className="p-2.5">
          {status === "running" && (
            <p className="text-sm font-medium text-muted-foreground">
              Processing hop {depthUsed || 1} in auto-depth mode
            </p>
          )}
          {queryTrace.length > 0 && (
            <>
            <p className="font-medium">Query trace</p>
            <ul className="list-disc space-y-0.5 pl-4">
              {queryTrace.map((query, index) => (
                <li key={`${query}-${index}`} className="break-words">
                  {query}
                </li>
              ))}
            </ul>
            </>
          )}
          {errorMessage && <p className="text-xs text-muted-foreground">Error details shown in header.</p>}
        </Card>
      )}
    </div>
  )
}

export function EnrichDrawer({
  open,
  entity,
  context,
  prompt,
  status,
  queryTrace,
  depthUsed,
  unresolvedFields,
  unresolvedReasons,
  conflicts,
  notes,
  proposals,
  decisions,
  errorMessage,
  closeNotice,
  onClose,
  onPromptChange,
  onRun,
  onAccept,
  onReject,
}: EnrichDrawerProps) {
  if (!entity) return null

  const isRunning = status === "running"
  const visibleProposals = proposals.filter(
    (proposal) => (decisions[proposal.field] ?? "pending") === "pending",
  )
  const hasProposals = visibleProposals.length > 0

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[10990]" />
        <DialogContent
          aria-describedby="enrich-dialog-status"
          showCloseButton={false}
          className="z-[11000] h-dvh w-dvw max-w-none overflow-hidden rounded-none border-0 bg-card p-0 md:h-[92vh] md:w-[92vw] md:max-w-6xl md:rounded-lg md:border"
        >
        <div className="flex h-full min-h-0 flex-col">
          <DialogHeader className="sticky top-0 z-20 shrink-0 border-b bg-card/95 px-3 py-2 text-left backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle id="enrich-dialog-title" className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  Enrich: {entity.name}
                </DialogTitle>
                <p className="text-xs text-muted-foreground">Last analyzed: {formatAnalyzedAt(entity.analyzedAt)}</p>
              </div>
              <Button type="button" variant="ghost" onClick={onClose} className="h-8 px-2.5">
                Close
              </Button>
            </div>
            {errorMessage && (
              <p className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
                {errorMessage}
              </p>
            )}
            {closeNotice && (
              <p className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-sm text-amber-700 dark:text-amber-300">
                {closeNotice}
              </p>
            )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-2.5">
            <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[320px_minmax(0,1fr)]">
              <EnrichDrawerSidebar
                entity={entity}
                context={context}
                prompt={prompt}
                status={status}
                queryTrace={queryTrace}
                depthUsed={depthUsed}
                errorMessage={errorMessage}
                onPromptChange={onPromptChange}
                onRun={onRun}
              />

              <div className="h-full space-y-2 overflow-x-hidden overflow-y-auto">
                {hasProposals ? (
                  visibleProposals.map((proposal) => (
                    <ProposalCard
                      key={proposal.field}
                      proposal={proposal}
                      decision={decisions[proposal.field] ?? "pending"}
                      onAccept={() => onAccept(proposal.field)}
                      onReject={() => onReject(proposal.field)}
                    />
                  ))
                ) : (
                  <Card className="border-dashed text-center">
                    <p className="text-sm font-medium">{isRunning ? "Enrichment is running..." : "No proposals"}</p>
                  </Card>
                )}

                {unresolvedFields.length > 0 && (
                  <Card className="text-sm py-2">
                    <p className="font-medium px-2.5">Unresolved fields</p>
                    <ul className="mt-2 space-y-3 px-2.5 pb-2.5">
                      {unresolvedFields.map((field) => {
                        const reason = unresolvedReasons[field] ?? "no-evidence"
                        const rows = conflicts?.[field]
                        return (
                          <li key={field} className="rounded-md border bg-muted/20 p-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold">{field}</span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                {reasonBadgeLabel(reason)}
                              </span>
                            </div>
                            {reason === "conflict" && rows != null && rows.length > 0 && (
                              <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
                                {rows.map((row, index) => (
                                  <div key={`${field}-c-${index}`} className="space-y-1">
                                    <p className="text-xs text-muted-foreground">Candidate</p>
                                    <p className="break-words text-sm font-medium">{formatValue(row.value)}</p>
                                    <ul className="flex flex-wrap gap-1">
                                      {row.sources.map((source) => (
                                        <li key={`${field}-c-${index}-${source.url}`}>
                                          <SourceTag source={source} />
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                )}
                {notes !== "" && (
                  <Card className="text-sm py-2">
                    <p className="font-medium px-2.5">Notes</p>
                    <p className="mt-0.5 break-words text-muted-foreground px-2.5">{notes}</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
