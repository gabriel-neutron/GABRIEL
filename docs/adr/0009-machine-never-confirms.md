# The AI may never assign credibility `1` ("Confirmed"); independence is measured by clusters, not URLs

In the AI-assisted credibility assessment, the model's output is **capped at `2`** ("corroboration found, not verified"). Credibility `1` ("Confirmed") — the STANAG state requiring corroboration by genuinely independent sources — is reserved for an explicit **human** act in the review workflow. Independence, where the pipeline reasons about it, is measured as distinct **corroboration clusters**: near-duplicate text and interested-party sources on the same side are collapsed to a single origin *before* counting, so wire syndication and echo-chamber reposting cannot manufacture false confirmation.

## Why

STANAG makes independence *definitional* for `1`, and the literature (Baker et al. 1968; Irwin & Mandel) shows it is the most-violated part in practice, with the standard itself offering no method. For an automated tool the danger is acute and specific: an LLM asked "are these independent?" over a list of URLs **rewards surface agreement**, and every real circular-reporting pattern presents as wide agreement —

- **Wire syndication:** one AP/Reuters dispatch on 200 domains — 200 URLs, one origin.
- **Cross-posting / coordinated amplification:** one video reposted by 40 channels; state-linked networks *engineer* many-voice consensus.
- **Citogenesis:** a claim enters Wikipedia uncited → a news article cites Wikipedia → Wikipedia cites the article.

Grouping citations by registrable domain — the cheap heuristic first proposed — counts every one of these as independent confirmation and would auto-promote exactly the material an adversary wants promoted. Because that class of error is catastrophic in a conflict/accountability context (laundering a fabricated unit position onto the map with an authoritative-looking badge), the safeguard cannot be a prompt we hope the model honors. A hard ceiling that the machine physically cannot output `1` removes the highest-harm failure mode at zero cost, and makes the human — with the cluster/date evidence in front of them — the only path to "Confirmed."

## Considered options

- **Let the AI assign `1` when it judges the sources independent.** Rejected: non-reproducible run-to-run, and structurally biased toward false confirmation (above).
- **A deterministic source-independence engine + maintained affiliation registry.** Rejected as disproportionate for a small, local-first tool. Independence is instead handled by cheap cluster collapse plus the human gate.
- **Domain-grouping as the independence measure.** Rejected: catches only the trivial same-domain case and gives false comfort on every syndication/echo pattern.

## Consequences

- Credibility caps enforced in code: single independent cluster → `≤2`; contradiction → `≤4` (`5` if positively contradicted); no basis → `6`. `6` is a first-class abstention output, never collapsed to a low number.
- The credibility pass runs as **one batched LLM call per entity** (all its citations side-by-side — required for the model to see and cluster corroboration), inside the existing enrichment run. Reliability is not in the prompt, so credibility stays blind to the reliability letter (resisting the "diagonal collapse" pathology) without a second pass.
- v1 corroboration signals fed to / computed for the pass: near-duplicate snippet clustering (MinHash over full bodies deferred to v1.5), interested-party collapse ([ADR 0008](0008-reliability-as-capped-type-prior.md)), publication/observation dates, and stated-attribution extraction (a bounded task the model is reliable at, unlike open-ended independence judgment).
- The stored evidence (clusters, dates, citations, query, model+prompt version) is the auditable record; the LLM's free-text rationale is persisted as **"model narrative (not verified),"** demoted below that evidence, never presented as the justification of record.
- The review queue is where a human can promote `2 → 1`; the "Confirm" affordance exists only there, and only when ≥2 distinct clusters with dates are present. Machine-tier vocabulary avoids "confirmed / verified / trusted."
