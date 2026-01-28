'use client';

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { useP2P } from '@/providers/WebRTCProvider';
import { cn } from '@/lib/utils';

interface LocalModeToggleProps {
  className?: string;
}

export function LocalModeToggle({ className }: LocalModeToggleProps) {
  const { isLocalMode, enableLocalMode, disableLocalMode, connectedPeers } = useP2P();

  const handleToggle = () => {
    if (isLocalMode) {
      disableLocalMode();
    } else {
      enableLocalMode();
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
        isLocalMode
          ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
        className
      )}
    >
      {isLocalMode ? (
        <>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">Local Mode</span>
          {connectedPeers.length > 0 && (
            <span className="text-xs bg-green-500/20 px-1.5 py-0.5 rounded">
              {connectedPeers.length} connected
            </span>
          )}
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Enable P2P</span>
        </>
      )}
    </button>
  );
}

// Compact version for mobile
export function LocalModeIndicator({ className }: { className?: string }) {
  const { isLocalMode, connectedPeers } = useP2P();

  if (!isLocalMode) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 bg-green-500/10 rounded-lg',
        className
      )}
    >
      <Wifi className="h-3.5 w-3.5 text-green-500" />
      <span className="text-xs text-green-600 font-medium">
        P2P ({connectedPeers.length})
      </span>
    </div>
  );
}
