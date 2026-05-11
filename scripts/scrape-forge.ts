#!/usr/bin/env tsx
/**
 * One-shot Forge scrape.
 *
 *   $ npm run scrape
 *   $ FORGE_LIMIT=10 FORGE_SOURCE=scrape npm run scrape
 *
 * Reads env from `.env.local` (then `.env`). Same env vars accepted as the
 * cron worker — they share the orchestrator.
 */
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const { runScrape } = await import("../src/server/forge/index.ts");

const source = (process.env.FORGE_SOURCE ?? "scrape") as "scrape" | "api";
const limit = process.env.FORGE_LIMIT
	? Number.parseInt(process.env.FORGE_LIMIT, 10)
	: undefined;
const delayMs = process.env.FORGE_DELAY_MS
	? Number.parseInt(process.env.FORGE_DELAY_MS, 10)
	: undefined;

if (source !== "scrape" && source !== "api") {
	console.error(`Invalid FORGE_SOURCE="${source}". Use "scrape" or "api".`);
	process.exit(1);
}

console.log(
	`[scrape-forge] source=${source} limit=${limit ?? "∞"} delay=${
		delayMs ?? "default"
	}ms`,
);

const result = await runScrape({
	source,
	limit,
	delayMs,
	onProgress: (event) => {
		switch (event.type) {
			case "listing":
				console.log(
					`[scrape-forge]   listing page ${event.page} → ${event.collected} entries`,
				);
				break;
			case "detail":
				console.log(`[scrape-forge]   fetch ${event.id}/${event.slug}`);
				break;
			case "warn":
				console.warn(`[scrape-forge]   ⚠  ${event.message}`);
				break;
		}
	},
});

console.log(
	`[scrape-forge] done: ${result.status} run=${result.runId} processed=${result.processed} inserted=${result.inserted} updated=${result.updated} errors=${result.errors}`,
);

if (result.status === "failed") {
	console.error(`[scrape-forge] failure: ${result.errorMessage}`);
	process.exit(1);
}
