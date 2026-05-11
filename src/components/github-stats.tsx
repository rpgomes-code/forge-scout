import {
	AlertCircle,
	GitFork,
	Github,
	GitPullRequest,
	Loader2,
	Star,
} from "lucide-react";
import { useGitHubHealth } from "#/queries/github.ts";

interface Props {
	repoUrl: string;
}

/**
 * Live GitHub repo health for a component's linked repo. Rendered on the
 * detail page below the metadata grid. Quiet about failures — if GitHub
 * is rate-limited or the repo is gone, we just don't render anything.
 */
export function GitHubStats({ repoUrl }: Props) {
	const { data, isLoading, isError } = useGitHubHealth(repoUrl);

	if (isLoading) {
		return (
			<section className="space-y-2">
				<SectionHeader />
				<div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
					<Loader2 className="size-3.5 animate-spin" aria-hidden />
					Fetching from GitHub…
				</div>
			</section>
		);
	}

	if (isError || !data) {
		// Stay quiet — secondary data, not worth a noisy error.
		return null;
	}

	const lastPush = formatRelativeDate(data.lastPushAt);
	const lastCommit = formatRelativeDate(data.lastCommitAt);
	const fetched = formatRelativeDate(data.fetchedAt);
	const freshness = freshnessOf(data.lastPushAt);

	return (
		<section className="space-y-3">
			<SectionHeader />

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Stat
					icon={<Star className="size-4" aria-hidden />}
					label="Stars"
					value={data.stars.toLocaleString()}
				/>
				<Stat
					icon={<GitFork className="size-4" aria-hidden />}
					label="Forks"
					value={data.forks.toLocaleString()}
				/>
				<Stat
					icon={<GitPullRequest className="size-4" aria-hidden />}
					label="Open issues"
					value={data.openIssues.toLocaleString()}
				/>
				<Stat
					icon={
						<span
							className={`inline-block size-2 shrink-0 rounded-full ${
								freshness === "fresh"
									? "bg-emerald-500"
									: freshness === "stale"
										? "bg-amber-500"
										: "bg-red-500"
							}`}
							aria-hidden
						/>
					}
					label="Last push"
					value={lastPush ?? "—"}
				/>
			</div>

			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
				{data.spdxLicense && <span>GitHub license: {data.spdxLicense}</span>}
				{data.defaultBranch && (
					<span>Default branch: {data.defaultBranch}</span>
				)}
				{lastCommit && lastCommit !== lastPush && (
					<span>Last commit on default: {lastCommit}</span>
				)}
				<span className="ml-auto inline-flex items-center gap-1">
					<AlertCircle className="size-3" aria-hidden />
					Cached for 1 hour · refreshed {fetched ?? "now"}
				</span>
			</div>
		</section>
	);
}

function SectionHeader() {
	return (
		<div className="flex items-center gap-2">
			<Github className="size-4" aria-hidden />
			<h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
				GitHub repo health
			</h2>
		</div>
	);
}

function Stat({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
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

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * DAY_MS;

function formatRelativeDate(date: Date | string | null): string | null {
	if (!date) return null;
	const d = date instanceof Date ? date : new Date(date);
	if (!Number.isFinite(d.getTime())) return null;
	const diffMs = d.getTime() - Date.now();
	const minutes = Math.round(diffMs / 60_000);
	if (Math.abs(minutes) < 60) {
		if (Math.abs(minutes) < 1) return "just now";
		return RELATIVE_TIME.format(minutes, "minute");
	}
	const hours = Math.round(diffMs / (60 * 60_000));
	if (Math.abs(hours) < 24) return RELATIVE_TIME.format(hours, "hour");
	const days = Math.round(diffMs / DAY_MS);
	if (Math.abs(days) < 30) return RELATIVE_TIME.format(days, "day");
	const months = Math.round(diffMs / MONTH_MS);
	if (Math.abs(months) < 12) return RELATIVE_TIME.format(months, "month");
	const years = Math.round(months / 12);
	return RELATIVE_TIME.format(years, "year");
}

type Freshness = "fresh" | "stale" | "abandoned";

/**
 * Traffic-light style health indicator based on the original Forge Scout
 * design doc (green ≤6 months, yellow 6-12 months, red 12+ months).
 */
function freshnessOf(lastPushAt: Date | string | null): Freshness {
	if (!lastPushAt) return "abandoned";
	const d = lastPushAt instanceof Date ? lastPushAt : new Date(lastPushAt);
	const months = (Date.now() - d.getTime()) / MONTH_MS;
	if (months <= 6) return "fresh";
	if (months <= 12) return "stale";
	return "abandoned";
}
