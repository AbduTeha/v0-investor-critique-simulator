"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Loader2, Send, X, RefreshCw } from "lucide-react"

const MAX = 600

type Props = {
  open: boolean
  initialPitch: string
  loading: boolean
  onClose: () => void
  onSubmit: (newPitch: string) => void
}

export function RevisionPanel({ open, initialPitch, loading, onClose, onSubmit }: Props) {
  const [pitch, setPitch] = useState(initialPitch)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setPitch(initialPitch)
      // Defer focus until the section is visible.
      const t = window.setTimeout(() => ref.current?.focus(), 60)
      return () => window.clearTimeout(t)
    }
  }, [open, initialPitch])

  const trimmed = pitch.trim()
  const tooShort = trimmed.length < 10
  const tooLong = trimmed.length > MAX
  const unchanged = trimmed === initialPitch.trim()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || tooShort || tooLong) return
    onSubmit(trimmed)
  }

  if (!open) return null

  return (
    <section
      aria-label="Revise pitch"
      className="rounded-lg border border-red-500/40 bg-card p-5 shadow-[0_8px_30px_-12px_rgba(239,68,68,0.25)] sm:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-red-400">
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            ROUND 2
          </span>
          <h2 className="text-balance font-mono text-base font-semibold text-foreground">
            Revise your pitch and face the room again
          </h2>
          <p className="text-pretty text-sm text-muted-foreground">
            The same five investors will read this. They remember exactly what you pitched last time and what they said.
            Address the kill shot or expect it back, sharper.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cancel revision"
          className="shrink-0 rounded-md border border-border bg-background p-1.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="relative">
          <textarea
            ref={ref}
            value={pitch}
            onChange={(e) => setPitch(e.target.value.slice(0, MAX + 50))}
            rows={5}
            disabled={loading}
            placeholder="Rewrite. Be specific. Address the panel's strongest objection head-on."
            className={cn(
              "min-h-32 w-full resize-none rounded-md border border-border bg-background px-3 py-2.5 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/60",
              "focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20",
              "disabled:opacity-60",
            )}
          />
          <span
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
          <p className="font-mono text-[10px] tracking-wide text-muted-foreground/70">
            {tooShort && trimmed.length > 0
              ? "TOO SHORT · Give them something new to chew on (10+ chars)."
              : tooLong
                ? `TOO LONG · Trim to ${MAX} characters.`
                : unchanged
                  ? "TIP · Edit the pitch to address the panel's feedback."
                  : "Same panel. Same memory. Send it again."}
          </p>

          <Button
            type="submit"
            disabled={loading || tooShort || tooLong}
            size="lg"
            className="bg-red-500 font-mono text-sm font-semibold tracking-wide text-white hover:bg-red-500/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                RECONVENING THE PANEL…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden="true" />
                FACE THEM AGAIN
              </>
            )}
          </Button>
        </div>
      </form>
    </section>
  )
}
