import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PenTool, Mail, Users, Calendar, Plus } from "lucide-react"

export default function DashboardPage() {
  const recentUpdates = [
    {
      id: 1,
      type: "Work Updates",
      date: "2024-01-15",
      preview: "Got promoted to Senior Developer...",
    },
    {
      id: 2,
      type: "Personal Updates",
      date: "2024-01-10",
      preview: "Went hiking in the mountains...",
    },
    {
      id: 3,
      type: "Golf Updates",
      date: "2024-01-08",
      preview: "Finally broke 80 on the course...",
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome back, John!</span>
              <Button variant="outline" size="sm">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <PenTool className="h-8 w-8 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">Share Update</CardTitle>
                      <CardDescription>Share your latest news and updates</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full">
                    <Link href="/dashboard/new-update">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Update
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <Mail className="h-8 w-8 text-green-600" />
                    <div>
                      <CardTitle className="text-lg">Recent Newsletters</CardTitle>
                      <CardDescription>View past community newsletters</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full bg-transparent">
                    View Newsletters
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Recent Updates</h3>
              <div className="space-y-3">
                {recentUpdates.map((update) => (
                  <Card key={update.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">{update.type}</Badge>
                        <span className="text-sm text-gray-500">{update.date}</span>
                      </div>
                      <p className="text-gray-700">{update.preview}</p>
                      <div className="mt-3 flex space-x-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="mr-2 h-5 w-5" />
                  Community Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Members</span>
                  <span className="font-semibold">24</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Updates This Month</span>
                  <span className="font-semibold">18</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next Newsletter</span>
                  <span className="font-semibold">Jan 30</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Upcoming
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Newsletter Compilation</p>
                      <p className="text-xs text-gray-500">January 28, 2024</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Newsletter Send</p>
                      <p className="text-xs text-gray-500">January 30, 2024</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
