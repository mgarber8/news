import { NextResponse } from "next/server"

const LIST_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models"

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "Missing GEMINI_API_KEY." }, { status: 500 })
  }

  const res = await fetch(`${LIST_MODELS_URL}?key=${apiKey}`)
  if (!res.ok) {
    const errorText = await res.text()
    return NextResponse.json({ error: errorText || "ListModels request failed." }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
