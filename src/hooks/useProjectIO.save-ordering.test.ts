import { describe, expect, it, vi } from "vitest"
import type { SaveGeoPackageOptions } from "@/core/persistence/geopackage"
import { performProjectSave, type ProjectSaveDeps, type ProjectSaveInput } from "./useProjectIO"

/**
 * Every forwarded field carries a non-empty, distinguishable value so that no identity
 * assertion in "forwards every ProjectSaveInput field" can pass vacuously. Overrides let the
 * guard tests supply their own snapshot without a second fixture.
 */
function makeInput(overrides: Partial<ProjectSaveInput> = {}): ProjectSaveInput {
  return {
    layers: [{ id: "division", name: "Division", visible: true, kind: "echelon" }],
    entities: [{ kind: "unit", id: "entity-1", name: "1st Battalion", layerId: "division", parentId: null }],
    geometries: [
      { id: "geometry-1", layerId: "division", entityId: "entity-1", type: "point", lat: 50.45, lng: 30.52 },
    ],
    sourceCache: new Map([["https://example.org/report", "cached snippet"]]),
    sources: [{ id: "source-1", url: "https://example.org/report", domainType: null, reliability: null }],
    claims: [
      {
        id: "claim-1",
        entityId: "entity-1",
        field: "sources",
        value: null,
        sourceId: "source-1",
        credibility: null,
        timestamp: null,
      },
    ],
    ratingEvents: [
      {
        id: "event-1",
        targetType: "source",
        targetId: "source-1",
        kind: "reliability",
        value: "B",
        assessor: { kind: "analyst" },
        timestamp: "2026-07-30T00:00:00.000Z",
      },
    ],
    snapshotIsAuthoritative: true,
    ...overrides,
  }
}

/**
 * A snapshot that is empty in every data dimension, matching the three guard tests whose names
 * say "empty snapshot": an emptied `sourceCache` and `ratingEvents` count as much as the four
 * arrays, since a save replaces each of those tables too. Callers keep passing
 * `snapshotIsAuthoritative` explicitly — it is the axis those tests vary.
 */
function emptySnapshotInput(overrides: Partial<ProjectSaveInput> = {}): ProjectSaveInput {
  return makeInput({
    entities: [],
    geometries: [],
    claims: [],
    sources: [],
    sourceCache: new Map(),
    ratingEvents: [],
    ...overrides,
  })
}

function makeDeps(overrides: Partial<ProjectSaveDeps> = {}): { deps: ProjectSaveDeps; calls: string[] } {
  const calls: string[] = []
  const existingBuffer = new ArrayBuffer(4)
  const savedBytes = new Uint8Array([1, 2, 3])
  // Spreading `overrides` replaces a default closure wholesale, which for loadProject would
  // silently drop its `calls` push. So the supplied implementation is wrapped, not trusted,
  // and the wrapper is assigned after the spread.
  const suppliedLoadProject = overrides.loadProject ?? (async () => ({ buffer: existingBuffer }))
  const deps: ProjectSaveDeps = {
    saveGeoPackage: vi.fn(async () => {
      calls.push("saveGeoPackage")
      return savedBytes
    }),
    writeGeoPackageToFile: vi.fn(async () => {
      calls.push("writeGeoPackageToFile")
    }),
    saveProject: vi.fn(async () => {
      calls.push("saveProject")
    }),
    ...overrides,
    loadProject: vi.fn(async () => {
      calls.push("loadProject")
      return await suppliedLoadProject()
    }),
  }
  return { deps, calls }
}

