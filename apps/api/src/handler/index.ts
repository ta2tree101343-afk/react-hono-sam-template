// Load .env before any other imports so env.ts can read them at module init time.
// Runs only in local dev; on Lambda there is no .env and dotenv silently does nothing.
import "dotenv/config"

import { serve } from "@hono/node-server"
import { app } from "../app"
import { env, logger } from "../lib"

const PORT = env.PORT

serve({ fetch: app.fetch, port: PORT }, (info) => {
	// Use `info.port` in case the OS chose a different port (e.g. when PORT=0
	// for auto-assign, or if the requested port was in use and the server
	// fell back to another).
	const actualPort = info.port
	logger.info(`Server is running on http://localhost:${actualPort}`)
	logger.info(`Swagger UI: http://localhost:${actualPort}/api/v1/swagger`)
	logger.info(`Scalar API Reference: http://localhost:${actualPort}/api/v1/scalar`)
	logger.info(`OpenAPI Spec: http://localhost:${actualPort}/api/v1/doc`)
})
