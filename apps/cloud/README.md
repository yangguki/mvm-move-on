# @mvn/cloud

Cloudflare Pages Functions, D1 schema/seed, and local admin API for MVN cloud deployment.

## Layout

- `d1/migrations/` — D1 SQLite migrations (`0001_init.sql`)
- `seed/` — `seed.json` and `seed.sql` generated from local Postgres (read-only)
- `functions/api/[[path]].ts` — Pages Functions entry (`/api/*`)
- `src/routes/` — route handlers, `src/db.ts` — D1 helpers
- `public/` — Pages static root: admin `pnpm build:cloud` copies Next export here (`public/player/` reserved for player assets in a later step)
- `scripts/export-seed.mjs` — `docker exec mvn-postgres-1 psql` SELECT → seed files
- `scripts/check-seed.mjs` — apply migration + seed in memory (sql.js)

## Git / ignores

- `.wrangler/` and `.dev.vars` are gitignored under this package.
- `public/` is gitignored (admin + player export); run `pnpm --filter @mvn/cloud build:cloud:all` to regenerate static files locally.

## Local API (port 8788 only)

```bash
cp .dev.vars.example .dev.vars   # optional; `pnpm dev` also passes local bindings via CLI
pnpm --filter @mvn/cloud db:migrate:local
pnpm --filter @mvn/cloud db:seed:local
pnpm --filter @mvn/cloud dev
```

Auth: shared `ADMIN_PASSWORD` + HMAC session (`SESSION_SECRET`). Login returns `accessToken` (Bearer, same as Nest admin) and sets `mvn_admin_session` HttpOnly cookie.

## Other commands

```bash
pnpm --filter @mvn/cloud export-seed
pnpm --filter @mvn/cloud check-seed
pnpm --filter @mvn/cloud typecheck
pnpm --filter @mvn/cloud test
```

`export-seed` requires running `mvn-postgres-1` container. Does not read repo `.env`.