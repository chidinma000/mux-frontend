# API Hooks

This document explains the new API hooks added to the project:

- `useApiKeys()` — a client hook that fetches API keys and exposes `data`, `loading`, `error`, and `refetch`.
- `useRevokeApiKey()` — a client hook that provides `revoke(id)` and `loading`/`error` state while revoking.

Files:

- `src/hooks/useApiKeys.ts` — fetch + refetch behavior
- `src/hooks/useRevokeApiKey.ts` — mutation for revoking a key
- `src/lib/api.ts` — small API wrapper using `src/mock-data/api-keys.ts`
- `src/mock-data/api-keys.ts` — mock store with `getApiKeys()` and `revokeApiKey()` persistence via `localStorage` or in-memory fallback

Usage example (client component):

1. Import the hooks:

```tsx
import { useApiKeys } from '@/hooks/useApiKeys';
import { useRevokeApiKey } from '@/hooks/useRevokeApiKey';
```

2. Use them in a client component and call `refetch()` after a mutation to refresh data:

```tsx
const { data: keys, loading, refetch } = useApiKeys();
const { revoke, loading: revoking } = useRevokeApiKey();

async function onRevoke(id: string) {
  await revoke(id);
  await refetch();
}
```

Notes on testing locally:

- The repo uses React 19; some testing libraries may expect React 18+. If `npm install` fails due to peer dependency conflicts, run the install command with `--legacy-peer-deps` or use the project's preferred package manager (`pnpm`) if available.
- Run tests with:

```bash
pnpm install
pnpm test

# or with npm (if pnpm is not available)
npm install --legacy-peer-deps
npm test
```

If tests fail in CI due to path alias (`@/`) resolution, add appropriate `vitest` config with `tsconfig` path mappings.

---

## Production vs demo/mock split

Data hooks and their API routes follow one rule, centralised in
`src/lib/api/runtimeMode.ts`:

| Situation | Behavior |
| --- | --- |
| Backend configured (`NEXT_PUBLIC_API_URL` / aliases) | Always call the real backend. |
| No backend + **not** production | Fall back to in-repo mock data (`src/mock-data/`). |
| No backend + **production** build | Surface an error (HTTP 503 / thrown). Mock data is **never** served in production, so an outage or misconfig is visible instead of silently masked. |

### `useNotifications()` — #617

`src/hooks/useNotifications.ts`. Exposes `notifications`, `unreadCount`,
`loading`, `error`, `refetch`, and `markAllRead`.

- List + mark-all-read both go through `/api/notifications`
  (`GET` and `PATCH { markAll: true }`), which proxies to
  `GET|PATCH {backend}/notifications[/read]` when a backend is set.
- `markAllRead()` updates local state optimistically **and** persists to the
  server. If persistence fails it triggers a reconciling `refetch()` rather
  than letting the optimistic state drift.
- In production with no backend, `/api/notifications` returns `503` — the
  panel shows its error state with a retry.

### Notifications bell — #618

`src/components/layouts/TopNav.tsx` mounts
`src/components/notifications/NotificationsPanel.tsx` from the bell button.
The red dot renders only when `unreadCount > 0` (showing the count, capped at
`9+`); closing the panel calls `refetch()` so the badge reflects a
mark-all-read performed inside the panel.

### `useRecovery(walletId)` — #620

`src/hooks/useRecovery.ts`.

- `walletId !== null` → real per-wallet status fetch via `useRecoveryStatus`
  / `fetchRecoveryStatus`.
- `walletId === null`:
  - **production** — resolves straight to `idle` (no wallet selected yet =
    nothing to fetch); `confirmRecovery()` rejects with
    "Select a wallet before initiating recovery." No simulated delay, no
    fake success.
  - **non-production** — keeps a short simulated bootstrap so the demo
    dashboards render a loading skeleton without a live backend.
