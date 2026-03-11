"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Loader2, Upload, X } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type Newsletter = {
  id: string
  title: string
  description: string | null
  cutoff_day: number
  cutoff_time: string
  cutoff_tz: string
}

type Submission = {
  id: string
  week_start: string
  ai_summary: string | null
}

type NewsletterQuestion = {
  id: string
  label: string
  placeholder: string | null
  is_active: boolean
  sort_order: number
}

type SubmissionPhoto = {
  id: string
  path: string
  created_at: string
  url: string
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

const formatDateTime = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date)

const parseCutoffTime = (timeValue: string) => {
  const [hourRaw, minuteRaw = "0", secondRaw = "0"] = timeValue.split(":")
  return {
    hour: Number.parseInt(hourRaw, 10) || 0,
    minute: Number.parseInt(minuteRaw, 10) || 0,
    second: Number.parseInt(secondRaw, 10) || 0,
  }
}

const computeCutoffWindow = (newsletter: Newsletter) => {
  const now = new Date()
  const { year, month, day, hour, minute, second, weekday } = getZonedParts(now, newsletter.cutoff_tz)
  const cutoffTime = parseCutoffTime(newsletter.cutoff_time)
  const daysSinceCutoff = (weekday - newsletter.cutoff_day + 7) % 7
  let cutoffDate = new Date(Date.UTC(year, month - 1, day, cutoffTime.hour, cutoffTime.minute, cutoffTime.second))
  cutoffDate = makeZonedDate(
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
    weekStart,
    weekStartValue: formatDateYmd(weekStart, newsletter.cutoff_tz),
    editDeadline,
    canEdit: now < editDeadline,
  }
}

