# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AirShare is a room-based file and content sharing platform with P2P local network transfers and encrypted internet mode. Built as a pnpm monorepo with Turborepo.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Run all dev servers (frontend + backend)
pnpm dev

# Run specific app
pnpm --filter @airshare/web dev      # Frontend on :3000
pnpm --filter @airshare/server dev   # Backend on :4000

# Build all packages
pnpm build

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Format code
pnpm format

# Run backend tests
pnpm --filter @airshare/server test

# Clean all build artifacts
pnpm clean
```

## Architecture

### Monorepo Structure
```
apps/
  server/     # Bun + Elysia backend (MongoDB, Redis, S3/R2, Socket.IO)
  web/        # Next.js 14 frontend (App Router, Tailwind, Zustand)
packages/
  shared/     # Types, Zod schemas, constants
  crypto/     # AES-256-GCM encryption, PBKDF2 key derivation
  ui/         # React component library
  webrtc/     # P2P connections and file transfer
```

### Key Technical Decisions

- **State Management**: Zustand stores (`auth-store`, `room-store`, `item-store`) with localStorage persistence
- **Real-time**: Socket.IO for WebSocket communication, events prefixed with `room:`, `item:`, `webrtc:`
- **Encryption**: Client-side AES-256-GCM with password-derived keys (PBKDF2, 100k iterations)
- **File Upload**: Chunked uploads (5MB chunks) via `/api/upload` endpoints
- **P2P**: WebRTC for local mode transfers, signaling via Socket.IO

### Room Modes
- **Local**: P2P transfers, 24h expiry, no account required
- **Internet**: Server-relayed, persistent, requires account

### Item Types
`file`, `folder`, `text`, `link`, `image`, `code`, `note`

## API Structure

- `/api/auth` - Register, login, refresh, me
- `/api/rooms` - Room CRUD, search, user's rooms
- `/api/items` - Item CRUD, versions, share URLs, downloads
- `/api/upload` - Chunked upload (init, chunk, complete)
- `/api/admin` - Stats, room/user management

## Frontend Key Paths

- `apps/web/src/app/room/[code]/page.tsx` - Main room interface
- `apps/web/src/app/s/[shareUrl]/page.tsx` - Public share page
- `apps/web/src/lib/stores/` - Zustand state stores
- `apps/web/src/lib/api/client.ts` - Axios API client
- `apps/web/src/lib/websocket/client.ts` - Socket.IO client
- `apps/web/src/providers/` - React context providers (Theme, WebSocket, Encryption, WebRTC, Offline)

## Backend Key Paths

- `apps/server/src/index.ts` - Elysia server entry
- `apps/server/src/routes/` - API route handlers
- `apps/server/src/models/` - Mongoose schemas
- `apps/server/src/websocket/server.ts` - Socket.IO setup
- `apps/server/src/middleware/` - Auth, rate limiting, error handling

## Vercel Deployment

The frontend deploys to Vercel using the `builds` configuration in `vercel.json`. Routes are rewritten from root to `/apps/web/`.

## Environment Variables

**Backend** (`apps/server/.env`): `PORT`, `MONGODB_URI`, `REDIS_URL`, `R2_*`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

**Frontend** (`apps/web/.env.local`): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_APP_URL`
