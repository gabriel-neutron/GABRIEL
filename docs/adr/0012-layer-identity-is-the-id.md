# Layer identity is the id, and a layer that reached disk is never deleted by a decode miss

Two rules, decided together on 2026-07-31 because one function answers both and answered the second one by accident.

1. **For `echelon` layers the built-in vocabulary is authoritative.** `applyGeoPackageResult` rebuilds them from `getDefaultEchelonLayers()`, taking only `visible` from the loaded file. The file's `name` is discarded, deliberately. `useProjectStore.renameLayer` gains a matching `kind === "echelon"` guard so the store cannot produce a value the persistence layer silently discards.
2. **No layer a project file carries is dropped on load.** Anything `applyGeoPackageResult` does not recognise — an unknown or NULL `kind`, an `osm` layer whose payload is gone, an `organisation` layer that is not Industry — is **rehabilitated as `custom`**, keeping its id, name and visibility. No layer is silently deleted, and no integrity event is minted, because there is no longer a loss to record.

## Why

**The id is the key; the name is a rendering of the key.** An echelon layer's id *is* the echelon vocabulary value: `ECHELON_OPTIONS` (`symbol.types.ts:11-26`) has `value === label` for all fourteen entries, `useEntityInspector.ts:181` writes `patch.layerId = v` where `v` is the echelon value, and `entityLayer.ts:3` hardcodes `FALLBACK_ECHELON_LAYER_ID = "Team/Crew"`. The id is load-bearing across the application. The name is read by exactly one place — the row label at `LayersPanel.tsx:204`.

**Preserving the file's name costs one property and buys a state no code path can produce.** `LayersPanel.tsx:204` renders `layer.name`; `EntityInspector.tsx:411` renders the `ECHELON_OPTIONS` label. Preserve the name and the layers panel can read "Divisions blindées" while the echelon dropdown reads "Division", for the same row, with nothing validating the divergence. Widening the reachable state space to serve a UI path that does not exist is the wrong trade. Renaming an echelon layer is already unreachable in-app: `LayersPanel.tsx:127` sets `canRename` only for `custom`, and the menu says so in words.

**The dangerous state was never "no rename" — it was a rename that works until reload.** The store's `renameLayer` had no `kind` check while its neighbour `removeLayer` did, so the guard lived in the UI alone. A second call site, or a future slice, would have produced a rename that persists in memory, survives one save, and reverts on the next load. Guarding **`echelon` only** makes the guarded set exactly equal the set `applyGeoPackageResult` discards; Industry's name *does* round-trip (`applyResult.ts:40`), so guarding `organisation` too would state a rule the persistence layer does not follow.

**The second rule is a different question, and the loss it prevents is not confined to a layer.** `decodeLayerKind` (`validation.ts:81-85`) returns `undefined` for any value outside `{echelon, custom, osm, organisation}` — **NULL included**, which is what a legacy file or a GeoPackage authored by another tool carries. `applyGeoPackageResult` then dropped the layer entirely. But `selectPersistableSnapshot` builds `nonOsmLayerIds` from `state.layers` (`useProjectStore.ts:123`) and filters entities by *membership* in that set (`:125`) rather than by an OSM test — so a dropped layer takes its entities with it, and with them their geometries (`:131`) and their claims (`:135`, via `survivingEntityIds`). The layer, its entities, their drawn geometry and their provenance were all deleted at the next save, silently, on a file that is not corrupt. That is the strongest argument in this ADR and it was invisible to every count-based assertion, because the checked-in project happens to carry only recognised kinds.

**Rehabilitating is right where recording would be wrong.** An `integrity_events` row would faithfully record a deletion that need not happen at all. Integrity events are for losses that cannot be avoided; this one costs three lines to avoid. Emitting one here would also force `ApplyGeoPackageResultState` to grow an `integrityEvents` member and `load.ts` to merge two event streams — a seam change landing in the same commit as the hierarchy migration, which is exactly the coupling Slice 2B is sequenced to avoid.

## Considered options

- **Preserve the echelon layer's name from the file.** Rejected: it serves an unreachable UI path and desynchronises the layer label from the echelon label the inspector shows for the same row.
- **Make renaming echelon layers a feature** — the real use case is doctrine-specific labels (`Okrug`, `OMSBr`) instead of the NATO ladder. Rejected *for now, not forever*: that is a vocabulary question, and its honest form is a second label field on `ECHELON_OPTIONS` shown everywhere, not a per-file layer name that one panel reads and the inspector ignores.
- **Mint an integrity event for each dropped layer.** Rejected: it records an avoidable deletion and buys a seam change in the migration slice.
- **Refuse to open a file carrying an unrecognised layer kind.** Rejected: refusing to open the analyst's only project is a worse day than opening it imperfectly, and there is no second tool. The load path already reserves throwing for genuinely broken structure.
- **Keep the `osm`-with-null-payload branch dropping, and rehabilitate only unknown kinds.** Rejected in favour of one rule: a layer that reached disk should not be deletable by a decode miss, whatever missed. The demotion is stated below.
- **Guard `renameLayer` in the UI only** — the status quo. Rejected: it is why a store action can currently produce a value the persistence layer throws away without telling anyone.

## Consequences

- **A round trip through a foreign tool stops losing data.** A `.gpkg` written or edited by QGIS, with a NULL `kind` column, opens with its layers, entities, geometries and claims intact.
- **`custom` becomes the residual kind**, and `custom` is the one kind that is renameable and deletable. A rehabilitated layer is therefore one the analyst can see, rename and remove deliberately — which is the point of rehabilitating rather than quarantining under a reserved name.
- **An `osm` layer whose payload is gone returns as `custom` and loses `sourceQuery` and its OSM-ness.** That is a deliberate demotion: its entities are worth more than the record of the query that produced them. It also removes it from `selectPersistableSnapshot`'s OSM filter, so its entities now persist — which is the intended change, not a side effect.
- **The store and the persistence layer now state the same rule in two places**, and a test pins each: `renameLayer` on an echelon layer is a no-op, and a load result whose echelon layer carries a foreign name comes back with the vocabulary label.
- **The fourth branch is closed by the same rule.** `applyResult.ts:38-41` also dropped any `organisation`-kind layer whose id is not `INDUSTRY_LAYER_ID`. Unreachable today, and no longer a latent loss.
- **This lands before the hierarchy migration, in its own commit.** It must be green before the first-ever write to `public/project.gpkg`, not alongside it.
