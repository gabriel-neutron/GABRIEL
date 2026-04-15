export type AiProviderKeys = {
  openaiApiKey: string
  tavilyApiKey: string
}

const STORAGE_KEY = "gabriel.aiProviderKeys.v1"

const EMPTY_KEYS: AiProviderKeys = {
  openaiApiKey: "",
  tavilyApiKey: "",
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function normalizeKeys(raw: Partial<AiProviderKeys> | null | undefined): AiProviderKeys {
  return {
    openaiApiKey: typeof raw?.openaiApiKey === "string" ? raw.openaiApiKey.trim() : "",
    tavilyApiKey: typeof raw?.tavilyApiKey === "string" ? raw.tavilyApiKey.trim() : "",
  }
}

export function getAiProviderKeys(): AiProviderKeys {
  if (!canUseLocalStorage()) return EMPTY_KEYS
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === null) return EMPTY_KEYS
    return normalizeKeys(JSON.parse(value) as Partial<AiProviderKeys>)
  } catch {
    return EMPTY_KEYS
  }
}

export function saveAiProviderKeys(keys: Partial<AiProviderKeys>): AiProviderKeys {
  const next = normalizeKeys({
    ...getAiProviderKeys(),
    ...keys,
  })
  if (canUseLocalStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  return next
}

export function clearAiProviderKeys(): void {
  if (!canUseLocalStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

