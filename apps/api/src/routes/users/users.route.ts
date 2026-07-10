import { createRoute, z } from "@hono/zod-openapi"
import { createOpenAPIHono, errorBody } from "../../lib"
import {
	createUserSchema,
	errorResponseSchema,
	updateUserSchema,
	userIdSchema,
	userSchema,
} from "../../schemas"
import { userService } from "../../services"

const USER_TAG = "Users"

const listUsersRoute = createRoute({
	method: "get",
	path: "/",
	tags: [USER_TAG],
	summary: "List all users",
	responses: {
		200: {
			description: "List of users",
			content: {
				"application/json": {
					schema: z.object({
						users: z.array(userSchema),
						total: z.number(),
					}),
				},
			},
		},
	},
})

const getUserRoute = createRoute({
	method: "get",
	path: "/:id",
	tags: [USER_TAG],
	summary: "Get a user by ID",
	request: {
		params: z.object({ id: userIdSchema }),
	},
	responses: {
		200: {
			description: "User found",
			content: { "application/json": { schema: userSchema } },
		},
		404: {
			description: "User not found",
			content: { "application/json": { schema: errorResponseSchema } },
		},
	},
})

const createUserRoute = createRoute({
	method: "post",
	path: "/",
	tags: [USER_TAG],
	summary: "Create a new user",
	request: {
		body: {
			content: { "application/json": { schema: createUserSchema } },
		},
	},
	responses: {
		201: {
			description: "User created",
			content: { "application/json": { schema: userSchema } },
		},
		400: {
			description: "Validation error",
			content: { "application/json": { schema: errorResponseSchema } },
		},
	},
})

const updateUserRoute = createRoute({
	method: "put",
	path: "/:id",
	tags: [USER_TAG],
	summary: "Update a user",
	request: {
		params: z.object({ id: userIdSchema }),
		body: {
			content: { "application/json": { schema: updateUserSchema } },
		},
	},
	responses: {
		200: {
			description: "User updated",
			content: { "application/json": { schema: userSchema } },
		},
		404: {
			description: "User not found",
			content: { "application/json": { schema: errorResponseSchema } },
		},
	},
})

const deleteUserRoute = createRoute({
	method: "delete",
	path: "/:id",
	tags: [USER_TAG],
	summary: "Delete a user",
	request: {
		params: z.object({ id: userIdSchema }),
	},
	responses: {
		204: {
			description: "User deleted",
		},
		404: {
			description: "User not found",
			content: { "application/json": { schema: errorResponseSchema } },
		},
	},
})

const NOT_FOUND = "User not found"

export const usersRouter = createOpenAPIHono()
	.openapi(listUsersRoute, async (c) => {
		const users = await userService.findAll()
		return c.json({ users, total: users.length }, 200)
	})
	.openapi(getUserRoute, async (c) => {
		const { id } = c.req.valid("param")
		const user = await userService.findById(id)
		if (!user) return c.json(errorBody(NOT_FOUND), 404)
		return c.json(user, 200)
	})
	.openapi(createUserRoute, async (c) => {
		const body = c.req.valid("json")
		const user = await userService.create(body)
		return c.json(user, 201)
	})
	.openapi(updateUserRoute, async (c) => {
		const { id } = c.req.valid("param")
		const body = c.req.valid("json")
		const user = await userService.update(id, body)
		if (!user) return c.json(errorBody(NOT_FOUND), 404)
		return c.json(user, 200)
	})
	.openapi(deleteUserRoute, async (c) => {
		const { id } = c.req.valid("param")
		const deleted = await userService.delete(id)
		if (!deleted) return c.json(errorBody(NOT_FOUND), 404)
		return c.body(null, 204)
	})
