import * as cheerio from "cheerio";
import { fetchText, sleep } from "./http.ts";
import type { ForgeSource } from "./source.ts";
import type {
	FetchAllOptions,
	ForgeComponentPayload,
	ProgressEvent,
} from "./types.ts";

const LISTING_URL = "https://www.outsystems.com/forge/list-asset";
const DETAIL_URL = "https://www.outsystems.com/forge/component-overview";

/** Default listing sort. `most-popular` covers our high-value rows first. */
const DEFAULT_SORT = "most-popular";

/** Default politeness delay between requests. */
const DEFAULT_DELAY_MS = 1000;

interface ListingEntry {
	id: number;
	slug: string;
	/** `data-release` from the listing card, e.g. "10 May 2026". */
	releaseDateText: string | null;
}

/**
 * Scrapes `outsystems.com/forge` HTML directly. The Forge has no first-party
 * API; the listing pages embed enough structured data (component cards with
 * `data-*` attributes and stable URL slugs) to enumerate components, then
 * each detail page exposes the metadata fields the schema cares about.
 */
export class ScrapeForgeSource implements ForgeSource {
	async *fetchAll(opts: FetchAllOptions): AsyncIterable<ForgeComponentPayload> {
		const limit = opts.limit ?? Number.POSITIVE_INFINITY;
		const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
		const progress = opts.onProgress ?? noop;

		const seen = new Set<number>();
		let yielded = 0;

		for (let page = 1; yielded < limit; page++) {
			const entries = await this.fetchListingPage(page);
			if (entries.length === 0) break; // ran out of components

			progress({ type: "listing", page, collected: entries.length });

			for (const entry of entries) {
				if (yielded >= limit) break;
				if (seen.has(entry.id)) continue;
				seen.add(entry.id);

				progress({ type: "detail", id: entry.id, slug: entry.slug });

				try {
					const detail = await this.fetchDetailPage(entry);
					yielded++;
					yield detail;
				} catch (err) {
					progress({
						type: "warn",
						message: `detail fetch failed for ${entry.id}/${entry.slug}: ${
							err instanceof Error ? err.message : String(err)
						}`,
					});
				}

				if (yielded < limit) await sleep(delayMs);
			}
		}
	}

