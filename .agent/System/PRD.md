# PRD — Local Military Mapping Tool (QGIS Simplified)

---

## 1. Overview

A local-first web application built with React designed to simplify military geospatial annotation workflows.

The application allows a single user to:

* Load and manage geospatial layers (GeoPackage, GeoJSON, OSM)
* Display a persistent OSM military layer (landuse=military in Russia)
* Create military units as structured hierarchical entities
* Link units to existing OSM polygons (via OSM ID)
* Generate MIL-STD-2525 NATO-style symbols automatically
* Visualize the command structure as a read-only tree
* Export and save the entire project as a GeoPackage

The tool is intended to replace QGIS for focused military annotation tasks.

---

## 2. Context (Users and Use Cases)

### Primary User

Single analyst (local use only).

### Problem

* QGIS is overly complex and unstable for focused military mapping.
* Need faster annotation workflow.
* Need structured military hierarchy + geographic linking.
* Need NATO-style visual clarity.

---

## 3. Core Use Cases

### UC1 — Open Project

* User loads a GeoPackage file.
* App initializes:

  * Base map (OSM)
  * Project layers
  * Units hierarchy
  * Geometry associations

---

### UC2 — Display Persistent OSM Military Layer

System automatically loads OSM data for:

* `landuse=military`
* Within Russia boundary

Layer characteristics:

* Read-only
* Toggle visibility
* Styled differently from user layers
* Contains OSM IDs

This layer is not saved in the project file (external reference).

---

### UC3 — Import Layer

User can import:

* GeoPackage
* GeoJSON

Each import:

* Creates a new layer
* Is stored inside master GeoPackage
* Can be toggled on/off

---

### UC4 — Create Military Unit

User creates a Unit with:

* Name
* Type (infantry, armored, artillery, air defense, etc.)
* Parent unit (optional)

System generates:

* Unique ID
* MIL-STD-2525 symbol (or fallback icon)

Unit can exist without geometry.

---

### UC5 — Create Geometry

User can create:

* Point
* Polygon
* Line

Geometries can be:

* Drawn manually
* Imported
* Linked to OSM polygon

---

### UC6 — Link Unit to Existing OSM Polygon

Workflow:

1. User creates a unit (point representation).
2. User selects an OSM military polygon.
3. User clicks “Link to Unit”.
4. System stores:

   * OSM ID
   * Reference to unit ID
   * Optionally cache geometry in GeoPackage

No duplication of polygon geometry unless explicitly requested.

---

### UC7 — Link Unit to Multiple Geometries

* A unit may link to:

  * Multiple polygons
  * Multiple points
  * Lines
* Geometry table stores foreign key to unit.

---

### UC8 — Automatic NATO Symbol Generation

System generates symbols based on:

* Affiliation (default: hostile)
* Unit type
* Echelon level (derived from hierarchy depth if defined)

Preferred:

* MIL-STD-2525 compliant library

Fallback:

* SVG-based simplified symbol system

Symbols:

* Scale with zoom
* Render on unit point location

---

### UC9 — View Hierarchical Tree

Second screen:

* Read-only hierarchical tree (React Flow or similar)
* Displays unit structure
* Clicking node:

  * Switches to map view
  * Zooms to linked geometry

Tree cannot edit hierarchy.

---

### UC10 — Undo / Redo

Undo/redo stack for:

* Create/delete unit
* Create/delete geometry
* Linking/unlinking
* Attribute edits

---

### UC11 — Export Project

User can export to:

* GeoPackage (master format)
* GeoJSON (optional per layer)

---

## 4. Data Architecture

### Master Format: GeoPackage

GeoPackage contains:

### Table: `units`

| Field              | Type            |
| ------------------ | --------------- |
| id                 | TEXT (UUID)     |
| name               | TEXT            |
| layer_id           | TEXT            |
| parent_id          | TEXT (nullable) |
| type               | TEXT            |
| nato_symbol_code   | TEXT            |
| echelon            | TEXT            |
| affiliation        | TEXT            |
| domain             | TEXT            |
| osm_relation_id    | INTEGER (nullable) |
| military_unit_id   | TEXT (nullable) |
| notes              | TEXT (nullable) |

---

### Table: `geometries`

| Field      | Type     |
| ---------- | -------- |
| id         | TEXT     |
| layer_id   | TEXT     |
| entity_id  | TEXT (nullable) |
| type       | TEXT (point/line/polygon) |
| geometry   | GEOMETRY |

---

### Table: `layers`

| Field         | Type    |
| ------------- | ------- |
| id            | TEXT    |
| name          | TEXT    |
| visible       | INTEGER (0/1) |
| expanded      | INTEGER (0/1) |
| kind          | TEXT (echelon/custom/osm) |
| source_query  | TEXT (nullable) |
| geojson       | TEXT (nullable) |

---

### OSM Layer

* Not stored as master dataset
* Can cache selected geometries if needed
* Always refreshable

---

## 5. Tech Stack

### Frontend

* React
* shadcn UI
* Leaflet
* React-Leaflet
* React Flow (tree view)

### GIS Handling

* leaflet-draw
* @turf/turf (light spatial ops)
* sql.js or WASM SQLite for GeoPackage handling

### Symbol Library

* Preferred: MIL-STD-2525 JS library
* Fallback: Custom SVG generator

---

## 6. Architecture

```
UI Layer
 ├── Map View
 │     ├── Base OSM
 │     ├── OSM Military Layer
 │     ├── User Layers
 │     └── Symbol Renderer
 │
 ├── Tree View (Read-only)
 │
 └── Project Manager
       ├── GeoPackage Loader
       ├── State Manager
       └── Undo/Redo Stack
```

State management:

* Centralized store (Zustand or similar)
* Sync map and tree

---

## 7. Boundaries

### ✅ Always

* Fully local
* File-based persistence
* No authentication
* No server

### ⚠️ Ask First (Future Scope)

* Timeline tracking
* Multi-user support
* Performance optimization
* Offline OSM replication

### 🚫 Never

* Full QGIS feature parity
* Raster processing
* Advanced spatial analysis
* WMS/WFS complexity

---

## 8. Non-Goals

* No database server
* No collaboration
* No performance optimization
* No historical versioning
* No battlefield simulation

---

## 9. UX Principles

* Minimal toolbar
* Clear layer toggles
* Single-purpose actions
* No hidden GIS terminology
* Direct linking workflow
