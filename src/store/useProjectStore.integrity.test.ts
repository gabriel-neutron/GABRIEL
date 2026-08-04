import { beforeEach, describe, expect, it } from "vitest"
import { useProjectStore } from "./useProjectStore"
import type { IntegrityEvent } from "@/core/integrity/integrityEvent"

/**
 * The acknowledge action — the first thing in Gabriel that ever WROTE to an integrity event.
 * The three acknowledgement fields have existed on the type and in the GeoPackage table since
 * the ledger was added, with nothing to fill them.
 */

const EVENT: IntegrityEvent = {
  id: "ie-1",
  kind: "multiple-active-hierarchy",
  createdAt: "2026-08-01T09:00:00.000Z",
  summary: "3rd Battalion is placed under two parents at once.",
  detail: { childId: "e-1" },
}

function loadWith(integrityEvents: IntegrityEvent[]): void {
  useProjectStore.getState().setProject({
    layers: [{ id: "custom-1", name: "Custom", visible: true, kind: "custom" }],
    entities: [{ kind: "unit", id: "e-1", name: "3rd Battalion", layerId: "custom-1", parentId: null }],
    drawnGeometries: [],
    claims: [],
    relationships: [],
    integrityEvents,
    selectedEntityId: null,
  })
}

describe("useProjectStore.acknowledgeIntegrityEvent", () => {
  beforeEach(() => {
    useProjectStore.getState().resetProject()
  })

  it("records who acknowledged it, when, and their note", () => {
    loadWith([EVENT])

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-1", "analyst-a", "Checked against the source cable.")

    const [event] = useProjectStore.getState().integrityEvents
    expect(event.acknowledgedBy).toBe("analyst-a")
    expect(event.acknowledgedNote).toBe("Checked against the source cable.")
    expect(event.acknowledgedAt).toBeTruthy()
  })

  // The store supplies the clock; the pure function never reads one. Asserting the shape
  // rather than the value is what keeps this test from depending on when it runs.
  it("stamps an ISO 8601 timestamp", () => {
    loadWith([EVENT])

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-1", "analyst-a")

    const at = useProjectStore.getState().integrityEvents[0].acknowledgedAt ?? ""
    expect(new Date(at).toISOString()).toBe(at)
  })

  it("leaves the event otherwise exactly as it was minted", () => {
    loadWith([EVENT])

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-1", "analyst-a")

    const [event] = useProjectStore.getState().integrityEvents
    expect(event.kind).toBe(EVENT.kind)
    expect(event.summary).toBe(EVENT.summary)
    expect(event.createdAt).toBe(EVENT.createdAt)
    expect(event.detail).toEqual(EVENT.detail)
  })

  it("is a no-op for an unknown id", () => {
    loadWith([EVENT])
    const before = useProjectStore.getState().integrityEvents

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-absent", "analyst-a")

    expect(useProjectStore.getState().integrityEvents).toBe(before)
  })

  it("is a no-op when nobody is named", () => {
    loadWith([EVENT])
    const before = useProjectStore.getState().integrityEvents

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-1", "   ")

    expect(useProjectStore.getState().integrityEvents).toBe(before)
  })

  // Acknowledging annotates the record; it never removes it. An acknowledged event stays in
  // the ledger, stays persisted, and stays readable — it only stops being outstanding.
  it("keeps the event in the ledger and drops it from the unacknowledged set", () => {
    loadWith([EVENT])

    useProjectStore.getState().acknowledgeIntegrityEvent("ie-1", "analyst-a")

    const state = useProjectStore.getState()
    expect(state.integrityEvents).toHaveLength(1)
    expect(useProjectStore.getState().integrityEvents.filter((e) => e.acknowledgedAt == null)).toHaveLength(0)
  })
})
