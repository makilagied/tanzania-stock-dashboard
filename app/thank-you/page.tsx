import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2, Heart } from "lucide-react"
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
    <main className="relative mx-auto flex min-h-[78vh] w-full max-w-4xl items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="thank-you-blob thank-you-blob-1" />
        <div className="thank-you-blob thank-you-blob-2" />
        <div className="thank-you-blob thank-you-blob-3" />
      </div>

      <section className="thank-you-card relative w-full max-w-2xl rounded-3xl border border-border/60 bg-card/95 p-6 shadow-2xl backdrop-blur-sm sm:p-8">
        <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-chart-3/10 text-chart-3 ring-1 ring-chart-3/30">
          <CheckCircle2 className="h-8 w-8" aria-hidden />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">Thank you for your support!</h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Your payment was received successfully. We truly appreciate your support for{" "}
          <span className="font-medium text-foreground">Uwekezaji Online</span>.
        </p>

        <div className="mt-6 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground shadow-sm">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Heart className="h-4 w-4 text-primary" aria-hidden />
            What happens next?
          </p>
          <p className="mt-2">You can continue using the dashboard as usual. If you need help, contact us anytime.</p>
        </div>

        <div className="mt-7 flex flex-wrap gap-2">
          <Button asChild className="transition-transform duration-200 hover:-translate-y-0.5">
            <Link href="/">Go to Stocks Dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="transition-transform duration-200 hover:-translate-y-0.5">
            <Link href="/funds">Go to Funds Dashboard</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
