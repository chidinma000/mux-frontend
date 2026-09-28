# UI Component Conventions

Canonical reference for contributors building wallet, account-abstraction, and
payment UI components in `mux-frontend`. All conventions are **fail-closed** and
**deny-by-default**; deviations require a design note in the PR.

## Typed entrypoints

Every component that touches a privileged surface (wallet, AA, payment, auth,
danger zone) **must** have a fully-typed props interface. No `any`, no implicit
`object`. Callers cannot mount a privileged component without wiring its
required props, so a misconfigured render fails at compile time rather than
silently at runtime.

```tsx
// ✅ correct — typed, required props enforced
interface WalletCardProps {
  walletId: string;
  onError: (code: BoundaryErrorCode, correlationId: string) => void;
}

// ❌ wrong — untyped, error path optional
function WalletCard(props: any) { … }
```

## Stable error codes

Components that can fail must surface a **stable, documented error code** from
`docs/security-ux-guards.md`. Never branch on message text; always branch on
the code. The code and a correlation id are the only error material that may
reach the UI or telemetry — never raw stack traces, JWTs, keys, or addresses.

Stable codes used by UI components:

| Code | Surface |
| --- | --- |
| `BOUNDARY_RENDER_FAILED` | Error boundary child threw during render |
| `BOUNDARY_DEPENDENCY_UNAVAILABLE` | RPC/DB/Horizon unreachable |
| `BOUNDARY_AUTH_EXPIRED` | Session/JWT expired mid-flight |
| `BOUNDARY_AUTH_FORBIDDEN` | Wrong role or revoked delegate |
| `BOUNDARY_UNKNOWN` | Unclassified; treated as failure |
| `CLIPBOARD_UNAVAILABLE` | Clipboard API missing |
| `CLIPBOARD_PERMISSION_DENIED` | User/browser denied clipboard write |
| `CLIPBOARD_WRITE_FAILED` | Write attempted but rejected |
| `CONFIRM_PHRASE_EMPTY` | Danger-zone phrase not entered |
| `CONFIRM_PHRASE_MISMATCH` | Phrase does not match |
| `CONFIRM_PHRASE_LOCKED` | Danger zone locked |
| `SESSION_TIMEOUT_WARNING` | Session expiry within warning window |
| `TEAM_FORBIDDEN` | Caller lacks admin role for team mutation |
| `TEAM_MEMBER_EXISTS` | Add conflicts with existing member |
| `TEAM_BACKEND_UNAVAILABLE` | Backend outage on team write path |

## Correlation ids

Every error surfaced to the UI must carry a **correlation id** — an opaque
UUID generated at the boundary and propagated from the request when present.
The id is shown to the user and emitted to telemetry so ops can trace a
user-visible failure to server logs without exposing secrets.

```tsx
// generate at the boundary
const correlationId = crypto.randomUUID();
onError('BOUNDARY_RENDER_FAILED', correlationId);
```

## Fail-closed on writes

Write-path components (spend, recovery, admin, danger zone) must:

1. Disable the action while a prior write is in flight.
2. Surface `BOUNDARY_DEPENDENCY_UNAVAILABLE` and keep the action disabled when
   the dependency is unreachable — never report success optimistically.
3. Require an explicit idempotency key so a double-submit cannot re-apply the
   effect.

## Deny-by-default authz

A new privileged surface is **unauthorized until the server grants it**. The
component must not render admin/recovery/spend controls based on client-side
role inference alone; it must wait for the server-resolved role and render
nothing (or a disabled placeholder) until the role is confirmed.

## Accessibility (a11y)

- Every interactive control has an associated `<label>` via `htmlFor`/`id`.
- Help text is wired through `aria-describedby`.
- Inline validation errors use `role="alert"` and `aria-invalid` on the field.
- Loading and save states are announced via `aria-live="polite"` (or
  `"assertive"` for errors).
- Empty states use `role="status"` with a descriptive label.
- Focus indicators are visible; keyboard navigation is fully operable.
- Never place secrets, keys, or JWTs in `aria-label` or `aria-describedby`.

## No secrets in props, logs, or copy

Components must never:

- Accept raw key material, JWTs, webhook secrets, or full addresses as props.
- Log or emit those values to telemetry.
- Render them in copy, `aria-label`, or `data-*` attributes.

Redact addresses in logs; surface only the stable error code and correlation id.

## Storybook stories

Every new component in `src/components/` that renders a visible surface must
have a Storybook story in `src/stories/` or co-located as
`ComponentName.stories.tsx`. Stories must:

- Use the current `StoryObj<Props>` API (not the deprecated `ComponentStory`).
- Cover the default state, the error/empty state, and any loading state.
- Not import from packages absent in `package.json` (e.g. `@mui/material`).

## Unit tests

Components with non-trivial logic (confirm-phrase guard, session timeout,
RBAC gating) must have a co-located or `tests/` unit test covering:

- The happy path.
- Auth negatives (expired session, wrong role, revoked delegate).
- Fail-closed behavior on dependency outage.

## Cross-links

- Security/UX invariants: [`docs/security-ux-guards.md`](security-ux-guards.md)
- Environment variables: [`docs/frontend-env-vars.md`](frontend-env-vars.md)
- Team access & audit log: [`docs/team-access-and-audit-log.md`](team-access-and-audit-log.md)
- E2E suite: [`tests/e2e/`](../tests/e2e/)
