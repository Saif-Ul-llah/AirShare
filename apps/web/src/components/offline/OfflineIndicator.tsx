'use client';

import { WifiOff, Upload, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { useOffline } from '@/providers/OfflineProvider';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOnline, isSyncing, pendingCount, syncNow } = useOffline();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if online and no pending uploads
  if (isOnline && pendingCount === 0) return null;

  // Don't show if dismissed (resets when status changes)
  if (dismissed && isOnline) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50',
        'bg-card border rounded-xl shadow-lg overflow-hidden',
        className
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={cn(
              'p-2 rounded-lg shrink-0',
              isOnline
                ? 'bg-blue-500/10 text-blue-500'
                : 'bg-yellow-500/10 text-yellow-500'
            )}
          >
            {isOnline ? (
              <Upload className="h-5 w-5" />
            ) : (
              <WifiOff className="h-5 w-5" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {isOnline
                ? `${pendingCount} upload${pendingCount > 1 ? 's' : ''} pending`
                : 'You\'re offline'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOnline
                ? isSyncing
                  ? 'Syncing now...'
                  : 'Will sync automatically'
                : 'Changes will sync when back online'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isOnline && !isSyncing && pendingCount > 0 && (
              <button
                onClick={() => syncNow()}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Sync now"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            {isSyncing && (
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            )}
            {isOnline && (
              <button
                onClick={() => setDismissed(true)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar when syncing */}
      {isSyncing && (
        <div className="h-1 bg-muted">
          <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
        </div>
      )}
    </div>
  );
}

// Compact badge version
export function OfflineBadge({ className }: { className?: string }) {
  const { isOnline, pendingCount } = useOffline();

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium',
        isOnline
          ? 'bg-blue-500/10 text-blue-600'
          : 'bg-yellow-500/10 text-yellow-600',
        className
      )}
    >
      {isOnline ? (
        <>
          <Upload className="h-3 w-3" />
          {pendingCount} pending
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Offline
        </>
      )}
    </div>
  );
}
