import { type NextRequest, NextResponse } from "next/server"
import { getDb, LICENSES_COLLECTION } from "@/lib/mongodb"
import { AUTH_COOKIE_NAME, COOKIE_MAX_AGE, signUserId } from "@/lib/auth"

interface LicenseDoc {
  licenseKey: string
  userId: string
  active?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const { licenseKey } = await request.json()

    if (!licenseKey || typeof licenseKey !== "string" || !licenseKey.trim()) {
      return NextResponse.json({ success: false, error: "License key is required" }, { status: 400 })
    }

    const key = licenseKey.trim()
    const db = await getDb()
    const license = await db
      .collection<LicenseDoc>(LICENSES_COLLECTION)
      .findOne({ licenseKey: key, active: { $ne: false } })

    if (!license) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive license key" },
        { status: 401 },
      )
    }

    // Record activation for auditing (best-effort — never block login on this).
    try {
      await db
        .collection<LicenseDoc>(LICENSES_COLLECTION)
        .updateOne({ licenseKey: key }, { $set: { lastActivatedAt: new Date() } })
    } catch (auditError) {
      console.warn("Could not record lastActivatedAt:", auditError)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(AUTH_COOKIE_NAME, signUserId(license.userId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    })
    return response
  } catch (error) {
    console.error("License activation error:", error)
    return NextResponse.json({ success: false, error: "Activation failed" }, { status: 500 })
  }
}
