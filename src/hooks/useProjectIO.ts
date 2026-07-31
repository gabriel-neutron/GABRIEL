import { useCallback, useEffect, useRef, useState } from "react"
import { loadGeoPackage, saveGeoPackage } from "@/core/persistence/geopackage"
import { loadProject, saveProject, clearProject } from "@/services/projectStorage.service"
import { useProjectStore } from "@/store/useProjectStore"
import {
  loadSeedGeoPackageBuffer,
  performNewProject,
  performOpenProject,
  performSaveProject,
  performSessionRestore,
  writeGeoPackageToFile,
} from "./projectIO"

/** Module-level, so every handler's dependency array stays free of it. */
function notify(message: string): void {
  window.alert(message)
}

/**
 * The React shell over `projectIO.ts`: state, one ref, three callbacks and two effects, and
 * nothing else. Each handler's work is a plain async function there, which is what makes the
 * ordering constraints on `snapshotIsAuthoritative` testable without a DOM.
 */
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
    void performSessionRestore(
      snapshotIsAuthoritativeRef,
      { loadProject, loadGeoPackage },
      { isMounted: () => mounted, setError, setRestoredFromSession },
    )
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
    await performNewProject(
      snapshotIsAuthoritativeRef,
      {
        loadProject,
        clearProject,
        saveGeoPackage,
        writeGeoPackageToFile,
        loadSeedGeoPackageBuffer,
        resetProject,
        notify,
      },
      { setBusy, setError, setRestoredFromSession },
    )
  }, [resetProject])

  const handleOpen = useCallback(async (file: File): Promise<void> => {
    await performOpenProject(file, snapshotIsAuthoritativeRef, { loadGeoPackage, saveProject }, { setBusy, setError })
  }, [])

  const handleSave = useCallback(async (): Promise<void> => {
    await performSaveProject(
      snapshotIsAuthoritativeRef,
      { loadProject, saveGeoPackage, writeGeoPackageToFile, saveProject, notify },
      { setBusy, setError },
    )
  }, [])

  return { busy, error, restoredFromSession, handleNew, handleOpen, handleSave }
}
