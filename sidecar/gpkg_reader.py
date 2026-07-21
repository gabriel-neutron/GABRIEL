"""
Read-only `.gpkg` loader for OOB entity names (Phase 7). A GeoPackage is plain SQLite,
so this only needs the stdlib `sqlite3` module — no `@ngageoint/geopackage` JS library
involved, matching the PRD's constraint that the sidecar never writes to the `.gpkg`
(this module doesn't even open it for write).

Column names (`id`, `name`) are read from `src/core/persistence/geopackage/units.table.ts`'s
`UNITS_TABLE`/`unitColumns` — the actual TypeScript schema the browser writes, not a
guess. Validated 2026-07-20 against the repo's own bundled demo file
(`public/project.gpkg`), which is real, non-synthetic project data.
"""

import sqlite3
from pathlib import Path

UNITS_TABLE = "units"


def read_oob_entity_names(gpkg_path: str | Path) -> dict[str, str]:
    """Returns {entity_id: name} for every row in the `units` table. Opened read-only
    via a `file:` URI (`mode=ro`) so this can never accidentally write to a project file
    even on a bug — belt-and-suspenders on top of just not calling any write method."""
    uri = f"file:{Path(gpkg_path).as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        rows = conn.execute(f"SELECT id, name FROM {UNITS_TABLE}").fetchall()
    finally:
        conn.close()
    return {row[0]: row[1] for row in rows}
