"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html>
      <body className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
            <img
              src="/icon-uwekezaji.png"
              alt=""
              width={48}
              height={48}
              className="mx-auto h-12 w-12 object-contain"
            />
            <h2 className="mt-3 text-lg font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Try again.
            </p>
            <Button className="mt-4" onClick={() => reset()}>
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
