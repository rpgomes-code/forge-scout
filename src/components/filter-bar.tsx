import { Star, X } from "lucide-react";
import { cn } from "#/lib/utils.ts";

/** Platforms surfaced as toggleable chips. Order is intentional (O11 first). */
const PLATFORMS = ["O11", "ODC"] as const;

/** Trust badges scrapeable from the Forge today. */
const BADGES = ["OutSystems Supported", "Trusted"] as const;

/** Rating thresholds — descending so the strictest filter is first. */
const RATING_THRESHOLDS = [4, 3, 2] as const;

export interface FilterValues {
	platform: Array<string>;
	badges: Array<string>;
	minRating: number | undefined;
}

interface Props extends FilterValues {
	/** Called with the updated subset of fields. */
	onChange: (
		next: Partial<{
			platform: Array<string>;
			badges: Array<string>;
			minRating: number | undefined;
		}>,
	) => void;
}

/**
 * Filter row above search results. Filters are independent (changing one
 * doesn't reset the others) and OR-combined within a dimension, AND-combined
 * across dimensions — matches the standard faceted-search pattern.
 */
export function FilterBar({ platform, badges, minRating, onChange }: Props) {
	const togglePlatform = (value: string) => {
		const next = platform.includes(value)
			? platform.filter((item) => item !== value)
			: [...platform, value];
		onChange({ platform: next });
	};

	const toggleBadge = (value: string) => {
		const next = badges.includes(value)
			? badges.filter((item) => item !== value)
			: [...badges, value];
		onChange({ badges: next });
	};

	const setRating = (value: number) => {
		onChange({ minRating: minRating === value ? undefined : value });
	};

	const clearAll = () => {
		onChange({ platform: [], badges: [], minRating: undefined });
	};

	const anyActive =
		platform.length > 0 || badges.length > 0 || minRating !== undefined;

	return (
		<div
			role="toolbar"
			aria-label="Filter results"
			className="flex flex-wrap items-center gap-2"
		>
			<FilterGroup label="Platform">
				{PLATFORMS.map((value) => (
					<Chip
						key={value}
						active={platform.includes(value)}
						onClick={() => togglePlatform(value)}
					>
						{value}
					</Chip>
				))}
			</FilterGroup>

			<Divider />

			<FilterGroup label="Trust">
				{BADGES.map((value) => (
					<Chip
						key={value}
						active={badges.includes(value)}
						onClick={() => toggleBadge(value)}
					>
						{value}
					</Chip>
				))}
			</FilterGroup>

			<Divider />

			<FilterGroup label="Min rating">
				{RATING_THRESHOLDS.map((value) => (
					<Chip
						key={value}
						active={minRating === value}
						onClick={() => setRating(value)}
					>
						<Star className="size-3" aria-hidden />
						{value}+
					</Chip>
				))}
			</FilterGroup>

			{anyActive && (
				<button
					type="button"
					onClick={clearAll}
					className="ml-auto inline-flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
				>
					<X className="size-3" aria-hidden />
					Clear all
				</button>
			)}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

function FilterGroup({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="font-medium text-[10.5px] text-muted-foreground uppercase tracking-wide">
				{label}
			</span>
			{children}
		</div>
	);
}

function Divider() {
	return <span className="hidden h-4 w-px bg-border md:inline-block" />;
}

function Chip({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium text-xs transition",
				active
					? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
					: "border-input bg-background hover:bg-accent",
			)}
		>
			{children}
		</button>
	);
}
