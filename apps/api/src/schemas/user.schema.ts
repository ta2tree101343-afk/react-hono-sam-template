import { z } from "@hono/zod-openapi"
import { dateTimeISOSchema } from "../lib"

// Brand symbol for User IDs — prevents accidental mixing with arbitrary strings
// (e.g. passing a Product ID or raw request path segment where a UserId is expected).
export const userIdSym = Symbol("UserId")

const userNameSchema = z.string().min(1).max(100).openapi({ example: "John Doe" })
const userEmailSchema = z.email().openapi({ example: "john@example.com" })

export const userIdSchema = z
	.uuid()
	.brand(userIdSym)
	.openapi({ example: "123e4567-e89b-12d3-a456-426614174000" })

export const userSchema = z
	.object({
		id: userIdSchema,
		name: userNameSchema,
		email: userEmailSchema,
		createdAt: dateTimeISOSchema,
		updatedAt: dateTimeISOSchema,
	})
	.openapi("User")

export const createUserSchema = z
	.object({
		name: userNameSchema,
		email: userEmailSchema,
	})
	.openapi("CreateUser")

export const updateUserSchema = z
	.object({
		name: userNameSchema.optional(),
		email: userEmailSchema.optional(),
	})
	.openapi("UpdateUser")

export type UserId = z.infer<typeof userIdSchema>
export type User = z.infer<typeof userSchema>
export type CreateUser = z.infer<typeof createUserSchema>
export type UpdateUser = z.infer<typeof updateUserSchema>
