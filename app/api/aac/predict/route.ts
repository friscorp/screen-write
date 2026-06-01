import { generateText, Output } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"

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

    const result = await generateText({
      model: OPENAI_MODEL,
      prompt,
      maxOutputTokens: 200,
      output: Output.object({
        schema: PredictionSchema,
      }),
    })

    // Extract the structured output
    const predictions = result.object?.predictions || []

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
