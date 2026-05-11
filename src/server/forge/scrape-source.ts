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
			license: extractLicense(html, $),
			badges: extractBadges(html),
			githubUrl: extractGithubUrl(html),
			tags: extractTags($),
			lastUpdated: extractLastUpdated($),
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

/**
 * Forge components that declare a license link out to opensource.org/licenses/X,
 * where X is the canonical SPDX identifier. That URL is the most reliable
 * signal — the human-readable label often says "BSD-3 license" or "GPL v2"
 * which don't match SPDX strings directly. Fall back to scanning for an
 * explicit SPDX identifier inside the License section if no URL is present.
 */
function extractLicense(html: string, $: CheerioAPI): string | null {
	const urlMatch = html.match(
		/opensource\.org\/licenses\/([A-Za-z0-9.+-]+?)(?=[)"'<\s]|$)/,
	);
	if (urlMatch) return urlMatch[1];

	// Locate the "License" header, then read the immediately-following value.
	let license: string | null = null;
	$("span").each((_, el) => {
		if ($(el).text().trim() !== "License") return;
		const parent = $(el).closest("div");
		const valueBlock = parent.parent().next();
		const text = valueBlock.text().replace(/\s+/g, " ").trim();
		const m = text.match(
			/\b(MIT|BSD-?3-?Clause|BSD-?2-?Clause|Apache-?2\.0|GPL-?2\.0|GPL-?3\.0|LGPL-?3\.0|MPL-?2\.0|EPL-?2\.0|Proprietary)\b/i,
		);
		if (m) {
			license = m[1];
			return false;
		}
	});
	return license;
}

/**
 * Category is rendered as a `.forge-line` block whose `.forge-line__content`
 * contains the literal text "Category"; the value sits in the immediately-
 * following sibling. We search for the header text strictly so we don't
 * grab "Categories" or unrelated `<span>` with "Category" inside.
 */
function extractCategory($: CheerioAPI): string | null {
	let category: string | null = null;
	$(".forge-line__content").each((_, el) => {
		if ($(el).text().trim() !== "Category") return;
		const value = $(el).closest(".forge-line").next();
		const text = value.text().replace(/\s+/g, " ").trim();
		if (text) category = text;
		return false;
	});
	return category;
}

/**
 * Author lives inside `.TabletPublishedBy` in the header — a tight element
 * next to "Uploaded on …". Two renderings exist:
 *
 *   - Plain text:    `<span>OutSystems</span>`
 *   - Profile link:  `<input type="submit" value="Guilherme Pereira"
 *                       onclick="window.location.href='…/profile/X/overview'">`
 *
 * Cheerio's `.text()` skips input `value=` attributes, so we check that
 * shape first and fall back to text.
 */
function extractAuthor($: CheerioAPI): string | null {
	const el = $(".TabletPublishedBy").first();
	if (el.length === 0) return null;

	const inputValue = el.find("input[type='submit']").first().attr("value");
	if (inputValue?.trim()) return inputValue.trim();

	const text = el.text().replace(/\s+/g, " ").trim();
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
 * "Uploaded on <span>DD MMM[ YYYY] (X days ago)</span>" — running a regex
 * on the raw HTML misses it because the text is split across tags
 * (`Uploaded<div> on <span>…`). Pull the text from the title-owner block
 * via cheerio (which collapses nested text cleanly) and regex from there.
 * `data-release` attributes are deliberately avoided — the suggested-
 * components sidebar carries them too and we'd pick the wrong row's date.
 */
function extractLastUpdated($: CheerioAPI): Date | null {
	const owner = $(".component-title__owner");
	if (owner.length === 0) return null;
	const text = owner.text().replace(/\s+/g, " ");
	const m = text.match(/Uploaded on (\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{4}))?/);
	if (!m) return null;

	const day = Number.parseInt(m[1], 10);
	const monthName = m[2];
	const explicitYear = m[3] ? Number.parseInt(m[3], 10) : null;

	// Append the year before constructing Date — `new Date("27 Apr")` resolves
	// to year 2001 in Node (implementation-defined for year-less inputs).
	const candidateYear = explicitYear ?? new Date().getUTCFullYear();
	const dateStr = `${day} ${monthName} ${candidateYear}`;
	let d = new Date(dateStr);
	if (!Number.isFinite(d.getTime())) return null;

	// If the year wasn't in the text and we assumed "this year", but that
	// puts the date >30 days in the future, the upload must actually be last
	// year — Forge wouldn't surface "Uploaded on <future date>".
	if (explicitYear === null && d.getTime() > Date.now() + 30 * 86_400_000) {
		d = new Date(`${day} ${monthName} ${candidateYear - 1}`);
		if (!Number.isFinite(d.getTime())) return null;
	}
	return d;
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
