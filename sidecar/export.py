"""
GraphML and Neo4j Cypher export (Phase 8). Pure serialization over the `.tgdb` schema —
no Telegram dependency, safe to build ahead of Phase 1's validation gate and testable
against seed-imported data. GraphML output targets the format Gephi expects
(http://graphml.graphdrawing.org/primer/graphml-primer.html); actually opening it in
Gephi is a manual Phase 8 exit-criterion step this module can't self-certify.
"""

from xml.sax.saxutils import escape

import aiosqlite

from sidecar.db import DEFAULT_TGDB_PATH


async def _fetch_graph(path) -> tuple[list[aiosqlite.Row], list[aiosqlite.Row]]:
    async with aiosqlite.connect(path) as conn:
        conn.row_factory = aiosqlite.Row
        channels = await conn.execute_fetchall(
            "SELECT id, username, title, relevance_score, type FROM channels"
        )
        edges = await conn.execute_fetchall(
            "SELECT id, from_id, to_id, edge_type, weight FROM edges"
        )
    return channels, edges


async def export_graphml(path=DEFAULT_TGDB_PATH) -> str:
    channels, edges = await _fetch_graph(path)

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
        '  <key id="label" for="node" attr.name="label" attr.type="string"/>',
        '  <key id="relevance" for="node" attr.name="relevance_score" attr.type="double"/>',
        '  <key id="edgeType" for="edge" attr.name="edge_type" attr.type="string"/>',
        '  <key id="weight" for="edge" attr.name="weight" attr.type="double"/>',
        '  <graph id="gabriel-telegram-graph" edgedefault="directed">',
    ]
    for row in channels:
        label = escape(row["title"] or row["username"] or f"channel-{row['id']}")
        relevance = row["relevance_score"] or 0
        lines.append(f'    <node id="n{row["id"]}">')
        lines.append(f'      <data key="label">{label}</data>')
        lines.append(f'      <data key="relevance">{relevance}</data>')
        lines.append("    </node>")
    for row in edges:
        edge_type = escape(row["edge_type"] or "")
        weight = row["weight"] or 0
        lines.append(
            f'    <edge id="e{row["id"]}" source="n{row["from_id"]}" target="n{row["to_id"]}">'
        )
        lines.append(f'      <data key="edgeType">{edge_type}</data>')
        lines.append(f'      <data key="weight">{weight}</data>')
        lines.append("    </edge>")
    lines.append("  </graph>")
    lines.append("</graphml>")
    return "\n".join(lines)


def _cypher_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


async def export_neo4j_cypher(path=DEFAULT_TGDB_PATH) -> str:
    channels, edges = await _fetch_graph(path)

    statements = []
    for row in channels:
        label = _cypher_escape(row["title"] or row["username"] or f"channel-{row['id']}")
        statements.append(
            f"MERGE (c{row['id']}:Channel {{id: {row['id']}}}) "
            f"SET c{row['id']}.label = '{label}', "
            f"c{row['id']}.relevanceScore = {row['relevance_score'] or 0};"
        )
    for row in edges:
        edge_type = (row["edge_type"] or "RELATED").upper().replace(" ", "_")
        statements.append(
            f"MATCH (a:Channel {{id: {row['from_id']}}}), (b:Channel {{id: {row['to_id']}}}) "
            f"MERGE (a)-[:{edge_type} {{weight: {row['weight'] or 0}}}]->(b);"
        )
    return "\n".join(statements)
