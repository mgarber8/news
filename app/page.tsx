import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, Mail, PenTool, Calendar } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Stay Connected with Your Community</h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Share your life updates, work achievements, and memorable moments. Get compiled newsletters to stay in touch
            with everyone in your network.
          </p>
          <div className="space-x-4">
            <Button asChild size="lg">
              <Link href="/auth/signup">Get Started</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/auth/login">Sign In</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader className="text-center">
              <PenTool className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Share Updates</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Share work achievements, personal milestones, funny stories, and more through our easy-to-use form.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Users className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Connect with Others</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Stay connected with your community and learn about what everyone is up to.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Calendar className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <CardTitle>Regular Newsletters</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Receive compiled newsletters with everyone's updates delivered right to your inbox.
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <Mail className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <CardTitle>Easy Sharing</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>Upload photos, videos, and share your stories with rich media support.</CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ready to get started?</h2>
          <p className="text-gray-600 mb-6">Join your community newsletter system today and never miss an update.</p>
          <Button asChild size="lg">
            <Link href="/auth/signup">Create Your Account</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
