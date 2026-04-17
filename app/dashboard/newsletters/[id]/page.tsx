"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, CheckCircle2, Clock, FileText, Loader2, PenTool, Users } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type Newsletter = {
  id: string
  title: string
  description: string | null
  owner_id: string | null
  current_week_start: string | null
}

type MemberRow = {
  id: string
  name: string
  isOwner: boolean
}

type NewsletterQuestion = {
  id: string
  label: string
  placeholder: string | null
  is_active: boolean
  is_base: boolean
  sort_order: number
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

const DEFAULT_CUTOFF_TIME = "00:00"
const DEFAULT_CUTOFF_TZ = "America/New_York"

const parseCutoffTime = (timeValue: string) => {
  const [hourRaw, minuteRaw = "0", secondRaw = "0"] = timeValue.split(":")
  return {
    hour: Number.parseInt(hourRaw, 10) || 0,
    minute: Number.parseInt(minuteRaw, 10) || 0,
    second: Number.parseInt(secondRaw, 10) || 0,
  }
}

const computeWeekStartValue = (cutoffDay: number) => {
  const now = new Date()
  const { year, month, day, hour, minute, second, weekday } = getZonedParts(now, DEFAULT_CUTOFF_TZ)
  const cutoff = parseCutoffTime(DEFAULT_CUTOFF_TIME)
  const daysSinceCutoff = (weekday - cutoffDay + 7) % 7
  let cutoffDate = makeZonedDate(
    { year, month, day, hour: cutoff.hour, minute: cutoff.minute, second: cutoff.second },
    DEFAULT_CUTOFF_TZ
  )
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysSinceCutoff)

  if (daysSinceCutoff === 0) {
    const nowMinutes = hour * 60 + minute + second / 60
    const cutoffMinutes = cutoff.hour * 60 + cutoff.minute + cutoff.second / 60
    if (nowMinutes < cutoffMinutes) {
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 7)
    }
  }

  return formatDateYmd(cutoffDate, DEFAULT_CUTOFF_TZ)
}

