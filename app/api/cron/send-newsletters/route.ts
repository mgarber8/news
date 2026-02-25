import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildAndSendIssue, computeCutoffWindow } from "@/lib/server/newsletter-send"

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")

  if (!secret || token !== secret) {
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
    const { weekStartValue, editDeadline } = computeCutoffWindow(newsletter)

    if (now < editDeadline) {
      results.push({ id: newsletter.id, status: "skipped_before_cutoff" })
      continue
    }

    const existingIssue = await supabase
      .from("issues")
      .select("id,status")
      .eq("newsletter_id", newsletter.id)
      .eq("week_start", weekStartValue)
      .eq("status", "sent")
      .maybeSingle()

    if (existingIssue.data?.id) {
      results.push({ id: newsletter.id, status: "already_sent" })
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
      results.push({ id: newsletter.id, status: "no_recipients" })
      continue
    }

    try {
      await buildAndSendIssue({
        supabase,
        newsletter,
        weekStartValue,
        resendKey,
        resendFrom,
        recipients,
      })
      results.push({ id: newsletter.id, status: "sent" })
    } catch (error) {
      results.push({ id: newsletter.id, status: "send_error" })
    }
  }

  return NextResponse.json({ ok: true, results })
}
