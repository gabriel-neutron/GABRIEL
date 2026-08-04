import { describe, expect, it } from "vitest"
import type { IntegrityEvent } from "./integrityEvent"
import { decodeIntegrityEvent } from "./integrityEvent"
import { acknowledgeIntegrityEvent } from "./acknowledge"

const AT = "2026-08-04T10:00:00.000Z"

function event(overrides: Partial<IntegrityEvent> = {}): IntegrityEvent {
  return {
    id: "ie-1",
    kind: "multiple-active-hierarchy",
    createdAt: "2026-08-01T09:00:00.000Z",
    summary: "3rd Battalion is placed under two parents at once.",
    detail: { childId: "e-3" },
    ...overrides,
  }
}

describe("acknowledgeIntegrityEvent", () => {
  it("stamps who, when and the note on the matching event only", () => {
    const events = [event(), event({ id: "ie-2" })]

    const next = acknowledgeIntegrityEvent(events, "ie-1", { by: "analyst-a", note: "Checked the source cable.", at: AT })

    expect(next[0].acknowledgedBy).toBe("analyst-a")
    expect(next[0].acknowledgedAt).toBe(AT)
    expect(next[0].acknowledgedNote).toBe("Checked the source cable.")
    expect(next[1].acknowledgedAt).toBeUndefined()
  })

  it("leaves the input array and its events unmutated", () => {
    const events = [event()]

    acknowledgeIntegrityEvent(events, "ie-1", { by: "analyst-a", at: AT })

    expect(events[0].acknowledgedBy).toBeUndefined()
  })

  // The three acknowledgement fields are read back by `decodeIntegrityEvent`, which drops
  // any string that trims to empty. A blank note written as "" would therefore survive the
  // session and vanish on reload -- so a blank note is an ABSENT field, never an empty one.
  it("omits the note entirely rather than writing a blank string", () => {
    const next = acknowledgeIntegrityEvent([event()], "ie-1", { by: "analyst-a", note: "   ", at: AT })

    expect("acknowledgedNote" in next[0]).toBe(false)
  })

  it("trims the fields it does write", () => {
    const next = acknowledgeIntegrityEvent([event()], "ie-1", { by: "  analyst-a  ", note: "  seen  ", at: AT })

    expect(next[0].acknowledgedBy).toBe("analyst-a")
    expect(next[0].acknowledgedNote).toBe("seen")
  })

  // The whole point of the round-trip: an acknowledgement that the decoder discards is an
  // acknowledgement the audit trail forgets, and the panel would show the event as still
  // outstanding after a reload with no indication anything was lost.
  it("writes an acknowledgement that survives decodeIntegrityEvent", () => {
    const next = acknowledgeIntegrityEvent([event()], "ie-1", { by: "analyst-a", note: "seen", at: AT })

    expect(decodeIntegrityEvent(JSON.parse(JSON.stringify(next[0])) as unknown)).toEqual(next[0])
  })

  it("refuses a blank acknowledger and returns the same array", () => {
    const events = [event()]

    expect(acknowledgeIntegrityEvent(events, "ie-1", { by: "   ", at: AT })).toBe(events)
  })

  it("refuses a blank timestamp and returns the same array", () => {
    const events = [event()]

    expect(acknowledgeIntegrityEvent(events, "ie-1", { by: "analyst-a", at: "  " })).toBe(events)
  })

  it("returns the same array for an unknown id", () => {
    const events = [event()]

    expect(acknowledgeIntegrityEvent(events, "ie-absent", { by: "analyst-a", at: AT })).toBe(events)
  })

  // `acknowledgedBy`/`At`/`Note` are single-valued, so a second acknowledgement would
  // overwrite the first attribution leaving no trace it existed. That is the same defect as
  // deleting a subordination edge instead of end-dating it. Refusing is the direction that
  // loses nothing, and stays open to a ledger-shaped acknowledgement later.
  it("does not overwrite an acknowledgement that is already recorded", () => {
    const events = [event({ acknowledgedBy: "analyst-a", acknowledgedAt: "2026-08-02T09:00:00.000Z" })]

    const next = acknowledgeIntegrityEvent(events, "ie-1", { by: "analyst-b", at: AT })

    expect(next).toBe(events)
    expect(next[0].acknowledgedBy).toBe("analyst-a")
  })
})
