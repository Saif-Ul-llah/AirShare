# AirShare Frontend Implementation Plan

## Executive Summary

Build a Next.js 14+ PWA frontend for AirShare - a room-based file and content sharing platform. The frontend will integrate with the existing Bun/Elysia backend, leveraging the shared packages for encryption, WebRTC, and UI components.

---

## Architecture Overview

```
apps/
  web/                          # Next.js 14 App Router
    src/
      app/                      # App Router pages
        (auth)/                 # Auth group (login, register)
        (main)/                 # Main app group
          room/[code]/          # Room view
          dashboard/            # User dashboard
        (admin)/                # Admin panel
        api/                    # API routes (minimal, mainly for SSR)
      components/               # App-specific components
      hooks/                    # Custom React hooks
      lib/                      # Utilities, API client, stores
      providers/                # Context providers
    public/                     # Static assets + PWA manifest
```

---

## Phase 1: Project Setup & Foundation

### 1.1 Initialize Next.js App
**Files to create:**
- `apps/web/package.json`
- `apps/web/next.config.js`
- `apps/web/tsconfig.json`
- `apps/web/tailwind.config.ts`
- `apps/web/postcss.config.js`

**Key configurations:**
```js
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

module.exports = withPWA({
  transpilePackages: ['@airshare/ui', '@airshare/shared', '@airshare/crypto', '@airshare/webrtc'],
  images: { domains: ['*.r2.cloudflarestorage.com'] },
});
```

### 1.2 Core Infrastructure
**Files to create:**
- `apps/web/src/lib/api/client.ts` - Type-safe API client
- `apps/web/src/lib/api/endpoints.ts` - API endpoint definitions
- `apps/web/src/lib/stores/` - Zustand stores for state management
- `apps/web/src/providers/AppProvider.tsx` - Root provider composition

### 1.3 Environment Configuration
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Phase 2: Authentication System

### 2.1 Auth Store & Context
**File:** `apps/web/src/lib/stores/auth-store.ts`
```typescript
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}
```

### 2.2 Auth Pages
**Files to create:**
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/layout.tsx`

### 2.3 Auth Middleware
**File:** `apps/web/src/middleware.ts`
- Protect routes requiring authentication
- Redirect logged-in users away from auth pages
- Handle token refresh on SSR

---

## Phase 3: Room System

### 3.1 Room Store
**File:** `apps/web/src/lib/stores/room-store.ts`
```typescript
interface RoomState {
  currentRoom: Room | null;
  items: Item[];
  presence: PeerInfo[];
  isLoading: boolean;
  error: string | null;

  // Actions
  createRoom: (data: CreateRoomData) => Promise<Room>;
  joinRoom: (code: string, password?: string) => Promise<void>;
  leaveRoom: () => void;
  updateRoom: (changes: Partial<Room>) => Promise<void>;
  deleteRoom: () => Promise<void>;
}
```

### 3.2 Room Pages
**Files to create:**
- `apps/web/src/app/(main)/page.tsx` - Home/landing with room creation
- `apps/web/src/app/(main)/room/[code]/page.tsx` - Room view
- `apps/web/src/app/(main)/room/[code]/layout.tsx` - Room layout with sidebar
- `apps/web/src/app/(main)/dashboard/page.tsx` - User's rooms dashboard

### 3.3 Room Components
**Files to create:**
- `apps/web/src/components/room/CreateRoomDialog.tsx`
- `apps/web/src/components/room/JoinRoomDialog.tsx`
- `apps/web/src/components/room/RoomHeader.tsx`
- `apps/web/src/components/room/RoomSidebar.tsx`
- `apps/web/src/components/room/PresenceList.tsx`
- `apps/web/src/components/room/RoomSettings.tsx`

---

## Phase 4: Content/Item System

### 4.1 Item Store
**File:** `apps/web/src/lib/stores/item-store.ts`
```typescript
interface ItemState {
  items: Map<string, Item>;
  selectedItem: Item | null;
  uploadQueue: UploadTask[];

