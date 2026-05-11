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

## Environment variables

See [`.env.example`](./.env.example) for the full list. Required at runtime:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `OPENROUTER_API_KEY` | OpenRouter API key (used for AI search; can be empty during scaffold work) |
| `OPENROUTER_MODEL` | OpenRouter model id (defaults to a free model) |
| `FORGE_SOURCE` | `scrape` or `api` — toggles how the Forge dataset is collected |
| `GITHUB_TOKEN` | Optional GitHub PAT for higher API rate limits |

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
