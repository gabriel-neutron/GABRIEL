import {
  getDefaultEchelonLayers,
  projectStateFromLoadResult,
  type GpkgLayer,
  type GeoPackageLoadResult,
} from "@/core/persistence/geopackage"
import { applyDeterministicRatingPipeline } from "@/core/provenance/ratingPipeline"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { performProjectSave, type ProjectSaveDeps, type ProjectSaveInput } from "./projectSave"
import { useProjectStore, selectPersistableSnapshot } from "@/store/useProjectStore"
import { useSourceCacheStore } from "@/store/useSourceCacheStore"
import { useOsmViewStore } from "@/store/useOsmViewStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { useSelectionStore } from "@/store/useSelectionStore"
import { useEntityVisibilityStore } from "@/modules/orbat/store/useEntityVisibilityStore"

/**
 * The bodies of useProjectIO's four handlers, with every React binding replaced by a parameter.
 *
 * They live here and not under services/ or core/ because they are still EditPage's private I/O
 * seam (CONSTRAINTS.md): moving them out of hooks/ would breach the page-boundary rule they exist
 * inside. What they stop being is *React*, which is the whole point — the snapshot-authority flag
 * was untestable only because it was welded to a useRef and three useCallbacks.
 */

/**
 * The `useRef` the hook owns, seen through the only shape these functions need: something with a
 * mutable `current`. A plain object satisfies it, so a test can read the flag after each step
 * instead of inferring it from what a save did or did not refuse.
 */
export interface SnapshotAuthority {
  current: boolean
}

/** The save deps plus what only the load and reset paths need. One clump, stated once. */
export interface ProjectIODeps extends ProjectSaveDeps {
  clearProject: () => Promise<void>
  loadGeoPackage: (buffer: ArrayBuffer) => Promise<GeoPackageLoadResult>
  loadSeedGeoPackageBuffer: () => Promise<ArrayBuffer | null>
  resetProject: () => void
  notify: (message: string) => void
}

/** Exactly what performNewProject touches — it never opens a file and never writes the cache. */
export type NewProjectDeps = Pick<
  ProjectIODeps,
  | "loadProject"
  | "loadSeedGeoPackageBuffer"
  | "clearProject"
  | "saveGeoPackage"
  | "writeGeoPackageToFile"
  | "resetProject"
  | "notify"
>

/** The three `useState` setters, seen as plain callbacks. */
export interface ProjectIOUi {
  setBusy: (value: boolean) => void
  setError: (message: string | null) => void
  setRestoredFromSession: (value: boolean) => void
}

export async function writeGeoPackageToFile(bytes: Uint8Array): Promise<void> {
  const showSave = (
    window as Window & { showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle> }
  ).showSaveFilePicker
  if (typeof showSave !== "function")
    throw new Error("This browser does not support the File System Access API.")
  const handle = await showSave.call(window, {
    suggestedName: "project.gpkg",
    types: [{ description: "GeoPackage", accept: { "application/octet-stream": [".gpkg"] } }],
  })
  const writable = await handle.createWritable()
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  await writable.write(new Uint8Array(buffer))
  await writable.close()
}

export async function loadSeedGeoPackageBuffer(): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch("/project.gpkg", { cache: "no-store" })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    return buffer.byteLength > 0 ? buffer : null
  } catch {
    return null
  }
}

/**
 * `isMounted` stands in for the effect's `mounted` closure variable. Every check it guards was a
 * check on that variable, at the same point in the sequence.
 */
export async function performSessionRestore(
  authority: SnapshotAuthority,
  deps: Pick<ProjectIODeps, "loadProject" | "loadGeoPackage">,
  ui: Pick<ProjectIOUi, "setError" | "setRestoredFromSession"> & { isMounted: () => boolean },
): Promise<void> {
  try {
    const stored = await deps.loadProject()
    if (!stored || !ui.isMounted()) return
    const result = await deps.loadGeoPackage(stored.buffer)
    if (!ui.isMounted()) return
    useProjectStore.getState().setProject(projectStateFromLoadResult(result))
    useSourceCacheStore.getState().setSourceCache(result.sourceCache)
    const rated = applyDeterministicRatingPipeline(result.sources, result.claims, result.ratingEvents)
    useProvenanceStore.getState().setSources(rated.sources)
    useProvenanceStore.getState().setRatingEvents(rated.events)
    authority.current = true
    ui.setRestoredFromSession(true)
  } catch (e) {
    if (!ui.isMounted()) return
    ui.setError(e instanceof Error ? e.message : "Failed to restore previous session")
    console.error("restoreSession failed", e)
  }
}

