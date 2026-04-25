"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { Skull, Wrench, Zap, Flame, Sparkles } from "lucide-react"

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
    const duration = 1600
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
        "relative overflow-hidden rounded-xl border bg-card p-6 shadow-2xl transition-all duration-700 sm:p-8",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        tier.borderClass,
      )}
    >
      {/* Subtle glow accent in the corner, tinted to the tier color */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl opacity-20",
          tier.glowClass,
        )}
      />

      <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start sm:gap-10">
        {/* Score number */}
        <div className="flex shrink-0 flex-col items-start gap-2.5 sm:min-w-[200px]">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            SURVIVAL SCORE
          </span>
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-7xl font-bold leading-none tabular-nums sm:text-8xl",
                tier.textClass,
              )}
              style={{
                textShadow: visible ? `0 0 32px currentColor` : undefined,
              }}
            >
              {pct}
            </span>
            <span className="font-mono text-2xl font-light text-muted-foreground">/100</span>
          </div>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.2em]",
              tier.badgeClass,
            )}
          >
            <tier.Icon className="h-3 w-3" aria-hidden="true" />
            {tier.label}
          </span>
        </div>

        {/* Verdict + must fix */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              ROOM VERDICT
            </span>
            <p className="text-balance text-lg font-medium leading-snug text-foreground sm:text-xl">
              {verdict ? `"${verdict}"` : "—"}
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/[0.06] p-4 sm:p-5">
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.2em] text-red-400">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              FIX THIS BEFORE THE REAL PITCH
            </span>
            <p className="text-pretty text-sm leading-relaxed text-foreground sm:text-base">
              {mustFix || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Score bar */}
      <div className="relative mt-7">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/60">
          <div
            className={cn("absolute inset-y-0 left-0 transition-[width] duration-300", tier.barClass)}
            style={{ width: `${pct}%` }}
          />
          {/* Tier markers */}
          {[25, 50, 70, 85].map((m) => (
            <div
              key={m}
              aria-hidden="true"
              className="absolute inset-y-0 w-px bg-background/60"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.15em] text-muted-foreground/70">
          <span>0 · DEAD</span>
          <span>50 · CONTESTED</span>
          <span>100 · UNICORN</span>
        </div>
      </div>
    </section>
  )
}

type Tier = {
  label: string
  Icon: typeof Skull
  textClass: string
  borderClass: string
  badgeClass: string
  barClass: string
  glowClass: string
}

function getTier(score: number): Tier {
  if (score < 25) {
    return {
      label: "DEAD ON ARRIVAL",
      Icon: Skull,
      textClass: "text-red-500",
      borderClass: "border-red-500/50",
      badgeClass: "border-red-500/50 text-red-400 bg-red-500/10",
      barClass: "bg-red-500",
      glowClass: "bg-red-500",
    }
  }
  if (score < 50) {
    return {
      label: "BLEEDING OUT",
      Icon: Flame,
      textClass: "text-red-400",
      borderClass: "border-red-500/40",
      badgeClass: "border-red-500/40 text-red-400 bg-red-500/10",
      barClass: "bg-red-400",
      glowClass: "bg-red-500",
    }
  }
  if (score < 70) {
    return {
      label: "CONTESTED",
      Icon: Zap,
      textClass: "text-amber-400",
      borderClass: "border-amber-500/40",
      badgeClass: "border-amber-500/40 text-amber-400 bg-amber-500/10",
      barClass: "bg-amber-400",
      glowClass: "bg-amber-500",
    }
  }
  if (score < 85) {
    return {
      label: "PROMISING",
      Icon: Zap,
      textClass: "text-emerald-400",
      borderClass: "border-emerald-500/40",
      badgeClass: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
      barClass: "bg-emerald-400",
      glowClass: "bg-emerald-500",
    }
  }
  return {
    label: "UNICORN-CODED",
    Icon: Sparkles,
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/50",
    badgeClass: "border-emerald-500/50 text-emerald-400 bg-emerald-500/10",
    barClass: "bg-emerald-400",
    glowClass: "bg-emerald-500",
  }
}
