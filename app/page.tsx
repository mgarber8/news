import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Community Newsletter
            </div>
            <h1 className="text-4xl font-semibold text-gray-900 sm:text-5xl">You&apos;ve Got Mail</h1>
            <p className="text-lg text-gray-600">The newsletter for your friends, by your friends.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth/signup">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>

          <div className="relative flex justify-center">
            <div className="mail-float relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl">
              <div className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-sm font-bold text-white shadow-lg">
                1
              </div>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100" />
              </div>
              <div className="mt-6 rounded-2xl border border-dashed border-amber-200 bg-amber-50 p-6">
                <svg
                  viewBox="0 0 200 140"
                  className="mx-auto h-36 w-full max-w-xs text-amber-600"
                  aria-hidden="true"
                >
                  <rect x="10" y="20" width="180" height="110" rx="16" fill="currentColor" opacity="0.12" />
                  <rect x="18" y="28" width="164" height="94" rx="12" fill="currentColor" opacity="0.18" />
                  <path
                    d="M24 36h152v78H24z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M24 36l76 48 76-48"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="150" cy="50" r="8" fill="currentColor" opacity="0.4" />
                </svg>
              </div>
            </div>
            <div className="absolute -z-10 h-64 w-64 rounded-full bg-amber-100 blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
