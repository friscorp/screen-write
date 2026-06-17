"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Ear, Loader2, Lock, Mic, MicOff } from "lucide-react"
import { logEvent } from "@/lib/usage-logger"

// ---------------------------------------------------------------------------
// Listening Mode
//
// A full-screen, hands-free mode for the child. The parent enables it from
// Settings; it stays active until they hold-to-exit. The flow:
//
//   1. Continuously monitor the mic locally (Web Audio VAD — no audio leaves the
//      device while idle/silent).
//   2. When the child/parent speaks, record that single utterance.
//   3. Upload the utterance to /api/aac/transcribe (OpenAI Whisper).
//   4. If the transcript contains the wake phrase, the text after it is the
//      question. If the wake phrase came alone, the NEXT utterance is the
//      question. Anything without the wake phrase is silently ignored (the loop
//      keeps listening) — that's how background noise / unclear input is handled.
//   5. Send the question to /api/aac/listen (LLM) → simple response options.
//   6. Show large buttons; tapping one speaks it aloud and returns to listening.
// ---------------------------------------------------------------------------

const SILENCE_MS = 900 // trailing silence that ends an utterance
const MIN_UTTERANCE_MS = 350 // ignore clips shorter than this (clicks, blips)
const MAX_UTTERANCE_MS = 9000 // hard cap on a single recording
const VOLUME_THRESHOLD = 0.018 // RMS over [-1,1]; above this counts as speech
const AWAIT_QUESTION_MS = 8000 // after a lone wake phrase, wait this long for the question

type Phase = "idle" | "listening" | "transcribing" | "thinking" | "choosing" | "error"

interface ResponseOption {
  word: string
  emoji: string
}

interface ListeningModeProps {
  wakePhrase: string
  onExit: () => void
}

// Normalize for wake-phrase matching: lowercase, strip punctuation, collapse space.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// If `transcript` contains the wake phrase, return whatever follows it (the
// question). Returns "" when the phrase is present but nothing follows, and null
// when the phrase isn't present at all.
function extractQuestion(transcript: string, wakePhrase: string): string | null {
  const hay = normalize(transcript)
  const needle = normalize(wakePhrase)
  if (!needle) return null
  const idx = hay.indexOf(needle)
  if (idx === -1) return null
  return hay.slice(idx + needle.length).trim()
}

const HOLD_DURATION_MS = 3000
const HOLD_CIRCUMFERENCE = 2 * Math.PI * 23

