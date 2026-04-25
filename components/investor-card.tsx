"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { Investor } from "@/lib/investors"
import { useTypewriter } from "@/hooks/use-typewriter"
import { Crosshair, Loader2, Send, MessageSquare } from "lucide-react"

export type ChatMessage = {
  id: string
  role: "investor" | "user"
  content: string
}

type Status = "idle" | "loading" | "ready" | "typing" | "done"

type Props = {
  investor: Investor
  status: Status
  messages: ChatMessage[]
  awaitingReply: boolean
  followUpEnabled: boolean
  onTypingDone?: () => void
  onSendFollowUp?: (text: string) => void
}

export function InvestorCard({
  investor,
  status,
  messages,
  awaitingReply,
  followUpEnabled,
  onTypingDone,
  onSendFollowUp,
}: Props) {
  // Track which investor messages have already been animated.
  const [typedIds, setTypedIds] = useState<Set<string>>(new Set())

  // The typewriter is "live" when status indicates we're past loading.
  const canAnimate = status === "typing" || status === "done"

  // Find the latest investor message that hasn't been typed yet.
  const lastMsg = messages[messages.length - 1]
  const animatingId =
    canAnimate && lastMsg && lastMsg.role === "investor" && !typedIds.has(lastMsg.id)
      ? lastMsg.id
      : null

  const handleAnimationDone = (id: string) => {
    setTypedIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    // Notify parent only if this was the FIRST critique (round-1 drama).
    if (messages[0]?.id === id) {
      onTypingDone?.()
    }
  }

  // Auto-scroll the thread to the bottom on new messages.
  const threadRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages.length, awaitingReply])

  const showFollowUpUI = followUpEnabled || awaitingReply

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border bg-card p-5 transition-all duration-300",
        status === "idle" && "border-border/60 opacity-60",
        status === "loading" && "border-border/60",
        (status === "typing" || status === "ready") &&
          "border-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.15),0_8px_30px_-12px_rgba(239,68,68,0.35)]",
        status === "done" && "border-border",
        awaitingReply && "border-red-500/40",
      )}
      aria-busy={status === "loading" || status === "typing" || awaitingReply}
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

        <StatusBadge status={status} awaitingReply={awaitingReply} />
      </header>

      {/* Attack vector */}
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2">
        <Crosshair className={cn("h-3.5 w-3.5 shrink-0", investor.accent)} aria-hidden="true" />
        <p className="font-mono text-xs leading-tight text-muted-foreground">
          {investor.attackVector}
        </p>
      </div>

      {/* Body — varies by phase */}
      <div
        ref={threadRef}
        className={cn(
          "flex flex-col gap-3 text-sm leading-relaxed text-foreground/90",
          // When chat is active (more than 1 message), allow it to scroll.
          messages.length > 1 ? "max-h-72 min-h-24 overflow-y-auto pr-1" : "min-h-24",
        )}
      >
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

        {(status === "typing" || status === "done") &&
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              animate={animatingId === m.id}
              accentClass={investor.accent}
              onDone={() => handleAnimationDone(m.id)}
            />
          ))}

        {awaitingReply && (
          <div className="flex items-center gap-2 self-start text-muted-foreground">
            <span className="flex gap-1">
              <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", investor.accent.replace("text-", "bg-"))} style={{ animationDelay: "0ms" }} />
              <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", investor.accent.replace("text-", "bg-"))} style={{ animationDelay: "200ms" }} />
              <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", investor.accent.replace("text-", "bg-"))} style={{ animationDelay: "400ms" }} />
            </span>
            <span className="font-mono text-[11px] tracking-wide">
              {investor.name.split(" ")[0]} is thinking…
            </span>
          </div>
        )}
      </div>

      {/* Follow-up input — only after the first critique is fully out */}
      {showFollowUpUI && (
        <FollowUpInput
          investorName={investor.name}
          accentClass={investor.accent}
          disabled={awaitingReply}
          onSend={(text) => onSendFollowUp?.(text)}
        />
      )}
    </article>
  )
}

