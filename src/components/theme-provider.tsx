import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
} from "next-themes";

/**
 * Theme provider for Forge Scout.
 *
 * Wraps `next-themes` with the project's defaults:
 * - `class` strategy: toggles a `dark` class on `<html>` (matches the
 *   `&:is(.dark *)` variant in styles.css).
 * - `system` as default theme — respects the user's OS preference until
 *   they pick an explicit value.
 * - Disables CSS transitions during theme changes so colours don't briefly
 *   animate through intermediate values.
 *
 * The provider renders a small inline script during SSR that applies the
 * persisted/system theme to `<html>` before React hydrates, eliminating the
 * flash of the wrong theme.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
			storageKey="forge-scout-theme"
			{...props}
		>
			{children}
		</NextThemesProvider>
	);
}
