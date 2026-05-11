import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { ThemeProvider } from "#/components/theme-provider";
import { ThemeToggle } from "#/components/theme-toggle";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Forge Scout" },
			{
				name: "description",
				content:
					"OutSystems Forge component intelligence — natural-language search, license clarity, and GitHub repo health signals.",
			},
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		// suppressHydrationWarning is required: next-themes adds the `dark` class
		// to <html> before React hydrates, which intentionally differs from the
		// server-rendered markup.
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				<ThemeProvider>
					<header>
						<div className="page-wrap flex items-center justify-between py-6">
							<Link
								to="/"
								className="display-title text-2xl font-bold nav-link is-active"
							>
								Forge Scout
							</Link>
							<div className="flex items-center gap-3">
								<span className="island-kicker">scaffold</span>
								<ThemeToggle />
							</div>
						</div>
					</header>
					<main className="page-wrap py-10">{children}</main>
				</ThemeProvider>
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
