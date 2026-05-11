import { createServerFn } from "@tanstack/react-start";
import {
	and,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	or,
	type SQL,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { type ForgeComponent, forgeComponents } from "#/db/schema.ts";

/**
 * Cursor for infinite scroll. We sort by `(downloads desc, id desc)` so
 * the cursor needs both columns to give a stable, unambiguous "after this
 * row" point — two components can share a download count.
 */
export const cursorSchema = z.object({
	downloads: z.number().int().nonnegative(),
	id: z.number().int().positive(),
});

export type ForgeCursor = z.infer<typeof cursorSchema>;

export const searchForgeSchema = z.object({
	/** Free-text query — matched against name, description, slug. */
	q: z.string().default(""),
	/** Filter to components compatible with any of these platforms. */
	platform: z.array(z.string()).optional(),
	/** Filter to components carrying any of these badges. */
	badges: z.array(z.string()).optional(),
	/** Filter to components with rating >= this value. Null ratings excluded. */
	minRating: z.number().min(0).max(5).optional(),
	/** Page cursor — `null`/omitted for the first page. */
	cursor: cursorSchema.nullable().optional(),
	/** Page size. Capped server-side. */
	limit: z.number().int().positive().max(50).default(15),
});

export type SearchForgeParams = z.infer<typeof searchForgeSchema>;

export interface SearchForgeResult {
	items: Array<ForgeComponent>;
	/** `null` when there are no more pages. */
	nextCursor: ForgeCursor | null;
}

/**
 * Paged free-text + filter search over Forge components. Each call returns
 * one page plus a cursor for the next page.
 *
 * Ordering: `downloads DESC, id DESC`. Most-popular first; `id` is the
 * tie-breaker so the cursor is unambiguous when two components share a
 * download count.
 *
 * Filter semantics are the same as before — see `searchForgeSchema`.
 */
export const searchForgeComponents = createServerFn({ method: "GET" })
	.inputValidator(searchForgeSchema.parse)
	.handler(async ({ data }): Promise<SearchForgeResult> => {
		const { q, platform, badges, minRating, cursor, limit } = data;
		const conditions: Array<SQL> = [];

		const trimmed = q.trim();
		if (trimmed) {
			const pattern = `%${trimmed}%`;
			const text = or(
				ilike(forgeComponents.name, pattern),
				ilike(forgeComponents.description, pattern),
				ilike(forgeComponents.slug, pattern),
			);
			if (text) conditions.push(text);
		}

		if (platform && platform.length > 0) {
			conditions.push(
				sql`${forgeComponents.platform} && ARRAY[${sql.join(
					platform.map((value) => sql`${value}`),
					sql`, `,
				)}]::text[]`,
			);
		}

		if (badges && badges.length > 0) {
			conditions.push(
				sql`${forgeComponents.badges} && ARRAY[${sql.join(
					badges.map((value) => sql`${value}`),
					sql`, `,
				)}]::text[]`,
			);
		}

		if (minRating !== undefined && minRating > 0) {
			conditions.push(gte(forgeComponents.rating, minRating));
		}

		if (cursor) {
			// (downloads, id) < (cursor.downloads, cursor.id) — Postgres tuple
			// comparison gives us the "strictly after this row in (desc, desc)
			// order" semantics in a single index-friendly predicate.
			conditions.push(
				sql`(${forgeComponents.downloads}, ${forgeComponents.id}) < (${cursor.downloads}, ${cursor.id})`,
			);
		}

		const where = conditions.length > 0 ? and(...conditions) : undefined;

		// Fetch one extra row so we can tell whether there's another page
		// without a second COUNT query.
		const query = db
			.select()
			.from(forgeComponents)
			.orderBy(desc(forgeComponents.downloads), desc(forgeComponents.id))
			.limit(limit + 1);
		const rows = await (where ? query.where(where) : query);

		const hasMore = rows.length > limit;
		const items = hasMore ? rows.slice(0, limit) : rows;
		const last = items[items.length - 1];
		const nextCursor: ForgeCursor | null =
			hasMore && last ? { downloads: last.downloads, id: last.id } : null;

		return { items, nextCursor };
	});

// ─────────────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────────────

const detailSchema = z.object({
	id: z.number().int().positive(),
});

/**
 * Look up one component by its Forge id. Returns `null` when no such row
 * exists — the route loader translates that into a notFound() response so
 * the rest of the app can rely on a non-null value.
 */
export const getForgeComponent = createServerFn({ method: "GET" })
	.inputValidator(detailSchema.parse)
	.handler(async ({ data }): Promise<ForgeComponent | null> => {
		const rows = await db
			.select()
			.from(forgeComponents)
			.where(eq(forgeComponents.id, data.id))
			.limit(1);
		return rows[0] ?? null;
	});

const batchSchema = z.object({
	ids: z.array(z.number().int().positive()).min(1).max(10),
});

/**
 * Batch lookup preserving request order. Used by the /compare route to
 * fetch 2-4 components in one round trip. Missing IDs come back as `null`
 * in the matching slot so the consumer can render a placeholder column.
 */
export const getForgeComponentsByIds = createServerFn({ method: "GET" })
	.inputValidator(batchSchema.parse)
	.handler(async ({ data }): Promise<Array<ForgeComponent | null>> => {
		const rows = await db
			.select()
			.from(forgeComponents)
			.where(inArray(forgeComponents.id, data.ids));
		const byId = new Map(rows.map((row) => [row.id, row]));
		return data.ids.map((id) => byId.get(id) ?? null);
	});
