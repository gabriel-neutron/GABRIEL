import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearProject, loadProject } from "@/services/projectStorage.service"
import { useProjectStore } from "@/store/useProjectStore"
import { performNewProject, performSessionRestore, type NewProjectDeps } from "./projectIO"
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
 * `snapshotIsAuthoritative` answers one question: does the in-memory snapshot stand for the
 * persisted project? A save that runs while the answer is no, over a non-empty persisted project,
 * is refused — a save replaces rather than merges, so saving a snapshot that never stood for the
 * persisted project destroys that project.
 *
 * This file covers the two paths with no analyst-chosen file: session restore and New Project.
 * The chosen-file paths, and the save the flag guards, are in `projectIO.openSave.test.ts`.
 *
 * Both halves of the flag are load-bearing, so both halves are asserted: LOWERED the instant the
 * snapshot stops standing for the persisted project, and RAISED only once an operation has fully
 * landed. Where the contract states an order, the flag is read INSIDE the injected dependency at
 * the moment it is called — a test that only checked the final value would pass against an
 * implementation that moved the assignment to the wrong moment.
 */

/**
 * Overrides are wrapped rather than spread over the defaults where a default carries bookkeeping,
 * following useProjectIO.save-ordering.test.ts: spreading an override wholesale silently drops the
 * `calls` push it was meant to replace only the behaviour of.
 */
function makeNewProjectDeps(
  overrides: Partial<NewProjectDeps> = {},
): { deps: NewProjectDeps; calls: string[] } {
  const calls: string[] = []
  const suppliedClearProject = overrides.clearProject ?? clearProject
  const suppliedResetProject = overrides.resetProject ?? (() => useProjectStore.getState().resetProject())
  const deps: NewProjectDeps = {
    loadProject,
    saveGeoPackage: vi.fn(async () => {
      calls.push("saveGeoPackage")
      return new Uint8Array([1, 2, 3])
    }),
    writeGeoPackageToFile: vi.fn(async () => {
      calls.push("writeGeoPackageToFile")
    }),
    loadSeedGeoPackageBuffer: vi.fn(async () => null),
    notify: vi.fn(),
    ...overrides,
    clearProject: vi.fn(async () => {
      calls.push("clearProject")
      await suppliedClearProject()
    }),
    resetProject: vi.fn(() => {
      calls.push("resetProject")
      suppliedResetProject()
    }),
  }
  return { deps, calls }
}

beforeEach(async () => {
  resetStores()
  await clearProject()
  // These handlers log every caught failure; the failure branches are most of this file.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(async () => {
  resetStores()
  await clearProject()
  vi.restoreAllMocks()
})

describe("session restore and the snapshot's authority over the persisted project", () => {
  it("grants the snapshot authority only after the store has been filled from the persisted project", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()
    let authorityWhileParsing: boolean | null = null

    await performSessionRestore(
      authority,
      {
        loadProject,
        loadGeoPackage: vi.fn(async () => {
          authorityWhileParsing = authority.current
          return makeLoadResult()
        }),
      },
      ui,
    )

    // Not yet authoritative while the file was still being parsed: nothing had reached the store.
    expect(authorityWhileParsing).toBe(false)
    expect(useProjectStore.getState().entities.map((e) => e.id)).toEqual(["loaded-entity"])
    expect(authority.current).toBe(true)
    expect(ui.setRestoredFromSession).toHaveBeenCalledWith(true)
  })

  it("leaves the snapshot without authority when there is no persisted project to restore", async () => {
    const authority = makeAuthority(false)
    const ui = makeUi()
    const loadGeoPackage = vi.fn(async () => makeLoadResult())

    await performSessionRestore(authority, { loadProject, loadGeoPackage }, ui)

    expect(authority.current).toBe(false)
    expect(loadGeoPackage).not.toHaveBeenCalled()
  })

  it("leaves the snapshot without authority when the persisted project cannot be parsed", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()

    await performSessionRestore(
      authority,
      {
        loadProject,
        loadGeoPackage: vi.fn(async () => {
          throw new Error("corrupt GeoPackage")
        }),
      },
      ui,
    )

    expect(authority.current).toBe(false)
    expect(ui.setError).toHaveBeenCalledWith("corrupt GeoPackage")
  })

  it("leaves the snapshot without authority when the caller unmounts before the persisted project is parsed", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()
    ui.isMounted = vi.fn(() => false)
    const loadGeoPackage = vi.fn(async () => makeLoadResult())

    await performSessionRestore(authority, { loadProject, loadGeoPackage }, ui)

    expect(authority.current).toBe(false)
    expect(loadGeoPackage).not.toHaveBeenCalled()
  })

  it("leaves the snapshot without authority when the caller unmounts while the persisted project is parsed", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()
    let mountedChecks = 0
    // Mounted at the first check point, unmounted by the second — the parse outlived the caller.
    ui.isMounted = vi.fn(() => {
      mountedChecks += 1
      return mountedChecks < 2
    })

    await performSessionRestore(
      authority,
      { loadProject, loadGeoPackage: vi.fn(async () => makeLoadResult()) },
      ui,
    )

    expect(authority.current).toBe(false)
    // The store was never filled either, so nothing half-restored is left standing.
    expect(useProjectStore.getState().entities).toEqual([])
  })
})

