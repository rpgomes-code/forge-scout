import * as cheerio from "cheerio";
import { fetchText, sleep } from "./http.ts";
import type { ForgeSource } from "./source.ts";
import type {
	FetchAllOptions,
	ForgeComponentPayload,
	ProgressEvent,
} from "./types.ts";

/** Forge's public sitemap — single XML file listing every component URL. */
const SITEMAP_URL = "https://www.outsystems.com/forge/sitemap.xml";

const DETAIL_URL_BASE = "https://www.outsystems.com/forge/component-overview";

/** Default politeness delay between detail-page fetches. */
const DEFAULT_DELAY_MS = 1000;

interface SitemapEntry {
	id: number;
	slug: string;
}

/**
 * Scrapes `outsystems.com/forge`. Enumeration of components uses the public
 * `/forge/sitemap.xml` (which is ~8.5k entries of plain XML), so we sidestep
 * the JS-loaded listing pages entirely. Each component's detail page is then
 * fetched as plain HTML and parsed with cheerio for the metadata the schema
 * cares about.
 *
 * Why sitemap and not the JS listing:
 * - `/forge/list-asset` only ever renders the top ~17 components, even
 *   under a headless browser scrolling to the bottom — there's no "load
 *   more" mechanic in the DOM.
 * - The sitemap gives us every component URL + slug deterministically.
 *
 * The trade-off is we lose any "most popular first" ordering — the sitemap
 * is lexicographic on the URL. For demo/dev scrapes that's fine; for prod
 * we'd shuffle or sort by some other heuristic.
 */
export class ScrapeForgeSource implements ForgeSource {
	async *fetchAll(opts: FetchAllOptions): AsyncIterable<ForgeComponentPayload> {
		const limit = opts.limit ?? Number.POSITIVE_INFINITY;
		const delayMs = opts.delayMs ?? DEFAULT_DELAY_MS;
		const progress = opts.onProgress ?? noop;

		const entries = await this.fetchSitemapEntries();
		progress({
			type: "listing",
			page: 1,
			collected: entries.length,
		});

		let yielded = 0;
		for (const entry of entries) {
			if (yielded >= limit) break;

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

	private async fetchSitemapEntries(): Promise<Array<SitemapEntry>> {
		const xml = await fetchText(SITEMAP_URL);
		const pattern = /forge\/component-overview\/(\d+)\/([^<\s?#]+)/g;
		const seen = new Set<number>();
		const entries: Array<SitemapEntry> = [];

		for (const match of xml.matchAll(pattern)) {
			const id = Number(match[1]);
			if (!Number.isFinite(id) || seen.has(id)) continue;
			seen.add(id);
			entries.push({ id, slug: match[2] });
		}

		return entries;
	}

	private async fetchDetailPage(
		entry: SitemapEntry,
	): Promise<ForgeComponentPayload> {
		const url = `${DETAIL_URL_BASE}/${entry.id}/${entry.slug}`;
		const html = await fetchText(url);
		const $ = cheerio.load(html);

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

		return {
			id: entry.id,
			slug: entry.slug,
			name: name || entry.slug,
			description,
			category: extractCategory($),
			author: extractAuthor($),
			rating: extractRating($),
			downloads: downloads ?? 0,
			platform: extractPlatforms(html),
			license: extractLicense($),
			badges: extractBadges(html),
			githubUrl: extractGithubUrl(html),
			tags: extractTags($),
			lastUpdated: extractLastUpdated(html),
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
	let license: string | null = null;
	$("span:contains('License')").each((_, el) => {
		const block = $(el).closest("div, section, article");
		const text = block.text().replace(/\s+/g, " ").trim();
		const m = text.match(
			/\b(MIT|BSD-3-Clause|BSD-2-Clause|Apache-2\.0|GPL-2\.0|GPL-3\.0|LGPL-3\.0|MPL-2\.0|EPL-2\.0|Proprietary)\b/,
		);
		if (m && !license) license = m[1];
	});
	return license;
}

function extractCategory($: CheerioAPI): string | null {
	const cat = $("span:contains('Category')").first().parent().next();
	const text = cat.text().replace(/\s+/g, " ").trim();
	return text || null;
}

function extractAuthor($: CheerioAPI): string | null {
	const a = $(".component-title__owner a, .component-title__owner").first();
	const text = a.text().replace(/\s+/g, " ").trim();
	return text || null;
}

function extractRating($: CheerioAPI): number | null {
	const ratingEl = $(".rating-size-m, .stars-rating").first();
	const text = `${ratingEl.text()} ${ratingEl.parent().text()}`;
	const m = text.match(/(\d(?:\.\d{1,2})?)\s*\/?\s*5?/);
	if (!m) return null;
	const n = Number.parseFloat(m[1]);
	return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

/**
 * Extract the release date from the detail page header. The page renders
 * "Uploaded on <DD MMM[ YYYY]>" near the title — we match that pattern
 * directly. We deliberately avoid the page's `data-release` attributes
 * because the "Suggested components" sidebar carries the same attribute
 * and would have us picking the wrong row's date.
 */
function extractLastUpdated(html: string): Date | null {
	const m = html.match(/Uploaded on (\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)/);
	if (!m) return null;
	const d = new Date(m[1]);
	return Number.isFinite(d.getTime()) ? d : null;
}

function extractGithubUrl(html: string): string | null {
	const match = html.match(/https?:\/\/github\.com\/[\w.-]+\/[\w.-]+/i);
	if (!match) return null;
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
