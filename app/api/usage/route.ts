import { type NextRequest, NextResponse } from "next/server"
import { getDb, USAGE_EVENTS_COLLECTION } from "@/lib/mongodb"
import { getUserIdFromRequest } from "@/lib/auth"

const ALLOWED_TYPES = new Set(["category_select", "navigation", "sentence", "listen"])
const MAX_EVENTS_PER_REQUEST = 100
const MAX_PAYLOAD_BYTES = 4000

interface IncomingEvent {
  type: string
  payload?: unknown
  ts?: number
}

export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // sendBeacon may send as text/plain or a Blob, so parse the raw body ourselves.
    const raw = await request.text()
    if (!raw) return new NextResponse(null, { status: 204 })

    const body = JSON.parse(raw)
    const events: IncomingEvent[] = Array.isArray(body?.events) ? body.events : []
    if (events.length === 0) return new NextResponse(null, { status: 204 })

    const now = new Date()
    const docs = events
      .slice(0, MAX_EVENTS_PER_REQUEST)
      .filter((e) => e && typeof e.type === "string" && ALLOWED_TYPES.has(e.type))
      .map((e) => {
        let payload = e.payload ?? {}
        // Cap payload size to avoid abuse.
        try {
          if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) payload = { truncated: true }
        } catch {
          payload = {}
        }
        return {
          userId,
          type: e.type,
          payload,
          ts: typeof e.ts === "number" ? new Date(e.ts) : now,
          receivedAt: now,
        }
      })

    if (docs.length > 0) {
      const db = await getDb()
      await db.collection(USAGE_EVENTS_COLLECTION).insertMany(docs)
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Usage logging error:", error)
    // Don't surface failures to the client beacon; just acknowledge.
    return new NextResponse(null, { status: 204 })
  }
}
