import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
	type SearchForgeParams,
	searchForgeComponents,
} from "#/server/forge/queries.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised query keys for the Forge resource. Use these everywhere —
 * never inline arrays — so invalidation can target the right slice
 * (`queryClient.invalidateQueries({ queryKey: forgeKeys.all })` wipes the
 * lot; `forgeKeys.detail(id)` invalidates one component, etc.).
 */
export const forgeKeys = {
	all: ["forge"] as const,
	list: (params: SearchForgeParams) =>
		[...forgeKeys.all, "list", params] as const,
	detail: (id: number) => [...forgeKeys.all, "detail", id] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Query options factories — pass to useQuery / useSuspenseQuery / prefetch
// ─────────────────────────────────────────────────────────────────────────────

export const forgeSearchOptions = (params: SearchForgeParams) =>
	queryOptions({
		queryKey: forgeKeys.list(params),
		queryFn: () => searchForgeComponents({ data: params }),
	});

// ─────────────────────────────────────────────────────────────────────────────
// Custom hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suspending search hook. Throws a promise on first call — wrap callers in
 * a `<Suspense>` boundary. Refetches on key change.
 */
export function useForgeSearch(params: SearchForgeParams) {
	return useSuspenseQuery(forgeSearchOptions(params));
}
