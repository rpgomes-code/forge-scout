import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";

/**
 * Drizzle Postgres client.
 *
 * Module-load-time evaluation: importing this from client code (where
 * `process.env.DATABASE_URL` is undefined) will throw immediately. That's
 * intentional — the db client must only be reached from server contexts.
 */
function getDatabaseUrl(): string {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error(
			"DATABASE_URL is not set. Add it to .env.local before using the db client.",
		);
	}
	return url;
}

export const db = drizzle(getDatabaseUrl(), { schema });
