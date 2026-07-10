import { z } from "zod"

// Form-side Zod schema for react-hook-form.
// Intentionally kept separate from api's `createUserSchema`:
// - api's schema uses `@hono/zod-openapi` extensions that web should not have to bundle.
// - form messages here are UX-focused ("Name is required" vs Zod default).
//
// The wire type (`User`, `CreateUser`) is imported from `@app/api/schemas`
// so changes to the persisted shape are still caught at compile time.
// If constraints ever drift, add a compile-time test that compares against
// the api schema, or extract shared Zod definitions to `packages/shared`.
export const userFormSchema = z.object({
	name: z.string().min(1, "Name is required").max(100),
	email: z.email("Invalid email"),
})

export type UserFormInput = z.infer<typeof userFormSchema>
