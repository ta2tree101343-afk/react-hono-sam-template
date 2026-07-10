interface EnvConfig {
	readonly PORT: number
	readonly NODE_ENV: "development" | "production" | "test"
	readonly USERS_TABLE_NAME: string
	readonly AWS_REGION: string
	readonly DYNAMODB_ENDPOINT_URL: string | undefined
}

const NODE_ENV = (process.env.NODE_ENV ?? "development") as EnvConfig["NODE_ENV"]
const isProduction = NODE_ENV === "production"

const getEnvVar = (key: string, defaultValue?: string): string => {
	const value = process.env[key] ?? defaultValue
	if (value === undefined) {
		throw new Error(`Missing required environment variable: ${key}`)
	}
	return value
}

/**
 * In production, the env var is required (throws if missing).
 * In non-production, falls back to devDefault so local dev has zero setup friction.
 * Guards against silent production misconfiguration (e.g. USERS_TABLE_NAME falling back
 * to `users-local` and hitting a real AWS DynamoDB table that does not exist).
 */
const getRequiredInProd = (key: string, devDefault: string): string => {
	const value = process.env[key]
	if (isProduction && !value) {
		throw new Error(
			`Missing required environment variable in production: ${key}. Refusing to fall back to development defaults.`,
		)
	}
	return value ?? devDefault
}

export const env: EnvConfig = {
	PORT: Number.parseInt(getEnvVar("PORT", "3000"), 10),
	NODE_ENV,
	USERS_TABLE_NAME: getRequiredInProd("USERS_TABLE_NAME", "users-local"),
	AWS_REGION: getRequiredInProd("AWS_REGION", "ap-northeast-1"),
	DYNAMODB_ENDPOINT_URL: process.env.DYNAMODB_ENDPOINT_URL,
}

// Guard against silently connecting to real AWS DynamoDB in development.
// When DYNAMODB_ENDPOINT_URL is not set locally, the SDK will attempt to use
// real AWS with whatever credentials happen to be present in the environment.
if (!isProduction && !env.DYNAMODB_ENDPOINT_URL) {
	console.warn(
		"[env] DYNAMODB_ENDPOINT_URL is not set. The DynamoDB client will attempt to connect to real AWS. " +
			"Run `pnpm db:up` and set DYNAMODB_ENDPOINT_URL=http://localhost:8000 in apps/api/.env for offline development.",
	)
}
