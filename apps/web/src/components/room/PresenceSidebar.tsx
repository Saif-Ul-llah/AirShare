'use client';

import { useState } from 'react';
import { Users, ChevronRight, Circle, Wifi, WifiOff } from 'lucide-react';
import { useRoomStore } from '@/lib/stores';
import { useWebSocket } from '@/providers/WebSocketProvider';
import { cn } from '@/lib/utils';

interface PresenceSidebarProps {
  className?: string;
}

export function PresenceSidebar({ className }: PresenceSidebarProps) {
  const { presence } = useRoomStore();
  const { isConnected, peerId } = useWebSocket();
  const [isExpanded, setIsExpanded] = useState(true);

  const sortedPresence = [...presence].sort((a, b) => {
    // Current user first
    if (a.odId === peerId) return -1;
    if (b.odId === peerId) return 1;
    // Then by join time
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });

  return (
    <div className={cn('border-l bg-card', className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 border-b hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">People</span>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {presence.length}
          </span>
        </div>
        <ChevronRight
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
      </button>

      {/* Connection Status */}
      <div className="px-4 py-2 border-b flex items-center gap-2">
        {isConnected ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-green-600">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-yellow-500 animate-pulse" />
            <span className="text-xs text-yellow-600">Connecting...</span>
          </>
        )}
      </div>

      {/* User List */}
      {isExpanded && (
        <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
          {sortedPresence.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No one else here yet
            </div>
          ) : (
            sortedPresence.map((peer) => (
              <UserItem
                key={peer.odId}
                displayName={peer.displayName}
                odId={peer.odId}
                isCurrentUser={peer.odId === peerId}
                joinedAt={peer.joinedAt}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function UserItem({
  displayName,
  odId,
  isCurrentUser,
  joinedAt
}: {
  displayName?: string;
  odId: string;
  isCurrentUser: boolean;
  joinedAt: Date;
}) {
  const name = displayName || `User ${(odId || '').slice(0, 4)}`;
  const initial = (name[0] || '?').toUpperCase();

  // Generate a consistent color based on the odId
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500'
  ];
  const colorIndex = (odId || '').charCodeAt(0) % colors.length || 0;
  const avatarColor = colors[colorIndex];

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      {/* Avatar */}
      <div className="relative">
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium',
            avatarColor
          )}
        >
          {initial}
        </div>
        {/* Online indicator */}
        <Circle className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-green-500 fill-green-500" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {isCurrentUser && (
            <span className="text-xs text-muted-foreground">(you)</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Joined {formatTimeAgo(joinedAt)}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} mins ago`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;

  return 'earlier';
}

// Compact version for mobile or when space is limited
export function PresenceIndicator() {
  const { presence } = useRoomStore();
  const { isConnected } = useWebSocket();

  if (presence.length === 0) return null;

  // Show up to 3 avatars, then a count
  const visibleUsers = presence.slice(0, 3);
  const remainingCount = presence.length - 3;

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500'
  ];

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visibleUsers.map((peer, index) => {
          const name = peer.displayName || `User ${(peer.odId || '').slice(0, 4)}`;
          const initial = name[0].toUpperCase();

          return (
            <div
              key={peer.odId}
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-medium border-2 border-background',
                colors[index % colors.length]
              )}
              title={name}
            >
              {initial}
            </div>
          );
        })}
        {remainingCount > 0 && (
          <div className="h-7 w-7 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium border-2 border-background">
            +{remainingCount}
          </div>
        )}
      </div>
      <div
        className={cn(
          'ml-2 h-2 w-2 rounded-full',
          isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
        )}
      />
    </div>
  );
}
