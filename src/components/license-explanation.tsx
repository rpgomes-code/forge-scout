import { AlertTriangle, Scale } from "lucide-react";
import {
	colorClassesFor,
	getLicenseInfo,
	UNKNOWN_LICENSE,
} from "#/lib/licenses.ts";
import { cn } from "#/lib/utils.ts";

interface Props {
	/** License string from the Forge listing (scraped). */
	forgeLicense: string | null | undefined;
	/** License string from the linked GitHub repo (live). */
	githubLicense?: string | null | undefined;
}

/**
 * Full license intelligence section for the detail page. Shows the
 * canonical badge, a plain-language summary tailored to commercial use,
 * and a warning if the Forge listing and the linked GitHub repo disagree
 * on the licence (which happens often — Forge gets stale).
 */
export function LicenseExplanation({ forgeLicense, githubLicense }: Props) {
	const forgeInfo = getLicenseInfo(forgeLicense);
	const githubInfo = githubLicense ? getLicenseInfo(githubLicense) : null;

	// Both unknown → nothing useful to say; hide the section entirely.
	if (forgeInfo === UNKNOWN_LICENSE && !githubInfo) return null;

	// Prefer the source that gave us a real classification; if both, prefer
	// GitHub (it's the upstream authority for the SPDX id).
	const primary =
		githubInfo && githubInfo !== UNKNOWN_LICENSE ? githubInfo : forgeInfo;
	const cls = colorClassesFor(primary.kind);

	const mismatch =
		githubInfo &&
		githubInfo !== UNKNOWN_LICENSE &&
		forgeInfo !== UNKNOWN_LICENSE &&
		forgeInfo.id !== githubInfo.id;

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<Scale className="size-4" aria-hidden />
				<h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
					License intelligence
				</h2>
			</div>

			<div
				className={cn(
					"rounded-2xl border p-5",
					"bg-card",
					primary.kind === "permissive" || primary.kind === "public-domain"
						? "border-emerald-200/70 dark:border-emerald-900/40"
						: primary.kind === "weak-copyleft"
							? "border-amber-200/70 dark:border-amber-900/40"
							: primary.kind === "strong-copyleft" ||
									primary.kind === "proprietary"
								? "border-red-200/70 dark:border-red-900/40"
								: "border-muted",
				)}
			>
				<div className="flex items-start gap-3">
					<span
						className={cn(
							"mt-1 inline-block size-3 shrink-0 rounded-full",
							cls.dot,
						)}
						aria-hidden
					/>
					<div className="min-w-0 space-y-2">
						<p className={cn("font-semibold text-sm", cls.heading)}>
							{primary.displayName} ·{" "}
							<span className="font-normal text-muted-foreground">
								{kindLabel(primary.kind)}
							</span>
						</p>
						<p className="text-foreground/90 text-sm leading-relaxed">
							{primary.summary}
						</p>
					</div>
				</div>

				{mismatch && (
					<div className="mt-4 flex items-start gap-2 rounded-md border border-amber-300/70 bg-amber-50/60 p-3 text-amber-900 text-xs dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
						<div className="space-y-1">
							<p className="font-medium">Sources disagree on the license.</p>
							<p className="text-amber-900/90 dark:text-amber-300/90">
								Forge listing says <strong>{forgeInfo.id}</strong>; GitHub repo
								reports <strong>{githubInfo?.id}</strong>. The GitHub value is
								usually more current — but read the actual LICENSE file in the
								linked repo before relying on either.
							</p>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

function kindLabel(kind: ReturnType<typeof getLicenseInfo>["kind"]): string {
	switch (kind) {
		case "permissive":
			return "Permissive";
		case "public-domain":
			return "Public domain";
		case "weak-copyleft":
			return "Weak copyleft";
		case "strong-copyleft":
			return "Strong copyleft";
		case "proprietary":
			return "Proprietary";
		case "unknown":
			return "License not declared";
	}
}
