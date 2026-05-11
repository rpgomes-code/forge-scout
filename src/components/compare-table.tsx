import { useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Calendar,
	ExternalLink,
	GitFork,
	Github,
	GitPullRequest,
	Star,
	X,
} from "lucide-react";
import { LicenseBadge } from "#/components/license-badge.tsx";
import type { ForgeComponent } from "#/db/schema.ts";
import { githubHealthOptions } from "#/queries/github.ts";

interface Props {
	components: Array<ForgeComponent>;
	/** Called when the user clicks the × on a column. */
	onRemove?: (id: number) => void;
}

/**
 * Side-by-side comparison of 2-4 Forge components. Forge metadata renders
 * synchronously from the route loader; per-column GitHub stats stream in
 * via `useQueries` (one query per component with a github_url, all sharing
 * the same cache as the detail page's GitHubStats).
 *
 * Layout: rows of attributes on small screens stack into per-component
 * cards via the responsive grid; on lg+ they sit in a single grid.
 */
export function CompareTable({ components, onRemove }: Props) {
	const ghResults = useQueries({
		queries: components.map((c) => githubHealthOptions(c.githubUrl ?? "")),
		combine: (results) =>
			results.map((r, index) => ({
				data: components[index]?.githubUrl ? r.data : undefined,
				isLoading: components[index]?.githubUrl ? r.isLoading : false,
			})),
	});

	const cols = components.length;
	const gridCols =
		cols === 2
			? "lg:grid-cols-[180px_repeat(2,minmax(0,1fr))]"
			: cols === 3
				? "lg:grid-cols-[180px_repeat(3,minmax(0,1fr))]"
				: "lg:grid-cols-[180px_repeat(4,minmax(0,1fr))]";

	return (
		<div className={`grid gap-3 ${gridCols}`}>
			{/* Header row: empty corner + each component header */}
			<RowLabel />
			{components.map((c, i) => (
				<HeaderCell key={c.id} component={c} onRemove={onRemove} index={i} />
			))}

			<Row label="Rating">
				{components.map((c) => (
					<Cell key={c.id}>
						{c.rating !== null ? (
							<span className="inline-flex items-center gap-1.5">
								<Star
									className="size-4 fill-yellow-500 text-yellow-500"
									aria-hidden
								/>
								<span className="font-semibold">{c.rating.toFixed(1)}</span>
							</span>
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</Cell>
				))}
			</Row>

			<Row label="Downloads">
				{components.map((c) => (
					<Cell key={c.id} className="font-semibold">
						{c.downloads.toLocaleString()}
					</Cell>
				))}
			</Row>

			<Row label="Last update">
				{components.map((c) => {
					const text = formatRelativeDate(c.lastUpdated);
					return (
						<Cell key={c.id} className="inline-flex items-center gap-1.5">
							{text && <Calendar className="size-3.5" aria-hidden />}
							{text ?? <span className="text-muted-foreground">—</span>}
						</Cell>
					);
				})}
			</Row>

			<Row label="Platform">
				{components.map((c) => (
					<Cell key={c.id}>
						{c.platform.length > 0 ? (
							<div className="flex flex-wrap gap-1.5">
								{c.platform.map((p) => (
									<Pill key={p}>{p}</Pill>
								))}
							</div>
						) : (
							<span className="text-muted-foreground">—</span>
						)}
					</Cell>
				))}
			</Row>

			<Row label="License">
				{components.map((c) => (
					<Cell key={c.id}>
						{c.license ? (
							<LicenseBadge license={c.license} />
						) : (
							<span className="text-muted-foreground text-xs">
								Not declared
							</span>
						)}
					</Cell>
				))}
			</Row>

			<Row label="Category">
				{components.map((c) => (
					<Cell key={c.id} className="text-sm">
						{c.category ?? (
							<span className="text-muted-foreground">Uncategorised</span>
						)}
					</Cell>
				))}
			</Row>

			<Row label="Author">
				{components.map((c) => (
					<Cell key={c.id} className="text-sm">
						{c.author ?? <span className="text-muted-foreground">—</span>}
					</Cell>
				))}
			</Row>

			<SectionDivider label="GitHub" />

			<Row label="Stars">
				{components.map((c, i) => (
					<GitHubCell
						key={c.id}
						hasUrl={!!c.githubUrl}
						loading={ghResults[i]?.isLoading ?? false}
						value={ghResults[i]?.data?.stars.toLocaleString()}
						icon={<Star className="size-3.5" aria-hidden />}
					/>
				))}
			</Row>

			<Row label="Forks">
				{components.map((c, i) => (
					<GitHubCell
						key={c.id}
						hasUrl={!!c.githubUrl}
						loading={ghResults[i]?.isLoading ?? false}
						value={ghResults[i]?.data?.forks.toLocaleString()}
						icon={<GitFork className="size-3.5" aria-hidden />}
					/>
				))}
			</Row>

			<Row label="Open issues">
				{components.map((c, i) => (
					<GitHubCell
						key={c.id}
						hasUrl={!!c.githubUrl}
						loading={ghResults[i]?.isLoading ?? false}
						value={ghResults[i]?.data?.openIssues.toLocaleString()}
						icon={<GitPullRequest className="size-3.5" aria-hidden />}
					/>
				))}
			</Row>

			<Row label="Last push">
				{components.map((c, i) => {
					const pushed = ghResults[i]?.data?.lastPushAt;
					return (
						<GitHubCell
							key={c.id}
							hasUrl={!!c.githubUrl}
							loading={ghResults[i]?.isLoading ?? false}
							value={
								pushed ? (formatRelativeDate(pushed) ?? undefined) : undefined
							}
						/>
					);
				})}
			</Row>

			<Row label="GitHub SPDX">
				{components.map((c, i) => {
					const spdx = ghResults[i]?.data?.spdxLicense;
					return (
						<GitHubCell
							key={c.id}
							hasUrl={!!c.githubUrl}
							loading={ghResults[i]?.isLoading ?? false}
							value={spdx ?? undefined}
						/>
					);
				})}
			</Row>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

function RowLabel({ children }: { children?: React.ReactNode }) {
	return (
		<div className="hidden font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:flex lg:items-center">
			{children}
		</div>
	);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<>
			<RowLabel>{label}</RowLabel>
			<MobileRowLabel>{label}</MobileRowLabel>
			{children}
		</>
	);
}

function MobileRowLabel({ children }: { children: React.ReactNode }) {
	return (
		<div className="-mb-2 col-span-full font-semibold text-muted-foreground text-xs uppercase tracking-wide lg:hidden">
			{children}
		</div>
	);
}

function HeaderCell({
	component,
	onRemove,
	index,
}: {
	component: ForgeComponent;
	onRemove?: (id: number) => void;
	index: number;
}) {
	return (
		<div className="relative space-y-1 rounded-xl border bg-card p-4">
			{onRemove && (
				<button
					type="button"
					onClick={() => onRemove(component.id)}
					className="absolute top-2 right-2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label={`Remove ${component.name} from comparison`}
				>
					<X className="size-3.5" aria-hidden />
				</button>
			)}
			<p className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-wide">
				Component {index + 1}
			</p>
			<Link
				to="/component/$id"
				params={{ id: String(component.id) }}
				className="block truncate font-semibold text-base leading-tight hover:underline"
			>
				{component.name}
			</Link>
			<a
				href={`https://www.outsystems.com/forge/component-overview/${component.id}/${component.slug}`}
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
			>
				<ExternalLink className="size-3" aria-hidden />
				on Forge
			</a>
		</div>
	);
}

function Cell({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`rounded-xl border bg-card p-4 ${className}`}>
			{children}
		</div>
	);
}

function GitHubCell({
	hasUrl,
	loading,
	value,
	icon,
}: {
	hasUrl: boolean;
	loading: boolean;
	value: string | undefined;
	icon?: React.ReactNode;
}) {
	if (!hasUrl) {
		return (
			<Cell className="text-muted-foreground text-xs">
				<span className="inline-flex items-center gap-1.5">
					<Github className="size-3.5" aria-hidden />
					No GitHub link
				</span>
			</Cell>
		);
	}
	if (loading) {
		return <Cell className="text-muted-foreground text-xs">Loading…</Cell>;
	}
	if (!value) {
		return (
			<Cell className="text-muted-foreground text-xs">Couldn't fetch</Cell>
		);
	}
	return (
		<Cell className="inline-flex items-center gap-1.5 font-semibold text-sm">
			{icon}
			{value}
		</Cell>
	);
}

function SectionDivider({ label }: { label: string }) {
	return (
		<div className="col-span-full mt-2 flex items-center gap-2 text-muted-foreground text-xs">
			<Github className="size-3.5" aria-hidden />
			<span className="font-semibold uppercase tracking-wide">{label}</span>
			<span className="h-px flex-1 bg-border" />
		</div>
	);
}

function Pill({ children }: { children: React.ReactNode }) {
	return (
		<span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-[10.5px] text-sky-900 leading-tight tracking-wide dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200">
			{children}
		</span>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function formatRelativeDate(date: Date | string | null): string | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (!Number.isFinite(d.getTime())) return null;
	const diffMs = d.getTime() - Date.now();
	const days = Math.round(diffMs / DAY_MS);
	if (Math.abs(days) < 30) return RELATIVE_TIME.format(days, "day");
	const months = Math.round(diffMs / MONTH_MS);
	if (Math.abs(months) < 12) return RELATIVE_TIME.format(months, "month");
	const years = Math.round(months / 12);
	return RELATIVE_TIME.format(years, "year");
}
