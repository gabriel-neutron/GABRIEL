import type {
  EnrichmentRequest,
  EnrichmentResponse,
  EnrichmentUsage,
} from "@/types/enrichment.types"

export type RunEnrichmentFn = (
  request: EnrichmentRequest,
  options: {
    signal: AbortSignal
    onProgress: (progress: { depthUsed: number; queryTrace: string[] }) => void
  },
) => Promise<{ response: EnrichmentResponse; usage: EnrichmentUsage }>

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  )
}

type RunnerCallbacks = {
  onProgress: (progress: { depthUsed: number; queryTrace: string[] }) => void
  onSuccess: (response: EnrichmentResponse, usage: EnrichmentUsage) => void
  onAbort: (closeAfterCancel: boolean) => void
  onError: (message: string) => void
  onFinally: () => void
}

export function createEnrichmentRunner(runEnrichmentFn: RunEnrichmentFn) {
  let currentAbort: AbortController | null = null
  let closeAfterCancel = false

  return {
    isRunning(): boolean {
      return currentAbort != null
    },
    requestCloseDuringRun(): void {
      closeAfterCancel = true
      currentAbort?.abort()
    },
    cancelNow(): void {
      closeAfterCancel = false
      currentAbort?.abort()
    },
    async run(request: EnrichmentRequest, callbacks: RunnerCallbacks): Promise<void> {
      if (currentAbort != null) return
      closeAfterCancel = false
      const abortController = new AbortController()
      currentAbort = abortController
      try {
        const result = await runEnrichmentFn(request, {
          signal: abortController.signal,
          onProgress: callbacks.onProgress,
        })
        callbacks.onSuccess(result.response, result.usage)
      } catch (error) {
        if (isAbortError(error)) {
          callbacks.onAbort(closeAfterCancel)
          return
        }
        const message = error instanceof Error ? error.message : "Unknown enrichment failure"
        callbacks.onError(message)
      } finally {
        currentAbort = null
        closeAfterCancel = false
        callbacks.onFinally()
      }
    },
  }
}

