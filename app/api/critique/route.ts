import { generateText } from "ai"
import { INVESTORS, VERDICT_PROMPT } from "@/lib/investors"

export const maxDuration = 60

const MODEL = "openai/gpt-5-mini"

export async function POST(req: Request) {
  try {
    const { pitch } = (await req.json()) as { pitch?: string }

    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 10) {
      return Response.json(
        { error: "Pitch must be at least 10 characters." },
        { status: 400 },
      )
    }

    // ALL 5 investors fire in parallel — this is the magic that makes the demo feel fast
    const critiquePromises = INVESTORS.map(async (investor) => {
      const { text } = await generateText({
        model: MODEL,
        system: investor.systemPrompt,
        prompt: `The founder just pitched the following:\n\n"""${pitch.trim()}"""\n\nDeliver your critique now. Stay in character. 3-5 sentences MAX.`,
      })
      return {
        id: investor.id,
        name: investor.name,
        critique: text.trim(),
      }
    })

    const critiques = await Promise.all(critiquePromises)

    // Now compute the verdict from the panel
    const transcript = critiques
      .map((c) => {
        const inv = INVESTORS.find((i) => i.id === c.id)!
        return `${inv.name} (${inv.attackVector}):\n${c.critique}`
      })
      .join("\n\n")

    const { text: verdictRaw } = await generateText({
      model: MODEL,
      system: VERDICT_PROMPT,
      prompt: `PITCH:\n"""${pitch.trim()}"""\n\nPANEL CRITIQUES:\n${transcript}\n\nReturn the JSON now.`,
    })

    let score = 0
    let verdict = ""
    let mustFix = ""

    try {
      const cleaned = verdictRaw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim()
      const parsed = JSON.parse(cleaned)
      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
      verdict = String(parsed.verdict || "").trim()
      mustFix = String(parsed.mustFix || "").trim()
    } catch {
      score = 35
      verdict = "The room is unconvinced."
      mustFix = "Sharpen the single most important reason this needs to exist now."
    }

    return Response.json({
      critiques,
      score,
      verdict,
      mustFix,
    })
  } catch (err) {
    console.error("[v0] /api/critique error:", err)
    return Response.json(
      { error: "The investor panel walked out. Try again." },
      { status: 500 },
    )
  }
}
