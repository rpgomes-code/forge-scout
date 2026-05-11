/**
 * Shape produced by any `ForgeSource`. Source-agnostic — the orchestrator
 * maps this to the DB row shape (`NewForgeComponent`).
 *
 * All fields except `id`, `slug`, `name`, and the array fields are nullable.
 * Sources should set what they can determine and leave the rest `null` /
 * empty so the orchestrator's upsert preserves prior good values.
 */
export interface ForgeComponentPayload {
	/** Forge component ID — the integer from the Forge URL. */
	id: number;
	/** URL slug, e.g. `outsystems-data-grid-o11`. */
	slug: string;
	/** Human-readable name. */
	name: string;
	/** Full description text. */
	description: string;
	/** Forge category. */
	category: string | null;
	/** Author / publisher. */
	author: string | null;
	/** Rating 0.0–5.0. */
	rating: number | null;
	/** Total downloads. */
	downloads: number;
	/** Compatible platforms (`O11`, `ODC`, or both). */
	platform: Array<string>;
	/** SPDX-ish license identifier. */
	license: string | null;
	/** Curation badges (`Trusted`, `OutSystems Supported`, …). */
	badges: Array<string>;
	/** Linked GitHub repo URL, canonicalized. */
	githubUrl: string | null;
	/** Free-form tags. */
	tags: Array<string>;
	/** Last published / updated date for the component itself. */
	lastUpdated: Date | null;
}

/** Which Forge source we're pulling from on this run. */
export type ForgeSourceMode = "scrape" | "api";

/** What a `ForgeSource.fetchAll` accepts. */
export interface FetchAllOptions {
	/** Stop after this many components (for dev / smoke tests). */
	limit?: number;
	/** Per-request delay in ms (politeness throttle). Default 1000. */
	delayMs?: number;
	/** Logger callback for progress events. */
	onProgress?: (event: ProgressEvent) => void;
}

export type ProgressEvent =
	| { type: "listing"; page: number; collected: number }
	| { type: "detail"; id: number; slug: string }
	| { type: "warn"; message: string };
