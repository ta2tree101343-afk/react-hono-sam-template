import { swaggerUI } from "@hono/swagger-ui"
import { Scalar } from "@scalar/hono-api-reference"
import { createOpenAPIHono } from "../lib"
import { healthcheckRouter } from "./healthcheck.route"
import { usersRouter } from "./users"

const openAPIRouter = createOpenAPIHono()

openAPIRouter.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
	type: "http",
	scheme: "bearer",
	bearerFormat: "JWT",
	description: "JWT Bearer token authentication",
})

openAPIRouter.openAPIRegistry.registerComponent("securitySchemes", "BasicAuth", {
	type: "http",
	scheme: "basic",
	description: "Basic authentication",
})

export const apiV1Router = openAPIRouter
	.doc("/doc", {
		openapi: "3.1.0",
		info: {
			title: "Hono Lambda SAM API",
			version: "1.0.0",
			description: "API documentation for Hono Lambda SAM Template",
		},
		// Relative URL — resolves against the doc's serving location.
		// - dev:  http://localhost:3000/api/v1/doc  → base  http://localhost:3000/api/v1
		// - prod: https://<cf>/api/v1/doc            → base  https://<cf>/api/v1
		// This intentionally avoids embedding a hardcoded CloudFront domain,
		// which would create a SAM circular dependency (Lambda ↔ CloudFront ↔ ApiGateway).
		servers: [{ url: "/api/v1" }],
	})
	.get("/scalar", Scalar({ sources: [{ url: "./doc" }] }))
	.get("/swagger", swaggerUI({ url: "./doc" }))
	.route("/healthcheck", healthcheckRouter)
	.route("/users", usersRouter)
	.get("/", (c) => {
		return c.json({
			message: "Hono Lambda SAM API",
			version: "1.0.0",
			docs: "./scalar",
		})
	})
