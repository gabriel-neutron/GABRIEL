"""
Phase 1 validation — tgspyder private channel scraping.

Run manually: `python validation/04_tgspyder_private.py <invite_link_or_username>`

Requires `tgspyder` installed (pip install tgspyder — verify it is still maintained
and importable; the PRD notes it as "actively maintained (Feb 2026)" but this must be
re-confirmed at run time, not assumed) and a PRIVATE test channel you control, per the
timeline's "controlled private test channel" requirement.

Reports:
- whether invite-link join succeeds programmatically, is patched, or requires a
  manual join first (falls back to using an already-joined session either way)
- whether member scraping works against the private channel and what shape the
  output takes
"""

import os
import sys

from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

API_ID = os.environ.get("TG_API_ID")
API_HASH = os.environ.get("TG_API_HASH")


def main(target: str) -> None:
    if not API_ID or not API_HASH:
        print("Set TG_API_ID and TG_API_HASH in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    try:
        import tgspyder  # noqa: F401
    except ImportError:
        print(
            "tgspyder is not importable. Check https://codeberg.org/Lonami/Telethon-adjacent "
            "package registries for current tgspyder status — this may itself be the Phase 1 "
            "finding (tool unmaintained/renamed/broken). Record it in RESULTS.md and stop here.",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"tgspyder importable: {tgspyder.__file__}")
    print(f"Target: {target}")
    print()
    print("tgspyder's API surface must be checked against its current README before wiring")
    print("this script further — do not assume a specific function signature here. Import")
    print("succeeded; inspect `dir(tgspyder)` interactively and complete this script by hand")
    print("against whatever the actual installed version exposes, then record in RESULTS.md:")
    print("  - invite-link join: works / patched / requires manual join")
    print("  - member scraping output shape")
    print("  - which capabilities need an already-joined account vs. work standalone")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <invite_link_or_username>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
