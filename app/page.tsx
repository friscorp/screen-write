import type { Metadata } from "next"
import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, verifyAuthCookie } from "@/lib/auth"
import { SmartDrawingEditor } from "@/components/smart-editor"
import { LicenseGate } from "@/components/license-gate"
import { getUserSettings, type UserSettings } from "@/lib/user-settings"

const DEFAULT_PAGE_TITLE = "speaker"

async function getAuthenticatedUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return verifyAuthCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value)
}

async function loadUserSettings(userId: string): Promise<UserSettings> {
  try {
    return await getUserSettings(userId)
  } catch (error) {
    console.warn("Could not load user settings:", error)
    return { childName: "" }
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const userId = await getAuthenticatedUserId()
  if (!userId) return { title: DEFAULT_PAGE_TITLE }

  const settings = await loadUserSettings(userId)
  return { title: settings.childName || DEFAULT_PAGE_TITLE }
}

export default async function Page() {
  const userId = await getAuthenticatedUserId()

  if (!userId) {
    return <LicenseGate />
  }

  const settings = await loadUserSettings(userId)

  return <SmartDrawingEditor initialChildName={settings.childName} />
}
