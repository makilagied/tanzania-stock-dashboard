# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm start` / `pnpm lint` (README uses pnpm; `pnpm-lock.yaml` is the canonical lockfile, a stray `package-lock.json` also exists).
- There is no test suite configured.
- Path alias: `@/*` maps to the repo root (e.g. `@/lib/...`).

## Overview

"Uwekezaji Online" — Next.js 16 (App Router, React 19, Tailwind v4, Radix/shadcn UI in `components/ui`) dashboard for Dar es Salaam Stock Exchange equities and Tanzanian mutual funds. Pages: `/` (market), `/funds`, `/compare`. Formulas for all analytics are documented in [ANALYTICS_FORMULAS.md](ANALYTICS_FORMULAS.md); keep it in sync when changing `lib/stock-analytics.ts` or `lib/fund-analytics.ts`.

## Architecture

**API routes are proxies/normalizers.** `app/api/market/*` and `app/api/funds/*` call into `lib/`; the UI only talks to these routes. Responses are not a stable public contract.

**Stale-fallback caching** ([lib/stale-cache.ts](lib/stale-cache.ts)): `withStaleFallback` always tries a live fetch (optional timeout), stores healthy results in a per-process in-memory map, and on failure returns the last good snapshot (`stale: true`) or `emptyValue` (`outage: true`). `lib/market-data-cached.ts` and `lib/funds-data-cached.ts` wrap the raw fetchers with it; API routes should use the cached wrappers, and UI handles `stale`/`outage` flags (see `components/market-downtime.tsx`).

**Market data** lives in [lib/market-data.ts](lib/market-data.ts) (upstream DSE fetches, history, optional `HISTORICAL_DATA_API_BASE` fallback).

**Funds are multi-provider**, unified behind a catalog:
- Each provider has a `*-fund-meta.ts` (metadata only, client-safe) and, for CSV providers, a `*-fund-csv.ts` (server-only, reads from `public/<provider-dir>/`). iTrust and UTT (`itrust-funds.ts`, `utt-funds.ts`) fetch remotely.
- [lib/funds-catalog.ts](lib/funds-catalog.ts) builds `ALL_FUNDS` (discriminated union on `provider`: itrust, utt, faida, inuka, vertex, zan).
- [lib/load-fund-records.ts](lib/load-fund-records.ts) dispatches on `meta.provider` and normalizes everything to `ITrustFundRecord[]`.
- To add a fund/provider: add meta, loader (CSV under `public/`), extend the `FundMeta` union and `ALL_FUNDS`, and add a branch in `loadFundRecords`. Note the Faida CSV filename contains two spaces (`FAID FUND  NAV PERFORMANCE.csv`); don't "fix" it.
- Never import `*-fund-csv.ts` (uses `fs`) from client components.

**API guard** ([middleware.ts](middleware.ts)): `/api/*` only allows same-origin browser requests (`Sec-Fetch-Site`), `ALLOWED_ORIGINS`, `ALLOWED_API_HOSTS`, or `Authorization: Bearer $API_ROUTE_BYPASS_SECRET`. Open in `next dev` unless `API_GUARD_STRICT_IN_DEV=true`. Calling the API from curl/scripts without the bypass secret will be rejected in production.

Currency is TZS; date parsing for mixed upstream/CSV formats goes through `lib/date-parse.ts` and `lib/history-date.ts`.
