import { generateText, Output } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserIdFromRequest } from "@/lib/auth"

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"

const FrequentSchema = z.object({
  words: z.array(z.string()),
})

// Given a top-level category and the items (Level 3 leaves) it contains, pick the
// ones a child is most likely to request often. Selection is weighted by the
// parent's preference hints for the category. Items are chosen from the supplied
// list only — the frontend maps them back to real leaves so the full sentence
// can be spoken.
export async function POST(request: NextRequest) {
  if (!getUserIdFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { category, description, items, limit } = await request.json()
    const max = typeof limit === "number" && limit > 0 ? Math.min(limit, 10) : 6

    const itemList: { word: string; emoji: string }[] = Array.isArray(items) ? items : []
    if (itemList.length === 0) {
      return NextResponse.json({ words: [] })
    }

    // Used when the model is unavailable or returns nothing usable.
    const fallback = itemList.slice(0, max).map((i) => i.word)

    const descriptionClause = description?.trim()
      ? `\n\nThe parent/caregiver shared these hints about the child's preferences:\n"${description.trim()}"\nWeight your choices toward items that match these preferences.`
      : ""

    const prompt = `You are helping configure an AAC (Augmentative and Alternative Communication) board for a young child. For the category "${category}", choose the ${max} items the child is most likely to request often.${descriptionClause}

Choose ONLY from this list of available items, using the exact spelling of each:
${itemList.map((i) => `- ${i.word}`).join("\n")}

Return ${max} words (or fewer if the list is shorter), ordered most-requested first.`

    const result = await generateText({
      model: OPENAI_MODEL,
      prompt,
      maxOutputTokens: 200,
      output: Output.object({
        schema: FrequentSchema,
      }),
    })

    const valid = new Set(itemList.map((i) => i.word.toLowerCase()))
    const seen = new Set<string>()
    const chosen = ((result.object?.words || []) as string[])
      .filter((w) => {
        const key = String(w).toLowerCase()
        if (!valid.has(key) || seen.has(key)) return false
        seen.add(key)
        return true
      })
      .slice(0, max)

    return NextResponse.json({ words: chosen.length > 0 ? chosen : fallback })
  } catch (error) {
    console.error("Frequent items error:", error)
    return NextResponse.json({ words: [] })
  }
}
