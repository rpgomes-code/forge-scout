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
 * Decide pg's `ssl` option from `DATABASE_SSL` env.
 *
 * The Dokploy Postgres template image (`postgres:17`) ships with SSL
 * **disabled** server-side, so any client SSL attempt errors with "The
 * server does not support SSL connections." We default to no SSL and
 * surface an opt-in env var so the toggle is a config change — not a
 * code change — once the server has TLS configured.
 *
 * When enabled, we use `rejectUnauthorized: false` (libpq's
 * `sslmode=require` semantics) because typical self-hosted Postgres
 * deployments use self-signed certs. Flip to `true` once you're behind a
 * CA-signed cert.
 */
function getSslOption(): false | { rejectUnauthorized: false } {
	return process.env.DATABASE_SSL === "true"
		? { rejectUnauthorized: false }
		: false;
}

const pool = new Pool({
	connectionString: getDatabaseUrl(),
	ssl: getSslOption(),
});

export const db = drizzle(pool, { schema });
