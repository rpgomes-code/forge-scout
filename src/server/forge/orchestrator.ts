import { eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import {
	forgeComponents,
	type NewForgeComponent,
	scrapeRuns,
} from "#/db/schema.ts";
import { selectForgeSource } from "./select-source.ts";
import type {
	FetchAllOptions,
	ForgeComponentPayload,
	ForgeSourceMode,
	ProgressEvent,
} from "./types.ts";

export interface RunScrapeOptions {
	/** Which source to pull from. */
	source: ForgeSourceMode;
	/** Optional cap on components processed this run. */
	limit?: number;
	/** Delay between detail requests (ms). Defaults applied inside the source. */
	delayMs?: number;
	/** Progress callback — bridge to logger/CLI/UI. */
	onProgress?: (event: ProgressEvent) => void;
}

export interface RunScrapeResult {
	/** Row id in `scrape_runs`. */
	runId: number;
	source: ForgeSourceMode;
	status: "success" | "failed";
	processed: number;
	inserted: number;
	updated: number;
	errors: number;
	errorMessage: string | null;
	startedAt: Date;
	completedAt: Date;
}

/**
 * Single-run orchestrator. Inserts a `scrape_runs` row, walks the configured
 * source, upserts components, and finalises the run record on the way out.
 * Designed to be called both from the one-shot CLI and the cron entry —
 * those two only differ in how often they invoke this.
 */
export async function runScrape(
	opts: RunScrapeOptions,
): Promise<RunScrapeResult> {
	const startedAt = new Date();

	const [runRow] = await db
		.insert(scrapeRuns)
		.values({ source: opts.source, startedAt, status: "running" })
		.returning();

	if (!runRow) {
		throw new Error(
			"Failed to create scrape_runs row — orchestrator cannot proceed.",
		);
	}

	let processed = 0;
	let inserted = 0;
	let updated = 0;
	let errors = 0;
	let lastError: string | null = null;

	const onProgress = opts.onProgress ?? noop;
	const fetchOpts: FetchAllOptions = {
		limit: opts.limit,
		delayMs: opts.delayMs,
		onProgress: (event) => {
			if (event.type === "warn") {
				errors++;
				lastError = event.message;
			}
			onProgress(event);
		},
	};

	try {
		const source = selectForgeSource(opts.source);
		for await (const component of source.fetchAll(fetchOpts)) {
			processed++;
			try {
				const result = await upsertComponent(component, opts.source);
				if (result === "inserted") inserted++;
				else updated++;
			} catch (err) {
				errors++;
				lastError = err instanceof Error ? err.message : String(err);
				onProgress({
					type: "warn",
					message: `upsert failed for ${component.id}/${component.slug}: ${lastError}`,
				});
			}
		}
	} catch (err) {
		const completedAt = new Date();
		const message = err instanceof Error ? err.message : String(err);
		await db
			.update(scrapeRuns)
			.set({
				status: "failed",
				completedAt,
				componentsProcessed: processed,
				componentsInserted: inserted,
				componentsUpdated: updated,
				errorsCount: errors + 1,
				errorMessage: message,
			})
			.where(eq(scrapeRuns.id, runRow.id));
		return {
			runId: runRow.id,
			source: opts.source,
			status: "failed",
			processed,
			inserted,
			updated,
			errors: errors + 1,
			errorMessage: message,
			startedAt,
			completedAt,
		};
	}

	const completedAt = new Date();
	await db
		.update(scrapeRuns)
		.set({
			status: "success",
			completedAt,
			componentsProcessed: processed,
			componentsInserted: inserted,
			componentsUpdated: updated,
			errorsCount: errors,
			errorMessage: lastError,
		})
		.where(eq(scrapeRuns.id, runRow.id));

	return {
		runId: runRow.id,
		source: opts.source,
		status: "success",
		processed,
		inserted,
		updated,
		errors,
		errorMessage: lastError,
		startedAt,
		completedAt,
	};
}

async function upsertComponent(
	payload: ForgeComponentPayload,
	source: ForgeSourceMode,
): Promise<"inserted" | "updated"> {
	const existing = await db
		.select({ id: forgeComponents.id })
		.from(forgeComponents)
		.where(eq(forgeComponents.id, payload.id))
		.limit(1);

	const row: NewForgeComponent = {
		id: payload.id,
		slug: payload.slug,
		name: payload.name,
		description: payload.description,
		category: payload.category,
		author: payload.author,
		rating: payload.rating,
		downloads: payload.downloads,
		platform: payload.platform,
		license: payload.license,
		badges: payload.badges,
		githubUrl: payload.githubUrl,
		tags: payload.tags,
		lastUpdated: payload.lastUpdated,
		scrapedAt: new Date(),
		source,
	};

	if (existing.length > 0) {
		await db
			.update(forgeComponents)
			.set(row)
			.where(eq(forgeComponents.id, payload.id));
		return "updated";
	}

	await db.insert(forgeComponents).values(row);
	return "inserted";
}

function noop(_event: ProgressEvent): void {}
