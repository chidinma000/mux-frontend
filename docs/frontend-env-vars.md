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
  `src/app/api/auth/login/route.ts` and `src/app/api/notifications/route.ts`
  to decide whether to proxy to a real backend or fall back to the mock
  response, and in `src/lib/api/config.ts::getApiBaseUrl()` as the first
  candidate for all other API calls (e.g. `useWallets`). When set, it also
  puts auth into **server-verified mode** (#621): `/api/auth/login` stores
  the backend session token in an HttpOnly `mux_auth_token` cookie and the
  middleware verifies it against `{backend}/auth/session` on every
  `/dashboard` request. The `mux_auth_session` marker cookie is trusted
  only in mock mode.
- **`NEXT_PUBLIC_MUX_API_URL`** — second candidate in the same
  `getApiBaseUrl()` fallback chain; defaults to
  `https://api.muxprotocol.com` when nothing else is set. Predates
  `NEXT_PUBLIC_API_URL` and is kept for older deploy configs.
- **`NEXT_PUBLIC_API_BASE`** — third and final candidate in the fallback
  chain, for deploys that used this older name.
- **`NEXT_PUBLIC_APP_URL`** — this app's own public URL; defaults to
  `http://localhost:3000`.
- **`NEXT_PUBLIC_MUX_API_KEY`** — read by `getApiKey()` in
  `src/lib/api/config.ts`; attached to outgoing API requests where a
  client-visible key is acceptable.
- **`NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`** — only relevant if
  WalletConnect-based wallet flows are enabled.

### Server-only

These never reach the browser and are safe for secrets.

- **`MUX_API_KEY`** / **`MUX_API_SECRET`** — credentials for server-side
  calls to the Mux Protocol API (Next.js route handlers / server
  components only).
- **`DATABASE_URL`** — connection string, if this deployment persists any
  data outside the backend API.

### Implicit

- **`NODE_ENV`** — standard Next.js variable. Gates verbose
  console logging in the analytics/tracking hooks
  (`useAnalytics.ts`, `useAnalyticsMetrics.ts`, `useAnalyticsTracking.ts`,
  `recoveryAnalyticsTracking.ts`, `spendingLimitsTracking.ts`) outside of
  `production`; makes `validateEnv()` in `src/lib/env.ts` throw
  (instead of warn) on missing *required* vars when set to `production`;
  and disables every mock/demo fallback when `production` — see
  `src/lib/api/runtimeMode.ts` (`canUseMockFallback()` /
  `assertBackendOrDemo()`), consumed by `/api/auth/login`,
  `/api/notifications`, `useNotifications.ts`, and `useRecovery.ts`. A
  production build with no `NEXT_PUBLIC_API_URL` returns `503` from those
  routes rather than serving mock data.

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
- [ ] `NODE_ENV=production` with `NEXT_PUBLIC_API_URL` unset → `GET
      /api/notifications` and `POST /api/auth/login` return `503`, not mock
      data.
- [ ] `NEXT_PUBLIC_API_URL` set → signing in stores an HttpOnly
      `mux_auth_token` cookie (not visible in `document.cookie`), and
      tampering with / deleting it bounces `/dashboard` back to `/login`.
