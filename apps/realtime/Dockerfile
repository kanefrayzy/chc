# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.0

FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/realtime ./apps/realtime
# Восстанавливаем workspace симлинки после COPY (BuildKit дереференсит).
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false --prefer-offline
RUN pnpm --filter @chcgreen/shared build
RUN pnpm --filter @chcgreen/realtime build

FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache libc6-compat wget
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/realtime/package.json apps/realtime/
COPY packages/shared/package.json packages/shared/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false --prod

COPY --from=build /repo/apps/realtime/dist ./apps/realtime/dist
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs realtime
USER realtime

WORKDIR /repo/apps/realtime
EXPOSE 4001
CMD ["node", "dist/main.js"]
