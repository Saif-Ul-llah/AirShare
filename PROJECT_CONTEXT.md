# AirShare Project Context

## Overview
AirShare is a room-based file and content sharing platform with support for local network P2P transfers and internet mode with end-to-end encryption. Think of it as a modern, secure alternative to sharing via USB drives or cloud services.

## Architecture

### Monorepo Structure
```
AirShare/
├── apps/
│   ├── server/         # Backend API (Bun + Elysia)
│   └── web/            # Frontend (Next.js 14)
├── packages/
│   ├── shared/         # Types, constants, Zod schemas
│   ├── crypto/         # AES-256-GCM encryption
│   ├── ui/             # React component library
│   └── webrtc/         # P2P connection & file transfer
```

### Technology Stack

**Backend (apps/server):**
- Runtime: Bun
- Framework: Elysia
- Database: MongoDB (Mongoose)
- Cache: Redis
- Storage: Cloudflare R2/S3
- Auth: JWT + Argon2
- Real-time: Socket.IO

**Frontend (apps/web):**
- Framework: Next.js 14 (App Router)
- Styling: Tailwind CSS
- State: Zustand
- Data Fetching: TanStack Query
- Real-time: Socket.IO Client
- P2P: WebRTC

## Key Concepts

### Room Modes
- **Local**: P2P transfers on same network, temporary (24h), zero-login required
- **Internet**: Server-relayed, persistent, requires account for ownership

### Room Access Types
- **Public**: Anyone with room code can access
- **Private**: Only owner can access
- **Password**: Requires password to join (also used for encryption key derivation)

### Item Types
- `file` - Binary files with S3/R2 storage
- `folder` - Hierarchical organization
- `text` - Plain text snippets
- `link` - URLs with Open Graph previews
- `image` - Images with gallery view
- `code` - Code with syntax highlighting
- `note` - Markdown notes

### Security Features
- Client-side AES-256-GCM encryption
- Password-derived keys (PBKDF2, 100k iterations)
- Per-item access controls
- One-time access option
- Download limits
- Expiration times

## API Endpoints

### Auth (`/api/auth`)
- POST `/register` - Create account
- POST `/login` - Get tokens
- POST `/refresh` - Refresh access token
- GET `/me` - Current user info

### Rooms (`/api/rooms`)
- POST `/` - Create room
- GET `/:code` - Join/get room details
- PATCH `/:code` - Update room settings
- DELETE `/:code` - Delete room
- GET `/my/rooms` - User's owned rooms
- GET `/:code/search` - Search items in room

### Items (`/api/items`)
- POST `/rooms/:code` - Create item in room
- GET `/:id` - Get item by ID
- GET `/share/:shareUrl` - Get by public share URL
- PATCH `/:id` - Update item
- DELETE `/:id` - Delete item
- GET `/:id/versions` - Version history
- POST `/:id/versions/:v/restore` - Restore version
- GET `/:id/download` - Download file content

### Upload (`/api/upload`)
- POST `/init` - Initialize chunked upload
- POST `/chunk` - Upload chunk
- POST `/complete` - Finalize upload

### Admin (`/api/admin`)
- GET `/stats` - System statistics
- GET `/rooms` - All rooms
- GET `/users` - All users
- DELETE `/rooms/:code` - Admin delete room
- PATCH `/users/:id` - Update user (suspend, etc.)

## WebSocket Events

### Client -> Server
- `room:join` - Join room with peerId
- `room:leave` - Leave room
- `webrtc:signal` - Relay WebRTC signaling
- `item:create/update/delete` - Broadcast item changes

### Server -> Client
- `room:user_joined/left` - Presence updates
- `room:peers` - Initial peer list on join
- `item:created/updated/deleted` - Item sync events
- `webrtc:signal` - Relayed WebRTC signals
- `error` - Error messages

## State Management (Zustand Stores)

### auth-store
- User session and tokens
- Login/logout/register actions
- Token refresh logic
- Persist to localStorage

### room-store
- Current room data
- Items list in room
- Presence list (connected peers)
- Room CRUD operations

### item-store
- Selected item for viewing/editing
- Upload queue management
- Item CRUD operations

## Key Files Reference

### Backend
- `apps/server/src/index.ts` - Server entry point
- `apps/server/src/routes/*.ts` - API routes
- `apps/server/src/models/*.ts` - MongoDB schemas
- `apps/server/src/websocket/server.ts` - Socket.IO setup
- `apps/server/src/middleware/*.ts` - Auth, rate limiting, errors

### Frontend
- `apps/web/src/app/layout.tsx` - Root layout with providers
- `apps/web/src/app/page.tsx` - Home page
- `apps/web/src/app/room/[code]/page.tsx` - Room page
- `apps/web/src/app/dashboard/page.tsx` - User dashboard
- `apps/web/src/app/(auth)/login/page.tsx` - Login page
- `apps/web/src/app/(auth)/register/page.tsx` - Register page
- `apps/web/src/app/s/[shareUrl]/page.tsx` - Share page
- `apps/web/src/lib/api/client.ts` - Axios-based API client
- `apps/web/src/lib/stores/*.ts` - Zustand stores
- `apps/web/src/lib/websocket/client.ts` - Socket.IO client
- `apps/web/src/providers/*.tsx` - React context providers
- `apps/web/src/components/ui/*.tsx` - UI primitives
- `apps/web/src/components/room/*.tsx` - Room-specific components
- `apps/web/src/components/items/*.tsx` - Item-related components

### Packages
- `packages/shared/src/types/index.ts` - All TypeScript types
- `packages/shared/src/schemas/index.ts` - Zod validation schemas
- `packages/crypto/src/aes-gcm.ts` - Encryption utilities
- `packages/webrtc/src/file-transfer.ts` - P2P file transfers
- `packages/ui/src/components/*.tsx` - Reusable UI components

## Development Commands

```bash
# Install dependencies
pnpm install

# Run all dev servers (turbo)
pnpm dev

# Run specific app
pnpm --filter @airshare/web dev
pnpm --filter @airshare/server dev

# Build all packages
pnpm build

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Environment Variables

### Backend (.env)
```
PORT=4000
MONGODB_URI=mongodb://localhost:27017/airshare
REDIS_URL=redis://localhost:6379
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=airshare
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Current Implementation Notes

- Create/Join room dialogs are fully functional
- Room code is 8 alphanumeric characters (e.g., ABCD1234)
- Password-protected rooms also use password for E2E encryption
- Local mode rooms expire in 24h, internet mode in 7 days (or persistent)
- Files are uploaded in 5MB chunks to support large files
- WebSocket reconnection is automatic with exponential backoff
- Share pages support all content types with proper rendering
- Dashboard shows user's rooms grouped by mode (local/internet)
