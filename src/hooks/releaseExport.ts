import { buildReleaseBundle, type ReleaseInput } from "@/core/export/releaseBundle"

/**
 * The release export's body, with every React binding replaced by a parameter — the same
 * shape as `projectIO.ts`'s four handlers, and for the same reason: the ordering and the
 * reporting are the parts worth testing, and neither needs a DOM.
 *
 * This is the only path by which project data leaves the device as anything other than the
 * analyst's own `.gpkg`, so what it reports has to be what actually shipped.
 */

export type ReleaseExportDeps = {
  snapshot: () => ReleaseInput
  writeFiles: (files: Map<string, string>) => Promise<void>
  notify: (message: string) => void
  now: () => string
}

export type ReleaseExportUi = {
  setBusy: (value: boolean) => void
  setError: (message: string | null) => void
}

export async function performReleaseExport(deps: ReleaseExportDeps, ui: ReleaseExportUi): Promise<void> {
  ui.setBusy(true)
  ui.setError(null)
  try {
    const bundle = buildReleaseBundle({ ...deps.snapshot(), generatedAt: deps.now() })
    await deps.writeFiles(bundle.files)

    // The GATED counts, never the project's. Telling an analyst they had published 1,012
    // relationships when the gate shipped 252 would misreport the one number that decides
    // whether a release is worth cutting.
    const { entities, relationships, excluded } = bundle.gated
    deps.notify(
      "Exported " + String(entities.length) + " entities and " + String(relationships.length) +
        " relationships (" + String(excluded.relationships.length + excluded.entities.length) +
        " withheld by the export gate — see README.md).",
    )
  } catch (e) {
    // Cancelling the directory picker is a decision, not a failure. Same handling as
    // `performNewProject`.
    if (e instanceof Error && e.name === "AbortError") return
    ui.setError(e instanceof Error ? e.message : "Export failed")
    console.error("release export failed", e)
  } finally {
    ui.setBusy(false)
  }
}

/**
 * Writes the bundle into a folder the analyst picks. A directory rather than a zip because
 * the app already requires the File System Access API to save at all (`writeGeoPackageToFile`),
 * so this adds no new capability and no archive-format dependency — and the analyst can see
 * what was written without unpacking anything.
 */
export async function writeReleaseFilesToDirectory(files: Map<string, string>): Promise<void> {
  const showDirectory = (
    window as Window & { showDirectoryPicker?: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }
  ).showDirectoryPicker
  if (typeof showDirectory !== "function")
    throw new Error("This browser does not support the File System Access API.")

  const directory = await showDirectory.call(window, { mode: "readwrite" })
  for (const [name, contents] of files) {
    const handle = await directory.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(contents)
    await writable.close()
  }
}
