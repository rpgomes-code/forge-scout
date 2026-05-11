import {
	createFileRoute,
	Link,
	notFound,
	useRouter,
} from "@tanstack/react-router";
import {
	ArrowLeft,
	Calendar,
	Clock,
	Download,
	ExternalLink,
	Github,
	Star,
} from "lucide-react";
import { cn } from "#/lib/utils.ts";
import { forgeDetailOptions, useForgeDetail } from "#/queries/forge.ts";

export const Route = createFileRoute("/component/$id")({
	loader: async ({ params, context }) => {
		const id = Number(params.id);
		if (!Number.isFinite(id) || id <= 0) throw notFound();
		const data = await context.queryClient.ensureQueryData(
			forgeDetailOptions(id),
		);
		if (!data) throw notFound();
		return data;
	},
	component: ComponentDetail,
	notFoundComponent: ComponentNotFound,
});

function ComponentDetail() {
	const { id: idStr } = Route.useParams();
	const router = useRouter();
	const id = Number(idStr);
	const { data: component } = useForgeDetail(id);

	// Loader guarantees this is non-null, but the query type allows null —
	// fall through to notFound for safety.
	if (!component) throw notFound();

	const forgeUrl = `https://www.outsystems.com/forge/component-overview/${component.id}/${component.slug}`;
	const updated = formatRelativeDate(component.lastUpdated);
	const scraped = formatRelativeDate(component.scrapedAt);

	return (
		<article className="space-y-8">
			<button
				type="button"
				onClick={() => router.history.back()}
				className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="size-4" aria-hidden />
				Back to search
			</button>

			<header className="space-y-5">
				<div className="space-y-3">
					<p className="island-kicker">Component #{component.id}</p>
					<h1 className="display-title font-bold text-3xl leading-tight tracking-tight md:text-4xl">
						{component.name}
					</h1>
					{component.author && (
						<p className="text-muted-foreground">
							by <span className="text-foreground">{component.author}</span>
						</p>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{component.rating !== null && (
						<div className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1 text-sm">
							<Star className="size-4 fill-yellow-500 text-yellow-500" />
							<span className="font-semibold">
								{component.rating.toFixed(1)}
							</span>
							<span className="text-muted-foreground">/ 5</span>
						</div>
					)}
					{component.platform.map((p) => (
						<Pill key={p} kind="platform">
							{p}
						</Pill>
					))}
					{component.badges.map((b) => (
						<Pill key={b} kind="badge">
							{b}
						</Pill>
					))}
					{component.license && <Pill kind="license">{component.license}</Pill>}
				</div>

				<div className="flex flex-wrap gap-3">
					<a
						href={forgeUrl}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
					>
						<ExternalLink className="size-4" aria-hidden />
						View on Forge
					</a>
					{component.githubUrl && (
						<a
							href={component.githubUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 font-medium text-sm hover:bg-accent"
						>
							<Github className="size-4" aria-hidden />
							Source on GitHub
						</a>
					)}
				</div>
			</header>

			<section className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
				<Stat
					icon={<Download className="size-4" aria-hidden />}
					label="Downloads"
					value={component.downloads.toLocaleString()}
				/>
				<Stat
					icon={<Calendar className="size-4" aria-hidden />}
					label="Last updated"
					value={updated ?? "—"}
				/>
				<Stat label="Category" value={component.category ?? "Uncategorised"} />
				<Stat label="Source" value={component.source} />
			</section>

			{component.description && (
				<section className="island-shell rounded-2xl p-6">
					<h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
						Description
					</h2>
					<p className="mt-3 whitespace-pre-line text-foreground/90 leading-relaxed">
						{component.description}
					</p>
				</section>
			)}

			{component.tags.length > 0 && (
				<section className="space-y-2">
					<h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
						Tags
					</h2>
					<div className="flex flex-wrap gap-1.5">
						{component.tags.map((tag) => (
							<Pill key={tag} kind="tag">
								{tag}
							</Pill>
						))}
					</div>
				</section>
			)}

			<footer className="flex items-center gap-1.5 text-muted-foreground text-xs">
				<Clock className="size-3.5" aria-hidden />
				Data last refreshed {scraped ?? "recently"} via {component.source}
			</footer>
		</article>
	);
}

function ComponentNotFound() {
	return (
		<div className="island-shell mx-auto max-w-xl rounded-2xl p-8 text-center">
			<p className="font-semibold text-lg">Component not found</p>
			<p className="mt-2 text-muted-foreground text-sm">
				This component isn't in the catalogue. It may have been removed from the
				Forge, or the scraper hasn't seen it yet.
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

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

function Stat({
	icon,
	label,
	value,
}: {
	icon?: React.ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="rounded-xl border bg-card p-4">
			<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			<div className="mt-1.5 flex items-center gap-1.5 font-semibold">
				{icon}
				<span>{value}</span>
			</div>
		</div>
	);
}

type PillKind = "platform" | "badge" | "license" | "tag";

function Pill({
	kind,
	children,
}: {
	kind: PillKind;
	children: React.ReactNode;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs leading-tight tracking-wide",
				kind === "platform" &&
					"border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200",
				kind === "badge" &&
					"border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
				kind === "license" &&
					"border-muted-foreground/30 bg-muted/50 text-foreground/80",
				kind === "tag" && "border-input bg-background text-foreground/80",
			)}
		>
			{children}
		</span>
	);
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function formatRelativeDate(date: Date | string | null): string | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (!Number.isFinite(d.getTime())) return null;
	const diffMs = d.getTime() - Date.now();
	const days = Math.round(diffMs / DAY_MS);
	if (Math.abs(days) < 1) return "today";
	if (Math.abs(days) < 30) return RELATIVE_TIME.format(days, "day");
	const months = Math.round(diffMs / MONTH_MS);
	if (Math.abs(months) < 12) return RELATIVE_TIME.format(months, "month");
	const years = Math.round(months / 12);
	return RELATIVE_TIME.format(years, "year");
}
