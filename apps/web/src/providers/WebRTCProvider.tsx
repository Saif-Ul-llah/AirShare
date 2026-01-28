'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { PeerManager, P2PPeer, TransferTask } from '@/lib/webrtc';
import { wsClient, PeerInfo } from '@/lib/websocket/client';
import { useRoomStore } from '@/lib/stores';

interface WebRTCContextValue {
  // State
  isLocalMode: boolean;
  connectedPeers: P2PPeer[];
  availablePeers: PeerInfo[];
  activeTransfers: TransferTask[];
  receivedFiles: Array<{ transfer: TransferTask; file: File }>;

  // Actions
  enableLocalMode: () => void;
  disableLocalMode: () => void;
  connectToPeer: (peerId: string) => Promise<void>;
  disconnectPeer: (peerId: string) => void;
  sendFile: (peerId: string, file: File, encrypted?: boolean, iv?: string) => Promise<string>;
  broadcastFile: (file: File, encrypted?: boolean, iv?: string) => Promise<Map<string, string>>;
  cancelTransfer: (transferId: string) => void;
  acceptFile: (transferId: string) => File | null;
  dismissReceivedFile: (transferId: string) => void;
}

const WebRTCContext = createContext<WebRTCContextValue | null>(null);

interface WebRTCProviderProps {
  children: React.ReactNode;
  roomCode?: string;
  peerId?: string;
}

