import { describe, expect, it, vi } from "vitest"
import { performReleaseExport } from "./releaseExport"
import type { ReleaseInput } from "@/core/export/releaseBundle"

const SNAPSHOT: ReleaseInput = {
  entities: [
    { kind: "unit", id: "u-1", name: "HQ", layerId: "l-1", parentId: null },
    { kind: "unit", id: "u-2", name: "B Coy", layerId: "l-1", parentId: null },
  ],
  relationships: [
    { id: "r-1", fromId: "u-2", toId: "u-1", type: "subordinate_to", startDate: null, endDate: null, metadata: {} },
  ],
  claims: [
    { id: "c-1", entityId: "u-1", field: "sources", value: null, sourceId: "s-1", credibility: null, timestamp: null },
    { id: "c-2", entityId: "u-2", field: "sources", value: null, sourceId: "s-1", credibility: null, timestamp: null },
  ],
  geometries: [],
  sources: [{ id: "s-1", url: "https://example.org/a", domainType: null, reliability: null }],
  generatedAt: "IGNORED — the deps supply the clock",
}

/** Returns the mocks alongside the deps object, so a test can assert on them without the
 *  spread widening `vi.fn` back to a plain function type. */
function harness(over: Partial<Parameters<typeof performReleaseExport>[0]> = {}) {
  // The parameters exist to type the mocks, so `.mock.calls[0][0]` is a `Map` and not `unknown`.
  const writeFiles = vi.fn(async (files: Map<string, string>) => { void files })
  const notify = vi.fn((message: string) => { void message })
  const deps = {
    snapshot: () => SNAPSHOT,
    writeFiles,
    notify,
    now: () => "2026-08-04T12:00:00.000Z",
    ...over,
  }
  return { deps, writeFiles, notify }
}

function ui() {
  return { setBusy: vi.fn(), setError: vi.fn() }
}

describe("performReleaseExport", () => {
  it("writes the whole bundle and says what shipped", async () => {
    const { deps, writeFiles, notify } = harness()
    const u = ui()

    await performReleaseExport(deps, u)

    const files = writeFiles.mock.calls[0][0]
    expect([...files.keys()]).toContain("entities.geojson")
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("2 entities"))
    expect(u.setError).toHaveBeenCalledWith(null)
  })

  // The count in the message is the gated count, not the project's. Reporting the project's
  // would tell an analyst they had published 1,012 relationships when the gate shipped 252.
  it("reports what the gate passed, not what the project holds", async () => {
    const { deps, notify } = harness({ snapshot: () => ({ ...SNAPSHOT, claims: [SNAPSHOT.claims[0]] }) })

    await performReleaseExport(deps, ui())

    expect(notify).toHaveBeenCalledWith(expect.stringContaining("0 relationships"))
    expect(notify).toHaveBeenCalledWith(expect.stringContaining("1 withheld"))
  })

  it("takes its timestamp from the injected clock", async () => {
    const { deps, writeFiles } = harness()

    await performReleaseExport(deps, ui())

    expect(writeFiles.mock.calls[0][0].get("README.md")).toContain("2026-08-04T12:00:00.000Z")
  })

  it("lowers busy again when the write fails", async () => {
    const { deps } = harness({ writeFiles: async () => { throw new Error("disk full") } })
    const u = ui()

    await performReleaseExport(deps, u)

    expect(u.setError).toHaveBeenCalledWith("disk full")
    expect(u.setBusy).toHaveBeenLastCalledWith(false)
  })

  // Cancelling a directory picker is a decision, not a failure, and must not be shown as one.
  // The precedent is `performNewProject`, which swallows AbortError the same way.
  it("stays silent when the analyst cancels the picker", async () => {
    const abort = Object.assign(new Error("The user aborted a request."), { name: "AbortError" })
    const { deps, notify } = harness({ writeFiles: async () => { throw abort } })
    const u = ui()

    await performReleaseExport(deps, u)

    expect(u.setError).not.toHaveBeenCalledWith(expect.stringContaining("abort"))
    expect(notify).not.toHaveBeenCalled()
    expect(u.setBusy).toHaveBeenLastCalledWith(false)
  })
})
