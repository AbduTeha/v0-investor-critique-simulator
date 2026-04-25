import { Skull } from "lucide-react"

export function IdeaKillerHeader() {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-red-500/40 bg-red-500/10">
          <Skull className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[10px] tracking-[0.2em] text-red-400">
            IDEAKILLER · v1.0
          </span>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pitch the panel.
          </h1>
        </div>
      </div>
      <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Five ruthless investors. Five attack vectors. They fire in parallel, the room
        scores you 0–100, and you walk out with the one thing you must fix before a real
        pitch.
      </p>
    </header>
  )
}
