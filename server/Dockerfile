FROM node:22-slim AS base

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@12.9.1 --activate

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

WORKDIR /app

FROM base AS install

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS prerelease

COPY --from=install /app/node_modules ./node_modules
COPY . .

RUN pnpm prisma generate
RUN pnpm run build
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm prune --prod

FROM node:22-slim AS release

RUN apt-get update -y && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

USER node

COPY --chown=node:node --from=prerelease /app/node_modules ./node_modules
COPY --chown=node:node --from=prerelease /app/dist ./dist
COPY --chown=node:node --from=prerelease /app/generated ./generated
COPY --chown=node:node --from=prerelease /app/prisma ./prisma
COPY --chown=node:node --from=prerelease /app/prisma7.config.ts ./prisma7.config.ts
COPY --chown=node:node --from=prerelease /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
