import { createServerFn } from "@tanstack/react-start";
import { desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { forgeComponents } from "#/db/schema.ts";

export const searchForgeSchema = z.object({
	/** Free-text query — matched against name, description, slug. */
	q: z.string().default(""),
	/** Max rows returned. Capped server-side to avoid runaway queries. */
	limit: z.number().int().positive().max(100).default(15),
});

export type SearchForgeParams = z.infer<typeof searchForgeSchema>;

/**
 * Free-text search over Forge components. Empty query returns all rows by
 * descending downloads — gives a useful "most popular" view as the default.
 *
 * Case-insensitive ILIKE on three columns. Postgres handles this fine for
 * our row count; if cardinality grows we'll switch to a tsvector column.
 */
export const searchForgeComponents = createServerFn({ method: "GET" })
	.inputValidator(searchForgeSchema.parse)
	.handler(async ({ data }) => {
		const { q, limit } = data;
		const trimmed = q.trim();

		const base = db
			.select()
			.from(forgeComponents)
			.orderBy(desc(forgeComponents.downloads))
			.limit(limit);

		if (!trimmed) return await base;

		const pattern = `%${trimmed}%`;
		return await base.where(
			or(
				ilike(forgeComponents.name, pattern),
				ilike(forgeComponents.description, pattern),
				ilike(forgeComponents.slug, pattern),
			),
		);
	});
