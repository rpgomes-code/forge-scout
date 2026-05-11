import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.ts";

/**
 * Postgres connection string. Reads from `DATABASE_URL` at module-load time.
 *
 * Importing this file from client code (where `process.env.DATABASE_URL` is
 * undefined) will throw immediately — the db client must only be reached
 * from server contexts.
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

/**
 * Encrypt traffic without verifying the cert chain — equivalent to libpq's
 * `sslmode=require`. Dokploy's Postgres image ships with a self-signed cert,
 * so chain verification fails. Putting `sslmode=require` in the URL doesn't
 * work either: `pg` v8 treats it as `verify-full`. Programmatic config is
 * the canonical way.
 *
 * Flip `rejectUnauthorized` to `true` once we deploy behind a Postgres with
 * a CA-signed cert.
 */
const pool = new Pool({
	connectionString: getDatabaseUrl(),
	ssl: { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
