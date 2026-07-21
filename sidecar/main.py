"""FastAPI sidecar entrypoint. Run via `npm run sidecar` (uvicorn sidecar.main:app --reload)."""

import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite
from dotenv import load_dotenv
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from sidecar import db, export, gpkg_reader, graph, oob_matcher, oob_proposals, seed, telegram_client
from sidecar.logging_config import logger

# Explicit path — bare load_dotenv() searches upward from cwd and can pick up an
# unrelated .env at the repo root (e.g. the Vite app's own env file) instead of
# sidecar/.env.
load_dotenv(Path(__file__).parent / ".env")

SIDECAR_VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.init_db()
    await telegram_client.connect()
    yield
    await telegram_client.disconnect()


app = FastAPI(title="Gabriel Telegram Sidecar", version=SIDECAR_VERSION, lifespan=lifespan)

# Any localhost/127.0.0.1 port — this sidecar is localhost-only, never exposed
# externally. A fixed 5173 allowlist breaks the moment that port is already taken by
# another project and Vite falls back to 5174+ (observed live 2026-07-20), so match by
# regex instead of pinning one port.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Every unhandled error returns structured JSON with a request id, never a bare
    500/stack trace to the browser. Only logs the exception type/message and path — not
    the request body, which could carry credentials in a future auth-related endpoint."""
    request_id = str(uuid.uuid4())
    logger.error(
        "request_id=%s path=%s error=%s: %s",
        request_id,
        request.url.path,
        type(exc).__name__,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "request_id": request_id,
            "message": "An unexpected error occurred. See sidecar/sidecar.log for details.",
        },
    )


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": SIDECAR_VERSION,
        "telegram": "connected" if telegram_client.is_connected() else "not_connected",
    }


class SeedImportRequest(BaseModel):
    csv_text: str | None = None
    usernames: list[str] | None = None


@app.post("/seed/import")
async def seed_import(body: SeedImportRequest) -> dict:
    """FR-1. Only writes `channels` rows with `type='seed'` — never calls Telegram, so
    this works with no live connection (see sidecar/seed.py for why `type` stands in
    for the PRD's undefined `status` column)."""
    usernames = list(body.usernames or [])
    if body.csv_text:
        usernames += seed.parse_seed_csv(body.csv_text)
    inserted_ids = await seed.import_seeds(usernames)
    return {"requested": len(usernames), "inserted": len(inserted_ids), "ids": inserted_ids}


@app.get("/channels")
async def list_channels() -> dict:
    async with aiosqlite.connect(db.DEFAULT_TGDB_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall(
            "SELECT id, username, title, type, relevance_score, member_count FROM channels"
        )
    return {"channels": [dict(row) for row in rows]}


@app.get("/graph")
async def get_graph() -> dict:
    """FR-7. Pure SQL over already-imported/collected channels — safe against an
    empty or seed-only graph, no Telegram dependency."""
    return await graph.get_graph()


@app.get("/search")
async def search_graph(q: str) -> dict:
    return {"results": await graph.search(q)}


class OobMatchRequest(BaseModel):
    channel_name: str
    oob_entity_names: dict[str, str]


@app.post("/oob/candidates")
async def oob_candidates(body: OobMatchRequest) -> dict:
    """Preview endpoint: runs the matcher without persisting anything."""
    return {"candidates": oob_matcher.find_match_candidates(body.channel_name, body.oob_entity_names)}


class OobProposeRequest(BaseModel):
    channel_id: int
    channel_name: str
    oob_entity_names: dict[str, str]


@app.post("/oob/propose")
async def oob_propose(body: OobProposeRequest) -> dict:
    """Persists match candidates as pending `oob_proposals`. `oob_entity_names` is
    supplied by the caller rather than read from a real `.gpkg` — `gpkg_reader.py`
    (Phase 7) isn't built yet, since designing its field-name assumptions without a real
    `.gpkg` to validate against would be an unvalidated assumption in its own right.
    Until it exists, the analyst (or a future OOB-aware caller) provides candidate
    entity names directly."""
    inserted_ids = await oob_proposals.create_proposals_for_channel(
        body.channel_id, body.channel_name, body.oob_entity_names
    )
    return {"inserted": len(inserted_ids), "ids": inserted_ids}


@app.get("/oob/proposals")
async def oob_list_proposals() -> dict:
    return {"proposals": await oob_proposals.list_pending()}


class OobProposeFromGpkgRequest(BaseModel):
    channel_id: int
    channel_name: str
    gpkg_path: str


@app.post("/oob/propose-from-gpkg")
async def oob_propose_from_gpkg(body: OobProposeFromGpkgRequest) -> dict:
    """Same as /oob/propose, but reads real OOB entity names from an actual `.gpkg`
    file (read-only, `sidecar/gpkg_reader.py`) instead of requiring the caller to supply
    them. Validated against the repo's own bundled `public/project.gpkg` (1,010 real
    units) — see sidecar/validation/RESULTS.md."""
    entity_names = gpkg_reader.read_oob_entity_names(body.gpkg_path)
    inserted_ids = await oob_proposals.create_proposals_for_channel(
        body.channel_id, body.channel_name, entity_names
    )
    return {"inserted": len(inserted_ids), "ids": inserted_ids, "oob_entities_loaded": len(entity_names)}


@app.post("/oob/accept/{proposal_id}", response_model=None)
async def oob_accept(proposal_id: int) -> Response | dict:
    """Returns {oob_entity_id, channel_url} — React writes the URL into the .gpkg via
    geopackage.service.ts. This sidecar never touches the .gpkg (PRD's OOB Linkage Flow)."""
    result = await oob_proposals.decide(proposal_id, "accepted")
    if result is None:
        return Response(status_code=404, content="Proposal not found or already decided")
    return result


@app.post("/oob/reject/{proposal_id}", response_model=None)
async def oob_reject(proposal_id: int) -> Response | dict:
    result = await oob_proposals.decide(proposal_id, "rejected")
    if result is None:
        return Response(status_code=404, content="Proposal not found or already decided")
    return {"status": "rejected"}


@app.get("/export/graphml")
async def export_graphml() -> Response:
    xml = await export.export_graphml()
    return Response(content=xml, media_type="application/xml")


@app.get("/export/neo4j")
async def export_neo4j() -> Response:
    cypher = await export.export_neo4j_cypher()
    return Response(content=cypher, media_type="text/plain")
