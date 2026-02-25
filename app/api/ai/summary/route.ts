import { NextResponse } from "next/server"

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY." }, { status: 500 })
  }

  const body = await request.json()
  const entries = Array.isArray(body?.entries) ? body.entries : []
  const name = typeof body?.name === "string" && body.name.trim().length > 0 ? body.name.trim() : "This member"

  if (entries.length === 0) {
    return NextResponse.json({ error: "No entries provided." }, { status: 400 })
  }

  const formatted = entries
    .filter((entry) => entry?.answer)
    .map((entry) => `- ${entry.label}: ${entry.answer}`)
    .join("\n")

  const prompt = [
    "You are writing a single, friendly newsletter paragraph based on the updates below.",
    `Write in third person and start with the name: ${name}.`,
    "Rules:",
    "- Write exactly one paragraph (no bullets).",
    "- Mention every field that has content, in the order provided.",
    "- Do not add facts that are not present.",
    "- Keep the tone warm and concise.",
    "- No greetings or sign-offs.",
    "- End with a complete sentence (no cutoffs).",
    "",
    "Updates:",
    formatted,
  ].join("\n")

  const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2000,
      },
    }),
  })

  if (!geminiRes.ok) {
    const errorText = await geminiRes.text()
    return NextResponse.json({ error: errorText || "Gemini request failed." }, { status: 500 })
  }

  const data = await geminiRes.json()
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ""

  if (!summary) {
    return NextResponse.json({ error: "No summary returned." }, { status: 500 })
  }

  return NextResponse.json({ summary })
}
