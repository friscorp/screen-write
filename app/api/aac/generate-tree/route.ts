import { createOpenAI } from "@ai-sdk/openai"
import { generateObject } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getUserIdFromRequest } from "@/lib/auth"

const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"
// Strip the "openai/" prefix so the id can be passed to the @ai-sdk/openai provider.
const openaiModelId = OPENAI_MODEL.replace(/^openai\//, "")

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Cap the total Level-3 items per category so simple-mode boards (which flatten
// every sub-category into one grid) stay scannable instead of always maxing out.
const MAX_LEAVES = 20

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
      ? `\n\nThe parent/caregiver has provided these hints about the child's preferences for this category:\n"${categoryDescription.trim()}"\n\nIf these hints name specific items, an exact list, or an exact count (e.g. "only these 4 options", "just these 8 items, nothing more"), treat that as a hard constraint: generate EXACTLY those items and no others. Do not invent extra items to pad toward the defaults below, and do not add sub-categories beyond what's needed to hold the requested items. If the hints are general preferences rather than an exact list (e.g. "loves dinosaurs and building with LEGO"), use them to tailor which items you pick within the defaults below instead.`
      : ""

    const prompt = `You are creating vocabulary for an AAC (Augmentative and Alternative Communication) app for children ages 4–8 with communication challenges.

Create a structured vocabulary tree for the parent category: "${categoryName}" (${categoryEmoji || ""})${descriptionClause}

Default requirements (only apply when the hints above don't specify an exact list or count):
- Generate 4 to 5 Level 2 sub-categories, each with an appropriate emoji
- For each Level 2 sub-category, generate 3 to 5 Level 3 specific items, each with an appropriate emoji
- Aim for a total of 10 to 20 Level 3 items across the whole category combined — do not pad sub-categories with filler just to hit a fixed count

Always required, regardless of hints:
- Every Level 3 item sits under a Level 2 sub-category — group items under as few or as many sub-categories as make sense (a single sub-category holding all items is fine for a short explicit list)
- Every Level 3 item's word must be unique within this category — never repeat the same word (even with different phrasing) across different sub-categories
- For each Level 3 item, write a warm, enthusiastic sentence (10–15 words) that a child would say to express that need, want, or feeling
- Sentences must be child-friendly and actionable. Examples:
    - Food: "I'm really thirsty, can I please have some water?" (not "I want water")
    - Play: "Can we go to the park? I really want to play outside!" (not "park")
    - Emotions: "I'm feeling so excited right now, something wonderful is happening!" (not "excited")
- Keep all vocabulary familiar and age-appropriate for young children

The sentence for each Level 3 item is spoken aloud by the AAC device when the child taps it.`

    const { object: generated } = await generateObject({
      model: openai(openaiModelId),
      prompt,
      // A full 5x5 tree is large, and reasoning models (e.g. gpt-5-mini) also
      // spend output tokens thinking before emitting the object — keep this high.
      maxOutputTokens: 8000,
      schema: VocabCategorySchema,
      // Keep reasoning effort minimal: this is a straightforward generation task,
      // and minimal effort is much faster and cheaper (near-zero reasoning tokens).
      providerOptions: {
        openai: { reasoningEffort: "minimal" },
      },
    })

    if (!generated || !generated.children || generated.children.length === 0) {
      return NextResponse.json({ error: "Generation produced no output" }, { status: 500 })
    }

    // The model doesn't always hit the target count exactly — drop any blank
    // filler entries it emits, then dedupe by word (case-insensitive, across
    // sub-categories) and cap the total so simple-mode boards stay scannable.
    const seenWords = new Set<string>()
    let remaining = MAX_LEAVES
    const children = generated.children
      .filter((branch) => branch.word.trim().length > 0)
      .map((branch) => {
        const leaves = []
        for (const leaf of branch.children) {
          if (remaining <= 0) break
          if (leaf.word.trim().length === 0 || leaf.sentence.trim().length === 0) continue
          const key = leaf.word.trim().toLowerCase()
          if (seenWords.has(key)) continue
          seenWords.add(key)
          leaves.push(leaf)
          remaining--
        }
        return { ...branch, children: leaves }
      })
      .filter((branch) => branch.children.length > 0)

    if (children.length === 0) {
      return NextResponse.json({ error: "Generation produced no usable output" }, { status: 500 })
    }

    return NextResponse.json({
      word: categoryName.trim(),
      emoji: categoryEmoji || generated.emoji || "📋",
      children,
    })
  } catch (error) {
    console.error("Tree generation error:", error)
    return NextResponse.json({ error: "Failed to generate vocabulary tree" }, { status: 500 })
  }
}
