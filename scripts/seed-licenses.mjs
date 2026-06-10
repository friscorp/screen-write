// Manually seed authorized users / license keys into MongoDB.
//
// Usage:
//   Run: node scripts/seed-licenses.mjs
//
// Env (MONGODB_URI, MONGODB_DB) is loaded from .env / .env.local via @next/env,
// exactly the same way the Next.js app loads it — so values that need `$`
// escaping (e.g. passwords with `$`) behave identically here. Do NOT pass
// --env-file: that reads .env literally and would not apply the same escaping.
//
// Edit the LICENSES array below to add real authorized users. There is no
// self-registration — this script (or a direct DB insert) is how access is granted.

import nextEnv from "@next/env"
import { MongoClient } from "mongodb"

nextEnv.loadEnvConfig(process.cwd())

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "aac"

if (!uri) {
  console.error("MONGODB_URI is not set. Aborting.")
  process.exit(1)
}

// Add/modify entries here. licenseKey must be unique; userId is the opaque
// identifier all usage analytics are attributed to.
const LICENSES = [
  { licenseKey: "AAC-DEMO-0001", userId: "user_demo_1", active: true },
  { licenseKey: "AAC-DEMO-0002", userId: "user_demo_2", active: true },
]

async function main() {
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

    for (const entry of LICENSES) {
      await licenses.updateOne(
        { licenseKey: entry.licenseKey },
        { $set: { ...entry }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      )
      console.log(`Upserted license ${entry.licenseKey} -> ${entry.userId}`)
    }

    console.log(`\nDone. Seeded ${LICENSES.length} license(s) into "${dbName}".`)
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
