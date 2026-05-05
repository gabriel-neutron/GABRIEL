import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { AboutDialog } from "@/components/shared/AboutDialog"

const meta = {
  title: "Shared/AboutDialog",
  component: AboutDialog,
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <div className="p-4">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Open
        </Button>
        <AboutDialog open={open} onClose={() => setOpen(false)} />
      </div>
    )
  },
} satisfies Meta<typeof AboutDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
  },
}

