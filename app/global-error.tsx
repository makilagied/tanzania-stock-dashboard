"use client"

import { useEffect } from "react"
import "./globals.css"

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-md">
            <h1 className="text-xl font-semibold tracking-tight">Investors Dashboard</h1>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Critical error
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              The app hit a serious error and couldn&apos;t render. Please refresh the page or try again in a moment.
            </p>
            {process.env.NODE_ENV === "development" && error.message ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-[11px] text-muted-foreground">
                {error.message}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              className="mt-8 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
