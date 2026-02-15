import { io, Socket } from 'socket.io-client';
import type { Item, WebRTCSignal } from '@airshare/shared';
import { WS_EVENTS } from '@airshare/shared';

function resolveWebSocketUrl(): string {
  const explicitUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  const fallbackUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const rawUrl = explicitUrl || fallbackUrl || 'http://localhost:4000';

  try {
    return new URL(rawUrl).origin;
  } catch {
    return rawUrl;
  }
}

const WS_URL = resolveWebSocketUrl();

export interface PeerInfo {
  peerId: string;
  displayName?: string;
  joinedAt?: Date;
}

type EventHandler<T> = (data: T) => void;

class WebSocketClient {
  private socket: Socket | null = null;
  private roomCode: string | null = null;
  private peerId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Event handlers
  private handlers = {
    onConnect: new Set<EventHandler<void>>(),
    onDisconnect: new Set<EventHandler<void>>(),
    onUserJoined: new Set<EventHandler<PeerInfo>>(),
    onUserLeft: new Set<EventHandler<string>>(),
    onItemCreated: new Set<EventHandler<Item>>(),
    onItemUpdated: new Set<EventHandler<Item>>(),
    onItemDeleted: new Set<EventHandler<string>>(),
    onSignal: new Set<EventHandler<WebRTCSignal>>(),
    onPeers: new Set<EventHandler<PeerInfo[]>>(),
    onError: new Set<EventHandler<{ code: string; message: string }>>(),
  };

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(WS_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WS] Connected');
      this.reconnectAttempts = 0;
      this.handlers.onConnect.forEach((h) => h());

      // Rejoin room if was in one
      if (this.roomCode && this.peerId) {
        this.joinRoom(this.roomCode, this.peerId);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
      this.handlers.onDisconnect.forEach((h) => h());
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WS] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Room events
    this.socket.on(WS_EVENTS.ROOM_USER_JOINED, (data: PeerInfo) => {
      this.handlers.onUserJoined.forEach((h) => h(data));
    });

    this.socket.on(WS_EVENTS.ROOM_USER_LEFT, (data: { peerId: string }) => {
      this.handlers.onUserLeft.forEach((h) => h(data.peerId));
    });

    this.socket.on('room:peers', (data: { peers: PeerInfo[] }) => {
      this.handlers.onPeers.forEach((h) => h(data.peers));
    });

    // Item events
    this.socket.on(WS_EVENTS.ITEM_CREATED, (data: { item: Item }) => {
      this.handlers.onItemCreated.forEach((h) => h(data.item));
    });

    this.socket.on(WS_EVENTS.ITEM_UPDATED, (data: { item: Item }) => {
      this.handlers.onItemUpdated.forEach((h) => h(data.item));
    });

    this.socket.on(WS_EVENTS.ITEM_DELETED, (data: { itemId: string }) => {
      this.handlers.onItemDeleted.forEach((h) => h(data.itemId));
    });

    // WebRTC signaling
    this.socket.on(WS_EVENTS.WEBRTC_SIGNAL, (signal: WebRTCSignal) => {
      this.handlers.onSignal.forEach((h) => h(signal));
    });

    // Error handling
    this.socket.on(WS_EVENTS.ERROR, (error: { code: string; message: string }) => {
      console.error('[WS] Error:', error);
      this.handlers.onError.forEach((h) => h(error));
    });

    // Ping/pong
    this.socket.on(WS_EVENTS.PONG, () => {
      // Connection is alive
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomCode = null;
    this.peerId = null;
  }

  joinRoom(roomCode: string, peerId: string, displayName?: string): void {
    if (!this.socket?.connected) {
      this.connect();
    }

    this.roomCode = roomCode;
    this.peerId = peerId;

    this.socket?.emit(WS_EVENTS.ROOM_JOIN, {
      roomCode: roomCode.toUpperCase(),
      peerId,
      displayName,
    });
  }

  leaveRoom(): void {
    if (this.socket?.connected && this.roomCode) {
      this.socket.emit(WS_EVENTS.ROOM_LEAVE);
    }
    this.roomCode = null;
    this.peerId = null;
  }

  // Send WebRTC signal
  sendSignal(signal: Omit<WebRTCSignal, 'from' | 'roomCode'>): void {
    if (!this.socket?.connected || !this.roomCode || !this.peerId) return;

    this.socket.emit(WS_EVENTS.WEBRTC_SIGNAL, {
      ...signal,
      from: this.peerId,
      roomCode: this.roomCode,
    });
  }

  // Broadcast item events
  emitItemCreated(item: Item): void {
    this.socket?.emit(WS_EVENTS.ITEM_CREATE, { item });
  }

  emitItemUpdated(item: Item): void {
    this.socket?.emit(WS_EVENTS.ITEM_UPDATE, { item });
  }

  emitItemDeleted(itemId: string): void {
    this.socket?.emit(WS_EVENTS.ITEM_DELETE, { itemId });
  }

  // Ping for connection health
  ping(): void {
    this.socket?.emit(WS_EVENTS.PING);
  }

  // Event subscription methods
  onConnect(handler: EventHandler<void>): () => void {
    this.handlers.onConnect.add(handler);
    return () => this.handlers.onConnect.delete(handler);
  }

  onDisconnect(handler: EventHandler<void>): () => void {
    this.handlers.onDisconnect.add(handler);
    return () => this.handlers.onDisconnect.delete(handler);
  }

  onUserJoined(handler: EventHandler<PeerInfo>): () => void {
    this.handlers.onUserJoined.add(handler);
    return () => this.handlers.onUserJoined.delete(handler);
  }

  onUserLeft(handler: EventHandler<string>): () => void {
    this.handlers.onUserLeft.add(handler);
    return () => this.handlers.onUserLeft.delete(handler);
  }

  onItemCreated(handler: EventHandler<Item>): () => void {
    this.handlers.onItemCreated.add(handler);
    return () => this.handlers.onItemCreated.delete(handler);
  }

  onItemUpdated(handler: EventHandler<Item>): () => void {
    this.handlers.onItemUpdated.add(handler);
    return () => this.handlers.onItemUpdated.delete(handler);
  }

  onItemDeleted(handler: EventHandler<string>): () => void {
    this.handlers.onItemDeleted.add(handler);
    return () => this.handlers.onItemDeleted.delete(handler);
  }

  onSignal(handler: EventHandler<WebRTCSignal>): () => void {
    this.handlers.onSignal.add(handler);
    return () => this.handlers.onSignal.delete(handler);
  }

  onPeers(handler: EventHandler<PeerInfo[]>): () => void {
    this.handlers.onPeers.add(handler);
    return () => this.handlers.onPeers.delete(handler);
  }

  onError(handler: EventHandler<{ code: string; message: string }>): () => void {
    this.handlers.onError.add(handler);
    return () => this.handlers.onError.delete(handler);
  }

  // State getters
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  get currentRoom(): string | null {
    return this.roomCode;
  }

  get currentPeerId(): string | null {
    return this.peerId;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
