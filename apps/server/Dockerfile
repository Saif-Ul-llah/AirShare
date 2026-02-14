FROM oven/bun:latest AS builder

WORKDIR /app

# Copy root workspace config files
COPY package.json bun.lock pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all packages and apps
COPY packages ./packages
COPY apps ./apps

# Install all dependencies in the monorepo
RUN bun install --frozen-lockfile

# Build the server using the build script from package.json
RUN cd apps/server && bun build src/index.ts --outdir dist --target bun

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Only copy what we need for runtime
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["bun", "dist/index.js"]
