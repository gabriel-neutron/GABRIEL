"""
OOB match proposal generation (FR-2/FR-6, Phase 7's `oob_matcher.py`). Only the pure
string-similarity function lives here — no Telegram or `.gpkg` dependency, so it's safe
to build and unit test ahead of Phase 1's validation gate. `gpkg_reader.py` (loading
real OOB entity names from a project's `.gpkg`) is deliberately NOT built yet: it needs
a real `.gpkg` with real entity names to validate field-name assumptions against, and
building it against guessed field names would be exactly the "unvalidated assumption"
the timeline's own principle warns against.
"""

import re
from difflib import SequenceMatcher

CONFIDENCE_THRESHOLD = 0.75

# Leading ordinal unit-number ("288th", "96th", "1st") — the single most distinguishing
# token in a military unit name. Extracted separately because SequenceMatcher's
# character-overlap ratio badly under-weights it: two brigades sharing a common suffix
# ("... Artillery Brigade") score highly similar even when their numbers (and therefore
# their real-world identity) are completely different. Validated 2026-07-20 against the
# real bundled `public/project.gpkg` (1,010 units, see sidecar/validation/RESULTS.md) —
# at the PRD's 0.75 threshold, "288th Artillery Brigade" pulled in 17 candidates
# including "238th"/"236th"/"244th"/"227th Artillery Brigade" before this fix.
LEADING_NUMBER_PATTERN = re.compile(r"^\s*(\d+)(?:st|nd|rd|th)?\b", re.IGNORECASE)


def _leading_number(name: str) -> str | None:
    match = LEADING_NUMBER_PATTERN.match(name)
    return match.group(1) if match else None


def name_similarity(a: str, b: str) -> float:
    """Case-insensitive similarity in [0, 1]. `SequenceMatcher` (stdlib, no dependency)
    rather than a fuzzy-matching library — swap for `rapidfuzz` if precision on real
    Cyrillic unit-name variants turns out inadequate once real data exists to test
    against. Hard-zeroes the score when both names have a leading unit number and they
    differ — see `LEADING_NUMBER_PATTERN`'s comment for why that's necessary here."""
    a_number, b_number = _leading_number(a), _leading_number(b)
    if a_number is not None and b_number is not None and a_number != b_number:
        return 0.0
    return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()


def find_match_candidates(
    channel_name: str, oob_entity_names: dict[str, str], threshold: float = CONFIDENCE_THRESHOLD
) -> list[dict]:
    """`oob_entity_names` maps oob_entity_id -> name. Returns candidates at or above
    `threshold`, sorted by confidence descending — the caller (Phase 7's `/oob/proposals`
    endpoint, not yet built) decides how many to surface and how to dedupe against
    already-proposed pairs."""
    candidates = []
    for oob_entity_id, oob_name in oob_entity_names.items():
        confidence = name_similarity(channel_name, oob_name)
        if confidence >= threshold:
            candidates.append(
                {
                    "oob_entity_id": oob_entity_id,
                    "confidence": round(confidence, 4),
                    "evidence_text": f"'{channel_name}' ~ '{oob_name}'",
                }
            )
    candidates.sort(key=lambda c: c["confidence"], reverse=True)
    return candidates
