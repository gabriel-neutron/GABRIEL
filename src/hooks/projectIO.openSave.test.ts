import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearProject, loadProject, saveProject } from "@/services/projectStorage.service"
import { useProjectStore } from "@/store/useProjectStore"
import { performOpenProject, performSaveProject, type ProjectIODeps } from "./projectIO"
import type { ProjectSaveDeps } from "./projectSave"
import {
  makeAuthority,
  makeLoadResult,
  makeUi,
  persistedBytes,
  PERSISTED_BYTES,
  resetStores,
  seedPersistedProject,
} from "./projectIO.authority.fixtures"

/**
 * The snapshot-authority contract on the two paths where the analyst chooses a file: Open, and the
 * Save that the flag guards. The paths with no chosen file — session restore and New Project — are
 * in `projectIO.authority.test.ts`.
 *
 * Where the contract states an order, the flag is read INSIDE the injected dependency at the moment
 * it is called: a test that only checked the final value would pass against an implementation that
 * moved the assignment to the wrong moment.
 */

function makeSaveDeps(
  overrides: Partial<ProjectSaveDeps & Pick<ProjectIODeps, "notify">> = {},
): { deps: ProjectSaveDeps & Pick<ProjectIODeps, "notify">; calls: string[] } {
  const calls: string[] = []
  const deps: ProjectSaveDeps & Pick<ProjectIODeps, "notify"> = {
    // The real session cache, so "nothing has been written" is checkable against a real store.
    loadProject,
    saveGeoPackage: vi.fn(async () => {
      calls.push("saveGeoPackage")
      return new Uint8Array([7, 7, 7])
    }),
    writeGeoPackageToFile: vi.fn(async () => {
      calls.push("writeGeoPackageToFile")
    }),
    saveProject: vi.fn(async (buffer: ArrayBuffer) => {
      calls.push("saveProject")
      await saveProject(buffer)
    }),
    notify: vi.fn(),
    ...overrides,
  }
  return { deps, calls }
}

/** The function only ever calls arrayBuffer(), so a stub with that one method is the whole File. */
function fileYielding(buffer: ArrayBuffer, onRead?: () => void): File {
  return {
    arrayBuffer: async () => {
      if (onRead) onRead()
      return buffer
    },
  } as unknown as File
}

function unreadableFile(message: string): File {
  return {
    arrayBuffer: async () => {
      throw new Error(message)
    },
  } as unknown as File
}

beforeEach(async () => {
  resetStores()
  await clearProject()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  resetStores()
  await clearProject()
  vi.restoreAllMocks()
})

describe("Open Project and the snapshot's authority over the persisted project", () => {
  it("keeps the snapshot's existing authority when the chosen file cannot be read", async () => {
    const authority = makeAuthority(true)
    const ui = makeUi()
    const loadGeoPackage = vi.fn(async () => makeLoadResult())

    await performOpenProject(unreadableFile("file read failed"), authority, { loadGeoPackage, saveProject }, ui)

    // The store still holds whatever it held, which may legitimately still be authoritative.
    expect(authority.current).toBe(true)
    expect(loadGeoPackage).not.toHaveBeenCalled()
    expect(ui.setError).toHaveBeenCalledWith("file read failed")
  })

  it("keeps the snapshot's existing authority when the chosen file is not a readable GeoPackage", async () => {
    const authority = makeAuthority(true)
    const ui = makeUi()

    await performOpenProject(
      fileYielding(new ArrayBuffer(4)),
      authority,
      {
        loadGeoPackage: vi.fn(async () => {
          throw new Error("not a GeoPackage")
        }),
        saveProject,
      },
      ui,
    )

    expect(authority.current).toBe(true)
    expect(ui.setError).toHaveBeenCalledWith("not a GeoPackage")
  })

  it("revokes the snapshot's authority only after the chosen file has been read and parsed", async () => {
    const authority = makeAuthority(true)
    const ui = makeUi()
    let authorityAtRead: boolean | null = null
    let authorityAtParse: boolean | null = null

    await performOpenProject(
      fileYielding(new ArrayBuffer(4), () => {
        authorityAtRead = authority.current
      }),
      authority,
      {
        loadGeoPackage: vi.fn(async () => {
          authorityAtParse = authority.current
          return makeLoadResult()
        }),
        saveProject: vi.fn(async () => {}),
      },
      ui,
    )

    // Never lowered at the top: both awaits that can still throw ran with the flag untouched.
    expect(authorityAtRead).toBe(true)
    expect(authorityAtParse).toBe(true)
    expect(authority.current).toBe(true)
  })

  it("grants the snapshot authority over the chosen file before caching it, and keeps it when the cache write fails", async () => {
    const authority = makeAuthority(false)
    const ui = makeUi()
    let authorityAtCacheWrite: boolean | null = null

    await performOpenProject(
      fileYielding(new ArrayBuffer(4)),
      authority,
      {
        loadGeoPackage: vi.fn(async () => makeLoadResult()),
        saveProject: vi.fn(async () => {
          authorityAtCacheWrite = authority.current
          throw new Error("cache write failed")
        }),
      },
      ui,
    )

    // The analyst chose this file, so the snapshot stands for what they want saved even though the
    // IndexedDB cache write failed.
    expect(authorityAtCacheWrite).toBe(true)
    expect(authority.current).toBe(true)
    expect(useProjectStore.getState().entities.map((e) => e.id)).toEqual(["loaded-entity"])
    expect(ui.setError).toHaveBeenCalledWith("cache write failed")
  })
})

