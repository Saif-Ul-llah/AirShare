FROM oven/bun:latest AS builder

WORKDIR /app

# Copy package files first (these change less frequently)
COPY package.json ./
COPY bun.lock ./
COPY pnpm-workspace.yaml ./

# Install dependencies before copying source code
RUN bun install

# Now copy the actual source code
COPY packages ./packages
COPY apps ./apps

# Build the server
RUN cd apps/server && bun build src/index.ts --outdir dist --target bun

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Only copy what we need for runtime
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["bun", "dist/index.js"]
