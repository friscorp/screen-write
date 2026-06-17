import OpenAI from "openai"
import { zodResponseFormat } from "openai/helpers/zod"
import type { ZodType } from "zod"

// The configured model id. The raw OpenAI SDK wants a bare id, so strip any
// "openai/" prefix (the same convention as app/api/analyze-drawing).
const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"
const MODEL = OPENAI_MODEL.replace(/^openai\//, "")

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set")
  }
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

/**
 * Calls the OpenAI Chat Completions API with a Zod-typed structured-output
 * schema and returns the parsed object, or null when the model returned nothing
 * usable (e.g. a refusal or truncated output). Throws on missing config or
 * network/API errors so callers can fall back.
 *
 * This replaces the Vercel AI SDK `generateText` + `Output.object` usage, which
 * threw `AI_UnsupportedModelVersionError` because the installed @ai-sdk/openai
 * (v3, model spec v2) is incompatible with ai@4 (spec v1). Using the raw `openai`
 * SDK — already a dependency used by analyze-drawing/speak — sidesteps the
 * version mismatch entirely.
 */
export async function generateStructured<T>(
  schema: ZodType<T>,
  schemaName: string,
  prompt: string,
  maxTokens?: number
): Promise<T | null> {
  const completion = await getClient().chat.completions.parse({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: zodResponseFormat(schema, schemaName),
    ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
  })

  return (completion.choices[0]?.message.parsed as T | null) ?? null
}
