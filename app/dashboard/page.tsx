"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Plus, Upload, Users, X } from "lucide-react"
import { supabase } from "@/lib/supabase/client"

type Newsletter = {
  id: string
  title: string
  description: string | null
  created_at: string
  owner_id: string | null
  join_code?: string | null
}

type Profile = {
  first_name: string | null
  last_name: string | null
  avatar_path: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [userName, setUserName] = useState("")
  const [userId, setUserId] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [profile, setProfile] = useState<Profile | null>(null)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [profileError, setProfileError] = useState("")
  const [profileSuccess, setProfileSuccess] = useState("")
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [newsletters, setNewsletters] = useState<Newsletter[]>([])
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [joinCode, setJoinCode] = useState("")
  const [joinError, setJoinError] = useState("")
  const [isJoining, setIsJoining] = useState(false)

  const isCreateDisabled = useMemo(() => createTitle.trim().length === 0, [createTitle])

  const load = useCallback(async () => {
    setIsLoading(true)
    setError("")

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      router.push("/auth/login")
      return
    }

    setUserId(authData.user.id)
    setUserEmail(authData.user.email ?? "")
    setNewEmail(authData.user.email ?? "")

    const profileRes = await supabase
      .from("profiles")
      .select("first_name,last_name,avatar_path")
      .eq("id", authData.user.id)
      .single()

    if (profileRes.data) {
      const { first_name, last_name } = profileRes.data
      setProfile(profileRes.data)
      setUserName([first_name, last_name].filter(Boolean).join(" "))
      if (profileRes.data.avatar_path) {
        const { data: avatarData } = supabase.storage
          .from("profile-photos")
          .getPublicUrl(profileRes.data.avatar_path)
        setAvatarUrl(avatarData.publicUrl)
      } else {
        setAvatarUrl("")
      }
    }

    const ownedRes = await supabase
      .from("newsletters")
      .select("id,title,description,created_at,owner_id,join_code")
      .eq("owner_id", authData.user.id)

    const memberRes = await supabase
      .from("newsletter_memberships")
      .select("newsletter:newsletters(id,title,description,created_at,owner_id,join_code)")
      .eq("user_id", authData.user.id)

    if (ownedRes.error || memberRes.error) {
      setError(ownedRes.error?.message || memberRes.error?.message || "Failed to load newsletters.")
      setIsLoading(false)
      return
    }

    const memberNewsletters = memberRes.data?.map((row) => row.newsletter).filter(Boolean) ?? []
    const merged = [...(ownedRes.data ?? []), ...memberNewsletters]
    const unique = new Map(merged.map((item) => [item.id, item]))
    setNewsletters(Array.from(unique.values()))
    setIsLoading(false)
  }, [router])

  useEffect(() => {
    load()
  }, [load])

  const handleCreateNewsletter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isCreateDisabled) return
    setIsCreating(true)
    setError("")

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      router.push("/auth/login")
      return
    }

    const { error: insertError } = await supabase.from("newsletters").insert({
      title: createTitle.trim(),
      description: createDescription.trim() || null,
      owner_id: authData.user.id,
    })

    if (insertError) {
      setError(insertError.message)
      setIsCreating(false)
      return
    }

    setCreateTitle("")
    setCreateDescription("")
    setIsCreating(false)
    await load()
  }

  const handleJoinNewsletter = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsJoining(true)
    setJoinError("")

    const code = joinCode.trim().toLowerCase()
    if (!code) {
      setJoinError("Enter a join code.")
      setIsJoining(false)
      return
    }

    const { error: joinError } = await supabase.rpc("join_newsletter_by_code", { code })
    if (joinError) {
      setJoinError(joinError.message)
      setIsJoining(false)
      return
    }

    setJoinCode("")
    setIsJoining(false)
    await load()
  }

  const handleEmailUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newEmail.trim() || newEmail.trim() === userEmail) return
    setProfileError("")
    setProfileSuccess("")
    setIsSavingEmail(true)

    const { error: emailError } = await supabase.auth.updateUser({ email: newEmail.trim() })
    if (emailError) {
      setProfileError(emailError.message)
      setIsSavingEmail(false)
      return
    }

    setProfileSuccess("Check your email to confirm the change.")
    setIsSavingEmail(false)
  }

  const handleAvatarUpload = async (file: File) => {
    if (!userId) return
    setProfileError("")
    setProfileSuccess("")
    setIsUploadingAvatar(true)

    const fileExt = file.name.split(".").pop() || "jpg"
    const fileId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
    const filePath = `${userId}/avatar-${fileId}.${fileExt}`

    const { error: uploadError } = await supabase.storage.from("profile-photos").upload(filePath, file)
    if (uploadError) {
      setProfileError(uploadError.message)
      setIsUploadingAvatar(false)
      return
    }

    if (profile?.avatar_path) {
      await supabase.storage.from("profile-photos").remove([profile.avatar_path])
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: filePath })
      .eq("id", userId)

    if (updateError) {
      setProfileError(updateError.message)
      setIsUploadingAvatar(false)
      return
    }

    const { data: avatarData } = supabase.storage.from("profile-photos").getPublicUrl(filePath)
    setAvatarUrl(avatarData.publicUrl)
    setProfile((prev) => (prev ? { ...prev, avatar_path: filePath } : prev))
    setProfileSuccess("Profile photo updated.")
    setIsUploadingAvatar(false)
  }

  const handleAvatarRemove = async () => {
    if (!userId || !profile?.avatar_path) return
    setProfileError("")
    setProfileSuccess("")
    setIsUploadingAvatar(true)

    const { error: removeError } = await supabase.storage
      .from("profile-photos")
      .remove([profile.avatar_path])

    if (removeError) {
      setProfileError(removeError.message)
      setIsUploadingAvatar(false)
      return
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: null })
      .eq("id", userId)

    if (updateError) {
      setProfileError(updateError.message)
      setIsUploadingAvatar(false)
      return
    }

    setAvatarUrl("")
    setProfile((prev) => (prev ? { ...prev, avatar_path: null } : prev))
    setProfileSuccess("Profile photo removed.")
    setIsUploadingAvatar(false)
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {userName ? `Welcome back, ${userName.split(" ")[0]}!` : "Welcome back!"}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>Update your photo and email.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full bg-gray-100 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Upload className="h-4 w-4" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploadingAvatar}
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          if (file) {
                            handleAvatarUpload(file)
                            event.currentTarget.value = ""
                          }
                        }}
                      />
                    </label>
                    {profile?.avatar_path && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isUploadingAvatar}
                        onClick={handleAvatarRemove}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleEmailUpdate} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newEmail}
                      onChange={(event) => setNewEmail(event.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isSavingEmail || newEmail.trim() === userEmail}>
                    {isSavingEmail ? "Saving..." : "Update Email"}
                  </Button>
                </form>

                {profileError && (
                  <Alert variant="destructive">
                    <AlertDescription>{profileError}</AlertDescription>
                  </Alert>
                )}
                {profileSuccess && (
                  <Alert>
                    <AlertDescription>{profileSuccess}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Create Newsletter
                </CardTitle>
                <CardDescription>Start a new newsletter for your group.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateNewsletter} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newsletterTitle">Title</Label>
                    <Input
                      id="newsletterTitle"
                      value={createTitle}
                      onChange={(event) => setCreateTitle(event.target.value)}
                      placeholder="Friends + Family Weekly"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newsletterDescription">Description (optional)</Label>
                    <Input
                      id="newsletterDescription"
                      value={createDescription}
                      onChange={(event) => setCreateDescription(event.target.value)}
                      placeholder="A quick update for our group"
                    />
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" disabled={isCreating || isCreateDisabled}>
                    {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Newsletter
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Join a Newsletter</CardTitle>
                <CardDescription>Ask the owner for a join code.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinNewsletter} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="joinCode">Join Code</Label>
                    <Input
                      id="joinCode"
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      placeholder="abcd1234"
                    />
                  </div>
                  {joinError && (
                    <Alert variant="destructive">
                      <AlertDescription>{joinError}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" disabled={isJoining}>
                    {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Join Newsletter
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Your Newsletters
                </CardTitle>
                <CardDescription>Pick a newsletter to add updates.</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading newsletters...
                  </div>
                ) : newsletters.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No newsletters yet. Create one above or ask to be invited.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newsletters.map((newsletter) => (
                      <Card key={newsletter.id}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{newsletter.title}</p>
                              {newsletter.description && (
                                <p className="text-sm text-gray-500">{newsletter.description}</p>
                              )}
                              {newsletter.owner_id === userId && newsletter.join_code && (
                                <p className="text-xs text-gray-400">Join code: {newsletter.join_code}</p>
                              )}
                            </div>
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/dashboard/newsletters/${newsletter.id}`}>
                                <Mail className="mr-2 h-4 w-4" />
                                Open
                              </Link>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6" />
        </div>
      </div>
    </div>
  )
}
