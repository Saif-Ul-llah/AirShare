// ============================================
// Room Constants
// ============================================

export const ROOM_CODE_LENGTH = 8;
export const ROOM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars

export const DEFAULT_ROOM_SETTINGS = {
  maxItems: 100,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedFileTypes: null,
  requirePassword: false,
  autoExpireItems: false,
  itemExpireDays: 7,
} as const;

export const ROOM_EXPIRY = {
  temporary: {
    local: 24 * 60 * 60 * 1000, // 24 hours
    internet: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  persistent: null, // No expiry
} as const;

// ============================================
// Upload Constants
// ============================================

export const UPLOAD_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
export const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB max
export const MAX_CONCURRENT_UPLOADS = 3;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export const THUMBNAIL_SIZE = {
  width: 200,
  height: 200,
} as const;

// ============================================
// Encryption Constants
// ============================================

export const ENCRYPTION = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM
  tagLength: 128, // bits
  pbkdf2Iterations: 100000,
  saltLength: 16,
} as const;

// ============================================
// Rate Limiting
// ============================================

export const RATE_LIMITS = {
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
  },
  upload: {
    windowMs: 60 * 1000,
    maxRequests: 10,
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
  },
  roomCreate: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
  },
} as const;

// ============================================
// Storage Quotas
// ============================================

export const STORAGE_QUOTAS = {
  anonymous: 100 * 1024 * 1024, // 100MB
  free: 1 * 1024 * 1024 * 1024, // 1GB
  pro: 100 * 1024 * 1024 * 1024, // 100GB
} as const;

// ============================================
// WebSocket Events
// ============================================

export const WS_EVENTS = {
  // Client -> Server
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ITEM_CREATE: 'item:create',
  ITEM_UPDATE: 'item:update',
  ITEM_DELETE: 'item:delete',
  WEBRTC_SIGNAL: 'webrtc:signal',
  PING: 'ping',

  // Server -> Client
  ROOM_UPDATE: 'room:update',
  ROOM_USER_JOINED: 'room:user_joined',
  ROOM_USER_LEFT: 'room:user_left',
  ROOM_DISABLED: 'room:disabled',
  ITEM_CREATED: 'item:created',
  ITEM_UPDATED: 'item:updated',
  ITEM_DELETED: 'item:deleted',
  PRESENCE_UPDATE: 'presence:update',
  PONG: 'pong',
  ERROR: 'error',
} as const;

// ============================================
// WebRTC Constants
// ============================================

export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
  ordered: true,
  maxRetransmits: 3,
};

export const P2P_CHUNK_SIZE = 64 * 1024; // 64KB chunks for WebRTC

// ============================================
// Code Languages
// ============================================

export const CODE_LANGUAGES = [
  'javascript',
  'typescript',
  'python',
  'java',
  'csharp',
  'cpp',
  'c',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  'markdown',
  'sql',
  'bash',
  'powershell',
  'dockerfile',
  'plaintext',
] as const;

// ============================================
// Error Codes
// ============================================

export const ERROR_CODES = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',

  // Room
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_EXPIRED: 'ROOM_EXPIRED',
  ROOM_DISABLED: 'ROOM_DISABLED',
  ROOM_PASSWORD_REQUIRED: 'ROOM_PASSWORD_REQUIRED',
  ROOM_PASSWORD_INVALID: 'ROOM_PASSWORD_INVALID',
  ROOM_FULL: 'ROOM_FULL',

  // Item
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ITEM_EXPIRED: 'ITEM_EXPIRED',
  ITEM_ACCESS_DENIED: 'ITEM_ACCESS_DENIED',
  ITEM_DOWNLOAD_LIMIT: 'ITEM_DOWNLOAD_LIMIT',

  // Upload
  UPLOAD_NOT_FOUND: 'UPLOAD_NOT_FOUND',
  UPLOAD_CHUNK_INVALID: 'UPLOAD_CHUNK_INVALID',
  UPLOAD_SIZE_EXCEEDED: 'UPLOAD_SIZE_EXCEEDED',
  UPLOAD_TYPE_NOT_ALLOWED: 'UPLOAD_TYPE_NOT_ALLOWED',

  // Auth
  USER_EXISTS: 'USER_EXISTS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  USER_SUSPENDED: 'USER_SUSPENDED',

  // Storage
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
