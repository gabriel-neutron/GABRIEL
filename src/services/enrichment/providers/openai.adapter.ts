import type {
  AiModelAdapter,
  QueryGenerationInput,
  SynthesisInput,
} from "./provider.types"

const OPENAI_ENDPOINT = "https://api.openai.com/v1/responses"

function parseOutputText(payload: {
  output_text?: string
  output?: Array<{ content?: Array<{ text?: string }> }>
}): string {
  return payload.output_text ?? payload.output?.[0]?.content?.[0]?.text ?? ""
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const objectMatch = text.match(/\{[\s\S]*\}/)
    if (!objectMatch) {
      throw new Error("Model output is not valid JSON")
    }
    try {
      return JSON.parse(objectMatch[0]) as Record<string, unknown>
    } catch {
      throw new Error("Model output is not valid JSON")
    }
  }
}

export class OpenAIModelAdapter implements AiModelAdapter {
  private readonly apiKey: string | null
  private readonly synthesisModel: string

  constructor(apiKey: string | null, synthesisModel = "gpt-4.1-mini") {
    this.apiKey = apiKey
    this.synthesisModel = synthesisModel
  }

  private async callOpenAI(
    model: string,
    systemInstructions: string,
    userPayload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is missing")
    }

    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemInstructions }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status})`)
    }

    const payload = (await response.json()) as {
      output_text?: string
      output?: Array<{ content?: Array<{ text?: string }> }>
    }
    return parseJsonObject(parseOutputText(payload))
  }

  async generateQueries(input: QueryGenerationInput, signal?: AbortSignal): Promise<string[]> {
    const instructions = [
      "Generate 4 to 6 web research queries for ORBAT enrichment.",
      "Focus exclusively on permanent garrison locations, military bases, training grounds, and headquarters (voennyy gorodok / voennaya baza).",
      "Ignore deployment areas, front-line positions, and operational movements.",
      `Only target unresolved fields: ${JSON.stringify(input.unresolvedFields)}.`,
      "Queries must include English and Russian Cyrillic variants.",
      "Prioritize sources in this order: (1) official Russian military/government (mil.ru, kremlin.ru, .gov.ru, CSTO), (2) OSINT reports/news (Bellingcat, RFE/RL, ISW, Meduza, BBC), (3) social media (Telegram, VK), (4) Wikipedia — use only if nothing else is available.",
      "Return strict JSON only in this shape: {\"queries\": [\"...\"]}.",
    ].join("\n")

    const payload = await this.callOpenAI(
      "gpt-4.1-mini",
      instructions,
      {
        feature: input.feature,
        context: input.context,
        prompt: input.prompt,
        unresolvedFields: input.unresolvedFields,
      },
      signal,
    )

    const queries = payload.queries
    if (!Array.isArray(queries)) {
      throw new Error("OpenAI query generation returned invalid payload")
    }

    const normalized = queries
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0)

    if (normalized.length === 0) {
      throw new Error("OpenAI query generation returned empty queries")
    }

    return normalized.slice(0, 6)
  }

  async synthesize(input: SynthesisInput, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const instructions = [
      "Return strict JSON object only.",
      "Use only provided evidence chunks.",
      "Do not invent URLs or claims.",
      "Focus exclusively on permanent garrison locations, military bases, training grounds, and headquarters (voennyy gorodok / voennaya baza).",
      "Do not infer deployment-area or operational theater claims.",
      "If evidence is found but its relevance to garrison is uncertain, include the source URL and append a brief note rather than discarding it.",
      "Prioritize sources in this order: (1) official Russian military/government (mil.ru, kremlin.ru, .gov.ru, CSTO), (2) OSINT reports/news (Bellingcat, RFE/RL, ISW, Meduza, BBC), (3) social media (Telegram, VK), (4) Wikipedia.",
      "If Wikipedia is the only available source for a claim, note it but also report any primary source it cites. Never use Wikipedia as the sole citation.",
      "Return only the required fields; do not add extra keys.",
      "If evidence is missing for a field, set the field to null.",
      `Required fields: ${JSON.stringify(input.outputSchemaFields)}`,
    ].join("\n")

    return this.callOpenAI(
      this.synthesisModel,
      instructions,
      {
        feature: input.feature,
        context: input.context,
        prompt: input.prompt,
        chunks: input.chunks,
        outputSchemaFields: input.outputSchemaFields,
      },
      signal,
    )
  }
}

