"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Skull, Wrench, Zap } from "lucide-react"

type Props = {
  score: number
  verdict: string
  mustFix: string
  visible: boolean
}

export function ScorePanel({ score, verdict, mustFix, visible }: Props) {
  const [displayScore, setDisplayScore] = useState(0)

  useEffect(() => {
    if (!visible) {
      setDisplayScore(0)
      return
    }
    const duration = 1400
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayScore(Math.round(eased * score))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [score, visible])

  const tier = getTier(score)
  const pct = Math.max(0, Math.min(100, displayScore))

  return (
    <section
      aria-label="Survival score"
      className={cn(
        "rounded-lg border bg-card p-6 transition-all duration-500 sm:p-8",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        tier.borderClass,
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
        {/* Score number */}
        <div className="flex flex-col items-start gap-2">
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
            SURVIVAL SCORE
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className={cn(
                "font-mono text-7xl font-bold leading-none tabular-nums sm:text-8xl",
                tier.textClass,
              )}
            >
              {pct}
            </span>
            <span className="font-mono text-2xl text-muted-foreground">/100</span>
          </div>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[11px] tracking-widest",
              tier.badgeClass,
            )}
          >
            <tier.Icon className="h-3 w-3" aria-hidden="true" />
            {tier.label}
          </span>
        </div>

        {/* Verdict + must fix */}
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
              ROOM VERDICT
            </span>
            <p className="text-balance text-lg font-medium leading-snug text-foreground sm:text-xl">
              {verdict || "—"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 p-4">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-red-400">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              FIX THIS BEFORE THE REAL PITCH
            </span>
            <p className="text-pretty text-sm leading-relaxed text-foreground/90 sm:text-base">
              {mustFix || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-6">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", tier.barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground/70">
          <span>0 · DEAD ON ARRIVAL</span>
          <span>50 · CONTESTED</span>
          <span>100 · UNICORN</span>
        </div>
      </div>
    </section>
  )
}

function getTier(score: number) {
  if (score < 25) {
    return {
      label: "DEAD ON ARRIVAL",
      Icon: Skull,
      textClass: "text-red-500",
      borderClass: "border-red-500/40",
      badgeClass: "border-red-500/40 text-red-400 bg-red-500/10",
      barClass: "bg-red-500",
    }
  }
  if (score < 50) {
    return {
      label: "BLEEDING OUT",
      Icon: Skull,
      textClass: "text-red-400",
      borderClass: "border-red-500/30",
      badgeClass: "border-red-500/30 text-red-400 bg-red-500/10",
      barClass: "bg-red-400",
    }
  }
  if (score < 70) {
    return {
      label: "CONTESTED",
      Icon: Zap,
      textClass: "text-amber-400",
      borderClass: "border-amber-500/30",
      badgeClass: "border-amber-500/30 text-amber-400 bg-amber-500/10",
      barClass: "bg-amber-400",
    }
  }
  if (score < 85) {
    return {
      label: "PROMISING",
      Icon: Zap,
      textClass: "text-emerald-400",
      borderClass: "border-emerald-500/30",
      badgeClass: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
      barClass: "bg-emerald-400",
    }
  }
  return {
    label: "UNICORN-CODED",
    Icon: Zap,
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/40",
    badgeClass: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    barClass: "bg-emerald-400",
  }
}
