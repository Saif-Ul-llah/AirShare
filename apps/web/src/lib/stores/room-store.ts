import { create } from 'zustand';
import type { Room, Item, RoomSettings } from '@airshare/shared';
import { roomApi, CreateRoomData } from '@/lib/api/endpoints';

export interface PeerPresence {
  odId: string;
  displayName?: string;
  joinedAt: Date;
}

interface RoomState {
  currentRoom: (Room & { encryptionSalt?: string }) | null;
  items: Item[];
  presence: PeerPresence[];
  isLoading: boolean;
  error: string | null;
  myRooms: Room[];
  myRoomsLoading: boolean;

  // Actions
  createRoom: (data: CreateRoomData) => Promise<Room | null>;
  joinRoom: (code: string, password?: string) => Promise<boolean>;
  leaveRoom: () => void;
  updateRoom: (code: string, changes: Partial<CreateRoomData>) => Promise<boolean>;
  deleteRoom: (code: string) => Promise<boolean>;
  fetchMyRooms: () => Promise<void>;
  searchItems: (query: string) => Promise<Item[]>;

  // Item sync from WebSocket
  addItem: (item: Item) => void;
  updateItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  setItems: (items: Item[]) => void;

  // Presence updates
  addPeer: (peer: PeerPresence) => void;
  removePeer: (odId: string) => void;
  setPresence: (presence: PeerPresence[]) => void;

  clearError: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  items: [],
  presence: [],
  isLoading: false,
  error: null,
  myRooms: [],
  myRoomsLoading: false,

  createRoom: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await roomApi.create(data);
      if (response.success && response.data) {
        const room = response.data.room;
        set({
          currentRoom: room,
          items: [],
          presence: [],
          isLoading: false,
        });
        return room;
      }
      set({
        error: response.error?.message || 'Failed to create room',
        isLoading: false,
      });
      return null;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create room',
        isLoading: false,
      });
      return null;
    }
  },

  joinRoom: async (code, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await roomApi.get(code, password);
      if (response.success && response.data) {
        set({
          currentRoom: response.data.room,
          items: response.data.items || [],
          presence: (response.data.presence || []).map((p) => ({
            ...p,
            joinedAt: new Date(p.joinedAt),
          })),
          isLoading: false,
        });
        return true;
      }
      set({
        error: response.error?.message || 'Failed to join room',
        isLoading: false,
      });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to join room',
        isLoading: false,
      });
      return false;
    }
  },

  leaveRoom: () => {
    set({
      currentRoom: null,
      items: [],
      presence: [],
      error: null,
    });
  },

  updateRoom: async (code, changes) => {
    set({ isLoading: true, error: null });
    try {
      const response = await roomApi.update(code, changes);
      if (response.success && response.data) {
        set({
          currentRoom: response.data.room,
          isLoading: false,
        });
        return true;
      }
      set({
        error: response.error?.message || 'Failed to update room',
        isLoading: false,
      });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update room',
        isLoading: false,
      });
      return false;
    }
  },

  deleteRoom: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await roomApi.delete(code);
      if (response.success) {
        set({
          currentRoom: null,
          items: [],
          presence: [],
          isLoading: false,
        });
        return true;
      }
      set({
        error: response.error?.message || 'Failed to delete room',
        isLoading: false,
      });
      return false;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete room',
        isLoading: false,
      });
      return false;
    }
  },

  fetchMyRooms: async () => {
    set({ myRoomsLoading: true });
    try {
      const response = await roomApi.myRooms();
      if (response.success && response.data) {
        set({ myRooms: response.data.rooms, myRoomsLoading: false });
      } else {
        set({ myRoomsLoading: false });
      }
    } catch {
      set({ myRoomsLoading: false });
    }
  },

  searchItems: async (query) => {
    const { currentRoom } = get();
    if (!currentRoom) return [];

    try {
      const response = await roomApi.search(currentRoom.code, query);
      if (response.success && response.data) {
        return response.data.items;
      }
    } catch {
      // Search failed
    }
    return [];
  },

  // Item sync
  addItem: (item) => {
    set((state) => ({
      items: [item, ...state.items],
    }));
  },

  updateItem: (item) => {
    set((state) => ({
      items: state.items.map((i) => (i.id === item.id ? item : i)),
    }));
  },

  removeItem: (itemId) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== itemId),
    }));
  },

  setItems: (items) => {
    set({ items });
  },

  // Presence
  addPeer: (peer) => {
    set((state) => ({
      presence: [...state.presence.filter((p) => p.odId !== peer.odId), peer],
    }));
  },

  removePeer: (odId) => {
    set((state) => ({
      presence: state.presence.filter((p) => p.odId !== odId),
    }));
  },

  setPresence: (presence) => {
    set({ presence });
  },

  clearError: () => set({ error: null }),
}));
