import { z } from 'zod';

// ============================================
// Room Schemas
// ============================================

export const roomModeSchema = z.enum(['local', 'internet']);
export const roomAccessSchema = z.enum(['public', 'private', 'password']);
export const roomLifespanSchema = z.enum(['temporary', 'persistent']);

export const roomSettingsSchema = z.object({
  maxItems: z.number().int().positive().default(100),
  maxFileSize: z.number().int().positive().default(100 * 1024 * 1024), // 100MB
  allowedFileTypes: z.array(z.string()).nullable().default(null),
  requirePassword: z.boolean().default(false),
  autoExpireItems: z.boolean().default(false),
  itemExpireDays: z.number().int().positive().default(7),
});

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  mode: roomModeSchema,
  access: roomAccessSchema.default('public'),
  lifespan: roomLifespanSchema.default('temporary'),
  password: z.string().min(4).max(100).optional(),
  settings: roomSettingsSchema.partial().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  access: roomAccessSchema.optional(),
  password: z.string().min(4).max(100).optional(),
  settings: roomSettingsSchema.partial().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const joinRoomSchema = z.object({
  code: z.string().length(8),
  password: z.string().optional(),
});

// ============================================
// Item Schemas
// ============================================

export const itemTypeSchema = z.enum(['file', 'folder', 'text', 'link', 'image', 'code', 'note']);
export const itemAccessTypeSchema = z.enum(['public', 'private', 'password']);

export const itemAccessSchema = z.object({
  type: itemAccessTypeSchema.default('public'),
  password: z.string().min(4).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  maxDownloads: z.number().int().positive().optional(),
  oneTimeAccess: z.boolean().default(false),
});

export const createTextItemSchema = z.object({
  type: z.literal('text'),
  content: z.string().min(1).max(100000),
  access: itemAccessSchema.optional(),
  encrypted: z.boolean().default(false),
  encryptionIV: z.string().optional(),
});

export const createLinkItemSchema = z.object({
  type: z.literal('link'),
  url: z.string().url(),
  access: itemAccessSchema.optional(),
});

export const createCodeItemSchema = z.object({
  type: z.literal('code'),
  content: z.string().min(1).max(500000),
  language: z.string().min(1).max(50),
  filename: z.string().max(255).optional(),
  access: itemAccessSchema.optional(),
  encrypted: z.boolean().default(false),
  encryptionIV: z.string().optional(),
});

export const createNoteItemSchema = z.object({
  type: z.literal('note'),
  title: z.string().min(1).max(200),
  content: z.string().max(500000),
  access: itemAccessSchema.optional(),
  encrypted: z.boolean().default(false),
  encryptionIV: z.string().optional(),
});

export const createFolderItemSchema = z.object({
  type: z.literal('folder'),
  name: z.string().min(1).max(255),
  parentId: z.string().optional(),
  access: itemAccessSchema.optional(),
});

export const createItemSchema = z.discriminatedUnion('type', [
  createTextItemSchema,
  createLinkItemSchema,
  createCodeItemSchema,
  createNoteItemSchema,
  createFolderItemSchema,
]);

export const updateItemAccessSchema = z.object({
  access: itemAccessSchema,
});

// ============================================
// Upload Schemas
// ============================================

export const uploadInitSchema = z.object({
  roomCode: z.string().length(8),
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().int().positive(),
  encrypted: z.boolean().default(false),
  encryptionIV: z.string().optional(),
  parentId: z.string().optional(),
  access: itemAccessSchema.optional(),
});

export const uploadChunkSchema = z.object({
  uploadId: z.string(),
  chunkIndex: z.number().int().min(0),
  checksum: z.string(),
});

export const uploadCompleteSchema = z.object({
  uploadId: z.string(),
  checksum: z.string(),
});

// ============================================
// User Schemas
// ============================================

export const registerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    defaultRoomMode: roomModeSchema.optional(),
    defaultRoomAccess: roomAccessSchema.optional(),
    notifications: z.boolean().optional(),
  }).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(100),
});

// ============================================
// Admin Schemas
// ============================================

export const adminDisableRoomSchema = z.object({
  reason: z.string().min(1).max(500),
});

export const adminDeleteRoomSchema = z.object({
  deleteFiles: z.boolean().default(true),
});

export const adminSuspendUserSchema = z.object({
  reason: z.string().min(1).max(500),
  duration: z.number().int().positive().optional(), // hours, null = permanent
});

// ============================================
// Query Schemas
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  type: itemTypeSchema.optional(),
  ...paginationSchema.shape,
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================
// Type Exports
// ============================================

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemAccessInput = z.infer<typeof updateItemAccessSchema>;
export type UploadInitInput = z.infer<typeof uploadInitSchema>;
export type UploadChunkInput = z.infer<typeof uploadChunkSchema>;
export type UploadCompleteInput = z.infer<typeof uploadCompleteSchema>;
export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type SearchInput = z.infer<typeof searchSchema>;
