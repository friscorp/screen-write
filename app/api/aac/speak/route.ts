import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      )
    }

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Generate speech using OpenAI TTS
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // Clear, friendly voice good for kids
      input: text,
      speed: 0.9, // Slightly slower for clarity
    })

    // Get the audio as a buffer
    const audioBuffer = Buffer.from(await response.arrayBuffer())

    // Return the audio as a stream
    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    )
  }
}
