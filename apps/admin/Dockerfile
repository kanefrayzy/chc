# syntax=docker/dockerfile:1.7
# CHCGREEN admin — Next.js 14 (App Router)
ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.0

# ---- deps ----
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

# ---- build ----
FROM node:${NODE_VERSION}-alpine AS build
RUN apk add --no-cache libc6-compat
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
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

# ---- runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache libc6-compat wget
ARG PNPM_VERSION
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile=false

COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/packages/ui ./packages/ui
COPY --from=build /repo/apps/admin/.next ./apps/admin/.next
COPY --from=build /repo/apps/admin/public ./apps/admin/public
COPY --from=build /repo/apps/admin/next.config.mjs ./apps/admin/

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs \
    && chown -R nextjs:nodejs /repo
USER nextjs

EXPOSE 3001
WORKDIR /repo/apps/admin
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3001"]
