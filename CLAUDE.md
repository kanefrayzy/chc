# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CHCGREEN — online platform selling codes for a third-party casino plus in-house games (Roulette Battle, Classic/Jackpot, Mines). The full spec is in [ТЗ.md](ТЗ.md) (Russian). Architecture Decision Records live in [docs/decisions.md](docs/decisions.md) — **any non-trivial decision made without explicit client instruction must be recorded there** (format: Контекст → Решение → Обоснование → Последствия).

## Commands

pnpm monorepo (workspaces in `apps/*` and `packages/*`) orchestrated by Turborepo. Requires Node ≥20.11, pnpm ≥9.

```powershell
pnpm build            # turbo run build (all workspaces)
pnpm typecheck        # turbo run typecheck
pnpm test             # turbo run test (only apps/api has tests — vitest)
pnpm db:generate      # prisma generate (packages/db)
pnpm db:migrate       # prisma migrate deploy
```

Run a single test file:

```powershell
pnpm --filter @chcgreen/api exec vitest run src/modules/mines/mines.spec.ts
```

Tests are colocated `*.spec.ts` files inside `apps/api/src/modules/*` (currently mines, roulette, referrals). Other apps have no test task.

Create a new DB migration (dev):

```powershell
pnpm --filter @chcgreen/db prisma:migrate:dev
```

### Docker (the only run mode)

Per ADR-0002 there is **no dev mode** — Dockerfiles are multi-stage prod-only, no hot reload. The whole stack runs via `docker compose --env-file .env` (`pnpm docker:build` / `docker:up` / `docker:down` / `docker:logs`). Any code change requires rebuilding the affected service's image. Migrations are applied inside the api container after first start (see README).

Ports: web :3000, admin :3001, api :4000 (`/health`), realtime :4001 (`/health`), MinIO console :9001.

PowerShell smoke-test scripts against a running stack: `test-ranks.ps1`, `test-referrals.ps1`, `scripts/test-roulette.ps1`, `scripts/test-code-purchase.ps1`. `scripts/reset-db.mjs` resets the DB.

## Architecture

Four apps + shared packages, all TypeScript strict (no `any`):

- **apps/api** — NestJS REST API; all business logic lives here in module services (`src/modules/`: auth, wallet, deposits, withdrawals, payments, code-purchases, roulette, classic, mines, referrals, ranks, tickets, settings, users, admin, realtime). Validation via Zod (`nestjs-zod` global pipe). Auth is JWT in httpOnly cookies (argon2 password hashing).
- **apps/api `realtime` module** — despite the separate realtime app, the game/chat WebSocket gateway that actually emits events (`RealtimeGateway`, rooms `roulette`, `classic`, `user:{id}`) is **inside the API** (NestJS `@nestjs/websockets` + Socket.IO on the same server). Emit to a user via `RealtimeGateway.emitToUser`.
- **apps/realtime** — thin standalone Socket.IO server with Redis pub/sub adapter (single `src/main.ts`).
- **apps/web** — public Next.js 14 App Router site (all routes under `src/app/[locale]/`, next-intl with RU/AZ). Client code organized as `src/features/*` (mirrors API modules) and `src/lib/{api,realtime,format}`. Talks to API over HTTP (`NEXT_PUBLIC_API_URL` client-side, `INTERNAL_API_URL=http://api:4000` server-side) and to Socket.IO for live games/chat.
- **apps/admin** — separate Next.js admin panel, same patterns as web.
- **packages/db** (`@chcgreen/db`) — Prisma schema, migrations, and the generated client re-exported for api.
- **packages/shared** (`@chcgreen/shared`) — Zod schemas, shared types, constants, money utilities, payment-provider display-name map. Imported by every app.
- **packages/ui** — design tokens for web/admin.

Infra: PostgreSQL 16, Redis (cache/queues/Socket.IO adapter), MinIO (S3-compatible storage).

## Domain rules (load-bearing)

- **Money is `BigInt` in minor units** (qəpik, 1 AZN = 100) everywhere — DB, services, calculations (ADR-0003). Never use `number`/float for amounts. API JSON serializes amounts as strings. Formatting to `"123.45 AZN"` happens only at the UI boundary via `packages/shared/src/money.ts`. Payouts round down (floor) — never overpay.
- **Payment providers** (ADR-0007): fiat deposits go through **Betatransfer** (`BETATRANSFER` enum, redirect flow — `Deposit.paymentUrl`), crypto through WestWallet. Betatransfer request signature is `md5(concat of param values in send order + secret)`, webhook signature is `md5(amount + orderId + secret)`; intermediate webhook statuses map to `PENDING` and are ignored. The old Betra h2h / "Limpay" branding (ADR-0004) is gone.
- **Games are provably fair** (see ADR-0006 for Mines): server seed hash committed before play, HMAC-SHA256-driven outcomes, seed revealed after. Multipliers computed in basis points (bps) with a house edge.
- **One active game per user** is enforced by a partial unique index in Postgres (`WHERE status='ACTIVE'`); services catch Prisma `P2002` and return `GAME_ALREADY_ACTIVE` — don't replace this with app-level locks.
- **Referral bonuses** are computed from the casino's net margin per game (`bet − payout`): `FROM_LOSS` 10% when the house profits, `FROM_WIN` 3% when it loses.
- UI is bilingual RU/AZ via next-intl — user-facing strings go through locale files, not hardcoded.
