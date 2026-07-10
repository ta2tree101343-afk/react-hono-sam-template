import type { AppType } from "@app/api/app-type"
import { hc } from "hono/client"

// 型を一度だけ確定させる（hc<AppType> を再評価しない）
const _client = hc<AppType>("")
type Client = typeof _client

const createClient = (baseUrl: string): Client => hc<AppType>(baseUrl)

// Fail loudly if the env var is missing rather than silently issuing requests
// against relative paths (which would 404 through Vite proxy or CloudFront).
const baseUrl = import.meta.env.VITE_API_BASE_URL
if (typeof baseUrl !== "string" || baseUrl.length === 0) {
	throw new Error(
		"VITE_API_BASE_URL is not set. Copy apps/web/.env.example to apps/web/.env and rebuild.",
	)
}

export const api = createClient(baseUrl)

/**
 * Throws if the response is not ok, extracting the server's `error.message`
 * so callers surface real reasons (validation issues, request IDs) instead
 * of a bare `HTTP 400`.
 *
 * Preserves the response type for chained `.json()` calls.
 */
export const ensureOk = async (res: Response): Promise<void> => {
	if (res.ok) return
	const body = (await res.json().catch(() => null)) as {
		error?: { message?: string; requestId?: string }
	} | null
	const baseMessage = body?.error?.message ?? `HTTP ${res.status}`
	const requestId = body?.error?.requestId
	// Include requestId inline so toasts / logs / bug reports carry it without
	// callers having to introspect a custom Error property.
	const message = requestId ? `${baseMessage} (requestId: ${requestId})` : baseMessage
	throw new Error(message)
}
