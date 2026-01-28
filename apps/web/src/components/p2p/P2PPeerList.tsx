'use client';

import { useState } from 'react';
import {
  Users,
  Circle,
  Link2,
  Unlink,
  Send,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useP2P } from '@/providers/WebRTCProvider';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { PeerInfo } from '@/lib/websocket/client';
import type { P2PPeer } from '@/lib/webrtc';

interface P2PPeerListProps {
  onSendFile?: (peerId: string) => void;
  className?: string;
}

export function P2PPeerList({ onSendFile, className }: P2PPeerListProps) {
  const {
    isLocalMode,
    connectedPeers,
    availablePeers,
    connectToPeer,
    disconnectPeer
  } = useP2P();

  const [connectingPeers, setConnectingPeers] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isLocalMode) return null;

  const handleConnect = async (peerId: string) => {
    setConnectingPeers((prev) => new Set([...prev, peerId]));
    try {
      await connectToPeer(peerId);
    } catch (error) {
      console.error('Failed to connect:', error);
    } finally {
      setConnectingPeers((prev) => {
        const next = new Set(prev);
        next.delete(peerId);
        return next;
      });
    }
  };

  const connectedPeerIds = new Set(connectedPeers.map((p) => p.peerId));
  const disconnectedPeers = availablePeers.filter(
    (p) => !connectedPeerIds.has(p.peerId)
  );

  return (
    <div className={cn('bg-card border rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">P2P Peers</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {connectedPeers.length} / {availablePeers.length}
          </span>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {isExpanded && (
        <div className="border-t divide-y">
          {/* Connected Peers */}
          {connectedPeers.length > 0 && (
            <div className="p-2 space-y-1">
              <p className="px-2 py-1 text-xs text-muted-foreground font-medium">
                Connected
              </p>
              {connectedPeers.map((peer) => (
                <ConnectedPeerItem
                  key={peer.peerId}
                  peer={peer}
                  onDisconnect={() => disconnectPeer(peer.peerId)}
                  onSendFile={onSendFile ? () => onSendFile(peer.peerId) : undefined}
                />
              ))}
            </div>
          )}

          {/* Available (not connected) Peers */}
          {disconnectedPeers.length > 0 && (
            <div className="p-2 space-y-1">
              <p className="px-2 py-1 text-xs text-muted-foreground font-medium">
                Available
              </p>
              {disconnectedPeers.map((peer) => (
                <AvailablePeerItem
                  key={peer.peerId}
                  peer={peer}
                  isConnecting={connectingPeers.has(peer.peerId)}
                  onConnect={() => handleConnect(peer.peerId)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {availablePeers.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No peers available</p>
              <p className="text-xs mt-1">
                Other users in this room will appear here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectedPeerItem({
  peer,
  onDisconnect,
  onSendFile
}: {
  peer: P2PPeer;
  onDisconnect: () => void;
  onSendFile?: () => void;
}) {
  const name = peer.displayName || `User ${peer.peerId.slice(0, 4)}`;
  const initial = name[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <PeerAvatar initial={initial} peerId={peer.peerId} isConnected />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-green-500 flex items-center gap-1">
          <Circle className="h-2 w-2 fill-current" />
          Connected
        </p>
      </div>

      <div className="flex items-center gap-1">
        {onSendFile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSendFile}
            className="h-8 w-8 p-0"
            title="Send file"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          title="Disconnect"
        >
          <Unlink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function AvailablePeerItem({
  peer,
  isConnecting,
  onConnect
}: {
  peer: PeerInfo;
  isConnecting: boolean;
  onConnect: () => void;
}) {
  const name = peer.displayName || `User ${peer.peerId.slice(0, 4)}`;
  const initial = name[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <PeerAvatar initial={initial} peerId={peer.peerId} isConnected={false} />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">Available</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onConnect}
        disabled={isConnecting}
        className="h-8"
      >
        {isConnecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            <span className="ml-1">Connect</span>
          </>
        )}
      </Button>
    </div>
  );
}

function PeerAvatar({
  initial,
  peerId,
  isConnected
}: {
  initial: string;
  peerId: string;
  isConnected: boolean;
}) {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-teal-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-purple-500',
    'bg-pink-500',
  ];
  const colorIndex = peerId.charCodeAt(0) % colors.length;

  return (
    <div className="relative">
      <div
        className={cn(
          'h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-medium',
          colors[colorIndex]
        )}
      >
        {initial}
      </div>
      <div
        className={cn(
          'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
          isConnected ? 'bg-green-500' : 'bg-gray-400'
        )}
      />
    </div>
  );
}
