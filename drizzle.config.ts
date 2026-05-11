import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required to run drizzle-kit. Add it to .env.local.",
	);
}

/**
 * Mirror the runtime db client (`src/db/index.ts`). Dokploy's default
 * Postgres image has SSL disabled server-side, so we default to no SSL and
 * accept an opt-in toggle via `DATABASE_SSL=true`. When enabled, we accept
 * self-signed certs since most self-hosted Postgres deployments don't have
 * CA-signed certs.
 */
const ssl =
	process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false;

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
		ssl,
	},
});
