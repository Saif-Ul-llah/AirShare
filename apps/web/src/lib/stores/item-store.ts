import { create } from 'zustand';
import type { Item, ItemType } from '@airshare/shared';
import { itemApi, uploadApi, CreateItemData, UpdateItemData } from '@/lib/api/endpoints';

export interface UploadTask {
  id: string;
  file: File;
  roomCode: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  item?: Item;
}

interface ItemState {
  selectedItem: Item | null;
  uploadQueue: UploadTask[];
  isCreating: boolean;
  error: string | null;

  // Item CRUD
  createItem: (roomCode: string, type: ItemType, content: unknown, options?: CreateItemData['access']) => Promise<Item | null>;
  getItem: (id: string, password?: string) => Promise<Item | null>;
  getItemByShareUrl: (shareUrl: string, password?: string) => Promise<Item | null>;
  updateItem: (id: string, data: UpdateItemData) => Promise<Item | null>;
  deleteItem: (id: string) => Promise<boolean>;

  // Selection
  selectItem: (item: Item | null) => void;

  // Upload queue management
  addToUploadQueue: (task: Omit<UploadTask, 'status' | 'progress'>) => void;
  updateUploadTask: (id: string, updates: Partial<UploadTask>) => void;
  removeFromUploadQueue: (id: string) => void;
  clearCompletedUploads: () => void;

  // File upload
  uploadFile: (file: File, roomCode: string, onProgress?: (progress: number) => void) => Promise<Item | null>;

  // Version management
  getVersions: (itemId: string) => Promise<Array<{ id: string; version: number; createdAt: Date }>>;
  restoreVersion: (itemId: string, version: number) => Promise<Item | null>;

  clearError: () => void;
}

export const useItemStore = create<ItemState>((set, get) => ({
  selectedItem: null,
  uploadQueue: [],
  isCreating: false,
  error: null,

  createItem: async (roomCode, type, content, accessOptions) => {
    set({ isCreating: true, error: null });
    try {
      const data: CreateItemData = {
        type: type as CreateItemData['type'],
        content,
        access: accessOptions,
      };
      const response = await itemApi.create(roomCode, data);
      if (response.success && response.data) {
        set({ isCreating: false });
        return response.data.item;
      }
      set({
        error: response.error?.message || 'Failed to create item',
        isCreating: false,
      });
      return null;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create item',
        isCreating: false,
      });
      return null;
    }
  },

  getItem: async (id, password) => {
    try {
      const response = await itemApi.get(id, password);
      if (response.success && response.data) {
        return response.data.item;
      }
    } catch {
      // Item fetch failed
    }
    return null;
  },

  getItemByShareUrl: async (shareUrl, password) => {
    try {
      const response = await itemApi.getByShareUrl(shareUrl, password);
      if (response.success && response.data) {
        return response.data.item;
      }
    } catch {
      // Item fetch failed
    }
    return null;
  },

  updateItem: async (id, data) => {
    set({ error: null });
    try {
      const response = await itemApi.update(id, data);
      if (response.success && response.data) {
        const { selectedItem } = get();
        if (selectedItem?.id === id) {
          set({ selectedItem: response.data.item });
        }
        return response.data.item;
      }
      set({ error: response.error?.message || 'Failed to update item' });
      return null;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update item' });
      return null;
    }
  },

  deleteItem: async (id) => {
    try {
      const response = await itemApi.delete(id);
      if (response.success) {
        const { selectedItem } = get();
        if (selectedItem?.id === id) {
          set({ selectedItem: null });
        }
        return true;
      }
    } catch {
      // Delete failed
    }
    return false;
  },

  selectItem: (item) => {
    set({ selectedItem: item });
  },

  addToUploadQueue: (task) => {
    set((state) => ({
      uploadQueue: [
        ...state.uploadQueue,
        { ...task, status: 'pending', progress: 0 },
      ],
    }));
  },

  updateUploadTask: (id, updates) => {
    set((state) => ({
      uploadQueue: state.uploadQueue.map((task) =>
        task.id === id ? { ...task, ...updates } : task
      ),
    }));
  },

  removeFromUploadQueue: (id) => {
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((task) => task.id !== id),
    }));
  },

  clearCompletedUploads: () => {
    set((state) => ({
      uploadQueue: state.uploadQueue.filter(
        (task) => task.status !== 'completed' && task.status !== 'failed'
      ),
    }));
  },

  uploadFile: async (file, roomCode, onProgress) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

    try {
      // Initialize upload - server returns presigned S3/R2 URLs
      const initResponse = await uploadApi.init({
        roomCode,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        encrypted: false,
      });

      if (!initResponse.success || !initResponse.data) {
        throw new Error('Failed to initialize upload');
      }

      const { uploadId, totalChunks, chunkSize, presignedUrls } = initResponse.data;
      const actualChunkSize = chunkSize || CHUNK_SIZE;

      // Upload each chunk to presigned S3/R2 URL, then notify backend
      for (let i = 0; i < totalChunks; i++) {
        const start = i * actualChunkSize;
        const end = Math.min(start + actualChunkSize, file.size);
        const chunk = file.slice(start, end);

        // Upload directly to S3/R2 via presigned URL
        const presignedUrl = presignedUrls?.[i];
        if (!presignedUrl) {
          throw new Error(`Missing presigned URL for chunk ${i}`);
        }

        const uploadResponse = await uploadApi.uploadToPresignedUrl(
          presignedUrl,
          chunk,
          file.type || 'application/octet-stream',
          (chunkProgress) => {
            const overallProgress = ((i + chunkProgress / 100) / totalChunks) * 100;
            onProgress?.(overallProgress);
          }
        );

        // Notify backend that chunk was uploaded
        await uploadApi.markChunkUploaded(uploadId, i, uploadResponse.etag);
      }

      // Calculate checksum (simplified - just use size for now)
      const checksum = file.size.toString(16);

      // Complete upload
      const completeResponse = await uploadApi.complete(uploadId, checksum);

      if (!completeResponse.success || !completeResponse.data) {
        throw new Error('Failed to complete upload');
      }

      onProgress?.(100);
      return completeResponse.data.item;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  getVersions: async (itemId) => {
    try {
      const response = await itemApi.getVersions(itemId);
      if (response.success && response.data) {
        return response.data.versions;
      }
    } catch {
      // Version fetch failed
    }
    return [];
  },

  restoreVersion: async (itemId, version) => {
    try {
      const response = await itemApi.restoreVersion(itemId, version);
      if (response.success && response.data) {
        const { selectedItem } = get();
        if (selectedItem?.id === itemId) {
          set({ selectedItem: response.data.item });
        }
        return response.data.item;
      }
    } catch {
      // Restore failed
    }
    return null;
  },

  clearError: () => set({ error: null }),
}));
