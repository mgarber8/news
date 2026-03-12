import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { addDaysToYmd, buildAndSendIssue, computeCutoffWindow } from "@/lib/server/newsletter-send"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendKey = process.env.RESEND_API_KEY
  const resendFrom = process.env.RESEND_FROM

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Missing Supabase service role config." }, { status: 500 })
  }
  if (!resendKey || !resendFrom) {
    return NextResponse.json({ error: "Missing Resend config." }, { status: 500 })
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const token = authHeader.replace("Bearer ", "")
  if (!token) {
    return NextResponse.json({ error: "Missing auth token." }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const newsletterId = params.id
  const { data: newsletter, error: newsletterError } = await supabase
    .from("newsletters")
    .select("id,title,owner_id,cutoff_day,cutoff_time,cutoff_tz,current_week_start")
    .eq("id", newsletterId)
    .single()

  if (newsletterError || !newsletter) {
    return NextResponse.json({ error: "Newsletter not found." }, { status: 404 })
  }

  if (newsletter.owner_id !== userData.user.id) {
    return NextResponse.json({ error: "Only the owner can send." }, { status: 403 })
  }

  const { weekStartValue: fallbackWeekStart } = computeCutoffWindow(newsletter)
  const weekStartValue = newsletter.current_week_start ?? fallbackWeekStart

  const existingIssue = await supabase
    .from("issues")
    .select("id,status")
    .eq("newsletter_id", newsletterId)
    .eq("week_start", weekStartValue)
    .eq("status", "sent")
    .maybeSingle()

  if (existingIssue.data?.id) {
    return NextResponse.json({ error: "This week's issue was already sent." }, { status: 409 })
  }

  const testRecipient = process.env.RESEND_TEST_TO
  const recipients: string[] = []

  if (testRecipient) {
    recipients.push(testRecipient)
  } else {
    const membershipRes = await supabase
      .from("newsletter_memberships")
      .select("user_id")
      .eq("newsletter_id", newsletterId)

    if (membershipRes.error) {
      return NextResponse.json({ error: membershipRes.error.message }, { status: 500 })
    }

    const memberIds = new Set<string>(membershipRes.data?.map((row) => row.user_id) ?? [])
    if (newsletter.owner_id) {
      memberIds.add(newsletter.owner_id)
    }

    for (const userId of Array.from(memberIds)) {
      const { data: userRecord } = await supabase.auth.admin.getUserById(userId)
      const email = userRecord?.user?.email
      if (email) {
        recipients.push(email)
      }
    }
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found." }, { status: 400 })
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
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }

  const nextWeekStart = addDaysToYmd(weekStartValue, 7)
  await supabase.from("newsletters").update({ current_week_start: nextWeekStart }).eq("id", newsletter.id)

  return NextResponse.json({ ok: true })
}
