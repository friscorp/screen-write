import { MongoClient, type Db } from "mongodb"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB || "aac"

// Cache the client on globalThis so it survives Next.js hot-reloads in dev and
// is reused across serverless invocations in production (keeps connections bounded).
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set")
  }
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri)
    globalForMongo._mongoClientPromise = client.connect()
  }
  return globalForMongo._mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise()
  return client.db(dbName)
}

// Collection names used across the app.
export const LICENSES_COLLECTION = "licenses"
export const USAGE_EVENTS_COLLECTION = "usage_events"
