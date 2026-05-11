import { eq } from "drizzle-orm";
import { db } from "#/db/index.ts";
import { type GitHubHealth, githubHealth } from "#/db/schema.ts";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const USER_AGENT =
	"ForgeScout/0.1 (+https://github.com/rpgomes-code/forge-scout)";

/**
 * Fetch repo health (stars, forks, open issues, last push/commit, license)
 * from GitHub. Two-tier cache:
 *
 * 1. Postgres (`github_health` table). Rows live for 1h via `expires_at`.
 *    Shared across users; survives server restarts.
 * 2. React Query on the client (configured by the caller). 1h staleTime
 *    mirrors the DB cache.
 *
 * Failed lookups return `null` and are NOT cached — a transient failure
 * shouldn't be sticky for an hour.
 *
 * IMPORTANT: this module is server-only. It is intentionally NOT imported
 * by anything in the client tree. The server function in `./queries.ts`
 * dynamic-imports it inside the handler so the `db` / drizzle / pg chain
 * stays out of the client bundle.
 */
export async function fetchAndCacheGitHubHealth(
	repoUrl: string,
): Promise<GitHubHealth | null> {
	const canonical = canonicalizeRepoUrl(repoUrl);
	if (!canonical) return null;

	// 1. Cache hit?
	const cached = await db
		.select()
		.from(githubHealth)
		.where(eq(githubHealth.repoUrl, canonical))
		.limit(1);
	const row = cached[0];
	if (row && row.expiresAt > new Date()) {
		return row;
	}

	// 2. Cache miss → fetch from GitHub.
	const parsed = parseOwnerRepo(canonical);
	if (!parsed) return null;

	const fresh = await fetchFromGitHub(parsed.owner, parsed.repo);
	if (!fresh) return null;

	const now = new Date();
	const expires = new Date(Date.now() + CACHE_TTL_MS);
	const next: GitHubHealth = {
		repoUrl: canonical,
		owner: parsed.owner,
		repo: parsed.repo,
		stars: fresh.stars,
		forks: fresh.forks,
		openIssues: fresh.openIssues,
		defaultBranch: fresh.defaultBranch,
		spdxLicense: fresh.spdxLicense,
		lastPushAt: fresh.lastPushAt,
		lastCommitAt: fresh.lastCommitAt,
		fetchedAt: now,
		expiresAt: expires,
	};

	await db.insert(githubHealth).values(next).onConflictDoUpdate({
		target: githubHealth.repoUrl,
		set: next,
	});

	return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function canonicalizeRepoUrl(input: string): string | null {
	try {
		const url = new URL(input);
		if (url.hostname.toLowerCase() !== "github.com") return null;

		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length < 2) return null;
		const owner = segments[0];
		const repo = segments[1].replace(/\.git$/i, "");
		if (!owner || !repo) return null;

		return `https://github.com/${owner}/${repo}`;
	} catch {
		return null;
	}
}

function parseOwnerRepo(
	canonical: string,
): { owner: string; repo: string } | null {
	const m = canonical.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/);
	if (!m) return null;
	return { owner: m[1], repo: m[2] };
}

interface GitHubData {
	stars: number;
	forks: number;
	openIssues: number;
	defaultBranch: string | null;
	spdxLicense: string | null;
	lastPushAt: Date | null;
	lastCommitAt: Date | null;
}

async function fetchFromGitHub(
	owner: string,
	repo: string,
): Promise<GitHubData | null> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": USER_AGENT,
	};
	const token = process.env.GITHUB_TOKEN;
	if (token) headers.Authorization = `Bearer ${token}`;

	const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
	const repoRes = await fetch(repoUrl, {
		headers,
		signal: AbortSignal.timeout(15_000),
	});
	if (!repoRes.ok) return null;

	const repoJson = (await repoRes.json()) as {
		stargazers_count?: number;
		forks_count?: number;
		open_issues_count?: number;
		default_branch?: string;
		license?: { spdx_id?: string | null } | null;
		pushed_at?: string | null;
	};

	// Latest commit on default branch — best-effort.
	let lastCommitAt: Date | null = null;
	try {
		const commitsRes = await fetch(`${repoUrl}/commits?per_page=1`, {
			headers,
			signal: AbortSignal.timeout(15_000),
		});
		if (commitsRes.ok) {
			const commits = (await commitsRes.json()) as Array<{
				commit?: { author?: { date?: string } };
			}>;
			const iso = commits[0]?.commit?.author?.date;
			if (iso) {
				const d = new Date(iso);
				if (Number.isFinite(d.getTime())) lastCommitAt = d;
			}
		}
	} catch {
		// swallow — best-effort
	}

	const lastPushAt = repoJson.pushed_at ? new Date(repoJson.pushed_at) : null;

	return {
		stars: repoJson.stargazers_count ?? 0,
		forks: repoJson.forks_count ?? 0,
		openIssues: repoJson.open_issues_count ?? 0,
		defaultBranch: repoJson.default_branch ?? null,
		spdxLicense:
			repoJson.license?.spdx_id && repoJson.license.spdx_id !== "NOASSERTION"
				? repoJson.license.spdx_id
				: null,
		lastPushAt:
			lastPushAt && Number.isFinite(lastPushAt.getTime()) ? lastPushAt : null,
		lastCommitAt,
	};
}
