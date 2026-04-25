import { INVESTORS, VERDICT_PROMPT } from "@/lib/investors"
import {
  resolveModel,
  generateWithRetry,
  extractApiErrorMessage,
  NO_PROVIDER_MESSAGE,
} from "@/lib/ai"

export const maxDuration = 60
export const runtime = "nodejs"

type PreviousCritique = { id: string; critique: string }

function buildCritiquePrompt(
  pitch: string,
  investorId: string,
  previousPitch?: string,
  previousCritiques?: PreviousCritique[],
): string {
  const myPrev = previousCritiques?.find((c) => c.id === investorId)?.critique

  if (previousPitch && myPrev) {
    return `You already heard this founder pitch you a few minutes ago.

Their PREVIOUS pitch was:
"""${previousPitch}"""

Your previous critique was:
"${myPrev}"

The founder has now revised. Here is the new pitch:
"""${pitch}"""

React to the REVISION specifically. Did they actually address your concern from last time, or did they dodge it?
- If they addressed it, acknowledge that crisply and find the next sharpest issue.
- If they dodged it, hit harder and call out the dodge by name.
Reference your previous concern naturally — you remember what you said.
Stay 100% in character. 2-6 sentences. No greeting. Open mid-thought.`
  }

  return `The founder just pitched you in the meeting:

"""${pitch}"""

It's your turn to speak. Stay 100% in character — voice, vocabulary, attitude, all of it. React the way YOU specifically would react. No greeting. Open mid-thought. 2-6 sentences. Vary your cadence — short and brutal, or longer with one concession before the kill. Be the human being described in your persona, not a generic VC.`
}

export async function POST(req: Request) {
  try {
    const {
      pitch,
      previousPitch,
      previousCritiques,
    } = (await req.json()) as {
      pitch?: string
      previousPitch?: string
      previousCritiques?: PreviousCritique[]
    }

    if (!pitch || typeof pitch !== "string" || pitch.trim().length < 10) {
      return Response.json({ error: "Pitch must be at least 10 characters." }, { status: 400 })
    }

    const resolved = resolveModel()
    if (!resolved) {
      return Response.json({ error: NO_PROVIDER_MESSAGE }, { status: 503 })
    }
    const { model } = resolved

    const trimmedPitch = pitch.trim()
    const isRevision = Boolean(previousPitch && previousCritiques?.length)

    // ALL 5 investors fire IN PARALLEL — this is what makes the demo feel fast.
    const critiquePromises = INVESTORS.map(async (investor) => {
      try {
        const { text } = await generateWithRetry({
          model,
          system: investor.systemPrompt,
          prompt: buildCritiquePrompt(
            trimmedPitch,
            investor.id,
            previousPitch,
            previousCritiques,
          ),
          temperature: 0.95,
          maxOutputTokens: 320,
        })
        return {
          id: investor.id,
          name: investor.name,
          critique: text.trim(),
          ok: true as const,
          errorMessage: null as string | null,
        }
      } catch (err) {
        console.error(`[v0] critique failed for ${investor.id}:`, err)
        return {
          id: investor.id,
          name: investor.name,
          critique: `${investor.name} stepped out of the room. (Provider error.)`,
          ok: false as const,
          errorMessage: extractApiErrorMessage(err),
        }
      }
    })

    const critiques = await Promise.all(critiquePromises)

    if (critiques.every((c) => !c.ok)) {
      const firstReason =
        critiques.find((c) => c.errorMessage)?.errorMessage ?? "All investor calls failed."
      return Response.json({ error: firstReason }, { status: 502 })
    }

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
      const verdictUserPrompt = isRevision
        ? `THIS IS A REVISED PITCH (round 2 with the same panel).

ORIGINAL PITCH:
"""${previousPitch}"""

REVISED PITCH:
"""${trimmedPitch}"""

PANEL CRITIQUES OF THE REVISION:
${transcript}

Now write the moderator's read of the room AFTER the revision. If the panel feels the founder genuinely addressed concerns, the score should rise meaningfully vs. round 1. If they dodged, the score should drop. The mustFix MUST paraphrase the single sharpest thing the panel said about the REVISED pitch. Return ONLY the JSON.`
        : `PITCH:
"""${trimmedPitch}"""

PANEL CRITIQUES:
${transcript}

Now write the moderator's read of the room. The mustFix MUST paraphrase the single sharpest thing the panel said — do not invent generic advice. Return ONLY the JSON.`

      const { text: verdictRaw } = await generateWithRetry({
        model,
        system: VERDICT_PROMPT,
        prompt: verdictUserPrompt,
        temperature: 0.6,
        maxOutputTokens: 340,
      })

      const cleaned = verdictRaw
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim()

      const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned)

      score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
      if (parsed.verdict) verdict = String(parsed.verdict).trim()
      if (parsed.mustFix) mustFix = String(parsed.mustFix).trim()
    } catch (err) {
      console.error("[v0] verdict parse failed:", err)
    }

    return Response.json({
      critiques: critiques.map(({ id, name, critique }) => ({ id, name, critique })),
      score,
      verdict,
      mustFix,
      isRevision,
    })
  } catch (err) {
    console.error("[v0] /api/critique error:", err)
    return Response.json({ error: extractApiErrorMessage(err) }, { status: 500 })
  }
}
