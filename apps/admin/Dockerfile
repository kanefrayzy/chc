# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.0

FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile=false

FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_NAME
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SITE_NAME=${NEXT_PUBLIC_SITE_NAME}
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/ui/node_modules ./packages/ui/node_modules
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY apps/admin ./apps/admin

RUN pnpm --filter @chcgreen/shared build
RUN pnpm --filter @chcgreen/admin build

FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache libc6-compat wget
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build /repo/apps/admin/public ./public
COPY --from=build /repo/apps/admin/.next/standalone ./
COPY --from=build /repo/apps/admin/.next/static ./apps/admin/.next/static

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs
USER nextjs

EXPOSE 3001
WORKDIR /app/apps/admin
CMD ["node", "server.js"]
