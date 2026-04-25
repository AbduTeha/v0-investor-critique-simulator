"use client"

import { useState } from "react"
import { INVESTORS } from "@/lib/investors"
import { IdeaKillerHeader } from "@/components/idea-killer-header"
import { PitchInput } from "@/components/pitch-input"
import { InvestorCard, type ChatMessage } from "@/components/investor-card"
import { ScorePanel } from "@/components/score-panel"
import { RevisionPanel } from "@/components/revision-panel"
import { AlertTriangle, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

type Phase = "idle" | "loading" | "firing" | "done"
type Threads = Record<string, ChatMessage[]>
type AwaitingMap = Record<string, boolean>
type PreviousCritique = { id: string; critique: string }

export default function Page() {
  const [phase, setPhase] = useState<Phase>("idle")
  const [pitch, setPitch] = useState("")
  const [threads, setThreads] = useState<Threads>({})
  const [activeIndex, setActiveIndex] = useState(-1)
  const [awaiting, setAwaiting] = useState<AwaitingMap>({})

  const [score, setScore] = useState(0)
  const [verdict, setVerdict] = useState("")
  const [mustFix, setMustFix] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  const [isRevisionResult, setIsRevisionResult] = useState(false)

  // For round 2+ context, the panel remembers the prior pitch + critiques.
  const [previousPitch, setPreviousPitch] = useState<string | null>(null)
  const [previousCritiques, setPreviousCritiques] = useState<PreviousCritique[] | null>(null)

  const [revisionOpen, setRevisionOpen] = useState(false)

  const submit = async (newPitch: string, isRevision = false) => {
    setPhase("loading")
    setError(null)
    setActiveIndex(-1)
    setScore(0)
    setVerdict("")
    setMustFix("")
    setAwaiting({})
    setThreads({})
    setPitch(newPitch)

    const body: {
      pitch: string
      previousPitch?: string
      previousCritiques?: PreviousCritique[]
    } = { pitch: newPitch }
    if (isRevision && previousPitch && previousCritiques) {
      body.previousPitch = previousPitch
      body.previousCritiques = previousCritiques
    }

    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error || "Request failed")
      }

      const data = (await res.json()) as {
        critiques: { id: string; critique: string }[]
        score: number
        verdict: string
        mustFix: string
        isRevision?: boolean
      }

      const newThreads: Threads = {}
      for (const c of data.critiques) {
        newThreads[c.id] = [
          {
            id: `${c.id}-init-${Date.now()}`,
            role: "investor",
            content: c.critique,
          },
        ]
      }
      setThreads(newThreads)
      setScore(data.score)
      setVerdict(data.verdict)
      setMustFix(data.mustFix)
      setIsRevisionResult(Boolean(data.isRevision))

      // Stash for next revision round.
      setPreviousPitch(newPitch)
      setPreviousCritiques(data.critiques.map((c) => ({ id: c.id, critique: c.critique })))

      setPhase("firing")
      setActiveIndex(0)
      setRound((r) => r + 1)
      setRevisionOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
      setPhase("idle")
    }
  }

  const sendFollowUp = async (investorId: string, text: string) => {
    if (awaiting[investorId]) return
    if (!pitch) return

    const userMsg: ChatMessage = {
      id: `${investorId}-u-${Date.now()}`,
      role: "user",
      content: text,
    }

    // Capture the history BEFORE we append, so the API gets the prior conversation
    // and the new userMessage as a separate field.
    const priorHistory = threads[investorId] ?? []

    setThreads((prev) => ({
      ...prev,
      [investorId]: [...(prev[investorId] ?? []), userMsg],
    }))
    setAwaiting((prev) => ({ ...prev, [investorId]: true }))

    try {
      const res = await fetch("/api/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          pitch,
          history: priorHistory,
          userMessage: text,
        }),
      })

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error || "Follow-up failed")
      }

      const { reply } = (await res.json()) as { reply: string }
      const investorMsg: ChatMessage = {
        id: `${investorId}-i-${Date.now()}`,
        role: "investor",
        content: reply,
      }
      setThreads((prev) => ({
        ...prev,
        [investorId]: [...(prev[investorId] ?? []), investorMsg],
      }))
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Reply failed."
      const errMsg: ChatMessage = {
        id: `${investorId}-err-${Date.now()}`,
        role: "investor",
        content: `(${msg})`,
      }
      setThreads((prev) => ({
        ...prev,
        [investorId]: [...(prev[investorId] ?? []), errMsg],
      }))
    } finally {
      setAwaiting((prev) => ({ ...prev, [investorId]: false }))
    }
  }

  const handleTypingDone = (i: number) => {
    if (i < INVESTORS.length - 1) {
      window.setTimeout(() => setActiveIndex(i + 1), 350)
    } else {
      window.setTimeout(() => setPhase("done"), 500)
    }
  }

  const reset = () => {
    setPhase("idle")
    setPitch("")
    setThreads({})
    setActiveIndex(-1)
    setAwaiting({})
    setScore(0)
    setVerdict("")
    setMustFix("")
    setError(null)
    setRound(0)
    setIsRevisionResult(false)
    setPreviousPitch(null)
    setPreviousCritiques(null)
    setRevisionOpen(false)
  }

  const startRevision = () => {
    setRevisionOpen(true)
    // Smooth scroll the editor into view after it mounts.
    window.setTimeout(() => {
      document.getElementById("revision-anchor")?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 80)
  }

  const cardStatus = (i: number) => {
    if (phase === "idle") return "idle" as const
    if (phase === "loading") return "loading" as const
    if (i < activeIndex) return "done" as const
    if (i === activeIndex) return "typing" as const
    if (phase === "done") return "done" as const
    return "ready" as const
  }

  const showScore = phase === "done"

  return (
    <main className="min-h-svh bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <IdeaKillerHeader />

        {/* Pitch input — only shown for round 1 */}
        {round === 0 && (
          <section className="rounded-lg border border-border bg-card/50 p-5 sm:p-6">
            <PitchInput
              onSubmit={(p) => submit(p, false)}
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
        )}

        {/* Pitch summary card — visible for round 2+ */}
        {round > 0 && (
          <section className="rounded-lg border border-border bg-card/50 p-5 sm:p-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                {isRevisionResult ? "REVISED PITCH · ROUND " + round : "YOUR PITCH"}
              </span>
              <p className="text-pretty text-sm leading-relaxed text-foreground/90">
                {pitch}
              </p>
            </div>
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
        )}

        {/* The room */}
        <section aria-label="The investor panel" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
              STEP 2 · THE ROOM
              {phase === "done" && (
                <span className="ml-2 text-foreground/80">· panel is open — push back on any of them</span>
              )}
            </span>
            {phase === "done" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Start over
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {INVESTORS.map((inv, i) => (
              <InvestorCard
                key={inv.id}
                investor={inv}
                status={cardStatus(i)}
                messages={threads[inv.id] ?? []}
                awaitingReply={Boolean(awaiting[inv.id])}
                followUpEnabled={phase === "done"}
                onTypingDone={() => handleTypingDone(i)}
                onSendFollowUp={(text) => sendFollowUp(inv.id, text)}
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
            isRevision={isRevisionResult}
            onRevise={showScore ? startRevision : undefined}
            onReset={showScore ? reset : undefined}
          />
          {!showScore && (
            <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-6 text-center">
              <p className="font-mono text-xs tracking-wide text-muted-foreground/70">
                {phase === "idle" && "Submit a pitch to convene the panel."}
                {phase === "loading" &&
                  (round === 0 ? "Convening the panel…" : "Reconvening the panel…")}
                {phase === "firing" && "Wait for the room to finish before the verdict drops."}
              </p>
            </div>
          )}
        </section>

        {/* Revision editor */}
        <div id="revision-anchor">
          <RevisionPanel
            open={revisionOpen}
            initialPitch={pitch}
            loading={phase === "loading"}
            onClose={() => setRevisionOpen(false)}
            onSubmit={(p) => submit(p, true)}
          />
        </div>

        <footer className="pt-2 text-center font-mono text-[10px] tracking-widest text-muted-foreground/60">
          BUILT FOR FOUNDERS WHO CAN TAKE A PUNCH
        </footer>
      </div>
    </main>
  )
}
