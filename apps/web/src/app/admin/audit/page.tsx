'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  Loader2,
  User,
  FolderOpen,
  File,
  Shield,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock
} from 'lucide-react';
import type { AuditLog } from '@airshare/shared';
import { adminApi } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'auth', label: 'Authentication' },
  { value: 'room', label: 'Rooms' },
  { value: 'item', label: 'Items' },
  { value: 'admin', label: 'Admin Actions' },
  { value: 'system', label: 'System' },
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getAuditLogs({
        category: category || undefined,
        limit: 100,
      });
      setLogs(response.logs);
    } catch (err) {
      setError('Failed to load audit logs');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.action?.toLowerCase().includes(query) ||
      log.userId?.toLowerCase().includes(query) ||
      log.roomId?.toLowerCase().includes(query) ||
      log.details?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            View activity history across your instance
          </p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-48"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </Select>
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
        <div className="bg-card border rounded-2xl overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: AuditLog }) {
  const getIcon = () => {
    switch (log.category) {
      case 'auth':
        return User;
      case 'room':
        return FolderOpen;
      case 'item':
        return File;
      case 'admin':
        return Shield;
      case 'system':
        return Info;
      default:
        return Info;
    }
  };

  const getSeverityIcon = () => {
    switch (log.severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getCategoryColor = () => {
    switch (log.category) {
      case 'auth':
        return 'bg-blue-500/10 text-blue-500';
      case 'room':
        return 'bg-purple-500/10 text-purple-500';
      case 'item':
        return 'bg-green-500/10 text-green-500';
      case 'admin':
        return 'bg-red-500/10 text-red-500';
      case 'system':
        return 'bg-gray-500/10 text-gray-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const Icon = getIcon();

  return (
    <div className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors">
      {/* Icon */}
      <div className={cn('p-2 rounded-lg shrink-0', getCategoryColor())}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{formatAction(log.action)}</span>
          {getSeverityIcon()}
        </div>

        <p className="text-sm text-muted-foreground mb-2">
          {log.details || 'No details available'}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {log.userId && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {log.userId.slice(0, 8)}...
            </span>
          )}
          {log.roomId && (
            <span className="flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              {log.roomId}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDateTime(log.createdAt)}
          </span>
        </div>
      </div>

      {/* Category Badge */}
      <div
        className={cn(
          'px-2.5 py-1 rounded-full text-xs font-medium capitalize shrink-0',
          getCategoryColor()
        )}
      >
        {log.category}
      </div>
    </div>
  );
}

function formatAction(action?: string): string {
  if (!action) return 'Unknown Action';

  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / (1000 * 60));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
