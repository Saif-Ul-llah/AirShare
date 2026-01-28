'use client';

import { useCallback } from 'react';
import type { Item, ItemType } from '@airshare/shared';
import { useItemStore, useRoomStore } from '@/lib/stores';
import { useWebSocket } from '@/providers/WebSocketProvider';

/**
 * Hook that provides item CRUD operations with WebSocket sync
 */
export function useItemActions() {
  const {
    createItem: createItemStore,
    updateItem: updateItemStore,
    deleteItem: deleteItemStore,
    uploadFile: uploadFileStore,
    isCreating,
    error,
    clearError
  } = useItemStore();

  const { addItem, updateItem: updateRoomItem, removeItem } = useRoomStore();
  const { emitItemCreated, emitItemUpdated, emitItemDeleted } = useWebSocket();

  const createItem = useCallback(async (
    roomCode: string,
    type: ItemType,
    content: unknown,
    options?: any
  ): Promise<Item | null> => {
    const item = await createItemStore(roomCode, type, content, options);
    if (item) {
      // Update local store
      addItem(item);
      // Broadcast to other clients
      emitItemCreated(item);
    }
    return item;
  }, [createItemStore, addItem, emitItemCreated]);

  const updateItem = useCallback(async (
    id: string,
    data: any
  ): Promise<Item | null> => {
    const item = await updateItemStore(id, data);
    if (item) {
      // Update local store
      updateRoomItem(item);
      // Broadcast to other clients
      emitItemUpdated(item);
    }
    return item;
  }, [updateItemStore, updateRoomItem, emitItemUpdated]);

  const deleteItem = useCallback(async (id: string): Promise<boolean> => {
    const success = await deleteItemStore(id);
    if (success) {
      // Update local store
      removeItem(id);
      // Broadcast to other clients
      emitItemDeleted(id);
    }
    return success;
  }, [deleteItemStore, removeItem, emitItemDeleted]);

  const uploadFile = useCallback(async (
    file: File,
    roomCode: string,
    onProgress?: (progress: number) => void
  ): Promise<Item | null> => {
    const item = await uploadFileStore(file, roomCode, onProgress);
    if (item) {
      // Update local store
      addItem(item);
      // Broadcast to other clients
      emitItemCreated(item);
    }
    return item;
  }, [uploadFileStore, addItem, emitItemCreated]);

  return {
    createItem,
    updateItem,
    deleteItem,
    uploadFile,
    isCreating,
    error,
    clearError
  };
}
