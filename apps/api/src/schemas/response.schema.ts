import { z } from "@hono/zod-openapi"

export const zodIssueSchema = z.object({
	path: z.string(),
	message: z.string(),
})

export const errorResponseSchema = z.object({
	success: z.literal(false),
	error: z.object({
		message: z.string(),
		issues: z.array(zodIssueSchema).optional(),
		requestId: z.string().optional(),
	}),
})

export type ZodIssue = z.infer<typeof zodIssueSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
