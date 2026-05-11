#!/usr/bin/env tsx
/**
 * Long-running Forge scraper worker. Designed to deploy as its own service
 * (e.g. a Dokploy "Application" with start command `npm run scrape:cron`)
 * so it stays decoupled from the web server.
 *
 * Env knobs:
 *   FORGE_SOURCE     - "scrape" (default) | "api"
 *   FORGE_LIMIT      - cap components per run (default: unlimited)
 *   FORGE_DELAY_MS   - per-request politeness throttle (default: 1000)
 *   CRON_SCHEDULE    - cron expression (default: "0 6,18 * * *" — 06:00 + 18:00 UTC)
 *   CRON_TZ          - timezone (default: UTC)
 *   RUN_ON_BOOT      - "true" to scrape once at startup before scheduling
 */
import { config } from "dotenv";
import cron from "node-cron";

config({ path: [".env.local", ".env"] });

const { runScrape } = await import("../src/server/forge/index.ts");

const source = (process.env.FORGE_SOURCE ?? "scrape") as "scrape" | "api";
const limit = process.env.FORGE_LIMIT
	? Number.parseInt(process.env.FORGE_LIMIT, 10)
	: undefined;
const delayMs = process.env.FORGE_DELAY_MS
	? Number.parseInt(process.env.FORGE_DELAY_MS, 10)
	: undefined;
const schedule = process.env.CRON_SCHEDULE ?? "0 6,18 * * *";
const timezone = process.env.CRON_TZ ?? "UTC";
const runOnBoot = process.env.RUN_ON_BOOT === "true";

if (source !== "scrape" && source !== "api") {
	console.error(`Invalid FORGE_SOURCE="${source}". Use "scrape" or "api".`);
	process.exit(1);
}

if (!cron.validate(schedule)) {
	console.error(`Invalid CRON_SCHEDULE="${schedule}".`);
	process.exit(1);
}

console.log(
	`[cron-forge] starting: schedule="${schedule}" tz=${timezone} source=${source} limit=${
		limit ?? "∞"
	} delay=${delayMs ?? "default"}ms`,
);

let running = false;

async function tick(reason: string): Promise<void> {
	if (running) {
		console.log(`[cron-forge] skip (${reason}) — previous run still in flight`);
		return;
	}
	running = true;
	const startedAt = new Date();
	try {
		console.log(`[cron-forge] tick (${reason}) at ${startedAt.toISOString()}`);
		const result = await runScrape({
			source,
			limit,
			delayMs,
			onProgress: (event) => {
				if (event.type === "warn") {
					console.warn(`[cron-forge] ⚠  ${event.message}`);
				}
			},
		});
		console.log(
			`[cron-forge] done: ${result.status} run=${result.runId} processed=${result.processed} inserted=${result.inserted} updated=${result.updated} errors=${result.errors}`,
		);
	} catch (err) {
		console.error(
			`[cron-forge] tick failed: ${err instanceof Error ? err.message : String(err)}`,
		);
	} finally {
		running = false;
	}
}

const task = cron.schedule(schedule, () => tick("schedule"), { timezone });
task.start();

if (runOnBoot) {
	await tick("boot");
}

function shutdown(signal: NodeJS.Signals): void {
	console.log(`[cron-forge] received ${signal}, shutting down`);
	task.stop();
	process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[cron-forge] scheduled — waiting for ticks. Ctrl-C to stop.");
