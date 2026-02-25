"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

const getHashParams = () => {
  if (typeof window === "undefined") return {}
  const hash = window.location.hash.replace(/^#/, "")
  const params = new URLSearchParams(hash)
  return {
    access_token: params.get("access_token") ?? "",
    refresh_token: params.get("refresh_token") ?? "",
  }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const initSession = async () => {
      const { access_token, refresh_token } = getHashParams()
      if (!access_token || !refresh_token) {
        setReady(true)
        return
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      })

      if (sessionError) {
        setError(sessionError.message)
      }

      setReady(true)
    }

    initSession()
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    if (password.length < 6) {
      setError("Password must be at least 6 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setIsLoading(false)
      return
    }

    await supabase.auth.signOut()
    setIsLoading(false)
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Create a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="flex items-center text-sm text-gray-600">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading reset link...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          )}

          <div className="mt-4 text-center text-sm">
            <Link href="/auth/login" className="text-blue-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
