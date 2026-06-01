import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

// Get the OpenAI model from environment variable, default to gpt-4o
const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-4o"
const openaiModel = OPENAI_MODEL.replace(/^openai\//, "")

export async function POST(request: NextRequest) {
  try {
    const { image, previousText } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 })
    }

    console.log("Processing image analysis request...")

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json(
        { success: false, error: "OpenAI API key not configured" },
        { status: 500 }
      )
    }

    // Prepare the prompt with context
    let prompt = `You are helping a child with learning challenges who may have difficulty communicating verbally. They have drawn something on a canvas, and you need to interpret what they drew.

Please analyze this drawing and:
1. Identify any letters, numbers, symbols, or words that were drawn
2. If there are spelling mistakes, correct them
3. If the drawing seems to be part of a larger thought or sentence, try to complete it logically
4. Consider the context of what they've written before

CRITICAL: You must respond with ONLY a JSON object, no markdown formatting, no code blocks, no extra text. Just the raw JSON:

{
  "success": true/false,
  "text": "the recognized and corrected text",
  "newContent": "only the newly recognized content from this drawing"
}

If you cannot recognize anything meaningful in the drawing, respond with:
{
  "success": false,
  "error": "I can't make out any clear letters or symbols in this drawing. Please try drawing more clearly or with thicker lines."
}

`

    if (previousText && previousText.trim().length > 0) {
      prompt += `Previous text they've written: "${previousText.trim()}"

Based on this context, what do you think they're trying to communicate with this new drawing? Please provide the COMPLETE corrected text (including the previous text with any corrections + the new interpreted content) in the "text" field, and ONLY the newly recognized content from this drawing in the "newContent" field.`
    } else {
      prompt += `This is a fresh start with no previous context. What letters, numbers, words, or symbols do you see in this drawing? Put the recognized content in both "text" and "newContent" fields since this is the first drawing.`
    }

    prompt += `

Important guidelines:
- Be encouraging and positive
- If you're unsure, make your best guess based on the drawing
- Focus on helping them communicate effectively
- Respond with ONLY raw JSON, no markdown formatting
- If you see scribbles or unclear marks, set success to false
${
  previousText && previousText.trim().length > 0
    ? "- If this appears to be continuing a sentence, complete it naturally"
    : "- This is a new beginning, so interpret what you see without assuming prior context"
}`

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const result = await openai.chat.completions.create({
      model: openaiModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    })

    const responseContent = result.choices[0]?.message.content ?? ""

    console.log("Raw AI response:", responseContent)

    // Clean the response - remove markdown code blocks if present
    let cleanedResponse = responseContent.trim()

    // Remove markdown code blocks
    if (cleanedResponse.startsWith("```json")) {
      cleanedResponse = cleanedResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "")
    } else if (cleanedResponse.startsWith("```")) {
      cleanedResponse = cleanedResponse.replace(/^```\s*/, "").replace(/\s*```$/, "")
    }

    // Remove any leading/trailing whitespace
    cleanedResponse = cleanedResponse.trim()

    console.log("Cleaned response:", cleanedResponse)

    // Try to parse the JSON response
    try {
      const parsedResponse = JSON.parse(cleanedResponse)

      if (parsedResponse.success === false) {
        return NextResponse.json({
          success: false,
          error: parsedResponse.error || "Could not recognize the drawing",
        })
      }

      return NextResponse.json({
        success: true,
        text: parsedResponse.text || "",
        newContent: parsedResponse.newContent || parsedResponse.text || "",
      })
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError)
      console.error("Cleaned response was:", cleanedResponse)

      // Fallback: treat as plain text if JSON parsing fails
      const responseText = cleanedResponse

      // Check if response indicates failure
      if (
        responseText.toLowerCase().includes("can't") ||
        responseText.toLowerCase().includes("cannot") ||
        responseText.toLowerCase().includes("unable") ||
        responseText.toLowerCase().includes("unclear")
      ) {
        return NextResponse.json({
          success: false,
          error:
            "I couldn't recognize clear letters or symbols in this drawing. Please try again with clearer strokes.",
        })
      }

      // Treat as successful recognition
      return NextResponse.json({
        success: true,
        text: responseText,
        newContent: responseText,
      })
    }
  } catch (error) {
    console.error("Error analyzing drawing:", error)

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json({ success: false, error: "Invalid OpenAI API key" }, { status: 401 })
      }
      if (error.message.includes("quota")) {
        return NextResponse.json({ success: false, error: "OpenAI API quota exceeded" }, { status: 429 })
      }
    }

    return NextResponse.json({ success: false, error: "Failed to analyze drawing. Please try again." }, { status: 500 })
  }
}