	private async fetchListingPage(page: number): Promise<Array<ListingEntry>> {
		const url = `${LISTING_URL}?q=&t=&s=${DEFAULT_SORT}&pi=${page}`;
		const html = await fetchText(url);
		const $ = cheerio.load(html);

		// Component links look like
		//   https://www.outsystems.com/forge/component-overview/{id}/{slug}
		const found = new Map<number, ListingEntry>();
		$("a[href*='/forge/component-overview/']").each((_, el) => {
			const $el = $(el);
			const href = $el.attr("href");
			if (!href) return;
			const match = href.match(/\/forge\/component-overview\/(\d+)\/([^/?#]+)/);
			if (!match) return;
			const id = Number(match[1]);
			const slug = match[2];
			if (Number.isFinite(id) && !found.has(id)) {
				found.set(id, {
					id,
					slug,
					releaseDateText: $el.attr("data-release") ?? null,
				});
			}
		});

		return Array.from(found.values());
	}

	private async fetchDetailPage(
		entry: ListingEntry,
	): Promise<ForgeComponentPayload> {
		const url = `${DETAIL_URL}/${entry.id}/${entry.slug}`;
		const html = await fetchText(url);
		const $ = cheerio.load(html);

		// Final slug may differ from the listing slug — Forge redirects to the
		// canonical one (e.g. `data-grid` → `outsystems-data-grid-o11`). We
		// keep the listing slug since we already have it; if anything diverges
		// the next scrape will reconcile.

		const name = textOf($, "h1, .component-title h2, .component-title h1")
			.split("\n")[0]
			.trim();

		const description = textOf(
			$,
			"[id$='DetailsContent'], .component-overview-description, meta[name='description']",
		);

		const downloads = parseIntFromText(
			textOf($, "span[id$='wtDownloads'], span[id$='_wtDownloads']"),
		);

		const platform = extractPlatforms(html);
		const badges = extractBadges(html);
		const license = extractLicense($);
		const category = extractCategory($);
		const author = extractAuthor($);
		const rating = extractRating($);
		const lastUpdated =
			parseReleaseDate(entry.releaseDateText) ?? extractLastUpdated($);
		const githubUrl = extractGithubUrl(html);
		const tags = extractTags($);

		return {
			id: entry.id,
			slug: entry.slug,
			name: name || entry.slug,
			description,
			category,
			author,
			rating,
			downloads: downloads ?? 0,
			platform,
			license,
			badges,
			githubUrl,
			tags,
			lastUpdated,
		};
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type CheerioAPI = ReturnType<typeof cheerio.load>;

function noop(_event: ProgressEvent): void {}

function textOf($: CheerioAPI, selector: string): string {
	const el = $(selector).first();
	if (el.length === 0) return "";
	// meta tags carry value in content attribute
	if (el.is("meta")) return el.attr("content")?.trim() ?? "";
	return el.text().replace(/\s+/g, " ").trim();
}

function parseIntFromText(text: string | null | undefined): number | null {
	if (!text) return null;
	const digits = text.replace(/[^0-9]/g, "");
	if (!digits) return null;
	const n = Number.parseInt(digits, 10);
	return Number.isFinite(n) ? n : null;
}

function extractPlatforms(html: string): Array<string> {
	const platforms = new Set<string>();
	// Forge platform tags appear as "OutSystems 11", "ODC", "O11" depending on UI
	if (/outsystems\s*11|\bO11\b/i.test(html)) platforms.add("O11");
	if (/\bODC\b/i.test(html)) platforms.add("ODC");
	return Array.from(platforms);
}

function extractBadges(html: string): Array<string> {
	const badges = new Set<string>();
	if (/os-supported-color[^>]*>\s*Supported/i.test(html))
		badges.add("OutSystems Supported");
	if (/\bTrusted\b/i.test(html)) badges.add("Trusted");
	return Array.from(badges);
}

function extractLicense($: CheerioAPI): string | null {
	// License section header is "License (version)"; the value typically
	// follows in a nearby block.
	let license: string | null = null;
	$("span:contains('License')").each((_, el) => {
		const block = $(el).closest("div, section, article");
		const text = block.text().replace(/\s+/g, " ").trim();
		// Match SPDX-style identifiers commonly used on Forge.
		const m = text.match(
			/\b(MIT|BSD-3-Clause|BSD-2-Clause|Apache-2\.0|GPL-2\.0|GPL-3\.0|LGPL-3\.0|MPL-2\.0|EPL-2\.0|Proprietary)\b/,
		);
		if (m && !license) license = m[1];
	});
	return license;
}

function extractCategory($: CheerioAPI): string | null {
	// Category appears below a "Category" label.
	const cat = $("span:contains('Category')").first().parent().next();
	const text = cat.text().replace(/\s+/g, " ").trim();
	return text || null;
}

function extractAuthor($: CheerioAPI): string | null {
	// Author is the link under `.component-title__owner`.
	const a = $(".component-title__owner a, .component-title__owner").first();
	const text = a.text().replace(/\s+/g, " ").trim();
	return text || null;
}

function extractRating($: CheerioAPI): number | null {
	// Rating widget exposes a numeric score nearby. Look for the first
	// number in `.rating-size-m` neighbourhood.
	const ratingEl = $(".rating-size-m, .stars-rating").first();
	const text = ratingEl.text() + " " + ratingEl.parent().text();
	const m = text.match(/(\d(?:\.\d{1,2})?)\s*\/?\s*5?/);
	if (!m) return null;
	const n = Number.parseFloat(m[1]);
	return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

function extractLastUpdated($: CheerioAPI): Date | null {
	// Fallback: look for a `data-release` attribute somewhere on the page.
	return parseReleaseDate($("[data-release]").first().attr("data-release"));
}

function parseReleaseDate(text: string | null | undefined): Date | null {
	if (!text) return null;
	const d = new Date(text);
	return Number.isFinite(d.getTime()) ? d : null;
}

function extractGithubUrl(html: string): string | null {
	const match = html.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i);
	if (!match) return null;
	// Trim any trailing punctuation captured.
	return match[0].replace(/[.,;:!?)\]}'"]+$/, "");
}

function extractTags($: CheerioAPI): Array<string> {
	const tags = new Set<string>();
	$(".tag, [class*='tag-']").each((_, el) => {
		const t = $(el).text().replace(/\s+/g, " ").trim();
		if (t && t.length <= 40) tags.add(t);
	});
	return Array.from(tags);
}
