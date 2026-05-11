import { ApiForgeSource } from "./api-source.ts";
import { ScrapeForgeSource } from "./scrape-source.ts";
import type { ForgeSource } from "./source.ts";
import type { ForgeSourceMode } from "./types.ts";

/**
 * Build the configured Forge source. Defaults to `scrape` when no explicit
 * mode is passed — matches the `.env.example` default.
 */
export function selectForgeSource(mode: ForgeSourceMode): ForgeSource {
	switch (mode) {
		case "scrape":
			return new ScrapeForgeSource();
		case "api":
			return new ApiForgeSource();
	}
}
