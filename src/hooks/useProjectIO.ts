import { useCallback, useEffect, useState } from "react"
import {
  loadGeoPackage,
  saveGeoPackage,
  getDefaultEchelonLayers,
  applyGeoPackageResult,
  type GpkgLayer,
} from "@/services/geopackage.service"
import { loadProject, saveProject, clearProject } from "@/services/projectStorage.service"
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
            drawnGeometries: next.drawnGeometries,
            selectedEntityId: next.selectedEntityId,
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
      const gpkgLayers: GpkgLayer[] = defaultLayers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        kind: l.kind,
      }))
      const bytes = await saveGeoPackage(gpkgLayers, [], [])
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
        drawnGeometries: next.drawnGeometries,
        selectedEntityId: next.selectedEntityId,
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
    const { layers, entities: persistedEntities, geometries: persistedGeometries, sourceCache } =
      selectPersistableSnapshot(useProjectStore.getState())
    const gpkgLayers: GpkgLayer[] = layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      kind: l.kind ?? (l.osmData != null ? ("osm" as const) : undefined),
      sourceQuery: l.sourceQuery,
      osmData: l.osmData,
    }))
    setBusy(true)
    setError(null)
    try {
      const bytes = await saveGeoPackage(gpkgLayers, persistedEntities, persistedGeometries, sourceCache)
      await writeGeoPackageToFile(bytes)
      const buffer = new ArrayBuffer(bytes.length)
      new Uint8Array(buffer).set(bytes)
      await saveProject(buffer)
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
