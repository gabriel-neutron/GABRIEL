# Acknowledging an integrity event is free text and no ceremony, because it asserts nothing about the world

Decided 2026-08-04, when the integrity ledger got its first reader.

An analyst may annotate an `integrity_events` row with **who read it, when, and an optional
note**. `acknowledgedBy` is free text. There is no eligibility gate, no evidence threshold, no
two-person rule, and no second act that "resolves" the event. The record it annotates is
unchanged by the annotation: not deleted, not downgraded, not closed.

This is deliberately **not** the ceremony [ADR 0009](0009-machine-never-confirms.md) puts around
credibility `1`, and the difference is not a matter of degree.

## Why

**The two acts make different kinds of claim.** Confirming a claim asserts something about the
world — that a unit was where a source says it was, corroborated by genuinely independent
origins. It is a statement a published dataset carries as fact, and ADR 0009 exists because a
machine making that statement launders unverified material into it. Acknowledging an integrity
event asserts something about a **reader**: that a person has seen a record Gabriel made about
its own processing. It adds no fact to the dataset. Nothing downstream reads it as evidence, no
credibility moves, and no entity changes position. Borrowing ADR 0009's gate here would import
a safeguard against a harm this act cannot cause.

**Ceremony where nothing is at stake teaches analysts to click through ceremony.** ADR 0009's
Confirm affordance is rare, expensive and gated on visible cluster/date evidence — that is what
makes it mean something when it is used. `hierarchy-migrated` fires once per legacy project and
is expected; the real project's ledger holds exactly one event and it is that one. Putting the
same gesture in front of both would either make the routine one obstructive or the load-bearing
one routine, and the second failure is the dangerous one.

**Gabriel has no identity system, and inventing one for this would be the tail wagging the dog.**
`integrityEvent.ts` already said this: git supplies the real attribution, and the project is
single-analyst and local-first. A two-person rule needs two identities the tool cannot
distinguish, so it would be theatre — a second free-text field, typed by the same person.

**What is NOT free is durability.** `decodeIntegrityEvent` drops any string that trims to empty,
so a blank acknowledger would hold for the session and silently vanish on reload, leaving the
panel showing the event as outstanding with nothing to say why. So the write refuses a blank
`by` or `at`, and stores a blank note as an **absent field** rather than an empty string. The
in-memory shape is exactly what disk can hold.

**An acknowledgement is not overwritable.** The three fields are single-valued, so a second
acknowledgement would replace the first attribution leaving no trace it existed — structurally
the same defect as `withActiveParent` deleting a subordination edge instead of end-dating it.
Acknowledging an already-acknowledged event is therefore a no-op.

## Considered options

- **Extend ADR 0009's ceremony to integrity events.** Rejected: it guards against laundering an
  unverified claim into the dataset, and an acknowledgement puts no claim into the dataset.
- **Render the ledger read-only and never write an acknowledgement.** Rejected: the schema and
  the GeoPackage table have carried `acknowledgedBy`/`At`/`Note` since the ledger existed with
  nothing to fill them, and `unacknowledgedIntegrityEvents` — the selector the export gate is
  meant to consult — cannot ever narrow if nothing can acknowledge. That is the same
  "a value nothing reads" shape this slice exists to close, one layer up.
- **Let a second acknowledgement replace the first.** Rejected: destroys attribution silently.
- **A ledger of acknowledgements, like `rating_events` for claims.** Not rejected on the merits —
  it is the right shape if acknowledging ever needs a history — but deferred as disproportionate
  for a single-analyst tool. The no-overwrite rule above is what keeps that door open: no
  acknowledgement is ever lost, so a future migration has a complete record to migrate.

## Consequences

- `acknowledgeIntegrityEvent` (`core/integrity/acknowledge.ts`) is the only writer, pure, with an
  injected clock. It signals a refusal by **returning the same array**, which is how the store
  action knows not to notify subscribers — the precedent is `confirmCredibility`.
- The `IntegrityPanel` shows the acknowledge affordance only when the panel is not read-only and
  the event is unread. `ViewPage` renders the ledger fully and can write nothing.
- The panel states in words that marking an event read does not resolve it. This is the same
  posture as [ADR 0011](0011-relationships-are-the-hierarchy.md)'s ruling that **showing a
  contest exists is not resolving it** — no UI resolves a contest, and this one does not either.
- **Unaffected:** the export gate. `unacknowledgedIntegrityEvents` still gates nothing, because
  no gated export exists yet. When one ships, it consults that selector — and this ADR is what
  makes the selector able to reach zero.
