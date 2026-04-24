import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { MapEntity } from "@/types/domain.types"
import type { EnrichmentContext } from "@/types/enrichment.types"
import { ProposalCard } from "./ProposalCard"

type EnrichDrawerProps = {
  open: boolean
  entity: MapEntity | null
  context: EnrichmentContext | null
  prompt: string
  status: "idle" | "running" | "success" | "partial" | "failed"
  queryTrace: string[]
  depthUsed: number
  unresolvedFields: string[]
  notes: string
  proposals: Array<{
    field: string
    currentValue: unknown
    proposedValue: unknown
    sources: Array<{
      url: string
      title: string
      snippet: string
      domainType: "wikipedia" | "official" | "osint" | "social" | "forum" | "news" | "web"
    }>
    reasoning: string
  }>
  decisions: Record<string, "accepted" | "rejected" | "pending">
  errorMessage: string | null
  closeNotice: string | null
  onClose: () => void
  onPromptChange: (value: string) => void
  onRun: () => void
  onAccept: (field: string) => void
  onReject: (field: string) => void
  onIgnore: (field: string) => void
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


export function EnrichDrawer({
  open,
  entity,
  context,
  prompt,
  status,
  queryTrace,
  depthUsed,
  unresolvedFields,
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
  useEffect(() => {
    if (!open) return
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [onClose, open])

  if (!open || !entity) return null

  const visibleProposals = proposals.filter(
    (proposal) => (decisions[proposal.field] ?? "pending") === "pending",
  )
  const hasProposals = visibleProposals.length > 0

  return (
    <div className="fixed inset-0 z-[11000] bg-black/50 backdrop-blur-sm">
      <div className="flex h-full items-end sm:items-center sm:justify-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="enrich-dialog-title"
          aria-describedby="enrich-dialog-status"
          className="flex h-[100dvh] w-full flex-col overflow-hidden border bg-card shadow-2xl sm:h-[92vh] sm:max-w-6xl sm:rounded-xl"
        >
          <div className="sticky top-0 z-20 shrink-0 border-b bg-card/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 id="enrich-dialog-title" className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  Enrich: {entity.name}
                </h3>
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
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2 sm:p-2.5">
            <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="min-h-0 space-y-2 overflow-y-auto pr-1">
                <Card className="p-2.5">
                  <div className="space-y-1 text-sm">
                    <div className="rounded-md border bg-muted/30 px-2 py-1 font-medium">
                      Entity: {entity.name}
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1 font-medium">
                      Parent: {context?.parent?.name ?? "None"}
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1 font-medium">
                      Children: {renderChildren(context)}
                    </div>
                    <div className="rounded-md border bg-muted/30 px-2 py-1 font-medium">
                      Last analyzed: {formatAnalyzedAt(entity.analyzedAt)}
                    </div>
                  </div>
                </Card>

                <Card className="p-2.5">
                  <div>
                    <label htmlFor="enrichment-prompt" className="text-sm font-medium">
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
                  <Card className="space-y-2 p-2.5">
                    {status === "running" && (
                      <p className="text-sm font-medium text-muted-foreground">
                        Processing hop {depthUsed || 1} in auto-depth mode
                      </p>
                    )}
                    {queryTrace.length > 0 && (
                      <div className="rounded-md border bg-muted/30 p-2.5 text-xs">
                        <p className="font-medium">Query trace</p>
                        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                          {queryTrace.map((query, index) => (
                            <li key={`${query}-${index}`} className="break-words">
                              {query}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {errorMessage && <p className="text-xs text-muted-foreground">Error details shown in header.</p>}
                  </Card>
                )}
              </div>

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
                    <p className="text-sm font-medium">
                      {status === "running" ? "Enrichment is running..." : "No proposals"}
                    </p>
                  </Card>
                )}

                {unresolvedFields.length > 0 && (
                  <Card className="text-sm">
                    <p className="font-medium px-2.5">Unresolved fields</p>
                    <p className="mt-0.5 break-words text-muted-foreground px-2.5">{unresolvedFields.join(", ")}</p>
                  </Card>
                )}
                {notes !== "" && (
                  <Card className="text-sm">
                    <p className="font-medium px-2.5">Notes</p>
                    <p className="mt-0.5 break-words text-muted-foreground px-2.5">{notes}</p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

