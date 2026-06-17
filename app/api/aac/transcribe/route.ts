import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getUserIdFromRequest } from "@/lib/auth"

// Transcribes a short audio clip captured by Listening Mode using OpenAI Whisper.
// The client records an utterance (wake phrase + question, or a follow-up
// question) with MediaRecorder and uploads it here as multipart form-data under
// the "audio" field. Returns { text } — empty string when nothing usable was
// heard, so the client can silently keep listening.
export async function POST(request: NextRequest) {
  if (!getUserIdFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY environment variable is not set")
      return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const form = await request.formData()
    const audio = form.get("audio")
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const result = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      // Bias the model toward conversational English and reduce hallucinated
      // text on near-silent clips.
      language: "en",
      temperature: 0,
    })

    return NextResponse.json({ text: (result.text || "").trim() })
  } catch (error) {
    console.error("Transcription error:", error)
    // Soft-fail: the client treats an error like an unclear capture and keeps
    // listening, so never block the loop with a hard error.
    return NextResponse.json({ text: "" })
  }
}