describe("performProjectSave", () => {
  it("runs loadProject -> saveGeoPackage -> writeGeoPackageToFile -> saveProject in order", async () => {
    const { deps, calls } = makeDeps()
    await performProjectSave(makeInput(), deps)
    expect(calls).toEqual(["loadProject", "saveGeoPackage", "writeGeoPackageToFile", "saveProject"])
  })

  it("passes the existing IndexedDB buffer as saveGeoPackage's baseBuffer", async () => {
    const existingBuffer = new ArrayBuffer(8)
    const { deps } = makeDeps({
      loadProject: vi.fn(async () => ({ buffer: existingBuffer })),
    })
    await performProjectSave(makeInput(), deps)
    const saveGeoPackageMock = deps.saveGeoPackage as ReturnType<typeof vi.fn>
    expect(saveGeoPackageMock.mock.calls[0]?.[0]?.baseBuffer).toBe(existingBuffer)
  })

  it("passes a fresh copied ArrayBuffer (not the saved Uint8Array's own buffer) to saveProject", async () => {
    const savedBytes = new Uint8Array([9, 8, 7])
    const { deps } = makeDeps({
      saveGeoPackage: vi.fn(async () => savedBytes),
    })
    await performProjectSave(makeInput(), deps)
    const saveProjectMock = deps.saveProject as ReturnType<typeof vi.fn>
    const passedBuffer = saveProjectMock.mock.calls[0]?.[0] as ArrayBuffer
    expect(passedBuffer).not.toBe(savedBytes.buffer)
    expect(new Uint8Array(passedBuffer)).toEqual(savedBytes)
  })

  it("does not call saveProject when the disk write fails", async () => {
    const { deps, calls } = makeDeps({
      writeGeoPackageToFile: vi.fn(async () => {
        calls.push("writeGeoPackageToFile")
        throw new Error("disk write failed")
      }),
    })
    await expect(performProjectSave(makeInput(), deps)).rejects.toThrow("disk write failed")
    expect(calls).toEqual(["loadProject", "saveGeoPackage", "writeGeoPackageToFile"])
    expect(deps.saveProject).not.toHaveBeenCalled()
  })

  it("refuses to save over an existing session buffer when this session never loaded the project", async () => {
    // makeDeps' loadProject hands back a 4-byte buffer: there is something real on disk.
    const { deps, calls } = makeDeps()
    await expect(performProjectSave(makeInput({ snapshotIsAuthoritative: false }), deps)).rejects.toThrow(
      /refusing to overwrite/i,
    )
    expect(deps.saveGeoPackage).not.toHaveBeenCalled()
    expect(deps.writeGeoPackageToFile).not.toHaveBeenCalled()
    expect(deps.saveProject).not.toHaveBeenCalled()
    expect(calls).toEqual(["loadProject"])
  })

  it("refuses even when the snapshot carries entities, if this session never loaded the project", async () => {
    // The state an analyst reaches by typing a single unit into an app that failed to restore.
    // A save replaces rather than merges, so this is the sequence that writes 1 unit over 1010.
    const { deps, calls } = makeDeps()
    const input = makeInput({
      snapshotIsAuthoritative: false,
      entities: [{ kind: "unit", id: "typed-1", name: "Typed after a failed restore", layerId: "division", parentId: null }],
    })
    await expect(performProjectSave(input, deps)).rejects.toThrow(/refusing to overwrite/i)
    expect(deps.saveGeoPackage).not.toHaveBeenCalled()
    expect(deps.writeGeoPackageToFile).not.toHaveBeenCalled()
    expect(deps.saveProject).not.toHaveBeenCalled()
    expect(calls).toEqual(["loadProject"])
  })

  it("saves an empty snapshot when there is no persisted session buffer", async () => {
    // snapshotIsAuthoritative stays false on purpose: an authoritative snapshot never reaches
    // the buffer clause, so this would pass against a guard that had been deleted outright.
    const { deps } = makeDeps({ loadProject: vi.fn(async () => null) })
    const input = emptySnapshotInput({ snapshotIsAuthoritative: false })
    await expect(performProjectSave(input, deps)).resolves.toBeUndefined()
    expect(deps.saveGeoPackage).toHaveBeenCalledTimes(1)
  })

  it("saves an empty snapshot when the persisted session buffer is empty", async () => {
    const { deps } = makeDeps({ loadProject: vi.fn(async () => ({ buffer: new ArrayBuffer(0) })) })
    const input = emptySnapshotInput({ snapshotIsAuthoritative: false })
    await expect(performProjectSave(input, deps)).resolves.toBeUndefined()
    expect(deps.saveGeoPackage).toHaveBeenCalledTimes(1)
  })

  it("does not refuse when this session loaded the project, even though the snapshot is empty", async () => {
    // The analyst who deliberately emptied a real project and saved: their call, and git is
    // the backup. Refused under the struck four-dimension condition, allowed by owner ruling.
    const { deps } = makeDeps()
    const input = emptySnapshotInput({ snapshotIsAuthoritative: true })
    await expect(performProjectSave(input, deps)).resolves.toBeUndefined()
    expect(deps.saveGeoPackage).toHaveBeenCalledTimes(1)
  })

  it("forwards every ProjectSaveInput field to the matching saveGeoPackage option", async () => {
    const existingBuffer = new ArrayBuffer(8)
    const { deps } = makeDeps({ loadProject: vi.fn(async () => ({ buffer: existingBuffer })) })
    const input = makeInput()
    await performProjectSave(input, deps)
    const saveGeoPackageMock = deps.saveGeoPackage as ReturnType<typeof vi.fn>
    const options = saveGeoPackageMock.mock.calls[0]?.[0] as SaveGeoPackageOptions
    expect(options.layers).toBe(input.layers)
    expect(options.entities).toBe(input.entities)
    expect(options.geometries).toBe(input.geometries)
    expect(options.sources).toBe(input.sources)
    expect(options.claims).toBe(input.claims)
    expect(options.ratingEvents).toBe(input.ratingEvents)
    // The rename: ProjectSaveInput calls it sourceCache, SaveGeoPackageOptions researchSources.
    expect(options.researchSources).toBe(input.sourceCache)
    expect(options.baseBuffer).toBe(existingBuffer)
  })
})
