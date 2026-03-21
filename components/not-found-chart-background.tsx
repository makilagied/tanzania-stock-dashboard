/**
 * Decorative animated chart backdrop for the 404 page (no data — visuals only).
 */
export function NotFoundChartBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft mesh blobs */}
      <div className="nf-mesh-a absolute -left-1/4 -top-1/4 h-[70%] w-[70%] rounded-full bg-chart-3/[0.12] blur-[100px] dark:bg-chart-3/[0.08]" />
      <div className="nf-mesh-b absolute -right-1/4 top-1/3 h-[55%] w-[55%] rounded-full bg-primary/[0.08] blur-[90px] dark:bg-primary/[0.12]" />
      <div className="nf-mesh-c absolute bottom-0 left-1/3 h-[40%] w-[50%] rounded-full bg-chart-4/[0.1] blur-[80px] dark:bg-chart-4/[0.06]" />

      {/* Perspective grid */}
      <div
        className="nf-grid-anim absolute inset-0 opacity-[0.4] dark:opacity-[0.25]"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--border) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 70%, transparent 100%)",
        }}
      />

      {/* Spark nodes */}
      <div className="nf-spark-a absolute left-[12%] top-[28%] h-2 w-2 rounded-full bg-chart-3" />
      <div className="nf-spark-b absolute right-[18%] top-[22%] h-1.5 w-1.5 rounded-full bg-chart-4" />
      <div className="nf-spark-c absolute bottom-[38%] left-[22%] h-1 w-1 rounded-full bg-chart-3" />

      {/* Large bottom area + line chart (SVG) */}
      <div className="nf-chart-layer-float absolute -bottom-4 left-0 right-0 h-[min(52vh,420px)] w-full opacity-90 dark:opacity-[0.65]">
        <svg
          className="h-full w-full"
          viewBox="0 0 1200 320"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="nfFillMain" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity="0.35" />
              <stop offset="55%" stopColor="var(--chart-3)" stopOpacity="0.08" />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="nfFillGhost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="nf-area-a"
            d="M0,260 L120,220 L280,248 L420,140 L560,180 L720,95 L880,130 L1040,60 L1200,100 L1200,320 L0,320 Z"
            fill="url(#nfFillGhost)"
          />
          <path
            className="nf-area-b"
            d="M0,280 L100,250 L240,270 L380,200 L520,220 L680,120 L840,160 L1000,80 L1200,110 L1200,320 L0,320 Z"
            fill="url(#nfFillMain)"
          />
          <path
            className="nf-line-ghost"
            d="M0,260 L120,220 L280,248 L420,140 L560,180 L720,95 L880,130 L1040,60 L1200,100"
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.45"
            pathLength="1"
            strokeDasharray="1"
          />
          <path
            className="nf-line-primary"
            d="M0,280 L100,250 L240,270 L380,200 L520,220 L680,120 L840,160 L1000,80 L1200,110"
            fill="none"
            stroke="var(--chart-3)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="1"
            strokeDasharray="1"
          />
        </svg>
      </div>

      {/* Mini floating bar chart (top-right) */}
      <div className="nf-mini-chart-float absolute right-[6%] top-[16%] flex h-24 items-end gap-1.5 rounded-lg border border-border/40 bg-card/30 px-3 py-2 shadow-sm backdrop-blur-sm dark:bg-card/20">
        {[42, 68, 55, 88, 48, 72, 60, 95, 52, 78].map((h, i) => (
          <div
            key={i}
            className="nf-animate-bar w-1.5 rounded-t-sm bg-chart-3/70 dark:bg-chart-3/50"
            style={{
              height: `${h}%`,
              transformOrigin: "bottom center",
              animation: `nfBarRhythm ${2.2 + i * 0.08}s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
            }}
          />
        ))}
      </div>

      {/* Bottom volume-style bars */}
      <div className="absolute bottom-0 left-0 right-0 flex h-24 items-end justify-center gap-px px-4 opacity-50 dark:opacity-35">
        {Array.from({ length: 64 }).map((_, i) => {
          const h = 25 + ((i * 17) % 55)
          return (
            <div
              key={i}
              className="nf-animate-bar max-w-[6px] flex-1 rounded-t-[1px] bg-chart-2/50 dark:bg-chart-2/35"
              style={{
                height: `${h}%`,
                transformOrigin: "bottom center",
                animation: `nfBarRhythm ${1.8 + (i % 5) * 0.15}s ease-in-out infinite`,
                animationDelay: `${(i % 12) * 0.05}s`,
              }}
            />
          )
        })}
      </div>

      {/* Vignette */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background/90 dark:to-background"
        style={{ opacity: 0.85 }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/80 dark:from-background/70 dark:to-background/70" />
    </div>
  )
}
