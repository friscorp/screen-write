"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Trash2, Volume2, VolumeX, AlertCircle, Settings, ChevronDown, ChevronUp, Eye, EyeOff, Pencil, MessageSquare, Lock, LayoutGrid, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AACBoard } from "@/components/aac-board"
import { ParentConfig } from "@/components/parent-config"
import { loadVocabTree, saveVocabTree, type VocabCategory } from "@/lib/vocab-tree"

const HOLD_DURATION_MS = 3000
const HOLD_CIRCUMFERENCE = 2 * Math.PI * 23
const DEFAULT_DOCUMENT_TITLE = "speaker"
const CHILD_NAME_MAX_LENGTH = 80

interface SmartDrawingEditorProps {
  initialChildName?: string
}

export function SmartDrawingEditor({ initialChildName = "" }: SmartDrawingEditorProps) {
  const [drawEnabled, setDrawEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState("communicate")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [outputText, setOutputText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null)
  const [errorMessage, setErrorMessage] = useState("")
  const [pauseDuration, setPauseDuration] = useState(2) // Default 2 seconds
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [textAreaExpanded, setTextAreaExpanded] = useState(false)

  // Simple mode (one tap to items, skipping sub-categories) is the default —
  // testing showed two levels of choices before reaching an item overstimulated kids.
  const [simpleMode, setSimpleMode] = useState(true)
  const [vocabTree, setVocabTree] = useState<VocabCategory[]>([])
  const [parentConfigOpen, setParentConfigOpen] = useState(false)
  const [savedChildName, setSavedChildName] = useState(initialChildName.trim())
  const [childNameDraft, setChildNameDraft] = useState(initialChildName.trim())
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [settingsSaveMessage, setSettingsSaveMessage] = useState("")
  const [settingsSaveError, setSettingsSaveError] = useState("")

  // Focus View: on by default every load, not persisted
  const [focusMode, setFocusMode] = useState(true)
  const [holdProgress, setHoldProgress] = useState(0)
  const holdIntervalRef = useRef<number | null>(null)
  const holdStartTimeRef = useRef<number | null>(null)

  const startHold = useCallback(() => {
    if (holdIntervalRef.current) return // idempotent guard
    holdStartTimeRef.current = Date.now()
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - (holdStartTimeRef.current ?? Date.now())
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
      setHoldProgress(pct)
      if (pct >= 100) {
        window.clearInterval(holdIntervalRef.current!)
        holdIntervalRef.current = null
        setFocusMode(false)
        setHoldProgress(0)
      }
    }, 30)
  }, [])

  const cancelHold = useCallback(() => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    holdStartTimeRef.current = null
    setHoldProgress(0)
  }, [])

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
    }
  }, [])

  // Text-to-speech function
  const speakText = useCallback(
    (text: string) => {
      if (!voiceEnabled || !text.trim()) return

      // Cancel any ongoing speech
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel()
      }

      // Create new speech synthesis utterance
      const utterance = new SpeechSynthesisUtterance(text)
      speechSynthesisRef.current = utterance

      // Configure speech settings
      utterance.rate = 0.8 // Slightly slower for kids
      utterance.pitch = 1.1 // Slightly higher pitch
      utterance.volume = 0.9

      // Set up event listeners
      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
        speechSynthesisRef.current = null
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
        speechSynthesisRef.current = null
        console.error("Speech synthesis error")
      }

      // Speak the text
      window.speechSynthesis.speak(utterance)
    },
    [voiceEnabled],
  )

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height

    // Set drawing properties
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#000000"
    ctx.lineWidth = 3

    // Fill with white background
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  // Load settings from localStorage
  useEffect(() => {
    const savedPauseDuration = localStorage.getItem("pauseDuration")
    if (savedPauseDuration) {
      setPauseDuration(Number.parseInt(savedPauseDuration, 10))
    }

    const savedVoiceEnabled = localStorage.getItem("voiceEnabled")
    if (savedVoiceEnabled !== null) {
      setVoiceEnabled(savedVoiceEnabled === "true")
    }

    const savedTextAreaExpanded = localStorage.getItem("textAreaExpanded")
    if (savedTextAreaExpanded !== null) {
      setTextAreaExpanded(savedTextAreaExpanded === "true")
    }

    const savedDrawEnabled = localStorage.getItem("drawEnabled")
    if (savedDrawEnabled !== null) {
      setDrawEnabled(savedDrawEnabled === "true")
    }

    const savedSimpleMode = localStorage.getItem("simpleMode")
    if (savedSimpleMode !== null) {
      setSimpleMode(savedSimpleMode === "true")
    }

    setVocabTree(loadVocabTree())
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("pauseDuration", pauseDuration.toString())
  }, [pauseDuration])

  useEffect(() => {
    localStorage.setItem("voiceEnabled", voiceEnabled.toString())
  }, [voiceEnabled])

  useEffect(() => {
    localStorage.setItem("textAreaExpanded", textAreaExpanded.toString())
  }, [textAreaExpanded])

  useEffect(() => {
    localStorage.setItem("drawEnabled", drawEnabled.toString())
  }, [drawEnabled])

  useEffect(() => {
    localStorage.setItem("simpleMode", simpleMode.toString())
  }, [simpleMode])

  useEffect(() => {
    document.title = savedChildName || DEFAULT_DOCUMENT_TITLE
  }, [savedChildName])

  const hasUnsavedChildName = childNameDraft.trim() !== savedChildName

  const handleSaveChildName = useCallback(async () => {
    const childName = childNameDraft.trim()

    setIsSavingSettings(true)
    setSettingsSaveMessage("")
    setSettingsSaveError("")

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childName }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : "Could not save settings")
      }

      const savedName = typeof data?.settings?.childName === "string" ? data.settings.childName : childName
      setSavedChildName(savedName)
      setChildNameDraft(savedName)
      localStorage.removeItem("childName")
      setSettingsSaveMessage("Saved")
    } catch (error) {
      setSettingsSaveError(error instanceof Error ? error.message : "Could not save settings")
    } finally {
      setIsSavingSettings(false)
    }
  }, [childNameDraft])

  // Add resize handler
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Save current drawing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Resize canvas to match display size
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height

      // Restore drawing properties
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.strokeStyle = "#000000"
      ctx.lineWidth = 3

      // Fill with white background
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Restore the drawing (if it fits)
      if (imageData.width <= canvas.width && imageData.height <= canvas.height) {
        ctx.putImageData(imageData, 0, 0)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Handle pause detection and image processing
  const handlePause = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Check if canvas has any drawing
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    let hasDrawing = false

    // Check if there's any non-white pixel
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
        hasDrawing = true
        break
      }
    }

    if (!hasDrawing) return

    setIsProcessing(true)
    setErrorMessage("") // Clear any previous error

    try {
      // Convert canvas to base64
      const imageDataUrl = canvas.toDataURL("image/png")

      // Send to API
      const response = await fetch("/api/analyze-drawing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image: imageDataUrl,
          previousText: outputText.trim() ? outputText : "", // Only send if there's actual text
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to analyze drawing")
      }

      const result = await response.json()

      if (result.success === false) {
        // Show error message, don't update text
        setErrorMessage(result.error || "Could not recognize the drawing")
      } else {
        // Success: update text and speak only new content
        setOutputText(result.text || "")

        // Speak only the newly recognized content
        const newContent = result.newContent || ""
        if (newContent.trim()) {
          setTimeout(() => {
            speakText(newContent)
          }, 500) // Small delay to ensure UI updates first
        }
      }

      // Clear canvas after processing (success or failure)
      clearCanvas()
    } catch (error) {
      console.error("Error analyzing drawing:", error)
      setErrorMessage("Error analyzing drawing. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }, [outputText, speakText])

  // Stop speaking function
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel()
    setIsSpeaking(false)
    speechSynthesisRef.current = null
  }, [])

  // Reset pause timer
  const resetPauseTimer = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
    }

    pauseTimerRef.current = setTimeout(() => {
      handlePause()
    }, pauseDuration * 1000) // Use configurable pause duration

    setLastActivity(Date.now())
  }, [handlePause, pauseDuration])

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(x, y)

    resetPauseTimer()
    setErrorMessage("") // Clear error when starting to draw
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()

    resetPauseTimer()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  // Touch events for mobile/tablet support
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    ctx.beginPath()
    ctx.moveTo(x, y)

    resetPauseTimer()
    setErrorMessage("") // Clear error when starting to draw
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawing) return

    const touch = e.touches[0]
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (touch.clientX - rect.left) * scaleX
    const y = (touch.clientY - rect.top) * scaleY

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.lineTo(x, y)
    ctx.stroke()

    resetPauseTimer()
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Clear pause timer
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
    }
  }

  const clearAll = () => {
    stopSpeaking() // Stop any ongoing speech
    clearCanvas()
    setOutputText("") // This will reset the context for the next drawing
    setErrorMessage("") // Clear any error messages

    // Also clear any pending pause timer
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current)
    }
  }

  // Get preview text for collapsed state
  const getPreviewText = () => {
    if (!outputText.trim()) return "No text recognized yet..."
    const words = outputText.trim().split(/\s+/)
    if (words.length <= 8) return outputText
    return words.slice(-8).join(" ") + "..."
  }

  const handleVocabSave = (newTree: VocabCategory[]) => {
    setVocabTree(newTree)
    saveVocabTree(newTree)
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  if (focusMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <div className="max-w-6xl mx-auto">
          <AACBoard focusMode={true} vocabTree={vocabTree} simpleMode={simpleMode} />
        </div>

        {/* Hold-to-unlock floating button */}
        <button
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-white/90 backdrop-blur border-2 border-gray-200 flex items-center justify-center shadow-lg select-none touch-none cursor-pointer"
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={(e) => { e.preventDefault(); startHold() }}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          aria-label="Hold 3 seconds to exit Focus View"
          title="Hold to unlock"
        >
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
            <circle
              cx="28" cy="28" r="23"
              fill="none"
              stroke="#6366f1"
              strokeWidth="3"
              strokeDasharray={HOLD_CIRCUMFERENCE}
              strokeDashoffset={HOLD_CIRCUMFERENCE * (1 - holdProgress / 100)}
              strokeLinecap="round"
            />
          </svg>
          <Lock className="w-5 h-5 text-gray-500 relative z-10" />
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Smart Communication Tool</h1>
            {savedChildName && (
              <p className="text-lg text-gray-500 mt-0.5">
                {getGreeting()}, <span className="font-semibold text-indigo-600">{savedChildName}</span>!
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "draw" && drawEnabled && (
              <Button
                variant={voiceEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="flex items-center gap-2"
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                {voiceEnabled ? "Voice On" : "Voice Off"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFocusMode(true)}
              className="flex items-center gap-2 bg-transparent"
            >
              <Lock className="w-4 h-4" />
              Focus View
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 bg-transparent"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`grid w-full h-14 ${drawEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
            <TabsTrigger value="communicate" className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5" />
              Communicate
            </TabsTrigger>
            {drawEnabled && (
              <TabsTrigger value="draw" className="flex items-center gap-2 text-lg">
                <Pencil className="w-5 h-5" />
                Draw
              </TabsTrigger>
            )}
          </TabsList>

          {/* Communicate Tab Content */}
          <TabsContent value="communicate" className="mt-6">
            <AACBoard vocabTree={vocabTree} simpleMode={simpleMode} />
          </TabsContent>

          {/* Draw Tab Content */}
          {drawEnabled && (
            <TabsContent value="draw" className="space-y-6 mt-6">
            {/* Error Message */}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            {/* Drawing Canvas - Full Width */}
            <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Draw Here</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Wait {pauseDuration}s for analysis</span>
                <Button variant="outline" size="sm" onClick={clearCanvas} disabled={isProcessing}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Canvas
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <canvas
                ref={canvasRef}
                className="border-2 border-gray-300 rounded-lg cursor-crosshair touch-none w-full"
                style={{ height: "500px", maxWidth: "100%" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
              {isProcessing && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Analyzing your drawing...</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Text Area */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="flex items-center gap-2">
                  Recognized Text
                  {isSpeaking && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span className="text-sm">Speaking...</span>
                    </div>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTextAreaExpanded(!textAreaExpanded)}
                  className="flex items-center gap-1"
                >
                  {textAreaExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Show
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {isSpeaking && (
                  <Button variant="outline" size="sm" onClick={stopSpeaking}>
                    Stop
                  </Button>
                )}
                {outputText && !isSpeaking && (
                  <Button variant="outline" size="sm" onClick={() => speakText(outputText)}>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Read
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={clearAll} disabled={isProcessing}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!textAreaExpanded ? (
              // Collapsed state - show preview
              <div
                className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setTextAreaExpanded(true)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-gray-600 italic">{getPreviewText()}</p>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
                {outputText && (
                  <div className="mt-2 text-xs text-gray-500">
                    {
                      outputText
                        .trim()
                        .split(/\s+/)
                        .filter((word) => word.length > 0).length
                    }{" "}
                    words • Click to expand
                  </div>
                )}
              </div>
            ) : (
              // Expanded state - show full textarea
              <>
                <Textarea
                  value={outputText}
                  onChange={(e) => setOutputText(e.target.value)}
                  placeholder="Your recognized text will appear here..."
                  className="min-h-[200px] text-lg leading-relaxed"
                  readOnly={isProcessing}
                />
                {outputText && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      <strong>Word count:</strong>{" "}
                      {
                        outputText
                          .trim()
                          .split(/\s+/)
                          .filter((word) => word.length > 0).length
                      }{" "}
                      words
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

            {/* Instructions */}
            <Card>
              <CardHeader>
                <CardTitle>How to Use</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Getting Started:</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Draw letters, words, or symbols on the large canvas above</li>
                      <li>
                        Wait {pauseDuration} second{pauseDuration !== 1 ? "s" : ""} after finishing - the AI will analyze
                        automatically
                      </li>
                      <li>Listen to the recognized text being spoken aloud</li>
                      <li>Click &quot;Show&quot; below to see the written text if needed</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Features:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Full-width canvas for comfortable drawing</li>
                      <li>Audio-first experience with voice feedback</li>
                      <li>Collapsible text view when needed</li>
                      <li>Configurable pause duration in Settings</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Parent configuration full page */}
      <ParentConfig
        tree={vocabTree}
        onSave={handleVocabSave}
        open={parentConfigOpen}
        onOpenChange={setParentConfigOpen}
      />

      {/* Settings full page */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-purple-50 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(false)}
                className="flex items-center gap-2 bg-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
                <p className="text-sm text-gray-500 mt-0.5">Configure the Smart Communication Tool</p>
              </div>
            </div>

            {/* Child name */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
              <Label className="text-base font-semibold">Child&apos;s Name</Label>
              <p className="text-xs text-gray-500">Used to personalise the greeting on the home page.</p>
              <input
                type="text"
                value={childNameDraft}
                onChange={(e) => {
                  setChildNameDraft(e.target.value)
                  setSettingsSaveMessage("")
                  setSettingsSaveError("")
                }}
                maxLength={CHILD_NAME_MAX_LENGTH}
                placeholder="e.g. Aarav"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveChildName}
                  disabled={isSavingSettings || !hasUnsavedChildName}
                >
                  {isSavingSettings ? "Saving..." : "Save"}
                </Button>
                {hasUnsavedChildName && !isSavingSettings && (
                  <p className="text-xs text-amber-700" aria-live="polite">
                    Unsaved changes
                  </p>
                )}
                {settingsSaveMessage && (
                  <p className="text-xs text-emerald-700" aria-live="polite">
                    {settingsSaveMessage}
                  </p>
                )}
                {settingsSaveError && (
                  <p className="text-xs text-red-600" aria-live="polite">
                    {settingsSaveError}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs section */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <Label className="text-base font-semibold">Tabs</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable Draw tab</p>
                  <p className="text-xs text-gray-500">Show the drawing recognition tab</p>
                </div>
                <Button
                  variant={drawEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setDrawEnabled(!drawEnabled)
                    if (drawEnabled && activeTab === "draw") setActiveTab("communicate")
                  }}
                  className="flex items-center gap-2"
                >
                  {drawEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {drawEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>
            </div>

            {/* Pause duration */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
              <Label htmlFor="pause-duration" className="text-base font-semibold">
                Pause Duration: {pauseDuration} second{pauseDuration !== 1 ? "s" : ""}
              </Label>
              <p className="text-sm text-gray-500">
                How long to wait after you stop drawing before analyzing the image
              </p>
              <Slider
                id="pause-duration"
                min={1}
                max={10}
                step={1}
                value={[pauseDuration]}
                onValueChange={(value) => setPauseDuration(value[0])}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>1s (Fast)</span>
                <span>5s (Medium)</span>
                <span>10s (Slow)</span>
              </div>
            </div>

            {/* Voice */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <Label className="text-base font-semibold">Voice Settings</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Enable voice output</p>
                  <p className="text-xs text-gray-500">Automatically read recognised text aloud</p>
                </div>
                <Button
                  variant={voiceEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceEnabled(!voiceEnabled)}
                  className="flex items-center gap-2"
                >
                  {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  {voiceEnabled ? "On" : "Off"}
                </Button>
              </div>
            </div>

            {/* Display */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <Label className="text-base font-semibold">Display Settings</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Show text area by default</p>
                  <p className="text-xs text-gray-500">Whether to show the text area expanded by default</p>
                </div>
                <Button
                  variant={textAreaExpanded ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTextAreaExpanded(!textAreaExpanded)}
                  className="flex items-center gap-2"
                >
                  {textAreaExpanded ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {textAreaExpanded ? "Shown" : "Hidden"}
                </Button>
              </div>
            </div>

            {/* Board complexity */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
              <Label className="text-base font-semibold">Board Complexity</Label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Simple mode (recommended)</p>
                  <p className="text-xs text-gray-500">
                    Tapping a category shows every item at once. Turn off to browse
                    sub-categories first — more choices, but more taps to reach an item.
                  </p>
                </div>
                <Button
                  variant={simpleMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSimpleMode(!simpleMode)}
                  className="flex items-center gap-2 shrink-0"
                >
                  {simpleMode ? "Simple" : "Detailed"}
                </Button>
              </div>
            </div>

            {/* Communication board */}
            <div className="bg-white rounded-xl border shadow-sm p-5 space-y-3">
              <Label className="text-base font-semibold">Communication Board</Label>
              <p className="text-xs text-gray-500">
                Add, edit, or remove Level 1 categories. Vocabulary below Level 1 is auto-generated by AI.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSettingsOpen(false)
                  setParentConfigOpen(true)
                }}
                className="flex items-center gap-2"
              >
                <LayoutGrid className="w-4 h-4" />
                Manage Categories
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
