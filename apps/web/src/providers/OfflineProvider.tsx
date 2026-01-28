'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef
} from 'react';
import {
  PendingUpload,
  addPendingUpload,
  getPendingUploads,
  removePendingUpload,
  cacheRoom,
  getCachedRoom,
  getCachedRooms,
  cacheItems,
  getCachedItemsByRoom,
  cacheFile,
  getCachedFileByItem,
  getCacheStats,
  clearOldCache,
} from '@/lib/offline/db';
import { offlineSyncService } from '@/lib/offline/sync';
import type { Room, Item } from '@airshare/shared';

interface OfflineContextValue {
  // Network state
  isOnline: boolean;

  // Sync state
  isSyncing: boolean;
  pendingCount: number;

  // Cache operations
  cacheRoom: (room: Room) => Promise<void>;
  getCachedRoom: (code: string) => Promise<Room | undefined>;
  getCachedRooms: () => Promise<Room[]>;
  cacheItems: (items: Item[]) => Promise<void>;
  getCachedItems: (roomId: string) => Promise<Item[]>;
  cacheFileBlob: (itemId: string, filename: string, mimeType: string, blob: Blob) => Promise<void>;
  getCachedFileBlob: (itemId: string) => Promise<Blob | undefined>;

  // Pending uploads
  queueUpload: (upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>) => Promise<void>;
  getPendingUploads: () => Promise<PendingUpload[]>;
  removePendingUpload: (id: string) => Promise<void>;

  // Sync
  syncNow: () => Promise<void>;

  // Stats
  getCacheStats: () => Promise<{ rooms: number; items: number; files: number; pendingUploads: number }>;
  clearOldCache: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const mountedRef = useRef(true);

  // Initialize online state
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      offlineSyncService.syncPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync events
    const unsubStart = offlineSyncService.on('sync:start', () => {
      if (mountedRef.current) setIsSyncing(true);
    });

    const unsubComplete = offlineSyncService.on('sync:complete', () => {
      if (mountedRef.current) {
        setIsSyncing(false);
        updatePendingCount();
      }
    });

    const unsubError = offlineSyncService.on('sync:error', () => {
      if (mountedRef.current) updatePendingCount();
    });

    // Initial pending count
    updatePendingCount();

    // Clear old cache on startup
    clearOldCache();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubStart();
      unsubComplete();
      unsubError();
    };
  }, []);

  const updatePendingCount = async () => {
    const pending = await getPendingUploads();
    if (mountedRef.current) {
      setPendingCount(pending.filter((p) => p.status === 'pending').length);
    }
  };

  const handleCacheRoom = useCallback(async (room: Room) => {
    await cacheRoom(room);
  }, []);

  const handleGetCachedRoom = useCallback(async (code: string) => {
    return getCachedRoom(code);
  }, []);

  const handleGetCachedRooms = useCallback(async () => {
    return getCachedRooms();
  }, []);

  const handleCacheItems = useCallback(async (items: Item[]) => {
    await cacheItems(items);
  }, []);

  const handleGetCachedItems = useCallback(async (roomId: string) => {
    return getCachedItemsByRoom(roomId);
  }, []);

  const handleCacheFileBlob = useCallback(
    async (itemId: string, filename: string, mimeType: string, blob: Blob) => {
      await cacheFile({
        id: `file-${itemId}`,
        itemId,
        filename,
        mimeType,
        size: blob.size,
        blob,
        cachedAt: Date.now(),
      });
    },
    []
  );

  const handleGetCachedFileBlob = useCallback(async (itemId: string) => {
    const cached = await getCachedFileByItem(itemId);
    return cached?.blob;
  }, []);

  const handleQueueUpload = useCallback(
    async (upload: Omit<PendingUpload, 'id' | 'createdAt' | 'retryCount' | 'status'>) => {
      const pendingUpload: PendingUpload = {
        ...upload,
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      };
      await addPendingUpload(pendingUpload);
      await updatePendingCount();

      // Try to sync immediately if online
      if (navigator.onLine) {
        offlineSyncService.syncPending();
      }
    },
    []
  );

  const handleGetPendingUploads = useCallback(async () => {
    return getPendingUploads();
  }, []);

  const handleRemovePendingUpload = useCallback(async (id: string) => {
    await removePendingUpload(id);
    await updatePendingCount();
  }, []);

  const handleSyncNow = useCallback(async () => {
    await offlineSyncService.syncPending();
  }, []);

  const handleGetCacheStats = useCallback(async () => {
    return getCacheStats();
  }, []);

  const handleClearOldCache = useCallback(async () => {
    await clearOldCache();
  }, []);

  const value: OfflineContextValue = {
    isOnline,
    isSyncing,
    pendingCount,
    cacheRoom: handleCacheRoom,
    getCachedRoom: handleGetCachedRoom,
    getCachedRooms: handleGetCachedRooms,
    cacheItems: handleCacheItems,
    getCachedItems: handleGetCachedItems,
    cacheFileBlob: handleCacheFileBlob,
    getCachedFileBlob: handleGetCachedFileBlob,
    queueUpload: handleQueueUpload,
    getPendingUploads: handleGetPendingUploads,
    removePendingUpload: handleRemovePendingUpload,
    syncNow: handleSyncNow,
    getCacheStats: handleGetCacheStats,
    clearOldCache: handleClearOldCache,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
}
