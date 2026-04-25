"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const SAMPLE_PITCH =
  "An AI app that helps restaurants reduce food waste by predicting daily demand based on weather, events, and historical sales. Charges $99/month per restaurant."

const MAX = 600

type Props = {
  onSubmit: (pitch: string) => void
  loading: boolean
  disabled?: boolean
}

export function PitchInput({ onSubmit, loading, disabled }: Props) {
  const [pitch, setPitch] = useState("")

  const trimmed = pitch.trim()
  const tooShort = trimmed.length < 10
  const tooLong = trimmed.length > MAX

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || disabled || tooShort || tooLong) return
    onSubmit(trimmed)
  }

  const insertSample = () => {
    setPitch(SAMPLE_PITCH)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="pitch" className="font-mono text-[10px] tracking-widest text-muted-foreground">
        STEP 1 · PASTE YOUR PITCH
      </label>

      <div className="relative">
        <Textarea
          id="pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value.slice(0, MAX + 50))}
          placeholder="An AI app that helps restaurants reduce food waste by predicting daily demand…"
          rows={5}
          disabled={loading || disabled}
          className={cn(
            "min-h-32 resize-none border-border bg-card text-base leading-relaxed",
            "focus-visible:border-red-500/50 focus-visible:ring-red-500/20",
          )}
          aria-describedby="pitch-help pitch-count"
        />
        <span
          id="pitch-count"
          className={cn(
            "pointer-events-none absolute bottom-2 right-3 font-mono text-[10px] tabular-nums",
            tooLong ? "text-red-400" : "text-muted-foreground/70",
          )}
          aria-live="polite"
        >
          {trimmed.length}/{MAX}
        </span>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={insertSample}
          disabled={loading || disabled}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-red-500/40 hover:text-foreground disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Try the sample pitch
        </button>

        <Button
          type="submit"
          disabled={loading || disabled || tooShort || tooLong}
          size="lg"
          className="bg-red-500 font-mono text-sm font-semibold tracking-wide text-white hover:bg-red-500/90"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              CONVENING THE PANEL…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden="true" />
              KILL MY IDEA
            </>
          )}
        </Button>
      </div>

      <p id="pitch-help" className="font-mono text-[10px] tracking-wide text-muted-foreground/70">
        {tooShort && trimmed.length > 0
          ? "TOO SHORT · Give them something to chew on (10+ chars)."
          : tooLong
            ? `TOO LONG · Trim to ${MAX} characters.`
            : "5 investors will fire in parallel. No mercy."}
      </p>
    </form>
  )
}
