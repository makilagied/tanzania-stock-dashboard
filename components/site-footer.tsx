export function SiteFooter() {
  return (
    <footer className="mt-8 border-t border-border/50 bg-background/50 p-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div className="text-sm text-muted-foreground">Investor&apos;s Dashboard</div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-end">
          <span>
            Built by <span className="font-semibold text-foreground">Erick D Makilagi</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://github.com/makilagied"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            GitHub
          </a>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://www.linkedin.com/in/makilagied"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            LinkedIn
          </a>
          <span className="hidden sm:inline">•</span>
          <a
            href="https://snippe.me/pay/makilagied"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            Buy me a coffee
          </a>
        </div>
      </div>
    </footer>
  )
}
