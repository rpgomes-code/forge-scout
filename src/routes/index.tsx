import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2, Scale, X } from "lucide-react";
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
const COMPARE_MAX = 4;

const searchSchema = z.object({
	q: z.string().optional(),
	platform: z.array(z.string()).optional(),
	badges: z.array(z.string()).optional(),
	minRating: z.coerce.number().min(0).max(5).optional(),
	/** Component IDs the user is queueing up to compare. */
	compare: z
		.array(z.coerce.number().int().positive())
		.max(COMPARE_MAX)
		.optional(),
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
	const selected = search.compare ?? [];

	const updateSearch = (patch: Partial<RouteSearch>) => {
		startTransition(() => {
			navigate({
				search: (previous) =>
					cleanSearchParams({ ...(previous as RouteSearch), ...patch }),
				replace: true,
			});
		});
	};

	const toggleCompare = (id: number) => {
		const isSelected = selected.includes(id);
		const next = isSelected
			? selected.filter((existing) => existing !== id)
			: selected.length < COMPARE_MAX
				? [...selected, id]
				: selected;
		updateSearch({ compare: next.length > 0 ? next : undefined });
	};

	const clearCompare = () => updateSearch({ compare: undefined });

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
					filters={filtersFromSearch(search)}
					selected={selected}
					onToggleCompare={toggleCompare}
					dim={isPending}
				/>
			</Suspense>

			{selected.length > 0 && (
				<CompareTray
					selected={selected}
					onClear={clearCompare}
					onRemove={toggleCompare}
				/>
			)}
		</div>
	);
}

function Results({
	filters,
	selected,
	onToggleCompare,
	dim,
}: {
	filters: ForgeListFilters;
	selected: ReadonlyArray<number>;
	onToggleCompare: (id: number) => void;
	dim: boolean;
}) {
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
		useForgeInfiniteSearch(filters, PAGE_SIZE);

	const items = data.pages.flatMap((page) => page.items);

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
				{items.map((component) => {
					const isSelected = selected.includes(component.id);
					return (
						<ComponentCard
							key={component.id}
							component={component}
							selectable={{
								isSelected,
								canSelect: selected.length < COMPARE_MAX,
								onToggle: () => onToggleCompare(component.id),
							}}
						/>
					);
				})}
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

/**
 * Floating "compare tray" that lives at the bottom of the viewport while
 * any selection is active. Shows count, lets you clear, and only enables
 * the "Compare" CTA once 2+ components are picked.
 */
function CompareTray({
	selected,
	onClear,
	onRemove,
}: {
	selected: ReadonlyArray<number>;
	onClear: () => void;
	onRemove: (id: number) => void;
}) {
	const ready = selected.length >= 2;
	return (
		<div className="-translate-x-1/2 fixed bottom-6 left-1/2 z-30 w-[min(620px,calc(100vw-2rem))] transform">
			<div className="island-shell flex items-center gap-3 rounded-2xl p-3 shadow-lg">
				<Scale className="size-4 shrink-0 text-muted-foreground" aria-hidden />
				<p className="min-w-0 flex-1 truncate text-sm">
					<span className="font-semibold">{selected.length}</span>{" "}
					<span className="text-muted-foreground">
						{selected.length === 1 ? "component" : "components"} selected
						{ready ? "" : " · pick at least one more"}
					</span>
				</p>
				<button
					type="button"
					onClick={onClear}
					className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
				>
					<X className="size-3" aria-hidden />
					Clear
				</button>
				{ready ? (
					<Link
						to="/compare"
						search={{ ids: [...selected] }}
						className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm hover:bg-primary/90"
					>
						Compare
						<ArrowRight className="size-3.5" aria-hidden />
					</Link>
				) : (
					<button
						type="button"
						disabled
						className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-muted bg-muted/50 px-3 py-1.5 font-medium text-muted-foreground text-sm"
					>
						Compare
						<ArrowRight className="size-3.5" aria-hidden />
					</button>
				)}
			</div>
			{/* Tiny per-component chips so the user can yank a single component
			    without scrolling for it. */}
			<div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
				{selected.map((id) => (
					<button
						key={id}
						type="button"
						onClick={() => onRemove(id)}
						className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 hover:bg-accent"
						aria-label={`Remove component ${id} from comparison`}
					>
						#{id}
						<X className="size-3" aria-hidden />
					</button>
				))}
			</div>
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
	if (params.compare && params.compare.length > 0) out.compare = params.compare;
	return out;
}
