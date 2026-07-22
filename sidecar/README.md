# Gabriel Telegram Sidecar

Python/FastAPI sidecar that owns all Telegram interaction and the `project.tgdb` SQLite
file. See `docs/TELEGRAM_OSINT_PRD.md` for the full architecture and
`docs/timelines/TELEGRAM_TIMELINE.md` for phased scope. The React app never talks to
Telegram or SQLite directly — only to this sidecar's REST API on `localhost:8000`.

## Setup

```
cd sidecar
python -m venv .venv
.venv\Scripts\activate          # Windows; `source .venv/bin/activate` elsewhere
pip install -r requirements.txt
copy .env.example .env          # then fill in credentials below
```

### Credentials

1. **`TG_API_ID` / `TG_API_HASH`** — from https://my.telegram.org, using a **dedicated,
   expendable Telegram account** — never your personal number. See
   [Account Safety](../docs/TELEGRAM_OSINT_PRD.md#account-safety) before doing anything
   else with this account: physical SIM preferred, warm it up over weeks before any bulk
   collection, and never pair member enumeration with adds/invites.
2. First connection is interactive (phone number + login code) and must be done once via
   a validation script (`python validation/01_telethon_connectivity.py <channel>`) —
   `sidecar/main.py` itself never prompts for login, so it can run as a headless server.
   This writes a `collector_session.session` file next to this README — **never commit
   it** (already gitignored).
3. **`OPENAI_API_KEY`** — for relevance classification and entity extraction
   (`gpt-4o-mini`).
4. `.env` and `*.session` are gitignored at the repo root. Double-check before any commit
   that touches `sidecar/` — `git status` should never show either.

## Run

With the `sidecar/.venv` activated (so `uvicorn` resolves from it), from the **repo
root**:

```
npm run sidecar
```

This runs `uvicorn sidecar.main:app --reload --port 8000` — module path
`sidecar.main:app`, not `main:app` from inside `sidecar/`, because `main.py` imports
`from sidecar import db, telegram_client` as a package-relative import.

## Health check

```
curl http://localhost:8000/health
```

```json
{ "status": "ok", "version": "0.1.0", "telegram": "connected" }
```

`telegram: "not_connected"` is expected and not an error before you've run the
interactive login step above, or if `TG_API_ID`/`TG_API_HASH` are unset — the sidecar
still starts and serves `/health` either way, since it's the first thing the React
header status dot polls.

## Tests

```
pip install -r requirements-dev.txt
pytest
```

Unit tests run against `FakeChannelSource`/temp SQLite files — no live Telegram
credentials or network needed.

## Current scope (Phase 2)

Only `/health`, schema init, and Telethon session connect/disconnect exist so far.
Collection (`POST /seed/import`, `POST /collect/{channel_id}`, …) lands in Phase 3; see
`docs/timelines/TELEGRAM_TIMELINE.md` for the full phase breakdown. Do not build ahead
of the current phase — each phase has its own exit criteria.

## Read-only collection — hard boundary

This sidecar must never add, invite, or message any Telegram user, and must never write
to the `.gpkg` (only the browser does, via `geopackage.service.ts`, after analyst
confirmation — see the PRD's OOB Linkage Flow). If you're adding a new sidecar endpoint,
confirm it doesn't cross either boundary before merging.
