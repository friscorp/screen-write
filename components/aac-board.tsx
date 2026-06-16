"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Volume2, ChevronLeft, Home, Loader2, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { VocabCategory, VocabBranch, VocabLeaf } from "@/lib/vocab-tree"
import { logEvent } from "@/lib/usage-logger"

type PathItem = VocabCategory | VocabBranch
type DisplayItem = VocabCategory | VocabBranch | VocabLeaf

function isLeaf(node: DisplayItem): node is VocabLeaf {
  return "sentence" in node
}

// All Level 3 leaves under a top-level category, flattened across sub-categories.
function collectLeaves(category: VocabCategory): VocabLeaf[] {
  return category.children.flatMap((branch) => branch.children)
}

// Deterministic fallback used when AI selection is unavailable: one item from
// each sub-category first (for variety), then fill from the remaining leaves.
function defaultFrequent(category: VocabCategory, limit = 6): VocabLeaf[] {
  const result: VocabLeaf[] = []
  for (const branch of category.children) {
    if (branch.children[0] && !result.includes(branch.children[0])) result.push(branch.children[0])
    if (result.length >= limit) return result.slice(0, limit)
  }
  for (const leaf of collectLeaves(category)) {
    if (result.length >= limit) break
    if (!result.includes(leaf)) result.push(leaf)
  }
  return result.slice(0, limit)
}

const QUICK_RESPONSES = [
  {
    word: "Yes",
    emoji: "👍",
    color:
      "from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-green-300 hover:border-green-500",
  },
  {
    word: "No",
    emoji: "👎",
    color:
      "from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-red-300 hover:border-red-500",
  },
  {
    word: "I don't know",
    emoji: "🤷",
    color:
      "from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 border-yellow-300 hover:border-yellow-500",
  },
  {
    word: "Maybe",
    emoji: "🤔",
    color:
      "from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-purple-300 hover:border-purple-500",
  },
  {
    word: "More",
    emoji: "➕",
    // Green-toned to read as "continue / keep going"
    color:
      "from-emerald-100 to-emerald-200 hover:from-emerald-200 hover:to-emerald-300 border-emerald-400 hover:border-emerald-600",
  },
  {
    word: "All done",
    emoji: "✋",
    // Red-toned to read as opposite of More
    color:
      "from-rose-100 to-rose-200 hover:from-rose-200 hover:to-rose-300 border-rose-400 hover:border-rose-600",
  },
  {
    word: "Again",
    emoji: "🔁",
    color:
      "from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 border-teal-300 hover:border-teal-500",
  },
]