export default function NewsletterEditPage() {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [submission, setSubmission] = useState<Submission | null>(null)
  const [questions, setQuestions] = useState<NewsletterQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [aiSummary, setAiSummary] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [authorName, setAuthorName] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [photos, setPhotos] = useState<SubmissionPhoto[]>([])

  const [weekStartValue, setWeekStartValue] = useState("")
  const [editDeadline, setEditDeadline] = useState<Date | null>(null)
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      setError("")

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        router.push("/auth/login")
        return
      }

      const profileRes = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", authData.user.id)
        .single()

      if (!profileRes.error) {
        setAuthorName(profileRes.data?.first_name ?? "")
      }

      const newsletterRes = await supabase
        .from("newsletters")
        .select("id,title,description,cutoff_day,cutoff_time,cutoff_tz")
        .eq("id", newsletterId)
        .single()

      if (newsletterRes.error) {
        setError(newsletterRes.error.message)
        setIsLoading(false)
        return
      }

      setNewsletter(newsletterRes.data)
      const cutoffWindow = computeCutoffWindow(newsletterRes.data)
      setWeekStartValue(cutoffWindow.weekStartValue)
      setEditDeadline(cutoffWindow.editDeadline)
      setCanEdit(cutoffWindow.canEdit)

      const questionRes = await supabase
        .from("newsletter_questions")
        .select("id,label,placeholder,is_active,sort_order")
        .eq("newsletter_id", newsletterId)
        .order("sort_order", { ascending: true })

      if (questionRes.error) {
        setError(questionRes.error.message)
        setIsLoading(false)
        return
      }

      setQuestions(questionRes.data ?? [])

      const submissionRes = await supabase
        .from("submissions")
        .select("id,week_start,ai_summary")
        .eq("newsletter_id", newsletterId)
        .eq("user_id", authData.user.id)
        .eq("week_start", cutoffWindow.weekStartValue)
        .maybeSingle()

      if (submissionRes.error) {
        setError(submissionRes.error.message)
        setIsLoading(false)
        return
      }

      if (submissionRes.data) {
        setSubmission(submissionRes.data)
        setAiSummary(submissionRes.data.ai_summary ?? "")

        const answerRes = await supabase
          .from("submission_answers")
          .select("question_id,answer")
          .eq("submission_id", submissionRes.data.id)

        if (answerRes.error) {
          setError(answerRes.error.message)
          setIsLoading(false)
          return
        }

        const nextAnswers: Record<string, string> = {}
        answerRes.data?.forEach((row) => {
          nextAnswers[row.question_id] = row.answer ?? ""
        })
        setAnswers(nextAnswers)

        const photoRes = await supabase
          .from("submission_photos")
          .select("id,path,created_at")
          .eq("submission_id", submissionRes.data.id)
          .order("created_at", { ascending: true })

        if (photoRes.error) {
          setError(photoRes.error.message)
          setIsLoading(false)
          return
        }

        const photoList =
          photoRes.data?.map((photo) => ({
            ...photo,
            url: supabase.storage.from("submission-photos").getPublicUrl(photo.path).data.publicUrl,
          })) ?? []
        setPhotos(photoList)
      } else {
        setAnswers({})
        setPhotos([])
        setAiSummary("")
      }

      setIsLoading(false)
    }

    if (newsletterId) {
      load()
    }
  }, [newsletterId, router])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit || !weekStartValue) return
    setIsSaving(true)
    setError("")
    setSuccessMessage("")

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      router.push("/auth/login")
      return
    }

    const { data: savedSubmission, error: upsertError } = await supabase
      .from("submissions")
      .upsert(
        {
          id: submission?.id,
          newsletter_id: newsletterId,
          user_id: authData.user.id,
          week_start: weekStartValue,
          ai_summary: aiSummary.trim() || null,
          status: "submitted",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "newsletter_id,user_id,week_start" }
      )
      .select("id")
      .single()

    if (upsertError || !savedSubmission) {
      setError(upsertError?.message || "Failed to save submission.")
      setIsSaving(false)
      return
    }

    if (questions.length > 0) {
      const answerPayload = questions.map((question) => ({
        submission_id: savedSubmission.id,
        question_id: question.id,
        user_id: authData.user.id,
        answer: answers[question.id]?.trim() || null,
        updated_at: new Date().toISOString(),
      }))

      const { error: answerError } = await supabase
        .from("submission_answers")
        .upsert(answerPayload, { onConflict: "submission_id,question_id" })

      if (answerError) {
        setError(answerError.message)
        setIsSaving(false)
        return
      }
    }

    let newPhotos: SubmissionPhoto[] = []

    if (uploadedFiles.length > 0) {
      const uploadedPaths: string[] = []
      for (const file of uploadedFiles) {
        const fileExt = file.name.split(".").pop() || "jpg"
        const fileId =
          typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
        const filePath = `${authData.user.id}/${savedSubmission.id}/${fileId}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from("submission-photos")
          .upload(filePath, file)

        if (uploadError) {
          setError(uploadError.message)
          setIsSaving(false)
          return
        }

        uploadedPaths.push(filePath)
      }

      const { data: photoRows, error: photoError } = await supabase
        .from("submission_photos")
        .insert(
          uploadedPaths.map((path) => ({
            submission_id: savedSubmission.id,
            user_id: authData.user.id,
            path,
          }))
        )
        .select("id,path,created_at")

      if (photoError) {
        setError(photoError.message)
        setIsSaving(false)
        return
      }

      newPhotos =
        photoRows?.map((photo) => ({
          ...photo,
          url: supabase.storage.from("submission-photos").getPublicUrl(photo.path).data.publicUrl,
        })) ?? []
    }

    if (newPhotos.length > 0) {
      setPhotos((prev) => [...prev, ...newPhotos])
      setUploadedFiles([])
    }

    setSubmission((prev) =>
      prev
        ? { ...prev, id: savedSubmission.id, ai_summary: aiSummary.trim() || null }
        : { id: savedSubmission.id, week_start: weekStartValue, ai_summary: aiSummary.trim() || null }
    )
    setIsSaving(false)
    setSuccessMessage("Update saved. Returning to the newsletter dashboard...")
    setTimeout(() => {
      router.push(`/dashboard/newsletters/${newsletterId}`)
    }, 800)
  }

  const handleDeletePhoto = async (photo: SubmissionPhoto) => {
    if (!canEdit) return
    setError("")

    const { error: storageError } = await supabase.storage.from("submission-photos").remove([photo.path])
    if (storageError) {
      setError(storageError.message)
      return
    }

    const { error: deleteError } = await supabase.from("submission_photos").delete().eq("id", photo.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setPhotos((prev) => prev.filter((item) => item.id !== photo.id))
  }

  const handleGenerateSummary = async () => {
    if (!canEdit) return
    setIsGenerating(true)
    setError("")

    const payload = questions
      .filter((question) => question.is_active)
      .map((question) => ({
        label: question.label,
        answer: answers[question.id] ?? "",
      }))
      .filter((entry) => entry.answer.trim().length > 0)

    if (payload.length === 0) {
      setError("Add at least one answer before generating a summary.")
      setIsGenerating(false)
      return
    }

    const response = await fetch("/api/ai/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: payload, name: authorName }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data?.error || "Failed to generate summary.")
      setIsGenerating(false)
      return
    }

    setAiSummary(data.summary)
    setIsGenerating(false)
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
              <Link href={`/dashboard/newsletters/${newsletter.id}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Newsletter
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
        <Card>
          <CardHeader>
            <CardTitle>This Week&apos;s Update</CardTitle>
            <CardDescription>
              {weekStartValue && editDeadline
                ? `Week of ${weekStartValue}. You can edit until ${formatDateTime(
                    editDeadline,
                    newsletter.cutoff_tz
                  )}.`
                : "Loading deadline..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                {questions.length === 0 ? (
                  <div className="text-sm text-gray-500">No questions configured yet.</div>
                ) : (
                  questions
                    .filter((question) => question.is_active)
                    .map((question) => (
                      <div key={question.id} className="space-y-2">
                        <Label htmlFor={`question-${question.id}`}>{question.label}</Label>
                        <Textarea
                          id={`question-${question.id}`}
                          value={answers[question.id] ?? ""}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: event.target.value,
                            }))
                          }
                          placeholder={question.placeholder ?? ""}
                          className="min-h-[100px]"
                          disabled={!canEdit}
                        />
                      </div>
                    ))
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aiSummary">AI Summary</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateSummary}
                      disabled={isGenerating || !canEdit}
                    >
                      {isGenerating ? "Generating..." : aiSummary ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                  <Textarea
                    id="aiSummary"
                    value={aiSummary}
                    onChange={(event) => setAiSummary(event.target.value)}
                    placeholder="Generate a summary from your answers."
                    className="min-h-[160px]"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-gray-500">
                    You can edit the summary or regenerate it after updating your answers.
                  </p>
                </div>

                <div className="space-y-4">
                  <Label>Photos</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 mb-2">Upload photos to include with your update.</p>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(event) => {
                        const files = Array.from(event.target.files || [])
                        setUploadedFiles((prev) => [...prev, ...files])
                      }}
                      disabled={!canEdit}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-gray-200"
                    />
                  </div>
                  {photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {photos.map((photo) => (
                        <div key={photo.id} className="overflow-hidden rounded-lg border border-gray-200">
                          <div className="relative">
                            <img src={photo.url} alt="Uploaded" className="h-32 w-full object-cover" />
                            {canEdit && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="icon"
                                className="absolute right-2 top-2 h-8 w-8"
                                onClick={() => handleDeletePhoto(photo)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setUploadedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index))
                            }
                            disabled={!canEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500">Photos upload when you save your update.</p>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {successMessage && (
                  <Alert>
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={isSaving || !canEdit} className="w-full">
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {canEdit ? "Save Weekly Update" : "Edit Window Closed"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
