'use client';

import {
  ArrowUpDown,
  Download,
  CheckCircle,
  X,
  FileDown
} from 'lucide-react';
import { useP2P } from '@/providers/WebRTCProvider';
import { P2PTransferCard } from './P2PTransferCard';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface P2PTransferListProps {
  className?: string;
}

export function P2PTransferList({ className }: P2PTransferListProps) {
  const {
    isLocalMode,
    activeTransfers,
    receivedFiles,
    cancelTransfer,
    acceptFile,
    dismissReceivedFile
  } = useP2P();

  if (!isLocalMode) return null;

  const hasItems = activeTransfers.length > 0 || receivedFiles.length > 0;

  if (!hasItems) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Active Transfers */}
      {activeTransfers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Transfers</span>
            <span className="text-xs text-muted-foreground">
              ({activeTransfers.length})
            </span>
          </div>
          {activeTransfers.map((transfer) => (
            <P2PTransferCard
              key={transfer.transferId}
              transfer={transfer}
              onCancel={() => cancelTransfer(transfer.transferId)}
            />
          ))}
        </div>
      )}

      {/* Received Files */}
      {receivedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Download className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium">Received Files</span>
            <span className="text-xs text-muted-foreground">
              ({receivedFiles.length})
            </span>
          </div>
          {receivedFiles.map(({ transfer, file }) => (
            <ReceivedFileCard
              key={transfer.transferId}
              transfer={transfer}
              file={file}
              onAccept={() => {
                const f = acceptFile(transfer.transferId);
                if (f) {
                  // Trigger download
                  downloadFile(f);
                }
              }}
              onDismiss={() => dismissReceivedFile(transfer.transferId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReceivedFileCard({
  transfer,
  file,
  onAccept,
  onDismiss
}: {
  transfer: any;
  file: File;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-card border border-green-500/30 rounded-xl p-4">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="p-2 rounded-lg bg-green-500/10">
          <CheckCircle className="h-5 w-5 text-green-500" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(file.size)} received
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onAccept}
            className="gap-1"
          >
            <FileDown className="h-4 w-4" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