export function AACBoard({
  focusMode = false,
  vocabTree,
}: {
  focusMode?: boolean
  vocabTree: VocabCategory[]
}) {
  const [sentence, setSentence] = useState<string>("")
  const [path, setPath] = useState<PathItem[]>([])
  const [frequentItems, setFrequentItems] = useState<VocabLeaf[]>([])
  const [loadingFrequent, setLoadingFrequent] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Cache of derived "Frequently Requested" leaves, keyed by category id.
  const frequentCacheRef = useRef<Record<string, VocabLeaf[]>>({})

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Reset path if vocabTree changes underneath us (e.g. parent config saved)
  useEffect(() => {
    setPath([])
    frequentCacheRef.current = {}
    setFrequentItems([])
  }, [vocabTree])

  // Derive the "Frequently Requested" row whenever we enter a top-level category.
  useEffect(() => {
    if (path.length !== 1) {
      setFrequentItems([])
      return
    }
    const category = path[0] as VocabCategory
    const leaves = collectLeaves(category)
    if (leaves.length === 0) {
      setFrequentItems([])
      return
    }

    const cached = frequentCacheRef.current[category.id]
    if (cached) {
      setFrequentItems(cached)
      return
    }

    let cancelled = false
    const load = async () => {
      setLoadingFrequent(true)
      const fallback = defaultFrequent(category)
      let items = fallback
      try {
        const res = await fetch("/api/aac/frequent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: category.word,
            description: category.description,
            items: leaves.map((l) => ({ word: l.word, emoji: l.emoji })),
            limit: 6,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.words) && data.words.length > 0) {
            const byWord = new Map(leaves.map((l) => [l.word.toLowerCase(), l]))
            const mapped = data.words
              .map((w: string) => byWord.get(String(w).toLowerCase()))
              .filter((l: VocabLeaf | undefined): l is VocabLeaf => Boolean(l))
            if (mapped.length > 0) items = mapped
          }
        }
      } catch {
        // keep deterministic fallback
      }
      if (!cancelled) {
        frequentCacheRef.current[category.id] = items
        setFrequentItems(items)
        setLoadingFrequent(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [path])

  const getCurrentOptions = (): DisplayItem[] => {
    if (path.length === 0) return vocabTree
    const lastNode = path[path.length - 1]
    return (lastNode as VocabCategory | VocabBranch).children ?? []
  }

  const speakText = useCallback((text: string) => {
    if (!text.trim()) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("Speech synthesis is not supported in this browser.")
      return
    }
    window.speechSynthesis.cancel()
    setIsSpeaking(true)
    setError("")

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.1
    utterance.volume = 1

    const voices = window.speechSynthesis.getVoices()
    const preferredVoice =
      voices.find((v) => v.lang.startsWith("en") && /female|samantha|google/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en"))
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const handleNodeSelect = useCallback(
    (node: DisplayItem) => {
      const pathWords = path.map((p) => p.word)
      if (isLeaf(node)) {
        // Leaf: speak the full pre-generated sentence
        logEvent("category_select", { word: node.word, emoji: node.emoji, level: path.length, leaf: true, path: pathWords })
        logEvent("sentence", { text: node.sentence, source: "leaf", path: pathWords })
        setSentence(node.sentence)
        speakText(node.sentence)
        setPath([])
      } else if (path.length === 0) {
        // Level 0 → 1: selected a VocabCategory
        logEvent("category_select", { word: node.word, emoji: node.emoji, level: 0, path: pathWords })
        logEvent("navigation", { action: "enter", path: [node.word] })
        setPath([node as VocabCategory])
        speakText(node.word)
      } else {
        // Level 1 → 2: selected a VocabBranch
        logEvent("category_select", { word: node.word, emoji: node.emoji, level: path.length, path: pathWords })
        logEvent("navigation", { action: "enter", path: [...pathWords, node.word] })
        setPath((prev) => [...prev, node as VocabBranch])
        speakText(node.word)
      }
    },
    [path, speakText],
  )

  const goBack = useCallback(() => {
    const newPath = path.slice(0, -1)
    logEvent("navigation", { action: "back", path: newPath.map((p) => p.word) })
    setPath(newPath)
    if (newPath.length === 0) setSentence("")
  }, [path])

  const goHome = useCallback(() => {
    logEvent("navigation", { action: "home", path: [] })
    setPath([])
    setSentence("")
  }, [])

  const clearAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis.cancel()
    setSentence("")
    setPath([])
    setError("")
    setIsSpeaking(false)
  }, [])

  const handleQuickResponse = useCallback(
    (response: { word: string; emoji: string }) => {
      logEvent("sentence", { text: response.word, source: "quick_response" })
      setSentence(response.word)
      setPath([])
      speakText(response.word)
    },
    [speakText],
  )

  const replaySentence = useCallback(() => {
    if (sentence) speakText(sentence)
  }, [sentence, speakText])

  const currentOptions = getCurrentOptions()
  const atLeafLevel = path.length === 2

  const currentLevelTitle =
    path.length === 0
      ? "Choose a category"
      : path.length === 1
        ? `What kind of ${path[0].word.toLowerCase()}?`
        : "Pick one"

  return (
    <div className="space-y-4">
      {/* Sentence Display */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              Your Message
              {isSpeaking && (
                <span className="flex items-center gap-1 text-primary text-sm font-normal">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Speaking…
                </span>
              )}
            </CardTitle>
            {sentence && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={replaySentence} disabled={isSpeaking}>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Replay
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="min-h-[64px] p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center">
            {sentence ? (
              <p className="text-2xl font-medium text-foreground text-balance">{sentence}</p>
            ) : (
              <p className="text-lg text-muted-foreground italic">
                Tap a category to start building your message…
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Responses — always visible */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-lg">💬</span>
            Quick Responses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            {QUICK_RESPONSES.map((response) => (
              <button
                key={response.word}
                onClick={() => handleQuickResponse(response)}
                className={`flex flex-col items-center justify-center p-3 bg-gradient-to-br ${response.color} border-2 rounded-xl transition-all duration-150 transform hover:scale-105 active:scale-95 min-h-[90px] shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary`}
                aria-label={`Say ${response.word}`}
              >
                <span className="text-3xl mb-1" role="img" aria-hidden="true">
                  {response.emoji}
                </span>
                <span className="text-xs font-semibold text-center leading-tight text-gray-700">
                  {response.word}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Navigation */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>{currentLevelTitle}</CardTitle>
          </div>

          {/* Breadcrumb */}
          {path.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <button
                onClick={goHome}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="w-3 h-3" />
                Home
              </button>
              {path.map((node, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">/</span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    <span className="text-base">{node.emoji}</span>
                    {node.word}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Large Back Button — visible whenever not at root */}
          {path.length > 0 && (
            <button
              onClick={goBack}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 border-2 border-gray-300 hover:border-gray-400 rounded-xl transition-all duration-150 font-semibold text-gray-700 text-lg"
            >
              <ChevronLeft className="w-6 h-6" />
              Back
            </button>
          )}

          {/* Frequently Requested — derived leaves shown above the sub-categories */}
          {path.length === 1 && (frequentItems.length > 0 || loadingFrequent) && (
            <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/60 to-orange-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-sm text-gray-700">Frequently Requested</h3>
                {loadingFrequent && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
              </div>
              {frequentItems.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {frequentItems.map((leaf) => (
                    <button
                      key={`freq-${leaf.word}`}
                      onClick={() => handleNodeSelect(leaf)}
                      className="flex flex-col items-center justify-center p-3 bg-white/70 hover:bg-white border-2 border-amber-200 hover:border-amber-400 rounded-xl transition-all duration-150 transform hover:scale-105 active:scale-95 min-h-[90px] shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-400"
                      aria-label={`Say ${leaf.word}`}
                    >
                      <span className="text-3xl mb-1" role="img" aria-hidden="true">
                        {leaf.emoji}
                      </span>
                      <span className="text-xs font-semibold text-center leading-tight text-gray-700">
                        {leaf.word}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Options Grid */}
          <div className={`grid gap-4 ${atLeafLevel ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 md:grid-cols-3"}`}>
            {currentOptions.length === 0 ? (
              <p className="col-span-full text-center text-muted-foreground py-8 text-sm">
                No options available. A parent can generate vocabulary in Settings → Manage Categories.
              </p>
            ) : (
              currentOptions.map((node) => {
                const leaf = isLeaf(node)
                return (
                  <button
                    key={node.word}
                    onClick={() => handleNodeSelect(node)}
                    className={`flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted hover:from-primary/10 hover:to-primary/5 border-2 border-border hover:border-primary rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${leaf ? "min-h-[130px]" : "min-h-[160px]"}`}
                    aria-label={`Select ${node.word}${!leaf ? ", has more options" : ""}`}
                  >
                    <span className={`${leaf ? "text-4xl mb-2" : "text-6xl mb-3"}`} role="img" aria-hidden="true">
                      {node.emoji}
                    </span>
                    <span className={`font-semibold text-foreground text-center text-balance ${leaf ? "text-base" : "text-lg"}`}>
                      {node.word}
                    </span>
                    {!leaf && (node as VocabCategory | VocabBranch).children.length > 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
                        {(node as VocabCategory | VocabBranch).children.length} options
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions — hidden in Focus View */}
      {!focusMode && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Use <span className="font-medium text-foreground">Quick Responses</span> (Yes, No,
                Maybe…) to answer questions instantly with one tap
              </li>
              <li>
                <span className="font-medium text-foreground">Pick a category</span> like Food,
                Play, or Feelings to start
              </li>
              <li>
                Tap a <span className="font-medium text-foreground">Frequently Requested</span> item
                to say it right away, or choose a sub-category to keep browsing
              </li>
              <li>
                <span className="font-medium text-foreground">Choose a sub-category</span> — this
                narrows your message
              </li>
              <li>
                <span className="font-medium text-foreground">Pick a specific item</span> — your
                full message is spoken aloud automatically
              </li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
