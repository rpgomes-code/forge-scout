import { Calendar, Download, Star } from "lucide-react";
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
}

export function ComponentCard({ component }: Props) {
	const updated = formatRelativeDate(component.lastUpdated);
	return (
		<Card className="feature-card transition">
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
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
							<span className="font-medium">{component.rating.toFixed(1)}</span>
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
					{component.license && <Pill kind="license">{component.license}</Pill>}
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
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type PillKind = "platform" | "badge" | "license";

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
				kind === "license" &&
					"border-muted-foreground/30 bg-muted/50 text-foreground/80",
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
