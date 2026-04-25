import { INVESTORS } from "@/lib/investors"
import {
  resolveModel,
  generateWithRetry,
  extractApiErrorMessage,
  NO_PROVIDER_MESSAGE,
} from "@/lib/ai"
import type { ModelMessage } from "ai"

export const maxDuration = 60
export const runtime = "nodejs"

type ChatMessage = { role: "investor" | "user"; content: string }

export async function POST(req: Request) {
  try {
    const { investorId, pitch, history, userMessage } = (await req.json()) as {
      investorId?: string
      pitch?: string
      history?: ChatMessage[]
      userMessage?: string
    }

    const investor = INVESTORS.find((i) => i.id === investorId)
    if (!investor) {
      return Response.json({ error: "Unknown investor." }, { status: 400 })
    }
    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 10) {
      return Response.json({ error: "Missing pitch context." }, { status: 400 })
    }
    if (!userMessage || typeof userMessage !== "string" || userMessage.trim().length === 0) {
      return Response.json({ error: "Empty message." }, { status: 400 })
    }
    if (userMessage.trim().length > 800) {
      return Response.json({ error: "Follow-up too long (max 800 chars)." }, { status: 400 })
    }

    const resolved = resolveModel()
    if (!resolved) {
      return Response.json({ error: NO_PROVIDER_MESSAGE }, { status: 503 })
    }

    // Build conversation: pitch -> investor's first critique -> founder follow-ups -> investor replies
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: `The founder pitched the following in the room:\n\n"""${pitch.trim()}"""\n\nReact in character.`,
      },
      ...(history ?? []).map<ModelMessage>((m) => ({
        role: m.role === "investor" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: userMessage.trim() },
    ]

    try {
      const { text } = await generateWithRetry({
        model: resolved.model,
        system: `${investor.systemPrompt}

CONVERSATION CONTEXT: The founder is now responding to your initial critique. They may push back, defend themselves, ask why you said something, or get emotional. Stay 100% in character. Do NOT soften your position just because they are pushing back. If they make a fair point, you may concede ONE small thing — but only if it's actually fair. If they dodge, call it out. If they get hostile, you stay calm and lethal — investors don't lose their cool. Keep replies SHORTER in follow-ups (1-4 sentences). No greeting. Open mid-thought.`,
        messages,
        temperature: 0.95,
        maxOutputTokens: 280,
      })

      return Response.json({ reply: text.trim() })
    } catch (err) {
      console.error(`[v0] follow-up failed for ${investor.id}:`, err)
      return Response.json(
        { error: extractApiErrorMessage(err) },
        { status: 502 },
      )
    }
  } catch (err) {
    console.error("[v0] /api/follow-up error:", err)
    return Response.json(
      { error: extractApiErrorMessage(err) },
      { status: 500 },
    )
  }
}
