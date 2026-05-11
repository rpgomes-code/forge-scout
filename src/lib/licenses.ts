/**
 * License intelligence — maps SPDX identifiers (and some loose human
 * spellings the scraper coughs up) to a classification, colour, and
 * plain-language explanation tailored to the "I want to use this in a
 * commercial OutSystems app" use case.
 *
 * Source of truth for SPDX IDs: https://spdx.org/licenses/
 */

export type LicenseKind =
	| "permissive"
	| "weak-copyleft"
	| "strong-copyleft"
	| "proprietary"
	| "public-domain"
	| "unknown";

export interface LicenseInfo {
	/** Canonical SPDX id (or "Proprietary"/"Unknown" for non-OSI). */
	id: string;
	/** Human-readable name. */
	displayName: string;
	/** Classification driving colour + warnings. */
	kind: LicenseKind;
	/**
	 * Plain-language explanation in commercial-use terms — what you can /
	 * can't do, and what you must do if you use this component in a
	 * proprietary OutSystems app.
	 */
	summary: string;
}

const LICENSES: Record<string, LicenseInfo> = {
	// ── Permissive ─────────────────────────────────────────────────────────
	MIT: {
		id: "MIT",
		displayName: "MIT License",
		kind: "permissive",
		summary:
			"Free for commercial use. You can modify, distribute, and use in proprietary software. Just include the license text and copyright notice with your distribution.",
	},
	"BSD-3-Clause": {
		id: "BSD-3-Clause",
		displayName: "BSD 3-Clause License",
		kind: "permissive",
		summary:
			"Free for commercial use. Include the license text and copyright notice with your distribution. You can't use the original authors' names to endorse derived products without permission.",
	},
	"BSD-2-Clause": {
		id: "BSD-2-Clause",
		displayName: "BSD 2-Clause License",
		kind: "permissive",
		summary:
			"Free for commercial use. Include the license text and copyright notice with your distribution.",
	},
	"Apache-2.0": {
		id: "Apache-2.0",
		displayName: "Apache License 2.0",
		kind: "permissive",
		summary:
			"Free for commercial use. Include the license text and copyright notice with your distribution. Includes an explicit patent grant — safer than MIT/BSD if patents are a concern.",
	},
	ISC: {
		id: "ISC",
		displayName: "ISC License",
		kind: "permissive",
		summary:
			"Effectively MIT with simpler wording. Free for commercial use; include the license text and copyright notice.",
	},
	"0BSD": {
		id: "0BSD",
		displayName: "BSD Zero Clause License",
		kind: "permissive",
		summary:
			"As permissive as it gets — use freely with no attribution requirement.",
	},

	// ── Public domain / equivalent ─────────────────────────────────────────
	"CC0-1.0": {
		id: "CC0-1.0",
		displayName: "CC0 1.0 Public Domain",
		kind: "public-domain",
		summary:
			"Released into the public domain. Use however you like, no attribution required.",
	},
	Unlicense: {
		id: "Unlicense",
		displayName: "The Unlicense",
		kind: "public-domain",
		summary:
			"Released into the public domain. Use however you like, no attribution required.",
	},

	// ── Weak copyleft ──────────────────────────────────────────────────────
	"MPL-2.0": {
		id: "MPL-2.0",
		displayName: "Mozilla Public License 2.0",
		kind: "weak-copyleft",
		summary:
			"File-level copyleft. You can use it in a proprietary product, but modifications to MPL files themselves must remain open-source under MPL. Linking and combining with proprietary code is fine.",
	},
	"LGPL-3.0": {
		id: "LGPL-3.0",
		displayName: "GNU Lesser GPL 3.0",
		kind: "weak-copyleft",
		summary:
			"Linkage copyleft. You can use it in a proprietary product if you link dynamically (or otherwise allow the user to swap the LGPL component). Modifications to the LGPL component itself must be open-source.",
	},
	"LGPL-2.1": {
		id: "LGPL-2.1",
		displayName: "GNU Lesser GPL 2.1",
		kind: "weak-copyleft",
		summary:
			"Linkage copyleft. You can use it in a proprietary product if you link dynamically. Modifications to the LGPL component itself must be open-source.",
	},
	"EPL-2.0": {
		id: "EPL-2.0",
		displayName: "Eclipse Public License 2.0",
		kind: "weak-copyleft",
		summary:
			"File-level copyleft. Combining with proprietary code is fine; modifications to EPL files must remain open-source under EPL.",
	},
	"CDDL-1.0": {
		id: "CDDL-1.0",
		displayName: "Common Development and Distribution License 1.0",
		kind: "weak-copyleft",
		summary:
			"File-level copyleft, similar to MPL. Modifications to CDDL files stay open-source; combining with proprietary code is fine.",
	},

	// ── Strong copyleft ────────────────────────────────────────────────────
	"GPL-3.0": {
		id: "GPL-3.0",
		displayName: "GNU GPL 3.0",
		kind: "strong-copyleft",
		summary:
			"Distributing software that uses this component requires releasing the entire derived work under GPL-3.0. If you're building a closed-source commercial OutSystems app, look for a permissive alternative.",
	},
	"GPL-2.0": {
		id: "GPL-2.0",
		displayName: "GNU GPL 2.0",
		kind: "strong-copyleft",
		summary:
			"Distributing software that uses this component requires releasing the entire derived work under GPL-2.0. Not compatible with closed-source distribution.",
	},
	"AGPL-3.0": {
		id: "AGPL-3.0",
		displayName: "GNU Affero GPL 3.0",
		kind: "strong-copyleft",
		summary:
			"Strong copyleft that triggers on network use too — even hosting an AGPL component as a service obligates you to release source. Almost always wrong for proprietary SaaS.",
	},

	// ── Proprietary / unknown ──────────────────────────────────────────────
	Proprietary: {
		id: "Proprietary",
		displayName: "Proprietary",
		kind: "proprietary",
		summary:
			"Custom terms — read the component's specific licence before using commercially. There may be restrictions on redistribution, modification, or use in competing products.",
	},
};

