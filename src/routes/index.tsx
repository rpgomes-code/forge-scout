import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useTransition } from "react";
import { z } from "zod";
import { ComponentCard } from "#/components/component-card.tsx";
import { SearchInput } from "#/components/search-input.tsx";
import { forgeSearchOptions, useForgeSearch } from "#/queries/forge.ts";

const DEFAULT_LIMIT = 15;

const searchSchema = z.object({
	q: z.string().optional(),
});

export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(
			forgeSearchOptions({ q: deps.q, limit: DEFAULT_LIMIT }),
		),
	component: Home,
});

function Home() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [isPending, startTransition] = useTransition();

	const q = search.q ?? "";

	const setQuery = (next: string) => {
		startTransition(() => {
			navigate({
				search: () => (next ? { q: next } : {}),
				replace: true,
			});
		});
	};

	return (
		<div className="space-y-8">
			<section className="space-y-3">
				<p className="island-kicker">Forge Scout</p>
				<h1 className="display-title font-bold text-3xl leading-tight tracking-tight md:text-4xl">
					OutSystems Forge, with intelligence.
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Search the Forge by what you actually need — describe the job in your
					own words, get ranked components with health signals.
				</p>
			</section>

			<SearchInput value={q} onChange={setQuery} />

			<Suspense fallback={<ResultsSkeleton />}>
				<Results q={q} dim={isPending} />
			</Suspense>
		</div>
	);
}

function Results({ q, dim }: { q: string; dim: boolean }) {
	const { data: components } = useForgeSearch({ q, limit: DEFAULT_LIMIT });

	if (components.length === 0) {
		return (
			<EmptyState
				title={
					q ? "No components match." : "No components in the database yet."
				}
				body={
					q
						? "Try a broader keyword, or remove some words from your query."
						: "Run `npm run scrape` to populate the catalogue, then refresh."
				}
			/>
		);
	}

	return (
		<div
			className={
				"grid gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3 " +
				(dim ? "opacity-60" : "opacity-100")
			}
			aria-busy={dim}
		>
			{components.map((component) => (
				<ComponentCard key={component.id} component={component} />
			))}
		</div>
	);
}

function ResultsSkeleton() {
	return (
		<output
			aria-label="Loading results"
			className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
		>
			{Array.from({ length: 6 }, (_, index) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders are positional and never reorder
					key={index}
					className="h-44 animate-pulse rounded-2xl border bg-muted/30"
				/>
			))}
		</output>
	);
}

function EmptyState({ title, body }: { title: string; body: string }) {
	return (
		<div className="island-shell max-w-2xl rounded-2xl p-8 text-center">
			<p className="font-semibold">{title}</p>
			<p className="mt-2 text-muted-foreground text-sm">{body}</p>
		</div>
	);
}
