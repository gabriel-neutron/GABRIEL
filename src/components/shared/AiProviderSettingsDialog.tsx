import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  clearAiProviderKeys,
  getAiProviderKeys,
  saveAiProviderKeys,
  type AiProviderKeys,
} from "@/services/enrichment/settings.service"

type Props = {
  open: boolean
  onClose: () => void
}

export function AiProviderSettingsDialog({ open, onClose }: Props) {
  const [draft, setDraft] = useState<AiProviderKeys>({
    openaiApiKey: "",
    tavilyApiKey: "",
  })
  const [savedMessage, setSavedMessage] = useState("")

  useEffect(() => {
    if (!open) return
    setDraft(getAiProviderKeys())
    setSavedMessage("")
  }, [open])

  if (!open) return null

  function handleSave() {
    saveAiProviderKeys(draft)
    setSavedMessage("Saved locally in this browser.")
  }

  function handleClear() {
    clearAiProviderKeys()
    setDraft({
      openaiApiKey: "",
      tavilyApiKey: "",
    })
    setSavedMessage("Cleared local keys.")
  }

  return (
    <div
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-settings-title"
    >
      <Card className="w-full max-w-lg border bg-card shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle id="ai-settings-title">AI Provider Keys</CardTitle>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="openai-key">
              OpenAI API Key
            </label>
            <Input
              id="openai-key"
              type="password"
              value={draft.openaiApiKey}
              onChange={(event) =>
                setDraft((current) => ({ ...current, openaiApiKey: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="tavily-key">
              Tavily API Key
            </label>
            <Input
              id="tavily-key"
              type="password"
              value={draft.tavilyApiKey}
              onChange={(event) =>
                setDraft((current) => ({ ...current, tavilyApiKey: event.target.value }))
              }
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSave}>
              Save locally
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleClear}>
              Clear keys
            </Button>
            {savedMessage !== "" && <span className="text-xs text-muted-foreground">{savedMessage}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

