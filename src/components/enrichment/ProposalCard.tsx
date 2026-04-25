import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import type { EnrichmentProposal } from "@/types/enrichment.types"
import { SourceTag } from "./SourceTag"

type ProposalCardProps = {
  proposal: EnrichmentProposal
  decision: "accepted" | "rejected" | "pending"
  onAccept: () => void
  onReject: () => void
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "(empty)"
  if (Array.isArray(value)) return value.join(", ")
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
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

  return (
    <section
      className={
        isCurrent
          ? "flex h-full flex-col rounded-md border border-destructive/30 bg-destructive/10 p-2.5"
          : "flex h-full flex-col rounded-md border border-primary/30 bg-primary/10 p-2.5"
      }
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 min-h-12 break-words whitespace-pre-wrap text-base font-medium leading-6 text-foreground">
        {renderValue(value)}
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

function ProposalReasoning({ text }: { text: string }) {
  return (
    <section className="space-y-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reasoning</p>
      <p className="break-words text-sm leading-6 text-foreground">{text}</p>
    </section>
  )
}

function ProposalSources({ proposal }: { proposal: EnrichmentProposal }) {
  return (
    <section className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sources</p>
      <ul className="space-y-1">
        {proposal.sources.map((source) => (
          <li key={`${proposal.field}-${source.url}`}>
            <SourceTag source={source} />
          </li>
        ))}
      </ul>
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
    <Card className="p-3">
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

      <ProposalReasoning text={proposal.reasoning} />
      {proposal.sources.length > 0 && <ProposalSources proposal={proposal} />}
    </Card>
  )
}

