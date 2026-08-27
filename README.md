# Mux Dashboard

The developer console for **Mux Protocol** — manage API keys, track wallet creation, and monitor account activity on Stellar.

Mux Dashboard is the interface for developers building on Mux. It provides visibility into the **Invisible Wallet system** while abstracting away all blockchain complexity.

---

## Overview

Mux Dashboard allows developers to:

* **Create and manage API keys** for SDK access
* **Track Stellar account creation** on Testnet and Mainnet
* **Monitor wallet activity** and balances
* **View usage metrics** such as transaction counts and account status
* **Configure basic project-level settings**

End users do not interact with this dashboard — it is purely for developers integrating Mux into their applications.

---

## Core Principles

* **Developer-first UX**: designed for fast onboarding and management
* **Invisible Wallet visibility**: see accounts and activity without exposing keys or blockchain jargon
* **Safe and clear**: all actions are explicit; sensitive operations are handled by the backend

---

## Key Features

* **API Key Management**: generate, rotate, and revoke keys
* **Wallet/Account Tracking**: monitor accounts created via the SDK
* **Activity Metrics**: view transaction volumes and status
* **Requests over time**: visualize API request traffic trends
* **Wallet creation analytics**: monitor daily wallet creation volume
* **Network Switching**: testnet vs mainnet tracking
* **Usage Monitoring**: see platform-sponsored actions and account health

---

## Getting Started

### Prerequisites

* Node.js >= 18
* Access to Mux Backend API

### Installation

```bash
git clone https://github.com/muxlabs/mux-frontend.git
cd mux-frontend
pnpm install
pnpm run dev
```

### Environment variables

All variables are optional in local development — sensible mock/default
behavior kicks in when they're unset (see `src/lib/env.ts` for the
validation schema). Copy `.env.example` to `.env.local` and fill in real
values for testnet/mainnet-connected work.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | No | _(none)_ | Base URL for the Mux backend API used by client-side requests, e.g. `https://api.muxprotocol.com` for mainnet or a testnet-specific URL. When unset, API routes such as `/api/auth/login` and `/api/notifications` fall back to an in-repo mock so `pnpm run dev` and CI work without a live backend — **except in a production build, where those routes return `503` rather than mock data**. Setting this also switches auth into server-verified mode (see the Auth section below). |
| `NEXT_PUBLIC_MUX_API_URL` | No | `https://api.muxprotocol.com` | Legacy alias for the API base URL, checked after `NEXT_PUBLIC_API_URL` (see `src/lib/api/config.ts`). Kept for backward compatibility with older deploys. |
| `NEXT_PUBLIC_API_BASE` | No | _(none)_ | Third fallback in the API base URL resolution chain, checked after the two vars above. |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public-facing URL of this application, used for building absolute links (e.g. callback URLs). |
| `NEXT_PUBLIC_MUX_API_KEY` | No | _(none)_ | Client-visible API key sent with requests to the Mux Protocol API. Do not put secrets here — anything prefixed `NEXT_PUBLIC_` is bundled into client JS. |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | No | _(none)_ | WalletConnect project ID, needed only if wallet-connect based flows are enabled. |
| `MUX_API_KEY` | No | _(none)_ | Server-only Mux Protocol API key, used for requests made from Next.js API routes / server components. Never exposed to the browser. |
| `MUX_API_SECRET` | No | _(none)_ | Server-only Mux Protocol API secret, paired with `MUX_API_KEY`. |
| `DATABASE_URL` | No | _(none)_ | Server-only database connection string, if this deployment persists data outside the backend API. |

**Testnet vs. mainnet:** this frontend does not hardcode a network — it
is entirely driven by which backend `NEXT_PUBLIC_API_URL` (or its
aliases above) points at. Point it at a testnet-configured Mux backend
for staging/testnet work, and at the production backend for mainnet.
The CI workflow (`.github/workflows/ci.yml`) sets a placeholder
`NEXT_PUBLIC_API_URL` only so `next build` can run without secrets; it
does not reflect a real environment.

`NODE_ENV` (standard Next.js variable, not defined in `.env.example`)
also gates some behavior: analytics/tracking hooks
(`useAnalytics.ts`, `useAnalyticsMetrics.ts`, `useAnalyticsTracking.ts`,
`recoveryAnalyticsTracking.ts`, `spendingLimitsTracking.ts`) log to the
console outside of `production`; `src/lib/env.ts` throws on missing
*required* vars only when `NODE_ENV=production`; and the mock/demo
fallbacks in API routes and data hooks
(`src/lib/api/runtimeMode.ts`, `useNotifications.ts`, `useRecovery.ts`)
are disabled when `NODE_ENV=production` so mock data is never served in a
production build.

See [`docs/frontend-env-vars.md`](docs/frontend-env-vars.md) for the full
reference, including which file reads each variable and a manual
verification checklist.

### Auth and API client behavior

* `src/lib/api.js` adds request header support with `x-request-id` and automatic session refresh on `401`
* `src/lib/session.js` persists auth state and clears stale sessions gracefully
* `src/hooks/useWallets.ts` adds a wallet query hook that loads wallets from `/api/wallets`
* `src/app/api/auth/refresh/route.ts`, `/api/wallets/route.ts`, and `/api/wallets/[id]/route.ts` simulate auth-protected backend behavior for local testing

**Server-verified sessions (#621).** When `NEXT_PUBLIC_API_URL` is set,
`POST /api/auth/login` proxies to the backend and stores the backend-issued
session token in an **HttpOnly `mux_auth_token` cookie**. The Next.js
middleware verifies that token against `GET {backend}/auth/session` on every
`/dashboard` request — the old client-set `mux_auth_session` marker cookie is
only trusted in mock mode (no backend). `signOut()` calls
`POST /api/auth/logout` to clear the HttpOnly cookie. See
[`docs/auth-local-setup.md`](docs/auth-local-setup.md).

**No silent mock success in production.** API routes that fall back to
in-repo mock data (`/api/auth/login`, `/api/notifications`, …) do so only
outside production. A production build with no backend configured returns
`503` instead of mock data, so a misconfiguration is visible rather than
masked. The shared rule lives in `src/lib/api/runtimeMode.ts`.

### Smoke tests

Run unit/component smoke tests with:

```bash
npm test
```

Run Playwright end-to-end smoke tests (login + wallet monitoring, desktop
and mobile viewports) with:

```bash
pnpm exec playwright install --with-deps chromium
pnpm run test:e2e
```

See [`tests/e2e/README.md`](tests/e2e/README.md) for what's covered and a
manual verification checklist.

### Documentation

Root-level `.md` files are kept to just this `README.md`. Deeper
reference docs (env vars, auth setup, analytics data sources, CI
typecheck/build verification, etc.) live under [`docs/`](docs/) so they
stay easy to find and don't clutter the repo root as features evolve.

---

## Design Philosophy

* The dashboard is **developer-focused**, not end-user focused
* **Backend handles wallets and transactions**; the dashboard is a monitoring and management tool
* Makes it simple to **observe, control, and integrate** Mux-powered wallets

---

## Roadmap

* Per-key usage analytics
* Webhooks and notifications for SDK events
* Team access management
* Audit logs for all wallet and API activity
