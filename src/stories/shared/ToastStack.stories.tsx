import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/ui/button"
import { ToastStack, type ToastItem } from "@/components/shared/ToastStack"

const meta = {
  title: "Shared/ToastStack",
  component: ToastStack,
  render: () => {
    const [items, setItems] = useState<ToastItem[]>([
      {
        id: "1",
        title: "Example warning",
        description: "This is what a toast message looks like in the app.",
      },
    ])

    return (
      <div className="p-4">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setItems((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                title: "Another toast",
                description: "Dismiss me or wait for auto-hide.",
              },
            ])
          }
        >
          Add toast
        </Button>
        <ToastStack items={items} onDismiss={(id) => setItems((current) => current.filter((t) => t.id !== id))} />
      </div>
    )
  },
} satisfies Meta<typeof ToastStack>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: [],
    onDismiss: () => undefined,
  },
}

