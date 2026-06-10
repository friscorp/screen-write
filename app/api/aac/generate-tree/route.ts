import { generateText, Output } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserIdFromRequest } from "@/lib/auth"

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"

const VocabLeafSchema = z.object({
  word: z.string(),
  emoji: z.string(),
  sentence: z.string(),
})

const VocabBranchSchema = z.object({
  word: z.string(),
  emoji: z.string(),
  children: z.array(VocabLeafSchema),
})

const VocabCategorySchema = z.object({
  word: z.string(),
  emoji: z.string(),
  children: z.array(VocabBranchSchema),
})

export async function POST(request: NextRequest) {
  if (!getUserIdFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { categoryName, categoryEmoji, categoryDescription } = await request.json()

    if (!categoryName?.trim()) {
      return NextResponse.json({ error: "categoryName is required" }, { status: 400 })
    }

    const descriptionClause = categoryDescription?.trim()
      ? `\n\nThe parent/caregiver has provided these hints about the child's preferences for this category:\n"${categoryDescription.trim()}"\nUse these preferences to tailor the vocabulary choices so they feel personal and relevant to this specific child.`
      : ""

    const prompt = `You are creating vocabulary for an AAC (Augmentative and Alternative Communication) app for children ages 4–8 with communication challenges.

Create a structured vocabulary tree for the parent category: "${categoryName}" (${categoryEmoji || ""})${descriptionClause}

Requirements:
- Generate exactly 5 Level 2 sub-categories, each with an appropriate emoji
- For each Level 2 sub-category, generate exactly 5 Level 3 specific items, each with an appropriate emoji
- For each Level 3 item, write a warm, enthusiastic sentence (10–15 words) that a child would say to express that need, want, or feeling
- Sentences must be child-friendly and actionable. Examples:
    - Food: "I'm really thirsty, can I please have some water?" (not "I want water")
    - Play: "Can we go to the park? I really want to play outside!" (not "park")
    - Emotions: "I'm feeling so excited right now, something wonderful is happening!" (not "excited")
- Keep all vocabulary familiar and age-appropriate for young children
- Return exactly 5 children at Level 2 and exactly 5 children at Level 3 for each Level 2 node

The sentence for each Level 3 item is spoken aloud by the AAC device when the child taps it.`

    const result = await generateText({
      model: OPENAI_MODEL,
      prompt,
      maxOutputTokens: 3000,
      output: Output.object({
        schema: VocabCategorySchema,
      }),
    })

    const generated = result.object
    if (!generated || !generated.children || generated.children.length === 0) {
      return NextResponse.json({ error: "Generation produced no output" }, { status: 500 })
    }

    return NextResponse.json({
      word: categoryName.trim(),
      emoji: categoryEmoji || generated.emoji || "📋",
      children: generated.children,
    })
  } catch (error) {
    console.error("Tree generation error:", error)
    return NextResponse.json({ error: "Failed to generate vocabulary tree" }, { status: 500 })
  }
}
