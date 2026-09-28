import { NextRequest, NextResponse } from 'next/server';
import type { TeamRole } from '../route';

export const runtime = 'nodejs';

// Re-use the same mock store reference via the parent module.
// In production this proxies to the real backend.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const parentModule = require('../route') as {
  mockTeam?: Array<{ id: string; email: string; role: string; name: string; addedAt: string }>;
};

const TEAM_ERROR = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  BACKEND_UNAVAILABLE: 'backend_unavailable',
} as const;

type TeamErrorCode = (typeof TEAM_ERROR)[keyof typeof TEAM_ERROR];

function isMockAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function newCorrelationId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `team_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function errorResponse(
  status: number,
  code: TeamErrorCode,
  message: string,
  correlationId: string,
) {
  return NextResponse.json(
    { error: { code, message, correlationId } },
    { status, headers: { 'x-correlation-id': correlationId } },
  );
}

function resolveCallerRole(req: NextRequest): TeamRole | null {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const [scheme, token] = auth.split(' ');
  if (!token || (scheme !== 'Bearer' && scheme !== 'ApiKey')) return null;
  const role = req.headers.get('x-role') as TeamRole | null;
  if (role !== 'admin' && role !== 'developer') return null;
  return role;
}

/** DELETE /api/team/[id] — remove a member. admin only. Idempotent. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const correlationId = req.headers.get('x-correlation-id') ?? newCorrelationId();

  const callerRole = resolveCallerRole(req);
  if (!callerRole) {
    return errorResponse(401, TEAM_ERROR.UNAUTHORIZED, 'Authentication required.', correlationId);
  }
  if (callerRole !== 'admin') {
    return errorResponse(403, TEAM_ERROR.FORBIDDEN, 'Only admins may remove team members.', correlationId);
  }

  if (!isMockAllowed()) {
    return errorResponse(503, TEAM_ERROR.BACKEND_UNAVAILABLE, 'Team backend not configured.', correlationId);
  }

  const { id } = params;
  const mockTeam = parentModule.mockTeam;
  if (!mockTeam) {
    return errorResponse(503, TEAM_ERROR.BACKEND_UNAVAILABLE, 'Team store unavailable.', correlationId);
  }

  const idx = mockTeam.findIndex((m) => m.id === id);
  // Idempotent: removing an already-removed member succeeds without error.
  if (idx !== -1) {
    mockTeam.splice(idx, 1);
  }

  return NextResponse.json(
    { removed: true, id, correlationId },
    { status: 200, headers: { 'x-correlation-id': correlationId } },
  );
}
