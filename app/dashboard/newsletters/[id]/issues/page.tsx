"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileText, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type Issue = {
  id: string
  week_start: string
  subject: string | null
  status: string
  sent_at: string | null
}

type Newsletter = {
  id: string
  title: string
}

export default function NewsletterIssuesPage() {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string

  const [isLoading, setIsLoading] = useState(true)
  const [issues, setIssues] = useState<Issue[]>([])
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        router.push("/auth/login")
        return
      }

      const newsletterRes = await supabase
        .from("newsletters")
        .select("id,title")
        .eq("id", newsletterId)
        .single()

      if (!newsletterRes.error) {
        setNewsletter(newsletterRes.data)
      }

      const issuesRes = await supabase
        .from("issues")
        .select("id,week_start,subject,status,sent_at")
        .eq("newsletter_id", newsletterId)
        .order("week_start", { ascending: false })
        .limit(10)

      if (!issuesRes.error) {
        const data = issuesRes.data ?? []
        setIssues(data)
        setHasMore(data.length === 10)
      }

      setIsLoading(false)
    }

    if (newsletterId) {
      load()
    }
  }, [newsletterId, router])

  const handleLoadMore = async () => {
    if (issues.length === 0) return
    setIsLoadingMore(true)

    const lastWeekStart = issues[issues.length - 1].week_start
    const moreRes = await supabase
      .from("issues")
      .select("id,week_start,subject,status,sent_at")
      .eq("newsletter_id", newsletterId)
      .lt("week_start", lastWeekStart)
      .order("week_start", { ascending: false })
      .limit(10)

    if (!moreRes.error) {
      const data = moreRes.data ?? []
      setIssues((prev) => [...prev, ...data])
      setHasMore(data.length === 10)
    }

    setIsLoadingMore(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/newsletters/${newsletterId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Newsletter
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Past Issues</h1>
              {newsletter && <p className="text-sm text-gray-600">{newsletter.title}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Issues</CardTitle>
            <CardDescription>All compiled newsletters for this group.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center text-sm text-gray-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading issues...
              </div>
            ) : issues.length === 0 ? (
              <div className="text-sm text-gray-500">No issues yet.</div>
            ) : (
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                    <div>
                      <p className="font-medium">{issue.subject || "Weekly Newsletter"}</p>
                      <p className="text-xs text-gray-500">
                        Week of {issue.week_start} • {issue.status}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/newsletters/${newsletterId}/issues/${issue.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
                {hasMore && (
                  <div className="pt-2">
                    <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                      {isLoadingMore ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
