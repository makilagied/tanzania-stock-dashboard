# Investors Dashboard

**Uwekezaji Online** — live DSE equities and local mutual fund analytics.

**Live site:** [www.uwekezaji.online](https://www.uwekezaji.online)

Investors Dashboard is a Next.js web app for **Dar es Salaam Stock Exchange (DSE)** equities and **local mutual fund** analytics. It surfaces live quotes, indices, movers, optional order-book depth, price history charts, and fund NAV series in one place—with caching, stale fallbacks when upstream APIs hiccup, and a polished light/dark UI.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

## Features

- **Market overview** — Searchable list of listed stocks with price, change, volume, and compact market-cap style metrics where available.
- **Charts & analytics** — Historical closes (and OHLC when the source provides it), moving averages, and period summaries aligned with Tanzania Shilling (`TZS`) formatting.
- **Indices & movers** — Share indices, top movers, and gainers/losers pulled from DSE-facing endpoints.
- **Order book** — Per-symbol depth when the upstream service returns it.
- **Mutual funds** — Dedicated `/funds` experience for curated funds with NAV history and period analytics (`/funds`).
- **Resilience** — Server routes cache responses and can serve **stale snapshots** when live fetches fail, so the UI stays usable instead of going blank.
- **API guard** — Middleware restricts `/api/*` to same-origin browser traffic (or hosts/origins you allow), with an optional bearer secret for scripts or integrations. See [Environment variables](#environment-variables).

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) · [React](https://react.dev/) 19 · [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4 · [Radix UI](https://www.radix-ui.com/) primitives
- [Recharts](https://recharts.org/) for charts · [Vercel Analytics](https://vercel.com/analytics) (when deployed on Vercel)

## Getting started

**Requirements:** Node.js 20+ recommended.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000). The funds section lives at [http://localhost:3000/funds](http://localhost:3000/funds).

Other scripts:

| Command        | Description        |
| -------------- | ------------------ |
| `pnpm dev`     | Development server |
| `pnpm build`   | Production build   |
| `pnpm start`   | Run production build |
| `pnpm lint`    | ESLint             |

## Environment variables

All variables are optional unless you need the behavior they enable.

| Variable | Purpose |
| -------- | ------- |
| `HISTORICAL_DATA_API_BASE` | Base URL for an alternate historical-prices service. If set, the app tries `GET {base}/historical?symbol=…&days=…` when the primary DSE history path returns no usable series. |
| `ALLOWED_ORIGINS` | Comma-separated origins (no trailing slash) allowed to call `/api/*` when not same-origin (e.g. another front-end domain). |
| `ALLOWED_API_HOSTS` | Comma-separated hostnames allowed in the `Host` header for `/api/*`. Empty = any host. |
| `API_ROUTE_BYPASS_SECRET` | If set, requests with `Authorization: Bearer <secret>` may call `/api/*` without same-origin checks (treat like a password; rotate if leaked). |
| `API_GUARD_STRICT_IN_DEV` | Set to `true` to enforce the API guard during `next dev`. By default, `/api/*` is open in development for easier local work. |

## API routes (overview)

Server routes under `app/api/` proxy and normalize DSE (and fund) data. Examples:

- `GET /api/market/stocks` — Live stock rows (with cache / stale metadata when applicable)
- `GET /api/market/indices` — Indices
- `GET /api/market/movers`, `GET /api/market/top-movers`, `GET /api/market/gainers-losers`
- `GET /api/market/history/[symbol]` — History for a symbol
- `GET /api/market/orders/[companyId]` — Order book payload for a company id
- `GET /api/funds/...` — Fund metadata and NAV series

Responses are shaped for the dashboard; they are **not** a stable public API contract unless you document and version them yourself.

## Data & disclaimers

Figures come from **third-party market and fund sources** (including DSE-related endpoints). They may be delayed, incomplete, or temporarily unavailable. This project is for **informational purposes only**; it is not investment, tax, or legal advice. Always verify data with official channels before making decisions.

## Project layout (high level)

- `app/` — Pages, layouts, and Route Handlers (`app/api/…`)
- `components/` — UI, layout chrome, and shared widgets
- `lib/` — Market and fund data clients, caching, analytics helpers, catalog metadata

## Author & support

Built by **Erick D Makilagi**

- **GitHub:** [makilagied](https://github.com/makilagied)
- **LinkedIn:** [makilagied](https://www.linkedin.com/in/makilagied)
- **Support:** [Buy me a coffee](https://snippe.me/pay/makilagied)

If you find this project helpful, consider supporting the developer.
