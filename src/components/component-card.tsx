import { Link } from "@tanstack/react-router";
import { Calendar, Check, Download, Plus, Star } from "lucide-react";
import { LicenseBadge } from "#/components/license-badge.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { ForgeComponent } from "#/db/schema.ts";
import { cn } from "#/lib/utils.ts";

interface Props {
	component: ForgeComponent;
	/** Show + handle the compare-selection toggle in the corner. */
	selectable?: {
		isSelected: boolean;
		onToggle: () => void;
		/**
		 * `false` when the selection cap is hit (e.g. already at 4) and this
		 * specific card isn't selected — disables the add toggle.
		 */
		canSelect: boolean;
	};
}

export function ComponentCard({ component, selectable }: Props) {
	const updated = formatRelativeDate(component.lastUpdated);
	return (
		<div className="relative">
			<Link
				to="/component/$id"
				params={{ id: String(component.id) }}
				className="block rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<Card
					className={cn(
						"feature-card h-full transition",
						selectable?.isSelected &&
							"border-primary/60 ring-2 ring-primary/30",
					)}
				>
					<CardHeader>
						<div className="flex items-start justify-between gap-3">
							<div
								className={cn(
									"min-w-0 space-y-1",
									selectable && "pr-8", // make room for the toggle
								)}
							>
								<CardTitle className="truncate text-base font-semibold">
									{component.name}
								</CardTitle>
								{component.author && (
									<p className="text-xs text-muted-foreground">
										by {component.author}
									</p>
								)}
							</div>
							{component.rating !== null && (
								<div className="flex shrink-0 items-center gap-1 text-sm">
									<Star className="size-4 fill-yellow-500 text-yellow-500" />
									<span className="font-medium">
										{component.rating.toFixed(1)}
									</span>
								</div>
							)}
						</div>

						{component.description && (
							<CardDescription className="line-clamp-2">
								{component.description}
							</CardDescription>
						)}
					</CardHeader>

					<CardContent className="space-y-3">
						<div className="flex flex-wrap gap-1.5">
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
							{component.license && (
								<LicenseBadge license={component.license} />
							)}
						</div>

						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<Download className="size-3.5" />
								{formatCount(component.downloads)}
							</span>
							{updated && (
								<span className="inline-flex items-center gap-1">
									<Calendar className="size-3.5" />
									{updated}
								</span>
							)}
						</div>
					</CardContent>
				</Card>
			</Link>

			{selectable && (
				<button
					type="button"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						selectable.onToggle();
					}}
					disabled={!selectable.isSelected && !selectable.canSelect}
					aria-pressed={selectable.isSelected}
					aria-label={
						selectable.isSelected
							? `Remove ${component.name} from comparison`
							: `Add ${component.name} to comparison`
					}
					title={
						!selectable.isSelected && !selectable.canSelect
							? "Comparison is capped at 4 components"
							: undefined
					}
					className={cn(
						"absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-full border text-xs transition",
						selectable.isSelected
							? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
							: "border-input bg-background/90 backdrop-blur-sm hover:bg-accent",
						!selectable.isSelected &&
							!selectable.canSelect &&
							"cursor-not-allowed opacity-40",
					)}
				>
					{selectable.isSelected ? (
						<Check className="size-3.5" aria-hidden />
					) : (
						<Plus className="size-3.5" aria-hidden />
					)}
				</button>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type PillKind = "platform" | "badge";

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
				"inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium leading-tight tracking-wide",
				kind === "platform" &&
					"border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200",
				kind === "badge" &&
					"border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
			)}
		>
			{children}
		</span>
	);
}

function formatCount(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function formatRelativeDate(date: Date | string | null): string | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (!Number.isFinite(d.getTime())) return null;
	const diffMs = d.getTime() - Date.now();
	const months = Math.round(diffMs / MONTH_MS);
	if (months === 0) return "this month";
	if (Math.abs(months) < 12) return RELATIVE_TIME.format(months, "month");
	const years = Math.round(months / 12);
	return RELATIVE_TIME.format(years, "year");
}
