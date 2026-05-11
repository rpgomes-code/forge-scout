import { queryOptions, useQuery } from "@tanstack/react-query";
import { askForgeAI } from "#/server/openrouter/queries.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Key factory — keyed by normalised query string. */
export const aiKeys = {
	all: ["ai"] as const,
	ask: (query: string) =>
		[...aiKeys.all, "ask", normaliseQuery(query)] as const,
} as const;

/**
 * Options for an AI-ranked Forge search. We give it a long staleTime
 * (1h) because the same query will almost always produce the same
 * ranking on the same catalogue, and a single call eats noticeable
 * OpenRouter quota.
 */
export const aiSearchOptions = (query: string) =>
	queryOptions({
		queryKey: aiKeys.ask(query),
		queryFn: () => askForgeAI({ data: { query: query.trim() } }),
		// Don't auto-fire until we have a query worth asking about.
		enabled: query.trim().length >= 10,
		staleTime: ONE_HOUR_MS,
		// Don't retry on failure — the server function returns a
		// discriminated result rather than throwing, so a `false` here
		// would mask the actual reason.
		retry: false,
	});

/**
 * Plain (non-suspending) hook for the AI panel. Failure modes (no API
 * key, model unreachable, invalid response) are surfaced through
 * `result.data.ok === false`, not via the query error path — see
 * `AIResult` in the server module.
 */
export function useAISearch(query: string) {
	return useQuery(aiSearchOptions(query));
}

function normaliseQuery(query: string): string {
	return query.trim().replace(/\s+/g, " ").toLowerCase();
}
