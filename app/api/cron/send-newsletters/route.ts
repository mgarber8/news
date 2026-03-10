import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildAndSendIssue, computeCutoffWindow } from "@/lib/server/newsletter-send"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  const isVercelCron = request.headers.get("x-vercel-cron") === "1"
  const { searchParams } = new URL(request.url)
  const debug = searchParams.get("debug") === "1"

  if (!isVercelCron && (!secret || token !== secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM

  if (!supabaseUrl || !serviceKey || !resendKey || !resendFrom) {
    return NextResponse.json({ error: "Missing server config." }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: newsletters, error: newsletterError } = await supabase
    .from("newsletters")
    .select("id,title,owner_id,cutoff_day,cutoff_time,cutoff_tz")

  if (newsletterError) {
    return NextResponse.json({ error: newsletterError.message }, { status: 500 })
  }

  const results: { id: string; status: string }[] = []
  const now = new Date()

  for (const newsletter of newsletters ?? []) {
    const { lastCutoff } = computeCutoffWindow(newsletter)
    const sendWeekStart = new Date(lastCutoff.getTime())
    sendWeekStart.setUTCDate(sendWeekStart.getUTCDate() - 7)
    const sendWeekStartValue = new Intl.DateTimeFormat("en-US", {
      timeZone: newsletter.cutoff_tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(sendWeekStart)
      .reduce(
        (acc, part) => {
          if (part.type === "year") acc.year = part.value
          if (part.type === "month") acc.month = part.value
          if (part.type === "day") acc.day = part.value
          return acc
        },
        { year: "", month: "", day: "" }
      )

    const sendWeekStartKey = `${sendWeekStartValue.year}-${sendWeekStartValue.month}-${sendWeekStartValue.day}`

    if (now < lastCutoff) {
      results.push({
        id: newsletter.id,
        status: "skipped_before_cutoff",
        ...(debug
          ? {
              now: now.toISOString(),
              lastCutoff: lastCutoff.toISOString(),
              sendWeekStart: sendWeekStartKey,
              cutoffTz: newsletter.cutoff_tz,
              cutoffDay: newsletter.cutoff_day,
              cutoffTime: newsletter.cutoff_time,
            }
          : {}),
      })
      continue
    }

    const existingIssue = await supabase
      .from("issues")
      .select("id,status")
      .eq("newsletter_id", newsletter.id)
      .eq("week_start", sendWeekStartKey)
      .eq("status", "sent")
      .maybeSingle()

    if (existingIssue.data?.id) {
      results.push({
        id: newsletter.id,
        status: "already_sent",
        ...(debug
          ? {
              now: now.toISOString(),
              lastCutoff: lastCutoff.toISOString(),
              sendWeekStart: sendWeekStartKey,
            }
          : {}),
      })
      continue
    }

    const membershipRes = await supabase
      .from("newsletter_memberships")
      .select("user_id")
      .eq("newsletter_id", newsletter.id)

    if (membershipRes.error) {
      results.push({ id: newsletter.id, status: "member_error" })
      continue
    }

    const memberIds = new Set<string>(membershipRes.data?.map((row) => row.user_id) ?? [])
    if (newsletter.owner_id) {
      memberIds.add(newsletter.owner_id)
    }

    const recipients: string[] = []
    for (const userId of Array.from(memberIds)) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(userId)
      const email = userRecord?.user?.email
      if (email) {
        recipients.push(email)
      }
    }

    if (recipients.length === 0) {
      results.push({
        id: newsletter.id,
        status: "no_recipients",
        ...(debug
          ? {
              now: now.toISOString(),
              lastCutoff: lastCutoff.toISOString(),
              sendWeekStart: sendWeekStartKey,
            }
          : {}),
      })
      continue
    }

    try {
      await buildAndSendIssue({
        supabase,
        newsletter,
        weekStartValue: sendWeekStartKey,
        resendKey,
        resendFrom,
        recipients,
      })
      results.push({
        id: newsletter.id,
        status: "sent",
        ...(debug
          ? {
              now: now.toISOString(),
              lastCutoff: lastCutoff.toISOString(),
              sendWeekStart: sendWeekStartKey,
            }
          : {}),
      })
    } catch (error) {
      const message = (error as Error).message
      results.push({
        id: newsletter.id,
        status: "send_error",
        ...(debug
          ? {
              now: now.toISOString(),
              lastCutoff: lastCutoff.toISOString(),
              sendWeekStart: sendWeekStartKey,
              error: message,
            }
          : {}),
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}
