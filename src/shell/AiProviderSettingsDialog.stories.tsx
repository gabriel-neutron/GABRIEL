import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/ui/button"
import { AiProviderSettingsDialog } from "./AiProviderSettingsDialog"

const meta = {
  title: "Shared/AiProviderSettingsDialog",
  component: AiProviderSettingsDialog,
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <div className="p-4">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Open
        </Button>
        <AiProviderSettingsDialog open={open} onClose={() => setOpen(false)} />
      </div>
    )
  },
} satisfies Meta<typeof AiProviderSettingsDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
  },
}

