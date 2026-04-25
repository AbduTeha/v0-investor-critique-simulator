"use client"

import { useState } from "react"
import { INVESTORS } from "@/lib/investors"
import { IdeaKillerHeader } from "@/components/idea-killer-header"
import { PitchInput } from "@/components/pitch-input"
import { InvestorCard } from "@/components/investor-card"
import { ScorePanel } from "@/components/score-panel"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Phase = "idle" | "loading" | "firing" | "done"
type CritiqueMap = Record<string, string>

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [critiques, setCritiques] = useState<CritiqueMap>({})
  const [activeIndex, setActiveIndex] = useState(-1)
  const [score, setScore] = useState(0)
  const [verdict, setVerdict] = useState("")
  const [mustFix, setMustFix] = useState("")
  const [error, setError] = useState<string | null>(null)

  const submit = async (pitch: string) => {
    setPhase("loading")
    setError(null)
    setCritiques({})
    setActiveIndex(-1)
    setScore(0)
    setVerdict("")
    setMustFix("")

    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitch }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || "Request failed")
      }

      const data = (await res.json()) as {
        critiques: { id: string; critique: string }[]
        score: number
        verdict: string
        mustFix: string
      }

      const map: CritiqueMap = {}
      for (const c of data.critiques) map[c.id] = c.critique

      setCritiques(map)
      setScore(data.score)
      setVerdict(data.verdict)
      setMustFix(data.mustFix)
      setPhase("firing")
      // Kick off the first investor
      setActiveIndex(0)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
      setPhase("idle")
    }
  }

  const handleTypingDone = (i: number) => {
    if (i < INVESTORS.length - 1) {
      // Brief beat between investors for drama
      window.setTimeout(() => setActiveIndex(i + 1), 350)
    } else {
      window.setTimeout(() => setPhase("done"), 500)
    }
  }

  const reset = () => {
    setPhase("idle")
    setCritiques({})
    setActiveIndex(-1)
    setScore(0)
    setVerdict("")
    setMustFix("")
    setError(null)
  }

  const cardStatus = (i: number) => {
    if (phase === "idle") return "idle" as const
    if (phase === "loading") return "loading" as const
    // phase === "firing" or "done"
    if (i < activeIndex) return "done" as const
    if (i === activeIndex) return "typing" as const
    return "ready" as const
  }

  const showScore = phase === "done"

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <IdeaKillerHeader />

        {/* Pitch input */}
        <section className="rounded-lg border border-border bg-card/50 p-5 sm:p-6">
          <PitchInput
            onSubmit={submit}
            loading={phase === "loading"}
            disabled={phase === "firing"}
          />

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* The room */}
        <section aria-label="The investor panel" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
              STEP 2 · THE ROOM
            </span>
            {phase === "done" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                New pitch
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {INVESTORS.map((inv, i) => (
              <InvestorCard
                key={inv.id}
                investor={inv}
                status={cardStatus(i)}
                critique={critiques[inv.id] ?? ""}
                onTypingDone={() => handleTypingDone(i)}
              />
            ))}
          </div>
        </section>

        {/* Score */}
        <section aria-label="Verdict" className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            STEP 3 · THE VERDICT
          </span>
          <ScorePanel
            score={score}
            verdict={verdict}
            mustFix={mustFix}
            visible={showScore}
          />
          {!showScore && (
            <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-6 text-center">
              <p className="font-mono text-xs tracking-wide text-muted-foreground/70">
                {phase === "idle" &&
                  "Submit a pitch to convene the panel."}
                {phase === "loading" &&
                  "Convening the panel…"}
                {phase === "firing" &&
                  "Wait for the room to finish before the verdict drops."}
              </p>
            </div>
          )}
        </section>

        <footer className="pt-2 text-center font-mono text-[10px] tracking-widest text-muted-foreground/60">
          BUILT FOR FOUNDERS WHO CAN TAKE A PUNCH
        </footer>
      </div>
    </main>
  )
}