/* ---------- Sub-components ---------- */

function MessageBubble({
  message,
  animate,
  accentClass,
  onDone,
}: {
  message: ChatMessage
  animate: boolean
  accentClass: string
  onDone: () => void
}) {
  // User bubble — plain.
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">
          <span className="mr-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            You
          </span>
          <span className="whitespace-pre-wrap">{message.content}</span>
        </div>
      </div>
    )
  }

  // Investor bubble — animate if requested.
  return (
    <div className="text-sm">
      <AnimatedText
        text={message.content}
        animate={animate}
        accentClass={accentClass}
        onDone={onDone}
      />
    </div>
  )
}

function AnimatedText({
  text,
  animate,
  accentClass,
  onDone,
}: {
  text: string
  animate: boolean
  accentClass: string
  onDone: () => void
}) {
  const { displayed, done } = useTypewriter(text, animate, 10, onDone)

  if (!animate) {
    return <p className="whitespace-pre-wrap text-pretty">{text}</p>
  }
  return (
    <p className="whitespace-pre-wrap text-pretty">
      {displayed}
      {!done && (
        <span
          className={cn(
            "ml-0.5 inline-block h-4 w-1.5 -translate-y-px animate-pulse bg-current align-middle",
            accentClass,
          )}
          aria-hidden="true"
        />
      )}
    </p>
  )
}

function FollowUpInput({
  investorName,
  accentClass,
  disabled,
  onSend,
}: {
  investorName: string
  accentClass: string
  disabled: boolean
  onSend: (text: string) => void
}) {
  const [value, setValue] = useState("")
  const tooLong = value.length > 800

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed || disabled || tooLong) return
    onSend(trimmed)
    setValue("")
  }

  const firstName = investorName.split(" ")[0]

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-1 flex flex-col gap-1.5 border-t border-border/60 pt-3"
    >
      <label
        htmlFor={`followup-${investorName}`}
        className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground"
      >
        <MessageSquare className={cn("h-3 w-3", accentClass)} aria-hidden="true" />
        PUSH BACK ON {firstName.toUpperCase()}
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id={`followup-${investorName}`}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 850))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e)
            }
          }}
          placeholder={`Defend, clarify, or argue back…`}
          rows={2}
          disabled={disabled}
          className={cn(
            "min-h-[44px] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-snug text-foreground placeholder:text-muted-foreground/60",
            "focus:border-red-500/50 focus:outline-none focus:ring-1 focus:ring-red-500/20",
            "disabled:opacity-50",
          )}
        />
        <button
          type="submit"
          disabled={disabled || value.trim().length === 0 || tooLong}
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-secondary/60 px-2.5 font-mono text-[11px] font-semibold tracking-wide text-foreground transition-colors",
            "hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-secondary/60 disabled:hover:text-foreground",
          )}
          aria-label={`Send follow-up to ${investorName}`}
        >
          <Send className="h-3 w-3" aria-hidden="true" />
          SEND
        </button>
      </div>
      {tooLong && (
        <span className="font-mono text-[10px] text-red-400">Trim to 800 characters.</span>
      )}
    </form>
  )
}

function StatusBadge({
  status,
  awaitingReply,
}: {
  status: Status
  awaitingReply: boolean
}) {
  if (awaitingReply) {
    return (
      <span className="shrink-0 rounded-sm border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-red-400">
        REPLYING
      </span>
    )
  }

  const map: Record<Status, { label: string; className: string }> = {
    idle: { label: "STANDBY", className: "border-border/60 text-muted-foreground/60" },
    loading: { label: "LOADING", className: "border-border text-muted-foreground" },
    ready: { label: "QUEUED", className: "border-red-500/40 text-red-400" },
    typing: { label: "FIRING", className: "border-red-500 text-red-400 bg-red-500/10" },
    done: { label: "OPEN", className: "border-emerald-500/40 text-emerald-400" },
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
