import { SupabaseClient } from "@supabase/supabase-js"

type NewsletterRow = {
  id: string
  title: string
  owner_id: string | null
  cutoff_day: number
  cutoff_time: string
  cutoff_tz: string
}

const weekdayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const getTimeZoneOffsetMinutes = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
  const parts = formatter.formatToParts(date)
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0"
  const match = offsetPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/)
  if (!match) return 0
  const hours = Number.parseInt(match[1], 10)
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0
  return hours * 60 + (hours >= 0 ? minutes : -minutes)
}

const makeZonedDate = (
  { year, month, day, hour, minute, second }: { year: number; month: number; day: number; hour: number; minute: number; second: number },
  timeZone: string
) => {
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  const offset = getTimeZoneOffsetMinutes(utcDate, timeZone)
  return new Date(utcDate.getTime() - offset * 60 * 1000)
}

const getZonedParts = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  })
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: weekdayIndex[values.weekday] ?? 0,
  }
}

const formatDateYmd = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const parseCutoffTime = (timeValue: string) => {
  const [hourRaw, minuteRaw = "0", secondRaw = "0"] = timeValue.split(":")
  return {
    hour: Number.parseInt(hourRaw, 10) || 0,
    minute: Number.parseInt(minuteRaw, 10) || 0,
    second: Number.parseInt(secondRaw, 10) || 0,
  }
}

export const computeCutoffWindow = (newsletter: NewsletterRow) => {
  const now = new Date()
  const { year, month, day, hour, minute, second, weekday } = getZonedParts(now, newsletter.cutoff_tz)
  const cutoffTime = parseCutoffTime(newsletter.cutoff_time)
  const daysSinceCutoff = (weekday - newsletter.cutoff_day + 7) % 7
  let cutoffDate = makeZonedDate(
    { year, month, day, hour: cutoffTime.hour, minute: cutoffTime.minute, second: cutoffTime.second },
    newsletter.cutoff_tz
  )
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysSinceCutoff)

  if (daysSinceCutoff === 0) {
    const nowMinutes = hour * 60 + minute + second / 60
    const cutoffMinutes = cutoffTime.hour * 60 + cutoffTime.minute + cutoffTime.second / 60
    if (nowMinutes < cutoffMinutes) {
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7)
    }
  }

  const weekStart = cutoffDate
  const editDeadline = new Date(weekStart.getTime())
  editDeadline.setUTCDate(editDeadline.getUTCDate() + 7)

  return {
    weekStartValue: formatDateYmd(weekStart, newsletter.cutoff_tz),
    editDeadline,
  }
}

const toHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")

export const buildAndSendIssue = async (args: {
  supabase: SupabaseClient
  newsletter: NewsletterRow
  weekStartValue: string
  resendKey: string
  resendFrom: string
  recipients: string[]
}) => {
  const { supabase, newsletter, weekStartValue, resendKey, resendFrom, recipients } = args

  const membershipRes = await supabase
    .from("newsletter_memberships")
    .select("user_id")
    .eq("newsletter_id", newsletter.id)

  if (membershipRes.error) {
    throw new Error(membershipRes.error.message)
  }

  const memberIds = new Set<string>(membershipRes.data?.map((row) => row.user_id) ?? [])
  if (newsletter.owner_id) {
    memberIds.add(newsletter.owner_id)
  }

  const userIds = Array.from(memberIds)
  const profileRes = await supabase
    .from("profiles")
    .select("id,first_name,last_name,avatar_path")
    .in("id", userIds)

  if (profileRes.error) {
    throw new Error(profileRes.error.message)
  }

  const submissionsRes = await supabase
    .from("submissions")
    .select("id,user_id,ai_summary")
    .eq("newsletter_id", newsletter.id)
    .eq("week_start", weekStartValue)

  if (submissionsRes.error) {
    throw new Error(submissionsRes.error.message)
  }

  const submissionIds = submissionsRes.data?.map((row) => row.id) ?? []
  const photosRes =
    submissionIds.length > 0
      ? await supabase
          .from("submission_photos")
          .select("submission_id,path")
          .in("submission_id", submissionIds)
      : { data: [], error: null }

  if (photosRes.error) {
    throw new Error(photosRes.error.message)
  }

  const photoMap = new Map<string, string[]>()
  photosRes.data?.forEach((row) => {
    const list = photoMap.get(row.submission_id) ?? []
    list.push(row.path)
    photoMap.set(row.submission_id, list)
  })

  const submissionsByUser = new Map<string, { summary: string; photos: string[] }>()
  submissionsRes.data?.forEach((row) => {
    submissionsByUser.set(row.user_id, {
      summary: row.ai_summary || "",
      photos: photoMap.get(row.id) ?? [],
    })
  })

  const profileById = new Map(profileRes.data?.map((profile) => [profile.id, profile]) ?? [])

  const sections = userIds.map((userId) => {
    const profile = profileById.get(userId)
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member"
    const avatarUrl = profile?.avatar_path
      ? supabase.storage.from("profile-photos").getPublicUrl(profile.avatar_path).data.publicUrl
      : ""
    const submission = submissionsByUser.get(userId)
    const summary = submission?.summary?.trim() || "No update submitted yet."
    const photoUrls =
      submission?.photos?.map((path) => supabase.storage.from("submission-photos").getPublicUrl(path).data.publicUrl) ??
      []

    const photoHtml = photoUrls.length
      ? `<div style="margin-top:12px; display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:8px;">
          ${photoUrls
            .map(
              (url) =>
                `<img src="${url}" alt="Photo" style="width:100%; height:140px; object-fit:cover; border-radius:8px;" />`
            )
            .join("")}
        </div>`
      : ""

    return `
      <div style="border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
          ${
            avatarUrl
              ? `<img src="${avatarUrl}" alt="${name}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;" />`
              : `<div style="width:48px; height:48px; border-radius:50%; background:#f3f4f6;"></div>`
          }
          <div style="font-weight:600; font-size:16px; color:#111827;">${toHtml(name)}</div>
        </div>
        <div style="font-size:14px; color:#374151; line-height:1.6;">${toHtml(summary)}</div>
        ${photoHtml}
      </div>
    `
  })

  const html = `
    <div style="font-family:Arial, sans-serif; background:#f9fafb; padding:24px;">
      <div style="max-width:720px; margin:0 auto; background:white; border-radius:16px; padding:24px;">
        <h1 style="margin:0 0 8px; font-size:24px; color:#111827;">${toHtml(newsletter.title)}</h1>
        <p style="margin:0 0 24px; font-size:14px; color:#6b7280;">Week of ${weekStartValue}</p>
        ${sections.join("")}
      </div>
    </div>
  `

  const emailPayload = {
    from: resendFrom,
    to: recipients,
    subject: `${newsletter.title} — Week of ${weekStartValue}`,
    html,
  }

  let resendRes: Response
  try {
    resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    })
  } catch (error) {
    throw new Error(`Resend fetch failed: ${(error as Error).message}`)
  }

  if (!resendRes.ok) {
    const errorText = await resendRes.text()
    throw new Error(errorText || "Failed to send email.")
  }

  await supabase.from("issues").upsert(
    {
      newsletter_id: newsletter.id,
      week_start: weekStartValue,
      subject: emailPayload.subject,
      html,
      status: "sent",
      sent_at: new Date().toISOString(),
    },
    { onConflict: "newsletter_id,week_start" }
  )
}
