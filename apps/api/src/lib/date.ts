import { z } from "@hono/zod-openapi"

// ===== Brand Symbols =====

export const dateISOSym = Symbol("DateISO")
export const dateTimeISOSym = Symbol("DateTimeISO")
export const timeISOSym = Symbol("TimeISO")
export const unixTimestampSym = Symbol("UnixTimestamp")

// ===== Validation Schemas =====

/** ISO 8601 Extended Format (YYYY-MM-DD) */
export const dateISOSchema = z.iso.date().brand(dateISOSym)

/** ISO 8601 DateTime Format (YYYY-MM-DDTHH:mm:ssZ) */
export const dateTimeISOSchema = z.iso.datetime().brand(dateTimeISOSym)

/** ISO 8601 Time Format (HH:MM:SS) */
export const timeISOSchema = z.iso.time().brand(timeISOSym)

/** Unix Timestamp (ミリ秒) */
export const unixTimestampSchema = z.number().int().nonnegative().brand(unixTimestampSym)

// ===== Brand Types =====

/** @example "2024-10-01" */
export type DateISO = z.infer<typeof dateISOSchema>

/** @example "2024-10-01T12:00:00Z" */
export type DateTimeISO = z.infer<typeof dateTimeISOSchema>

/** @example "18:30:00" */
export type TimeISO = z.infer<typeof timeISOSchema>

/** @example 1696118400000 */
export type UnixTimestamp = z.infer<typeof unixTimestampSchema>

// ===== Codecs (ISO string <-> Date) =====

/** DateISO (YYYY-MM-DD) <-> Date */
export const dateISOCodec = z.codec(z.iso.date(), z.date(), {
	decode: (isoString) => new Date(`${isoString}T00:00:00Z`),
	encode: (date) => date.toISOString().split("T")[0],
})

/** DateTimeISO (YYYY-MM-DDTHH:mm:ssZ) <-> Date */
export const dateTimeISOCodec = z.codec(z.iso.datetime(), z.date(), {
	decode: (isoString) => new Date(isoString),
	encode: (date) => date.toISOString(),
})

/** UnixTimestamp (ms) <-> Date */
export const unixTimestampCodec = z.codec(z.number().int().nonnegative(), z.date(), {
	decode: (timestamp) => new Date(timestamp),
	encode: (date) => date.getTime(),
})

// ===== Helpers =====

/**
 * Current time as a branded `DateTimeISO`.
 * Goes through the schema so the brand is preserved without any `as` cast.
 */
export const nowAsDateTimeISO = (): DateTimeISO => dateTimeISOSchema.parse(new Date().toISOString())
