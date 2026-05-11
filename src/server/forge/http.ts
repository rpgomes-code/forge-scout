const USER_AGENT =
	"ForgeScout/0.1 (+https://github.com/rpgomes-code/forge-scout)";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 800;

export interface FetchTextOptions {
	/** Per-request timeout. Covers the body read too, not just headers. */
	timeoutMs?: number;
	/** Override max attempts (default 4). */
	maxAttempts?: number;
}

/**
 * GET a URL as text with timeouts, retries, and exponential backoff.
 *
 * The timeout covers the full request, including reading the body — using
 * `AbortSignal.timeout` propagates the signal to the response stream so a
 * stalled body read aborts cleanly. Previously we cleared the timer right
 * after the headers came back, which meant `res.text()` could hang
 * indefinitely on a slow stream (one component took the whole scrape down).
 *
 * Retries on network errors and HTTP 5xx / 429. Bails on 4xx (other than
 * 429) — those are permanent. Honours `Retry-After` on 429.
 */
export async function fetchText(
	url: string,
	opts: FetchTextOptions = {},
): Promise<string> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;

	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const res = await fetch(url, {
				headers: {
					"User-Agent": USER_AGENT,
					Accept: "text/html,application/xml,*/*",
				},
				signal: AbortSignal.timeout(timeoutMs),
				redirect: "follow",
			});

			if (res.ok) {
				return await res.text();
			}

			// 4xx (not 429) is permanent — don't retry.
			if (res.status >= 400 && res.status < 500 && res.status !== 429) {
				throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
			}

			// 429 / 5xx — back off and retry.
			const retryAfterHeader = res.headers.get("retry-after");
			const retryAfterMs = retryAfterHeader
				? Number(retryAfterHeader) * 1000
				: null;
			lastError = new Error(`HTTP ${res.status} for ${url}`);
			if (attempt < maxAttempts) {
				await sleep(retryAfterMs ?? backoffMs(attempt));
			}
		} catch (err) {
			lastError = err;
			if (attempt < maxAttempts) {
				await sleep(backoffMs(attempt));
			}
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(`Failed to fetch ${url} after ${maxAttempts} attempts`);
}

function backoffMs(attempt: number): number {
	// 800ms, 1.6s, 3.2s, 6.4s ... with jitter
	const exp = BASE_BACKOFF_MS * 2 ** (attempt - 1);
	const jitter = Math.random() * 400;
	return Math.round(exp + jitter);
}

export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
