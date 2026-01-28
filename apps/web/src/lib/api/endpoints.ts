import { api } from './client';
import type {
  Room,
  Item,
  User,
  RoomSettings,
  ItemAccess,
  AuditLog,
  UploadInitResponse,
  UploadCompleteResponse,
} from '@airshare/shared';

// ============================================
// Auth Endpoints
// ============================================

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/api/auth/login', { email, password }),

  register: (data: RegisterData) =>
    api.post<LoginResponse>('/api/auth/register', data),

  logout: () => api.post('/api/auth/logout'),

  refresh: () => api.post<{ accessToken: string }>('/api/auth/refresh'),

  me: () => api.get<{ user: User }>('/api/auth/me'),

  updateProfile: (data: Partial<User>) =>
    api.patch<{ user: User }>('/api/auth/me', data),
};

// ============================================
// Room Endpoints
// ============================================

export interface CreateRoomData {
  name: string;
  mode: 'local' | 'internet';
  access?: 'public' | 'private' | 'password';
  lifespan?: 'temporary' | 'persistent';
  password?: string;
  settings?: Partial<RoomSettings>;
  expiresAt?: string;
}

export interface RoomResponse {
  room: Room & { encryptionSalt?: string };
  items?: Item[];
  presence?: Array<{ odId: string; displayName?: string; joinedAt: Date }>;
}

export const roomApi = {
  create: (data: CreateRoomData) =>
    api.post<RoomResponse>('/api/rooms', data),

  get: (code: string, password?: string) =>
    api.get<RoomResponse>(`/api/rooms/${code}`, { params: { password } }),

  update: (code: string, data: Partial<CreateRoomData>) =>
    api.patch<RoomResponse>(`/api/rooms/${code}`, data),

  delete: (code: string) => api.delete(`/api/rooms/${code}`),

  myRooms: () => api.get<{ rooms: Room[] }>('/api/rooms/my/rooms'),

  search: (code: string, query: string, limit?: number) =>
    api.get<{ items: Item[] }>(`/api/rooms/${code}/search`, {
      params: { q: query, limit },
    }),
};

// ============================================
// Item Endpoints
// ============================================

export interface CreateItemData {
  type: 'text' | 'link' | 'code' | 'note' | 'folder';
  content: unknown;
  parentId?: string;
  access?: {
    type?: 'public' | 'private' | 'password';
    password?: string;
    expiresAt?: string;
    maxDownloads?: number;
    oneTimeAccess?: boolean;
  };
}

export interface UpdateItemData {
  content?: unknown;
  access?: {
    type?: 'public' | 'private' | 'password';
    password?: string;
    expiresAt?: string | null;
    maxDownloads?: number | null;
    oneTimeAccess?: boolean;
  };
}

export const itemApi = {
  create: (roomCode: string, data: CreateItemData) =>
    api.post<{ item: Item }>(`/api/items/rooms/${roomCode}`, data),

  get: (id: string, password?: string) =>
    api.get<{ item: Item }>(`/api/items/${id}`, { params: { password } }),

  getByShareUrl: (shareUrl: string, password?: string) =>
    api.get<{ item: Item }>(`/api/items/share/${shareUrl}`, { params: { password } }),

  update: (id: string, data: UpdateItemData) =>
    api.patch<{ item: Item }>(`/api/items/${id}`, data),

  delete: (id: string) => api.delete(`/api/items/${id}`),

  getVersions: (id: string, limit?: number) =>
    api.get<{ versions: Array<{ id: string; version: number; createdAt: Date }> }>(
      `/api/items/${id}/versions`,
      { params: { limit } }
    ),

  restoreVersion: (id: string, version: number) =>
    api.post<{ item: Item }>(`/api/items/${id}/versions/${version}/restore`),

  download: (id: string, password?: string) =>
    `/api/items/${id}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`,
};

// ============================================
// Upload Endpoints
// ============================================

export interface InitUploadData {
  roomCode: string;
  filename: string;
  mimeType: string;
  size: number;
  encrypted?: boolean;
  parentId?: string;
}

export const uploadApi = {
  init: (data: InitUploadData) =>
    api.post<{ data: UploadInitResponse }>('/api/upload/init', data),

  uploadChunk: (
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('chunk', chunk);
    return api.upload<{ success: boolean }>('/api/upload/chunk', formData, onProgress);
  },

  complete: (uploadId: string, checksum: string) =>
    api.post<{ data: UploadCompleteResponse }>('/api/upload/complete', {
      uploadId,
      checksum,
    }),

  cancel: (uploadId: string) => api.delete(`/api/upload/${uploadId}`),
};

// ============================================
// Admin Endpoints
// ============================================

export const adminApi = {
  getRooms: (page?: number, limit?: number) =>
    api.get<{ rooms: Room[]; total: number }>('/api/admin/rooms', {
      params: { page, limit },
    }),

  disableRoom: (code: string) =>
    api.post(`/api/admin/rooms/${code}/disable`),

  deleteRoom: (code: string) =>
    api.delete(`/api/admin/rooms/${code}`),

  getUsers: (page?: number, limit?: number) =>
    api.get<{ users: User[]; total: number }>('/api/admin/users', {
      params: { page, limit },
    }),

  suspendUser: (userId: string, reason: string, until?: string) =>
    api.post(`/api/admin/users/${userId}/suspend`, { reason, until }),

  unsuspendUser: (userId: string) =>
    api.post(`/api/admin/users/${userId}/unsuspend`),

  getAuditLogs: (filters?: {
    category?: string;
    roomId?: string;
    userId?: string;
    limit?: number;
  }) =>
    api.get<{ logs: AuditLog[] }>('/api/admin/audit', { params: filters }),

  getStats: () =>
    api.get<{
      totalRooms: number;
      activeRooms: number;
      totalUsers: number;
      totalStorage: number;
      storageByType: Record<string, number>;
    }>('/api/admin/stats'),
};
