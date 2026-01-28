'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Upload,
  X,
  File,
  Image as ImageIcon,
  FileText,
  Film,
  Music,
  Archive,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import { useItemActions } from '@/hooks';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  roomCode: string;
  onClose?: () => void;
}

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export function FileUploader({ roomCode, onClose }: FileUploaderProps) {
  const { uploadFile } = useItemActions();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      status: 'pending',
      progress: 0
    }));
    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        addFiles(selectedFiles);
      }
      // Reset input
      e.target.value = '';
    },
    [addFiles]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const uploadAllFiles = async () => {
    for (const uploadFile of files.filter((f) => f.status === 'pending')) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
        )
      );

      try {
        await uploadFile(uploadFile.file, roomCode, (progress) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === uploadFile.id ? { ...f, progress } : f
            )
          );
        });

        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? { ...f, status: 'completed', progress: 100 }
              : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : f
          )
        );
      }
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <div className="border rounded-2xl bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Upload Files</h3>
        <div className="flex items-center gap-2">
          {files.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {completedCount}/{files.length} uploaded
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'p-8 m-4 border-2 border-dashed rounded-xl cursor-pointer transition-all',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <div className="text-center">
          <Upload
            className={cn(
              'h-10 w-10 mx-auto mb-4 transition-colors',
              isDragging ? 'text-primary' : 'text-muted-foreground'
            )}
          />
          <p className="text-lg font-medium mb-1">
            {isDragging ? 'Drop files here' : 'Drag and drop files'}
          </p>
          <p className="text-sm text-muted-foreground">
            or click to browse from your device
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="border-t">
          <div className="max-h-64 overflow-y-auto">
            {files.map((uploadFile) => (
              <FileItem
                key={uploadFile.id}
                uploadFile={uploadFile}
                onRemove={() => removeFile(uploadFile.id)}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {pendingCount > 0 && (
                <span>{pendingCount} file{pendingCount > 1 ? 's' : ''} ready</span>
              )}
              {uploadingCount > 0 && (
                <span className="text-primary">Uploading...</span>
              )}
              {pendingCount === 0 && uploadingCount === 0 && completedCount > 0 && (
                <span className="text-green-500">All uploads complete</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiles([])}
                disabled={uploadingCount > 0}
              >
                Clear All
              </Button>
              <Button
                size="sm"
                onClick={uploadAllFiles}
                disabled={pendingCount === 0 || uploadingCount > 0}
                isLoading={uploadingCount > 0}
              >
                {uploadingCount > 0
                  ? `Uploading (${uploadingCount})`
                  : `Upload ${pendingCount} File${pendingCount > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileItem({
  uploadFile,
  onRemove
}: {
  uploadFile: UploadFile;
  onRemove: () => void;
}) {
  const { file, status, progress, error } = uploadFile;

  const getFileIcon = () => {
    const type = file.type.split('/')[0];
    switch (type) {
      case 'image':
        return ImageIcon;
      case 'video':
        return Film;
      case 'audio':
        return Music;
      case 'text':
        return FileText;
      default:
        if (file.name.match(/\.(zip|rar|7z|tar|gz)$/i)) {
          return Archive;
        }
        return File;
    }
  };

  const Icon = getFileIcon();

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
      {/* Icon */}
      <div className="p-2 rounded-lg bg-muted shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm truncate">{file.name}</p>
          {status === 'completed' && (
            <Check className="h-4 w-4 text-green-500 shrink-0" />
          )}
          {status === 'error' && (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
          {status === 'uploading' && (
            <span className="text-xs text-primary">{Math.round(progress)}%</span>
          )}
          {status === 'error' && (
            <span className="text-xs text-destructive">{error}</span>
          )}
        </div>

        {/* Progress Bar */}
        {status === 'uploading' && (
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {status === 'uploading' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <button
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Remove"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
