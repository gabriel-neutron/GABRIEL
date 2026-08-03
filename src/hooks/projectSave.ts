import type {
  GpkgLayer,
  GpkgEntity,
  GpkgGeometry,
  GpkgSource,
  GpkgClaim,
  GpkgRatingEvent,
  GpkgRelationship,
  GpkgIntegrityEvent,
  SaveGeoPackageOptions,
} from "@/core/persistence/geopackage"
import type { LoadedProject } from "@/services/projectStorage.service"

/**
 * The save path and the guard that stands in front of it, alone in their own file: this is the
 * surface Slice 2B grows (two further required fields on ProjectSaveInput) and it is the one whose
 * ordering is load-bearing, so it should not share a 300-line budget with the handler bodies.
 */

export interface ProjectSaveInput {
  layers: GpkgLayer[]
  entities: GpkgEntity[]
  geometries: GpkgGeometry[]
  /** The persistence-side name, on both sides since P3: this type is SaveGeoPackageOptions' pre-image. */
  researchSources: Map<string, string>
  sources: GpkgSource[]
  claims: GpkgClaim[]
  /**
   * Required, not optional. writeRatingEvents self-clears before inserting (save.ts), so an
   * omitted field is not tidying — it wipes the table. A call site that forgets it is a compile
   * error rather than a silent loss of the audit trail.
   */
  ratingEvents: GpkgRatingEvent[]
  /**
   * Slice 2B, and plain arrays rather than `T | undefined` for the same reason
   * SaveGeoPackageOptions declares them that way: writeRelationships and writeIntegrityEvents
   * self-clear too, so absence is not a distinct state here — "deliberately nothing here" is `[]`,
   * and a required member keeps that choice visible at every call site.
   */
  relationships: GpkgRelationship[]
  integrityEvents: GpkgIntegrityEvent[]
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
    researchSources: input.researchSources,
    baseBuffer: existing?.buffer,
    sources: input.sources,
    claims: input.claims,
    ratingEvents: input.ratingEvents,
    relationships: input.relationships,
    integrityEvents: input.integrityEvents,
  })
  await deps.writeGeoPackageToFile(bytes)
  const buffer = new ArrayBuffer(bytes.length)
  new Uint8Array(buffer).set(bytes)
  await deps.saveProject(buffer)
}
