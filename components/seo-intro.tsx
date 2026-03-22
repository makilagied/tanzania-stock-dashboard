/** Swahili + English copy for crawlers only — visually hidden (`sr-only`), not shown in the layout. */
export function SeoIntroStocks() {
  return (
    <section aria-labelledby="seo-intro-stocks-heading" className="sr-only">
      <h2 id="seo-intro-stocks-heading">Soko la hisa Tanzania (DSE)</h2>
      <p>
        Uwekezaji Online inaonyesha bei za moja kwa moja za soko la hisa la Dar es Salaam (DSE), faharasa ya soko,
        hisa zilizopanda na kushuka, chati na maelezo ya undani wa soko — kwa ajili ya kufuatilia uwekezaji wako.{" "}
        <span lang="en">
          Live DSE prices, indices, top movers, charts, and market depth. Informational only — confirm trades and figures
          with licensed brokers and official DSE sources.
        </span>
      </p>
    </section>
  )
}

export function SeoIntroFunds() {
  return (
    <section aria-labelledby="seo-intro-funds-heading" className="sr-only">
      <h2 id="seo-intro-funds-heading">Mifuko ya uwekezaji — UTT, iTrust, Inuka, Faida na zaidi</h2>
      <p>
        Hapa unafuatilia mifuko ya uwekezaji nchini Tanzania: UTT, iTrust, Inuka, Faida, Vertex na ZAN — ikiwemo mifuko
        ya aina ya indeksi (index) na ETF — kwa historia ya NAV, chati na mapato ya kipindi.{" "}
        <span lang="en">
          Compare mutual funds and ETFs; explore NAV history and performance charts for research. Not financial advice —
          read fund factsheets and consult a professional before investing.
        </span>
      </p>
    </section>
  )
}
