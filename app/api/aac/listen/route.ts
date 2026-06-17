import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserIdFromRequest } from "@/lib/auth"
import { generateStructured } from "@/lib/openai-structured"

const ResponsesSchema = z.object({
  responses: z.array(
    z.object({
      word: z.string(),
      emoji: z.string(),
    })
  ),
})

// Safe, generic answers used when the model is unavailable or the question was
// too unclear to answer specifically. Kept in sync with the child-friendly tone
// of the rest of the board.
const FALLBACK_RESPONSES = [
  { word: "Yes", emoji: "👍" },
  { word: "No", emoji: "👎" },
  { word: "Maybe", emoji: "🤔" },
  { word: "I don't know", emoji: "🤷" },
]

// Given a question that was spoken to the child (captured by Listening Mode and
// transcribed), produce a small set of simple, child-friendly response options
// they can tap to answer. The frontend shows these as large buttons and speaks
// the chosen one aloud.
export async function POST(request: NextRequest) {
  if (!getUserIdFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { question } = await request.json()
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ responses: FALLBACK_RESPONSES })
    }

    const prompt = `You are helping a young, non-verbal child answer a question someone just asked them out loud. The question was:

"${question.trim()}"

Suggest 4 simple, concrete response options the child could tap to answer. Guidelines:
- Each option is a short answer to THIS question (1-4 words), phrased as the child speaking.
- For yes/no questions, include positive and negative options (e.g. "Yes please", "No thank you").
- For either/or questions (e.g. "milk or water?"), make each choice an option.
- For open questions (e.g. "what do you want to do?"), offer a few likely, simple answers.
- Always keep one easy "out" like "I don't know" or "Not sure" when appropriate.
- Use warm, child-like wording and a single relevant emoji per option.

Return exactly 4 options, most likely first.`

    const result = await generateStructured(ResponsesSchema, "listen_responses", prompt, 200)

    const responses = (result?.responses || [])
      .filter((r) => r && typeof r.word === "string" && r.word.trim())
      .slice(0, 4)

    return NextResponse.json({
      responses: responses.length > 0 ? responses : FALLBACK_RESPONSES,
    })
  } catch (error) {
    console.error("Listen response error:", error)
    return NextResponse.json({ responses: FALLBACK_RESPONSES })
  }
}
