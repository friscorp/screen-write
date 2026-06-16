import { type NextRequest, NextResponse } from "next/server"
import { getUserIdFromRequest } from "@/lib/auth"
import { getUserSettings, parseChildName, saveUserSettings } from "@/lib/user-settings"

export async function GET(request: NextRequest) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const settings = await getUserSettings(userId)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Settings load error:", error)
    return NextResponse.json({ error: "Could not load settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { childName, error } = parseChildName(body?.childName)

    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    const settings = await saveUserSettings(userId, { childName })
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error("Settings save error:", error)
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 })
  }
}
