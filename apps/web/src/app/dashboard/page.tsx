'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Share2,
  Wifi,
  Globe,
  Lock,
  Clock,
  Users,
  MoreVertical,
  Trash2,
  ExternalLink,
  LogOut,
  Settings,
  FolderOpen
} from 'lucide-react';
import type { Room } from '@airshare/shared';
import { useAuthStore, useRoomStore } from '@/lib/stores';
import { Button } from '@/components/ui/Button';
import { CreateRoomDialog } from '@/components/room/CreateRoomDialog';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore();
  const { myRooms, myRoomsLoading, fetchMyRooms } = useRoomStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Redirect if not authenticated (only after auth is fully initialized)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch user's rooms
  useEffect(() => {
    if (isAuthenticated) {
      fetchMyRooms();
    }
  }, [isAuthenticated, fetchMyRooms]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const activeRooms = myRooms.filter((r) => !r.deletedAt);
  const localRooms = activeRooms.filter((r) => r.mode === 'local');
  const internetRooms = activeRooms.filter((r) => r.mode === 'internet');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">AirShare</span>
          </div>

          <div className="flex items-center gap-4">
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              New Room
            </Button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {user?.displayName?.[0] || user?.email[0].toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {user?.displayName || user?.email.split('@')[0]}
                </span>
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-popover border rounded-xl shadow-lg z-50 py-2">
                    <div className="px-4 py-2 border-b">
                      <p className="font-medium truncate">
                        {user?.displayName || 'User'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        router.push('/settings');
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <div className="my-2 border-t" />
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">
            Welcome back, {user?.displayName || user?.email.split('@')[0]}
          </h1>
          <p className="text-muted-foreground">
            Manage your rooms and shared content
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Rooms"
            value={activeRooms.length}
            icon={FolderOpen}
          />
          <StatCard
            label="Local Rooms"
            value={localRooms.length}
            icon={Wifi}
            iconColor="text-green-500"
          />
          <StatCard
            label="Internet Rooms"
            value={internetRooms.length}
            icon={Globe}
            iconColor="text-blue-500"
          />
          <StatCard
            label="Storage Used"
            value={formatStorage(user?.storage?.used || 0)}
            icon={FolderOpen}
            subtitle={`of ${formatStorage(user?.storage?.limit || 0)}`}
          />
        </div>

        {/* Rooms List */}
        {myRoomsLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading rooms...
          </div>
        ) : activeRooms.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreateDialog(true)} />
        ) : (
          <div className="space-y-6">
            {/* Internet Rooms */}
            {internetRooms.length > 0 && (
              <RoomSection
                title="Internet Rooms"
                icon={Globe}
                iconColor="text-blue-500"
                rooms={internetRooms}
              />
            )}

            {/* Local Rooms */}
            {localRooms.length > 0 && (
              <RoomSection
                title="Local Network Rooms"
                icon={Wifi}
                iconColor="text-green-500"
                rooms={localRooms}
              />
            )}
          </div>
        )}
      </main>

      {/* Create Room Dialog */}
      <CreateRoomDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-muted-foreground',
  subtitle
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
  subtitle?: string;
}) {
  return (
    <div className="p-4 border rounded-xl bg-card">
      <div className="flex items-center gap-3 mb-2">
        <Icon className={cn('h-5 w-5', iconColor)} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      )}
    </div>
  );
}

function RoomSection({
  title,
  icon: Icon,
  iconColor,
  rooms
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  rooms: Room[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={cn('h-5 w-5', iconColor)} />
        <h2 className="font-semibold">{title}</h2>
        <span className="text-sm text-muted-foreground">({rooms.length})</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>
    </div>
  );
}

function RoomCard({ room }: { room: Room }) {
  const router = useRouter();
  const { deleteRoom } = useRoomStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      await deleteRoom(room.code);
    }
  };

  return (
    <div
      className="p-4 border rounded-xl bg-card hover:shadow-md transition-all cursor-pointer group"
      onClick={() => router.push(`/room/${room.code}`)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {room.mode === 'local' ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <Globe className="h-4 w-4 text-blue-500" />
          )}
          <h3 className="font-medium truncate">{room.name}</h3>
        </div>

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
              />
              <div className="absolute right-0 top-full mt-1 w-40 bg-popover border rounded-xl shadow-lg z-50 py-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(
                      `${window.location.origin}/room/${room.code}`
                    );
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted transition-colors text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  Copy Link
                </button>
                <div className="my-1 border-t" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-destructive/10 text-destructive transition-colors text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1 font-mono">
          {room.code}
        </div>
        {room.access === 'password' && (
          <div className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {formatTimeAgo(room.lastActivityAt || room.createdAt)}
        </div>
        {room.expiresAt && (
          <div className="flex items-center gap-1">
            Expires {formatTimeAgo(room.expiresAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-16 border rounded-2xl bg-muted/30">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
        <FolderOpen className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No rooms yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Create your first room to start sharing files and content
      </p>
      <Button onClick={onCreateClick}>
        <Plus className="h-4 w-4" />
        Create Room
      </Button>
    </div>
  );
}

function formatStorage(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTimeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 0) {
    // Future date (for expiresAt)
    const absDiff = Math.abs(diff);
    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days < 7) return `in ${days} days`;
    return d.toLocaleDateString();
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes <= 1 ? 'just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
