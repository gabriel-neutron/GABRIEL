/**
 * One-time migration script for public/project.gpkg.
 *
 * Adds missing columns to layers/units tables, fixes layer_id/echelon
 * mismatches, and adds the position_mode column. Run with:
 *   node scripts/migrate-gpkg.mjs
 */

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const initSqlJs = require("rtree-sql.js/dist/sql-asm.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const ECHELON_IDS = [
  "Army",
  "Army Group/front",
  "Battalion/squadron",
  "Brigade",
  "Command",
  "Company/battery/troop",
  "Corps/MEF",
  "Division",
  "Platoon/detachment",
  "Region/Theater",
  "Regiment/group",
  "Section",
  "Squad",
  "Team/Crew",
];

async function migrate() {
  const SQL = await initSqlJs();
  const gpkgPath = resolve(projectRoot, "public/project.gpkg");
  const buffer = readFileSync(gpkgPath);
  const db = new SQL.Database(buffer);

  const colNames = (table) => {
    const stmt = db.prepare(`PRAGMA table_info(${table})`);
    const names = [];
    while (stmt.step()) names.push(stmt.getAsObject().name);
    stmt.free();
    return names;
  };

  // --- layers table ---
  const layerCols = colNames("layers");
  if (!layerCols.includes("kind"))
    db.run("ALTER TABLE layers ADD COLUMN kind TEXT");
  if (!layerCols.includes("source_query"))
    db.run("ALTER TABLE layers ADD COLUMN source_query TEXT");
  if (!layerCols.includes("geojson"))
    db.run("ALTER TABLE layers ADD COLUMN geojson TEXT");

  const echelonSet = new Set(ECHELON_IDS);
  const layerStmt = db.prepare("SELECT id, kind FROM layers");
  const layerUpdates = [];
  while (layerStmt.step()) {
    const row = layerStmt.getAsObject();
    layerUpdates.push(row);
  }
  layerStmt.free();

  for (const row of layerUpdates) {
    if (echelonSet.has(row.id)) {
      db.run("UPDATE layers SET kind = 'echelon' WHERE id = ?", [row.id]);
    } else if (!row.kind || row.kind === "") {
      db.run("UPDATE layers SET kind = 'custom' WHERE id = ?", [row.id]);
    }
  }

  // --- units table ---
  const unitCols = colNames("units");
  if (!unitCols.includes("osm_relation_id"))
    db.run("ALTER TABLE units ADD COLUMN osm_relation_id INTEGER");
  if (!unitCols.includes("military_unit_id"))
    db.run("ALTER TABLE units ADD COLUMN military_unit_id TEXT");
  if (!unitCols.includes("notes"))
    db.run("ALTER TABLE units ADD COLUMN notes TEXT");
  if (!unitCols.includes("sources"))
    db.run("ALTER TABLE units ADD COLUMN sources TEXT");
  if (!unitCols.includes("position_mode"))
    db.run("ALTER TABLE units ADD COLUMN position_mode TEXT DEFAULT 'own'");

  for (const eid of ECHELON_IDS) {
    db.run(
      "UPDATE units SET layer_id = echelon WHERE echelon = ? AND layer_id != echelon AND echelon IS NOT NULL",
      [eid],
    );
  }

  db.run("UPDATE units SET position_mode = 'own' WHERE position_mode IS NULL");

  // --- export ---
  const exported = db.export();
  db.close();
  writeFileSync(gpkgPath, Buffer.from(exported));
  console.log("Migration complete:", gpkgPath);

  // --- verify ---
  const verifyDb = new SQL.Database(readFileSync(gpkgPath));
  console.log("layers columns:", colNames("layers").join(", "));

  const uStmt = verifyDb.prepare("PRAGMA table_info(units)");
  const uCols = [];
  while (uStmt.step()) uCols.push(uStmt.getAsObject().name);
  uStmt.free();
  console.log("units columns:", uCols.join(", "));

  const sStmt = verifyDb.prepare(
    "SELECT id, layer_id, echelon, position_mode FROM units LIMIT 5",
  );
  while (sStmt.step()) console.log("  unit:", sStmt.getAsObject());
  sStmt.free();
  verifyDb.close();
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
