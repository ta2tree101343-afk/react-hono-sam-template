import { cors } from "hono/cors"

// NOTE: `credentials: true` cannot be combined with `origin: "*"` — browsers reject.
// This template is designed for CloudFront same-origin deployment (§6.1 of design doc),
// so credentials-cross-origin is not needed. When splitting deployment (§6.2), set
// `origin` to the specific host and re-enable `credentials: true`.
export const corsMiddleware = cors({
	origin: "*",
	allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization"],
	exposeHeaders: ["Content-Length"],
	maxAge: 86400,
})
