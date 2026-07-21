# Phase 1 — External Tool Validation

Per `docs/timelines/TELEGRAM_TIMELINE.md` Phase 1: **no production code is built until every
external dependency here is validated empirically.** These scripts are the validation harness.

**These scripts require things an agent cannot provide and must not attempt to fabricate:**
a phone-verified Telegram account (dedicated/expendable per the PRD's
[Account Safety](../../docs/TELEGRAM_OSINT_PRD.md#account-safety) rules) and `api_id`/`api_hash`
from https://my.telegram.org. Run them yourself, by hand, one at a time, and record the results
in `RESULTS.md` (template at the bottom of this file).

## Setup

```
cd sidecar
python -m venv .venv
.venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env      # then fill in TG_API_ID / TG_API_HASH / OPENAI_API_KEY
```

## Order

1. `python validation/01_telethon_connectivity.py` — connects with real credentials against a
   known **public** channel you already have access to. First run prompts for phone/code
   interactively (Telethon handles this) and writes a `.session` file — never commit it.
2. `python validation/02_telethon_metadata.py <channel_username> [...]` — pass 5 public channel
   usernames. Reports entity JSON shape, message field shape, member-list shape, and call counts.
3. `python validation/04_tgspyder_private.py <invite_link_or_channel>` — requires `tgspyder`
   installed (see `sidecar/requirements.txt`) and a private test channel you control.
4. `python validation/05_openai_ner.py samples.jsonl` — needs `OPENAI_API_KEY` in `.env` and a
   JSONL file of `{"text": "..."}` Russian Telegram message samples (50 recommended, sourced
   manually per the PRD — this script does not fabricate them).
5. `python validation/06_sqlite_volume.py` — no credentials needed; generates synthetic data
   locally and measures file size + query time. Safe to run any time.

Sigma.js graph performance (Phase 1's last exit criterion) is a **frontend** prototype, not a
Python script — build it as a throwaway React page per the timeline once these are done; it is
not included here.

## RESULTS.md template

After each run, append to `sidecar/validation/RESULTS.md` (create it, gitignored is not
necessary — it's just data, not credentials):

```markdown
## <tool> — <date>
- What worked / didn't:
- Measured limits:
- Decision for Phase 2+ (swap tool / narrow scope / accept limitation):
```
