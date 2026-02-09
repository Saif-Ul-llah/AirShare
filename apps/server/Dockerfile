FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies
RUN bun install

# Set working directory to server
WORKDIR /app/apps/server

ENV NODE_ENV=production
EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
