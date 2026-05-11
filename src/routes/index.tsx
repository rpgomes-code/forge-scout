import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="rise-in space-y-10">
			<section className="space-y-5">
				<p className="island-kicker">Forge Scout</p>
				<h1 className="display-title text-4xl md:text-5xl font-bold leading-tight tracking-tight">
					OutSystems Forge,
					<br />
					with intelligence.
				</h1>
				<p className="max-w-2xl text-lg text-muted-foreground">
					Natural-language search, license clarity, and GitHub repo health
					signals — over the OutSystems Forge component ecosystem. Built with
					TanStack Start, React, and Postgres.
				</p>
			</section>

			<section className="island-shell max-w-2xl rounded-2xl p-6">
				<p className="island-kicker">Status</p>
				<p className="mt-2 text-sm text-muted-foreground">
					Scaffold complete. Search, filters, GitHub enrichment, license
					intelligence, and natural-language ranking ship in upcoming PRs — see
					the{" "}
					<a
						href="https://github.com/rpgomes-code/forge-scout/pulls"
						target="_blank"
						rel="noreferrer"
					>
						open pull requests
					</a>{" "}
					for current progress.
				</p>
			</section>
		</div>
	);
}
