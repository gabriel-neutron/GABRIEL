"""
Rule-based military relevance scoring (FR-4, rule half only). The AI-classifier half
(OpenAI gpt-4o-mini for ambiguous mid-range scores) is out of scope here — it needs
Phase 1's OpenAI NER validation results (accuracy/cost) before a production prompt is
designed around it; this module only implements the keyword/regex engine, which has no
external dependency and is safe to build ahead of that gate.

Keyword lists are a starting set, not authoritative — the timeline (Phase 4) flags this
as an open item: "Build from scratch or import from existing OSINT resource?" Extend
`MILITARY_KEYWORDS`/`MUN_PATTERN`/`RANK_KEYWORDS` as real collected data (Phase 3+)
reveals gaps; don't treat this list as complete.
"""

import re

# Unit designators, weapon systems, common OSINT terms — Russian and English.
MILITARY_KEYWORDS = [
    # Russian
    "батальон", "бригада", "полк", "дивизия", "рота", "взвод", "штурм",
    "мобилизация", "контрактник", "личный состав", "техника", "бронетехника",
    "артиллерия", "миномет", "танк", "бпла", "дрон", "фпв", "гранатомет",
    "снайпер", "разведка", "штаб", "командир", "офицер", "потери", "цап",
    "группировка войск", "вс рф", "вооруженные силы",
    # English
    "battalion", "brigade", "regiment", "division", "company", "platoon",
    "mobilization", "contractor", "personnel", "armor", "artillery", "mortar",
    "tank", "drone", "uav", "fpv", "grenade launcher", "sniper", "reconnaissance",
    "headquarters", "commander", "casualties",
]

# Military Unit Number (MUN) patterns: Russian "в/ч 12345" and bare 5-digit codes in
# a military context, plus common Latin-alphabet unit-number shorthand.
MUN_PATTERN = re.compile(r"\bв[./]?ч\.?\s?\d{4,5}\b", re.IGNORECASE)

RANK_KEYWORDS = [
    "рядовой", "сержант", "лейтенант", "капитан", "майор", "полковник", "генерал",
    "private", "sergeant", "lieutenant", "captain", "major", "colonel", "general",
]

# Per-signal weights: MUN codes are the strongest unambiguous signal, keywords/ranks
# are weaker individually but additive. Threshold values are placeholders — the
# timeline explicitly calls for tuning these against real Phase 3/4 collected data
# ("Tune score thresholds based on manual review"), not treating this as final.
MUN_WEIGHT = 0.4
KEYWORD_WEIGHT = 0.05
RANK_WEIGHT = 0.1
MAX_SCORE = 1.0


def score_text(text: str) -> float:
    """Returns a relevance score in [0, 1]. Pure function — no I/O, unit testable."""
    if not text:
        return 0.0
    lowered = text.lower()

    score = 0.0
    score += MUN_WEIGHT * len(MUN_PATTERN.findall(text))
    score += KEYWORD_WEIGHT * sum(1 for kw in MILITARY_KEYWORDS if kw in lowered)
    score += RANK_WEIGHT * sum(1 for rank in RANK_KEYWORDS if rank in lowered)

    return min(score, MAX_SCORE)


def score_channel(title: str, description: str, sample_messages: list[str]) -> float:
    """Aggregate score across title/description (weighted higher — analyst-authored,
    denser signal) and a sample of recent messages."""
    combined = f"{title} {title} {description} {description} " + " ".join(sample_messages)
    return score_text(combined)


# Score bands the AI classifier (once Phase 1's OpenAI validation lands) would target
# for the ambiguous middle — channels here are neither clearly relevant nor clearly not.
AMBIGUOUS_BAND = (0.15, 0.4)


def needs_ai_classification(score: float) -> bool:
    low, high = AMBIGUOUS_BAND
    return low <= score < high
