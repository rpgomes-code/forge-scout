import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "#/components/ui/input";

interface Props {
	/** External (URL-backed) value. */
	value: string;
	/** Called with the debounced value. */
	onChange: (next: string) => void;
	/** Debounce delay in ms. Default 300. */
	debounceMs?: number;
	placeholder?: string;
}

/**
 * Search input with two-level state:
 * - `local` updates on every keystroke (input stays responsive).
 * - `onChange` fires after `debounceMs` of inactivity OR on Enter.
 *
 * Syncing back from `value` lets external changes (URL nav, back button)
 * keep the input in step with the source of truth.
 */
export function SearchInput({
	value,
	onChange,
	debounceMs = 300,
	placeholder = "Search components by name, description, or slug…",
}: Props) {
	const [local, setLocal] = useState(value);
	const previousValueRef = useRef(value);

	// External → local: only when the external value genuinely changed (URL
	// nav, browser back), not when our own debounce wrote it.
	useEffect(() => {
		if (value !== previousValueRef.current) {
			setLocal(value);
			previousValueRef.current = value;
		}
	}, [value]);

	// Local → external: debounced.
	useEffect(() => {
		if (local === value) return;
		const timer = setTimeout(() => {
			previousValueRef.current = local;
			onChange(local);
		}, debounceMs);
		return () => clearTimeout(timer);
	}, [local, value, onChange, debounceMs]);

	return (
		<div className="relative">
			<Search
				className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 size-4 text-muted-foreground"
				aria-hidden
			/>
			<Input
				type="search"
				value={local}
				onChange={(event) => setLocal(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						previousValueRef.current = local;
						onChange(local);
					}
				}}
				placeholder={placeholder}
				className="h-12 pr-10 pl-10 text-base"
				aria-label="Search components"
			/>
			{local && (
				<button
					type="button"
					onClick={() => {
						setLocal("");
						previousValueRef.current = "";
						onChange("");
					}}
					className="-translate-y-1/2 absolute top-1/2 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
					aria-label="Clear search"
				>
					<X className="size-4" />
				</button>
			)}
		</div>
	);
}
