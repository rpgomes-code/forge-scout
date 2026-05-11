const USER_AGENT =
	"ForgeScout/0.1 (+https://github.com/rpgomes-code/forge-scout)";

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 800;

export interface FetchTextOptions {
	/** Per-request timeout. Defaults to 20s. */
	timeoutMs?: number;
	/** Override max attempts (default 4). */
	maxAttempts?: number;
}

/**
 * GET a URL as text with timeouts, retries, and exponential backoff.
 *
 * Retries on network errors and HTTP 5xx / 429. Bails on 4xx (other than 429)
 * — those are permanent. Honours `Retry-After` header when present on 429.
 */
export async function fetchText(
	url: string,
	opts: FetchTextOptions = {},
): Promise<string> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;

	let lastError: unknown;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const res = await fetch(url, {
				headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
				signal: controller.signal,
				redirect: "follow",
			});

			if (res.ok) {
				clearTimeout(timer);
				return await res.text();
			}

			// 4xx (not 429) is permanent — don't retry.
			if (res.status >= 400 && res.status < 500 && res.status !== 429) {
				clearTimeout(timer);
				throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
			}

			// 429 / 5xx — back off and retry.
			const retryAfterHeader = res.headers.get("retry-after");
			const retryAfterMs = retryAfterHeader
				? Number(retryAfterHeader) * 1000
				: null;
			lastError = new Error(`HTTP ${res.status} for ${url}`);
			clearTimeout(timer);
			if (attempt < maxAttempts) {
				await sleep(retryAfterMs ?? backoffMs(attempt));
			}
		} catch (err) {
			clearTimeout(timer);
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
