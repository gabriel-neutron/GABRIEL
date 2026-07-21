import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { createCitationClaim } from "@/core/provenance/claim"

/**
 * PRD's OOB Linkage Flow, step 4: on an analyst-accepted OOB proposal, write the
 * channel URL onto the matched entity as a citation. Mirrors
 * `useEntityInspector.ts`'s `handleAddSource` exactly (the same Source+Claim pattern
 * used by the existing "add source" UI) — a `Source` alone is orphaned; it only becomes
 * visible on the entity once a `Claim` links them (see that hook's comment).
 *
 * Deliberately does NOT call `saveGeoPackage` itself — only `EditPage`'s
 * `useProjectIO` may do that (I/O gating, CLAUDE.md). This only updates
 * `useProvenanceStore`/`useProjectStore`, which `useProjectIO.handleSave` already picks
 * up automatically on the next explicit Save (confirmed via `selectPersistableSnapshot`
 * reading `useProvenanceStore.getState().sources` and `ProjectState.claims`) — the
 * analyst still has to click Save, same as any other manual edit in the app.
 */
export function appendTelegramSourceToEntity(entityId: string, channelUrl: string): void {
  const merged = useProvenanceStore.getState().mergeUrls([channelUrl])
  const source = merged.find((s) => s.url === channelUrl)
  if (!source) return
  useProjectStore.getState().addClaims([createCitationClaim(entityId, source.id)])
}
