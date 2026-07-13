import { useEffect, useState } from "react"
import { Button } from "@/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Input } from "@/ui/input"
import {
  clearAiProviderKeys,
  getAiProviderKeys,
  saveAiProviderKeys,
  type AiProviderKeys,
} from "@/modules/enrichment/services/settings.service"

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
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="z-[11000] max-w-lg" showCloseButton>
        <DialogHeader className="text-left">
          <DialogTitle id="ai-settings-title" className="text-base font-semibold">
            AI Provider Keys
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

