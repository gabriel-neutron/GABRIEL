"""
Structured error logging (Phase 8 hardening). Logs to a file, not just stdout, so
errors survive after the terminal that ran `npm run sidecar` is closed. No Telegram
dependency — safe to build ahead of Phase 1's validation gate.

Exit criterion: "No credentials appear in any log output." Nothing here logs request
bodies or headers (which could carry api_id/api_hash in future auth-related endpoints)
— only the exception, its type, and a generated request id. Keep it that way if this
file is extended.
"""

import logging
from pathlib import Path

LOG_PATH = Path(__file__).parent / "sidecar.log"


def configure_logging() -> logging.Logger:
    logger = logging.getLogger("gabriel.sidecar")
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
        file_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
        )
        logger.addHandler(file_handler)

    return logger


logger = configure_logging()
