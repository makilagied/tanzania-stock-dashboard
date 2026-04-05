import Image from "next/image"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-border/60 bg-background">
          <Image
            src="/icon-uwekezaji.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
            priority
          />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Loading...</p>
          <p className="text-sm text-muted-foreground">Please wait while we load the content.</p>
        </div>
      </div>
    </div>
  )
}
