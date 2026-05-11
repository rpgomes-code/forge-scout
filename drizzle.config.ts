import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error(
		"DATABASE_URL is required to run drizzle-kit. Add it to .env.local.",
	);
}

export default defineConfig({
	out: "./drizzle",
	schema: "./src/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
		// Mirror the runtime db client: encrypt without verifying the
		// self-signed cert Dokploy's Postgres image ships with. Setting
		// `sslmode=require` in the URL is intentionally avoided — `pg` v8
		// treats it as `verify-full` and the connection hangs.
		ssl: { rejectUnauthorized: false },
	},
});
