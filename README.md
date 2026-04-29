# Gabriel - Local ORBAT Mapping Workstation

![Gabriel icon](public/image.png)

Gabriel is a local-first web app to build, inspect, and maintain military map projects from a structured Order of Battle (ORBAT) point of view.

Made  with 🍷, 🥖 and 🧀 in France.

The current project context is a **Russian ORBAT research workflow**: identify units, place geometries, connect open-source evidence, and keep a coherent operational picture over time.  
The software is still generic: you can use the same workflow for any country, coalition, or historical theater.

## Project Goal

Turn fragmented military information into one clean, reusable project file:

- entities (units) with hierarchy and metadata,
- map geometries (points, lines, polygons),
- layers (custom, echelon, OSM overlay),
- optional enrichment suggestions before human validation.

Everything is designed around one principle: **your GeoPackage is the source of truth**.

## Site Access

Gabriel runs locally in the browser.

```bash
npm install
npm run dev
```

Then open the URL shown by Vite (usually `http://localhost:5173`).

Public deployed version: [https://gabriel0x0.netlify.app/](https://gabriel0x0.netlify.app/).

## What You Can Do

- Create and edit ORBAT-oriented map projects.
- Draw and link geometries to entities.
- Use MIL-STD-2525 symbols for military visualization.
- Link entities to OSM relations and open-source context.
- Save/load projects as `.gpkg` (portable GeoPackage files).

## Current Project Scale (`public/project.gpkg`)

Snapshot of the bundled reference dataset:

- `1010` units/entities
- `15` layers
- `286` geometries
- `148` units linked to an OSM relation
- `999` units attached to a parent (hierarchical ORBAT structure)
- `5` research source records

## AI Enrichment (Optional)

Enrichment is assistive. It proposes, you decide.

1. Open `AI keys` in the top bar.
2. Add:
   - OpenAI API key
   - Tavily API key

Accepted proposals affect the current session state, and become authoritative only through the normal save flow.

## CI / Pipeline

The repository includes a GitHub Actions pipeline in `.github/workflows/ci.yml`.

On pushes and pull requests to `main` / `master`, it runs:

- `npm ci`
- `npm run verify`
- coverage artifact upload


## Contributing

- Keep changes simple and focused.
- Run `npm run verify` before opening a PR.
- Update docs when behavior or architecture changes.

## License

There is currently **no explicit `LICENSE` file** in this repository.

If you plan to distribute or reuse Gabriel publicly, add a license first (for example MIT or Apache-2.0).

## Technical Documentation

For architecture and implementation details:

- `docs/ARCHITECTURE.md`
- `docs/CONSTRAINTS.md`
- `docs/TIMELINE.md`
- `AGENTS.md`