describe("New Project and the snapshot's authority over the persisted project", () => {
  it("revokes the snapshot's authority before the screen is emptied and before the persisted project is cleared", async () => {
    await seedPersistedProject()
    // An earlier restore left the flag raised; an empty screen does not stand for the project
    // still sitting in IndexedDB.
    const authority = makeAuthority(true)
    const ui = makeUi()
    let authorityAtReset: boolean | null = null
    let authorityAtClear: boolean | null = null

    const { deps, calls } = makeNewProjectDeps({
      resetProject: () => {
        authorityAtReset = authority.current
        useProjectStore.getState().resetProject()
      },
      clearProject: async () => {
        authorityAtClear = authority.current
        await clearProject()
      },
    })

    await performNewProject(authority, deps, ui)

    expect(authorityAtReset).toBe(false)
    expect(authorityAtClear).toBe(false)
    // The order the assertions above depend on: the stores are emptied, then the cache is cleared.
    expect(calls.slice(0, 2)).toEqual(["resetProject", "clearProject"])
  })

  it("leaves the snapshot without authority when the persisted project could not be cleared, so the real project survives", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(true)
    const ui = makeUi()
    const { deps } = makeNewProjectDeps({
      clearProject: async () => {
        throw new Error("IndexedDB delete failed")
      },
    })

    await performNewProject(authority, deps, ui)

    // The screen is empty but the persisted project is still there: an empty snapshot must not be
    // allowed to overwrite it on the next save.
    expect(authority.current).toBe(false)
    expect(await persistedBytes()).toEqual(Array.from(PERSISTED_BYTES))
    expect(ui.setError).toHaveBeenCalledWith("IndexedDB delete failed")
  })

  it("grants the snapshot authority once the persisted project has actually been cleared", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()
    let authorityAtWrite: boolean | null = null
    const { deps } = makeNewProjectDeps({
      saveGeoPackage: vi.fn(async () => {
        authorityAtWrite = authority.current
        return new Uint8Array([1, 2, 3])
      }),
    })

    await performNewProject(authority, deps, ui)

    expect(await persistedBytes()).toBeNull()
    // Raised by the successful clear, and BEFORE the new file is written: the write can abort, and
    // an abort must not be what decides whether the empty screen may overwrite the session cache.
    expect(authorityAtWrite).toBe(true)
    expect(authority.current).toBe(true)
  })

  it("keeps the authority the successful clear granted even when writing the new file is aborted", async () => {
    await seedPersistedProject()
    const authority = makeAuthority(false)
    const ui = makeUi()
    const abort = new Error("user cancelled the save picker")
    abort.name = "AbortError"
    const { deps } = makeNewProjectDeps({
      writeGeoPackageToFile: vi.fn(async () => {
        throw abort
      }),
    })

    await performNewProject(authority, deps, ui)

    // The clear landed, so the empty screen IS the project now — an abandoned file picker does not
    // undo that, and the next save must not be refused over a session cache that is already gone.
    expect(await persistedBytes()).toBeNull()
    expect(authority.current).toBe(true)
    expect(ui.setError).not.toHaveBeenCalledWith(abort.message)
  })
})
