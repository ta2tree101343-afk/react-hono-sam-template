import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { docClient, env, nowAsDateTimeISO } from "../lib"
import {
	type CreateUser,
	type UpdateUser,
	type User,
	type UserId,
	userIdSchema,
	userSchema,
} from "../schemas"

const TABLE_NAME = env.USERS_TABLE_NAME

// Generate a new branded UserId via the schema so we never touch the brand with `as`.
const generateUserId = (): UserId => userIdSchema.parse(crypto.randomUUID())

/**
 * Runs each returned item through the Zod schema so that:
 * - Downstream code sees the branded types (DateTimeISO etc.) exactly as declared.
 * - Corrupted or partial rows fail loudly at the boundary instead of leaking `unknown`
 *   shape through `as User`.
 */
const parseUser = (item: unknown): User => userSchema.parse(item)

// Hard cap on findAll() to protect the Lambda from unbounded work when the
// table grows. TODO: for real production usage, replace Scan with:
//  - a Query on a GSI (e.g. tenant/status partition), or
//  - a paginated list API (`?cursor=...&limit=...`) that plumbs `LastEvaluatedKey`
//    through to the client.
const FIND_ALL_HARD_CAP = 10_000

export const userService = {
	async findAll(): Promise<User[]> {
		const items: unknown[] = []
		let lastKey: Record<string, unknown> | undefined

		do {
			const result = await docClient.send(
				new ScanCommand({
					TableName: TABLE_NAME,
					ExclusiveStartKey: lastKey,
				}),
			)
			items.push(...(result.Items ?? []))
			lastKey = result.LastEvaluatedKey
			// Stop at the hard cap rather than silently returning partial data.
			if (items.length >= FIND_ALL_HARD_CAP) break
		} while (lastKey)

		return items.map(parseUser)
	},

	async findById(id: UserId): Promise<User | undefined> {
		const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { id } }))
		return result.Item ? parseUser(result.Item) : undefined
	},

	async create(data: CreateUser): Promise<User> {
		const timestamp = nowAsDateTimeISO()
		const user: User = {
			id: generateUserId(),
			...data,
			createdAt: timestamp,
			updatedAt: timestamp,
		}
		await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: user }))
		return user
	},

	async update(id: UserId, data: UpdateUser): Promise<User | undefined> {
		const existing = await this.findById(id)
		if (!existing) return undefined
		const updated: User = {
			...existing,
			...data,
			updatedAt: nowAsDateTimeISO(),
		}
		try {
			await docClient.send(
				new PutCommand({
					TableName: TABLE_NAME,
					Item: updated,
					// Fail if the record was deleted between our read and this write.
					// NOTE: This does not prevent lost-update races between two concurrent updates
					// (last write wins). For strict lost-update prevention, migrate to
					// UpdateCommand with a `version` attribute or `updatedAt = :prev` check.
					ConditionExpression: "attribute_exists(id)",
				}),
			)
		} catch (err) {
			if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
				return undefined
			}
			throw err
		}
		return updated
	},

	async delete(id: UserId): Promise<boolean> {
		const result = await docClient.send(
			new DeleteCommand({
				TableName: TABLE_NAME,
				Key: { id },
				ReturnValues: "ALL_OLD",
			}),
		)
		return !!result.Attributes
	},
}
