import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		/** PostgreSQL connection string. Validated when actually used. */
		DATABASE_URL: z.string().url().optional(),

		/** OpenRouter API key. Optional during scaffold work, required for LLM features. */
		OPENROUTER_API_KEY: z.string().optional(),

		/** OpenRouter model id. Default is a free model with reliable JSON-mode
		 * output. See .env.example for alternatives. */
		OPENROUTER_MODEL: z.string().default("z-ai/glm-4.5-air:free"),

		/** Forge data source. `scrape` reads HTML; `api` calls the unofficial Forge API. */
		FORGE_SOURCE: z.enum(["scrape", "api"]).default("scrape"),

		/** Optional GitHub PAT. Raises the API rate limit from 60 to 5000 req/hr. */
		GITHUB_TOKEN: z.string().optional(),
	},

	clientPrefix: "VITE_",

	client: {
		VITE_APP_TITLE: z.string().min(1).default("Forge Scout"),
	},

	runtimeEnv: import.meta.env,

	emptyStringAsUndefined: true,
});
