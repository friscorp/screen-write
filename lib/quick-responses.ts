export interface QuickResponse {
  id: string
  word: string
  emoji: string
  color: string
}

export const QUICK_RESPONSES_KEY = "aac-quick-responses"

// Rotating palette so newly added responses still get a distinct tile color
// without a parent having to pick one.
const COLOR_PALETTE = [
  "from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-green-300 hover:border-green-500",
  "from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-red-300 hover:border-red-500",
  "from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 border-yellow-300 hover:border-yellow-500",
  "from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-purple-300 hover:border-purple-500",
  "from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300 border-emerald-400 hover:border-emerald-600",
  "from-rose-100 to-rose-200 hover:from-rose-200 hover:to-rose-300 border-rose-400 hover:border-rose-600",
  "from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 border-teal-300 hover:border-teal-500",
  "from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-300 hover:border-blue-500",
  "from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-orange-300 hover:border-orange-500",
  "from-pink-50 to-pink-100 hover:from-pink-100 hover:to-pink-200 border-pink-300 hover:border-pink-500",
]

export function colorForIndex(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length]
}

export const DEFAULT_QUICK_RESPONSES: QuickResponse[] = [
  { id: "yes", word: "Yes", emoji: "👍", color: colorForIndex(0) },
  { id: "no", word: "No", emoji: "👎", color: colorForIndex(1) },
  { id: "dont-know", word: "I don't know", emoji: "🤷", color: colorForIndex(2) },
  { id: "maybe", word: "Maybe", emoji: "🤔", color: colorForIndex(3) },
  { id: "more", word: "More", emoji: "➕", color: colorForIndex(4) },
  { id: "all-done", word: "All done", emoji: "✋", color: colorForIndex(5) },
  { id: "again", word: "Again", emoji: "🔁", color: colorForIndex(6) },
]

export function loadQuickResponses(): QuickResponse[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_RESPONSES
  try {
    const saved = localStorage.getItem(QUICK_RESPONSES_KEY)
    if (!saved) return DEFAULT_QUICK_RESPONSES
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_QUICK_RESPONSES
    return parsed as QuickResponse[]
  } catch {
    return DEFAULT_QUICK_RESPONSES
  }
}

export function saveQuickResponses(list: QuickResponse[]): void {
  localStorage.setItem(QUICK_RESPONSES_KEY, JSON.stringify(list))
}
