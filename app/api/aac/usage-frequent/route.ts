import { type NextRequest, NextResponse } from "next/server"
import { getDb, USAGE_EVENTS_COLLECTION } from "@/lib/mongodb"
import { getUserIdFromRequest } from "@/lib/auth"

// Returns the leaf items the current user has actually selected most often
// within a given top-level category, ordered most-frequent first. Powers the
// usage half of the "Frequently Requested" row. Leaf selections are logged as
// `category_select` events with `payload.leaf === true` and `payload.path[0]`
// equal to the top-level category word.
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { category } = await request.json()
    if (!category || typeof category !== "string") {
      return NextResponse.json({ words: [] })
    }

    const db = await getDb()
    const rows = await db
      .collection(USAGE_EVENTS_COLLECTION)
      .aggregate([
        {
          $match: {
            userId,
            type: "category_select",
            "payload.leaf": true,
            "payload.path.0": category,
          },
        },
        { $group: { _id: "$payload.word", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray()

    const words = rows
      .map((r) => r._id)
      .filter((w): w is string => typeof w === "string" && w.length > 0)

    return NextResponse.json({ words })
  } catch (error) {
    console.error("Usage-frequent error:", error)
    return NextResponse.json({ words: [] })
  }
}
