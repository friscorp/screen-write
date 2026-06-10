"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { KeyRound, Loader2, AlertCircle } from "lucide-react"

export function LicenseGate() {
  const router = useRouter()
  const [licenseKey, setLicenseKey] = useState("")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!licenseKey.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/auth/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKey.trim() }),
      })
      const data = await response.json().catch(() => ({}))

      if (response.ok && data.success) {
        // Cookie is now set; re-render the server page (which will unlock the app).
        router.refresh()
      } else {
        setError(data.error || "That license key isn't valid. Please check and try again.")
        setIsSubmitting(false)
      }
    } catch {
      setError("Something went wrong. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-primary/20 shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <KeyRound className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <p className="text-sm text-muted-foreground">
            Parents: please enter your license key to activate the Smart Communication Tool on this
            device.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="license-key">License key</Label>
              <Input
                id="license-key"
                type="text"
                autoComplete="off"
                autoFocus
                value={licenseKey}
                onChange={(e) => {
                  setLicenseKey(e.target.value)
                  if (error) setError("")
                }}
                placeholder="e.g. AAC-XXXX-XXXX"
                disabled={isSubmitting}
                className="text-base"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isSubmitting || !licenseKey.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate"
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Your license stays active on this device for one year.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
