import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
	MutationCache,
	QueryCache,
	QueryClient,
	type QueryKey,
} from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

declare module "@tanstack/react-query" {
	interface Register {
		mutationMeta: {
			/** Query keys to invalidate after the mutation settles. */
			invalidates?: Array<QueryKey>;
		};
	}
}

const TEN_MINUTES = 1000 * 60 * 10;
const ONE_DAY = 1000 * 60 * 60 * 24;
const PERSIST_KEY = "FORGE_SCOUT_CACHE";

/**
 * Build the QueryClient with the Forge Scout conventions:
 * - Generous defaults tuned for a read-heavy LLM-fronted app.
 * - Global `onError` hooks for queries + mutations (extend in later PRs).
 * - Meta-driven invalidation: any mutation passing
 *   `meta: { invalidates: [...queryKeys] }` triggers a refetch automatically.
 */
export function createQueryClient() {
	const client = new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: TEN_MINUTES,
				gcTime: ONE_DAY,
				refetchOnWindowFocus: false,
			},
		},
		queryCache: new QueryCache({
			onError: (error, query) => {
				// Global query error hook. Extend in later PRs (toasts, 401 handling, etc.).
				console.error("[query]", query.queryKey, error);
			},
		}),
		mutationCache: new MutationCache({
			onError: (error, _vars, _ctx, mutation) => {
				console.error("[mutation]", mutation.options.mutationKey, error);
			},
			onSettled: (_data, _error, _vars, _ctx, mutation) => {
				const invalidates = mutation.options.meta?.invalidates;
				if (Array.isArray(invalidates) && invalidates.length > 0) {
					for (const queryKey of invalidates) {
						client.invalidateQueries({ queryKey });
					}
				}
			},
		}),
	});

	return client;
}

/**
 * Build the per-request context the router consumes. On the client we also
 * wire up the localStorage persister so the cache survives page refreshes.
 * SSR skips the persister — `window` doesn't exist on the server.
 */
export function getContext() {
	const queryClient = createQueryClient();

	if (typeof window !== "undefined") {
		const persister = createSyncStoragePersister({
			storage: window.localStorage,
			key: PERSIST_KEY,
		});
		persistQueryClient({
			queryClient,
			persister,
			maxAge: ONE_DAY,
			// Bump when the cache shape changes incompatibly.
			buster: "v1",
		});
	}

	return { queryClient };
}

// Kept so the router's `import TanstackQueryProvider from '...'` keeps resolving.
// The real wiring happens through `getContext()` + the router's `context` slot.
export default function TanstackQueryProvider() {
	return null;
}
