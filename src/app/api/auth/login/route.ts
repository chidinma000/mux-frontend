import { NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/api/config";
import { canUseMockFallback } from "@/lib/api/runtimeMode";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/routeAccess";

/** Default session-token cookie lifetime: 8 hours (matches AuthContext TTL). */
const TOKEN_COOKIE_MAX_AGE = 8 * 60 * 60;

/**
 * Extracts an opaque session token from a backend login response, tolerating
 * the common field names used by Better Auth / Clerk / custom backends.
 */
function extractSessionToken(data: unknown): string | undefined {
	if (!data || typeof data !== "object") return undefined;
	const d = data as Record<string, unknown>;
	const candidate =
		d.token ??
		d.accessToken ??
		d.sessionToken ??
		(typeof d.session === "object" && d.session !== null
			? (d.session as Record<string, unknown>).token
			: undefined);
	return typeof candidate === "string" && candidate.length > 0
		? candidate
		: undefined;
}

/**
 * Attaches the HttpOnly, server-verified session-token cookie (#621) to a
 * login response. The middleware confirms this token against the backend on
 * every protected request, so a forged marker cookie alone no longer grants
 * access. HttpOnly keeps it out of `document.cookie` / JS.
 */
function withSessionCookie(
	response: NextResponse,
	token: string,
): NextResponse {
	response.cookies.set(SESSION_TOKEN_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		secure: process.env.NODE_ENV === "production",
		maxAge: TOKEN_COOKIE_MAX_AGE,
	});
	return response;
}

/**
 * POST /api/auth/login
 *
 * Proxies login credentials to the configured backend API
 * (NEXT_PUBLIC_API_URL or legacy aliases). If no backend URL is set, falls back to a mock
 * response so local development works without a running API server.
 */
export async function POST(request: Request) {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json(
			{ error: "Invalid request body" },
			{ status: 400 },
		);
	}

	const { email, password } = body as { email?: string; password?: string };
	if (!email || !password) {
		return NextResponse.json(
			{ error: "Email and password are required" },
			{ status: 400 },
		);
	}

	const backendUrl = getApiBaseUrl();

	if (backendUrl) {
		// Proxy to the real backend
		try {
			const upstream = await fetch(`${backendUrl}/auth/login`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await upstream.json().catch(() => ({}));

			if (!upstream.ok) {
				return NextResponse.json(data, { status: upstream.status });
			}

			const response = NextResponse.json(data, { status: 200 });
			const token = extractSessionToken(data);
			if (token) {
				withSessionCookie(response, token);
			}
			return response;
		} catch {
			return NextResponse.json(
				{ error: "Unable to reach authentication server" },
				{ status: 502 },
			);
		}
	}

	// --- Mock fallback (local dev / CI only, never in production) ---
	// Accepts any well-formed credentials; used for local dev / CI.
	if (!canUseMockFallback()) {
		return NextResponse.json(
			{
				error:
					"Authentication backend is not configured. Set NEXT_PUBLIC_API_URL — " +
					"mock sign-in is not available in production.",
			},
			{ status: 503 },
		);
	}

	const namePart = email.split("@")[0] ?? "User";
	const name = namePart
		.split(/[._-]/)
		.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
		.join(" ");

	return NextResponse.json(
		{ user: { name, email, role: "developer" } },
		{ status: 200 },
	);
}
