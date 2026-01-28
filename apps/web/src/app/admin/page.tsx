'use client';

import { useEffect, useState } from 'react';
import {
  FolderOpen,
  Users,
  HardDrive,
  Activity,
  TrendingUp,
  File,
  Image,
  Video,
  FileText,
  Code,
  Loader2
} from 'lucide-react';
import { adminApi } from '@/lib/api/endpoints';

interface Stats {
  totalRooms: number;
  activeRooms: number;
  totalUsers: number;
  totalStorage: number;
  storageByType: Record<string, number>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await adminApi.getStats();
      setStats(response);
    } catch (err) {
      setError('Failed to load stats');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive p-4 rounded-xl">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your AirShare instance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          icon={FolderOpen}
          label="Total Rooms"
          value={stats?.totalRooms || 0}
          trend={`${stats?.activeRooms || 0} active`}
          color="blue"
        />
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats?.totalUsers || 0}
          color="green"
        />
        <StatCard
          icon={HardDrive}
          label="Total Storage"
          value={formatStorage(stats?.totalStorage || 0)}
          color="purple"
        />
        <StatCard
          icon={Activity}
          label="Active Rooms"
          value={stats?.activeRooms || 0}
          trend={stats ? `${Math.round((stats.activeRooms / stats.totalRooms) * 100)}%` : '0%'}
          color="orange"
        />
      </div>

      {/* Storage Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-card border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Storage by Type</h2>
          <div className="space-y-4">
            {stats?.storageByType && Object.entries(stats.storageByType).length > 0 ? (
              Object.entries(stats.storageByType).map(([type, bytes]) => (
                <StorageBar
                  key={type}
                  type={type}
                  bytes={bytes}
                  total={stats.totalStorage}
                />
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No storage data available
              </p>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">Rooms per User</p>
                  <p className="text-sm text-muted-foreground">Average</p>
                </div>
              </div>
              <span className="text-2xl font-bold">
                {stats && stats.totalUsers > 0
                  ? (stats.totalRooms / stats.totalUsers).toFixed(1)
                  : '0'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <HardDrive className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Storage per Room</p>
                  <p className="text-sm text-muted-foreground">Average</p>
                </div>
              </div>
              <span className="text-2xl font-bold">
                {stats && stats.totalRooms > 0
                  ? formatStorage(stats.totalStorage / stats.totalRooms)
                  : '0 B'}
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium">Room Activity</p>
                  <p className="text-sm text-muted-foreground">Active rate</p>
                </div>
              </div>
              <span className="text-2xl font-bold">
                {stats && stats.totalRooms > 0
                  ? `${Math.round((stats.activeRooms / stats.totalRooms) * 100)}%`
                  : '0%'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  color
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  trend?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
    orange: 'bg-orange-500/10 text-orange-500',
  };

  return (
    <div className="bg-card border rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div className={`h-12 w-12 rounded-xl ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            {trend}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

function StorageBar({
  type,
  bytes,
  total
}: {
  type: string;
  bytes: number;
  total: number;
}) {
  const percentage = total > 0 ? (bytes / total) * 100 : 0;

  const getTypeIcon = () => {
    switch (type.toLowerCase()) {
      case 'image':
        return Image;
      case 'video':
        return Video;
      case 'document':
      case 'text':
        return FileText;
      case 'code':
        return Code;
      default:
        return File;
    }
  };

  const getTypeColor = () => {
    switch (type.toLowerCase()) {
      case 'image':
        return 'bg-pink-500';
      case 'video':
        return 'bg-purple-500';
      case 'document':
      case 'text':
        return 'bg-blue-500';
      case 'code':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const Icon = getTypeIcon();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium capitalize">{type}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatStorage(bytes)}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${getTypeColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
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
