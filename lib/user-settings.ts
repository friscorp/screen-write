import { getDb, USER_SETTINGS_COLLECTION } from "@/lib/mongodb"

export interface UserSettings {
  childName: string
}

interface UserSettingsDoc extends UserSettings {
  userId: string
  createdAt?: Date
  updatedAt?: Date
}

export const MAX_CHILD_NAME_LENGTH = 80

export function parseChildName(value: unknown): { childName: string; error?: string } {
  if (typeof value !== "string") {
    return { childName: "", error: "Child name must be text" }
  }

  const childName = value.trim()
  if (childName.length > MAX_CHILD_NAME_LENGTH) {
    return { childName: "", error: `Child name must be ${MAX_CHILD_NAME_LENGTH} characters or fewer` }
  }

  return { childName }
}

function readStoredChildName(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim().slice(0, MAX_CHILD_NAME_LENGTH)
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const db = await getDb()
  const settings = await db
    .collection<UserSettingsDoc>(USER_SETTINGS_COLLECTION)
    .findOne({ userId }, { projection: { childName: 1 } })

  return {
    childName: readStoredChildName(settings?.childName),
  }
}

export async function saveUserSettings(userId: string, settings: UserSettings): Promise<UserSettings> {
  const now = new Date()
  const db = await getDb()

  await db.collection<UserSettingsDoc>(USER_SETTINGS_COLLECTION).updateOne(
    { userId },
    {
      $set: {
        childName: settings.childName,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        createdAt: now,
      },
    },
    { upsert: true },
  )

  return settings
}
