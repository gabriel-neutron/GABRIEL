import { useCallback, useEffect, useState } from "react"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
  type GpkgEntity,
  type GpkgOrganisation,
  type GpkgGeometry,
} from "@/services/geopackage"
import { INDUSTRY_LAYER_ID } from "@/types/organisation.types"
import { loadProject, saveProject, clearProject, type LoadedProject } from "@/services/projectStorage.service"
import { useProjectStore, selectPersistableSnapshot } from "@/store/useProjectStore"

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

export interface ProjectSaveInput {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  organisations: GpkgOrganisation[]
  geometries: GpkgGeometry[]
  sourceCache: Map<string, string>
}

export interface ProjectSaveDeps {
  loadProject: () => Promise<LoadedProject | null>
  saveGeoPackage: (
    layers: GpkgLayer[],
    entities: GpkgEntity[],
    organisations: GpkgOrganisation[],
    geometries: GpkgGeometry[],
    researchSources: Map<string, string> | undefined,
    baseBuffer: ArrayBuffer | undefined,
  ) => Promise<Uint8Array>
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
  const bytes = await deps.saveGeoPackage(
    input.layers,
    input.entities,
    input.organisations,
    input.geometries,
    input.sourceCache,
    existing?.buffer,
  )
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

  useEffect(function restoreSession() {
    let mounted = true
    loadProject()
      .then((stored) => {
        if (!stored || !mounted) return
        return loadGeoPackage(stored.buffer).then((result) => {
          if (!mounted) return
          const next = applyGeoPackageResult(result, null)
          useProjectStore.getState().setProject({
            layers: next.layers,
            entities: next.entities,
            organisations: next.organisations,
            drawnGeometries: next.drawnGeometries,
            selectedEntityId: next.selectedEntityId,
            selectedOrganisationId: next.selectedOrganisationId,
            sourceCache: result.sourceCache,
          })
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
    resetProject()
    setError(null)
    setRestoredFromSession(false)
    try {
      await clearProject()
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
      const bytes = await saveGeoPackage(gpkgLayers, [], [], [], undefined, seedBuffer ?? undefined)
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
      const next = applyGeoPackageResult(result, null)
      useProjectStore.getState().setProject({
        layers: next.layers,
        entities: next.entities,
        organisations: next.organisations,
        drawnGeometries: next.drawnGeometries,
        selectedEntityId: next.selectedEntityId,
        selectedOrganisationId: next.selectedOrganisationId,
        sourceCache: result.sourceCache,
      })
      await saveProject(buffer)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load GeoPackage")
      console.error("handleOpen failed", e)
    } finally {
      setBusy(false)
    }
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    const { layers, entities, organisations, geometries, sourceCache } = selectPersistableSnapshot(
      useProjectStore.getState(),
    )
    setBusy(true)
    setError(null)
    try {
      await performProjectSave(
        { layers, entities, organisations, geometries, sourceCache },
        { loadProject, saveGeoPackage, writeGeoPackageToFile, saveProject },
      )
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
