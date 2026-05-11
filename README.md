# Forge Scout

OutSystems Forge component intelligence — natural-language search, license clarity, and GitHub repo health signals.

Built with React + TypeScript outside the OutSystems platform to demonstrate full-stack capability while solving a real OutSystems community problem.

## Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (Vite + React 19 + TypeScript) |
| Routing | [TanStack Router](https://tanstack.com/router) (file-based) |
| Server state | [TanStack Query](https://tanstack.com/query) with localStorage persistence |
| Client state | [TanStack DB](https://tanstack.com/db) |
| Forms | [TanStack Form](https://tanstack.com/form) |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) |
| Styling | Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com/) |
| Validation | [Zod](https://zod.dev/) + [`@t3-oss/env-core`](https://env.t3.gg/) |
| LLM | [OpenRouter](https://openrouter.ai/) (free-tier models) |
| Linting / format | [Biome](https://biomejs.dev/) |
| Server | [Nitro](https://nitro.build/) (deploys to any Node host) |

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in values
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

App will be at http://localhost:3000.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run Vitest unit tests |
| `npm run check` | Biome lint + format check |
| `npm run lint` | Biome lint only |
| `npm run format` | Biome formatter |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:studio` | Drizzle Studio (DB GUI) |
| `npm run scrape` | One-shot Forge scrape (writes to `forge_components` + `scrape_runs`) |
| `npm run scrape:cron` | Long-running worker — schedules the scrape via `node-cron` |

## Environment variables

See [`.env.example`](./.env.example) for the full list. Required at runtime:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key (used for AI search; can be empty during scaffold work) |
| `OPENROUTER_MODEL` | OpenRouter model id (defaults to a free model) |
| `FORGE_SOURCE` | `scrape` or `api` — toggles how the Forge dataset is collected |
| `GITHUB_TOKEN` | Optional GitHub PAT for higher API rate limits |

## Forge scraper

The scraper populates `forge_components` from one of two sources:

- **`FORGE_SOURCE=scrape`** (default) — parses HTML directly from `outsystems.com/forge`.
- **`FORGE_SOURCE=api`** — calls the unofficial Forge API (component id 3255). Currently stubbed — set this only once the API client lands.

Both modes share an orchestrator that writes a `scrape_runs` audit row per invocation (status, counts, last error), polite-throttles requests, and retries on 5xx / 429 with exponential backoff.

### One-off

```bash
FORGE_LIMIT=10 FORGE_DELAY_MS=1500 npm run scrape
```

### Scheduled (cron worker)

```bash
CRON_SCHEDULE="0 6,18 * * *" CRON_TZ=UTC npm run scrape:cron
```

Designed to deploy as its own Dokploy service (long-running app, start command `npm run scrape:cron`) — keeps the web server free of side-job baggage. Sharing the same `DATABASE_URL` is the only coupling.

Env knobs:

| Variable | Purpose | Default |
|---|---|---|
| `FORGE_SOURCE` | `scrape` or `api` | `scrape` |
| `FORGE_LIMIT` | Cap components per run | unlimited |
| `FORGE_DELAY_MS` | Per-request politeness throttle | `1000` |
| `CRON_SCHEDULE` | Cron expression (worker only) | `0 6,18 * * *` |
| `CRON_TZ` | Cron timezone (worker only) | `UTC` |
| `RUN_ON_BOOT` | `true` to scrape once at worker startup | `false` |

## Deployment

The build produces a self-contained Node server (via Nitro):

```bash
npm run build
node .output/server/index.mjs
```

This project targets a self-hosted VPS via [Dokploy](https://dokploy.com/).

## Status

Scaffold complete. Features land incrementally — see [open PRs](../../pulls) and [merged PRs](../../pulls?q=is%3Apr+is%3Aclosed) for current progress.

## License

[MIT](./LICENSE) © Rui Pedro Gomes
