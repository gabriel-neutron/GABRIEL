import { describe, expect, it, vi } from "vitest"
import { performProjectSave, type ProjectSaveDeps, type ProjectSaveInput } from "./useProjectIO"

function makeInput(): ProjectSaveInput {
  return {
    layers: [{ id: "division", name: "Division", visible: true, kind: "echelon" }],
    entities: [],
    geometries: [],
    sourceCache: new Map(),
    sources: [],
    claims: [],
  }
}

function makeDeps(overrides: Partial<ProjectSaveDeps> = {}): { deps: ProjectSaveDeps; calls: string[] } {
  const calls: string[] = []
  const existingBuffer = new ArrayBuffer(4)
  const savedBytes = new Uint8Array([1, 2, 3])
  const deps: ProjectSaveDeps = {
    loadProject: vi.fn(async () => {
      calls.push("loadProject")
      return { buffer: existingBuffer }
    }),
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
    expect(saveGeoPackageMock.mock.calls[0]?.[4]).toBe(existingBuffer)
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
})
