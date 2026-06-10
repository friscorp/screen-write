import { createHmac, timingSafeEqual } from "crypto"
import type { NextRequest } from "next/server"

export const AUTH_COOKIE_NAME = "aac_uid"
// 1 year, in seconds.
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function getSecret(): string {
  const secret = process.env.LICENSE_COOKIE_SECRET
  if (!secret) {
    throw new Error("LICENSE_COOKIE_SECRET environment variable is not set")
  }
  return secret
}

function hmac(userId: string): string {
  return createHmac("sha256", getSecret()).update(userId).digest("base64url")
}

/**
 * Produce a signed cookie value of the form "<userId>.<hmac>".
 * The userId is opaque and never the license key itself.
 */
export function signUserId(userId: string): string {
  return `${userId}.${hmac(userId)}`
}

/**
 * Verify a signed cookie value and return the userId, or null if invalid.
 */
export function verifyAuthCookie(value: string | undefined | null): string | null {
  if (!value) return null
  const lastDot = value.lastIndexOf(".")
  if (lastDot <= 0) return null

  const userId = value.slice(0, lastDot)
  const providedSig = value.slice(lastDot + 1)
  const expectedSig = hmac(userId)

  // Constant-time comparison; lengths must match for timingSafeEqual.
  const provided = Buffer.from(providedSig)
  const expected = Buffer.from(expectedSig)
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null

  return userId
}

/**
 * Read and verify the auth cookie from an API request, returning the userId or null.
 */
export function getUserIdFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value
  return verifyAuthCookie(cookie)
}
