#!/usr/bin/env python3
"""
Minimal protection hook for shadcn/ui source components.

Blocks write/edit attempts targeting src/components/ui and explains
that fixes must be made where components are used, not in shadcn source files.
"""

import json
import sys


def main():
    try:
        hook_input = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})

    if tool_name not in ("Write", "Edit", "MultiEdit", "create_file", "str_replace"):
        sys.exit(0)

    file_path = (tool_input.get("path") or tool_input.get("file_path", "")).replace("\\", "/")
    if not file_path:
        sys.exit(0)

    if "/src/components/ui/" not in file_path:
        sys.exit(0)

    output = {
        "decision": "block",
        "reason": (
            "BLOCKED: Do not edit files in src/components/ui (shadcn source components).\n"
            "Fix issues in the calling/usage component instead (props, composition, wrappers, styles at usage site).\n"
            "Keep ui primitives unchanged."
        ),
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
