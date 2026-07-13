import { describe, expect, it } from "vitest"
import { createEnrichmentRunner } from "./enrichmentRunner"
import type { EnrichmentRequest } from "@/types/enrichment.types"

function makeRequest(): EnrichmentRequest {
  return {
    prompt: "Find headquarters and garrison details for the selected unit with sources.",
    feature: {
      type: "Feature",
      id: "feature-1",
      geometry: { type: "Point", coordinates: [134.7, 48.5] },
      properties: {
        id: "feature-1",
        name: "64th Separate Motor Rifle Brigade",
      },
    },
    context: {
      parent: null,
      children: [],
    },
    outputSchema: {
      type: "object",
      properties: {
        notes: { type: "string" },
      },
      required: ["notes"],
      additionalProperties: false,
    },
    maxDepth: 2,
  }
}

describe("createEnrichmentRunner", () => {
  it("handles cancel-requested close via abort path", async () => {
    const runner = createEnrichmentRunner(async (_request, options) => {
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      })
      throw new Error("unreachable")
    })

    let abortClose = false
    const promise = runner.run(makeRequest(), {
      onProgress: () => {},
      onSuccess: () => {},
      onAbort: (closeAfterCancel) => {
        abortClose = closeAfterCancel
      },
      onError: () => {},
      onFinally: () => {},
    })
    runner.requestCloseDuringRun()
    await promise
    expect(abortClose).toBe(true)
  })

  it("ignores rapid rerun while already running", async () => {
    let callCount = 0
    const runner = createEnrichmentRunner(async (request, options) => {
      expect(request.feature.id).toBe("feature-1")
      options.onProgress({ depthUsed: 1, queryTrace: ["q"] })
      callCount += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return {
        response: {
          status: "failed",
          featureId: "feature-1",
          depthUsed: 1,
          proposals: [],
          unresolvedFields: [],
          unresolvedReasons: {},
          notes: "",
          queryTrace: [],
          processingTimeMs: 1,
        },
        usage: {
          providerCalls: {},
          estimatedInputTokens: 0,
          estimatedOutputTokens: 0,
        },
      }
    })

    const callbacks = {
      onProgress: () => {},
      onSuccess: () => {},
      onAbort: () => {},
      onError: () => {},
      onFinally: () => {},
    }
    const first = runner.run(makeRequest(), callbacks)
    const second = runner.run(makeRequest(), callbacks)
    await Promise.all([first, second])
    expect(callCount).toBe(1)
  })
})

