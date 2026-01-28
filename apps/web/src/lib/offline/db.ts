'use client';

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Room, Item } from '@airshare/shared';

interface AirShareDB extends DBSchema {
  rooms: {
    key: string;
    value: Room & { cachedAt: number };
    indexes: { 'by-mode': string };
  };
  items: {
    key: string;
    value: Item & { cachedAt: number };
    indexes: { 'by-room': string };
  };
  pendingUploads: {
    key: string;
    value: PendingUpload;
    indexes: { 'by-room': string; 'by-status': string };
  };
  fileCache: {
    key: string;
    value: CachedFile;
    indexes: { 'by-item': string };
  };
  userPrefs: {
    key: string;
    value: unknown;
  };
}

export interface PendingUpload {
  id: string;
  roomCode: string;
  type: 'file' | 'text' | 'code' | 'link' | 'note';
  data: unknown;
  file?: {
    name: string;
    type: string;
    size: number;
    blob: Blob;
  };
  status: 'pending' | 'uploading' | 'failed';
  createdAt: number;
  retryCount: number;
  error?: string;
}

export interface CachedFile {
  id: string;
  itemId: string;
  filename: string;
  mimeType: string;
  size: number;
  blob: Blob;
  cachedAt: number;
}

const DB_NAME = 'airshare-offline';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AirShareDB>> | null = null;

function getDB(): Promise<IDBPDatabase<AirShareDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AirShareDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Rooms store
        if (!db.objectStoreNames.contains('rooms')) {
          const roomStore = db.createObjectStore('rooms', { keyPath: 'code' });
          roomStore.createIndex('by-mode', 'mode');
        }

        // Items store
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-room', 'roomId');
        }

        // Pending uploads store
        if (!db.objectStoreNames.contains('pendingUploads')) {
          const uploadStore = db.createObjectStore('pendingUploads', { keyPath: 'id' });
          uploadStore.createIndex('by-room', 'roomCode');
          uploadStore.createIndex('by-status', 'status');
        }

        // File cache store
        if (!db.objectStoreNames.contains('fileCache')) {
          const fileStore = db.createObjectStore('fileCache', { keyPath: 'id' });
          fileStore.createIndex('by-item', 'itemId');
        }

        // User preferences store
        if (!db.objectStoreNames.contains('userPrefs')) {
          db.createObjectStore('userPrefs');
        }
      },
    });
  }
  return dbPromise;
}

// Room operations
export async function cacheRoom(room: Room): Promise<void> {
  const db = await getDB();
  await db.put('rooms', { ...room, cachedAt: Date.now() });
}

export async function getCachedRoom(code: string): Promise<Room | undefined> {
  const db = await getDB();
  const room = await db.get('rooms', code);
  if (room) {
    const { cachedAt, ...roomData } = room;
    return roomData as Room;
  }
  return undefined;
}

export async function getCachedRooms(): Promise<Room[]> {
  const db = await getDB();
  const rooms = await db.getAll('rooms');
  return rooms.map(({ cachedAt, ...room }) => room as Room);
}

export async function getCachedRoomsByMode(mode: string): Promise<Room[]> {
  const db = await getDB();
  const rooms = await db.getAllFromIndex('rooms', 'by-mode', mode);
  return rooms.map(({ cachedAt, ...room }) => room as Room);
}

export async function removeCachedRoom(code: string): Promise<void> {
  const db = await getDB();
  await db.delete('rooms', code);
  // Also remove associated items
  const items = await db.getAllFromIndex('items', 'by-room', code);
  for (const item of items) {
    await db.delete('items', item.id);
  }
}

// Item operations
export async function cacheItem(item: Item): Promise<void> {
  const db = await getDB();
  await db.put('items', { ...item, cachedAt: Date.now() });
}

export async function cacheItems(items: Item[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('items', 'readwrite');
  await Promise.all([
    ...items.map((item) => tx.store.put({ ...item, cachedAt: Date.now() })),
    tx.done,
  ]);
}

export async function getCachedItem(id: string): Promise<Item | undefined> {
  const db = await getDB();
  const item = await db.get('items', id);
  if (item) {
    const { cachedAt, ...itemData } = item;
    return itemData as Item;
  }
  return undefined;
}

export async function getCachedItemsByRoom(roomId: string): Promise<Item[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex('items', 'by-room', roomId);
  return items.map(({ cachedAt, ...item }) => item as Item);
}

export async function removeCachedItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('items', id);
  // Also remove cached file if exists
  const files = await db.getAllFromIndex('fileCache', 'by-item', id);
  for (const file of files) {
    await db.delete('fileCache', file.id);
  }
}

// Pending upload operations
export async function addPendingUpload(upload: PendingUpload): Promise<void> {
  const db = await getDB();
  await db.put('pendingUploads', upload);
}

export async function getPendingUploads(): Promise<PendingUpload[]> {
  const db = await getDB();
  return db.getAll('pendingUploads');
}

export async function getPendingUploadsByRoom(roomCode: string): Promise<PendingUpload[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingUploads', 'by-room', roomCode);
}

export async function getPendingUploadsByStatus(status: string): Promise<PendingUpload[]> {
  const db = await getDB();
  return db.getAllFromIndex('pendingUploads', 'by-status', status);
}

export async function updatePendingUpload(id: string, updates: Partial<PendingUpload>): Promise<void> {
  const db = await getDB();
  const existing = await db.get('pendingUploads', id);
  if (existing) {
    await db.put('pendingUploads', { ...existing, ...updates });
  }
}

export async function removePendingUpload(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('pendingUploads', id);
}

// File cache operations
export async function cacheFile(file: CachedFile): Promise<void> {
  const db = await getDB();
  await db.put('fileCache', file);
}

export async function getCachedFile(id: string): Promise<CachedFile | undefined> {
  const db = await getDB();
  return db.get('fileCache', id);
}

export async function getCachedFileByItem(itemId: string): Promise<CachedFile | undefined> {
  const db = await getDB();
  const files = await db.getAllFromIndex('fileCache', 'by-item', itemId);
  return files[0];
}

export async function removeCachedFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('fileCache', id);
}

// User preferences
export async function setUserPref(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('userPrefs', value, key);
}

export async function getUserPref<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get('userPrefs', key) as Promise<T | undefined>;
}

// Cache management
export async function clearAllCache(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('rooms'),
    db.clear('items'),
    db.clear('fileCache'),
  ]);
}

export async function clearOldCache(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const cutoff = Date.now() - maxAgeMs;

  // Clear old rooms
  const rooms = await db.getAll('rooms');
  for (const room of rooms) {
    if (room.cachedAt < cutoff) {
      await db.delete('rooms', room.code);
    }
  }

  // Clear old items
  const items = await db.getAll('items');
  for (const item of items) {
    if (item.cachedAt < cutoff) {
      await db.delete('items', item.id);
    }
  }

  // Clear old files
  const files = await db.getAll('fileCache');
  for (const file of files) {
    if (file.cachedAt < cutoff) {
      await db.delete('fileCache', file.id);
    }
  }
}

// Get cache stats
export async function getCacheStats(): Promise<{
  rooms: number;
  items: number;
  files: number;
  pendingUploads: number;
}> {
  const db = await getDB();
  const [rooms, items, files, pendingUploads] = await Promise.all([
    db.count('rooms'),
    db.count('items'),
    db.count('fileCache'),
    db.count('pendingUploads'),
  ]);
  return { rooms, items, files, pendingUploads };
}
