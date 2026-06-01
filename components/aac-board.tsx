"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trash2, Volume2, ChevronLeft, Home, Loader2, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Tree node structure for hierarchical navigation
interface TreeNode {
  word: string
  emoji: string
  // The phrase added to the conversation when selected (optional)
  // If not provided, the word itself is added
  phrase?: string
  // Child nodes for the next level
  children?: TreeNode[]
}

// Hierarchical category tree
// Level 0: Top categories (Food, Play)
// Level 1: Sub-categories that map to phrase starters (Drink → "I want to drink")
// Level 2: Specific items that complete the phrase (Water → completes to "I want to drink water")
const CATEGORY_TREE: TreeNode[] = [
  {
    word: "Food",
    emoji: "🍕",
    children: [
      {
        word: "Drink",
        emoji: "🥤",
        phrase: "I want to drink",
        children: [
          { word: "Water", emoji: "💧" },
          { word: "Milk", emoji: "🥛" },
          { word: "Juice", emoji: "🧃" },
          { word: "Soda", emoji: "🥤" },
        ],
      },
      {
        word: "Meal",
        emoji: "🍽️",
        phrase: "I want to eat",
        children: [
          { word: "Pizza", emoji: "🍕" },
          { word: "Sandwich", emoji: "🥪" },
          { word: "Pasta", emoji: "🍝" },
          { word: "Fruit", emoji: "🍎" },
        ],
      },
      {
        word: "Snack",
        emoji: "🍪",
        phrase: "I want a snack",
        children: [
          { word: "Cookies", emoji: "🍪" },
          { word: "Chips", emoji: "🍟" },
          { word: "Crackers", emoji: "🥨" },
          { word: "Candy", emoji: "🍬" },
        ],
      },
    ],
  },
  {
    word: "Play",
    emoji: "🎮",
    children: [
      {
        word: "Outside",
        emoji: "🌳",
        phrase: "I want to play outside",
        children: [
          { word: "Park", emoji: "🏞️" },
          { word: "Run", emoji: "🏃" },
          { word: "Swing", emoji: "🛝" },
          { word: "Bike", emoji: "🚲" },
        ],
      },
      {
        word: "Games",
        emoji: "🎲",
        phrase: "I want to play games",
        children: [
          { word: "Cards", emoji: "🃏" },
          { word: "Puzzle", emoji: "🧩" },
          { word: "Board", emoji: "🎯" },
          { word: "Video", emoji: "🕹️" },
        ],
      },
      {
        word: "Toys",
        emoji: "🧸",
        phrase: "I want to play with",
        children: [
          { word: "Blocks", emoji: "🧱" },
          { word: "Doll", emoji: "🪆" },
          { word: "Cars", emoji: "🚗" },
          { word: "Ball", emoji: "⚽" },
        ],
      },
    ],
  },
]

interface PredictedItem {
  word: string
  emoji: string
}

const QUICK_RESPONSES = [
  { word: "Yes", emoji: "👍", color: "from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border-green-300 hover:border-green-500" },
  { word: "No", emoji: "👎", color: "from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border-red-300 hover:border-red-500" },
  { word: "I don't know", emoji: "🤷", color: "from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200 border-yellow-300 hover:border-yellow-500" },
  { word: "Maybe", emoji: "🤔", color: "from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 border-purple-300 hover:border-purple-500" },
  { word: "More", emoji: "➕", color: "from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 border-blue-300 hover:border-blue-500" },
  { word: "All done", emoji: "✋", color: "from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 border-orange-300 hover:border-orange-500" },
  { word: "Again", emoji: "🔄", color: "from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 border-teal-300 hover:border-teal-500" },
]

