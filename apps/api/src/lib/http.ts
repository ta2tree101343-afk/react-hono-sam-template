import type { ZodIssue } from "../schemas"

/**
 * Builds a standard error response body.
 * `opts` is optional so callers with only a message stay concise.
 */
export const errorBody = (message: string, opts?: { issues?: ZodIssue[]; requestId?: string }) => ({
	success: false as const,
	error: {
		message,
		...(opts?.issues && { issues: opts.issues }),
		...(opts?.requestId && { requestId: opts.requestId }),
	},
})
