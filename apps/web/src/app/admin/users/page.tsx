'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Shield,
  Ban,
  CheckCircle,
  Loader2,
  Mail,
  Calendar
} from 'lucide-react';
import type { User as UserType } from '@airshare/shared';
import { adminApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 10;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getUsers(page, ITEMS_PER_PAGE);
      setUsers(response.users);
      setTotal(response.total);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSuspendUser = async (userId: string) => {
    const reason = prompt('Enter suspension reason:');
    if (!reason) return;

    try {
      await adminApi.suspendUser(userId, reason);
      fetchUsers();
    } catch (err) {
      console.error('Failed to suspend user:', err);
    }
    setMenuOpen(null);
  };

  const handleUnsuspendUser = async (userId: string) => {
    if (!confirm('Are you sure you want to unsuspend this user?')) return;

    try {
      await adminApi.unsuspendUser(userId);
      fetchUsers();
    } catch (err) {
      console.error('Failed to unsuspend user:', err);
    }
    setMenuOpen(null);
  };

  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.email?.toLowerCase().includes(query) ||
      user.displayName?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground mt-1">
            Manage all users in your instance
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {total} total users
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
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
                    <th className="text-left px-6 py-4 font-medium text-sm">User</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Role</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Status</th>
                    <th className="text-left px-6 py-4 font-medium text-sm">Joined</th>
                    <th className="text-right px-6 py-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              displayName={user.displayName}
                              email={user.email}
                            />
                            <div>
                              <p className="font-medium">
                                {user.displayName || 'No name'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2 relative">
                            <button
                              onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {menuOpen === user.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-40"
                                  onClick={() => setMenuOpen(null)}
                                />
                                <div className="absolute right-0 top-full mt-1 w-48 bg-popover border rounded-xl shadow-lg z-50 py-2">
                                  {user.status === 'suspended' ? (
                                    <button
                                      onClick={() => handleUnsuspendUser(user.id)}
                                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted transition-colors text-left"
                                    >
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                      <span>Unsuspend User</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleSuspendUser(user.id)}
                                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-destructive/10 text-destructive transition-colors text-left"
                                    >
                                      <Ban className="h-4 w-4" />
                                      <span>Suspend User</span>
                                    </button>
                                  )}
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

function UserAvatar({
  displayName,
  email
}: {
  displayName?: string;
  email?: string;
}) {
  const name = displayName || email || 'U';
  const initial = name[0].toUpperCase();

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

  const colorIndex = (email || '').charCodeAt(0) % colors.length;

  return (
    <div
      className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center text-white font-medium',
        colors[colorIndex]
      )}
    >
      {initial}
    </div>
  );
}

function RoleBadge({ role }: { role?: string }) {
  const isAdmin = role === 'admin';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium',
        isAdmin
          ? 'bg-purple-500/10 text-purple-600'
          : 'bg-gray-500/10 text-gray-600'
      )}
    >
      {isAdmin && <Shield className="h-3.5 w-3.5" />}
      <span className="capitalize">{role || 'user'}</span>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const variants: Record<string, string> = {
    active: 'bg-green-500/10 text-green-600',
    suspended: 'bg-red-500/10 text-red-600',
    pending: 'bg-yellow-500/10 text-yellow-600',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium',
        variants[status || 'active'] || variants.active
      )}
    >
      <span className="capitalize">{status || 'active'}</span>
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
