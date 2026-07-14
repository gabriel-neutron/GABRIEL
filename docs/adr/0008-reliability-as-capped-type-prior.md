# Source Reliability is a capped, deterministic type-prior — not a track-record posterior

Gabriel assigns ADMIRALTY (STANAG 2511) source reliability `A`–`F` **deterministically from source character** (domain type, official-ness, OSINT-org reputation), with **no AI call**, computed on load and backfilled only where `reliability IS NULL`. The type-prior is **capped at `C`** and defaults to `F` ("reliability cannot be judged") for unknown / social / forum / web sources. `A` and `B` are reachable only by a human override or the future actor-level posterior (v2). A separate **interested-party flag** marks sources that are a party to what they report (state media, a belligerent MoD); it lowers the prior and disqualifies the source as an independent corroborating origin.

## Why

STANAG reliability is doctrinally a **posterior earned by observed track record**: `A`–`C` all presume the collecting agency has seen the source report validly before. A browser-only tool has no such history for a freshly-retrieved URL, so a table that printed `A`/`B` from source *type* would be assigning a value the scale reserves for a measurement we never took — a category error, not a mild deviation. Doctrine's honest rating for an untracked source is `F`.

Two failure modes a naive `domainType → letter` table produces, surfaced in expert review:

- **Authority laundering.** `official → B` treats a belligerent MoD press release as broadly reliable, when it is *authoritative on provenance and interested on content* — reliable that "the ministry said X," unreliable that "X is true," on the same topic. The interested-party flag, not a high letter, is the correct encoding.
- **Burying the primary witness.** `social → E` ranks a named milblogger who geolocated a strike *below* a state wire (`news → C/D`) — inverted from reality. Mapping unknown/social sources to `F` (neutral abstention) rather than `E` ("unreliable") lets a strong per-claim credibility surface a good low-type source instead of pre-condemning it.

Keeping reliability deterministic also makes backfill of every existing source instant and free, and spends the AI budget only on the credibility axis, which actually needs reasoning.

## Considered options

- **AI-nuanced reliability per named source.** Rejected for v1: spends tokens on the *less* discriminating axis and re-introduces the subjectivity the table avoids. Deferred to the v2 actor posterior.
- **Blanket `domainType → letter` including `A`/`B`.** Rejected: doctrinally invalid (above) and it anchors both the model and the analyst exactly where deception is most likely.
- **Leave every AI-assessed fresh source at `F`.** Doctrinally purest, but discards the genuine, cheap signal that source *character* carries. The capped `C..F` prior is the least-wrong compromise, provided it is UI-flagged as provisional.

## Consequences

- Reliability from type never exceeds `C`; `F` is a neutral "cannot be judged," never styled or sorted as failure. The UI must label the letter **"type-based / provisional,"** visually distinct from a human-assessed rating.
- The interested-party flag is seeded by a small curated list (comparable in weight to the existing `domainType` classifier), not a maintained affiliation platform.
- The prior is stored with a **mapping version**; a deliberate re-tune is an explicit action, and re-running the table never silently re-rates existing files (null-fill only).
- The doctrinally-correct evolution — a reliability **posterior** from a source actor's confirmed/refuted history — is deferred to v2, where it requires an `Actor` (URL → channel/author) abstraction. Until then, reliability is explicitly a prior.
- Relationship to [Authority Weight](../../CONTEXT.md): Authority Weight is the seed of this prior, not a second rating axis.
