import { getEnv } from "@/lib/env";

export function getApiBaseUrl(): string {
	const env = getEnv();
	const baseUrl =
		env.NEXT_PUBLIC_API_URL ??
		env.NEXT_PUBLIC_MUX_API_URL ??
		env.NEXT_PUBLIC_API_BASE ??
		"";

	return baseUrl.replace(/\/+$/, "");
}

/**
 * Server-only Mux Protocol credentials. These must never be read from a
 * NEXT_PUBLIC_* var or passed into a client component — see MUX_API_KEY /
 * MUX_API_SECRET in src/lib/env.ts.
 */
export function getApiKey(): string | undefined {
	return getEnv().MUX_API_KEY;
}

export function getApiSecret(): string | undefined {
	return getEnv().MUX_API_SECRET;
}

/** Auth headers for server-side requests to the upstream Mux backend. */
export function getUpstreamAuthHeaders(): Record<string, string> {
	const apiKey = getApiKey();
	const apiSecret = getApiSecret();
	return {
		...(apiKey ? { "x-api-key": apiKey } : {}),
		...(apiSecret ? { "x-api-secret": apiSecret } : {}),
	};
}
