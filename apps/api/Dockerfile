# syntax=docker/dockerfile:1.7
# =========================================================
# CHCGREEN API (NestJS) — production multi-stage image.
# Контекст сборки — корень монорепо.
# =========================================================

ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.0

# ------- deps: устанавливаем pnpm и все workspace-зависимости -------
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/eslint-config/package.json packages/eslint-config/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

# ------- build: компилируем shared, db (Prisma generate), api -------
FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat openssl
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# Copy web i18n messages so they can be bundled into the API image as defaults
COPY apps/web/src/i18n/messages ./apps/web/src/i18n/messages

# Восстанавливаем workspace симлинки после COPY (BuildKit дереференсит).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false --prefer-offline

RUN pnpm --filter @chcgreen/db prisma:generate
RUN pnpm --filter @chcgreen/shared build
RUN pnpm --filter @chcgreen/db build
RUN pnpm --filter @chcgreen/api build

# ------- runtime: только prod-зависимости и dist -------
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl wget
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/db/prisma packages/db/prisma

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false --prod

# Regenerate Prisma Client in the runtime image (pnpm stores it under .pnpm/...)
RUN pnpm --filter @chcgreen/db exec prisma generate

COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist

# non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nestjs
# Create uploads dir and set ownership BEFORE switching user so named volume
# inherits correct permissions on first mount
RUN mkdir -p /app/uploads/logos /app/uploads/images && \
    chown -R nestjs:nodejs /app/uploads

# Bundle default i18n messages so the translations endpoint can serve them
COPY --from=build /repo/apps/web/src/i18n/messages /app/translations
USER nestjs

WORKDIR /repo/apps/api
EXPOSE 4000
CMD ["node", "dist/main.js"]
