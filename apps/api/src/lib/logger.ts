import pino from "pino"
import { env } from "./env"

const isDevelopment = env.NODE_ENV === "development"

export const logger = pino({
	level: isDevelopment ? "debug" : "info",
	...(isDevelopment && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
			},
		},
	}),
})
