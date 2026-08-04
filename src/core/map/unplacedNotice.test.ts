import { describe, expect, it } from "vitest"
import { describeUnplacedByContest } from "./unplacedNotice"

const NAMED = [
  { id: "e-1", name: "3rd Battalion" },
  { id: "e-2", name: "9th Company" },
  { id: "e-3", name: "  " },
]

describe("describeUnplacedByContest", () => {
  it("says nothing when everything that can be placed is placed", () => {
    expect(describeUnplacedByContest([], NAMED)).toBeNull()
  })

  it("states the absence and its reason, in the singular", () => {
    const notice = describeUnplacedByContest(["e-1"], NAMED)

    expect(notice?.count).toBe(1)
    expect(notice?.sentence).toContain("1 entity is not on the map")
    expect(notice?.sentence).toContain("its parent is contested")
  })

  it("states it in the plural", () => {
    const notice = describeUnplacedByContest(["e-1", "e-2"], NAMED)

    expect(notice?.count).toBe(2)
    expect(notice?.sentence).toContain("2 entities are not on the map")
    expect(notice?.sentence).toContain("their parent is contested")
  })

  it("names them, alphabetically", () => {
    expect(describeUnplacedByContest(["e-2", "e-1"], NAMED)?.names).toEqual(["3rd Battalion", "9th Company"])
  })

  // A count that does not match the list is the quiet defect this project keeps catching, so
  // an id with no entity behind it -- and an entity whose name is blank -- is still named by
  // its id rather than dropped from the list while staying in the count.
  it("falls back to the id rather than listing a blank", () => {
    const notice = describeUnplacedByContest(["e-3", "e-absent"], NAMED)

    expect(notice?.count).toBe(2)
    expect(notice?.names).toEqual(["e-3", "e-absent"])
  })

  it("does not double-count a repeated id", () => {
    const notice = describeUnplacedByContest(["e-1", "e-1"], NAMED)

    expect(notice?.count).toBe(1)
    expect(notice?.names).toEqual(["3rd Battalion"])
  })
})
