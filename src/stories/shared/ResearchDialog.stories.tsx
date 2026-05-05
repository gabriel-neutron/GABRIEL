import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ResearchDialog } from "@/components/shared/ResearchDialog"

const meta = {
  title: "Shared/ResearchDialog",
  component: ResearchDialog,
  render: () => {
    const [open, setOpen] = useState(true)
    const [batchSize, setBatchSize] = useState(10)
    const [richnessThreshold, setRichnessThreshold] = useState(4)
    const [skipAnalyzedWithinDays, setSkipAnalyzedWithinDays] = useState(7)

    return (
      <div className="p-4">
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
          Open
        </Button>
        <ResearchDialog
          open={open}
          onClose={() => setOpen(false)}
          entities={[]}
          entityStatuses={{}}
          totalUsage={{ inputTokens: 0, outputTokens: 0 }}
          cacheAdditions={[]}
          lastStats={null}
          runStatus="idle"
          progress={null}
          reviewQueueLength={0}
          batchSize={batchSize}
          setBatchSize={setBatchSize}
          richnessThreshold={richnessThreshold}
          setRichnessThreshold={setRichnessThreshold}
          skipAnalyzedWithinDays={skipAnalyzedWithinDays}
          setSkipAnalyzedWithinDays={setSkipAnalyzedWithinDays}
          hasProcessedEntities={false}
          onRun={() => undefined}
          onCancel={() => undefined}
          onReviewNext={() => undefined}
        />
      </div>
    )
  },
} satisfies Meta<typeof ResearchDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    open: true,
    onClose: () => undefined,
    entities: [],
    entityStatuses: {},
    totalUsage: { inputTokens: 0, outputTokens: 0 },
    cacheAdditions: [],
    lastStats: null,
    runStatus: "idle",
    progress: null,
    reviewQueueLength: 0,
    batchSize: 10,
    setBatchSize: () => undefined,
    richnessThreshold: 4,
    setRichnessThreshold: () => undefined,
    skipAnalyzedWithinDays: 7,
    setSkipAnalyzedWithinDays: () => undefined,
    hasProcessedEntities: false,
    onRun: () => undefined,
    onCancel: () => undefined,
    onReviewNext: () => undefined,
  },
}