  // CRUD
  createItem: (type: ItemType, content: any, access?: ItemAccess) => Promise<Item>;
  updateItem: (id: string, changes: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;

  // Upload
  uploadFile: (file: File, options?: UploadOptions) => Promise<Item>;
  cancelUpload: (uploadId: string) => void;
}
```

### 4.2 Item Components
**Files to create:**
- `apps/web/src/components/items/ItemGrid.tsx` - Grid/list view of items
- `apps/web/src/components/items/ItemCard.tsx` - Individual item card
- `apps/web/src/components/items/FileUploader.tsx` - Drag-drop file upload
- `apps/web/src/components/items/TextEditor.tsx` - Text/note editor
- `apps/web/src/components/items/CodeEditor.tsx` - Code snippet editor
- `apps/web/src/components/items/LinkPreview.tsx` - Link with OG preview
- `apps/web/src/components/items/ImageGallery.tsx` - Image gallery view
- `apps/web/src/components/items/FolderTree.tsx` - Folder hierarchy
- `apps/web/src/components/items/ItemAccessDialog.tsx` - Access settings
- `apps/web/src/components/items/ShareDialog.tsx` - Share URL dialog
- `apps/web/src/components/items/VersionHistory.tsx` - Version management

### 4.3 Content Type Handlers
**File:** `apps/web/src/lib/content-handlers.ts`
```typescript
// Registry for content type rendering and editing
const contentHandlers: Record<ItemType, ContentHandler> = {
  file: FileHandler,
  folder: FolderHandler,
  text: TextHandler,
  link: LinkHandler,
  image: ImageHandler,
  code: CodeHandler,
  note: NoteHandler,
};
```

---

## Phase 5: Real-time Features

### 5.1 WebSocket Integration
**File:** `apps/web/src/lib/websocket/client.ts`
```typescript
class WebSocketClient {
  private socket: Socket;
  private roomCode: string | null = null;

  connect(): void;
  joinRoom(roomCode: string, peerId: string, displayName?: string): void;
  leaveRoom(): void;

  // Event handlers
  onUserJoined(handler: (peer: PeerInfo) => void): void;
  onUserLeft(handler: (peerId: string) => void): void;
  onItemCreated(handler: (item: Item) => void): void;
  onItemUpdated(handler: (item: Item) => void): void;
  onItemDeleted(handler: (itemId: string) => void): void;
  onSignal(handler: (signal: WebRTCSignal) => void): void;
}
```

### 5.2 WebSocket Provider
**File:** `apps/web/src/providers/WebSocketProvider.tsx`
- Manages socket lifecycle
- Auto-reconnection with exponential backoff
- Syncs with room store

### 5.3 WebRTC Integration (Local Mode)
**File:** `apps/web/src/lib/webrtc/peer-manager.ts`
```typescript
class PeerManager {
  private peers: Map<string, PeerConnection> = new Map();
  private fileTransfers: Map<string, FileTransfer> = new Map();

  connectToPeer(peerId: string): Promise<void>;
  disconnectPeer(peerId: string): void;
  sendFile(peerId: string, file: File): Promise<TransferProgress>;
  broadcastFile(file: File): Promise<Map<string, TransferProgress>>;

  onTransferProgress(handler: (progress: TransferProgress) => void): void;
  onFileReceived(handler: (file: File, metadata: TransferMetadata) => void): void;
}
```

### 5.4 WebRTC Provider
**File:** `apps/web/src/providers/WebRTCProvider.tsx`
- Manages peer connections for local mode
- Handles signaling via WebSocket
- P2P file transfer UI

---

## Phase 6: Encryption Layer

### 6.1 Encryption Service
**File:** `apps/web/src/lib/encryption/service.ts`
```typescript
class EncryptionService {
  private roomKey: CryptoKey | null = null;

  // Key management
  deriveRoomKey(password: string, salt: string): Promise<CryptoKey>;
  clearKey(): void;
  hasKey(): boolean;

  // Content encryption
  encryptContent(content: string): Promise<{ encrypted: string; iv: string }>;
  decryptContent(encrypted: string, iv: string): Promise<string>;

  // File encryption
  encryptFile(file: File): Promise<{ file: File; iv: string }>;
  decryptFile(encryptedFile: Blob, iv: string, filename: string, mimeType: string): Promise<File>;

  // Stream encryption for large files
  encryptStream(stream: ReadableStream): AsyncGenerator<EncryptedChunk>;
  decryptStream(chunks: AsyncIterable<EncryptedChunk>): AsyncGenerator<ArrayBuffer>;
}
```

### 6.2 Encryption Provider
**File:** `apps/web/src/providers/EncryptionProvider.tsx`
- Manages encryption key lifecycle
- Prompts for password when needed
- Provides encryption context to components

---

## Phase 7: File Upload System

### 7.1 Upload Manager
**File:** `apps/web/src/lib/upload/manager.ts`
```typescript
interface UploadTask {
  id: string;
  file: File;
  roomCode: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

class UploadManager {
  private queue: UploadTask[] = [];
  private activeUploads: Map<string, AbortController> = new Map();
  private maxConcurrent = 3;