describe("Save and the snapshot's authority over the persisted project", () => {
  it("leaves the snapshot's authority unchanged when the save does not land", async () => {
    // Nothing persisted, so the guard cannot be what stops this save — the disk write is.
    const authority = makeAuthority(false)
    const ui = makeUi()
    const { deps } = makeSaveDeps({
      writeGeoPackageToFile: vi.fn(async () => {
        throw new Error("disk write failed")
      }),
    })

    await performSaveProject(authority, deps, ui)

    expect(authority.current).toBe(false)
    expect(deps.notify).not.toHaveBeenCalled()
    expect(ui.setError).toHaveBeenCalledWith("disk write failed")
  })

  it("grants the snapshot authority over the persisted project once a save has landed", async () => {
    const authority = makeAuthority(false)
    const ui = makeUi()
    const { deps, calls } = makeSaveDeps()

    await performSaveProject(authority, deps, ui)

    expect(calls).toEqual(["saveGeoPackage", "writeGeoPackageToFile", "saveProject"])
    expect(authority.current).toBe(true)
    expect(deps.notify).toHaveBeenCalledWith("Saved successfully")
  })

  it("refuses to save over a persisted project the snapshot has no authority over, writing nothing", async () => {
    await seedPersistedProject()
    const layerId = useProjectStore.getState().layers[0].id
    // The state an analyst reaches by typing one unit into an app whose restore failed.
    useProjectStore.getState().addEntity({
      kind: "unit",
      id: "typed-after-failed-restore",
      name: "Typed after a failed restore",
      layerId,
      parentId: null,
    })
    const authority = makeAuthority(false)
    const ui = makeUi()
    const { deps } = makeSaveDeps()

    await performSaveProject(authority, deps, ui)

    expect(deps.saveGeoPackage).not.toHaveBeenCalled()
    expect(deps.writeGeoPackageToFile).not.toHaveBeenCalled()
    expect(deps.saveProject).not.toHaveBeenCalled()
    // The persisted project is byte-for-byte what it was.
    expect(await persistedBytes()).toEqual(Array.from(PERSISTED_BYTES))
    expect(ui.setError).toHaveBeenCalledWith(expect.stringMatching(/refusing to overwrite/i))
    expect(deps.notify).not.toHaveBeenCalled()
    expect(authority.current).toBe(false)
  })

  it("allows the same save over the same persisted project once the snapshot has authority over it", async () => {
    await seedPersistedProject()
    const layerId = useProjectStore.getState().layers[0].id
    useProjectStore.getState().addEntity({
      kind: "unit",
      id: "typed-after-failed-restore",
      name: "Typed after a failed restore",
      layerId,
      parentId: null,
    })
    // The one axis that differs from the test above.
    const authority = makeAuthority(true)
    const ui = makeUi()
    const { deps, calls } = makeSaveDeps()

    await performSaveProject(authority, deps, ui)

    expect(calls).toEqual(["saveGeoPackage", "writeGeoPackageToFile", "saveProject"])
    expect(ui.setError).not.toHaveBeenCalledWith(expect.stringMatching(/refusing to overwrite/i))
    expect(deps.notify).toHaveBeenCalledWith("Saved successfully")
    expect(authority.current).toBe(true)
  })
})
