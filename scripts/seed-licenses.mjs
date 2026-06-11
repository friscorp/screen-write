// Manually seed authorized users / license keys into MongoDB.
//
// Usage:
//   Seed all keys in LICENSES array:
//     node scripts/seed-licenses.mjs
//
//   Add a single key on the fly (streamlined, no file edit needed):
//     node scripts/seed-licenses.mjs --add AAC-CUSTOM-0001 user_custom_1
//
// Env (MONGODB_URI, MONGODB_DB) is loaded from .env / .env.local via @next/env,
// exactly the same way the Next.js app loads it — so values that need `$`
// escaping (e.g. passwords with `$`) behave identically here. Do NOT pass
// --env-file: that reads .env literally and would not apply the same escaping.
//
// Edit the LICENSES array below to add permanently tracked keys.
// There is no self-registration — this script (or a direct DB insert) is how
// access is granted.

import nextEnv from "@next/env"
import { MongoClient } from "mongodb"

nextEnv.loadEnvConfig(process.cwd())

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "aac"

if (!uri) {
  console.error("MONGODB_URI is not set. Aborting.")
  process.exit(1)
}

// ─── Tracked license registry ────────────────────────────────────────────────
// All keys that are always kept in sync when running `node scripts/seed-licenses.mjs`.
// licenseKey must be unique; userId is the opaque identifier all usage analytics
// are attributed to.
const LICENSES = [
  // Demo keys
  { licenseKey: "AAC-DEMO-0001", userId: "user_demo_1", active: true },
  { licenseKey: "AAC-DEMO-0002", userId: "user_demo_2", active: true },
  // Test keys
  { licenseKey: "AAC-TEST-0001", userId: "user_test_1", active: true },
  { licenseKey: "AAC-TEST-0002", userId: "user_test_2", active: true },
]
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert a single license entry into the DB. */
async function upsertLicense(licenses, entry) {
  await licenses.updateOne(
    { licenseKey: entry.licenseKey },
    { $set: { ...entry }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )
  console.log(`Upserted license ${entry.licenseKey} -> ${entry.userId}`)
}

async function main() {
  // ── CLI: --add <licenseKey> <userId> ──────────────────────────────────────
  const args = process.argv.slice(2)
  let addEntry = null
  if (args[0] === "--add") {
    const [, licenseKey, userId] = args
    if (!licenseKey || !userId) {
      console.error("Usage: node scripts/seed-licenses.mjs --add <licenseKey> <userId>")
      console.error("Example: node scripts/seed-licenses.mjs --add AAC-CLIENT-0001 user_client_1")
      process.exit(1)
    }
    addEntry = { licenseKey, userId, active: true }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)
    const licenses = db.collection("licenses")

    // Indexes are best-effort: some Atlas roles disallow createIndex. The app
    // works without them; they just enforce uniqueness / speed up analytics.
    try {
      await licenses.createIndex({ licenseKey: 1 }, { unique: true })
      await db.collection("usage_events").createIndex({ userId: 1, ts: -1 })
    } catch (err) {
      console.warn(`Skipping index creation (insufficient privileges): ${err.message}`)
    }

    if (addEntry) {
      // Single key mode — fast path for one-off creation
      await upsertLicense(licenses, addEntry)
      console.log(`\nDone. Added 1 license to "${dbName}".`)
    } else {
      // Bulk seed mode
      for (const entry of LICENSES) {
        await upsertLicense(licenses, entry)
      }
      console.log(`\nDone. Seeded ${LICENSES.length} license(s) into "${dbName}".`)
    }
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
