import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useRef, useTransition } from "react";
import { z } from "zod";
import { ComponentCard } from "#/components/component-card.tsx";
import { FilterBar } from "#/components/filter-bar.tsx";
import { SearchInput } from "#/components/search-input.tsx";
import {
	type ForgeListFilters,
	forgeInfiniteSearchOptions,
	useForgeInfiniteSearch,
} from "#/queries/forge.ts";

const PAGE_SIZE = 15;

const searchSchema = z.object({
	q: z.string().optional(),
	platform: z.array(z.string()).optional(),
	badges: z.array(z.string()).optional(),
	minRating: z.coerce.number().min(0).max(5).optional(),
});

type RouteSearch = z.infer<typeof searchSchema>;

function filtersFromSearch(search: RouteSearch): ForgeListFilters {
	return {
		q: search.q ?? "",
		platform: search.platform,
		badges: search.badges,
		minRating: search.minRating,
	};
}

export const Route = createFileRoute("/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => filtersFromSearch(search),
	loader: ({ context, deps }) =>
		context.queryClient.ensureInfiniteQueryData(
			forgeInfiniteSearchOptions(deps, PAGE_SIZE),
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
				<Results filters={filtersFromSearch(search)} dim={isPending} />
			</Suspense>
		</div>
	);
}

function Results({
	filters,
	dim,
}: {
	filters: ForgeListFilters;
	dim: boolean;
}) {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useForgeInfiniteSearch(filters, PAGE_SIZE);

	// Flatten pages into a single render list.
	const items = data.pages.flatMap((page) => page.items);

	// Sentinel-driven prefetch. The rootMargin fires the fetch well before
	// the sentinel is visible, so by the time the user scrolls there the
	// next page is usually already in.
	const sentinelRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const node = sentinelRef.current;
		if (!node || !hasNextPage) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting && !isFetchingNextPage) {
					void fetchNextPage();
				}
			},
			{ rootMargin: "600px 0px" },
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, [fetchNextPage, hasNextPage, isFetchingNextPage]);

	if (items.length === 0) {
		return (
			<EmptyState
				title="No components match."
				body="Broaden your search, drop a filter, or clear them all."
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div
				className={`grid gap-4 transition-opacity md:grid-cols-2 lg:grid-cols-3 ${
					dim ? "opacity-60" : "opacity-100"
				}`}
				aria-busy={dim}
			>
				{items.map((component) => (
					<ComponentCard key={component.id} component={component} />
				))}
			</div>

			{hasNextPage ? (
				<div
					ref={sentinelRef}
					className="flex items-center justify-center py-6 text-muted-foreground text-sm"
				>
					{isFetchingNextPage ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
							Loading more…
						</>
					) : (
						<span className="opacity-0">scroll for more</span>
					)}
				</div>
			) : (
				<p className="py-6 text-center text-muted-foreground text-xs">
					{items.length === 1 ? "1 component" : `${items.length} components`} —
					end of results
				</p>
			)}
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
