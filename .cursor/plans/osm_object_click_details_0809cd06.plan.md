---
name: OSM Object Click Details
overview: Add click functionality to OSM layer features on the map to display detailed information (id, type, version, changeset, tags, etc.) in a details panel, similar to how the OSM website displays object information.
todos: []
isProject: false
---

# OSM Object Click Details Implementation

## Overview

Enable clicking on OSM features from Overpass query layers to display detailed information in the right panel, similar to the OSM website. The panel will toggle between entity inspector and OSM object details based on selection.

## Architecture

### Data Flow

```
Map Click → GeoJSON Feature Detection → Extract OSM ID/Type → Fetch Full Details → Display in Panel
```

### Components

1. **Service Layer** (`src/services/overpass.service.ts`)
  - Add `fetchOsmObjectDetails(type, id)` function
  - Uses Overpass API with `out meta` to get version, changeset, timestamp, user
  - Returns structured OSM object data with all metadata
2. **Map Component** (`src/components/map/MapView.tsx`)
  - Add click handlers to GeoJSON layers
  - Extract OSM feature properties (type, id) from clicked feature
  - Call callback to select OSM object
  - Only handle clicks when mapTool is "pan" (not during drawing)
3. **Details Component** (`src/components/inspector/OsmObjectInspector.tsx`)
  - New component similar to EntityInspector
  - Displays: type, id, version, changeset, timestamp, user, all tags
  - Format similar to OSM website (as shown in image)
  - Includes link to OSM website for the object
4. **App State** (`src/App.tsx`)
  - Add `selectedOsmObject` state: `{ type: "node" | "way" | "relation", id: number } | null`
  - Add handler to fetch and display OSM object details
  - Modify rightSlot to conditionally render EntityInspector or OsmObjectInspector
  - Clear OSM selection when entity is selected (and vice versa)
5. **AppShell** (`src/components/shared/AppShell.tsx`)
  - Update `rightPanelOpen` logic to check both `selectedEntityId` and `selectedOsmObject`
  - Update `onCloseDetail` to clear both selections

## Implementation Details

### 1. Overpass Service Enhancement

Add function to fetch full OSM object metadata:

```typescript
export type OsmObjectDetails = {
  type: "node" | "way" | "relation"
  id: number
  version: number
  changeset: number
  timestamp: string
  user: string
  tags: Record<string, string>
}

export async function fetchOsmObjectDetails(
  type: "node" | "way" | "relation",
  id: number
): Promise<OsmObjectDetails>
```

Query format: `[out:json];${type}(${id});out meta;`

### 2. GeoJSON Click Handling

In MapView, wrap GeoJSON components with event handlers:

- Use `eventHandlers={{ click: handleGeoJsonClick }}` prop
- Extract feature properties: `feature.properties.type`, `feature.properties.id`
- Check if properties contain OSM data (has `@type` or `type` property)
- Only process clicks when `mapTool === "pan"`

### 3. OSM Object Inspector Component

Structure:

- Header: Type and ID (e.g., "Relation: Western Military District (3564026)")
- Metadata section: Version, changeset, timestamp, user
- Tags section: Table of all key-value pairs
- External link: Button to open on OSM website

### 4. State Management

- `selectedOsmObject`: `{ type, id } | null` in App.tsx
- When OSM object selected: clear `selectedEntityId`
- When entity selected: clear `selectedOsmObject`
- Fetch details on selection change (useEffect with loading state)

## Files to Modify

1. `src/services/overpass.service.ts` - Add `fetchOsmObjectDetails` function
2. `src/components/map/MapView.tsx` - Add click handlers to GeoJSON layers
3. `src/components/inspector/OsmObjectInspector.tsx` - New component (create)
4. `src/App.tsx` - Add state and conditional rendering
5. `src/components/shared/AppShell.tsx` - Update panel visibility logic

## Edge Cases

- Handle clicks on features without OSM metadata (skip)
- Handle API errors gracefully (show error message)
- Loading state while fetching details
- Handle multiple features at same point (show first/nearest)
- Prevent clicks during drawing mode

