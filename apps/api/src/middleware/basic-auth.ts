import { basicAuth } from "hono/basic-auth"

/**
 * Fail-closed basic auth middleware factory.
 *
 * - Production: throws if BASIC_AUTH_USERNAME / BASIC_AUTH_PASSWORD are missing.
 * - Development: falls back to `admin`/`password` with a visible warning.
 *
 * Usage:
 *   app.use("/admin/*", createBasicAuthMiddleware())
 *
 * Never imported for its side effects; the check only runs when the factory is invoked,
 * so unrelated code that re-exports this module does not accidentally trip production guards.
 */
export const createBasicAuthMiddleware = () => {
	const username = process.env.BASIC_AUTH_USERNAME
	const password = process.env.BASIC_AUTH_PASSWORD

	if (!username || !password) {
		if (process.env.NODE_ENV === "production") {
			throw new Error(
				"BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD must be set in production. Refusing to fall back to default credentials.",
			)
		}
		console.warn(
			"[basic-auth] Using development defaults (admin/password). Set BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD before deploying.",
		)
	}

	return basicAuth({
		username: username ?? "admin",
		password: password ?? "password",
	})
}
