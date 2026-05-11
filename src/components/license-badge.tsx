import {
	colorClassesFor,
	getLicenseInfo,
	type LicenseKind,
} from "#/lib/licenses.ts";
import { cn } from "#/lib/utils.ts";

interface Props {
	/** Raw license string as it lives in the DB / GitHub. */
	license: string | null | undefined;
	/** `compact` for cards, `full` for the detail page hero. */
	size?: "compact" | "full";
	/** Override the displayed label (useful for "Forge: …" / "GitHub: …" prefixes). */
	prefix?: string;
}

/**
 * Colour-coded license badge. Green for permissive / public-domain, amber
 * for weak-copyleft, red for strong-copyleft / proprietary, grey for
 * unknown. Tooltip-friendly via the native `title` attribute — full
 * explanation lives in `<LicenseExplanation />`.
 */
export function LicenseBadge({ license, size = "compact", prefix }: Props) {
	const info = getLicenseInfo(license);
	const cls = colorClassesFor(info.kind);
	const label = prefix ? `${prefix}: ${info.id}` : info.id;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border font-medium leading-tight tracking-wide",
				size === "compact" ? "px-2 py-0.5 text-[10.5px]" : "px-3 py-1 text-xs",
				cls.pill,
			)}
			title={info.summary}
		>
			<KindDot kind={info.kind} />
			{label}
		</span>
	);
}

function KindDot({ kind }: { kind: LicenseKind }) {
	const cls = colorClassesFor(kind);
	return (
		<span
			className={cn("inline-block size-2 shrink-0 rounded-full", cls.dot)}
			aria-hidden
		/>
	);
}
