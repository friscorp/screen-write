"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, Pencil, RotateCcw } from "lucide-react"
import { DEFAULT_QUICK_RESPONSES, colorForIndex, type QuickResponse } from "@/lib/quick-responses"

interface QuickResponsesConfigProps {
  responses: QuickResponse[]
  onSave: (responses: QuickResponse[]) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickResponsesConfig({ responses, onSave, open, onOpenChange }: QuickResponsesConfigProps) {
  const [newWord, setNewWord] = useState("")
  const [newEmoji, setNewEmoji] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWord, setEditWord] = useState("")
  const [editEmoji, setEditEmoji] = useState("")

  if (!open) return null

  const startEdit = (response: QuickResponse) => {
    setEditingId(response.id)
    setEditWord(response.word)
    setEditEmoji(response.emoji)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditWord("")
    setEditEmoji("")
  }

  const handleSaveEdit = (response: QuickResponse) => {
    const word = editWord.trim()
    if (!word) return
    const emoji = editEmoji.trim() || response.emoji
    onSave(responses.map((r) => (r.id === response.id ? { ...r, word, emoji } : r)))
    cancelEdit()
  }

  const handleAdd = () => {
    const word = newWord.trim()
    if (!word) return
    const emoji = newEmoji.trim() || "💬"
    const id = `${word.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
    onSave([...responses, { id, word, emoji, color: colorForIndex(responses.length) }])
    setNewWord("")
    setNewEmoji("")
  }

  const handleDelete = (id: string) => {
    onSave(responses.filter((r) => r.id !== id))
  }

  const moveResponse = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= responses.length) return
    const next = [...responses]
    ;[next[index], next[target]] = [next[target], next[index]]
    onSave(next)
  }

  const handleReset = () => {
    onSave(DEFAULT_QUICK_RESPONSES)
  }

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-purple-50 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 bg-white"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quick Responses</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              These one-tap replies (Yes, No, Maybe…) always show above the communication board. Add,
              edit, reorder, or remove them here — they never change on their own.
            </p>
          </div>
        </div>

        {/* Response list */}
        {responses.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 bg-white rounded-xl border">
            No quick responses yet. Add one below.
          </p>
        )}

        <div className="space-y-3">
          {responses.map((response, index) => {
            const isEditing = editingId === response.id

            if (isEditing) {
              return (
                <div key={response.id} className="p-4 bg-white rounded-xl border shadow-sm space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editEmoji}
                      onChange={(e) => setEditEmoji(e.target.value)}
                      placeholder="👍"
                      className="w-14 text-center text-xl border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary"
                      maxLength={8}
                      aria-label="Response emoji"
                    />
                    <input
                      type="text"
                      value={editWord}
                      onChange={(e) => setEditWord(e.target.value)}
                      placeholder="What should it say?"
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label="Response text"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(response)} disabled={!editWord.trim()}>
                      Save
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={response.id}
                className="flex items-center gap-3 p-4 bg-white rounded-xl border shadow-sm"
              >
                <span className="text-3xl w-10 text-center shrink-0">{response.emoji}</span>
                <p className="flex-1 min-w-0 font-semibold text-gray-800">{response.word}</p>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Move up"
                    onClick={() => moveResponse(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Move down"
                    onClick={() => moveResponse(index, 1)}
                    disabled={index === responses.length - 1}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" title="Edit" onClick={() => startEdit(response)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Delete" onClick={() => handleDelete(response.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add new response */}
        <div className="bg-white rounded-xl border shadow-sm p-5 space-y-4">
          <p className="font-semibold text-gray-800">Add Quick Response</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              placeholder="💬"
              className="w-14 text-center text-xl border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={8}
              aria-label="Response emoji"
            />
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="What should it say? (e.g., Thank you)"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              aria-label="Response text"
            />
          </div>
          <Button onClick={handleAdd} disabled={!newWord.trim()} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={handleReset} className="flex items-center gap-2 bg-white">
          <RotateCcw className="w-4 h-4" />
          Reset to defaults
        </Button>
      </div>
    </div>
  )
}
