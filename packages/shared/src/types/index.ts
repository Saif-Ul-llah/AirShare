// ============================================
// Room Types
// ============================================

export type RoomMode = 'local' | 'internet';
export type RoomAccess = 'public' | 'private' | 'password';
export type RoomLifespan = 'temporary' | 'persistent';

export interface RoomSettings {
  maxItems: number;
  maxFileSize: number; // in bytes
  allowedFileTypes: string[] | null; // null = all types
  requirePassword: boolean;
  autoExpireItems: boolean;
  itemExpireDays: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  mode: RoomMode;
  access: RoomAccess;
  lifespan: RoomLifespan;
  passwordHash?: string;
  encryptionSalt?: string;
  ownerId?: string;
  settings: RoomSettings;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  lastActivityAt: Date;
  deletedAt?: Date;
}

export interface RoomMember {
  odId: string;
  odRole: 'owner' | 'admin' | 'member' | 'viewer';
  odJoinedAt: Date;
}

// ============================================
// Item Types
// ============================================

export type ItemType = 'file' | 'folder' | 'text' | 'link' | 'image' | 'code' | 'note';

export interface ItemAccess {
  type: 'public' | 'private' | 'password';
  passwordHash?: string;
  expiresAt?: Date;
  maxDownloads?: number;
  downloadCount: number;
  oneTimeAccess: boolean;
  accessedAt?: Date;
}

export interface FileContent {
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  encrypted: boolean;
  encryptionIV?: string;
  checksum: string;
}

export interface FolderContent {
  name: string;
  itemCount: number;
}

export interface TextContent {
  content: string;
  encrypted: boolean;
  encryptionIV?: string;
}

export interface LinkContent {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
}

export interface ImageContent extends FileContent {
  width?: number;
  height?: number;
  thumbnailKey?: string;
}

export interface CodeContent {
  content: string;
  language: string;
  filename?: string;
  encrypted: boolean;
  encryptionIV?: string;
}

export interface NoteContent {
  title: string;
  content: string; // Markdown
  encrypted: boolean;
  encryptionIV?: string;
}

export type ItemContent =
  | { type: 'file'; data: FileContent }
  | { type: 'folder'; data: FolderContent }
  | { type: 'text'; data: TextContent }
  | { type: 'link'; data: LinkContent }
  | { type: 'image'; data: ImageContent }
  | { type: 'code'; data: CodeContent }
  | { type: 'note'; data: NoteContent };

export interface Item {
  id: string;
  roomId: string;
  parentId?: string; // For folder hierarchy
  type: ItemType;
  content: ItemContent;
  access: ItemAccess;
  shareUrl: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  version: number;
}

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  avatar?: string;
  storage: {
    used: number;
    limit: number;
  };
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  emailVerified: boolean;
  suspension?: {
    active: boolean;
    reason?: string;
    until?: Date;
    by?: string;
    at?: Date;
  };
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultRoomMode: RoomMode;
  defaultRoomAccess: RoomAccess;
  notifications: boolean;
}

// ============================================
// Version Types
// ============================================

export interface Version {
  id: string;
  itemId: string;
  roomId: string;
  version: number;
  content: ItemContent;
  createdBy?: string;
  createdAt: Date;
  size: number;
}

// ============================================
// Audit Log Types
// ============================================

export type AuditAction =
  | 'room.created'
  | 'room.updated'
  | 'room.deleted'
  | 'room.joined'
  | 'room.left'
  | 'item.created'
  | 'item.updated'
  | 'item.deleted'
  | 'item.downloaded'
  | 'item.viewed'
  | 'user.registered'
  | 'user.login'
  | 'user.logout'
  | 'security.failed_login'
  | 'security.rate_limited'
  | 'admin.room_disabled'
  | 'admin.room_deleted'
  | 'admin.user_suspended';

export type AuditCategory = 'room' | 'item' | 'user' | 'security' | 'admin';

export interface AuditLog {
  id: string;
  roomId?: string;
  itemId?: string;
  userId?: string;
  action: AuditAction;
  category: AuditCategory;
  actor: {
    type: 'user' | 'admin' | 'system' | 'anonymous';
    userId?: string;
    ip?: string;
    userAgent?: string;
  };
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ============================================
// WebSocket Types
// ============================================

export interface WSMessage<T = unknown> {
  event: string;
  data: T;
  timestamp: number;
}

export interface RoomJoinPayload {
  roomCode: string;
  password?: string;
}

export interface RoomUpdatePayload {
  roomCode: string;
  changes: Partial<Room>;
}

export interface ItemEventPayload {
  roomCode: string;
  item: Item;
}

export interface PresencePayload {
  roomCode: string;
  users: Array<{
    odId: string;
    displayName?: string;
    joinedAt: Date;
  }>;
}

// ============================================
// WebRTC Types
// ============================================

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  roomCode: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
}

export interface PeerInfo {
  odId: string;
  displayName?: string;
  connectionState: RTCPeerConnectionState;
}

export interface TransferProgress {
  transferId: string;
  filename: string;
  totalSize: number;
  transferredSize: number;
  speed: number; // bytes per second
  eta: number; // seconds
  status: 'pending' | 'transferring' | 'completed' | 'failed';
}

// ============================================
// API Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UploadInitResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  presignedUrls?: string[];
}

export interface UploadCompleteResponse {
  item: Item;
  storageKey: string;
}
