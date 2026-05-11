import { desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index.ts";
import { forgeComponents } from "#/db/schema.ts";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** How many top-ranked-by-downloads components we feed the LLM as context. */
const CATALOGUE_SAMPLE_SIZE = 80;
/** Per-description token budget (chars, roughly). */
const DESCRIPTION_TRUNCATION = 200;

/**
 * LLM response shape we ask for. Zod-validated on the way in so a model
 * that doesn't follow instructions can't crash the UI.
 */
const ConfidenceSchema = z.enum(["high", "medium", "low"]);

const RecommendationSchema = z.object({
	id: z.number().int().positive(),
	confidence: ConfidenceSchema,
	reason: z.string().max(500),
});

const AIRankingSchema = z.object({
	recommendations: z.array(RecommendationSchema).max(10),
	alternatives: z.array(RecommendationSchema).max(10).default([]),
	warnings: z.array(z.string().max(500)).max(10).default([]),
});

export type AIRanking = z.infer<typeof AIRankingSchema>;

export type AIResult =
	| { ok: true; data: AIRanking; model: string }
	| { ok: false; error: string };

/**
 * Ask the configured OpenRouter model to rank Forge components for the
 * user's natural-language query. Returns a discriminated result so the UI
 * can render error states without exception-handling — sentinel-based,
 * matches what the rest of the project does for soft failures.
 *
 * IMPORTANT: this module is server-only. It is intentionally NOT imported
 * by anything in the client tree (top-level `db` import would otherwise
 * pull pg into the client bundle). The server function in `./queries.ts`
 * dynamic-imports it inside the handler.
 */
export async function askForgeAI(query: string): Promise<AIResult> {
	const apiKey = process.env.OPENROUTER_API_KEY;
	if (!apiKey) {
		return {
			ok: false,
			error:
				"AI search is disabled. Set OPENROUTER_API_KEY in .env.local — sign up free at openrouter.ai.",
		};
	}

	const model =
		process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free";

	// Pull the top-N most-downloaded components as context. Going by
	// downloads is a reasonable proxy for "components the user is most
	// likely to want recommended" without LLM-side ranking baggage.
	const rows = await db
		.select({
			id: forgeComponents.id,
			name: forgeComponents.name,
			description: forgeComponents.description,
			category: forgeComponents.category,
			license: forgeComponents.license,
			platform: forgeComponents.platform,
			downloads: forgeComponents.downloads,
		})
		.from(forgeComponents)
		.orderBy(desc(forgeComponents.downloads))
		.limit(CATALOGUE_SAMPLE_SIZE);

	if (rows.length === 0) {
		return {
			ok: false,
			error: "No components in the catalogue yet. Run `npm run scrape` first.",
		};
	}

	const catalogueJson = JSON.stringify(
		rows.map((row) => ({
			id: row.id,
			name: row.name,
			description: (row.description ?? "").slice(0, DESCRIPTION_TRUNCATION),
			category: row.category,
			license: row.license,
			platform: row.platform,
			downloads: row.downloads,
		})),
	);

	const systemPrompt = `You are Forge Scout, an OutSystems Forge component advisor.

Given a user's natural-language query, recommend the most relevant components from the catalogue below. The user may describe their need in OutSystems terms (Server Action, Client Action, Aggregate) or in general programming terms (REST endpoint, ORM, cron job). Understand both vocabularies.

Respond with a JSON object EXACTLY in this shape (no markdown, no commentary):
{
  "recommendations": [
    { "id": <component id from catalogue>, "confidence": "high" | "medium" | "low", "reason": "<one or two sentences explaining the fit, including any licence consideration when relevant>" }
  ],
  "alternatives": [
    { "id": <component id>, "confidence": "medium" | "low", "reason": "<why this is a viable second-choice>" }
  ],
  "warnings": ["<optional plain-text concern, e.g. 'Top match is GPL — incompatible with closed-source distribution.'>"]
}

Rules:
- Use ONLY ids that appear in the catalogue. Never invent an id.
- Up to 5 recommendations, up to 3 alternatives.
- Order recommendations by confidence then relevance.
- If no component matches well, return empty arrays plus a single warning saying so.
- If a strong copyleft licence (GPL family) shows up as a top match, mention it in the recommendation's reason AND list a permissive alternative when one exists.

Catalogue (${rows.length} components):
${catalogueJson}`;

	let response: Response;
	try {
		response = await fetch(OPENROUTER_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": "https://github.com/rpgomes-code/forge-scout",
				"X-Title": "Forge Scout",
			},
			body: JSON.stringify({
				model,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: query },
				],
				response_format: { type: "json_object" },
				temperature: 0.2,
				max_tokens: 1200,
			}),
			signal: AbortSignal.timeout(60_000),
		});
	} catch (err) {
		return {
			ok: false,
			error: `Couldn't reach OpenRouter: ${
				err instanceof Error ? err.message : String(err)
			}`,
		};
	}

	if (!response.ok) {
		const body = await response.text().catch(() => "");
		return {
			ok: false,
			error: `OpenRouter responded ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
		};
	}

	let openRouterPayload: {
		choices?: Array<{ message?: { content?: string } }>;
	};
	try {
		openRouterPayload = (await response.json()) as typeof openRouterPayload;
	} catch {
		return { ok: false, error: "OpenRouter returned an unparseable response." };
	}

	const content = openRouterPayload.choices?.[0]?.message?.content;
	if (!content) {
		return {
			ok: false,
			error: "OpenRouter returned an empty completion.",
		};
	}

	const parsed = tryParseRanking(content);
	if (!parsed) {
		return {
			ok: false,
			error:
				"The model didn't return the expected JSON shape. Try a clearer query or a different model.",
		};
	}

	// Guard against the model hallucinating ids that aren't in the catalogue.
	const validIds = new Set(rows.map((r) => r.id));
	const cleaned: AIRanking = {
		recommendations: parsed.recommendations.filter((r) => validIds.has(r.id)),
		alternatives: parsed.alternatives.filter((r) => validIds.has(r.id)),
		warnings: parsed.warnings,
	};

	if (
		cleaned.recommendations.length === 0 &&
		cleaned.alternatives.length === 0 &&
		cleaned.warnings.length === 0
	) {
		return {
			ok: false,
			error:
				"The model returned no usable recommendations (all referenced ids were missing from the catalogue).",
		};
	}

	return { ok: true, data: cleaned, model };
}

/**
 * Strip a markdown code-fence wrapper (some models still emit one even
 * when asked for json mode), then try to parse + validate.
 */
function tryParseRanking(content: string): AIRanking | null {
	const cleaned = content
		.replace(/^```(?:json)?\s*\n?/i, "")
		.replace(/\n?```\s*$/i, "")
		.trim();
	try {
		const json = JSON.parse(cleaned);
		return AIRankingSchema.parse(json);
	} catch {
		return null;
	}
}
