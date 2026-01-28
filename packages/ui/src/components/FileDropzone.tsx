import React, { useCallback, useState } from 'react';
import { cn } from '../utils';

export interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onDrop,
  accept,
  multiple = true,
  maxSize,
  maxFiles,
  disabled = false,
  className,
  children,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback(
    (files: File[]): File[] => {
      setError(null);
      let validFiles = [...files];

      // Check max files
      if (maxFiles && validFiles.length > maxFiles) {
        setError(`Maximum ${maxFiles} files allowed`);
        validFiles = validFiles.slice(0, maxFiles);
      }

      // Check file sizes
      if (maxSize) {
        const oversized = validFiles.filter((f) => f.size > maxSize);
        if (oversized.length > 0) {
          setError(`Some files exceed the maximum size of ${formatSize(maxSize)}`);
          validFiles = validFiles.filter((f) => f.size <= maxSize);
        }
      }

      // Check accepted types
      if (accept) {
        const acceptedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
        validFiles = validFiles.filter((file) => {
          const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
          const mime = file.type.toLowerCase();
          return acceptedTypes.some(
            (accepted) =>
              accepted === ext ||
              accepted === mime ||
              (accepted.endsWith('/*') && mime.startsWith(accepted.replace('/*', '/')))
          );
        });
      }

      return validFiles;
    },
    [maxFiles, maxSize, accept]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      const validFiles = validateFiles(files);

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    },
    [disabled, onDrop, validateFiles]
  );

  const handleClick = useCallback(() => {
    if (disabled) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;

    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const validFiles = validateFiles(files);

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    };

    input.click();
  }, [disabled, multiple, accept, onDrop, validateFiles]);

  return (
    <div
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
          : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
    >
      {children || (
        <>
          <svg
            className={cn(
              'mb-4 h-12 w-12',
              isDragging ? 'text-blue-500' : 'text-gray-400'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="mb-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {accept ? `Accepted: ${accept}` : 'Any file type'}
            {maxSize && ` (max ${formatSize(maxSize)})`}
          </p>
        </>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
