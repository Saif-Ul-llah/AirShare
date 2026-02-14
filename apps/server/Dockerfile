FROM node:18-alpine AS builder

WORKDIR /app

# Install Bun
RUN npm install -g bun

# Install pnpm globally
RUN npm install -g pnpm@latest

# Copy package files first
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy packages and apps
COPY packages ./packages
COPY apps ./apps

# Install dependencies using pnpm
RUN pnpm install --frozen-lockfile

# Build the server using pnpm
RUN pnpm --filter @airshare/server build

# Runtime stage
FROM oven/bun:latest

WORKDIR /app

# Only copy what we need for runtime
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

CMD ["bun", "dist/index.js"]
