import {
	infiniteQueryOptions,
	useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import {
	type ForgeCursor,
	type SearchForgeParams,
	searchForgeComponents,
} from "#/server/forge/queries.ts";

/** Filter slice of `SearchForgeParams` — everything that lives in the URL. */
export type ForgeListFilters = Omit<SearchForgeParams, "cursor" | "limit">;

// ─────────────────────────────────────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Centralised query keys for the Forge resource. The infinite list key is
 * the filter set (NOT including the cursor — that's the pageParam). Two
 * pages of the same filtered list share one cache entry.
 */
export const forgeKeys = {
	all: ["forge"] as const,
	list: (filters: ForgeListFilters, limit: number) =>
		[...forgeKeys.all, "list", { filters, limit }] as const,
	detail: (id: number) => [...forgeKeys.all, "detail", id] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Query options factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infinite-query options for the Forge listing. Sharing the same factory
 * between the route loader (`ensureInfiniteQueryData`) and the component
 * hook (`useSuspenseInfiniteQuery`) is what lets SSR pre-populate page 1.
 */
export const forgeInfiniteSearchOptions = (
	filters: ForgeListFilters,
	limit = 15,
) =>
	infiniteQueryOptions({
		queryKey: forgeKeys.list(filters, limit),
		queryFn: ({ pageParam }) =>
			searchForgeComponents({
				data: { ...filters, limit, cursor: pageParam },
			}),
		initialPageParam: null as ForgeCursor | null,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
	});

// ─────────────────────────────────────────────────────────────────────────────
// Custom hooks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suspending infinite search hook. Wrap callers in a `<Suspense>` boundary.
 * Returns `{ data, fetchNextPage, hasNextPage, isFetchingNextPage, ... }`.
 */
export function useForgeInfiniteSearch(filters: ForgeListFilters, limit = 15) {
	return useSuspenseInfiniteQuery(forgeInfiniteSearchOptions(filters, limit));
}
