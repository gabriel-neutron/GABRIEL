"""
`graph.get_graph` tests — against a real temp SQLite file driven through the real write
paths (`collector.collect_channel` + `expander.expand_channel`), never synthetic `edges`
rows inserted by hand, so what's asserted is the shape the crawl actually produces.
"""

from pathlib import Path

import pytest
import pytest_asyncio

from sidecar import collector, db, expander, graph
from sidecar.channel_source import ChannelMeta, FakeChannelSource
from sidecar.username_resolver import FakeUsernameResolver


@pytest_asyncio.fixture
async def tgdb_path(tmp_path: Path) -> Path:
    path = tmp_path / "test.tgdb"
    await db.init_db(path)
    return path


def _source(username: str, channel_id: int, description: str) -> FakeChannelSource:
    return FakeChannelSource(
        metadata={
            username: ChannelMeta(
                id=channel_id, username=username, title=username.title(),
                description=description, member_count=10, type="channel",
                is_private=False, raw_json="{}",
            )
        },
        messages={},
    )


@pytest.mark.asyncio
async def test_edge_to_an_uncollected_neighbor_is_withheld_until_it_is_collected(tgdb_path):
    """An edge is written the moment a neighbor *resolves*, which is before the crawler
    reaches it — until then that neighbor's row has `id IS NULL` and is keyed
    `seed-<rowid>`, so emitting the edge would name a target node graphology has never
    seen and it would throw. The same edge must start rendering once the node is real."""
    await collector.collect_channel(
        "chana", _source("chana", 1001, "https://t.me/chanb"), path=tgdb_path
    )
    await expander.expand_channel(1001, FakeUsernameResolver({"chanb": 2002}), path=tgdb_path)

    before = await graph.get_graph(path=tgdb_path)
    assert before["edges"] == []  # chanb resolved, but not collected yet
    assert await graph.get_graph_counts(path=tgdb_path) == {"node_count": 2, "edge_count": 1}

    # The crawler reaches chanb and collects it: its row gains the real peer id.
    await collector.collect_channel(
        "chanb", _source("chanb", 2002, "Chan B"), path=tgdb_path
    )

    after = await graph.get_graph(path=tgdb_path)
    assert len(after["edges"]) == 1
    assert (after["edges"][0]["source"], after["edges"][0]["target"]) == ("1001", "2002")
    assert after["edges"][0]["attributes"]["edgeType"] == expander.EDGE_TYPE_LINK


@pytest.mark.asyncio
async def test_every_emitted_edge_names_nodes_that_exist(tgdb_path):
    """The invariant the filter exists to hold, asserted directly rather than via the
    one case above."""
    await collector.collect_channel(
        "chana", _source("chana", 1001, "https://t.me/chanb https://t.me/chanc"), path=tgdb_path
    )
    await expander.expand_channel(
        1001, FakeUsernameResolver({"chanb": 2002, "chanc": 3003}), path=tgdb_path
    )
    await collector.collect_channel(
        "chanb", _source("chanb", 2002, "Chan B"), path=tgdb_path
    )

    result = await graph.get_graph(path=tgdb_path)
    node_keys = {node["key"] for node in result["nodes"]}
    for edge in result["edges"]:
        assert edge["source"] in node_keys
        assert edge["target"] in node_keys
    assert len(result["edges"]) == 1  # chanc still uncollected
