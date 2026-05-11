import type { ForgeSource } from "./source.ts";
import type { FetchAllOptions, ForgeComponentPayload } from "./types.ts";

/**
 * Source that talks to the unofficial OutSystems Forge REST API
 * (Forge component ID 3255). Stubbed for now — at the time of writing the
 * exact endpoint contract and auth requirements haven't been validated.
 *
 * When activated, this is the preferred mode: it's lighter on Forge's
 * servers than HTML scraping and tends to return cleaner field values.
 *
 * TODO(api): validate endpoints, define request/response shape, implement.
 * Tracked separately from the HTML scrape implementation so the scaffolding
 * (orchestrator, audit log, cron) can land first.
 */
export class ApiForgeSource implements ForgeSource {
	async *fetchAll(
		_opts: FetchAllOptions,
	): AsyncIterable<ForgeComponentPayload> {
		throw new Error(
			"FORGE_SOURCE=api is not yet implemented. Set FORGE_SOURCE=scrape until the unofficial Forge API client lands.",
		);
		// biome-ignore lint/correctness/noUnreachable: above throw is intentional pending API impl
		yield {} as ForgeComponentPayload;
	}
}
