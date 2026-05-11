import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const detailSchema = z.object({
	repoUrl: z.string().url(),
});

/**
 * Server function exposed to the client. The actual work — DB cache lookup,
 * GitHub fetch, upsert — lives in `./internal.ts` and is dynamic-imported
 * inside the handler. Two reasons:
 *
 * 1. Side-effecting top-level imports (`db` → `pg`) would otherwise get
 *    pulled into the client bundle alongside the file that declares this
 *    server function. The TanStack Start plugin strips the handler body
 *    for client builds, but not its imports. Dynamic import inside the
 *    handler keeps the heavy modules off the client tree entirely.
 *
 * 2. Faster client-side cold start — the wrapper file has no transitive
 *    Node-only deps to choke Vite's optimisation pass.
 *
 * The `fetchAndCacheGitHubHealth` function is intentionally NOT exported
 * from `internal.ts` through here. Don't add a re-export.
 */
export const getGitHubHealth = createServerFn({ method: "GET" })
	.inputValidator(detailSchema.parse)
	.handler(async ({ data }) => {
		const { fetchAndCacheGitHubHealth } = await import("./internal.ts");
		return fetchAndCacheGitHubHealth(data.repoUrl);
	});
