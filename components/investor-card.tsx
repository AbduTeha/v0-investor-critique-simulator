"use client"

import { cn } from "@/lib/utils"
import type { Investor } from "@/lib/investors"
import { useTypewriter } from "@/hooks/use-typewriter"
import { Crosshair, Loader2 } from "lucide-react"

type Status = "idle" | "loading" | "ready" | "typing" | "done"

type Props = {
  investor: Investor
  status: Status
  critique: string
  onTypingDone?: () => void
}

export function InvestorCard({ investor, status, critique, onTypingDone }: Props) {
  const shouldType = status === "typing" || status === "done"
  const { displayed, done } = useTypewriter(critique, shouldType, 10, onTypingDone)

  const visibleText = status === "done" ? critique : displayed

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border bg-card p-5 transition-all duration-300",
        status === "idle" && "border-border/60 opacity-60",
        status === "loading" && "border-border/60",
        (status === "typing" || status === "ready") &&
          "border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_8px_30px_-12px_rgba(239,68,68,0.35)]",
        status === "done" && "border-border",
      )}
      aria-busy={status === "loading" || status === "typing"}
    >
      {/* Header */}
      <header className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background font-mono text-sm font-semibold"
          aria-hidden="true"
        >
          <span className={investor.accent}>{investor.initials}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-mono text-sm font-semibold text-foreground">
            {investor.name}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{investor.title}</p>
        </div>

        <StatusBadge status={status} />
      </header>

      {/* Attack vector */}
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2">
        <Crosshair className={cn("h-3.5 w-3.5 shrink-0", investor.accent)} aria-hidden="true" />
        <p className="font-mono text-xs leading-tight text-muted-foreground">
          {investor.attackVector}
        </p>
      </div>

      {/* Critique body */}
      <div className="min-h-24 text-sm leading-relaxed text-foreground/90">
        {status === "idle" && (
          <p className="text-muted-foreground/60 italic">Awaiting pitch…</p>
        )}
        {status === "loading" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span className="font-mono text-xs">Loading rebuttal…</span>
          </div>
        )}
        {status === "ready" && (
          <p className="font-mono text-xs text-muted-foreground">
            <span className={cn("mr-2", investor.accent)}>●</span>
            Ready to fire.
          </p>
        )}
        {(status === "typing" || status === "done") && (
          <p className="whitespace-pre-wrap text-pretty">
            {visibleText}
            {status === "typing" && !done && (
              <span
                className={cn("ml-0.5 inline-block h-4 w-1.5 -translate-y-px animate-pulse bg-current align-middle", investor.accent)}
                aria-hidden="true"
              />
            )}
          </p>
        )}
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; className: string }> = {
    idle: {
      label: "STANDBY",
      className: "border-border/60 text-muted-foreground/60",
    },
    loading: {
      label: "LOADING",
      className: "border-border text-muted-foreground",
    },
    ready: {
      label: "QUEUED",
      className: "border-red-500/40 text-red-400",
    },
    typing: {
      label: "FIRING",
      className: "border-red-500 text-red-400 bg-red-500/10",
    },
    done: {
      label: "DONE",
      className: "border-border text-muted-foreground",
    },
  }
  const { label, className } = map[status]
  return (
    <span
      className={cn(
        "shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-widest",
        className,
      )}
    >
      {label}
    </span>
  )
}
