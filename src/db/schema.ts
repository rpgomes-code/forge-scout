import { sql } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	real,
	serial,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

/** Where a component row came from — `scrape` reads HTML, `api` calls the unofficial Forge API. */
export const forgeSource = pgEnum("forge_source", ["scrape", "api"]);

/** Lifecycle state of a single scrape run. */
export const scrapeStatus = pgEnum("scrape_status", [
	"running",
	"success",
	"failed",
]);

// ─────────────────────────────────────────────────────────────────────────────
// forge_components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One row per Forge component. The `id` matches Forge's own component ID
 * (visible in `https://www.outsystems.com/forge/component-overview/{id}/{slug}`).
 */
export const forgeComponents = pgTable(
	"forge_components",
	{
		/** Forge component ID (matches the integer in the Forge URL). */
		id: integer("id").primaryKey(),

		/** URL slug, e.g. `OutSystems-Data-Grid`. */
		slug: text("slug").notNull(),

		/** Human-readable name. */
		name: text("name").notNull(),

		/** Full description text. */
		description: text("description").notNull().default(""),

		/** Forge category, e.g. `UI Component`, `Integration`. */
		category: text("category"),

		/** Author (community member or `OutSystems`). */
		author: text("author"),

		/** Rating 0.0–5.0. Nullable when no ratings yet. */
		rating: real("rating"),

		/** Total download count. */
		downloads: integer("downloads").notNull().default(0),

		/** Compatible platforms (`O11`, `ODC`, or both). */
		platform: text("platform").array().notNull().default(sql`'{}'::text[]`),

		/** SPDX-ish license identifier (e.g. `MIT`, `BSD-3-Clause`, `GPL-2.0`). */
		license: text("license"),

		/** Curation badges, e.g. `Trusted`, `OutSystems Supported`. */
		badges: text("badges").array().notNull().default(sql`'{}'::text[]`),

		/** Linked GitHub repo URL, canonicalized to `https://github.com/{owner}/{repo}`. */
		githubUrl: text("github_url"),

		/** Free-form tags from the Forge listing. */
		tags: text("tags").array().notNull().default(sql`'{}'::text[]`),

		/** Last published / updated date for the component itself. */
		lastUpdated: timestamp("last_updated", { withTimezone: true }),

		/** When this row was last refreshed from the upstream source. */
		scrapedAt: timestamp("scraped_at", { withTimezone: true })
			.notNull()
			.defaultNow(),

		/** How this row was obtained — `scrape` (HTML) or `api`. */
		source: forgeSource("source").notNull(),
	},
	(table) => [
		uniqueIndex("forge_components_slug_idx").on(table.slug),
		index("forge_components_category_idx").on(table.category),
		index("forge_components_license_idx").on(table.license),
		index("forge_components_rating_idx").on(table.rating),
		index("forge_components_downloads_idx").on(table.downloads),
		index("forge_components_last_updated_idx").on(table.lastUpdated),
	],
);

// ─────────────────────────────────────────────────────────────────────────────
// github_health — cached snapshots of GitHub repo signals
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cached snapshot of repo health signals. Refreshed on demand when
 * `expiresAt` is in the past. Keyed by the canonical repo URL so multiple
 * Forge components pointing at the same repo share one cache row.
 */
export const githubHealth = pgTable(
	"github_health",
	{
		/** Canonicalized repo URL — `https://github.com/{owner}/{repo}`. */
		repoUrl: text("repo_url").primaryKey(),

		/** Owner / org segment. */
		owner: text("owner").notNull(),

		/** Repo segment. */
		repo: text("repo").notNull(),

		/** Star count at fetch time. */
		stars: integer("stars").notNull().default(0),

		/** Fork count at fetch time. */
		forks: integer("forks").notNull().default(0),

		/** Open issue count at fetch time. */
		openIssues: integer("open_issues").notNull().default(0),

		/** Default branch (e.g. `main`, `master`). */
		defaultBranch: text("default_branch"),

		/** SPDX license identifier reported by GitHub's repo metadata. */
		spdxLicense: text("spdx_license"),

		/** Most recent push to any branch. */
		lastPushAt: timestamp("last_push_at", { withTimezone: true }),

		/** Date of the latest commit on the default branch. */
		lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),

		/** When this row was last fetched from GitHub. */
		fetchedAt: timestamp("fetched_at", { withTimezone: true })
			.notNull()
			.defaultNow(),

		/** Refetch when current time passes this. */
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
	},
	(table) => [index("github_health_expires_at_idx").on(table.expiresAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// scrape_runs — audit log of every scraper run
// ─────────────────────────────────────────────────────────────────────────────

/** One row per scrape invocation. Lets us see history and debug failures. */
export const scrapeRuns = pgTable(
	"scrape_runs",
	{
		id: serial("id").primaryKey(),

		/** Which data source was attempted this run. */
		source: forgeSource("source").notNull(),

		/** Current lifecycle state. */
		status: scrapeStatus("status").notNull().default("running"),

		startedAt: timestamp("started_at", { withTimezone: true })
			.notNull()
			.defaultNow(),

		/** Set when the run finishes (success or failure). */
		completedAt: timestamp("completed_at", { withTimezone: true }),

		/** Components seen this run, total. */
		componentsProcessed: integer("components_processed").notNull().default(0),

		/** New rows inserted into `forge_components`. */
		componentsInserted: integer("components_inserted").notNull().default(0),

		/** Existing rows updated. */
		componentsUpdated: integer("components_updated").notNull().default(0),

		/** Count of components that hit an error during processing. */
		errorsCount: integer("errors_count").notNull().default(0),

		/** Captured error message when status is `failed`. */
		errorMessage: text("error_message"),
	},
	(table) => [index("scrape_runs_started_at_idx").on(table.startedAt)],
);

// ─────────────────────────────────────────────────────────────────────────────
// Inferred row types — prefer these in app code over raw DB shapes
// ─────────────────────────────────────────────────────────────────────────────

export type ForgeComponent = typeof forgeComponents.$inferSelect;
export type NewForgeComponent = typeof forgeComponents.$inferInsert;

export type GitHubHealth = typeof githubHealth.$inferSelect;
export type NewGitHubHealth = typeof githubHealth.$inferInsert;

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type NewScrapeRun = typeof scrapeRuns.$inferInsert;
