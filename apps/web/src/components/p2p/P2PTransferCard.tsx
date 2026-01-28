'use client';

import {
  Upload,
  Download,
  X,
  Check,
  AlertTriangle,
  Loader2,
  File,
  Image as ImageIcon,
  Film,
  Music,
  FileText
} from 'lucide-react';
import type { TransferTask } from '@/lib/webrtc';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface P2PTransferCardProps {
  transfer: TransferTask;
  onCancel?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function P2PTransferCard({
  transfer,
  onCancel,
  onDismiss,
  className
}: P2PTransferCardProps) {
  const {
    filename,
    totalSize,
    transferredSize,
    speed,
    eta,
    status,
    direction,
    error
  } = transfer;

  const progress = totalSize > 0 ? (transferredSize / totalSize) * 100 : 0;
  const isActive = status === 'pending' || status === 'transferring';
  const isComplete = status === 'completed';
  const isFailed = status === 'failed';

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
      case 'transferring':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Preparing...';
      case 'transferring':
        return `${formatSpeed(speed)} - ${formatEta(eta)}`;
      case 'completed':
        return 'Complete';
      case 'failed':
        return error || 'Transfer failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 transition-colors',
        isActive && 'border-primary/50',
        isFailed && 'border-destructive/50',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'p-2 rounded-lg shrink-0',
            direction === 'send'
              ? 'bg-blue-500/10 text-blue-500'
              : 'bg-green-500/10 text-green-500'
          )}
        >
          {direction === 'send' ? (
            <Upload className="h-5 w-5" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileTypeIcon filename={filename} />
            <p className="font-medium text-sm truncate">{filename}</p>
            {getStatusIcon()}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatSize(transferredSize)} / {formatSize(totalSize)}</span>
            <span>({Math.round(progress)}%)</span>
          </div>

          {/* Progress bar */}
          {isActive && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-300',
                  direction === 'send' ? 'bg-blue-500' : 'bg-green-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Status */}
          <p className={cn(
            'text-xs mt-1.5',
            isActive && 'text-muted-foreground',
            isComplete && 'text-green-500',
            isFailed && 'text-destructive'
          )}>
            {getStatusText()}
          </p>
        </div>

        {/* Actions */}
        <div className="shrink-0">
          {isActive && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {!isActive && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTypeIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase();

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
  const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'flac'];
  const textExts = ['txt', 'md', 'json', 'xml', 'csv'];

  if (ext && imageExts.includes(ext)) {
    return <ImageIcon className="h-3.5 w-3.5 text-pink-500" />;
  }
  if (ext && videoExts.includes(ext)) {
    return <Film className="h-3.5 w-3.5 text-purple-500" />;
  }
  if (ext && audioExts.includes(ext)) {
    return <Music className="h-3.5 w-3.5 text-green-500" />;
  }
  if (ext && textExts.includes(ext)) {
    return <FileText className="h-3.5 w-3.5 text-blue-500" />;
  }
  return <File className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return 'calculating...';
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m remaining`;
  return `${Math.round(seconds / 3600)}h remaining`;
}
