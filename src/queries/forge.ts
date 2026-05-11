import {
	infiniteQueryOptions,
	queryOptions,
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import {
	type ForgeCursor,
	getForgeComponent,
	getForgeComponentsByIds,
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
	batch: (ids: ReadonlyArray<number>) =>
		[...forgeKeys.all, "batch", [...ids].sort((a, b) => a - b)] as const,
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

/**
 * Single-component query options. Used by the `/component/$id` route loader
 * to ensure SSR has data, and by the detail component to read it back.
 */
export const forgeDetailOptions = (id: number) =>
	queryOptions({
		queryKey: forgeKeys.detail(id),
		queryFn: () => getForgeComponent({ data: { id } }),
	});

/**
 * Batch query options used by /compare. The query key sorts the ids so
 * `[1, 2]` and `[2, 1]` share a cache entry — the column order is a UI
 * concern, not a data-identity concern.
 */
export const forgeBatchOptions = (ids: ReadonlyArray<number>) =>
	queryOptions({
		queryKey: forgeKeys.batch(ids),
		queryFn: () => getForgeComponentsByIds({ data: { ids: [...ids] } }),
		enabled: ids.length > 0,
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

/**
 * Suspending detail hook. The route loader guarantees non-null data by the
 * time this runs (it throws notFound() on missing rows), but the underlying
 * query type still includes `null` — callers should still narrow if they
 * use this outside the route's render tree.
 */
export function useForgeDetail(id: number) {
	return useSuspenseQuery(forgeDetailOptions(id));
}

/** Suspending batch fetch — backs the /compare route. */
export function useForgeBatch(ids: ReadonlyArray<number>) {
	return useSuspenseQuery(forgeBatchOptions(ids));
}
