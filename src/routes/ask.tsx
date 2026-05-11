import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { z } from "zod";
import { ComponentCard } from "#/components/component-card.tsx";
import type { ForgeComponent } from "#/db/schema.ts";
import { aiSearchOptions } from "#/queries/ai.ts";
import { forgeBatchOptions } from "#/queries/forge.ts";

const searchSchema = z.object({
	q: z.string().optional(),
});

export const Route = createFileRoute("/ask")({
	validateSearch: searchSchema,
	component: AskRoute,
});

function AskRoute() {
	const { q } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const form = useForm({
		defaultValues: { query: q ?? "" },
		onSubmit: ({ value }) => {
			const trimmed = value.query.trim();
			navigate({
				search: trimmed ? { q: trimmed } : {},
				replace: true,
			});
		},
	});

	const trimmed = (q ?? "").trim();
	const result = useQuery(aiSearchOptions(trimmed));

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<Link
					to="/"
					className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
				>
					<ArrowLeft className="size-4" aria-hidden />
					Back to search
				</Link>
				<div className="flex items-center gap-2">
					<Sparkles className="size-5 text-primary" aria-hidden />
					<p className="island-kicker">AI assist</p>
				</div>
				<h1 className="display-title font-bold text-3xl leading-tight tracking-tight md:text-4xl">
					Ask Forge Scout
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Describe what you're trying to build, in your own words. The model
					picks the best matches from the Forge catalogue, explains why, and
					flags any licence trouble.
				</p>
			</section>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-3"
			>
				<form.Field
					name="query"
					validators={{
						onSubmit: ({ value }) => {
							const len = value.trim().length;
							if (len < 10)
								return "Give me at least 10 characters to work with.";
							if (len > 500) return "Keep it under 500 characters.";
							return undefined;
						},
					}}
				>
					{(field) => (
						<div className="space-y-2">
							<label htmlFor={field.name} className="block font-medium text-sm">
								What do you need?
							</label>
							<textarea
								id={field.name}
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								rows={3}
								placeholder="e.g. I need to generate PDF reports from server actions, ideally MIT-licensed."
								className="w-full rounded-lg border bg-background px-3 py-2 text-sm leading-relaxed shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
							/>
							{field.state.meta.errors.length > 0 && (
								<p className="text-destructive text-xs">
									{String(field.state.meta.errors[0])}
								</p>
							)}
						</div>
					)}
				</form.Field>

				<div className="flex items-center justify-between gap-2">
					<p className="text-muted-foreground text-xs">
						Powered by your configured OpenRouter model. Responses take ~5-15s
						on free tiers.
					</p>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting] as const}
					>
						{([canSubmit, isSubmitting]) => (
							<button
								type="submit"
								disabled={!canSubmit || isSubmitting || result.isFetching}
								className="inline-flex items-center gap-2 rounded-md border border-primary bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Sparkles className="size-4" aria-hidden />
								Ask AI
							</button>
						)}
					</form.Subscribe>
				</div>
			</form>

			{trimmed.length === 0 ? null : result.isLoading ? (
				<LoadingPanel />
			) : !result.data ? null : !result.data.ok ? (
				<ErrorPanel message={result.data.error} />
			) : (
				<ResultsPanel query={trimmed} result={result.data} />
			)}
		</div>
	);
}

function LoadingPanel() {
	return (
		<section
			className="island-shell flex items-center justify-center gap-3 rounded-2xl p-8 text-muted-foreground text-sm"
			aria-busy
			aria-live="polite"
		>
			<Loader2 className="size-4 animate-spin" aria-hidden />
			Thinking… the free models on OpenRouter can take 5-15 seconds.
		</section>
	);
}

function ErrorPanel({ message }: { message: string }) {
	return (
		<output className="flex items-start gap-3 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5 text-amber-900 text-sm dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
			<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
			<div className="space-y-1">
				<p className="font-medium">AI search couldn't run.</p>
				<p className="text-amber-900/90 dark:text-amber-300/90">{message}</p>
			</div>
		</output>
	);
}

function ResultsPanel({
	query,
	result,
}: {
	query: string;
	result: import("#/server/openrouter/internal.ts").AIResult & { ok: true };
}) {
	// Resolve the recommended ids to full component rows in one batch.
	const allIds = [
		...result.data.recommendations.map((r) => r.id),
		...result.data.alternatives.map((r) => r.id),
	];
	const uniqueIds = Array.from(new Set(allIds));
	const components = useQuery({
		...forgeBatchOptions(uniqueIds),
		enabled: uniqueIds.length > 0,
	});

	const byId = new Map<number, ForgeComponent>();
	if (components.data) {
		for (const row of components.data) {
			if (row) byId.set(row.id, row);
		}
	}

	return (
		<section className="space-y-6" aria-live="polite">
			<header className="space-y-1">
				<h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
					Recommendations for "{query}"
				</h2>
				<p className="text-muted-foreground text-xs">
					Model: <span className="font-mono">{result.model}</span>
				</p>
			</header>

			{result.data.warnings.length > 0 && (
				<ul className="space-y-2">
					{result.data.warnings.map((message) => (
						<li
							key={message}
							className="flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/60 p-3 text-amber-900 text-xs dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
						>
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
							<span>{message}</span>
						</li>
					))}
				</ul>
			)}

			{result.data.recommendations.length > 0 && (
				<RankingGroup
					title="Top matches"
					rankings={result.data.recommendations}
					byId={byId}
					loadingComponents={components.isLoading}
				/>
			)}

			{result.data.alternatives.length > 0 && (
				<RankingGroup
					title="Alternatives worth a look"
					rankings={result.data.alternatives}
					byId={byId}
					loadingComponents={components.isLoading}
				/>
			)}
		</section>
	);
}

function RankingGroup({
	title,
	rankings,
	byId,
	loadingComponents,
}: {
	title: string;
	rankings: ReadonlyArray<{
		id: number;
		confidence: "high" | "medium" | "low";
		reason: string;
	}>;
	byId: Map<number, ForgeComponent>;
	loadingComponents: boolean;
}) {
	return (
		<div className="space-y-4">
			<h3 className="font-semibold text-base">{title}</h3>
			<ol className="space-y-6">
				{rankings.map((ranking) => {
					const component = byId.get(ranking.id);
					return (
						<li
							key={`${title}-${ranking.id}`}
							className="space-y-3 border-l-2 border-border pl-4 md:pl-5"
						>
							<div className="space-y-1.5">
								<ConfidenceLine confidence={ranking.confidence} />
								<p className="text-foreground/90 text-sm leading-relaxed">
									{ranking.reason}
								</p>
							</div>
							<div className="max-w-md">
								{component ? (
									<ComponentCard component={component} />
								) : loadingComponents ? (
									<div className="h-40 animate-pulse rounded-2xl border bg-muted/30" />
								) : (
									<div className="rounded-xl border bg-muted/30 p-4 text-muted-foreground text-xs">
										Component #{ranking.id} isn't in the local catalogue yet.
									</div>
								)}
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

function ConfidenceLine({
	confidence,
}: {
	confidence: "high" | "medium" | "low";
}) {
	const colour =
		confidence === "high"
			? "bg-emerald-500"
			: confidence === "medium"
				? "bg-amber-500"
				: "bg-muted-foreground/60";
	return (
		<p className="inline-flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
			<span
				className={`inline-block size-2 rounded-full ${colour}`}
				aria-hidden
			/>
			{confidence} confidence
		</p>
	);
}
