from pathlib import Path

import aiosqlite
import pytest

from sidecar import db, seed


@pytest.mark.asyncio
async def test_import_seeds_leaves_id_null(tmp_path: Path):
    path = tmp_path / "test.tgdb"
    await db.init_db(path)

    inserted = await seed.import_seeds(["chan_a"], path=path)

    assert inserted == ["chan_a"]
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        rows = await conn.execute_fetchall("SELECT * FROM channels WHERE username = 'chan_a'")
    assert rows[0]["id"] is None
    assert rows[0]["type"] == "seed"


@pytest.mark.asyncio
async def test_import_seeds_skips_existing_username(tmp_path: Path):
    path = tmp_path / "test.tgdb"
    await db.init_db(path)

    await seed.import_seeds(["chan_a"], path=path)
    second = await seed.import_seeds(["chan_a", "chan_b"], path=path)

    assert second == ["chan_b"]
