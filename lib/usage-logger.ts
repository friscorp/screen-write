"use client"

// Lightweight client-side usage logger. Events are buffered and flushed in
// batches via navigator.sendBeacon (falling back to fetch with keepalive), so
// logging adds minimal latency and survives page unloads. The user identity is
// attached server-side from the signed auth cookie — never sent from here.

export type UsageEventType = "category_select" | "navigation" | "sentence"

interface BufferedEvent {
  type: UsageEventType
  payload: Record<string, unknown>
  ts: number
}

const ENDPOINT = "/api/usage"
const FLUSH_DEBOUNCE_MS = 3000
const MAX_BUFFER = 20

let buffer: BufferedEvent[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
let listenersAttached = false

function send(events: BufferedEvent[]): void {
  if (events.length === 0) return
  const body = JSON.stringify({ events })

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" })
    const ok = navigator.sendBeacon(ENDPOINT, blob)
    if (ok) return
  }

  // Fallback: keepalive fetch so it can complete during unload.
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* best-effort; ignore failures */
  })
}

export function flush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (buffer.length === 0) return
  const events = buffer
  buffer = []
  send(events)
}

function ensureListeners(): void {
  if (listenersAttached || typeof window === "undefined") return
  listenersAttached = true
  // Flush remaining events when the tab is hidden or being unloaded.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush()
  })
  window.addEventListener("pagehide", () => flush())
}

export function logEvent(type: UsageEventType, payload: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return
  ensureListeners()

  buffer.push({ type, payload, ts: Date.now() })

  if (buffer.length >= MAX_BUFFER) {
    flush()
    return
  }

  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(flush, FLUSH_DEBOUNCE_MS)
}
