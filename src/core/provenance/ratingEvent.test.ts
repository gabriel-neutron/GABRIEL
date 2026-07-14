import { describe, expect, it } from "vitest"
import { createRatingEvent } from "./ratingEvent"

describe("createRatingEvent", () => {
  it("captures the target, kind, new value, and assessor of a rating change", () => {
    const event = createRatingEvent({
      targetType: "source",
      targetId: "src-1",
      kind: "reliability",
      value: "B",
      assessor: { kind: "analyst" },
    })
    expect(event.targetType).toBe("source")
    expect(event.targetId).toBe("src-1")
    expect(event.kind).toBe("reliability")
    expect(event.value).toBe("B")
    expect(event.assessor).toEqual({ kind: "analyst" })
    expect(typeof event.id).toBe("string")
    expect(event.id.length).toBeGreaterThan(0)
    expect(typeof event.timestamp).toBe("string")
  })
})
