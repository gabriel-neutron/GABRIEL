import { create } from "zustand"
import { devtools } from "zustand/middleware"

export interface SourceCacheState {
  sourceCache: Map<string, string>
  lastSavedAt: Date | null
}

export interface SourceCacheActions {
  setSourceCache(cache: Map<string, string>): void
  mergeSourceCache(additions: { url: string; content: string }[]): void
  setLastSavedAt(date: Date | null): void
  resetSourceCache(): void
}

function initialState(): SourceCacheState {
  return {
    sourceCache: new Map(),
    lastSavedAt: null,
  }
}

export const useSourceCacheStore = create<SourceCacheState & SourceCacheActions>()(
  devtools(
    (set) => ({
      ...initialState(),

      setSourceCache(cache) {
        set({ sourceCache: cache }, false, "setSourceCache")
      },

      mergeSourceCache(additions) {
        set((s) => {
          const next = new Map(s.sourceCache)
          for (const { url, content } of additions) next.set(url, content)
          return { sourceCache: next }
        }, false, "mergeSourceCache")
      },

      setLastSavedAt(date) {
        set({ lastSavedAt: date }, false, "setLastSavedAt")
      },

      resetSourceCache() {
        set(initialState(), false, "resetSourceCache")
      },
    }),
    { name: "GabrielSourceCacheStore", enabled: import.meta.env.DEV },
  ),
)
