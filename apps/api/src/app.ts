import { OpenAPIHono } from "@hono/zod-openapi"
import { logger as honoLogger } from "hono/logger"
import { prettyJSON } from "hono/pretty-json"
import { errorBody, logger } from "./lib"
import { corsMiddleware } from "./middleware"
import { apiV1Router } from "./routes"

const app = new OpenAPIHono()

app.use(prettyJSON())
app.use("*", honoLogger())
app.use("*", corsMiddleware)

// Map AWS SDK / known error names to HTTP status codes.
// Any error not matched here is treated as 500.
const mapErrorToStatus = (err: Error): { status: 500 | 429 | 503 | 400; message: string } => {
	switch (err.name) {
		case "ProvisionedThroughputExceededException":
		case "ThrottlingException":
		case "RequestLimitExceeded":
		case "TooManyRequestsException":
			return { status: 429, message: "Too many requests" }
		case "ServiceUnavailable":
		case "ServiceUnavailableException":
			return { status: 503, message: "Service temporarily unavailable" }
		case "ValidationException":
			return { status: 400, message: "Invalid request" }
		default:
			return { status: 500, message: "Internal Server Error" }
	}
}

app.onError((err, c) => {
	const requestId = crypto.randomUUID()
	const { status, message } = mapErrorToStatus(err)

	logger.error(
		{
			requestId,
			err: { name: err.name, message: err.message, stack: err.stack },
			path: c.req.path,
			method: c.req.method,
		},
		"Unhandled error",
	)

	return c.json(errorBody(message, { requestId }), status)
})

app.route("/api/v1", apiV1Router)

export { app }

// クライアントは VITE_API_BASE_URL=/api/v1 を base として使うため、
// マウント前の apiV1Router の型を export する（パスの二重評価を防ぐ）
export type AppType = typeof apiV1Router
