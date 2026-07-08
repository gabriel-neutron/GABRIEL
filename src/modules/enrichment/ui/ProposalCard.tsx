import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { EnrichmentProposal } from "@/types/enrichment.types"
import { formatValue } from "./formatValue"
import { SourceTag } from "./SourceTag"

type ProposalCardProps = {
  proposal: EnrichmentProposal
  decision: "accepted" | "rejected" | "pending"
  onAccept: () => void
  onReject: () => void
}

type ValueBlockProps = {
  label: string
  value: unknown
  tone: "current" | "proposed"
  actionLabel: string
  onAction: () => void
  disabled: boolean
}

function ValueBlock({ label, value, tone, actionLabel, onAction, disabled }: ValueBlockProps) {
  const isCurrent = tone === "current"
  const containerClass = isCurrent
    ? "flex h-full flex-col rounded-md border border-destructive/30 bg-destructive/10 p-2.5"
    : "flex h-full flex-col rounded-md border border-primary/30 bg-primary/10 p-2.5"

  return (
    <section className={containerClass}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 min-h-12 break-words whitespace-pre-wrap text-base font-medium leading-6 text-foreground">
        {formatValue(value)}
      </p>
      <Button
        type="button"
        size="sm"
        variant={isCurrent ? "destructive" : "secondary"}
        onClick={onAction}
        disabled={disabled}
        className="mt-auto h-8 w-full"
      >
        {actionLabel}
      </Button>
    </section>
  )
}

export function ProposalCard({
  proposal,
  decision,
  onAccept,
  onReject,
}: ProposalCardProps) {
  const accepted = decision === "accepted"
  const rejected = decision === "rejected"

  return (
    <Card className="space-y-3 p-3">
      <h4 className="text-base font-semibold leading-none text-foreground">{proposal.field}</h4>

      <div className="grid gap-2 sm:grid-cols-2">
        <ValueBlock
          label="Current"
          value={proposal.currentValue}
          tone="current"
          actionLabel="Reject"
          onAction={onReject}
          disabled={rejected}
        />
        <ValueBlock
          label="Proposed"
          value={proposal.proposedValue}
          tone="proposed"
          actionLabel="Accept"
          onAction={onAccept}
          disabled={accepted}
        />
      </div>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reasoning</p>
        <p className="break-words text-sm leading-6 text-foreground">{proposal.reasoning}</p>
      </section>
      {proposal.citations.length > 0 && (
        <section className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
          <ul className="space-y-1">
            {proposal.citations.map((source) => (
              <li key={`${proposal.field}-${source.url}`}>
                <SourceTag source={source} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Card>
  )
}

