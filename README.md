# CHCGREEN

Онлайн-платформа: продажа кодов для стороннего казино + собственные игры (Рулетка Battle / Джекпот / Кейсы).
Полное ТЗ — [ТЗ.md](%D0%A2%D0%97.md). Архитектурные решения — [docs/decisions.md](docs/decisions.md).

## Стек

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, next-intl (RU/AZ), PWA
- **Backend API**: NestJS (TypeScript)
- **Realtime**: Socket.IO (Node.js) — чат, рулетка, джекпот
- **БД**: PostgreSQL 16 + Prisma
- **Кэш/очереди**: Redis (BullMQ)
- **Хранилище**: MinIO (S3-совместимое)
- **Монорепо**: pnpm workspaces + Turborepo
- **Контейнеризация**: Docker (только prod-сборка, multi-stage)

## Структура

```
chcgreen/
├── apps/
│   ├── web/         # публичный сайт + ЛК + игры (Next.js)
│   ├── admin/       # админ-панель (Next.js)
│   ├── api/         # REST API (NestJS)
│   └── realtime/    # WebSocket-сервис (Socket.IO)
├── packages/
│   ├── db/          # Prisma schema + миграции + клиент
│   ├── shared/      # общие типы, Zod-схемы, money-утилиты
│   ├── ui/          # design tokens
│   └── eslint-config/
├── docs/            # ТЗ, ADR, OpenAPI
├── docker-compose.yml
└── .env.example
```

## Быстрый старт (Docker, prod)

> Требуется Docker Desktop. Никаких локально установленных Node/Postgres/Redis не нужно.

```powershell
# 1. Скопировать env и заменить секреты на сильные
Copy-Item .env.example .env

# 2. Собрать все образы (первая сборка ~5–10 мин)
docker compose --env-file .env build

# 3. Поднять стек
docker compose --env-file .env up -d

# 4. Применить миграции БД (после первого запуска)
docker compose --env-file .env exec api pnpm --filter @chcgreen/db prisma:migrate:deploy

# 5. Логи
docker compose --env-file .env logs -f
```

После запуска:
- Web (публичный сайт) → http://localhost:3000
- Admin → http://localhost:3001
- API → http://localhost:4000/health
- Realtime → http://localhost:4001/health
- MinIO Console → http://localhost:9001

## Принципы разработки

См. §1.1 ТЗ. Кратко:
- TypeScript strict, без `any`.
- Деньги — `bigint` в минорных единицах (qəpik, 1 AZN = 100).
- Бизнес-логика — в сервисах модулей `apps/api`, а не в роутах/компонентах.
- Все спорные решения фиксируются в `docs/decisions.md` (ADR).
