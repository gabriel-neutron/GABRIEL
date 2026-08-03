import { vi } from "vitest"
import type { GeoPackageLoadResult } from "@/core/persistence/geopackage"
import { loadProject, saveProject } from "@/services/projectStorage.service"
import { useProjectStore } from "@/store/useProjectStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { useSourceCacheStore } from "@/store/useSourceCacheStore"
import { useOsmViewStore } from "@/store/useOsmViewStore"
import { useSelectionStore } from "@/store/useSelectionStore"
import { useEntityVisibilityStore } from "@/modules/orbat/store/useEntityVisibilityStore"
import type { ProjectIOUi, SnapshotAuthority } from "./projectIO"

/**
 * Shared by the two snapshot-authority test files, which split the flag's lifecycle by concern:
 * `projectIO.authority.test.ts` covers the paths with no analyst-chosen file (session restore and
 * New Project), `projectIO.openSave.test.ts` covers the chosen-file paths and the save they
 * authorise. Following the repo's existing `schema.fixtures.ts` pattern.
 *
 * No template literals anywhere in these files (Trap T7: template literals have twice written NUL
 * bytes into this repo). Plain concatenated string literals only.
 */

export function makeAuthority(initial: boolean): SnapshotAuthority {
  return { current: initial }
}

/** A load result whose entity is identifiable in the store, so "the store was filled" is provable. */
export function makeLoadResult(): GeoPackageLoadResult {
  return {
    layers: [{ id: "custom-loaded", name: "Loaded Ops", visible: true, kind: "custom" }],
    entities: [
      { kind: "unit", id: "loaded-entity", name: "Loaded Battalion", layerId: "custom-loaded", parentId: null },
    ],
    geometries: [],
    sourceCache: new Map([["https://example.org/loaded", "loaded snippet"]]),
    sources: [],
    claims: [],
    ratingEvents: [],
    // This fixture carries no edges: its single entity has no parent, so there is nothing for
    // the hierarchy to record and nothing for the loader to have found wrong with it.
    relationships: [],
    integrityEvents: [],
  }
}

/** A non-empty persisted project sitting in IndexedDB — the thing the flag exists to protect. */
export const PERSISTED_BYTES = new Uint8Array([11, 22, 33, 44, 55])

export async function seedPersistedProject(): Promise<void> {
  await saveProject(Uint8Array.from(PERSISTED_BYTES).buffer)
}

export async function persistedBytes(): Promise<number[] | null> {
  const stored = await loadProject()
  return stored == null ? null : Array.from(new Uint8Array(stored.buffer))
}

export function makeUi(): ProjectIOUi & { isMounted: () => boolean } {
  return {
    setBusy: vi.fn(),
    setError: vi.fn(),
    setRestoredFromSession: vi.fn(),
    isMounted: vi.fn(() => true),
  }
}

/**
 * The stores are module singletons: leaving them dirty would make another test file's result
 * depend on test-file ordering.
 */
export function resetStores(): void {
  useProjectStore.getState().resetProject()
  useSourceCacheStore.getState().resetSourceCache()
  useProvenanceStore.getState().resetSources()
  useOsmViewStore.getState().resetOsmView()
  useSelectionStore.getState().setSelectedRef(null)
  useEntityVisibilityStore.getState().reset()
}
