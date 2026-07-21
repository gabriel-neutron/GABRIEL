"""
Phase 1 validation — OpenAI gpt-4o-mini Russian military NER.

Run manually: `python validation/05_openai_ner.py samples.jsonl`

`samples.jsonl` is a file of `{"text": "..."}` lines, ideally 50 real Russian
Telegram messages sourced manually per the PRD (this script does not fabricate
sample data). Sends them to gpt-4o-mini for UNIT/MUN/PERSON/LOCATION/EQUIPMENT
extraction and reports token usage so cost per 1,000 messages can be computed.
Accuracy (>= 70% target) must be evaluated manually against the printed output —
this script does not grade itself.
"""

import json
import os
import sys

from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).parent.parent / ".env")

MODEL = "gpt-4o-mini"
SYSTEM_PROMPT = """You extract military-relevant named entities from Russian Telegram messages.
Return strict JSON: {"entities": [{"type": "UNIT"|"MUN"|"PERSON"|"LOCATION"|"EQUIPMENT", "value": "...", "confidence": 0.0-1.0}]}
If no entities are found, return {"entities": []}. Do not translate values; keep original text."""

# gpt-4o-mini pricing as of PRD authoring — re-verify against https://openai.com/api/pricing/
# before trusting the cost projection this script prints.
PRICE_PER_1M_INPUT_TOKENS = 0.15
PRICE_PER_1M_OUTPUT_TOKENS = 0.60


def load_samples(path: str) -> list[str]:
    samples = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            samples.append(json.loads(line)["text"])
    return samples


def main(path: str) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Set OPENAI_API_KEY in sidecar/.env first.", file=sys.stderr)
        sys.exit(1)

    samples = load_samples(path)
    if not samples:
        print(f"No samples found in {path}.", file=sys.stderr)
        sys.exit(1)

    client = OpenAI(api_key=api_key)
    total_input_tokens = 0
    total_output_tokens = 0

    for i, text in enumerate(samples, start=1):
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            response_format={"type": "json_object"},
        )
        total_input_tokens += response.usage.prompt_tokens
        total_output_tokens += response.usage.completion_tokens

        print(f"--- sample {i}/{len(samples)} ---")
        print(f"text: {text}")
        print(f"extracted: {response.choices[0].message.content}")
        print()

    cost = (
        total_input_tokens / 1_000_000 * PRICE_PER_1M_INPUT_TOKENS
        + total_output_tokens / 1_000_000 * PRICE_PER_1M_OUTPUT_TOKENS
    )
    cost_per_1k_messages = cost / len(samples) * 1000

    print(f"Samples: {len(samples)}")
    print(f"Total tokens: {total_input_tokens} in / {total_output_tokens} out")
    print(f"Cost this run: ${cost:.4f}")
    print(f"Projected cost per 1,000 messages: ${cost_per_1k_messages:.2f}")
    print()
    print("Manually review the extracted entities above against ground truth and record")
    print("precision (target >= 70%) plus this cost projection in sidecar/validation/RESULTS.md.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <samples.jsonl>", file=sys.stderr)
        sys.exit(1)
    main(sys.argv[1])
