import type { FetchAllOptions, ForgeComponentPayload } from "./types.ts";

/**
 * Abstract source of Forge component data. Implementations:
 * - `ScrapeForgeSource` — parses HTML from outsystems.com/forge
 * - `ApiForgeSource` — calls the unofficial Forge API
 */
export interface ForgeSource {
	/** Yield components one at a time. Consumers decide when to stop. */
	fetchAll(opts: FetchAllOptions): AsyncIterable<ForgeComponentPayload>;
}
