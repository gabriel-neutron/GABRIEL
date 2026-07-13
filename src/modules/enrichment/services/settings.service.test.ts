import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearAiProviderKeys, getAiProviderKeys, saveAiProviderKeys } from "./settings.service"

const STORAGE_KEY = "gabriel.aiProviderKeys.v1"

function installWindowWithStorage(): void {
  const store: Record<string, string> = {}
  const localStorage = {
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null
    },
    setItem(key: string, value: string): void {
      store[key] = String(value)
    },
    removeItem(key: string): void {
      delete store[key]
    },
    clear(): void {
      for (const k of Object.keys(store)) delete store[k]
    },
    get length(): number {
      return Object.keys(store).length
    },
    key(index: number): string | null {
      const keys = Object.keys(store)
      return keys[index] ?? null
    },
  } as Storage

  vi.stubGlobal("window", { localStorage } as Window & typeof globalThis)
}

describe("settings.service — AI provider keys", () => {
  beforeEach(() => {
    installWindowWithStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("persists keys across read (reload simulation)", () => {
    saveAiProviderKeys({ openaiApiKey: "sk-openai-1", tavilyApiKey: "tvly-1" })
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "sk-openai-1", tavilyApiKey: "tvly-1" })
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "sk-openai-1", tavilyApiKey: "tvly-1" })
  })

  it("partial save preserves the other key", () => {
    saveAiProviderKeys({ openaiApiKey: "only-openai", tavilyApiKey: "tav-keep" })
    saveAiProviderKeys({ openaiApiKey: "updated-openai" })
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "updated-openai", tavilyApiKey: "tav-keep" })
  })

  it("trims whitespace on save and read", () => {
    saveAiProviderKeys({ openaiApiKey: "  sk-trim  ", tavilyApiKey: "\ttv\t" })
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "sk-trim", tavilyApiKey: "tv" })
    const raw = window.localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? "{}") as { openaiApiKey?: string; tavilyApiKey?: string }
    expect(parsed.openaiApiKey).toBe("sk-trim")
  })

  it("clearAiProviderKeys removes stored keys", () => {
    saveAiProviderKeys({ openaiApiKey: "x", tavilyApiKey: "y" })
    clearAiProviderKeys()
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "", tavilyApiKey: "" })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it("returns empty keys when stored JSON is invalid", () => {
    window.localStorage.setItem(STORAGE_KEY, "not-json{")
    expect(getAiProviderKeys()).toEqual({ openaiApiKey: "", tavilyApiKey: "" })
  })
})
