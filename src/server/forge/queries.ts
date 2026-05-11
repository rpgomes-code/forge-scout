import { createServerFn } from "@tanstack/react-start";
import { and, desc, gte, ilike, or, type SQL, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { forgeComponents } from "#/db/schema.ts";

export const searchForgeSchema = z.object({
	/** Free-text query — matched against name, description, slug. */
	q: z.string().default(""),
	/** Filter to components compatible with any of these platforms. */
	platform: z.array(z.string()).optional(),
	/** Filter to components carrying any of these badges. */
	badges: z.array(z.string()).optional(),
	/** Filter to components with rating >= this value. Null ratings excluded. */
	minRating: z.number().min(0).max(5).optional(),
	/** Max rows returned. Capped server-side to avoid runaway queries. */
	limit: z.number().int().positive().max(100).default(15),
});

export type SearchForgeParams = z.infer<typeof searchForgeSchema>;

/**
 * Free-text + filter search over Forge components. Empty inputs return all
 * rows ordered by descending downloads (default "most popular" view).
 *
 * Filter semantics:
 * - `platform` / `badges`: array overlap (`&&`). Selecting multiple values
 *   widens the result set — "show me anything matching ANY of these tags".
 * - `minRating`: `rating >= minRating`. Null ratings are excluded.
 * - `q`: ILIKE over name / description / slug.
 *
 * Postgres handles this volume fine; if cardinality grows we'll switch to
 * a tsvector full-text column for `q` and add GIN indexes on the arrays.
 */
export const searchForgeComponents = createServerFn({ method: "GET" })
	.inputValidator(searchForgeSchema.parse)
	.handler(async ({ data }) => {
		const { q, platform, badges, minRating, limit } = data;
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

		const where = conditions.length > 0 ? and(...conditions) : undefined;

		const query = db.select().from(forgeComponents);
		const filtered = where ? query.where(where) : query;
		return await filtered.orderBy(desc(forgeComponents.downloads)).limit(limit);
	});
