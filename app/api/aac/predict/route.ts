import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserIdFromRequest } from "@/lib/auth"

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"
// Strip the "openai/" prefix so the id can be passed to the @ai-sdk/openai provider.
const openaiModelId = OPENAI_MODEL.replace(/^openai\//, "")

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Schema for predictions
const PredictionSchema = z.object({
  predictions: z.array(
    z.object({
      word: z.string(),
      emoji: z.string(),
    })
  ),
})

export async function POST(request: NextRequest) {
  if (!getUserIdFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { sentence, category } = await request.json()

    const prompt = `You are an AAC (Augmentative and Alternative Communication) assistant helping non-verbal children communicate. Based on the current context, suggest the 4 most likely next words or short phrases they might want to say.

Current sentence so far: "${sentence || "(starting new sentence)"}"
${category ? `Current category focus: ${category}` : ""}

Guidelines:
- Suggest simple, common words a child would use
- Include a relevant emoji for each suggestion
- Consider natural conversation flow
- If the sentence seems complete, suggest ending phrases like "please", "now", "thank you", or new sentence starters
- Keep words simple and concrete
- For Food category: suggest food items, drinks, hunger/thirst expressions
- For Play category: suggest activities, toys, games, locations

Provide exactly 4 suggestions that are contextually appropriate and would help the child express themselves.`

    const { object: output } = await generateObject({
      model: openai(openaiModelId),
      prompt,
      // gpt-5-mini and other reasoning models spend output tokens on internal
      // reasoning before emitting the object, so keep a generous budget here.
      maxOutputTokens: 2000,
      schema: PredictionSchema,
      // Keep reasoning effort minimal: predictions need to feel instant, and
      // minimal effort is much faster and cheaper (near-zero reasoning tokens).
      providerOptions: {
        openai: { reasoningEffort: "minimal" },
      },
    })

    // Extract the structured output
    const predictions = output?.predictions || []

    return NextResponse.json({ predictions })
  } catch (error) {
    console.error("Prediction error:", error)
    
    // Return fallback predictions on error
    return NextResponse.json({
      predictions: [
        { word: "please", emoji: "🙏" },
        { word: "more", emoji: "➕" },
        { word: "help", emoji: "🆘" },
        { word: "all done", emoji: "✅" },
      ],
    })
  }
}
