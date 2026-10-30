FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache openssl
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV DATABASE_URL="postgresql://user:password@localhost:5432/app?schema=public"
ENV DIRECT_URL="postgresql://user:password@localhost:5432/app?schema=public"
RUN pnpm db:generate && pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/certs ./certs
COPY --from=build /app/assets ./assets
COPY --from=build /app/package.json ./package.json
RUN mkdir -p /app/uploads && chown nestjs:nodejs /app/uploads
USER nestjs
EXPOSE 4000
CMD ["node", "dist/src/main.js"]
