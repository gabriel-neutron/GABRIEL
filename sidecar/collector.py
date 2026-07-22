"""
Slice 1 collector (docs/issues/TELEGRAM_PHASE3_ISSUES.md) — fetches one channel through
a `ChannelSource` and persists it. `raw_json` is authoritative; the typed columns
(`title`, `member_count`, ...) are a provisional projection, promoted only once real
collected shapes are confirmed at volume (Phase 5).

Identity contract: `channels.id` IS the Telegram peer ID (see `sidecar/db.py`'s schema
comment). `_upsert_channel` reconciles three cases so a seed and its later-discovered
self never produce duplicate rows:
  1. A row with this real `id` already exists (re-collection) — update it in place.
  2. A `type='seed'` row with this `username` and `id IS NULL` exists — resolve it by
     filling in the real id.
  3. Neither exists — insert a fresh row.
"""

from datetime import datetime, timezone

import aiosqlite

from sidecar.channel_source import ChannelMeta, ChannelSource, MessageRecord
from sidecar.db import DEFAULT_TGDB_PATH


async def collect_channel(
    ref: str,
    source: ChannelSource,
    path=DEFAULT_TGDB_PATH,
    message_limit: int = 100,
) -> dict:
    meta = await source.fetch_channel_metadata(ref)
    messages = await source.fetch_recent_messages(ref, message_limit)

    async with aiosqlite.connect(path) as conn:
        channel_id = await _upsert_channel(conn, meta)
        for message in messages:
            await _upsert_message(conn, channel_id, message)
        await conn.commit()

    return {"channel_id": channel_id, "messages_collected": len(messages)}


async def _upsert_channel(conn: aiosqlite.Connection, meta: ChannelMeta) -> int:
    existing_by_id = await conn.execute_fetchall(
        "SELECT rowid FROM channels WHERE id = ?", (meta.id,)
    )
    if existing_by_id:
        await _update_channel_row(conn, existing_by_id[0][0], meta)
        return meta.id

    existing_seed = []
    if meta.username:
        existing_seed = await conn.execute_fetchall(
            "SELECT rowid FROM channels WHERE username = ? AND id IS NULL", (meta.username,)
        )
    if existing_seed:
        await _update_channel_row(conn, existing_seed[0][0], meta, resolve_id=True)
        return meta.id

    await conn.execute(
        """
        INSERT INTO channels (id, username, title, description, member_count, type,
                               is_private, collected_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            meta.id,
            meta.username,
            meta.title,
            meta.description,
            meta.member_count,
            meta.type,
            int(meta.is_private),
            datetime.now(timezone.utc).isoformat(),
            meta.raw_json,
        ),
    )
    return meta.id


async def _update_channel_row(
    conn: aiosqlite.Connection, rowid: int, meta: ChannelMeta, resolve_id: bool = False
) -> None:
    """Shared by both reconciliation branches of `_upsert_channel` — the only
    difference is whether `id` (still NULL on a seed row) also needs setting."""
    id_assignment = "id = ?, " if resolve_id else ""
    id_param = (meta.id,) if resolve_id else ()
    await conn.execute(
        f"""
        UPDATE channels
        SET {id_assignment}username = ?, title = ?, description = ?, member_count = ?,
            type = ?, is_private = ?, collected_at = ?, raw_json = ?
        WHERE rowid = ?
        """,
        (
            *id_param,
            meta.username,
            meta.title,
            meta.description,
            meta.member_count,
            meta.type,
            int(meta.is_private),
            datetime.now(timezone.utc).isoformat(),
            meta.raw_json,
            rowid,
        ),
    )


async def _upsert_message(conn: aiosqlite.Connection, channel_id: int, message: MessageRecord) -> None:
    """`UNIQUE(channel_id, message_id)` (sidecar/db.py) makes this idempotent —
    re-running `/collect` on the same channel updates existing rows rather than
    duplicating them."""
    await conn.execute(
        """
        INSERT INTO messages (channel_id, message_id, text, date, view_count, raw_json)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(channel_id, message_id) DO UPDATE SET
            text = excluded.text,
            date = excluded.date,
            view_count = excluded.view_count,
            raw_json = excluded.raw_json
        """,
        (channel_id, message.message_id, message.text, message.date, message.view_count, message.raw_json),
    )
