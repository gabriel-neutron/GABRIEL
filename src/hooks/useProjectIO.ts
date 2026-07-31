import { useCallback, useEffect, useRef, useState } from "react"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
  type GpkgEntity,
  type GpkgGeometry,
  type GpkgSource,
  type GpkgClaim,
  type GpkgRatingEvent,
  type SaveGeoPackageOptions,
  type GeoPackageLoadResult,
  type ApplyGeoPackageResultState,
} from "@/core/persistence/geopackage"
import { applyDeterministicRatingPipeline } from "@/core/provenance/ratingPipeline"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { loadProject, saveProject, clearProject, type LoadedProject } from "@/services/projectStorage.service"
import { useProjectStore, selectPersistableSnapshot } from "@/store/useProjectStore"
import { useSourceCacheStore } from "@/store/useSourceCacheStore"
import { useOsmViewStore } from "@/store/useOsmViewStore"
import { useProvenanceStore } from "@/store/useProvenanceStore"
import { useSelectionStore } from "@/store/useSelectionStore"
import { useEntityVisibilityStore } from "@/modules/orbat/store/useEntityVisibilityStore"

async function writeGeoPackageToFile(bytes: Uint8Array): Promise<void> {
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

async function loadSeedGeoPackageBuffer(): Promise<ArrayBuffer | null> {
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
 * The one project state every load path hands to setProject. Named rather than inferred so that
 * "no sixth field" is a compile-time property: the literal below is excess-property-checked.
 */
export type ProjectStateFromLoadResult = ApplyGeoPackageResultState & { claims: GpkgClaim[] }

/**
 * claims comes from the load result, not from applyGeoPackageResult, which does not carry
 * provenance claims: taking them from there would silently drop every claim on load.
 */
export function projectStateFromLoadResult(result: GeoPackageLoadResult): ProjectStateFromLoadResult {
  const applied = applyGeoPackageResult(result, null)
  return {
    layers: applied.layers,
    entities: applied.entities,
    drawnGeometries: applied.drawnGeometries,
    claims: result.claims,
    selectedEntityId: applied.selectedEntityId,
  }
}

export interface ProjectSaveInput {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
  sourceCache: Map<string, string>
  sources: GpkgSource[]
  claims: GpkgClaim[]
  ratingEvents?: GpkgRatingEvent[]
  /**
   * Whether this session established that the in-memory snapshot stands for the persisted
   * project. Required, not optional, so a call site that forgets it is a compile error.
   */
  snapshotIsAuthoritative: boolean
}

export interface ProjectSaveDeps {
  loadProject: () => Promise<LoadedProject | null>
  saveGeoPackage: (options: SaveGeoPackageOptions) => Promise<Uint8Array>
  writeGeoPackageToFile: (bytes: Uint8Array) => Promise<void>
  saveProject: (buffer: ArrayBuffer) => Promise<void>
}

/**
 * Save ordering is load-bearing: the disk write must succeed before the IndexedDB
 * cache is overwritten, so a failed disk write leaves the session cache stale
 * rather than corrupted.
 */
export async function performProjectSave(input: ProjectSaveInput, deps: ProjectSaveDeps): Promise<void> {
  const existing = await deps.loadProject()
  // A save replaces rather than merges (save.ts deletes each table's rows, then rewrites them),
  // so saving a snapshot this session never tied to the persisted project destroys that project.
  // Emptiness cannot be the test instead: after a failed restore the store sits at initialState(),
  // indistinguishable from a deliberate New Project, and one typed entity would defeat it anyway.
  if (input.snapshotIsAuthoritative === false && existing != null && existing.buffer.byteLength > 0) {
    // Plain concatenated string literals, never a template literal (Trap T7: template literals
    // have twice written NUL bytes into this repo).
    throw new Error(
      "Refusing to overwrite your saved project: this session never loaded it, so saving now would replace it with what is on screen. " +
        "Nothing has been written. " +
        "Reload the page to load your project again, or use Open to pick the .gpkg file yourself. " +
        "Anything you typed into this session is not carried across by either route, so copy it out first.",
    )
  }
  const bytes = await deps.saveGeoPackage({
    layers: input.layers,
    entities: input.entities,
    geometries: input.geometries,
    researchSources: input.sourceCache,
    baseBuffer: existing?.buffer,
    sources: input.sources,
    claims: input.claims,
    ratingEvents: input.ratingEvents,
  })
  await deps.writeGeoPackageToFile(bytes)
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  await deps.saveProject(buffer)
}

export function useProjectIO() {
  const { resetProject } = useProjectStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoredFromSession, setRestoredFromSession] = useState(false)
  // Does the in-memory snapshot stand for the persisted project? The save guard refuses when it
  // does not. Two halves, and both are load-bearing: LOWERED the instant the snapshot stops
  // standing for the persisted project, and RAISED only once an operation has fully landed. Raising
  // early leaves a half-filled store armed, and the next save wipes the tables it never filled;
  // failing to lower leaves a stale true from an earlier operation, and an emptied store overwrites
  // the real project. A ref, not a module-level let, so the dependency-injected performProjectSave
  // stays testable; not a store field, so it cannot survive a reload that re-established nothing.
  const snapshotIsAuthoritativeRef = useRef<boolean>(false)

  useEffect(function restoreSession() {
    let mounted = true
    loadProject()
      .then((stored) => {
        if (!stored || !mounted) return
        return loadGeoPackage(stored.buffer).then((result) => {
          if (!mounted) return
          useProjectStore.getState().setProject(projectStateFromLoadResult(result))
          useSourceCacheStore.getState().setSourceCache(result.sourceCache)
          const rated = applyDeterministicRatingPipeline(result.sources, result.claims, result.ratingEvents)
          useProvenanceStore.getState().setSources(rated.sources)
          useProvenanceStore.getState().setRatingEvents(rated.events)
          snapshotIsAuthoritativeRef.current = true
          setRestoredFromSession(true)
        })
      })
      .catch((e) => {
        if (!mounted) return
        setError(e instanceof Error ? e.message : "Failed to restore previous session")
        console.error("restoreSession failed", e)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(
    function clearRestoredBanner() {
      if (!restoredFromSession) return
      const t = setTimeout(() => setRestoredFromSession(false), 4000)
      return () => clearTimeout(t)
    },
    [restoredFromSession],
  )

  const handleNew = useCallback(async (): Promise<void> => {
    const previousProject = await loadProject().catch(() => null)
    const seedBuffer =
      previousProject?.buffer != null && previousProject.buffer.byteLength > 0
        ? previousProject.buffer
        : await loadSeedGeoPackageBuffer()
    // Lowered before the stores are emptied, not after: an earlier restore or save may have left it
    // true, and an empty screen does not stand for the project still sitting in IndexedDB.
    snapshotIsAuthoritativeRef.current = false
    resetProject()
    useSourceCacheStore.getState().resetSourceCache()
    useProvenanceStore.getState().resetSources()
    useOsmViewStore.getState().resetOsmView()
    useSelectionStore.getState().setSelectedRef(null)
    useEntityVisibilityStore.getState().reset()
    setError(null)
    setRestoredFromSession(false)
    try {
      await clearProject()
      // Raised only once the clear succeeded, and with no load having happened at all: New Project
      // deliberately makes an empty project the thing on screen, which is why this flag is not
      // called loadSucceeded. A failed clear leaves it false, so the real project survives.
      snapshotIsAuthoritativeRef.current = true
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear persisted session")
      console.error("clearProject failed", e)
    }
    setBusy(true)
    try {
      const defaultLayers = getDefaultEchelonLayers()
      const industryLayer: GpkgLayer = { id: INDUSTRY_LAYER_ID, name: "Industry", visible: true, kind: "organisation" }
      const gpkgLayers: GpkgLayer[] = [
        ...defaultLayers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, kind: l.kind })),
        industryLayer,
      ]
      const bytes = await saveGeoPackage({
        layers: gpkgLayers,
        entities: [],
        geometries: [],
        researchSources: undefined,
        baseBuffer: seedBuffer ?? undefined,
        sources: undefined,
        claims: undefined,
        ratingEvents: undefined,
      })
      await writeGeoPackageToFile(bytes)
      window.alert("New project created.")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "Failed to create project")
      console.error("handleNew failed", e)
    } finally {
      setBusy(false)
    }
  }, [resetProject])

  const handleOpen = useCallback(async (file: File): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const result = await loadGeoPackage(buffer)
      // Lowered here and not at the top: a throw in the two awaits above leaves the store holding
      // whatever it already held, which may legitimately still be authoritative.
      snapshotIsAuthoritativeRef.current = false
      useProjectStore.getState().setProject(projectStateFromLoadResult(result))
      useSourceCacheStore.getState().setSourceCache(result.sourceCache)
      const rated = applyDeterministicRatingPipeline(result.sources, result.claims, result.ratingEvents)
      useProvenanceStore.getState().setSources(rated.sources)
      useProvenanceStore.getState().setRatingEvents(rated.events)
      // Not gated on the saveProject below: the analyst chose this file, so the snapshot stands for
      // what they want saved even if the cache write fails.
      snapshotIsAuthoritativeRef.current = true
      useOsmViewStore.getState().resetOsmView()
      useSelectionStore.getState().setSelectedRef(null)
      useEntityVisibilityStore.getState().reset()
      await saveProject(buffer)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
      console.error("handleOpen failed", e)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    const { layers, entities, geometries, sourceCache, sources, claims, ratingEvents } = selectPersistableSnapshot(
      useProjectStore.getState(),
      useSourceCacheStore.getState().sourceCache,
      useProvenanceStore.getState().sources,
      useProvenanceStore.getState().ratingEvents,
    )
    setBusy(true)
    setError(null)
    try {
      await performProjectSave(
        { layers, entities, geometries, sourceCache, sources, claims, ratingEvents, snapshotIsAuthoritative: snapshotIsAuthoritativeRef.current },
        { loadProject, saveGeoPackage, writeGeoPackageToFile, saveProject },
      )
      // A save the analyst authorised and which landed is what makes the snapshot stand for the
      // persisted project; without this, Save 2 is refused over what Save 1 itself wrote.
      snapshotIsAuthoritativeRef.current = true
      window.alert("Saved successfully")
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return
      setError(e instanceof Error ? e.message : "Save failed")
      console.error("handleSave failed", e)
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, restoredFromSession, handleNew, handleOpen, handleSave }
}
