"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, Home, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Something went wrong</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">We couldn&apos;t load this page</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A server or application error occurred. You can try again or return to the dashboard.
        </p>
        {process.env.NODE_ENV === "development" && error.message ? (
          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-[11px] text-muted-foreground">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => reset()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden />
              Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
