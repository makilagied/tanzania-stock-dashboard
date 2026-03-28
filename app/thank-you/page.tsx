import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Heart, Home, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Thank you for your support · Uwekezaji Online",
  description:
    "Payment received. Thank you for supporting Uwekezaji Online. Continue exploring Tanzania stocks and funds.",
  alternates: { canonical: "/thank-you" },
  robots: { index: false, follow: true },
}

export default function ThankYouPage() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-32 -top-32 h-96 w-96 animate-pulse rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-32 top-1/4 h-80 w-80 animate-pulse rounded-full bg-chart-3/10 blur-3xl" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 animate-pulse rounded-full bg-primary/10 blur-3xl" style={{ animationDelay: "2s" }} />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="select-none text-[14rem] font-black leading-none text-foreground/[0.02] sm:text-[22rem]">OK</span>
        </div>

        <section className="relative w-full max-w-2xl">
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-transparent to-primary/20 opacity-75 blur-xl" />
          <div className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-2xl backdrop-blur-xl">
            <div className="flex h-12 items-center gap-3 border-b border-border/50 bg-muted/30 px-5">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-medium text-muted-foreground">Payment confirmed</span>
              </div>
            </div>

            <div className="p-8 text-center sm:p-10">
              <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/25">
                <CheckCircle2 className="h-8 w-8" aria-hidden />
              </div>

              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Thank you for your support!</h1>
              <p className="mt-4 text-muted-foreground">
                Your payment was received successfully. We truly appreciate your support for{" "}
                <span className="font-medium text-foreground">Uwekezaji Online</span>.
              </p>

              <div className="mt-8 rounded-xl border border-border/50 bg-muted/30 p-4 text-left">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Heart className="h-4 w-4 text-primary" aria-hidden />
                  What happens next?
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can continue using the dashboard as usual. If you need help, contact us anytime.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-emerald-700">
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    Go to Stocks Dashboard
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 border-border/60 bg-background/50">
                  <Link href="/funds">
                    Go to Funds Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
