import type { Meta, StoryObj } from "@storybook/react-vite"
import type { RefObject } from "react"
import { useEffect, useRef } from "react"
import { UnifiedSearch, type FlyToFn } from "@/components/shared/UnifiedSearch"
import { useProjectStore } from "@/store/useProjectStore"

const defaultFlyToRef = { current: null } as unknown as RefObject<FlyToFn | null>

const meta = {
  title: "Shared/UnifiedSearch",
  component: UnifiedSearch,
  render: () => {
    useEffect(() => {
      useProjectStore.setState({
        entities: [],
        layers: [],
        entityOsmGeometries: {},
      })
    }, [])

    const flyToRef = useRef<FlyToFn | null>((lat, lng, zoom) => {
      console.log("flyTo", { lat, lng, zoom })
    })

    return (
      <div className="p-4">
        <UnifiedSearch flyToRef={flyToRef} />
      </div>
    )
  },
} satisfies Meta<typeof UnifiedSearch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    flyToRef: defaultFlyToRef,
  },
}

