# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/h5/package.json apps/h5/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM nginx:1.27-alpine AS web
COPY --from=build /app/apps/h5/dist /usr/share/nginx/html/h5
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 80
