"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type Issue = {
  id: string
  subject: string | null
  html: string | null
  week_start: string
}

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const newsletterId = params.id as string
  const issueId = params.issueId as string

  const [issue, setIssue] = useState<Issue | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user) {
        router.push("/auth/login")
        return
      }

      const issueRes = await supabase
        .from("issues")
        .select("id,subject,html,week_start")
        .eq("id", issueId)
        .eq("newsletter_id", newsletterId)
        .single()

      if (!issueRes.error) {
        setIssue(issueRes.data)
      }

      setIsLoading(false)
    }

    if (issueId && newsletterId) {
      load()
    }
  }, [issueId, newsletterId, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/newsletters/${newsletterId}/issues`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Issues
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{issue?.subject || "Newsletter"}</h1>
              {issue?.week_start && <p className="text-sm text-gray-600">Week of {issue.week_start}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Issue Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center text-sm text-gray-600">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading issue...
              </div>
            ) : issue?.html ? (
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: issue.html }} />
            ) : (
              <div className="text-sm text-gray-500">No issue content found.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
