FROM oven/bun:latest AS builder

WORKDIR /app

# Copy monorepo files
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json bun.lock ./

# Copy all packages
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies
RUN bun install

# Build the server
RUN cd apps/server && bun build src/index.ts --outdir dist --target bun

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Copy built artifacts and node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

EXPOSE 4000

CMD ["bun", "dist/index.js"]
