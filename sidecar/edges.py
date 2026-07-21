"""
Edge discovery signals (FR-2, Phase 5). Two of the three signals — linked-channel and
keyword-mention — are pure text processing over whatever description/message text is
supplied, with no Telegram dependency: fully testable against synthetic text. The third
(shared-member overlap) genuinely needs real collected member lists (Phase 3) to mean
anything and is correctly not built here.

These functions take text as a plain argument rather than fetching it themselves — the
caller (Phase 3's collector.py, once it exists) is responsible for supplying real
collected description/message text; this module has no opinion on where that text comes
from, which is exactly why it doesn't need Phase 1 to pass first.
"""

import re

# t.me/username or telegram.me/username, with optional https:// prefix. Excludes
# t.me/joinchat/... and t.me/+... invite links (a different signal — those name no
# public username to follow) and t.me/c/... private-channel-by-id links (not resolvable
# without an already-joined session) via a negative lookahead on the reserved first path
# segments, confirmed necessary by a real test case ("t.me/joinchat/..." was initially
# misparsed as username "joinchat" before this fix — see edges_test manual run).
LINKED_CHANNEL_PATTERN = re.compile(
    r"(?:https?://)?(?:t\.me|telegram\.me)/(?!joinchat\b|c/|\+)([a-zA-Z][a-zA-Z0-9_]{4,31})\b"
)


def extract_linked_channels(text: str) -> list[str]:
    """Returns deduped usernames (order-preserving), lowercased for consistent dedup."""
    seen: dict[str, None] = {}
    for match in LINKED_CHANNEL_PATTERN.finditer(text):
        username = match.group(1).lower()
        seen.setdefault(username, None)
    return list(seen.keys())


def extract_keyword_mentions(text: str, known_entity_names: list[str]) -> list[str]:
    """Returns which of `known_entity_names` appear as a substring of `text`
    (case-insensitive). Reuses the same "known name in text" approach as
    `relevance.py`'s keyword scoring, applied to a caller-supplied entity list instead
    of the fixed military-keyword dictionary."""
    lowered = text.lower()
    return [name for name in known_entity_names if name.lower() in lowered]