  enqueue(file: File, roomCode: string, options?: UploadOptions): string;
  cancel(uploadId: string): void;
  retry(uploadId: string): void;

  // Chunked upload
  private uploadChunked(task: UploadTask): Promise<void>;

  // Progress callbacks
  onProgress(handler: (task: UploadTask) => void): void;
  onComplete(handler: (task: UploadTask, item: Item) => void): void;
  onError(handler: (task: UploadTask, error: Error) => void): void;
}
```

### 7.2 Upload Components
**Files:**
- `apps/web/src/components/upload/UploadQueue.tsx` - Upload queue sidebar
- `apps/web/src/components/upload/UploadProgress.tsx` - Individual progress
- `apps/web/src/components/upload/DropZoneOverlay.tsx` - Full-screen drop zone

---

## Phase 8: Local Network Mode

### 8.1 mDNS Discovery (Future - requires native app)
For web-only, we'll use a "same network" detection approach:
- Server broadcasts its local IP on WebSocket connect
- Clients on same subnet show "Local Mode" option
- P2P transfers via WebRTC when on same network

### 8.2 Local Mode Components
**Files:**
- `apps/web/src/components/local/LocalModeToggle.tsx`
- `apps/web/src/components/local/PeerList.tsx`
- `apps/web/src/components/local/P2PTransferCard.tsx`
- `apps/web/src/components/local/NetworkInfo.tsx`

### 8.3 Offline Support (PWA)
**Files:**
- `apps/web/public/manifest.json`
- `apps/web/src/lib/offline/service-worker.ts`
- `apps/web/src/lib/offline/indexed-db.ts` - Local item cache

```typescript
// IndexedDB schema for offline items
interface OfflineStore {
  rooms: { code: string; data: Room; syncedAt: Date }[];
  items: { id: string; roomCode: string; data: Item; pending: boolean }[];
  pendingUploads: { id: string; file: Blob; metadata: any }[];
}
```

---

## Phase 9: Admin Panel

### 9.1 Admin Layout
**Files:**
- `apps/web/src/app/(admin)/admin/layout.tsx`
- `apps/web/src/app/(admin)/admin/page.tsx` - Dashboard
- `apps/web/src/app/(admin)/admin/rooms/page.tsx` - Room management
- `apps/web/src/app/(admin)/admin/users/page.tsx` - User management
- `apps/web/src/app/(admin)/admin/analytics/page.tsx` - Storage/usage stats

### 9.2 Admin Components
**Files:**
- `apps/web/src/components/admin/StatsCards.tsx`
- `apps/web/src/components/admin/RoomTable.tsx`
- `apps/web/src/components/admin/UserTable.tsx`
- `apps/web/src/components/admin/AuditLogViewer.tsx`
- `apps/web/src/components/admin/StorageChart.tsx`

### 9.3 Admin Store
**File:** `apps/web/src/lib/stores/admin-store.ts`
```typescript
interface AdminState {
  rooms: Room[];
  users: User[];
  auditLogs: AuditLog[];
  stats: {
    totalRooms: number;
    totalUsers: number;
    totalStorage: number;
    activeRooms: number;
  };

