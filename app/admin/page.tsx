import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mail, Users, FileText, Send, Calendar, Eye } from "lucide-react"

export default function AdminPage() {
  const pendingUpdates = [
    {
      id: 1,
      user: "John Doe",
      category: "Work Updates",
      date: "2024-01-15",
      preview: "Got promoted to Senior Developer...",
      hasMedia: true,
    },
    {
      id: 2,
      user: "Jane Smith",
      category: "Personal Updates",
      date: "2024-01-14",
      preview: "Went hiking in the mountains...",
      hasMedia: false,
    },
    {
      id: 3,
      user: "Mike Johnson",
      category: "Golf Updates",
      date: "2024-01-13",
      preview: "Finally broke 80 on the course...",
      hasMedia: true,
    },
    {
      id: 4,
      user: "Sarah Wilson",
      category: "Movie/TV Recs",
      date: "2024-01-12",
      preview: "Just finished watching The Bear - highly recommend...",
      hasMedia: false,
    },
  ]

  const newsletters = [
    {
      id: 1,
      title: "January 2024 Newsletter",
      date: "2024-01-01",
      status: "Draft",
      updates: 12,
    },
    {
      id: 2,
      title: "December 2023 Newsletter",
      date: "2023-12-01",
      status: "Sent",
      updates: 15,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">12</p>
                  <p className="text-sm text-gray-600">Pending Updates</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">24</p>
                  <p className="text-sm text-gray-600">Active Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Mail className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold">3</p>
                  <p className="text-sm text-gray-600">Newsletters Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Calendar className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold">Jan 30</p>
                  <p className="text-sm text-gray-600">Next Send Date</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="updates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="updates">Pending Updates</TabsTrigger>
            <TabsTrigger value="newsletters">Newsletters</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          <TabsContent value="updates" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Pending Updates</h2>
              <Button>
                <Send className="mr-2 h-4 w-4" />
                Compile Newsletter
              </Button>
            </div>

            <div className="space-y-4">
              {pendingUpdates.map((update) => (
                <Card key={update.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div>
                          <p className="font-medium">{update.user}</p>
                          <p className="text-sm text-gray-500">{update.date}</p>
                        </div>
                        <Badge variant="secondary">{update.category}</Badge>
                        {update.hasMedia && <Badge variant="outline">Has Media</Badge>}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button size="sm">Approve</Button>
                      </div>
                    </div>
                    <p className="text-gray-700">{update.preview}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="newsletters" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Newsletter Management</h2>
              <Button>Create New Newsletter</Button>
            </div>

            <div className="space-y-4">
              {newsletters.map((newsletter) => (
                <Card key={newsletter.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{newsletter.title}</h3>
                        <p className="text-sm text-gray-500">
                          {newsletter.date} • {newsletter.updates} updates
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Badge variant={newsletter.status === "Sent" ? "default" : "secondary"}>
                          {newsletter.status}
                        </Badge>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            Preview
                          </Button>
                          {newsletter.status === "Draft" && (
                            <Button size="sm">
                              <Send className="mr-2 h-4 w-4" />
                              Send
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">User Management</h2>
              <Button>Invite Users</Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>User List</CardTitle>
                <CardDescription>Manage community members and their permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">User management interface would go here...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
