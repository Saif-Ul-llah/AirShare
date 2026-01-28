'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { wsClient, PeerInfo } from '@/lib/websocket/client';
import { useRoomStore } from '@/lib/stores/room-store';

interface WebSocketContextValue {
  isConnected: boolean;
  peerId: string | null;
  joinRoom: (roomCode: string, displayName?: string) => void;
  leaveRoom: () => void;
  emitItemCreated: (item: any) => void;
  emitItemUpdated: (item: any) => void;
  emitItemDeleted: (itemId: string) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const peerIdRef = useRef<string | null>(null);
  const { addItem, updateItem, removeItem, addPeer, removePeer, setPresence } = useRoomStore();

  useEffect(() => {
    // Generate a unique peer ID for this session
    peerIdRef.current = crypto.randomUUID();

    // Set up event handlers
    const unsubConnect = wsClient.onConnect(() => setIsConnected(true));
    const unsubDisconnect = wsClient.onDisconnect(() => setIsConnected(false));

    const unsubUserJoined = wsClient.onUserJoined((peer) => {
      addPeer({
        odId: peer.peerId,
        displayName: peer.displayName,
        joinedAt: peer.joinedAt || new Date(),
      });
    });

    const unsubUserLeft = wsClient.onUserLeft((peerId) => {
      removePeer(peerId);
    });

    const unsubPeers = wsClient.onPeers((peers) => {
      setPresence(
        peers.map((p) => ({
          odId: p.peerId,
          displayName: p.displayName,
          joinedAt: p.joinedAt || new Date(),
        }))
      );
    });

    const unsubItemCreated = wsClient.onItemCreated((item) => {
      addItem(item);
    });

    const unsubItemUpdated = wsClient.onItemUpdated((item) => {
      updateItem(item);
    });

    const unsubItemDeleted = wsClient.onItemDeleted((itemId) => {
      removeItem(itemId);
    });

    // Connect to WebSocket server
    wsClient.connect();

    // Cleanup
    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubUserJoined();
      unsubUserLeft();
      unsubPeers();
      unsubItemCreated();
      unsubItemUpdated();
      unsubItemDeleted();
      wsClient.disconnect();
    };
  }, [addItem, updateItem, removeItem, addPeer, removePeer, setPresence]);

  const joinRoom = (roomCode: string, displayName?: string) => {
    if (peerIdRef.current) {
      wsClient.joinRoom(roomCode, peerIdRef.current, displayName);
    }
  };

  const leaveRoom = () => {
    wsClient.leaveRoom();
  };

  const emitItemCreated = (item: any) => {
    wsClient.emitItemCreated(item);
  };

  const emitItemUpdated = (item: any) => {
    wsClient.emitItemUpdated(item);
  };

  const emitItemDeleted = (itemId: string) => {
    wsClient.emitItemDeleted(itemId);
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        peerId: peerIdRef.current,
        joinRoom,
        leaveRoom,
        emitItemCreated,
        emitItemUpdated,
        emitItemDeleted,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
}
