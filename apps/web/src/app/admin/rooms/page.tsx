'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Eye,
  Trash2,
  Ban,
  Loader2,
  Globe,
  Wifi,
  Lock,
  Users
} from 'lucide-react';
import type { Room } from '@airshare/shared';
import { adminApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchRooms = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getRooms(page, ITEMS_PER_PAGE);
      setRooms(response.rooms);
      setTotal(response.total);
    } catch (err) {
      setError('Failed to load rooms');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleDisableRoom = async (code: string) => {
    if (!confirm('Are you sure you want to disable this room?')) return;

    try {
      await adminApi.disableRoom(code);
      fetchRooms();
    } catch (err) {
      console.error('Failed to disable room:', err);
    }
    setMenuOpen(null);
  };

  const handleDeleteRoom = async (code: string) => {
    if (!confirm('Are you sure you want to permanently delete this room? This action cannot be undone.')) return;

    try {
      await adminApi.deleteRoom(code);
      fetchRooms();
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
    setMenuOpen(null);
  };

  const filteredRooms = rooms.filter((room) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      room.code.toLowerCase().includes(query) ||
      room.name?.toLowerCase().includes(query) ||
      room.createdBy?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Rooms</h1>
          <p className="text-muted-foreground mt-1">
            Manage all rooms in your instance
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {total} total rooms
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-6 py-4 font-medium text-sm">Room</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Mode</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Access</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Items</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Created</th>
                    <th className="text-right px-6 py-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRooms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                        No rooms found
                      </td>
                    </tr>
                  ) : (
                    filteredRooms.map((room) => (
                      <tr key={room.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                              <FolderOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{room.name || room.code}</p>
                              <p className="text-sm text-muted-foreground font-mono">
                                {room.code}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {room.mode === 'internet' ? (
                              <Globe className="h-4 w-4 text-blue-500" />
                            ) : (
                              <Wifi className="h-4 w-4 text-green-500" />
                            )}
                            <span className="capitalize">{room.mode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <AccessBadge access={room.access?.type || 'public'} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-muted-foreground">
                            {room.itemCount || 0} items
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(room.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 relative">
                            <Link
                              href={`/room/${room.code}`}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                              title="View room"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => setMenuOpen(menuOpen === room.id ? null : room.id)}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {menuOpen === room.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setMenuOpen(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-xl shadow-lg z-50 py-2">
                                  <button
                                    onClick={() => handleDisableRoom(room.code)}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left"
                                  >
                                    <Ban className="h-4 w-4" />
                                    <span>Disable Room</span>
                                  </button>
                                  <div className="my-2 border-t" />
                                  <button
                                    onClick={() => handleDeleteRoom(room.code)}
                                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-destructive/10 text-destructive transition-colors text-left"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Delete Room</span>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function AccessBadge({ access }: { access: string }) {
  const variants: Record<string, { icon: React.ElementType; className: string }> = {
    public: {
      icon: Globe,
      className: 'bg-green-500/10 text-green-600',
    },
    private: {
      icon: Lock,
      className: 'bg-blue-500/10 text-blue-600',
    },
    password: {
      icon: Lock,
      className: 'bg-orange-500/10 text-orange-600',
    },
  };

  const { icon: Icon, className } = variants[access] || variants.public;

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium', className)}>
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{access}</span>
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
