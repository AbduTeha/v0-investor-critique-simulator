import { generateText, type LanguageModel } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { INVESTORS, VERDICT_PROMPT } from "@/lib/investors"

export const maxDuration = 60
export const runtime = "nodejs"

/**
 * Provider auto-detection.
 * - Prefers ANTHROPIC_API_KEY (the playbook default).
 * - Falls back to OPENAI_API_KEY.
 * - Returns a clear 503 if neither is set, so the UI can surface a real message.
 */
function resolveModel(): { model: LanguageModel; provider: "anthropic" | "openai" } | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { model: anthropic("claude-3-5-haiku-latest"), provider: "anthropic" }
  }
  if (process.env.OPENAI_API_KEY) {
    return { model: openai("gpt-4o-mini"), provider: "openai" }
  }
  return null
}

export async function POST(req: Request) {
  try {
    const { pitch } = (await req.json()) as { pitch?: string }

    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 10) {
      return Response.json({ error: "Pitch must be at least 10 characters." }, { status: 400 })
    }

    const resolved = resolveModel()
    if (!resolved) {
      return Response.json(
        {
          error:
            "No AI provider configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to your environment variables and redeploy.",
        },
        { status: 503 },
      )
    }
    const { model } = resolved

    const trimmedPitch = pitch.trim()

    // ALL 5 investors fire IN PARALLEL — this is what makes the demo feel fast.
    const critiquePromises = INVESTORS.map(async (investor) => {
      try {
        const { text } = await generateText({
          model,
          system: investor.systemPrompt,
          prompt: `The founder just pitched the following:\n\n"""${trimmedPitch}"""\n\nDeliver your critique now. Stay in character. 3-5 sentences MAX. No greeting. Open with the kill shot.`,
          temperature: 0.85,
          maxOutputTokens: 280,
        })
        return {
          id: investor.id,
          name: investor.name,
          critique: text.trim(),
          ok: true as const,
        }
      } catch (err) {
        console.error(`[v0] critique failed for ${investor.id}:`, err)
        return {
          id: investor.id,
          name: investor.name,
          critique: `${investor.name} stepped out of the room. (Provider error.)`,
          ok: false as const,
        }
      }
    })

    const critiques = await Promise.all(critiquePromises)

    // If every investor failed, surface a real error instead of a fake verdict.
    if (critiques.every((c) => !c.ok)) {
      return Response.json(
        {
          error:
            "All investor calls failed. Check that your provider key is valid and has credit, then try again.",
        },
        { status: 502 },
      )
    }

    // Compose the panel transcript and ask for the verdict (6th call).
    const transcript = critiques
      .map((c) => {
        const inv = INVESTORS.find((i) => i.id === c.id)!
        return `${inv.name} (${inv.attackVector}):\n${c.critique}`
      })
      .join("\n\n")

    let score = 35
    let verdict = "The room is unconvinced."
    let mustFix = "Sharpen the single most important reason this needs to exist now."

    try {
      const { text: verdictRaw } = await generateText({
        model,
        system: VERDICT_PROMPT,
        prompt: `PITCH:\n"""${trimmedPitch}"""\n\nPANEL CRITIQUES:\n${transcript}\n\nReturn the JSON now.`,
        temperature: 0.4,
        maxOutputTokens: 300,
      })

      const cleaned = verdictRaw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim()

      // Be lenient: extract the first JSON object if the model wrapped it in prose.
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)

      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
      if (parsed.verdict) verdict = String(parsed.verdict).trim()
      if (parsed.mustFix) mustFix = String(parsed.mustFix).trim()
    } catch (err) {
      console.error("[v0] verdict parse failed:", err)
      // Fallbacks above stay in place.
    }

    return Response.json({
      critiques: critiques.map(({ id, name, critique }) => ({ id, name, critique })),
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
