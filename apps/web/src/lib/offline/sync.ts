'use client';

import {
  getPendingUploadsByStatus,
  updatePendingUpload,
  removePendingUpload,
  PendingUpload,
} from './db';
import { itemApi, uploadApi } from '@/lib/api/endpoints';

type SyncEventType = 'sync:start' | 'sync:progress' | 'sync:complete' | 'sync:error';
type SyncEventHandler = (data: SyncEventData) => void;

interface SyncEventData {
  type: SyncEventType;
  total?: number;
  completed?: number;
  failed?: number;
  current?: PendingUpload;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export class OfflineSyncService {
  private isSyncing = false;
  private listeners: Map<SyncEventType, Set<SyncEventHandler>> = new Map();

  constructor() {
    // Initialize listener sets
    const events: SyncEventType[] = ['sync:start', 'sync:progress', 'sync:complete', 'sync:error'];
    events.forEach((event) => {
      this.listeners.set(event, new Set());
    });

    // Listen for online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncPending();
      });
    }
  }

  on(event: SyncEventType, handler: SyncEventHandler): () => void {
    this.listeners.get(event)?.add(handler);
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  private emit(event: SyncEventType, data: Omit<SyncEventData, 'type'>): void {
    this.listeners.get(event)?.forEach((handler) => {
      handler({ type: event, ...data });
    });
  }

  async syncPending(): Promise<void> {
    if (this.isSyncing) return;
    if (!navigator.onLine) return;

    this.isSyncing = true;
    const pending = await getPendingUploadsByStatus('pending');

    if (pending.length === 0) {
      this.isSyncing = false;
      return;
    }

    this.emit('sync:start', { total: pending.length });

    let completed = 0;
    let failed = 0;

    for (const upload of pending) {
      try {
        this.emit('sync:progress', {
          total: pending.length,
          completed,
          failed,
          current: upload,
        });

        await this.processUpload(upload);
        await removePendingUpload(upload.id);
        completed++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';

        if (upload.retryCount >= MAX_RETRIES) {
          await updatePendingUpload(upload.id, {
            status: 'failed',
            error: errorMessage,
          });
          this.emit('sync:error', {
            current: upload,
            error: `Upload failed after ${MAX_RETRIES} retries: ${errorMessage}`,
          });
        } else {
          await updatePendingUpload(upload.id, {
            retryCount: upload.retryCount + 1,
            error: errorMessage,
          });
        }
      }
    }

    this.emit('sync:complete', {
      total: pending.length,
      completed,
      failed,
    });

    this.isSyncing = false;

    // Retry failed uploads after delay
    if (failed > 0) {
      setTimeout(() => {
        this.syncPending();
      }, RETRY_DELAY_MS);
    }
  }

  private async processUpload(upload: PendingUpload): Promise<void> {
    switch (upload.type) {
      case 'file':
        await this.uploadFile(upload);
        break;
      case 'text':
      case 'code':
      case 'link':
      case 'note':
        await this.createItem(upload);
        break;
    }
  }

  private async uploadFile(upload: PendingUpload): Promise<void> {
    if (!upload.file) {
      throw new Error('No file data in pending upload');
    }

    const file = new File(
      [upload.file.blob],
      upload.file.name,
      { type: upload.file.type }
    );

    // Init upload
    const { uploadId } = await uploadApi.initUpload({
      roomCode: upload.roomCode,
      filename: file.name,
      size: file.size,
      mimeType: file.type,
    });

    // Upload in chunks
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      await uploadApi.uploadChunk({
        uploadId,
        chunkIndex: i,
        chunk,
      });
    }

    // Complete upload
    await uploadApi.completeUpload({ uploadId });
  }

  private async createItem(upload: PendingUpload): Promise<void> {
    await itemApi.createItem({
      roomCode: upload.roomCode,
      type: upload.type,
      content: upload.data,
    });
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

// Singleton instance
export const offlineSyncService = new OfflineSyncService();
