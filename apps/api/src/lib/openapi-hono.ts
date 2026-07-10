import { OpenAPIHono } from "@hono/zod-openapi"
import type { ZodError } from "zod"

export const createOpenAPIHono = () => {
	return new OpenAPIHono({
		defaultHook: (result, c) => {
			if (!result.success) {
				const error = result.error as ZodError
				return c.json(
					{
						success: false,
						error: {
							message: "Validation Error",
							issues: error.issues.map((issue) => ({
								path: issue.path.join("."),
								message: issue.message,
							})),
						},
					},
					400,
				)
			}
		},
	})
}