export function AACBoard() {
  // The current sentence being built
  const [sentence, setSentence] = useState<string>("")
  // Path through the tree (e.g., ["Food", "Drink"])
  const [path, setPath] = useState<TreeNode[]>([])
  // AI-predicted items (shown as a supplement)
  const [predictions, setPredictions] = useState<PredictedItem[]>([])
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false)
  const [showPredictions, setShowPredictions] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState("")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Get current options to display based on path
  const getCurrentOptions = (): TreeNode[] => {
    if (path.length === 0) {
      return CATEGORY_TREE
    }
    const lastNode = path[path.length - 1]
    return lastNode.children || []
  }

  // Speak text using the browser's built-in Web Speech API for instant playback
  const speakText = useCallback((text: string) => {
    if (!text.trim()) return

    // Cancel any in-flight audio (legacy) or queued utterances
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

    // Prefer a clear English voice if available
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice =
      voices.find((v) => v.lang.startsWith("en") && /female|samantha|google/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en"))
    if (preferredVoice) utterance.voice = preferredVoice

    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [])

  // Get LLM predictions for additional context-aware suggestions
  const fetchPredictions = useCallback(
    async (currentSentence: string, category: string | null) => {
      setIsLoadingPredictions(true)
      setError("")

      try {
        const response = await fetch("/api/aac/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentence: currentSentence,
            category,
          }),
        })

        if (!response.ok) {
          throw new Error("Failed to get predictions")
        }

        const data = await response.json()
        if (data.predictions && Array.isArray(data.predictions)) {
          setPredictions(data.predictions.slice(0, 4))
        }
      } catch (err) {
        console.error("Prediction error:", err)
        setError("Could not load smart suggestions.")
      } finally {
        setIsLoadingPredictions(false)
      }
    },
    [],
  )

  // Handle selection of a tree node
  const handleNodeSelect = useCallback(
    (node: TreeNode) => {
      const isLeaf = !node.children || node.children.length === 0
      const newPath = [...path, node]

      if (isLeaf) {
        // Leaf node: visually complete the full phrase, but TTS speaks ONLY the new word
        // so the user hears a natural sequential utterance:
        //   Top-level click spoke "Food"
        //   Sub-category click spoke "I want to eat"
        //   Now the leaf click speaks just "pizza"
        // Together: "Food" → "I want to eat" → "pizza"
        const parentWithPhrase = [...newPath].reverse().find((n) => n.phrase)
        const baseSentence = sentence.trim()
        const phrasePart = parentWithPhrase?.phrase || ""

        let finalSentence: string
        if (phrasePart) {
          // Build the full phrase from the parent's phrase + this word
          finalSentence = `${phrasePart} ${node.word.toLowerCase()}`
        } else if (baseSentence) {
          // Fallback: append to existing sentence
          finalSentence = `${baseSentence} ${node.word.toLowerCase()}`
        } else {
          finalSentence = node.word
        }

        setSentence(finalSentence)
        // Speak ONLY the newly added word, not the full sentence
        speakText(node.word)

        // Reset to top level for next phrase
        setPath([])
        setPredictions([])
        setShowPredictions(false)
      } else {
        // Branch node: navigate deeper
        setPath(newPath)
        setShowPredictions(false)
        setPredictions([])

        // If this node has a phrase, set it as the current sentence draft and speak it
        if (node.phrase) {
          setSentence(node.phrase)
          speakText(node.phrase)
        } else {
          // Top-level category - just speak the category name
          speakText(node.word)
        }
      }
    },
    [path, sentence, speakText],
  )

  // Handle prediction (AI-suggested) selection
  const handlePredictionSelect = useCallback(
    (item: PredictedItem) => {
      const newSentence = sentence.trim()
        ? `${sentence.trim()} ${item.word.toLowerCase()}`
        : item.word

      setSentence(newSentence)
      speakText(newSentence)
      setPath([])
      setPredictions([])
      setShowPredictions(false)
    },
    [sentence, speakText],
  )

  // Navigate back one level
  const goBack = useCallback(() => {
    const newPath = path.slice(0, -1)
    setPath(newPath)
    setPredictions([])
    setShowPredictions(false)

    // If we went back to top level, also clear the in-progress phrase
    if (newPath.length === 0) {
      // Only clear the phrase part, keep already-completed sentence
      // Find if current sentence equals just the phrase of the last selected node
      const wasPhrase = path.find((n) => n.phrase && sentence === n.phrase)
      if (wasPhrase) {
        setSentence("")
      }
    }
  }, [path, sentence])

  // Go to home (top level)
  const goHome = useCallback(() => {
    setPath([])
    setPredictions([])
    setShowPredictions(false)
  }, [])

  // Clear everything
  const clearAll = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    window.speechSynthesis.cancel()
    setSentence("")
    setPath([])
    setPredictions([])
    setShowPredictions(false)
    setError("")
    setIsSpeaking(false)
  }, [])

  // Handle quick response button tap
  const handleQuickResponse = useCallback(
    (response: { word: string; emoji: string }) => {
      setSentence(response.word)
      setPath([])
      setPredictions([])
      setShowPredictions(false)
      speakText(response.word)
    },
    [speakText],
  )

  // Replay the full sentence
  const replaySentence = useCallback(() => {
    if (sentence) {
      speakText(sentence)
    }
  }, [sentence, speakText])

  // Toggle smart predictions
  const toggleSmartSuggestions = useCallback(() => {
    if (!showPredictions) {
      const currentCategory = path.length > 0 ? path[0].word : null
      fetchPredictions(sentence, currentCategory)
    }
    setShowPredictions(!showPredictions)
  }, [showPredictions, sentence, path, fetchPredictions])

  const currentOptions = getCurrentOptions()
  const currentLevelTitle =
    path.length === 0
      ? "Choose a category"
      : path.length === 1
        ? `What kind of ${path[0].word.toLowerCase()}?`
        : "Pick one"

  return (
    <div className="space-y-6">
      {/* Sentence Display Bar */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              Your Message
              {isSpeaking && (
                <span className="flex items-center gap-1 text-primary text-sm font-normal">
                  <Volume2 className="w-4 h-4 animate-pulse" />
                  Speaking...
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
          <div className="min-h-[60px] p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center">
            {sentence ? (
              <p className="text-2xl font-medium text-foreground text-balance">{sentence}</p>
            ) : (
              <p className="text-lg text-muted-foreground italic">
                Tap a category to start building your message...
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Responses */}
      <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
        <CardHeader className="pb-3">
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
                className={`flex flex-col items-center justify-center p-3 bg-gradient-to-br ${response.color} border-2 rounded-xl transition-all duration-150 transform hover:scale-105 active:scale-95 min-h-[90px] shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400`}
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

      {/* Breadcrumb Navigation */}
      {path.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={goHome} className="h-8">
            <Home className="w-4 h-4 mr-1" />
            Home
          </Button>
          {path.map((node, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              <span className="flex items-center gap-1 text-sm font-medium">
                <span className="text-lg">{node.emoji}</span>
                {node.word}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Options Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>{currentLevelTitle}</CardTitle>
            <div className="flex items-center gap-2">
              {path.length > 0 && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                variant={showPredictions ? "default" : "outline"}
                size="sm"
                onClick={toggleSmartSuggestions}
                disabled={isLoadingPredictions}
              >
                {isLoadingPredictions ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Smart Suggestions
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentOptions.map((node) => (
              <button
                key={node.word}
                onClick={() => handleNodeSelect(node)}
                className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-background to-muted hover:from-primary/10 hover:to-primary/5 border-2 border-border hover:border-primary rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 min-h-[160px] shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label={`Select ${node.word}${node.children ? `, has more options` : ""}`}
              >
                <span className="text-6xl mb-3" role="img" aria-hidden="true">
                  {node.emoji}
                </span>
                <span className="text-lg font-semibold text-foreground text-center text-balance">
                  {node.word}
                </span>
                {node.children && node.children.length > 0 && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {node.children.length} options
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Smart Predictions Section */}
          {showPredictions && (
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">AI Suggestions</h3>
              </div>
              {isLoadingPredictions ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : predictions.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {predictions.map((item, index) => (
                    <button
                      key={`${item.word}-${index}`}
                      onClick={() => handlePredictionSelect(item)}
                      className="flex flex-col items-center justify-center p-4 bg-primary/5 hover:bg-primary/10 border-2 border-primary/20 hover:border-primary/50 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 min-h-[100px]"
                    >
                      <span className="text-3xl mb-2" role="img" aria-hidden="true">
                        {item.emoji}
                      </span>
                      <span className="text-sm font-medium text-foreground text-center">
                        {item.word}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center p-4">
                  No suggestions available. Try selecting a category first.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
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
              <span className="font-medium text-foreground">Pick a category</span> like Food or
              Play to start building a message
            </li>
            <li>
              <span className="font-medium text-foreground">Choose what you want</span> (e.g.,
              Drink, Meal, Snack) — this builds the start of your sentence
            </li>
            <li>
              <span className="font-medium text-foreground">Pick a specific item</span> (e.g.,
              Water) — your full message is spoken aloud
            </li>
            <li>
              Use <span className="font-medium text-foreground">Smart Suggestions</span> for
              AI-powered alternatives at any level
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