  // Actions
  fetchRooms(filters?: RoomFilters): Promise<void>;
  disableRoom(code: string): Promise<void>;
  deleteRoom(code: string): Promise<void>;
  suspendUser(userId: string, reason: string): Promise<void>;
}
```

---

## Phase 10: Share Pages (Public Access)

### 10.1 Share Routes
**Files:**
- `apps/web/src/app/s/[shareUrl]/page.tsx` - Public share page
- `apps/web/src/app/r/[code]/page.tsx` - Public room join

### 10.2 Share Components
**Files:**
- `apps/web/src/components/share/SharePage.tsx`
- `apps/web/src/components/share/PasswordPrompt.tsx`
- `apps/web/src/components/share/DownloadButton.tsx`
- `apps/web/src/components/share/ExpiredNotice.tsx`

---

## Implementation Order

### Foundation
1. Initialize Next.js app with PWA config
2. Set up Tailwind with existing UI package
3. Create API client and type definitions
4. Implement auth store and pages
5. Create basic layout and navigation

### Core Features
6. Implement room store and pages
7. Build room creation/join flow
8. Implement item store and CRUD
9. Build item grid and card components
10. Add file upload with progress

### Content Types
11. Text/note editor with Markdown
12. Code editor with syntax highlighting
13. Link preview with OG fetching
14. Image gallery with lightbox
15. Folder hierarchy navigation

### Real-time & Encryption
16. WebSocket integration
17. Real-time item sync
18. Client-side encryption
19. Encrypted file upload
20. Key derivation from password

### Local Mode & P2P
21. WebRTC peer connections
22. P2P file transfer
23. Transfer progress UI
24. Network detection
25. Offline PWA support

### Admin & Polish
26. Admin dashboard
27. Room/user management
28. Analytics charts
29. Audit log viewer
30. Final testing and optimization

---

## Key Dependencies to Add

```json
{
  "dependencies": {
    "next": "^14.1.0",
    "next-pwa": "^5.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "socket.io-client": "^4.7.0",
    "@tanstack/react-query": "^5.17.0",
    "react-dropzone": "^14.2.0",
    "@uiw/react-codemirror": "^4.21.0",
    "react-markdown": "^9.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "date-fns": "^3.2.0",
    "recharts": "^2.10.0",
    "idb": "^8.0.0"
  }
}
```

---

## Verification & Testing

### Manual Testing Checklist
1. Create room (local/internet mode)
2. Join room with/without password
3. Upload file (small and large)
4. Share text, code, link, note
5. Real-time sync between tabs
6. P2P transfer in local mode
7. Encryption/decryption
8. Share URL access
9. Admin panel functions
10. PWA offline behavior

### Automated Tests
- Unit tests for stores and utilities
- Integration tests for API client
- E2E tests with Playwright for critical flows

---

## Security Considerations

1. **Client-side encryption**: All sensitive content encrypted before upload
2. **Password-derived keys**: Using PBKDF2 with 100,000 iterations
3. **Zero-knowledge**: Server never sees plaintext for encrypted items
4. **XSS prevention**: Sanitize all user content, use CSP headers
5. **CSRF protection**: SameSite cookies, CSRF tokens for mutations
6. **Rate limiting**: Enforce limits on file uploads and room creation

---

## Performance Optimizations

1. **Code splitting**: Dynamic imports for heavy components (CodeMirror, Charts)
2. **Image optimization**: Next.js Image with R2 loader
3. **Virtual scrolling**: For large item lists
4. **Chunked uploads**: 5MB chunks with resume capability
5. **Service worker caching**: Static assets and API responses
6. **WebRTC data channel**: Direct P2P for local mode efficiency

---

## File Structure Summary

```
apps/web/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (main)/
│   │   │   ├── page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── room/[code]/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── page.tsx
│   │   │       ├── rooms/page.tsx
│   │   │       ├── users/page.tsx
│   │   │       └── layout.tsx
│   │   ├── s/[shareUrl]/page.tsx
│   │   ├── r/[code]/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── room/
│   │   ├── items/
│   │   ├── upload/
│   │   ├── local/
│   │   ├── admin/
│   │   ├── share/
│   │   └── ui/  (app-specific extensions)
│   ├── hooks/
│   │   ├── useRoom.ts
│   │   ├── useItems.ts
│   │   ├── useWebSocket.ts
│   │   ├── useWebRTC.ts
│   │   ├── useEncryption.ts
│   │   └── useUpload.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── endpoints.ts
│   │   ├── stores/
│   │   │   ├── auth-store.ts
│   │   │   ├── room-store.ts
│   │   │   ├── item-store.ts
│   │   │   └── admin-store.ts
│   │   ├── websocket/
│   │   │   └── client.ts
│   │   ├── webrtc/
│   │   │   └── peer-manager.ts
│   │   ├── encryption/
│   │   │   └── service.ts
│   │   ├── upload/
│   │   │   └── manager.ts
│   │   └── offline/
│   │       ├── indexed-db.ts
│   │       └── sync.ts
│   ├── providers/
│   │   ├── AppProvider.tsx
│   │   ├── WebSocketProvider.tsx
│   │   ├── WebRTCProvider.tsx
│   │   └── EncryptionProvider.tsx
│   └── middleware.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Ready for Approval

This plan provides a complete roadmap for building the AirShare frontend. The architecture leverages:

- **Existing packages**: `@airshare/ui`, `@airshare/shared`, `@airshare/crypto`, `@airshare/webrtc`
- **Existing backend**: Full API integration with Elysia routes
- **Modern stack**: Next.js 14, TypeScript, Tailwind, Zustand
- **Security-first**: Client-side encryption, password-derived keys
- **Offline-capable**: PWA with service worker and IndexedDB
- **Real-time**: WebSocket for sync, WebRTC for P2P transfers