export default function NewsletterDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [members, setMembers] = useState<MemberRow[]>([])
  const [questions, setQuestions] = useState<NewsletterQuestion[]>([])
  const [authUserId, setAuthUserId] = useState("")
  const [newQuestionLabel, setNewQuestionLabel] = useState("")
  const [newQuestionPlaceholder, setNewQuestionPlaceholder] = useState("")
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)
  const [isRemovingMemberId, setIsRemovingMemberId] = useState<string | null>(null)
  const [cutoffDay, setCutoffDay] = useState(5)
  const [isSavingCutoff, setIsSavingCutoff] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState("")
  const [weekStartValue, setWeekStartValue] = useState("")
  const [hasSubmission, setHasSubmission] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError("")

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        router.push("/auth/login")
        return
      }
      setAuthUserId(authData.user.id)

      const newsletterRes = await supabase
        .from("newsletters")
        .select("id,title,description,owner_id,cutoff_day,cutoff_time,cutoff_tz,current_week_start")
        .eq("id", newsletterId)
        .single()

      if (newsletterRes.error) {
        setError(newsletterRes.error.message)
        setIsLoading(false)
        return
      }

      setNewsletter(newsletterRes.data)
      setCutoffDay(newsletterRes.data.cutoff_day ?? 5)
      const computedWeekStart =
        newsletterRes.data.current_week_start ?? computeWeekStartValue(newsletterRes.data.cutoff_day ?? 5)
      setWeekStartValue(computedWeekStart)

      const submissionRes = await supabase
        .from("submissions")
        .select("id")
        .eq("newsletter_id", newsletterId)
        .eq("user_id", authData.user.id)
        .eq("week_start", computedWeekStart)
        .maybeSingle()

      if (submissionRes.error) {
        setError(submissionRes.error.message)
        setIsLoading(false)
        return
      }

      setHasSubmission(Boolean(submissionRes.data))

      const questionRes = await supabase
        .from("newsletter_questions")
        .select("id,label,placeholder,is_active,is_base,sort_order")
        .eq("newsletter_id", newsletterId)
        .order("sort_order", { ascending: true })

      if (questionRes.error) {
        setError(questionRes.error.message)
        setIsLoading(false)
        return
      }

      setQuestions(questionRes.data ?? [])

      const membershipRes = await supabase
        .from("newsletter_memberships")
        .select("user_id, profile:profiles(first_name,last_name)")
        .eq("newsletter_id", newsletterId)

      if (membershipRes.error) {
        setError(membershipRes.error.message)
        setIsLoading(false)
        return
      }

      const rows =
        membershipRes.data?.map((row) => {
          const profile = row.profile as { first_name: string | null; last_name: string | null } | null
          return {
            id: row.user_id,
            name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member",
            isOwner: false,
          }
        }) ?? []

      if (newsletterRes.data.owner_id) {
        const ownerExists = rows.some((member) => member.id === newsletterRes.data.owner_id)
        if (!ownerExists) {
          const ownerRes = await supabase
            .from("profiles")
            .select("first_name,last_name")
            .eq("id", newsletterRes.data.owner_id)
            .single()

          if (!ownerRes.error) {
            const ownerName = [ownerRes.data.first_name, ownerRes.data.last_name].filter(Boolean).join(" ")
            rows.unshift({
              id: newsletterRes.data.owner_id,
              name: ownerName || "Owner",
              isOwner: true,
            })
          }
        }
      }

      const withOwnerFlag = rows.map((member) => ({
        ...member,
        isOwner: member.isOwner || member.id === newsletterRes.data.owner_id,
      }))
      setMembers(withOwnerFlag)
      setIsLoading(false)
    }

    if (newsletterId) {
      load()
    }
  }, [newsletterId, router])

  const handleToggleQuestion = async (question: NewsletterQuestion) => {
    if (!newsletter || newsletter.owner_id !== authUserId) return
    setError("")

    const { error: updateError } = await supabase
      .from("newsletter_questions")
      .update({ is_active: !question.is_active })
      .eq("id", question.id)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setQuestions((prev) =>
      prev.map((item) => (item.id === question.id ? { ...item, is_active: !item.is_active } : item))
    )
  }

  const handleCreateQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newsletter || newsletter.owner_id !== authUserId) return
    if (!newQuestionLabel.trim()) return
    setIsSavingQuestion(true)
    setError("")

    const nextSortOrder = questions.length ? Math.max(...questions.map((q) => q.sort_order)) + 1 : 1

    const { data, error: insertError } = await supabase
      .from("newsletter_questions")
      .insert({
        newsletter_id: newsletter.id,
        label: newQuestionLabel.trim(),
        placeholder: newQuestionPlaceholder.trim() || null,
        is_active: true,
        is_base: false,
        sort_order: nextSortOrder,
      })
      .select("id,label,placeholder,is_active,is_base,sort_order")
      .single()

    if (insertError) {
      setError(insertError.message)
      setIsSavingQuestion(false)
      return
    }

    setQuestions((prev) => [...prev, data])
    setNewQuestionLabel("")
    setNewQuestionPlaceholder("")
    setIsSavingQuestion(false)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!newsletter || newsletter.owner_id !== authUserId) return
    if (memberId === newsletter.owner_id) return
    setError("")
    setIsRemovingMemberId(memberId)

    const { error: deleteError } = await supabase
      .from("newsletter_memberships")
      .delete()
      .eq("newsletter_id", newsletter.id)
      .eq("user_id", memberId)

    if (deleteError) {
      setError(deleteError.message)
      setIsRemovingMemberId(null)
      return
    }

    setMembers((prev) => prev.filter((member) => member.id !== memberId))
    setIsRemovingMemberId(null)
  }

  const handleDeleteQuestion = async (question: NewsletterQuestion) => {
    if (!newsletter || newsletter.owner_id !== authUserId) return
    setError("")

    const { error: deleteError } = await supabase.from("newsletter_questions").delete().eq("id", question.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setQuestions((prev) => prev.filter((item) => item.id !== question.id))
  }

  const handleCutoffSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newsletter || newsletter.owner_id !== authUserId) return
    setIsSavingCutoff(true)
    setError("")

    const { error: updateError } = await supabase
      .from("newsletters")
      .update({
        cutoff_day: cutoffDay,
        cutoff_time: "00:00:00",
        cutoff_tz: DEFAULT_CUTOFF_TZ,
        current_week_start: null,
      })
      .eq("id", newsletter.id)

    if (updateError) {
      setError(updateError.message)
      setIsSavingCutoff(false)
      return
    }

    setNewsletter((prev) => (prev ? { ...prev, cutoff_day: cutoffDay, current_week_start: null } : prev))
    const newWeekStart = computeWeekStartValue(cutoffDay)
    setWeekStartValue(newWeekStart)
    setHasSubmission(false)
    setIsSavingCutoff(false)
  }

  const handleSendNow = async () => {
    if (!newsletter || newsletter.owner_id !== authUserId) return
    setIsSending(true)
    setError("")
    setSendSuccess("")

    const { data: sessionData } = await supabase.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) {
      setError("Missing session token.")
      setIsSending(false)
      return
    }

    const response = await fetch(`/api/newsletters/${newsletter.id}/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data?.error || "Failed to send.")
      setIsSending(false)
      return
    }

    setSendSuccess("Newsletter sent.")
    setIsSending(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center text-sm text-gray-600">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading newsletter...
        </div>
      </div>
    )
  }

  if (!newsletter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Newsletter not found.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{newsletter.title}</h1>
              {newsletter.description && <p className="text-sm text-gray-600">{newsletter.description}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Weekly Update</CardTitle>
                <CardDescription>Submit your update for this week.</CardDescription>
              </CardHeader>
              <CardContent>
                {weekStartValue && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                    <CheckCircle2 className={hasSubmission ? "h-4 w-4 text-green-600" : "h-4 w-4 text-gray-300"} />
                    <span>
                      {hasSubmission
                        ? `Saved for week of ${weekStartValue}.`
                        : `No update saved yet for week of ${weekStartValue}.`}
                    </span>
                  </div>
                )}
                <Button asChild>
                  <Link href={`/dashboard/newsletters/${newsletter.id}/edit`}>
                    <PenTool className="mr-2 h-4 w-4" />
                    Edit This Week
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Past Newsletters</CardTitle>
                <CardDescription>View previously sent issues.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={`/dashboard/newsletters/${newsletter.id}/issues`}>
                    <FileText className="mr-2 h-4 w-4" />
                    View Past Issues
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {newsletter.owner_id === authUserId && (
              <Card>
                <CardHeader>
                  <CardTitle>Send Newsletter</CardTitle>
                  <CardDescription>Send the current week’s issue to all members.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button onClick={handleSendNow} disabled={isSending}>
                    {isSending ? "Sending..." : "Send Now"}
                  </Button>
                  {sendSuccess && <p className="text-sm text-green-600">{sendSuccess}</p>}
                </CardContent>
              </Card>
            )}

            {newsletter.owner_id === authUserId && (
              <Card>
                <CardHeader>
                  <CardTitle>Questions</CardTitle>
                  <CardDescription>Enable/disable base questions and add custom ones.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {questions.length === 0 ? (
                    <div className="text-sm text-gray-500">No questions configured.</div>
                  ) : (
                    <div className="space-y-3">
                      {questions.map((question) => (
                        <div key={question.id} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{question.label}</p>
                            {question.placeholder && (
                              <p className="text-xs text-gray-500">{question.placeholder}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant={question.is_active ? "default" : "outline"}
                              size="sm"
                              onClick={() => handleToggleQuestion(question)}
                            >
                              {question.is_active ? "On" : "Off"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question)}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleCreateQuestion} className="space-y-3 border-t pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customQuestion">Custom Question</Label>
                      <input
                        id="customQuestion"
                        value={newQuestionLabel}
                        onChange={(event) => setNewQuestionLabel(event.target.value)}
                        placeholder="Add a custom question"
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customPlaceholder">Placeholder (optional)</Label>
                      <input
                        id="customPlaceholder"
                        value={newQuestionPlaceholder}
                        onChange={(event) => setNewQuestionPlaceholder(event.target.value)}
                        placeholder="Prompt text for the question"
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                    <Button type="submit" disabled={isSavingQuestion}>
                      {isSavingQuestion ? "Saving..." : "Add Question"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {newsletter.owner_id === authUserId && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Clock className="mr-2 h-5 w-5" />
                    Cutoff Settings
                  </CardTitle>
                <CardDescription>Cutoff is midnight Pacific time.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleCutoffSave} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cutoffDay">Cutoff Day</Label>
                      <select
                        id="cutoffDay"
                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                        value={cutoffDay}
                        onChange={(event) => setCutoffDay(Number(event.target.value))}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                    <Button type="submit" disabled={isSavingCutoff}>
                      {isSavingCutoff ? "Saving..." : "Save Cutoff"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Members
                </CardTitle>
                <CardDescription>Everyone in this newsletter.</CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-3 text-sm text-gray-700 max-h-64 overflow-y-auto pr-2">
                  {members.length === 0 ? (
                    <div className="text-sm text-gray-500">No members yet.</div>
                  ) : (
                    members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between">
                        <span>{member.name}</span>
                        <div className="flex items-center gap-2">
                          {member.isOwner && <span className="text-xs text-gray-500">Owner</span>}
                          {newsletter.owner_id === authUserId && !member.isOwner && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.id)}
                              disabled={isRemovingMemberId === member.id}
                            >
                              {isRemovingMemberId === member.id ? "Removing..." : "Remove"}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
