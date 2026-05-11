import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const askSchema = z.object({
	query: z.string().min(10).max(500),
});

/**
 * Server function for the AI search route. Thin wrapper that dynamic-
 * imports the internal implementation — keeps the heavy `db` + drizzle
 * chain (and the OpenRouter HTTP call) off the client bundle, same
 * pattern as src/server/github/.
 */
export const askForgeAI = createServerFn({ method: "POST" })
	.inputValidator(askSchema.parse)
	.handler(async ({ data }) => {
		const { askForgeAI: run } = await import("./internal.ts");
		return run(data.query);
	});