export function ListeningMode({ wakePhrase, onExit }: ListeningModeProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [responses, setResponses] = useState<ResponseOption[]>([])
  const [heardQuestion, setHeardQuestion] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [awaitingQuestion, setAwaitingQuestion] = useState(false)

  // Audio plumbing kept in refs so the animation-frame loop sees live values.
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number | null>(null)
  const dataRef = useRef<Float32Array<ArrayBuffer> | null>(null)

  // Recording state mirrored in refs (the RAF loop is a stable closure).
  const recordingRef = useRef(false)
  const speechStartRef = useRef(0)
  const lastVoiceRef = useRef(0)
  const phaseRef = useRef<Phase>("idle")
  const awaitingQuestionRef = useRef(false)
  const awaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // Timing/quality signals for the current interaction (logged on selection).
  const timingRef = useRef<{ utteranceMs: number; transcribeMs: number; latencyMs: number; fallback: boolean }>({
    utteranceMs: 0,
    transcribeMs: 0,
    latencyMs: 0,
    fallback: false,
  })

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const speak = useCallback((text: string, onDone?: () => void) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onDone?.()
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1.1
    utterance.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find((v) => v.lang.startsWith("en") && /female|samantha|google/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en"))
    if (preferred) utterance.voice = preferred
    utterance.onend = () => onDone?.()
    utterance.onerror = () => onDone?.()
    window.speechSynthesis.speak(utterance)
  }, [])

  const clearAwaitTimer = useCallback(() => {
    if (awaitTimerRef.current) {
      clearTimeout(awaitTimerRef.current)
      awaitTimerRef.current = null
    }
  }, [])

  const setAwaiting = useCallback(
    (value: boolean) => {
      awaitingQuestionRef.current = value
      setAwaitingQuestion(value)
      clearAwaitTimer()
      if (value) {
        awaitTimerRef.current = setTimeout(() => {
          // No follow-up question arrived; go back to waiting for the wake phrase.
          awaitingQuestionRef.current = false
          if (mountedRef.current) setAwaitingQuestion(false)
        }, AWAIT_QUESTION_MS)
      }
    },
    [clearAwaitTimer]
  )

  // Ask the LLM for response options to a captured question.
  const askLLM = useCallback(
    async (question: string) => {
      setHeardQuestion(question)
      setPhaseBoth("thinking")
      const t0 = performance.now()
      let options: ResponseOption[] = []
      let fallback = false
      try {
        const res = await fetch("/api/aac/listen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        })
        if (res.ok) {
          const data = await res.json()
          options = Array.isArray(data?.responses) ? data.responses : []
        }
      } catch {
        // fall through to fallback below
      }
      if (options.length === 0) {
        fallback = true
        options = [
          { word: "Yes", emoji: "👍" },
          { word: "No", emoji: "👎" },
          { word: "Maybe", emoji: "🤔" },
          { word: "I don't know", emoji: "🤷" },
        ]
      }
      timingRef.current.latencyMs = Math.round(performance.now() - t0)
      timingRef.current.fallback = fallback
      if (!mountedRef.current) return
      setResponses(options)
      setPhaseBoth("choosing")
    },
    [setPhaseBoth]
  )

  // Handle a finished utterance: transcribe, then route to wake-word / question.
  const handleUtterance = useCallback(
    async (blob: Blob, durationMs: number) => {
      timingRef.current.utteranceMs = Math.round(durationMs)
      setPhaseBoth("transcribing")

      let transcript = ""
      const t0 = performance.now()
      try {
        const form = new FormData()
        form.append("audio", blob, "utterance.webm")
        const res = await fetch("/api/aac/transcribe", { method: "POST", body: form })
        if (res.ok) transcript = ((await res.json())?.text || "").trim()
      } catch {
        // treat as unclear; keep listening
      }
      timingRef.current.transcribeMs = Math.round(performance.now() - t0)

      if (!mountedRef.current) return

      if (!transcript) {
        setPhaseBoth("listening")
        return
      }

      // Already heard the wake phrase on a previous utterance — this one IS the question.
      if (awaitingQuestionRef.current) {
        setAwaiting(false)
        await askLLM(transcript)
        return
      }

      const question = extractQuestion(transcript, wakePhrase)
      if (question === null) {
        // No wake phrase — background noise / not for us. Silently keep listening.
        setPhaseBoth("listening")
        return
      }
      if (question === "") {
        // Heard just the wake phrase; wait for the question in the next utterance.
        setAwaiting(true)
        setPhaseBoth("listening")
        return
      }
      await askLLM(question)
    },
    [askLLM, setAwaiting, setPhaseBoth, wakePhrase]
  )

  const handleUtteranceRef = useRef(handleUtterance)
  useEffect(() => {
    handleUtteranceRef.current = handleUtterance
  }, [handleUtterance])

  // The VAD loop: measure mic loudness each frame, gate recording on speech,
  // and end a recording after trailing silence. Runs continuously while in the
  // "listening" phase; pauses while transcribing/thinking/choosing.
  const tick = useCallback(() => {
    rafRef.current = requestAnimationFrame(tick)
    const analyser = analyserRef.current
    const data = dataRef.current
    const recorder = recorderRef.current
    if (!analyser || !data || !recorder) return

    analyser.getFloatTimeDomainData(data)
    let sum = 0
    for (let i = 0; i < data.length; i++) sum += data[i] * data[i]
    const rms = Math.sqrt(sum / data.length)
    const now = performance.now()
    const loud = rms > VOLUME_THRESHOLD

    if (recordingRef.current) {
      if (loud) lastVoiceRef.current = now
      const sinceVoice = now - lastVoiceRef.current
      const total = now - speechStartRef.current
      if (sinceVoice > SILENCE_MS || total > MAX_UTTERANCE_MS) {
        recordingRef.current = false
        if (recorder.state === "recording") recorder.stop()
      }
      return
    }

    // Not recording: only start a fresh utterance while actively listening.
    if (phaseRef.current === "listening" && loud && recorder.state === "inactive") {
      chunksRef.current = []
      speechStartRef.current = now
      lastVoiceRef.current = now
      recordingRef.current = true
      recorder.start()
    }
  }, [])

  const start = useCallback(async () => {
    setErrorMessage("")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const audioCtx = new AudioCtx()
      if (audioCtx.state === "suspended") await audioCtx.resume()
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      analyserRef.current = analyser
      dataRef.current = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT))

      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const duration = performance.now() - speechStartRef.current
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        chunksRef.current = []
        if (duration < MIN_UTTERANCE_MS || blob.size === 0) {
          // Too short to be speech; stay listening.
          if (phaseRef.current === "transcribing") setPhaseBoth("listening")
          return
        }
        void handleUtteranceRef.current(blob, duration)
      }
      recorderRef.current = recorder

      setPhaseBoth("listening")
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick)
    } catch (error) {
      console.error("Listening Mode mic error:", error)
      setErrorMessage(
        "I couldn't turn on the microphone. Please allow microphone access and try again."
      )
      setPhaseBoth("error")
    }
  }, [setPhaseBoth, tick])

  // Auto-start on mount; if the browser blocks it (needs a gesture / permission),
  // the error state shows a Try Again button.
  useEffect(() => {
    mountedRef.current = true
    void start()
    return () => {
      mountedRef.current = false
      clearAwaitTimer()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop()
        } catch {
          /* ignore */
        }
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void audioCtxRef.current?.close().catch(() => {})
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel()
    }
    // start/clearAwaitTimer are stable; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelect = useCallback(
    (option: ResponseOption) => {
      const { utteranceMs, transcribeMs, latencyMs, fallback } = timingRef.current
      logEvent("listen", {
        question: heardQuestion,
        chosen: option.word,
        utteranceMs,
        transcribeMs,
        latencyMs,
        fallback,
      })
      setResponses([])
      setPhaseBoth("listening")
      speak(option.word)
    },
    [heardQuestion, setPhaseBoth, speak]
  )

  // ----- Hold-to-exit (parent gate) -----
  const [holdProgress, setHoldProgress] = useState(0)
  const holdIntervalRef = useRef<number | null>(null)
  const holdStartRef = useRef<number | null>(null)

  const startHold = useCallback(() => {
    if (holdIntervalRef.current) return
    holdStartRef.current = Date.now()
    holdIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - (holdStartRef.current ?? Date.now())
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
      setHoldProgress(pct)
      if (pct >= 100) {
        window.clearInterval(holdIntervalRef.current!)
        holdIntervalRef.current = null
        setHoldProgress(0)
        onExit()
      }
    }, 30)
  }, [onExit])

  const cancelHold = useCallback(() => {
    if (holdIntervalRef.current) {
      window.clearInterval(holdIntervalRef.current)
      holdIntervalRef.current = null
    }
    holdStartRef.current = null
    setHoldProgress(0)
  }, [])

  useEffect(() => {
    return () => {
      if (holdIntervalRef.current) window.clearInterval(holdIntervalRef.current)
    }
  }, [])

  const isChoosing = phase === "choosing" && responses.length > 0

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        {!isChoosing && (
          <div className="flex flex-col items-center text-center max-w-xl">
            {/* Status orb */}
            <div className="relative mb-8">
              <div
                className={`w-40 h-40 rounded-full flex items-center justify-center shadow-xl transition-colors ${
                  phase === "error"
                    ? "bg-rose-100"
                    : phase === "transcribing" || phase === "thinking"
                      ? "bg-amber-100"
                      : "bg-indigo-100"
                }`}
              >
                {(phase === "listening" || phase === "idle") && (
                  <span className="absolute inset-0 rounded-full bg-indigo-300/40 animate-ping" aria-hidden="true" />
                )}
                {phase === "error" ? (
                  <MicOff className="w-16 h-16 text-rose-500 relative z-10" />
                ) : phase === "transcribing" || phase === "thinking" ? (
                  <Loader2 className="w-16 h-16 text-amber-500 relative z-10 animate-spin" />
                ) : phase === "listening" ? (
                  <Ear className="w-16 h-16 text-indigo-500 relative z-10" />
                ) : (
                  <Mic className="w-16 h-16 text-indigo-400 relative z-10" />
                )}
              </div>
            </div>

            {phase === "idle" && <h1 className="text-3xl font-bold text-gray-800">Starting…</h1>}

            {phase === "listening" && (
              <>
                <h1 className="text-3xl font-bold text-gray-800">
                  {awaitingQuestion ? "I'm listening…" : "Listening…"}
                </h1>
                <p className="mt-3 text-lg text-gray-500">
                  {awaitingQuestion ? (
                    "Go ahead and ask your question."
                  ) : (
                    <>
                      Say <span className="font-semibold text-indigo-600">“{wakePhrase}”</span> and then ask a question.
                    </>
                  )}
                </p>
              </>
            )}

            {phase === "transcribing" && <h1 className="text-3xl font-bold text-gray-800">Listening closely…</h1>}

            {phase === "thinking" && (
              <>
                <h1 className="text-3xl font-bold text-gray-800">Thinking…</h1>
                {heardQuestion && (
                  <p className="mt-3 text-lg text-gray-500 italic">“{heardQuestion}”</p>
                )}
              </>
            )}

            {phase === "error" && (
              <>
                <h1 className="text-3xl font-bold text-gray-800">Microphone needed</h1>
                <p className="mt-3 text-lg text-gray-500">{errorMessage}</p>
                <button
                  onClick={() => void start()}
                  className="mt-6 px-6 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow-md transition-colors"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}

        {isChoosing && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <p className="text-sm uppercase tracking-wide text-indigo-400 font-semibold">Someone asked</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold text-gray-800 text-balance">
                {heardQuestion ? `“${heardQuestion}”` : "Pick an answer"}
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-4 md:gap-6">
              {responses.map((option, i) => (
                <button
                  key={`${option.word}-${i}`}
                  onClick={() => handleSelect(option)}
                  className="flex flex-col items-center justify-center p-8 bg-white hover:bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 rounded-2xl transition-all duration-150 transform hover:scale-105 active:scale-95 min-h-[160px] shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
                  aria-label={`Answer ${option.word}`}
                >
                  <span className="text-6xl mb-3" role="img" aria-hidden="true">
                    {option.emoji}
                  </span>
                  <span className="text-xl font-semibold text-center text-balance text-gray-800">{option.word}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hold-to-exit floating button (parent gate) */}
      <button
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-white/90 backdrop-blur border-2 border-gray-200 flex items-center justify-center shadow-lg select-none touch-none cursor-pointer"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={(e) => {
          e.preventDefault()
          startHold()
        }}
        onTouchEnd={cancelHold}
        onTouchCancel={cancelHold}
        aria-label="Hold 3 seconds to turn off Listening Mode"
        title="Hold to turn off Listening Mode"
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
          <circle
            cx="28"
            cy="28"
            r="23"
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
