import { createRoute, z } from "@hono/zod-openapi"
import { createOpenAPIHono } from "../lib"

const healthcheckResponseSchema = z.object({
	status: z.literal("ok"),
	timestamp: z.string().datetime(),
})

const healthcheckRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Health"],
	summary: "Health check endpoint",
	responses: {
		200: {
			description: "Health check successful",
			content: {
				"application/json": {
					schema: healthcheckResponseSchema,
				},
			},
		},
	},
})

export const healthcheckRouter = createOpenAPIHono().openapi(healthcheckRoute, (c) => {
	return c.json(
		{
			status: "ok" as const,
			timestamp: new Date().toISOString(),
		},
		200,
	)
})
