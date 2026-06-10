import { cookies } from "next/headers"
import { AUTH_COOKIE_NAME, verifyAuthCookie } from "@/lib/auth"
import { SmartDrawingEditor } from "@/components/smart-editor"
import { LicenseGate } from "@/components/license-gate"

export default async function Page() {
  const cookieStore = await cookies()
  const userId = verifyAuthCookie(cookieStore.get(AUTH_COOKIE_NAME)?.value)

  if (!userId) {
    return <LicenseGate />
  }

  return <SmartDrawingEditor />
}
