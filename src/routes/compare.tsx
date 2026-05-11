import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { CompareTable } from "#/components/compare-table.tsx";
import { forgeBatchOptions, useForgeBatch } from "#/queries/forge.ts";

/**
 * Search-param schema. Validates that the user gave us 2-4 positive integer
 * ids. `min(2)` because comparing one component is just the detail page;
 * `max(4)` because more than four columns gets unreadable.
 */
const searchSchema = z.object({
	ids: z.array(z.coerce.number().int().positive()).min(2).max(4),
});

export const Route = createFileRoute("/compare")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({ ids: search.ids }),
	loader: ({ context, deps }) =>
		context.queryClient.ensureQueryData(forgeBatchOptions(deps.ids)),
	component: CompareView,
	errorComponent: CompareError,
});

function CompareView() {
	const { ids } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: results } = useForgeBatch(ids);

	// Build the list of present components in the order requested.
	const components = results.flatMap((row, index) =>
		row ? [{ row, requestedId: ids[index] }] : [],
	);
	const missing = ids.length - components.length;

	const removeColumn = (idToRemove: number) => {
		const next = ids.filter((id) => id !== idToRemove);
		if (next.length < 2) {
			// Falling below two columns — drop back to the list view.
			navigate({ to: "/", search: { compare: next } });
			return;
		}
		navigate({ to: "/compare", search: { ids: next }, replace: true });
	};

	return (
		<article className="space-y-6">
			<Link
				to="/"
				className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="size-4" aria-hidden />
				Back to search
			</Link>

			<header className="space-y-2">
				<p className="island-kicker">Compare</p>
				<h1 className="display-title font-bold text-3xl leading-tight tracking-tight md:text-4xl">
					Side-by-side
				</h1>
				<p className="text-muted-foreground">
					{components.length} components compared
					{missing > 0 ? ` · ${missing} not found` : ""}.
				</p>
			</header>

			{components.length === 0 ? (
				<EmptyState />
			) : (
				<CompareTable
					components={components.map((c) => c.row)}
					onRemove={removeColumn}
				/>
			)}
		</article>
	);
}

function EmptyState() {
	return (
		<div className="island-shell mx-auto max-w-xl rounded-2xl p-8 text-center">
			<p className="font-semibold">
				None of those components are in the catalogue.
			</p>
			<p className="mt-2 text-muted-foreground text-sm">
				They may have been removed from the Forge, or the scraper hasn't seen
				them yet.
			</p>
			<Link
				to="/"
				className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline"
			>
				<ArrowLeft className="size-4" aria-hidden />
				Back to search
			</Link>
		</div>
	);
}

function CompareError({ error }: { error: Error }) {
	return (
		<div className="island-shell mx-auto max-w-xl rounded-2xl p-8 text-center">
			<p className="font-semibold">Couldn't render comparison</p>
			<p className="mt-2 text-muted-foreground text-sm">
				{error.message.includes("at least 2")
					? "Pick at least two components from the list to compare them."
					: error.message.includes("at most 4")
						? "Comparison is capped at four components. Drop one before adding another."
						: error.message}
			</p>
			<Link
				to="/"
				className="mt-6 inline-flex items-center gap-1.5 text-sm hover:underline"
			>
				<ArrowLeft className="size-4" aria-hidden />
				Back to search
			</Link>
		</div>
	);
}
