'use client';

import {
  Wifi,
  WifiOff,
  ArrowUpDown,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useState } from 'react';
import { useP2P } from '@/providers/WebRTCProvider';
import { LocalModeToggle } from './LocalModeToggle';
import { P2PPeerList } from './P2PPeerList';
import { P2PTransferList } from './P2PTransferList';
import { cn } from '@/lib/utils';

interface P2PStatusBarProps {
  onSendFile?: (peerId: string) => void;
  className?: string;
}

export function P2PStatusBar({ onSendFile, className }: P2PStatusBarProps) {
  const {
    isLocalMode,
    connectedPeers,
    activeTransfers,
    receivedFiles
  } = useP2P();
  const [isExpanded, setIsExpanded] = useState(false);

  const totalActiveItems = activeTransfers.length + receivedFiles.length;

  return (
    <div className={cn('bg-card border rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              isLocalMode
                ? 'bg-green-500/10 text-green-500'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {isLocalMode ? (
              <Wifi className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-sm">
              {isLocalMode ? 'P2P Mode Active' : 'P2P Mode'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isLocalMode
                ? `${connectedPeers.length} connected peer${connectedPeers.length !== 1 ? 's' : ''}`
                : 'Transfer files directly'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status indicators */}
          {isLocalMode && (
            <>
              {connectedPeers.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded-lg">
                  <Users className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-blue-600">
                    {connectedPeers.length}
                  </span>
                </div>
              )}
              {totalActiveItems > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 rounded-lg">
                  <ArrowUpDown className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-xs font-medium text-orange-600">
                    {totalActiveItems}
                  </span>
                </div>
              )}
            </>
          )}

          <LocalModeToggle />

          {isLocalMode && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isLocalMode && isExpanded && (
        <div className="border-t p-4 space-y-4">
          <P2PPeerList onSendFile={onSendFile} />
          <P2PTransferList />
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar
export function P2PCompactStatus({ className }: { className?: string }) {
  const { isLocalMode, connectedPeers, activeTransfers } = useP2P();

  if (!isLocalMode) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg',
        className
      )}
    >
      <Wifi className="h-4 w-4 text-green-500" />
      <div className="flex-1">
        <p className="text-xs font-medium text-green-600">P2P Active</p>
      </div>
      {connectedPeers.length > 0 && (
        <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">
          {connectedPeers.length} peers
        </span>
      )}
      {activeTransfers.length > 0 && (
        <span className="text-xs bg-orange-500/20 text-orange-600 px-1.5 py-0.5 rounded">
          {activeTransfers.length} transfers
        </span>
      )}
    </div>
  );
}
