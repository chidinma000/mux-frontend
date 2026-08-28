# Frontend environment variables

Reference for every environment variable this Next.js app reads, where it's
validated, and how it affects behavior across local dev, testnet, and
mainnet. The authoritative schema lives in `src/lib/env.ts`; this doc is a
narrative companion to the table in the root `README.md`.

## Quick start

```bash
cp .env.example .env.local
# edit .env.local with real values, then:
pnpm run dev
```

Every variable is optional locally. Leaving `.env.local` empty (or not
creating it at all) still works — `next dev` and `pnpm test` both run
against in-repo mocks (`/api/auth/login`, `/api/wallets`, etc.).

## Variables

### Client-visible (`NEXT_PUBLIC_*`)

These are inlined into the browser bundle at build time. Never put secrets
in a `NEXT_PUBLIC_*` variable.

- **`NEXT_PUBLIC_API_URL`** — primary backend base URL. Read directly in
  `src/app/api/auth/login/route.ts` to decide whether to proxy to a real
  backend or fall back to the mock login response, and in
  `src/lib/api/config.ts::getApiBaseUrl()` as the first candidate for all
  other API calls (e.g. `useWallets`, `GET /api/requests/today`, and
  `POST /api/transactions` for the wallet "Send" flow).
- **`NEXT_PUBLIC_MUX_API_URL`** — second candidate in the same
  `getApiBaseUrl()` fallback chain; defaults to
  `https://api.muxprotocol.com` when nothing else is set. Predates
  `NEXT_PUBLIC_API_URL` and is kept for older deploy configs.
- **`NEXT_PUBLIC_API_BASE`** — third and final candidate in the fallback
  chain, for deploys that used this older name.
- **`NEXT_PUBLIC_APP_URL`** — this app's own public URL; defaults to
  `http://localhost:3000`.
- **`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`** — only relevant if
  WalletConnect-based wallet flows are enabled.

There is intentionally no client-visible Mux API key. A project API key
is a real credential, and anything under `NEXT_PUBLIC_*` is inlined into
the browser bundle for every visitor to read — see #636. `ApiContext.tsx`
(a client component) never reads `MUX_API_KEY`/`MUX_API_SECRET`; it only
constructs an unauthenticated client that talks to this app's own
same-origin `/api/*` routes.

### Server-only

These never reach the browser and are safe for secrets.

- **`MUX_API_KEY`** / **`MUX_API_SECRET`** — read by
  `getUpstreamAuthHeaders()` in `src/lib/api/config.ts` and attached
  (`x-api-key` / `x-api-secret`) to every upstream request a Next.js API
  route makes to the Mux backend. Only ever read inside `src/app/api/**`
  route handlers or other server-only modules — never import
  `getApiKey()`/`getApiSecret()` from a client component.

### Implicit

- **`NODE_ENV`** — standard Next.js variable. Gates verbose
  console logging in the analytics/tracking hooks
  (`useAnalytics.ts`, `useAnalyticsMetrics.ts`, `useAnalyticsTracking.ts`,
  `recoveryAnalyticsTracking.ts`, `spendingLimitsTracking.ts`) outside of
  `production`, makes `validateEnv()` in `src/lib/env.ts` throw
  (instead of warn) on missing *required* vars when set to `production`,
  and controls whether `getEnv()` merges in documented defaults (see
  "Production defaults" below — it only does so when `NODE_ENV=production`).

### Production defaults

`getEnv()` merges each var's documented `defaultValue` (from the schema
in `src/lib/env.ts`) into whatever is set, but only when
`NODE_ENV=production`. Concretely: if a production deploy forgets to set
`NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_MUX_API_URL`, it now resolves to the
documented default `https://api.muxprotocol.com` instead of silently
falling through every API route's mock branch (#637). Local dev and test
runs are untouched — `NODE_ENV` isn't `production`, so leaving vars unset
still exercises the in-repo mocks described throughout this doc.

## Testnet vs. mainnet

This app has no built-in network switch — network selection is entirely a
function of which backend `NEXT_PUBLIC_API_URL` (or its aliases) points
at:

| Environment | `NEXT_PUBLIC_API_URL` example |
| --- | --- |
| Local dev (mocked) | _(unset)_ |
| Testnet / staging | `https://testnet-api.muxprotocol.com` |
| Mainnet / production | `https://api.muxprotocol.com` |

The wallet rows themselves also carry a per-wallet `network` field
(`"testnet"` \| `"mainnet"`, see `src/types/wallet.ts`), so a single
backend can return a mix of both — the env var controls *which backend*
you talk to, not which network's wallets are shown.

## CI

`.github/workflows/ci.yml` sets `NEXT_PUBLIC_API_URL=https://api.example.com`
purely so `next build` succeeds without real credentials. It is a
placeholder, not a real environment — do not read it as evidence of a
live mainnet or testnet target.

## Manual verification checklist

- [ ] `.env.local` unset entirely → `pnpm run dev` still boots and login
      succeeds against the mock `/api/auth/login` route.
- [ ] `NEXT_PUBLIC_API_URL` set to a real backend → login proxies through
      instead of using the mock.
- [ ] `NEXT_PUBLIC_APP_URL` changed → any absolute links that use it
      update accordingly.
- [ ] Removing a `NEXT_PUBLIC_*` var and setting `NODE_ENV=production`
      surfaces a startup error only for vars marked `required` in
      `src/lib/env.ts` (none currently are, by design).
