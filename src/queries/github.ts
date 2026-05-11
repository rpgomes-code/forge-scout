import { queryOptions, useQuery } from "@tanstack/react-query";
import { getGitHubHealth } from "#/server/github/queries.ts";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Centralised query keys for the GitHub resource. Keyed by canonical repo
 * URL so all components pointing at the same repo share one cache entry.
 */
export const githubKeys = {
	all: ["github"] as const,
	detail: (repoUrl: string) => [...githubKeys.all, "detail", repoUrl] as const,
} as const;

export const githubHealthOptions = (repoUrl: string) =>
	queryOptions({
		queryKey: githubKeys.detail(repoUrl),
		queryFn: () => getGitHubHealth({ data: { repoUrl } }),
		// 1h staleTime mirrors the DB-side cache TTL. Within an hour, a cache
		// hit on the client doesn't even hit the server function.
		staleTime: ONE_HOUR_MS,
	});

/**
 * Non-suspending GitHub health hook. Per the project's React Query
 * conventions, secondary/optional data uses plain `useQuery` so the host
 * page doesn't suspend if the API stalls. The hook is no-op'd via `enabled`
 * when the component doesn't have a `github_url`.
 */
export function useGitHubHealth(repoUrl: string | null) {
	return useQuery({
		...githubHealthOptions(repoUrl ?? ""),
		enabled: !!repoUrl,
	});
}