export function WebRTCProvider({ children, roomCode, peerId }: WebRTCProviderProps) {
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<P2PPeer[]>([]);
  const [availablePeers, setAvailablePeers] = useState<PeerInfo[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<TransferTask[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<Array<{ transfer: TransferTask; file: File }>>([]);

  const peerManagerRef = useRef<PeerManager | null>(null);
  const { presence } = useRoomStore();

  // Initialize peer manager when local mode is enabled
  useEffect(() => {
    if (!isLocalMode || !roomCode || !peerId) {
      return;
    }

    const manager = new PeerManager(roomCode, peerId);
    peerManagerRef.current = manager;

    // Set up event handlers
    manager.setOnPeerConnected((peer) => {
      setConnectedPeers((prev) => [...prev.filter((p) => p.peerId !== peer.peerId), peer]);
    });

    manager.setOnPeerDisconnected((disconnectedPeerId) => {
      setConnectedPeers((prev) => prev.filter((p) => p.peerId !== disconnectedPeerId));
    });

    manager.setOnTransferProgress((transfer) => {
      setActiveTransfers((prev) => {
        const existing = prev.find((t) => t.transferId === transfer.transferId);
        if (existing) {
          return prev.map((t) => (t.transferId === transfer.transferId ? transfer : t));
        }
        return [...prev, transfer];
      });
    });

    manager.setOnFileReceived((transfer, file) => {
      setReceivedFiles((prev) => [...prev, { transfer, file }]);
      // Remove from active transfers
      setActiveTransfers((prev) =>
        prev.filter((t) => t.transferId !== transfer.transferId)
      );
    });

    return () => {
      manager.close();
      peerManagerRef.current = null;
      setConnectedPeers([]);
      setActiveTransfers([]);
    };
  }, [isLocalMode, roomCode, peerId]);

  // Sync available peers from presence
  useEffect(() => {
    if (!peerManagerRef.current) return;

    const peers: PeerInfo[] = presence
      .filter((p) => p.odId !== peerId)
      .map((p) => ({
        peerId: p.odId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
      }));

    peerManagerRef.current.setPeers(peers);
    setAvailablePeers(peers);
  }, [presence, peerId]);

  // Listen for peer join/leave events
  useEffect(() => {
    if (!peerManagerRef.current || !isLocalMode) return;

    const unsubJoined = wsClient.onUserJoined((peer) => {
      if (peer.peerId !== peerId) {
        peerManagerRef.current?.addPeer(peer);
        setAvailablePeers((prev) => [
          ...prev.filter((p) => p.peerId !== peer.peerId),
          peer,
        ]);
      }
    });

    const unsubLeft = wsClient.onUserLeft((leftPeerId) => {
      peerManagerRef.current?.removePeer(leftPeerId);
      setAvailablePeers((prev) => prev.filter((p) => p.peerId !== leftPeerId));
      setConnectedPeers((prev) => prev.filter((p) => p.peerId !== leftPeerId));
    });

    return () => {
      unsubJoined();
      unsubLeft();
    };
  }, [isLocalMode, peerId]);

  const enableLocalMode = useCallback(() => {
    setIsLocalMode(true);
  }, []);

  const disableLocalMode = useCallback(() => {
    if (peerManagerRef.current) {
      peerManagerRef.current.close();
      peerManagerRef.current = null;
    }
    setIsLocalMode(false);
    setConnectedPeers([]);
    setActiveTransfers([]);
  }, []);

  const connectToPeer = useCallback(async (targetPeerId: string) => {
    if (!peerManagerRef.current) {
      throw new Error('Local mode not enabled');
    }
    await peerManagerRef.current.connectToPeer(targetPeerId);
  }, []);

  const disconnectPeer = useCallback((targetPeerId: string) => {
    peerManagerRef.current?.disconnectPeer(targetPeerId);
  }, []);

  const sendFile = useCallback(
    async (targetPeerId: string, file: File, encrypted = false, iv?: string) => {
      if (!peerManagerRef.current) {
        throw new Error('Local mode not enabled');
      }
      return peerManagerRef.current.sendFile(targetPeerId, file, encrypted, iv);
    },
    []
  );

  const broadcastFile = useCallback(
    async (file: File, encrypted = false, iv?: string) => {
      if (!peerManagerRef.current) {
        throw new Error('Local mode not enabled');
      }
      return peerManagerRef.current.broadcastFile(file, encrypted, iv);
    },
    []
  );

  const cancelTransfer = useCallback((transferId: string) => {
    peerManagerRef.current?.cancelTransfer(transferId);
    setActiveTransfers((prev) =>
      prev.map((t) =>
        t.transferId === transferId ? { ...t, status: 'cancelled' as const } : t
      )
    );
  }, []);

  const acceptFile = useCallback((transferId: string): File | null => {
    const received = receivedFiles.find((r) => r.transfer.transferId === transferId);
    if (received) {
      peerManagerRef.current?.cleanupTransfer(transferId);
      return received.file;
    }
    return null;
  }, [receivedFiles]);

  const dismissReceivedFile = useCallback((transferId: string) => {
    peerManagerRef.current?.cleanupTransfer(transferId);
    setReceivedFiles((prev) =>
      prev.filter((r) => r.transfer.transferId !== transferId)
    );
  }, []);

  const value: WebRTCContextValue = {
    isLocalMode,
    connectedPeers,
    availablePeers,
    activeTransfers,
    receivedFiles,
    enableLocalMode,
    disableLocalMode,
    connectToPeer,
    disconnectPeer,
    sendFile,
    broadcastFile,
    cancelTransfer,
    acceptFile,
    dismissReceivedFile,
  };

  return (
    <WebRTCContext.Provider value={value}>
      {children}
    </WebRTCContext.Provider>
  );
}

export function useP2P() {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useP2P must be used within a WebRTCProvider');
  }
  return context;
}

// Higher-order component to wrap room pages with WebRTC support
export function withP2P<P extends object>(
  Component: React.ComponentType<P>,
  getRoomCode: (props: P) => string | undefined,
  getPeerId: (props: P) => string | undefined
) {
  return function WrappedComponent(props: P) {
    const roomCode = getRoomCode(props);
    const peerId = getPeerId(props);

    return (
      <WebRTCProvider roomCode={roomCode} peerId={peerId}>
        <Component {...props} />
      </WebRTCProvider>
    );
  };
}