export async function performNewProject(
  authority: SnapshotAuthority,
  deps: NewProjectDeps,
  ui: ProjectIOUi,
): Promise<void> {
  const previousProject = await deps.loadProject().catch(() => null)
  const seedBuffer =
    previousProject?.buffer != null && previousProject.buffer.byteLength > 0
      ? previousProject.buffer
      : await deps.loadSeedGeoPackageBuffer()
  // Lowered before the stores are emptied, not after: an earlier restore or save may have left it
  // true, and an empty screen does not stand for the project still sitting in IndexedDB.
  authority.current = false
  deps.resetProject()
  useSourceCacheStore.getState().resetSourceCache()
  useProvenanceStore.getState().resetSources()
  useOsmViewStore.getState().resetOsmView()
  useSelectionStore.getState().setSelectedRef(null)
  useEntityVisibilityStore.getState().reset()
  ui.setError(null)
  ui.setRestoredFromSession(false)
  try {
    await deps.clearProject()
    // Raised only once the clear succeeded, and with no load having happened at all: New Project
    // deliberately makes an empty project the thing on screen, which is why this flag is not
    // called loadSucceeded. A failed clear leaves it false, so the real project survives.
    authority.current = true
  } catch (e) {
    ui.setError(e instanceof Error ? e.message : "Failed to clear persisted session")
    console.error("clearProject failed", e)
  }
  ui.setBusy(true)
  try {
    const defaultLayers = getDefaultEchelonLayers()
    const industryLayer: GpkgLayer = { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" }
    const gpkgLayers: GpkgLayer[] = [
      ...defaultLayers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, kind: l.kind })),
      industryLayer,
    ]
    const bytes = await deps.saveGeoPackage({
      layers: gpkgLayers,
      entities: [],
      geometries: [],
      researchSources: undefined,
      baseBuffer: seedBuffer ?? undefined,
      sources: undefined,
      claims: undefined,
      ratingEvents: undefined,
      // `[]`, not `undefined`: a new project deliberately has no edges and no integrity findings,
      // and the seed file's own rows must not survive into it. The other fields stay `undefined`
      // because for them absence still means something else (no base file, no cache).
      relationships: [],
      integrityEvents: [],
    })
    await deps.writeGeoPackageToFile(bytes)
    deps.notify("New project created.")
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return
    ui.setError(e instanceof Error ? e.message : "Failed to create project")
    console.error("handleNew failed", e)
  } finally {
    ui.setBusy(false)
  }
}

export async function performOpenProject(
  file: File,
  authority: SnapshotAuthority,
  deps: Pick<ProjectIODeps, "loadGeoPackage" | "saveProject">,
  ui: Pick<ProjectIOUi, "setBusy" | "setError">,
): Promise<void> {
  ui.setBusy(true)
  ui.setError(null)
  try {
    const buffer = await file.arrayBuffer()
    const result = await deps.loadGeoPackage(buffer)
    // Lowered here and not at the top: a throw in the two awaits above leaves the store holding
    // whatever it already held, which may legitimately still be authoritative.
    authority.current = false
    useProjectStore.getState().setProject(projectStateFromLoadResult(result))
    useSourceCacheStore.getState().setSourceCache(result.sourceCache)
    const rated = applyDeterministicRatingPipeline(result.sources, result.claims, result.ratingEvents)
    useProvenanceStore.getState().setSources(rated.sources)
    useProvenanceStore.getState().setRatingEvents(rated.events)
    // Not gated on the saveProject below: the analyst chose this file, so the snapshot stands for
    // what they want saved even if the cache write fails.
    authority.current = true
    useOsmViewStore.getState().resetOsmView()
    useSelectionStore.getState().setSelectedRef(null)
    useEntityVisibilityStore.getState().reset()
    await deps.saveProject(buffer)
  } catch (e) {
    ui.setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
    console.error("handleOpen failed", e)
  } finally {
    ui.setBusy(false)
  }
}

export async function performSaveProject(
  authority: SnapshotAuthority,
  deps: ProjectSaveDeps & Pick<ProjectIODeps, "notify">,
  ui: Pick<ProjectIOUi, "setBusy" | "setError">,
): Promise<void> {
  // The store calls it sourceCache, persistence calls it researchSources; renamed on the way in so
  // performProjectSave forwards it under one name (P3).
  const {
    layers, entities, geometries, sourceCache: researchSources,
    sources, claims, ratingEvents, relationships, integrityEvents,
  } = selectPersistableSnapshot(
    useProjectStore.getState(),
    useSourceCacheStore.getState().sourceCache,
    useProvenanceStore.getState().sources,
    useProvenanceStore.getState().ratingEvents,
  )
  ui.setBusy(true)
  ui.setError(null)
  try {
    // The literal below is left byte-for-byte as Slice 2A wrote it: it carries the read of the
    // authority flag that the save guard turns on, and where that read sits was paid for in 2A.
    // Slice 2B's two collections are therefore merged onto it rather than folded into it, so the
    // read cannot drift. The ProjectSaveInput annotation keeps a forgotten member a compile error.
    const input: ProjectSaveInput = Object.assign(
      { layers, entities, geometries, researchSources, sources, claims, ratingEvents, snapshotIsAuthoritative: authority.current },
      { relationships, integrityEvents },
    )
    await performProjectSave(input, deps)
    // A save the analyst authorised and which landed is what makes the snapshot stand for the
    // persisted project; without this, Save 2 is refused over what Save 1 itself wrote.
    authority.current = true
    deps.notify("Saved successfully")
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return
    ui.setError(e instanceof Error ? e.message : "Save failed")
    console.error("handleSave failed", e)
  } finally {
    ui.setBusy(false)
  }
}
