import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useTransition } from "react";
import { z } from "zod";
import { ComponentCard } from "#/components/component-card.tsx";
import { FilterBar } from "#/components/filter-bar.tsx";
import { SearchInput } from "#/components/search-input.tsx";
import { forgeSearchOptions, useForgeSearch } from "#/queries/forge.ts";

const DEFAULT_LIMIT = 15;

const searchSchema = z.object({
	q: z.string().optional(),
	platform: z.array(z.string()).optional(),
	badges: z.array(z.string()).optional(),
	minRating: z.coerce.number().min(0).max(5).optional(),
});

type RouteSearch = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		q: search.q ?? "",
		platform: search.platform,
		badges: search.badges,
		minRating: search.minRating,
	}),
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(
			forgeSearchOptions({
				q: deps.q,
				platform: deps.platform,
				badges: deps.badges,
				minRating: deps.minRating,
				limit: DEFAULT_LIMIT,
			}),
		),
	component: Home,
});

function Home() {
	const search = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const [isPending, startTransition] = useTransition();

	const q = search.q ?? "";

	const updateSearch = (patch: Partial<RouteSearch>) => {
		startTransition(() => {
			navigate({
				search: (previous) =>
					cleanSearchParams({ ...(previous as RouteSearch), ...patch }),
				replace: true,
			});
		});
	};

	return (
		<div className="space-y-6">
			<section className="space-y-3">
				<p className="island-kicker">Forge Scout</p>
				<h1 className="display-title font-bold text-3xl leading-tight tracking-tight md:text-4xl">
					OutSystems Forge, with intelligence.
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Search the Forge by what you actually need — describe the job in your
					own words, narrow by platform, trust, and rating.
				</p>
			</section>

			<SearchInput
				value={q}
				onChange={(next) => updateSearch({ q: next ? next : undefined })}
			/>

			<FilterBar
				platform={search.platform ?? []}
				badges={search.badges ?? []}
				minRating={search.minRating}
				onChange={updateSearch}
			/>

			<Suspense fallback={<ResultsSkeleton />}>
				<Results
					q={q}
					platform={search.platform}
					badges={search.badges}
					minRating={search.minRating}
					dim={isPending}
				/>
			</Suspense>
		</div>
	);
}

function Results({
	q,
	platform,
	badges,
	minRating,
	dim,
}: {
	q: string;
	platform: Array<string> | undefined;
	badges: Array<string> | undefined;
	minRating: number | undefined;
	dim: boolean;
}) {
	const { data: components } = useForgeSearch({
		q,
		platform,
		badges,
		minRating,
		limit: DEFAULT_LIMIT,
	});

	if (components.length === 0) {
		return (
			<EmptyState
				title="No components match."
				body="Broaden your search, drop a filter, or clear them all."
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

/** Strip empty / falsy search params so URLs don't accumulate `?q=&platform=`. */
function cleanSearchParams(params: RouteSearch): RouteSearch {
	const out: RouteSearch = {};
	if (params.q && params.q.length > 0) out.q = params.q;
	if (params.platform && params.platform.length > 0)
		out.platform = params.platform;
	if (params.badges && params.badges.length > 0) out.badges = params.badges;
	if (params.minRating !== undefined && params.minRating > 0)
		out.minRating = params.minRating;
	return out;
}
