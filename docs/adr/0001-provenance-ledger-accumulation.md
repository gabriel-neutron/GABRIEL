# Provenance Ledger auto-accumulates from accepted proposals

`MapEntity.sources` is a provenance ledger — citations backing accepted claims — not a free-standing enrichable field. When any Enrichment Proposal is accepted, the top-2 Research Citations (ranked by Authority Weight: official > OSINT > news > social > forum > web) are merged into the ledger automatically. The pipeline may also propose ledger entries independently, but only for entities whose ledger is currently empty, to retroactively prove pre-filled data.

## Considered options

Keeping `sources` as a directly-proposed field (AI suggests a URL blob, analyst accepts/rejects the whole thing) was rejected because it decouples citations from the claims they back. An analyst accepting a `notes` proposal has no way to see which URLs justified it, and the AI ends up proposing generic "interesting sources" unrelated to any specific claim.

## Consequences

- `sources` stays in `CORE_ENRICHMENT_FIELDS` but the synthesis model is only asked to propose it when the existing ledger is empty.
- On proposal acceptance, the service layer must resolve the top-2 citations and merge them — deduplicating against existing ledger entries.
- `EnrichmentProposal.sources` (Research Citations) must be renamed to `EnrichmentProposal.citations` in code to remove the naming collision with `MapEntity.sources`.