/**
 * Catch loose spellings the scraper might emit before normalising to SPDX.
 * Lower-case keys; values are SPDX-canonical.
 */
const ALIASES: Record<string, string> = {
	"bsd-3": "BSD-3-Clause",
	"bsd 3": "BSD-3-Clause",
	"bsd 3-clause": "BSD-3-Clause",
	"bsd-2": "BSD-2-Clause",
	"bsd 2": "BSD-2-Clause",
	"apache 2": "Apache-2.0",
	"apache 2.0": "Apache-2.0",
	"apache-2": "Apache-2.0",
	"gpl v2": "GPL-2.0",
	gplv2: "GPL-2.0",
	"gpl 2": "GPL-2.0",
	"gpl-2": "GPL-2.0",
	"gpl v3": "GPL-3.0",
	gplv3: "GPL-3.0",
	"gpl 3": "GPL-3.0",
	"gpl-3": "GPL-3.0",
	"agpl v3": "AGPL-3.0",
	agplv3: "AGPL-3.0",
	"lgpl v2.1": "LGPL-2.1",
	"lgpl-2": "LGPL-2.1",
	"lgpl v3": "LGPL-3.0",
	"lgpl-3": "LGPL-3.0",
	"mpl 2": "MPL-2.0",
	"mpl-2": "MPL-2.0",
};

export const UNKNOWN_LICENSE: LicenseInfo = {
	id: "Unknown",
	displayName: "No license declared",
	kind: "unknown",
	summary:
		"No license is declared in the Forge listing. By default, undeclared work is all-rights-reserved — you can read the code but you can't redistribute or modify it. Ask the author or treat as proprietary.",
};

/** Look up license metadata, coercing loose spellings to SPDX where possible. */
export function getLicenseInfo(raw: string | null | undefined): LicenseInfo {
	if (!raw || !raw.trim()) return UNKNOWN_LICENSE;

	const trimmed = raw.trim();
	if (LICENSES[trimmed]) return LICENSES[trimmed];

	const aliasKey = trimmed.toLowerCase();
	const spdx = ALIASES[aliasKey];
	if (spdx && LICENSES[spdx]) return LICENSES[spdx];

	// Case-insensitive direct match
	const ciMatch = Object.keys(LICENSES).find(
		(key) => key.toLowerCase() === aliasKey,
	);
	if (ciMatch) return LICENSES[ciMatch];

	// Unknown — surface the raw value so the user has something to copy
	return { ...UNKNOWN_LICENSE, id: trimmed, displayName: trimmed };
}

/** Tailwind class fragments for badge / accent rendering. */
export function colorClassesFor(kind: LicenseKind): {
	pill: string;
	dot: string;
	heading: string;
} {
	switch (kind) {
		case "permissive":
		case "public-domain":
			return {
				pill: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
				dot: "bg-emerald-500",
				heading: "text-emerald-700 dark:text-emerald-300",
			};
		case "weak-copyleft":
			return {
				pill: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
				dot: "bg-amber-500",
				heading: "text-amber-700 dark:text-amber-300",
			};
		case "strong-copyleft":
		case "proprietary":
			return {
				pill: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200",
				dot: "bg-red-500",
				heading: "text-red-700 dark:text-red-300",
			};
		case "unknown":
			return {
				pill: "border-muted-foreground/30 bg-muted/50 text-foreground/70",
				dot: "bg-muted-foreground/50",
				heading: "text-muted-foreground",
			};
	}
}
